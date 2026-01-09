"""
Comprehensive tests for the secure chat cryptographic functions.
"""

import unittest
import base64
from secure_chat import SecureChatCrypto


class TestSecureChatCrypto(unittest.TestCase):
    """Test suite for SecureChatCrypto class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.alice = SecureChatCrypto()
        self.bob = SecureChatCrypto()
        
        # Perform key exchange
        alice_public_keys = self.alice.get_public_keys()
        bob_public_keys = self.bob.get_public_keys()
        
        self.alice_shared_key = self.alice.derive_shared_key(bob_public_keys['kex_key'])
        self.bob_shared_key = self.bob.derive_shared_key(alice_public_keys['kex_key'])
        
        self.alice_public_keys = alice_public_keys
        self.bob_public_keys = bob_public_keys
    
    def test_key_exchange_produces_same_key(self):
        """Test that X25519 key exchange produces the same shared key for both parties."""
        self.assertEqual(self.alice_shared_key, self.bob_shared_key)
        self.assertEqual(len(self.alice_shared_key), 32)  # 256 bits
    
    def test_public_keys_are_base64_encoded(self):
        """Test that public keys are properly base64 encoded."""
        # Should be able to decode without errors
        try:
            base64.b64decode(self.alice_public_keys['signing_key'])
            base64.b64decode(self.alice_public_keys['kex_key'])
            base64.b64decode(self.bob_public_keys['signing_key'])
            base64.b64decode(self.bob_public_keys['kex_key'])
        except Exception as e:
            self.fail(f"Public keys are not properly base64 encoded: {e}")
    
    def test_encryption_decryption(self):
        """Test basic encryption and decryption."""
        message = "Test message for encryption"
        
        encrypted = self.alice.encrypt_message(message, self.alice_shared_key)
        
        # Check encrypted data structure
        self.assertIn('nonce', encrypted)
        self.assertIn('ciphertext', encrypted)
        
        # Decrypt and verify
        decrypted = self.bob.decrypt_message(encrypted, self.bob_shared_key)
        self.assertEqual(decrypted, message)
    
    def test_encryption_produces_different_ciphertext(self):
        """Test that encrypting the same message twice produces different ciphertexts."""
        message = "Same message"
        
        encrypted1 = self.alice.encrypt_message(message, self.alice_shared_key)
        encrypted2 = self.alice.encrypt_message(message, self.alice_shared_key)
        
        # Nonces should be different
        self.assertNotEqual(encrypted1['nonce'], encrypted2['nonce'])
        # Ciphertexts should be different
        self.assertNotEqual(encrypted1['ciphertext'], encrypted2['ciphertext'])
    
    def test_signature_verification(self):
        """Test digital signature creation and verification."""
        message = "Test message for signing"
        
        # Alice signs the message
        signature = self.alice.sign_message(message)
        
        # Bob verifies the signature
        is_valid = self.bob.verify_signature(
            message,
            signature,
            self.alice_public_keys['signing_key']
        )
        
        self.assertTrue(is_valid)
    
    def test_signature_verification_fails_for_wrong_message(self):
        """Test that signature verification fails when message is modified."""
        message = "Original message"
        tampered_message = "Tampered message"
        
        # Alice signs the original message
        signature = self.alice.sign_message(message)
        
        # Bob verifies with tampered message
        is_valid = self.bob.verify_signature(
            tampered_message,
            signature,
            self.alice_public_keys['signing_key']
        )
        
        self.assertFalse(is_valid)
    
    def test_signature_verification_fails_for_wrong_key(self):
        """Test that signature verification fails with wrong public key."""
        message = "Test message"
        
        # Alice signs the message
        signature = self.alice.sign_message(message)
        
        # Try to verify with Bob's key (wrong key)
        is_valid = self.alice.verify_signature(
            message,
            signature,
            self.bob_public_keys['signing_key']
        )
        
        self.assertFalse(is_valid)
    
    def test_secure_message_end_to_end(self):
        """Test complete secure message flow with encryption and signature."""
        message = "Complete secure message test"
        
        # Alice creates secure message
        secure_message = self.alice.create_secure_message(
            message,
            self.alice_shared_key
        )
        
        # Bob verifies and decrypts
        is_valid, decrypted = self.bob.verify_and_decrypt_message(
            secure_message,
            self.bob_shared_key,
            self.alice_public_keys['signing_key']
        )
        
        self.assertTrue(is_valid)
        self.assertEqual(decrypted, message)
    
    def test_decryption_fails_with_wrong_key(self):
        """Test that decryption fails with wrong key."""
        message = "Test message"
        encrypted = self.alice.encrypt_message(message, self.alice_shared_key)
        
        # Try to decrypt with a different key
        wrong_key = b'\x00' * 32
        
        with self.assertRaises(Exception):
            self.alice.decrypt_message(encrypted, wrong_key)
    
    def test_tampered_ciphertext_fails_authentication(self):
        """Test that GCM authentication tag catches tampered ciphertext."""
        message = "Test message"
        encrypted = self.alice.encrypt_message(message, self.alice_shared_key)
        
        # Tamper with ciphertext
        ciphertext_bytes = base64.b64decode(encrypted['ciphertext'])
        tampered = bytearray(ciphertext_bytes)
        tampered[0] ^= 1  # Flip one bit
        encrypted['ciphertext'] = base64.b64encode(bytes(tampered)).decode('utf-8')
        
        # Decryption should fail due to authentication tag mismatch
        with self.assertRaises(Exception):
            self.bob.decrypt_message(encrypted, self.bob_shared_key)
    
    def test_unicode_message_support(self):
        """Test that encryption and signing work with Unicode messages."""
        message = "こんにちは世界 🔐 Secure chat! 🚀"
        
        # Encrypt and sign
        secure_message = self.alice.create_secure_message(
            message,
            self.alice_shared_key
        )
        
        # Verify and decrypt
        is_valid, decrypted = self.bob.verify_and_decrypt_message(
            secure_message,
            self.bob_shared_key,
            self.alice_public_keys['signing_key']
        )
        
        self.assertTrue(is_valid)
        self.assertEqual(decrypted, message)
    
    def test_long_message_support(self):
        """Test that encryption and signing work with long messages."""
        message = "A" * 10000  # 10KB message
        
        # Encrypt and sign
        secure_message = self.alice.create_secure_message(
            message,
            self.alice_shared_key
        )
        
        # Verify and decrypt
        is_valid, decrypted = self.bob.verify_and_decrypt_message(
            secure_message,
            self.bob_shared_key,
            self.alice_public_keys['signing_key']
        )
        
        self.assertTrue(is_valid)
        self.assertEqual(decrypted, message)
    
    def test_empty_message(self):
        """Test that encryption and signing work with empty messages."""
        message = ""
        
        # Encrypt and sign
        secure_message = self.alice.create_secure_message(
            message,
            self.alice_shared_key
        )
        
        # Verify and decrypt
        is_valid, decrypted = self.bob.verify_and_decrypt_message(
            secure_message,
            self.bob_shared_key,
            self.alice_public_keys['signing_key']
        )
        
        self.assertTrue(is_valid)
        self.assertEqual(decrypted, message)
    
    def test_multiple_users_different_keys(self):
        """Test that different users have different keys."""
        charlie = SecureChatCrypto()
        
        alice_keys = self.alice.get_public_keys()
        charlie_keys = charlie.get_public_keys()
        
        # All keys should be different
        self.assertNotEqual(alice_keys['signing_key'], charlie_keys['signing_key'])
        self.assertNotEqual(alice_keys['kex_key'], charlie_keys['kex_key'])


if __name__ == '__main__':
    unittest.main()
