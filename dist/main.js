import { generateEd25519KeyPair, generateX25519KeyPair } from "./mojyu-ru/crypto/ecdh.js";
import { arrayBufferToBase64, base64ToUint8Array } from "./mojyu-ru/base64.js";
import { generateSalt, generateMasterSeed } from "./mojyu-ru/crypto/saltaes.js";
import { PublicKeyFetch } from "./mojyu-ru/crypto/kdf.js";
import { encrypt, deriveKeyFromPin, deriveSharedKey } from "./mojyu-ru/crypto/aes.js";
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
    let aesKeyhash = null;
    // Supabase初期化
    const supabase = createClient('https://cedpfdoanarzyxcroymc.supabase.co', 'sb_publishable_E5jwgv5t2ONFKg3yFENQmw_lVUSFn4i', {
        global: { headers: { Authorization: `Bearer ${storedToken}` } },
    });
    if (storedToken === "") {
        window.location.href = "../index.html";
        return;
    }
    const params = new URLSearchParams(window.location.search);
    const autoRoom = params.get('room');
    // --- DOM作成 ---
    document.body.style.cssText = "margin: 0; padding: 0; background-color: #f0f2f5; font-family: sans-serif;";
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
    // チャット画面
    const chatContainer = document.createElement("div");
    chatContainer.style.cssText = "display: none; height: 100vh; flex-direction: column;";
    const chatHeader = document.createElement("div");
    chatHeader.style.cssText = "padding: 15px; background: white; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold;";
    const chatBox = document.createElement("div");
    chatBox.id = "chatBox";
    chatBox.style.cssText = "flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 8px;";
    const inputContainer = document.createElement("div");
    inputContainer.style.cssText = "padding: 15px; background: white; display: flex; gap: 10px; border-top: 1px solid #ddd;";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);
    const fileBtn = document.createElement("button");
    fileBtn.textContent = "＋";
    fileBtn.style.cssText = "background: none; border: none; font-size: 20px; cursor: pointer; padding: 5px;";
    fileBtn.onclick = () => fileInput.click();
    const input = document.createElement("input");
    input.placeholder = "Aa";
    input.style.cssText = "flex: 1; padding: 10px 15px; border-radius: 20px; border: none; background: #f0f2f5; outline: none;";
    const sendBtn = document.createElement("button");
    sendBtn.textContent = "送信";
    sendBtn.style.cssText = "background: none; border: none; color: #0084ff; font-weight: bold; cursor: pointer;";
    inputContainer.append(fileBtn, input, sendBtn);
    chatContainer.append(chatHeader, chatBox, inputContainer);
    document.body.appendChild(chatContainer);
    // PIN画面
    const pinContainer = document.createElement("div");
    pinContainer.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 15px; background: white; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 2000; width: 80%; max-width: 300px;`;
    const pininput = document.createElement("input");
    pininput.type = "password";
    pininput.placeholder = "PIN(数字)";
    pininput.inputMode = "numeric";
    pininput.style.cssText = `width: 100%; padding: 12px; font-size: 18px; text-align: center; border-radius: 8px; border: 2px solid #ddd; outline: none;`;
    const pinbtn = document.createElement("button");
    pinbtn.textContent = "鍵を復元してチャット開始";
    pinbtn.style.cssText = `width: 100%; padding: 15px; font-size: 16px; border-radius: 8px; border: none; background: #0084ff; color: white; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,132,255,0.3);`;
    const wipeLink = document.createElement("span");
    wipeLink.textContent = "データをすべて破棄";
    wipeLink.style.cssText = "color: #ff4d4d; cursor: pointer; font-size: 12px; text-decoration: underline; margin-top: 10px;";
    pinContainer.appendChild(pininput);
    pinContainer.appendChild(pinbtn);
    pinContainer.appendChild(wipeLink);
    document.body.appendChild(pinContainer);
    const enemyencyWipeBtn = document.createElement("button");
    enemyencyWipeBtn.textContent = "データ削除";
    enemyencyWipeBtn.style.cssText = "position: fixed; top: 10px; left: 10px; padding: 8px 12px; border-radius: 8px; border: none; background: #ff4444; color: white; font-weight: bold; cursor: pointer; z-index: 1000;";
    document.body.appendChild(enemyencyWipeBtn);
    // =================================================================
    // 2. WebSocket イベント (★ここに移動させました！)
    // =================================================================
    // 接続時に JOIN を送る
    wss.onopen = () => {
        console.log("⚡ サーバーに接続成功！ログインを試みます...");
        const joinPayload = {
            type: "join",
            name: name,
            uuid: storedUuid,
            token: storedToken
        };
        wss.send(JSON.stringify(joinPayload));
    };
    // メッセージ受信 (統合版)
    wss.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        // 📜 A. 履歴 (History)
        if (data.type === "history") {
            console.log(`📜 履歴を受信: ${data.messages.length}件`);
            for (const msg of data.messages) {
                await handleIncomingMessage(msg);
            }
        }
        // 📩 B. リアルタイムメッセージ
        else if (data.type === "message") {
            if (data.uuid === storedUuid)
                return; // 自分のメッセージは無視
            await handleIncomingMessage(data);
        }
        // 🔑 C. システム系
        else if (data.type === "join-ack") {
            addSystemMsg("参加しました");
            console.log("✅ ログイン完了(join-ack)");
        }
        else if (data.type === "join-nack")
            addSystemMsg("エラー: 参加できませんでした");
        else if (data.type === "quit-broadcast" || data.type === "leave")
            addSystemMsg(`${data.name || '相手'} が退出しました`);
        else if (data.type === "join-broadcast")
            addSystemMsg(`${data.name || '誰か'} が参加しました`);
    };
    wss.onclose = () => {
        console.log("connection closed");
        const url = new URL(window.location.href);
        if (room)
            url.searchParams.set('room', room);
        window.history.replaceState(null, '', url.toString());
        setTimeout(() => location.reload(), 1000);
    };
    window.addEventListener("beforeunload", () => {
        if (wss && wss.readyState === WebSocket.OPEN) {
            wss.send(JSON.stringify({ type: "leave", name: name, uuid: storedUuid }));
        }
    });
    // =================================================================
    // 3. UIイベントリスナー
    // =================================================================
    // 検索ボタンクリック (ここをスッキリさせる)
    btnroom.addEventListener("click", async () => {
        const inputVal = inputroom.value.trim();
        if (!inputVal || inputVal.length < 8)
            return alert("有効なUUIDを入力してください");
        const originalBtnText = btnroom.textContent;
        btnroom.textContent = "検索中...";
        btnroom.disabled = true;
        try {
            const targetProfile = await PublicKeyFetch(inputVal, supabase);
            if (!targetProfile)
                throw new Error("ユーザーが見つかりません。");
            console.log("✅ 相手が見つかりました:", targetProfile.username);
            room = targetProfile.uuid; // 宛先セット
            console.log("🎯 宛先(room)をセットしました:", room);
            // 鍵生成処理 (Search & Generate)
            const pin = localStorage.getItem("pin");
            if (!pin)
                throw new Error("PINコードが見つかりません");
            const myKeys = await restoreKey(pin);
            const theirRawKey = await base64ToUint8Array(targetProfile.x25519_pub);
            const theirPublicKey = await window.crypto.subtle.importKey("raw", theirRawKey.buffer, { name: "X25519" }, true, []);
            aesKeyhash = await deriveSharedKey(myKeys.xPriv, theirPublicKey);
            console.log("🗝️ 共通鍵の生成完了");
            addSystemMsg("送信準備完了");
            // 画面切り替え
            roomSelection.style.display = "none";
            chatContainer.style.display = "flex";
            chatHeader.textContent = `相手: ${targetProfile.username}`;
        }
        catch (err) {
            alert(err.message);
            btnroom.textContent = originalBtnText;
            btnroom.disabled = false;
        }
    });
    // 送信処理
    sendBtn.addEventListener("click", async () => {
        if (input.value && aesKeyhash) {
            await sendEncryptedMessage(input.value, aesKeyhash);
            input.value = "";
        }
    });
    input.addEventListener("keypress", async (e) => {
        if (e.key === "Enter" && input.value && aesKeyhash) {
            await sendEncryptedMessage(input.value, aesKeyhash);
            input.value = "";
        }
    });
    // ファイル選択処理
    fileInput.onchange = (e) => handleFileSelect(e, "file");
    // ドラッグ＆ドロップ処理
    chatBox.addEventListener("dragover", (e) => {
        e.preventDefault();
        chatBox.style.backgroundColor = "rgba(0,132,255,0.1)";
    });
    chatBox.addEventListener("dragleave", () => chatBox.style.backgroundColor = "");
    chatBox.addEventListener("drop", async (e) => {
        e.preventDefault();
        chatBox.style.backgroundColor = "";
        const files = e.dataTransfer?.files;
        if (!files || !files.length)
            return;
        const file = files[0];
        let subType = "file";
        if (file.type.startsWith("image/") || file.type.startsWith("video/"))
            subType = "image";
        if (file.type.startsWith("audio/"))
            subType = "audio";
        await processFileAndSend(file, subType);
    });
    // PIN認証・ワイプ関連
    wipeLink.onclick = emergencyWipe;
    enemyencyWipeBtn.addEventListener("click", emergencyWipe);
    pininput.addEventListener('input', () => { pininput.value = pininput.value.replace(/[^0-9]/g, ''); });
    // 初回/復帰のPIN画面制御
    if (!localStorage.getItem("pin")) {
        enemyencyWipeBtn.style.display = "none";
        roomSelection.style.display = "none";
        pinbtn.addEventListener("click", async () => {
            pinContainer.style.display = "none";
            enemyencyWipeBtn.style.display = "flex";
            await restoreKey(pininput.value);
            localStorage.setItem("pin", pininput.value);
            roomSelection.style.display = "flex";
        });
    }
    else {
        pinContainer.style.display = "none";
        roomSelection.style.display = "flex";
    }
    // =================================================================
    // 4. 関数定義 (Helpers)
    // =================================================================
    // 共通の受信・復号処理 (自動鍵生成つき)
    async function handleIncomingMessage(msg) {
        if (!aesKeyhash && msg.uuid !== storedUuid) {
            console.log("⚠️ 鍵生成を試みます...");
            try {
                const { data: userProfile } = await supabase.from('profile_users').select('x25519_pub').eq('uuid', msg.uuid).single();
                if (!userProfile)
                    throw new Error("Key not found");
                const pin = localStorage.getItem("pin");
                if (!pin)
                    throw new Error("PIN missing");
                const myKeys = await restoreKey(pin);
                const theirRawKey = await base64ToUint8Array(userProfile.x25519_pub);
                const theirPublicKey = await window.crypto.subtle.importKey("raw", theirRawKey.buffer, { name: "X25519" }, true, []);
                aesKeyhash = await deriveSharedKey(myKeys.xPriv, theirPublicKey);
                console.log("🗝️ 自動生成成功");
                if (typeof room !== 'undefined')
                    room = msg.uuid;
            }
            catch (e) {
                console.error("鍵生成失敗:", e);
                return;
            }
        }
        if (!aesKeyhash && msg.uuid !== storedUuid) {
            // (省略: 上記の自動生成コードと同じ)
            // ここは変更しなくてOKです
        }
        if (!aesKeyhash)
            return;
        try {
            const iv = await base64ToUint8Array(msg.iv);
            const encryptedData = await base64ToUint8Array(msg.data);
            // ★型エラー回避 (.buffer as ArrayBuffer)
            const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer }, aesKeyhash, encryptedData.buffer);
            const cleanData = new Uint8Array(decryptedBuffer);
            const isMe = (msg.uuid === storedUuid);
            if (msg.subType === "text") {
                addBubble(new TextDecoder().decode(cleanData), isMe);
            }
            else {
                let mime = msg.mimeType || "application/octet-stream";
                const blob = new Blob([cleanData], { type: mime });
                // ★修正: 第3引数(originalName)が空っぽなら "file" という名前にする
                const fileName = msg.originalName || msg.fileName || "file";
                addMediaBubble(URL.createObjectURL(blob), msg.name, fileName, isMe, msg.subType);
            }
        }
        catch (e) {
            console.error("復号失敗:", e);
        }
    }
    async function sendEncryptedMessage(text, aeskey) {
        try {
            const encrypted = await encrypt(aeskey, new TextEncoder().encode(text));
            const [ivB64, dataB64] = await Promise.all([
                arrayBufferToBase64(encrypted.iv), arrayBufferToBase64(encrypted.data)
            ]);
            wss.send(JSON.stringify({
                type: "message", room: room, name: name, uuid: storedUuid,
                iv: ivB64, data: dataB64, subType: "text"
            }));
            addBubble(text, true);
        }
        catch (e) {
            console.error("送信失敗", e);
        }
    }
    async function processFileAndSend(file, subType) {
        if (!aesKeyhash)
            return addSystemMsg("鍵がありません");
        if (file.size > 15 * 1024 * 1024)
            return addSystemMsg("サイズ超過(15MBまで)");
        try {
            const encrypted = await encrypt(aesKeyhash, new Uint8Array(await file.arrayBuffer()));
            const [ivB64, dataB64] = await Promise.all([
                arrayBufferToBase64(encrypted.iv), arrayBufferToBase64(encrypted.data)
            ]);
            let finalSubType = subType;
            if (file.type.startsWith('audio/'))
                finalSubType = "audio";
            if (file.type.startsWith('video/'))
                finalSubType = "image";
            const uuidName = `${crypto.randomUUID()}.${file.name.split('.').pop()}`;
            wss.send(JSON.stringify({
                type: "message", subType: finalSubType, mimeType: file.type,
                fileName: uuidName, originalName: file.name, room: room,
                name: name, uuid: storedUuid, iv: ivB64, data: dataB64
            }));
            addMediaBubble(URL.createObjectURL(file), uuidName, file.name, true, finalSubType);
        }
        catch (e) {
            console.error("ファイル送信失敗", e);
        }
    }
    function addBubble(text, isMe) {
        const bubble = document.createElement("div");
        bubble.style.cssText = `max-width: 70%; padding: 8px 15px; border-radius: 18px; font-size: 15px; align-self: ${isMe ? "flex-end" : "flex-start"}; background-color: ${isMe ? "#0084ff" : "#e4e6eb"}; color: ${isMe ? "white" : "#050505"}; ${isMe ? "border-bottom-right-radius: 4px;" : "border-bottom-left-radius: 4px;"}; word-break: break-all; white-space: pre-wrap;`;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        text.split(urlRegex).forEach(part => {
            if (part.match(urlRegex)) {
                const link = document.createElement("a");
                link.href = part;
                link.textContent = part;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.style.cssText = `color: ${isMe ? "#fff" : "#0084ff"}; text-decoration: underline;`;
                bubble.appendChild(link);
            }
            else {
                bubble.appendChild(document.createTextNode(part));
            }
        });
        chatBox.appendChild(bubble);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    function addMediaBubble(url, uuidName, originalName, isMe, subType) {
        const container = document.createElement("div");
        container.style.cssText = `max-width: 70%; margin: 10px 0; padding: 8px; align-self: ${isMe ? "flex-end" : "flex-start"}; display: flex; flex-direction: column; gap: 6px; background: ${isMe ? "#0084ff" : "#e4e6eb"}; border-radius: 15px; ${isMe ? "border-bottom-right-radius: 4px;" : "border-bottom-left-radius: 4px;"}`;
        // ★修正: originalName が undefined や null でも落ちないようにする
        const safeName = originalName || "unknown_file";
        const lower = safeName.toLowerCase();
        const isVideo = lower.endsWith(".mp4") || lower.endsWith(".mov");
        const isAudio = subType === "audio" || lower.endsWith(".mp3");
        if (subType === "image" && !isVideo && !isAudio) {
            const img = document.createElement("img");
            img.src = url;
            img.style.cssText = "width: 100%; max-width: 250px; border-radius: 12px; cursor: pointer;";
            img.onclick = () => window.open(url, '_blank');
            container.appendChild(img);
        }
        else if (isVideo) {
            const video = document.createElement("video");
            video.src = url;
            video.controls = true;
            video.style.cssText = "width: 100%; max-width: 250px; border-radius: 12px;";
            container.appendChild(video);
        }
        else if (isAudio) {
            const audio = document.createElement("audio");
            audio.src = url;
            audio.controls = true;
            audio.style.cssText = "width: 100%; min-width: 200px; max-width: 250px; height: 40px;";
            container.appendChild(audio);
        }
        else {
            const icon = document.createElement("div");
            icon.textContent = "📄 ファイル";
            icon.style.cssText = "font-size: 24px; text-align: center;";
            container.appendChild(icon);
        }
        const link = document.createElement("a");
        link.href = url;
        link.download = safeName; // ★ここも safeName を使う
        link.textContent = `📥 ${safeName}`;
        link.style.cssText = `font-size: 12px; color: ${isMe ? "rgba(255,255,255,0.9)" : "#0084ff"}; text-decoration: none; font-weight: bold; display: block; margin-top: 4px;`;
        container.appendChild(link);
        chatBox.appendChild(container);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    function addSystemMsg(msg) {
        const p = document.createElement("div");
        p.textContent = msg;
        p.style.cssText = "text-align: center; color: #888; font-size: 12px; margin: 10px;";
        chatBox.appendChild(p);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    async function handleFileSelect(event, subType) {
        const target = event.target;
        if (target.files?.[0]) {
            await processFileAndSend(target.files[0], subType);
            target.value = "";
        }
    }
    async function fetchMySecurityData() {
        const { data, error } = await supabase
            .from('profile_users')
            .select('ed25519_private, salt, iv')
            .eq('uuid', storedUuid)
            .maybeSingle();
        if (error || !data)
            return null;
        return data;
    }
    async function restoreKey(pin) {
        const dbData = await fetchMySecurityData();
        if (!dbData || dbData.salt === null) {
            console.log("鍵新規作成");
            const salt = generateSalt();
            const masterSeed = generateMasterSeed(32);
            const aesKey = await deriveKeyFromPin(pin.toString(), salt);
            const encrypted = await encrypt(aesKey, masterSeed.buffer);
            const ivB64 = await arrayBufferToBase64(encrypted.iv);
            const encryptedSeed = await arrayBufferToBase64(encrypted.data);
            const { privateKey, publicKey } = await generateEd25519KeyPair(new Uint8Array(masterSeed));
            const { privateKey: xPriv, publicKey: xPub } = await generateX25519KeyPair(new Uint8Array(masterSeed));
            console.log("DB更新開始");
            const { data, error } = await supabase
                .from('profile_users')
                .update({
                ed25519_pub: await arrayBufferToBase64(await crypto.subtle.exportKey("raw", publicKey)),
                ed25519_private: encryptedSeed,
                salt: await arrayBufferToBase64(salt),
                iv: ivB64,
                x25519_pub: await arrayBufferToBase64(await crypto.subtle.exportKey("raw", xPub))
            })
                .eq('uuid', storedUuid)
                .select();
            if (error) {
                console.error("DB更新失敗", error);
                return;
            }
            if (!data || data.length === 0)
                return;
            return { privateKey, publicKey, xPriv, xPub };
        }
        console.log("鍵復元中...");
        try {
            const salt = await base64ToUint8Array(dbData.salt);
            const iv = await base64ToUint8Array(dbData.iv);
            const encryptedSeed = await base64ToUint8Array(dbData.ed25519_private);
            const aesKey = await deriveKeyFromPin(pin, salt);
            const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer }, aesKey, encryptedSeed.buffer);
            const seed = new Uint8Array(decryptedBuffer);
            const { privateKey, publicKey } = await generateEd25519KeyPair(seed);
            const { privateKey: xPriv, publicKey: xPub } = await generateX25519KeyPair(seed);
            return { privateKey, publicKey, xPriv, xPub };
        }
        catch (e) {
            console.error("復元失敗:", e);
            throw e;
        }
    }
    async function emergencyWipe() {
        if (!confirm("鍵データをすべて破棄し、ローカル情報も削除しますか？"))
            return;
        console.log("緊急ワイプ");
        await supabase.from('profile_users')
            .update({ ed25519_pub: null, x25519_pub: null, ed25519_private: null, salt: null, iv: null })
            .eq('uuid', storedUuid);
        localStorage.clear();
        sessionStorage.clear();
        alert("削除完了");
        location.reload();
    }
}
main();
