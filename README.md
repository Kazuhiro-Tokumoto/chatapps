# chatapps

## 🔐 セキュアチャットアプリケーション

強力な暗号化と署名機能を備えた安全なチャットアプリケーションです。

### 主要なセキュリティ機能

このアプリケーションは、最新の暗号化技術を使用して、以下の強力なセキュリティを提供します：

#### 1. 強力な暗号化
- **AES-256-GCM**: 256ビット鍵を使用した認証付き暗号化
  - Galois/Counter Mode (GCM) による完全性保護
  - 96ビットのランダムなnonce（使い捨て番号）
  - メッセージの機密性と認証を同時に保証

#### 2. 強力なデジタル署名
- **Ed25519**: EdDSA署名アルゴリズム
  - 128ビットのセキュリティレベル
  - 高速な署名生成と検証
  - メッセージの送信者認証と改ざん検知

#### 3. 安全な鍵交換
- **X25519**: 楕円曲線ディフィー・ヘルマン鍵交換
  - 128ビットのセキュリティレベル
  - 前方秘匿性（Forward Secrecy）をサポート
  - HKDF-SHA256による鍵導出

### セキュリティレベル

すべての暗号化アルゴリズムは、以下の基準を満たしています：

- **AES-256-GCM**: NIST承認、産業標準
- **Ed25519**: RFC 8032、最新の楕円曲線署名
- **X25519**: RFC 7748、最新の楕円曲線鍵交換
- **HKDF-SHA256**: RFC 5869、安全な鍵導出

### インストール

```bash
pip install -r requirements.txt
```

### 使用方法

#### デモの実行

```bash
python secure_chat.py
```

#### テストの実行

```bash
python test_secure_chat.py
```

### コード例

```python
from secure_chat import SecureChatCrypto

# ユーザーの初期化
alice = SecureChatCrypto()
bob = SecureChatCrypto()

# 公開鍵の交換
alice_public_keys = alice.get_public_keys()
bob_public_keys = bob.get_public_keys()

# 鍵交換による共有鍵の生成
alice_shared_key = alice.derive_shared_key(bob_public_keys['kex_key'])
bob_shared_key = bob.derive_shared_key(alice_public_keys['kex_key'])

# アリスからボブへの安全なメッセージ送信
message = "こんにちは、ボブ！"
secure_message = alice.create_secure_message(message, alice_shared_key)

# ボブがメッセージを検証して復号化
is_valid, decrypted = bob.verify_and_decrypt_message(
    secure_message,
    bob_shared_key,
    alice_public_keys['signing_key']
)

if is_valid:
    print(f"メッセージを受信: {decrypted}")
```

### セキュリティの特徴

1. **エンドツーエンド暗号化**: メッセージは送信者のデバイスで暗号化され、受信者のデバイスでのみ復号化されます
2. **認証付き暗号化**: GCMモードにより、暗号文の改ざんを検知できます
3. **デジタル署名**: すべてのメッセージに署名が付与され、送信者の認証と改ざん検知が可能です
4. **前方秘匿性**: 鍵交換により、過去のメッセージは新しい鍵漏洩からも保護されます
5. **ランダムなnonce**: 各暗号化で一意のnonceを使用し、同じメッセージでも異なる暗号文を生成します

### アーキテクチャ

```
SecureChatCrypto
├── 鍵管理
│   ├── Ed25519 署名鍵ペア（秘密鍵・公開鍵）
│   └── X25519 鍵交換鍵ペア（秘密鍵・公開鍵）
├── 暗号化操作
│   ├── encrypt_message (AES-256-GCM)
│   └── decrypt_message (AES-256-GCM)
├── 署名操作
│   ├── sign_message (Ed25519)
│   └── verify_signature (Ed25519)
└── 鍵交換
    └── derive_shared_key (X25519 + HKDF-SHA256)
```

### テストカバレッジ

包括的なテストスイートには以下が含まれます：

- ✅ 鍵交換の検証
- ✅ 暗号化・復号化のテスト
- ✅ 署名生成・検証のテスト
- ✅ 改ざん検知のテスト
- ✅ Unicode文字列のサポート
- ✅ 長いメッセージのサポート
- ✅ エッジケースのテスト

### ライセンス

MIT License

### セキュリティに関する注意事項

- 秘密鍵は安全に保管してください
- 本番環境では、追加の鍵管理とストレージのセキュリティ対策が必要です
- セキュリティ上の問題を発見した場合は、責任を持って報告してください