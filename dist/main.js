import { generateX25519KeyPair } from "./mojyu-ru/crypto/ecdh.js";
import { arrayBufferToBase64, base64ToUint8Array } from "./mojyu-ru/base64.js";
import { deriveKeyFromPin, deriveSharedKey } from "./mojyu-ru/crypto/aes.js";
// @ts-ignore
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
async function main() {
    // =================================================================
    // 1. 変数・設定・DOM初期化
    // =================================================================
    const name = localStorage.getItem("my_name") ?? "不明なユーザー";
    const storedToken = localStorage.getItem("my_token") ?? "";
    const storedUuid = localStorage.getItem("my_uuid") ?? "";
    const wss = new WebSocket("wss://mail.shudo-physics.com/");
    let room;
    const aesKeyCache = new Map();
    const friendNames = new Map();
    const supabase = createClient('https://cedpfdoanarzyxcroymc.supabase.co', 'sb_publishable_E5jwgv5t2ONFKg3yFENQmw_lVUSFn4i', {
        global: { headers: { Authorization: `Bearer ${storedToken}` } },
    });
    if (!storedToken || !storedUuid) {
        window.location.href = "../index.html";
        return;
    }
    const params = new URLSearchParams(window.location.search);
    const autoRoom = params.get('room');
    // --- DOM作成 ---
    document.body.style.cssText = "margin: 0; padding: 0; background-color: #f0f2f5; font-family: sans-serif; overflow: hidden;";
    // 検索画面
    const roomSelection = document.createElement("div");
    roomSelection.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;";
    const roomCard = document.createElement("div");
    roomCard.style.cssText = "background: white; padding: 30px; border-radius: 15px; box-shadow: 0 12px 28px rgba(0,0,0,0.1); text-align: center;";
    const inputroom = document.createElement("input");
    inputroom.placeholder = "UUIDを入力...";
    inputroom.style.cssText = "width: 250px; padding: 12px; border-radius: 8px; border: 1px solid #ddd; outline: none; font-size: 16px; margin-bottom: 15px; display: block;";
    if (autoRoom)
        inputroom.value = autoRoom;
    const btnroom = document.createElement("button");
    btnroom.textContent = "メッセージをチェック";
    btnroom.style.cssText = "width: 100%; padding: 12px; border-radius: 8px; border: none; background: #0084ff; color: white; font-weight: bold; cursor: pointer;";
    roomCard.append(inputroom, btnroom);
    roomSelection.append(roomCard);
    document.body.appendChild(roomSelection);
    // チャットメインコンテナ
    const chatContainer = document.createElement("div");
    chatContainer.style.cssText = "display: none; height: 100vh; width: 100vw; flex-direction: row;";
    // サイドバー (トーク一覧)
    const sidebar = document.createElement("div");
    sidebar.style.cssText = "width: 280px; background: white; border-right: 1px solid #ddd; display: flex; flex-direction: column; flex-shrink: 0;";
    const sidebarHeader = document.createElement("div");
    sidebarHeader.textContent = "トーク一覧";
    sidebarHeader.style.cssText = "padding: 20px; font-weight: bold; font-size: 18px; border-bottom: 1px solid #eee; background: #fff;";
    const friendListContainer = document.createElement("div");
    friendListContainer.style.cssText = "flex: 1; overflow-y: auto;";
    sidebar.append(sidebarHeader, friendListContainer);
    // メインチャットエリア
    const mainChat = document.createElement("div");
    mainChat.style.cssText = "flex: 1; display: flex; flex-direction: column; position: relative; background: #f9f9f9;";
    const chatHeader = document.createElement("div");
    chatHeader.style.cssText = "padding: 15px; background: white; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold; position: relative;";
    const chatBox = document.createElement("div");
    chatBox.style.cssText = "flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 8px;";
    const inputContainer = document.createElement("div");
    inputContainer.style.cssText = "padding: 15px; background: white; display: flex; gap: 10px; border-top: 1px solid #ddd;";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);
    const fileBtn = document.createElement("button");
    fileBtn.textContent = "＋";
    fileBtn.style.cssText = "background: none; border: none; font-size: 20px; cursor: pointer;";
    const input = document.createElement("input");
    input.placeholder = "メッセージを入力...";
    input.style.cssText = "flex: 1; padding: 10px 15px; border-radius: 20px; border: none; background: #f0f2f5; outline: none;";
    const sendBtn = document.createElement("button");
    sendBtn.textContent = "送信";
    sendBtn.style.cssText = "background: none; border: none; color: #0084ff; font-weight: bold; cursor: pointer;";
    inputContainer.append(fileBtn, input, sendBtn);
    mainChat.append(chatHeader, chatBox, inputContainer);
    chatContainer.append(sidebar, mainChat);
    document.body.appendChild(chatContainer);
    // =================================================================
    // 2. 補助関数 (リスト更新・UI系)
    // =================================================================
    function renderFriendList() {
        friendListContainer.innerHTML = "";
        friendNames.forEach((fName, fUuid) => {
            const item = document.createElement("div");
            const isActive = room === fUuid;
            item.style.cssText = `padding: 15px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: 0.2s; background: ${isActive ? "#e7f3ff" : "white"};`;
            item.innerHTML = `
                <div style="font-weight: bold; color: #333;">${fName}</div>
                <div style="font-size: 11px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fUuid}</div>
            `;
            item.onmouseover = () => { if (!isActive)
                item.style.backgroundColor = "#f5f5f5"; };
            item.onmouseout = () => { if (!isActive)
                item.style.backgroundColor = "white"; };
            item.onclick = () => {
                room = fUuid;
                chatHeader.textContent = `${fName}`;
                chatBox.innerHTML = "";
                renderFriendList();
                addSystemMsg(`--- ${fName} とのチャット ---`);
            };
            friendListContainer.appendChild(item);
        });
    }
    function addBubble(text, isMe) {
        const p = document.createElement("div");
        p.textContent = text;
        p.style.cssText = `max-width: 70%; padding: 10px 15px; border-radius: 18px; font-size: 14px; line-height: 1.4; word-wrap: break-word; position: relative;
            ${isMe ? "align-self: flex-end; background: #0084ff; color: white;" : "align-self: flex-start; background: #e4e6eb; color: black;"}`;
        chatBox.appendChild(p);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    function addSystemMsg(msg) {
        const p = document.createElement("div");
        p.textContent = msg;
        p.style.cssText = "align-self: center; font-size: 12px; color: #888; margin: 10px 0;";
        chatBox.appendChild(p);
    }
    // =================================================================
    // 3. 鍵復元・メッセージ受信 (Map対応)
    // =================================================================
    async function restoreKey(pin) {
        const { data: dbData } = await supabase.from('profile_users').select('*').eq('uuid', storedUuid).single();
        if (!dbData)
            throw new Error("ユーザーデータなし");
        const salt = await base64ToUint8Array(dbData.salt);
        const iv = await base64ToUint8Array(dbData.iv);
        const encryptedSeed = await base64ToUint8Array(dbData.ed25519_private);
        const aesKey = await deriveKeyFromPin(pin, salt);
        const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer }, aesKey, encryptedSeed.buffer);
        const seed = new Uint8Array(decryptedBuffer);
        const { privateKey: xPriv } = await generateX25519KeyPair(seed);
        return { xPriv };
    }
    async function handleIncomingMessage(msg) {
        const senderUuid = msg.uuid;
        const isMe = (senderUuid === storedUuid);
        // 相手の名前を登録
        if (!isMe && msg.name) {
            if (!friendNames.has(senderUuid)) {
                friendNames.set(senderUuid, msg.name);
                renderFriendList();
            }
        }
        // 鍵管理 (Map)
        if (!isMe && !aesKeyCache.has(senderUuid)) {
            try {
                const { data: profile } = await supabase.from('profile_users').select('x25519_pub').eq('uuid', senderUuid).single();
                const pin = localStorage.getItem("pin");
                const myKeys = await restoreKey(pin);
                const theirRawKey = await base64ToUint8Array(profile.x25519_pub);
                const theirPublicKey = await window.crypto.subtle.importKey("raw", theirRawKey.buffer, { name: "X25519" }, true, []);
                const sharedKey = await deriveSharedKey(myKeys.xPriv, theirPublicKey);
                aesKeyCache.set(senderUuid, sharedKey);
            }
            catch (e) {
                return console.error("鍵生成エラー", e);
            }
        }
        if (!isMe && senderUuid !== room)
            return; // 今開いている部屋以外は表示しない
        try {
            const keyToUse = isMe ? null : aesKeyCache.get(senderUuid);
            if (!isMe && !keyToUse)
                return;
            const iv = await base64ToUint8Array(msg.iv);
            const encryptedData = await base64ToUint8Array(msg.data);
            const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer }, keyToUse, encryptedData.buffer);
            addBubble(new TextDecoder().decode(new Uint8Array(decryptedBuffer)), isMe);
        }
        catch (e) {
            console.error("復号失敗", e);
        }
    }
    // =================================================================
    // 4. 通信・イベント
    // =================================================================
    wss.onmessage = async (e) => {
        const data = JSON.parse(e.data);
        if (data.type === "message")
            await handleIncomingMessage(data);
    };
    btnroom.onclick = () => {
        const target = inputroom.value.trim();
        if (!target)
            return;
        room = target;
        roomSelection.style.display = "none";
        chatContainer.style.display = "flex";
        chatHeader.textContent = `宛先: ${target}`;
        renderFriendList();
    };
    sendBtn.onclick = async () => {
        const text = input.value.trim();
        if (!text || !room)
            return;
        let currentKey = aesKeyCache.get(room);
        if (!currentKey) {
            // 送信相手の鍵も必要ならここで生成するロジックが必要（受信と同じ）
            addSystemMsg("鍵を準備中...");
            // ...鍵取得処理...
        }
        // --- 暗号化してWSS送信 ---
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, currentKey, new TextEncoder().encode(text));
        wss.send(JSON.stringify({
            type: "message", uuid: storedUuid, name: name, to_uuid: room,
            data: await arrayBufferToBase64(encrypted), iv: await arrayBufferToBase64(iv.buffer),
            subType: "text"
        }));
        addBubble(text, true);
        input.value = "";
    };
    // 起動
    if (autoRoom)
        btnroom.click();
}
main();
