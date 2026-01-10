import https from "https";
import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";
import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise'; // これを追加
// --- ここから修正 ---
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env の場所を絶対パスで指定して読み込む
dotenv.config({ path: path.join(__dirname, ".env") });

// デバッグ用（起動時にURLが出れば成功！）
console.log("📍 Supabase URL:", process.env.SUPABASE_URL);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'tokumoto',
  password: process.env.DB_PASS, // .envに書いたパスワード
  database: 'chat_app',
  waitForConnections: true,
  connectionLimit: 10
});

console.log("🗄️  [DB] MariaDB (2TB SSD Storage) Connected.");

// --- ここまで ---

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
// ===== TLS (SSL証明書) =====
// ローカル開発などで証明書がない場合でも落ちないように修正
let httpsServer;
try {
  const tlsOptions = {
    key: fs.readFileSync("/etc/letsencrypt/live/mail.shudo-physics.com/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/mail.shudo-physics.com/fullchain.pem"),
  };
  httpsServer = https.createServer(tlsOptions);
} catch (e) {
  console.warn("⚠️ SSL証明書が見つかりません。通常のHTTPサーバーとして動作する可能性があります。");
  // 必要ならここで process.exit(1)
  // 今回はコード提示用なのでこのまま進めます
  httpsServer = https.createServer();
}

const wss = new WebSocketServer({ server: httpsServer });

// ===== 管理用 Map =====
const connectedUsers = new Map(); // UUID -> ws

// ===== ユーティリティ =====
function send(ws, obj) {
  // wsが存在していて、かつ接続が開いている時だけ送る
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(obj));
    } catch (e) {
      console.error("🚨 送信エラー:", e);
    }
  }
}

// オンライン状態の一括リセット
async function resetOnlineStatus() {
  console.log("🧹 全ユーザーのオンライン状態をリセット中...");
  await supabase.from('profile_users').update({ is_active: false }).eq('is_active', true);
}

// ★追加★ Ping/Pong (心拍確認)
// 30秒ごとに生存確認を行い、応答がないゾンビ接続を強制切断する
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    // isAliveがfalseのままなら、前回のPingに応答しなかったので切断
    if (ws.isAlive === false) {
      console.log("💀 ゾンビ接続を切断します");
      return ws.terminate();
    }

    // 次のPongが来るまで一旦falseにする
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});


// ===== JOIN 処理 =====
async function handleJoin(ws, msg) {
  const { name, uuid, token } = msg;

  // 1. パラメータチェック
  if (!name || !token || !uuid) {
    send(ws, { type: "join-nack", reason: "Invalid parameters" });
    ws.close();
    return;
  }

  // 2. 認証チェック
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user || user.id !== uuid) {
    console.error(`🚨 認証失敗: ${name} (UUID: ${uuid})`);
    send(ws, { type: "join-nack", reason: "Authentication failed" });
    ws.close();
    return;
  }

  // 3. 登録処理
  connectedUsers.set(uuid, ws); 
  ws.authenticated = true;
  ws.uuid = uuid;
  ws.isAlive = true;

  // DB更新
  await supabase.from('profile_users').update({ is_active: true }).eq('uuid', uuid);
  console.log(`✅ ログイン成功: ${name} (${uuid})`);

  // 4. 【重要】履歴の取得と送信
  try {
    // ★修正1: 「自分宛て(to)」または「自分発(from)」の両方を取る！
    // これをしないと、自分が喋った内容が履歴に出ません。
    const [rows] = await db.execute(
      `SELECT from_uuid, iv, data, time, subtype 
       FROM encrypted_messages 
       WHERE to_uuid = ? OR from_uuid = ? 
       ORDER BY time DESC  
       LIMIT 50`, 
      [uuid, uuid] // ? が2つになったので、uuidも2回渡す
    );

    rows.reverse(); // 古い順に戻す

    send(ws, { 
      type: "history", 
      messages: rows.map(r => ({
        type: "message",             // クライアントの形式に合わせる
        uuid: r.from_uuid,           // ★修正2: クライアントは "uuid" を見て左右判定しています
        name: r.from_uuid === uuid ? name : "相手", // (名前はDBになければ簡易的でOK)
        
        iv: r.iv.toString('base64'), 
        data: r.data.toString('base64'), // ★修正3: 本文も必ずBase64文字列にする！(Bufferのままだと死にます)
        
        subType: r.subtype,
        time: r.time
      }))
    });
    console.log(`📦 ${name} に履歴 ${rows.length} 件を送信`);

  } catch (err) {
    console.error("🚨 履歴取得失敗:", err);
  }

  // 5. ログイン完了通知
  send(ws, { type: "join-ack" });
}

// ===== LEAVE 処理 =====
async function handleLeave(ws) {
  if (ws.uuid && connectedUsers.get(ws.uuid) === ws) {
    connectedUsers.delete(ws.uuid);
    // DBをオフラインに戻す
    await supabase.from('profile_users').update({ is_active: false }).eq('uuid', ws.uuid);
  }

}

// ===== 接続管理 =====
wss.on("connection", (ws) => {
  ws.authenticated = false;
  ws.isAlive = true;

  // ★追加: Pong受信で生存フラグを回復
  ws.on('pong', () => {
    ws.isAlive = true;
  });

ws.on("message", async (data) => { // async を追加して DB 保存を待てるようにする
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      console.error("JSON Parse Error:", e);
      return;
    }

    switch (msg.type) {
      case "join":
        handleJoin(ws, msg);
        break;
      
case "message": {  // ← ★ここに開始の波括弧を追加！
        if (!ws.authenticated) {
          console.warn("⚠️ 未認証ブロック");
          return;
        }
        if (!msg.to) return;

        // デフォルトは 'text'
        const subtype = msg.subtype || 'text';

        // SSD保存
        try {
          await db.execute(
            'INSERT INTO encrypted_messages (to_uuid, from_uuid, iv, data, subtype) VALUES (?, ?, ?, ?, ?)',
            [msg.to, ws.uuid, Buffer.from(msg.iv, 'base64'), msg.data, subtype]
          );
          console.log(`💾 [SSD Saved] ${ws.uuid} -> ${msg.to} (${subtype})`);
        } catch (e) {
          console.error("🚨 DB保存エラー:", e);
        }

        // 転送処理
        // ★ここで const targetWs を宣言しても、{ }の中なら怒られない！
        const targetWs = connectedUsers.get(msg.to);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          send(targetWs, {
            type: "message",
            from: ws.uuid,
            iv: msg.iv,
            data: msg.data,
            subtype: subtype,
            time: new Date().toISOString()
          });
          console.log(`📡 [Relay] ${ws.uuid} -> ${msg.to} (Direct)`);
        }
        break;
      } // ← ★ここに閉じの波括弧を追加！

      case "leave":
        handleLeave(ws);
        break;
    }
  });

  ws.on("close", () => {
    handleLeave(ws);
  });
});

// 起動処理
resetOnlineStatus().then(() => {
  // ポートは環境に合わせて変更してください (443 or 8080)
  httpsServer.listen(443, () => {
    console.log("🚀 Server Running with Heartbeat & Auth Guard");
  });
});