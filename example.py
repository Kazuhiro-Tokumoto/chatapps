#!/usr/bin/env python3
"""
Example usage of the secure chat application demonstrating all security features.

This script shows how to use the SecureChatCrypto class to:
1. Exchange keys securely
2. Send encrypted and signed messages
3. Verify and decrypt received messages
"""

from secure_chat import SecureChatCrypto
import json


def main():
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║      セキュアチャットアプリケーション使用例                  ║")
    print("║      Secure Chat Application Usage Example                  ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()
    
    # Scenario: Alice and Bob want to have a secure conversation
    print("シナリオ: アリスとボブが安全に会話を行います")
    print("Scenario: Alice and Bob want to have a secure conversation")
    print("─" * 70)
    print()
    
    # Step 1: Initialize users
    print("📱 Step 1: ユーザーの初期化 (Initialize users)")
    alice = SecureChatCrypto()
    bob = SecureChatCrypto()
    print("   ✓ アリスとボブの暗号鍵ペアを生成しました")
    print("   ✓ Generated cryptographic key pairs for Alice and Bob")
    print()
    
    # Step 2: Exchange public keys
    print("🔑 Step 2: 公開鍵の交換 (Exchange public keys)")
    alice_public_keys = alice.get_public_keys()
    bob_public_keys = bob.get_public_keys()
    print(f"   アリスの署名公開鍵: {alice_public_keys['signing_key'][:40]}...")
    print(f"   Alice's signing key: {alice_public_keys['signing_key'][:40]}...")
    print(f"   ボブの署名公開鍵: {bob_public_keys['signing_key'][:40]}...")
    print(f"   Bob's signing key: {bob_public_keys['signing_key'][:40]}...")
    print()
    
    # Step 3: Perform key exchange
    print("🤝 Step 3: 鍵交換の実行 (Perform key exchange)")
    alice_shared_key = alice.derive_shared_key(bob_public_keys['kex_key'])
    bob_shared_key = bob.derive_shared_key(alice_public_keys['kex_key'])
    print("   ✓ X25519鍵交換により共有暗号鍵を導出しました")
    print("   ✓ Derived shared encryption key using X25519 key exchange")
    print(f"   共有鍵が一致: {alice_shared_key == bob_shared_key}")
    print(f"   Shared keys match: {alice_shared_key == bob_shared_key}")
    print()
    
    # Step 4: Alice sends a secure message to Bob
    print("💬 Step 4: アリスがボブにメッセージを送信 (Alice sends message to Bob)")
    message1 = "こんにちは、ボブ！このメッセージは暗号化され、署名されています。🔒"
    print(f"   平文: {message1}")
    print(f"   Plaintext: {message1}")
    
    secure_msg1 = alice.create_secure_message(message1, alice_shared_key)
    print(f"   暗号文 (最初の60文字): {secure_msg1['encrypted']['ciphertext'][:60]}...")
    print(f"   Ciphertext (first 60 chars): {secure_msg1['encrypted']['ciphertext'][:60]}...")
    print(f"   署名 (最初の40文字): {secure_msg1['signature'][:40]}...")
    print(f"   Signature (first 40 chars): {secure_msg1['signature'][:40]}...")
    print()
    
    # Step 5: Bob receives and verifies the message
    print("✅ Step 5: ボブがメッセージを検証・復号化 (Bob verifies and decrypts)")
    is_valid1, decrypted1 = bob.verify_and_decrypt_message(
        secure_msg1,
        bob_shared_key,
        alice_public_keys['signing_key']
    )
    print(f"   署名検証結果: {is_valid1} {'✓ 有効' if is_valid1 else '✗ 無効'}")
    print(f"   Signature verification: {is_valid1} {'✓ Valid' if is_valid1 else '✗ Invalid'}")
    print(f"   復号化メッセージ: {decrypted1}")
    print(f"   Decrypted message: {decrypted1}")
    print()
    
    # Step 6: Bob replies to Alice
    print("💬 Step 6: ボブがアリスに返信 (Bob replies to Alice)")
    message2 = "こんにちは、アリス！安全に受信しました。Thank you! ✨"
    print(f"   平文: {message2}")
    print(f"   Plaintext: {message2}")
    
    secure_msg2 = bob.create_secure_message(message2, bob_shared_key)
    print(f"   暗号文 (最初の60文字): {secure_msg2['encrypted']['ciphertext'][:60]}...")
    print(f"   Ciphertext (first 60 chars): {secure_msg2['encrypted']['ciphertext'][:60]}...")
    print()
    
    # Step 7: Alice receives and verifies Bob's reply
    print("✅ Step 7: アリスがボブの返信を検証・復号化 (Alice verifies Bob's reply)")
    is_valid2, decrypted2 = alice.verify_and_decrypt_message(
        secure_msg2,
        alice_shared_key,
        bob_public_keys['signing_key']
    )
    print(f"   署名検証結果: {is_valid2} {'✓ 有効' if is_valid2 else '✗ 無効'}")
    print(f"   Signature verification: {is_valid2} {'✓ Valid' if is_valid2 else '✗ Invalid'}")
    print(f"   復号化メッセージ: {decrypted2}")
    print(f"   Decrypted message: {decrypted2}")
    print()
    
    # Summary
    print("═" * 70)
    print("🎉 会話完了！ Conversation complete!")
    print("═" * 70)
    print()
    print("セキュリティ機能の確認 / Security Features Verified:")
    print("  ✓ AES-256-GCM 暗号化 / AES-256-GCM Encryption")
    print("  ✓ Ed25519 デジタル署名 / Ed25519 Digital Signatures")
    print("  ✓ X25519 鍵交換 / X25519 Key Exchange")
    print("  ✓ エンドツーエンド暗号化 / End-to-End Encryption")
    print("  ✓ 送信者認証 / Sender Authentication")
    print("  ✓ メッセージ完全性 / Message Integrity")
    print()


if __name__ == "__main__":
    main()
