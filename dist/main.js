//npx wscat -c wss://mail.shudo-physics.com/
import { generateEd25519KeyPair, generateX25519KeyPair } from "./mojyu-ru/crypto/ecdh.js";
import { arrayBufferToBase64, base64ToUint8Array } from "./mojyu-ru/base64.js"; // 16進数変換のみ残す
import { generateSalt, generateMasterSeed } from "./mojyu-ru/crypto/saltaes.js";
import { PublicKeyFetch } from "./mojyu-ru/crypto/kdf.js";
import { encrypt, deriveKeyFromPin, deriveSharedKey } from "./mojyu-ru/crypto/aes.js";
// @supabase/supabase-js ではなく、URLを直接指定する
// @ts-ignore
import { createClient
// @ts-ignore
 } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
// --- 実行デモ ---
// 32バイトのシード（本来はPINから生成）
async function main() {
    document.body.style.cssText = "margin: 0; padding: 0; background-color: #f0f2f5; font-family: sans-serif;";
    const roomSelection = document.createElement("div");
    roomSelection.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;";
    const roomCard = document.createElement("div");
    roomCard.style.cssText = "background: white; padding: 30px; border-radius: 15px; box-shadow: 0 12px 28px rgba(0,0,0,0.1); text-align: center;";
    const inputroom = document.createElement("input");
    inputroom.placeholder = "UUIDを入力...";
    inputroom.style.cssText = "width: 250px; padding: 12px; border-radius: 8px; border: 1px solid #ddd; outline: none; font-size: 16px; margin-bottom: 15px; display: block;";
    const btnroom = document.createElement("button");
    btnroom.textContent = "メッセージをチェック";
    btnroom.style.cssText = "width: 100%; padding: 12px; border-radius: 8px; border: none; background: #0084ff; color: white; font-weight: bold; cursor: pointer;";
    roomCard.append(inputroom, btnroom);
    roomSelection.append(roomCard);
    document.body.appendChild(roomSelection);
    const chatContainer = document.createElement("div");
    chatContainer.style.cssText = "display: none; height: 100vh; flex-direction: column;";
    const chatHeader = document.createElement("div");
    chatHeader.style.cssText = "padding: 15px; background: white; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold;";
    const chatBox = document.createElement("div");
    chatBox.id = "chatBox";
    chatBox.style.cssText = "flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 8px;";
    const inputContainer = document.createElement("div");
    inputContainer.style.cssText = "padding: 15px; background: white; display: flex; gap: 10px; border-top: 1px solid #ddd;";
    const input = document.createElement("input");
    input.placeholder = "Aa";
    input.style.cssText = "flex: 1; padding: 10px 15px; border-radius: 20px; border: none; background: #f0f2f5; outline: none;";
    const sendBtn = document.createElement("button");
    sendBtn.textContent = "送信";
    sendBtn.style.cssText = "background: none; border: none; color: #0084ff; font-weight: bold; cursor: pointer;";
    inputContainer.append(input, sendBtn);
    chatContainer.append(chatHeader, chatBox, inputContainer);
    document.body.appendChild(chatContainer);
    function addMediaBubble(url, uuidName, originalName, isMe, subType) {
        const chatBox = document.getElementById("chatBox");
        if (!chatBox)
            return;
        // 1. コンテナ作成（吹き出しの枠）
        const container = document.createElement("div");
        container.style.cssText = `
        max-width: 70%; 
        margin: 10px 0;
        padding: 8px;
        align-self: ${isMe ? "flex-end" : "flex-start"};
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: ${isMe ? "#0084ff" : "#e4e6eb"};
        border-radius: 15px;
        ${isMe ? "border-bottom-right-radius: 4px;" : "border-bottom-left-radius: 4px;"}
    `;
        // 2. ファイルタイプの判定
        const lowerName = originalName.toLowerCase();
        // 動画判定
        const isVideo = lowerName.endsWith(".mp4") || lowerName.endsWith(".mov") || lowerName.endsWith(".webm");
        // 音声判定 (subTypeも見る)
        const isAudio = subType === "audio" || lowerName.endsWith(".m4a") || lowerName.endsWith(".mp3") || lowerName.endsWith(".wav");
        // 表示名
        const displayName = originalName || uuidName;
        // 3. 中身の要素を作る
        if (subType === "image" && !isVideo && !isAudio) {
            // --- 🖼️ 画像の場合 ---
            const img = document.createElement("img");
            img.src = url;
            img.style.cssText = "width: 100%; max-width: 250px; border-radius: 12px; cursor: pointer;";
            // 画像をクリックしたら別タブで開く（拡大表示用）
            img.onclick = () => window.open(url, '_blank');
            container.appendChild(img);
        }
        else if (isVideo) {
            // --- 🎥 動画の場合 ---
            const video = document.createElement("video");
            video.src = url;
            video.controls = true;
            // iOSなどでインライン再生できるように
            video.setAttribute("playsinline", "true");
            video.style.cssText = "width: 100%; max-width: 250px; border-radius: 12px;";
            container.appendChild(video);
        }
        else if (isAudio) {
            // --- 🎤 音声の場合 ---
            const audio = document.createElement("audio");
            audio.src = url;
            audio.controls = true;
            audio.style.cssText = "width: 100%; min-width: 200px; max-width: 250px; height: 40px;";
            container.appendChild(audio);
        }
        else {
            // --- 📁 その他のファイル (ZIP, PDF, EXEなど) ---
            // ここがないと、謎の空白の吹き出しになってしまいます！
            const fileIcon = document.createElement("div");
            fileIcon.textContent = "📄 ファイル";
            fileIcon.style.cssText = `
            font-size: 24px; 
            text-align: center; 
            margin-bottom: 5px;
        `;
            container.appendChild(fileIcon);
        }
        // 4. ファイル名＆ダウンロードリンク（全タイプ共通）
        const nameLabel = document.createElement("a");
        nameLabel.href = url;
        nameLabel.download = originalName; // ちゃんと拡張子付きの名前で保存させる
        nameLabel.textContent = `📥 ${displayName}`; // アイコンをつけると分かりやすい
        nameLabel.style.cssText = `
        font-size: 12px; 
        color: ${isMe ? "rgba(255,255,255,0.9)" : "#0084ff"}; 
        text-decoration: none;
        font-weight: bold;
        cursor: pointer;
        word-break: break-all;
        display: block;
        margin-top: 4px;
    `;
        // ホバー時に下線をつける（JSでCSS擬似クラスは書けないのでmouseenterで代用）
        nameLabel.onmouseenter = () => nameLabel.style.textDecoration = "underline";
        nameLabel.onmouseleave = () => nameLabel.style.textDecoration = "none";
        container.appendChild(nameLabel);
        // 5. 画面に追加してスクロール
        chatBox.appendChild(container);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    // ★ chatBoxが「ドロップ受付中」であることを明示する
    chatBox.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        chatBox.style.backgroundColor = "rgba(0,132,255,0.1)"; // ドラッグ中に色を変えると「ここだ！」ってわかります
    });
    chatBox.addEventListener("dragleave", () => {
        chatBox.style.backgroundColor = ""; // 背景をクリア
    });
    // 3. ドロップした時（ファイルを処理して、色も戻す）
    chatBox.addEventListener("drop", async (e) => {
        e.preventDefault();
        chatBox.style.backgroundColor = ""; // ★ドロップ完了時も元に戻す
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0)
            return;
        const file = files[0];
        let subType = "file";
        if (file.type.startsWith("image/"))
            subType = "image";
        if (file.type.startsWith("audio/"))
            subType = "audio";
        if (file.type.startsWith("video/"))
            subType = "image";
        await processFileAndSend(file, subType);
    });
    async function handleFileSelect(event, subType) {
        const target = event.target;
        const file = target.files?.[0];
        if (!file)
            return;
        await processFileAndSend(file, subType);
        target.value = ""; // 入力をリセット
    }
    // --- 2. 送信司令塔（originalNameを送信に含める） ---
    // ★ 新しく作る：ファイルを受け取って送信するだけの「心臓部」
    async function processFileAndSend(file, subType) {
        if (!aesKeyhash) {
            addSystemMsg("鍵がまだ交換されていません。相手が参加するまでお待ちください。");
            return;
        }
        // 物理班の安全装置
        const MAX_SIZE = 15 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            addSystemMsg(`⚠️ サイズ超過: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
            return;
        }
        let finalSubType = subType;
        if (file.type.startsWith('audio/'))
            finalSubType = "audio";
        // 動画の場合、subTypeをimageにしておくとaddMediaBubbleでvideoタグが作られやすい
        if (file.type.startsWith('video/'))
            finalSubType = "image";
        const extension = file.name.split('.').pop();
        const uuidName = `${crypto.randomUUID()}.${extension}`;
        try {
            const arrayBuffer = await file.arrayBuffer();
            const plaintext = new Uint8Array(arrayBuffer);
            const encrypted = await encrypt(aesKeyhash, plaintext);
            const [ivB64, dataB64] = await Promise.all([
                arrayBufferToBase64(encrypted.iv),
                arrayBufferToBase64(encrypted.data)
            ]);
            const msg = {
                type: "message",
                subType: finalSubType,
                mimeType: file.type,
                fileName: uuidName,
                originalName: file.name,
                room: room,
                name: name,
                uuid: storedUuid,
                iv: ivB64,
                data: dataB64,
            };
            wss.send(JSON.stringify(msg));
            const url = URL.createObjectURL(new Blob([plaintext], { type: file.type }));
            addMediaBubble(url, uuidName, file.name, true, finalSubType);
        }
        catch (e) {
            console.error("送信エラー:", e);
        }
    }
    // --- 3. UIの設置（inputContainerへの追加） ---
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);
    const fileBtn = document.createElement("button");
    fileBtn.textContent = "＋";
    fileBtn.style.cssText = "background: none; border: none; font-size: 20px; cursor: pointer; padding: 5px;";
    fileBtn.onclick = () => fileInput.click();
    inputContainer.prepend(fileBtn);
    fileInput.onchange = (e) => handleFileSelect(e, "file");
    // 1. 中央配置用のコンテナを作る
    const pinContainer = document.createElement("div");
    pinContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    background: white;
    padding: 30px;
    border-radius: 16px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    z-index: 2000;
    width: 80%;
    max-width: 300px;
`;
    // 2. PIN入力欄（大きくする）
    const pininput = document.createElement("input");
    pininput.type = "password";
    pininput.placeholder = "PIN(数字)";
    pininput.inputMode = "numeric"; // スマホで数字キーボードを出す
    pininput.style.cssText = `
    width: 100%;
    padding: 12px;
    font-size: 18px;
    text-align: center;
    border-radius: 8px;
    border: 2px solid #ddd;
    outline: none;
`;
    // 3. 鍵復元ボタン（大きく、かっこよく）
    const pinbtn = document.createElement("button");
    pinbtn.textContent = "鍵を復元してチャット開始";
    pinbtn.style.cssText = `
    width: 100%;
    padding: 15px;
    font-size: 16px;
    border-radius: 8px;
    border: none;
    background: #0084ff;
    color: white;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0,132,255,0.3);
`;
    // 4. 緊急削除ボタン（ついでに下に小さく配置）
    const wipeLink = document.createElement("span");
    wipeLink.textContent = "データをすべて破棄";
    wipeLink.style.cssText = "color: #ff4d4d; cursor: pointer; font-size: 12px; text-decoration: underline; margin-top: 10px;";
    wipeLink.onclick = emergencyWipe; // さっきの関数を紐付け
    // まとめて画面に追加
    pinContainer.appendChild(pininput);
    pinContainer.appendChild(pinbtn);
    pinContainer.appendChild(wipeLink);
    document.body.appendChild(pinContainer);
    const enemyencyWipeBtn = document.createElement("button");
    enemyencyWipeBtn.textContent = "データ削除";
    enemyencyWipeBtn.style.cssText = "position: fixed; top: 10px; left: 10px; padding: 8px 12px; border-radius: 8px; border: none; background: #ff4444; color: white; font-weight: bold; cursor: pointer; z-index: 1000;";
    document.body.appendChild(enemyencyWipeBtn);
    enemyencyWipeBtn.addEventListener("click", async () => {
        await emergencyWipe();
    });
    // 鍵が復元されたらこのコンテナを消す処理を restoreKey の成功時に入れてね
    // pinContainer.style.display = "none";
    async function emergencyWipe() {
        if (!confirm("鍵データをすべて破棄し、ローカル情報も削除しますか？"))
            return;
        console.log("🛠️ 緊急ワイプを実行します...");
        // 1. DBの鍵データをすべて空にする（UUIDだけ残す）
        const { error } = await supabase
            .from('profile_users')
            .update({
            ed25519_pub: null,
            x25519_pub: null,
            ed25519_private: null,
            salt: null,
            iv: null
        })
            .eq('uuid', storedUuid);
        if (error) {
            console.error("❌ DBのワイプに失敗しました:", error.message);
            alert("DBの削除に失敗しました。ネットワークを確認してください。");
            return;
        }
        // 2. ローカルストレージを完全に空にする
        // これで PIN や UUID、トークンなどがすべて消えます
        localStorage.clear();
        sessionStorage.clear();
        console.log("✅ 全データの破棄が完了しました。");
        alert("すべての鍵とローカルデータを削除しました。");
        // 3. 画面をリロードして初期状態（ログイン前）に戻す
        location.reload();
    }
    // メッセージ1件を受け取って、復号して表示する関数
    async function processDecryption(msg) {
        if (!aesKeyhash)
            return; // 鍵がまだないなら何もしない
        try {
            // 1. Base64 をバイナリ(Uint8Array)に戻す
            // (サーバーから受け取る iv と data は必ず Base64 文字列です)
            const [iv, encryptedData] = await Promise.all([
                base64ToUint8Array(msg.iv),
                base64ToUint8Array(msg.data)
            ]);
            // 2. 復号実行 (AES-GCM)
            const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer }, aesKeyhash, // グローバル変数の共通鍵
            encryptedData.buffer);
            // 3. バイナリを整える
            const cleanData = new Uint8Array(decryptedBuffer);
            // 4. 「これは自分か？」を判定 (UUIDで比較)
            // storedUuid は自分のUUIDが入っているグローバル変数
            const isMe = (msg.uuid === storedUuid);
            // 5. 表示処理
            // --- 画像・動画・音声・ファイルの場合 ---
            if (["image", "file", "audio"].includes(msg.subType)) {
                // MIMEタイプの判定
                let mime = msg.mimeType || "application/octet-stream";
                if (!msg.mimeType && msg.fileName) {
                    const fname = msg.fileName.toLowerCase();
                    if (fname.endsWith(".jpg") || fname.endsWith(".jpeg"))
                        mime = "image/jpeg";
                    else if (fname.endsWith(".png"))
                        mime = "image/png";
                    else if (fname.endsWith(".mp3"))
                        mime = "audio/mpeg";
                    else if (fname.endsWith(".mp4"))
                        mime = "video/mp4";
                }
                const blob = new Blob([cleanData], { type: mime });
                const url = URL.createObjectURL(blob);
                // マインさんが作った addMediaBubble を呼び出す
                addMediaBubble(url, msg.name || "Unknown", msg.originalName || msg.fileName, isMe, msg.subType);
                // --- テキストの場合 ---
            }
            else {
                const text = new TextDecoder().decode(cleanData);
                // マインさんが作った addBubble を呼び出す
                addBubble(text, isMe);
            }
        }
        catch (e) {
            console.error("復号失敗:", e);
            // エラー時の表示（必要ならコメントアウトを外す）
            // addBubble("🔒 解読できないメッセージ", (msg.uuid === storedUuid));
        }
    }
    async function sendEncryptedMessage(text, aeskey) {
        if (!aeskey) {
            console.error("エラー: AES鍵がまだ生成されていません。相手が接続するまで待ってください。");
            addSystemMsg("鍵がまだ交換されていません。相手が参加するまでお待ちください。");
            return;
        }
        try {
            const encoder = new TextEncoder();
            const plaintext = encoder.encode(text);
            const encrypted = await encrypt(aeskey, plaintext);
            // ★並列で高速変換
            const [ivB64, dataB64] = await Promise.all([
                arrayBufferToBase64(encrypted.iv),
                arrayBufferToBase64(encrypted.data)
            ]);
            const msg = {
                type: "message",
                room: room,
                name: name,
                uuid: storedUuid,
                iv: ivB64,
                data: dataB64,
            };
            wss.send(JSON.stringify(msg));
            console.log(`%c[送信完了]: ${text}`, "color: #00bfff; font-weight: bold;");
            addBubble(text, true);
        }
        catch (e) {
            console.error("送信時の暗号化に失敗しました:", e);
        }
    }
    function addBubble(text, isMe) {
        const bubble = document.createElement("div");
        const M = isMe;
        // スタイル設定（既存のものを継承）
        bubble.style.cssText = `
        max-width: 70%; 
        padding: 8px 15px; 
        border-radius: 18px; 
        font-size: 15px; 
        align-self: ${M ? "flex-end" : "flex-start"}; 
        background-color: ${M ? "#0084ff" : "#e4e6eb"}; 
        color: ${M ? "white" : "#050505"}; 
        ${M ? "border-bottom-right-radius: 4px;" : "border-bottom-left-radius: 4px;"};
        word-break: break-all;
        white-space: pre-wrap;
    `;
        // --- http と https の両方に対応するリンク化ロジック ---
        const urlRegex = /(https?:\/\/[^\s]+)/g; // s? なので http:// も https:// もOK
        const parts = text.split(urlRegex);
        parts.forEach(part => {
            if (part.match(urlRegex)) {
                const link = document.createElement("a");
                link.href = part;
                link.textContent = part;
                link.target = "_blank"; // LINE内ブラウザなどで開くときに便利
                link.rel = "noopener noreferrer";
                link.style.color = M ? "#fff" : "#0084ff"; // 背景色に合わせて調整
                link.style.textDecoration = "underline";
                bubble.appendChild(link);
            }
            else {
                // 普通のテキスト部分
                bubble.appendChild(document.createTextNode(part));
            }
        });
        chatBox.appendChild(bubble);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    function addSystemMsg(msg) {
        const p = document.createElement("div");
        p.textContent = msg;
        p.style.cssText = "text-align: center; color: #888; font-size: 12px; margin: 10px;";
        chatBox.appendChild(p);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    async function fetchMySecurityData() {
        const { data, error } = await supabase
            .from('profile_users')
            .select('ed25519_private, salt, iv')
            .eq('uuid', storedUuid)
            .maybeSingle();
        if (error || !data) {
            console.error("データが取れんかった...", error);
            return null;
        }
        return data;
    }
    // 実験：相手のUUID（画像にあった d1fde...）を使って、公開鍵だけを引っこ抜く
    async function restoreKey(pin) {
        // 1. DBからデータを取得
        const dbData = await fetchMySecurityData();
        // --- 【新規登録ルート】DBにデータがない場合 ---
        if (!dbData || dbData.salt === null) {
            console.log("欄はあるけど中身が空だね。今から鍵を作って登録するよ！");
            const salt = generateSalt();
            const masterSeed = generateMasterSeed(32);
            const aesKey = await deriveKeyFromPin(pin.toString(), salt);
            const encrypted = await encrypt(aesKey, masterSeed.buffer);
            const ivB64 = await arrayBufferToBase64(encrypted.iv);
            const encryptedSeed = await arrayBufferToBase64(encrypted.data);
            // RSA(またはEd25519)鍵ペアを生成
            const { privateKey, publicKey } = await generateEd25519KeyPair(new Uint8Array(masterSeed));
            const { privateKey: xPriv, publicKey: xPub } = await generateX25519KeyPair(new Uint8Array(masterSeed));
            console.log("今からDBを更新します... UUID:", storedUuid);
            // restoreKey 内の保存処理をこう書き換える
            console.log("🛠️ 既存の自分を更新します... UUID:", storedUuid);
            const { data, error, status } = await supabase
                .from('profile_users')
                .update({
                ed25519_pub: await arrayBufferToBase64(await crypto.subtle.exportKey("raw", publicKey)),
                ed25519_private: encryptedSeed,
                salt: await arrayBufferToBase64(salt),
                iv: ivB64,
                x25519_pub: await arrayBufferToBase64(await crypto.subtle.exportKey("raw", xPub))
            })
                .eq('uuid', storedUuid) // 自分のUUIDに一致する行だけ
                .select();
            // 「なかったら降りる」判定
            if (error) {
                console.error("❌ 通信エラーで降りるよ:", error.message);
                return;
            }
            if (!data || data.length === 0) {
                console.error("🚨 DBに自分の行がない！不正なアクセスか、登録が漏れてるからここで降りるよ！");
                return; // 勝手に作らずに終了
            }
            console.log("✅ 正しく自分を更新できた。出発進行！");
            return {
                privateKey,
                publicKey,
                xPriv, // 👈 これを追加！
                xPub // 👈 これを追加！
            }; // ここで新規登録時は終了
        }
        // --- 【復元ルート】DBにデータがある場合 ---
        console.log("DBから鍵を復元中...");
        try {
            const salt = await base64ToUint8Array(dbData.salt);
            const iv = await base64ToUint8Array(dbData.iv);
            const encryptedSeed = await base64ToUint8Array(dbData.ed25519_private);
            const aesKey = await deriveKeyFromPin(pin, salt);
            const decryptedBuffer = await crypto.subtle.decrypt({
                name: "AES-GCM",
                iv: iv.buffer
            }, aesKey, encryptedSeed.buffer);
            const seed = new Uint8Array(decryptedBuffer);
            const { privateKey, publicKey } = await generateEd25519KeyPair(seed);
            const { privateKey: xPriv, publicKey: xPub } = await generateX25519KeyPair(seed);
            console.log("✨ 復元成功！これで署名ができるようになったぞ。");
            return {
                privateKey,
                publicKey,
                xPriv,
                xPub
            };
        }
        catch (e) {
            console.error("❌ 復元失敗。PINコードが違うか、データが壊れています:", e);
            throw e;
        }
    }
    const name = localStorage.getItem("my_name") ?? "不明なユーザー";
    const storedToken = localStorage.getItem("my_token") ?? "";
    const storedUuid = localStorage.getItem("my_uuid") ?? "";
    const wss = new WebSocket("wss://mail.shudo-physics.com/");
    let room;
    let aeskey = null;
    let pin;
    const salt = generateSalt();
    const base64salt = await arrayBufferToBase64(salt);
    let keys;
    let rand = crypto.getRandomValues(new Uint8Array(32));
    const dhSentHistory = new Map();
    const params = new URLSearchParams(window.location.search);
    const autoRoom = params.get('room');
    if (autoRoom) {
        inputroom.value = autoRoom; // 入力欄を埋める
    }
    // DB用のパスワードとなんか、　まぁええやろ
    const supabase = createClient('https://cedpfdoanarzyxcroymc.supabase.co', 'sb_publishable_E5jwgv5t2ONFKg3yFENQmw_lVUSFn4i', {
        global: {
            headers: {
                Authorization: `Bearer ${storedToken}`,
            },
        },
    });
    let aesKeyhash;
    if (storedToken === "") {
        window.location.href = "../index.html";
        return;
    }
    sendBtn.addEventListener("click", async () => {
        if (input.value) {
            await sendEncryptedMessage(input.value, aesKeyhash);
            input.value = "";
        }
    });
    input.addEventListener("keypress", async (e) => {
        if (e.key === "Enter" && input.value) {
            await sendEncryptedMessage(input.value, aesKeyhash);
            input.value = "";
        }
    });
    window.addEventListener("beforeunload", () => {
        if (wss && wss.readyState === WebSocket.OPEN) {
            wss.send(JSON.stringify({
                type: "leave",
                name: name,
                uuid: storedUuid
            }));
        }
    });
    // ▼▼▼ ここからスタート ▼▼▼
    // ★ async を追加（これで await が使えます）
    btnroom.addEventListener("click", async () => {
        const inputVal = inputroom.value.trim();
        if (!inputVal || inputVal.length < 8 || inputVal.length > 64) {
            alert("有効なUUIDを入力してください（8〜64文字）");
            return;
        }
        // 2. ボタンを検索中モードに変更（連打防止）
        const originalBtnText = btnroom.textContent;
        btnroom.textContent = "検索中...";
        btnroom.disabled = true;
        const targetProfile = await PublicKeyFetch(inputVal, supabase);
        // ... (省略) ...
        console.log("✅ 相手が見つかりました:", targetProfile.username);
        // ▼▼▼ 【超重要】ここを必ず追加！！！ ▼▼▼
        // グローバル変数の room に、相手のUUIDをセットする
        room = targetProfile.uuid;
        console.log("🎯 宛先(room)をセットしました:", room);
        if (!targetProfile) {
            throw new Error("ユーザーが見つかりません。");
        }
        // ▼▼▼ 【ここに追加】見つけた瞬間に、鍵を合体させる！ ▼▼▼
        try {
            // 1. まず「自分の鍵」を用意する (PINは保存されている前提)
            const pin = localStorage.getItem("pin");
            if (!pin)
                throw new Error("PINコードが見つかりません。再ログインしてください。");
            // 自分の鍵ペア（xPriv）を復元
            const myKeys = await restoreKey(pin);
            // 2. 「相手の鍵」を使える形にする
            // targetProfile.x25519_pub (Base64) → Uint8Array → CryptoKey
            const theirRawKey = await base64ToUint8Array(targetProfile.x25519_pub);
            const theirPublicKey = await window.crypto.subtle.importKey("raw", theirRawKey.buffer, { name: "X25519" }, true, []);
            // 3. ★合体！共通鍵 (aesKeyhash) を生成
            aesKeyhash = await deriveSharedKey(myKeys.xPriv, theirPublicKey);
            console.log("🗝️ 共通鍵の生成完了！これで送信できます。");
            addSystemMsg("暗号化通信が確立しました");
        }
        catch (e) {
            console.error("鍵生成エラー:", e);
            alert("鍵の生成に失敗しました: " + e.message);
            return; // 鍵が作れなかったらチャットに入れない
        }
        // 1. 入力チェック
        try {
            const targetProfile = await PublicKeyFetch(inputVal, supabase);
            if (!targetProfile) {
                throw new Error("ユーザーが見つかりません。UUIDが正しいか確認してください。");
            }
            console.log("✅ 相手が見つかりました:", targetProfile.username);
            // 4. 画面切り替え
            roomSelection.style.display = "none";
            chatContainer.style.display = "flex";
            // ★ヘッダーに「相手の名前」を表示！
            chatHeader.textContent = `相手: ${targetProfile.username}`;
            const joinMsg = JSON.stringify({
                type: "join",
                name: name, // 自分の名前 (グローバル変数)
                uuid: storedUuid, // 自分のUUID (グローバル変数)
                token: storedToken // 自分のトークン
            });
            // 接続済みなら即送信、まだなら接続時に送信
            if (wss.readyState === WebSocket.OPEN) {
                console.log("⚡ Already open, sending JOIN");
                wss.send(joinMsg);
            }
            else {
                wss.onopen = () => {
                    console.log("🚀 Connection opened, sending JOIN");
                    wss.send(joinMsg);
                };
            }
            // ▼ メッセージ受信時の処理（暗号化・復号ロジック）
            // ▼ WebSocketでメッセージを受け取ったときの全処理
            wss.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                // ------------------------------------------------
                // 📜 A. 履歴 (History) の受信
                // ------------------------------------------------
                if (data.type === "history") {
                    console.log(`📜 履歴を受信: ${data.messages.length}件`);
                    // 配列をループして、1つずつ処理関数に投げる
                    for (const msg of data.messages) {
                        await handleIncomingMessage(msg);
                    }
                }
                // ------------------------------------------------
                // 📩 B. リアルタイムメッセージ の受信
                // ------------------------------------------------
                else if (data.type === "message") {
                    // ★重要: リアルタイムの場合、自分のメッセージは「送信ボタン」を押した瞬間に
                    // 画面に出ているはずなので、ここでは無視して重複を防ぐ
                    if (data.uuid === storedUuid)
                        return;
                    // 相手からのメッセージなら処理する
                    await handleIncomingMessage(data);
                }
                // ------------------------------------------------
                // 🔑 C. システム・鍵交換メッセージ (既存維持)
                // ------------------------------------------------
                else if (data.type === "join-ack")
                    addSystemMsg("参加しました");
                else if (data.type === "join-nack")
                    addSystemMsg("エラー: 参加できませんでした");
                else if (data.type === "quit-broadcast" || data.type === "leave") {
                    addSystemMsg(`${data.name || '相手'} が退出しました`);
                }
                else if (data.type === "join-broadcast") {
                    addSystemMsg(`${data.name || '誰か'} が参加しました`);
                }
                // DH鍵交換の処理などはここに続く...
            };
            // ▼▼▼ 【核心部分】復号と subType 振り分けを行う関数 ▼▼▼
            async function handleIncomingMessage(msg) {
                // 鍵がないと復号できないのでガード
                if (!aesKeyhash)
                    return;
                try {
                    // 1. Base64文字列をバイナリ(Uint8Array)に戻す
                    // (サーバーからは iv と data が Base64 で送られてくるため)
                    const iv = await base64ToUint8Array(msg.iv);
                    const encryptedData = await base64ToUint8Array(msg.data);
                    // 2. 復号実行 (AES-GCM)
                    const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, aesKeyhash, // グローバル変数の共通鍵
                    encryptedData);
                    // 3. 復号された生データ (Uint8Array)
                    const cleanData = new Uint8Array(decryptedBuffer);
                    // 4. 「これは自分か？」を判定 (履歴表示のときに重要)
                    // storedUuid は自分のUUIDが入っている変数
                    const isMe = (msg.uuid === storedUuid);
                    // 5. ★ subType に応じて処理を分岐 ★
                    // --- テキストの場合 ---
                    if (msg.subType === "text") {
                        const text = new TextDecoder().decode(cleanData);
                        // マインさんが作った addBubble を呼び出す
                        addBubble(text, isMe);
                    }
                    // --- メディア（画像・音声・ファイル）の場合 ---
                    else if (["image", "file", "audio"].includes(msg.subType)) {
                        // MIMEタイプの決定（msg.mimeTypeがあれば優先、なければ拡張子から推測）
                        let mime = msg.mimeType || "application/octet-stream";
                        if (!msg.mimeType && msg.fileName) {
                            const lowerName = msg.fileName.toLowerCase();
                            if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg"))
                                mime = "image/jpeg";
                            else if (lowerName.endsWith(".png"))
                                mime = "image/png";
                            else if (lowerName.endsWith(".gif"))
                                mime = "image/gif";
                            else if (lowerName.endsWith(".mp3"))
                                mime = "audio/mpeg";
                            else if (lowerName.endsWith(".wav"))
                                mime = "audio/wav";
                            else if (lowerName.endsWith(".mp4"))
                                mime = "video/mp4";
                            else if (lowerName.endsWith(".pdf"))
                                mime = "application/pdf";
                        }
                        // バイナリからBlobを作成
                        const blob = new Blob([cleanData], { type: mime });
                        const url = URL.createObjectURL(blob);
                        // マインさんが作った addMediaBubble を呼び出す
                        addMediaBubble(url, msg.name || "Unknown", msg.originalName || msg.fileName || "file", isMe, msg.subType // ここで subType を渡すことで addMediaBubble 内で分岐される
                        );
                    }
                }
                catch (e) {
                    console.error("復号失敗:", e);
                    // 必要ならエラー表示
                    // addSystemMsg("🔒 メッセージの復号に失敗しました");
                }
            }
            // --- 必須: Base64変換ヘルパー (もし無ければ追加) ---
            function base64ToUint8Array(base64) {
                const binary_string = window.atob(base64);
                const len = binary_string.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binary_string.charCodeAt(i);
                }
                return bytes;
            }
        }
        catch (err) {
            // エラー時の処理 (検索失敗など)
            alert(err.message);
            btnroom.textContent = originalBtnText; // ボタンの文字を戻す
            btnroom.disabled = false; // ボタンをまた押せるようにする
        }
    });
    if (localStorage.getItem("pin") === null || localStorage.getItem("pin") === "") {
        enemyencyWipeBtn.style.display = "none";
        roomSelection.style.display = "none";
        pininput.addEventListener('input', () => {
            // 数字以外（^0-9）をすべて空文字に置換
            pininput.value = pininput.value.replace(/[^0-9]/g, '');
        });
        pinbtn.addEventListener("click", async () => {
            pinContainer.style.display = "none";
            enemyencyWipeBtn.style.display = "flex";
            keys = await restoreKey(pininput.value);
            localStorage.setItem("pin", pininput.value);
            roomSelection.style.display = "flex";
        });
    }
    else {
        pinContainer.style.display = "none";
        enemyencyWipeBtn.style.display = "flex";
        roomSelection.style.display = "flex";
    }
    wss.onclose = () => {
        // 1. 今のURLを取得して解析
        const url = new URL(window.location.href);
        // 2. roomパラメータを「上書き」する（これなら増殖しない）
        if (room) {
            url.searchParams.set('room', room);
        }
        // 3. ブラウザの履歴を「綺麗に上書きされたURL」で更新
        window.history.replaceState(null, '', url.toString());
        // 4. 1秒後にリロード
        setTimeout(() => location.reload(), 1000);
    };
}
main();
