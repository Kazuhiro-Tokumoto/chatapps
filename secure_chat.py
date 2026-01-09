"""
Secure Chat Application with Strong Encryption and Digital Signatures

This module provides cryptographic functions for:
- AES-256-GCM encryption/decryption for message confidentiality
- Ed25519 digital signatures for message authentication and integrity
- X25519 key exchange for secure shared secret derivation
"""

import os
import base64
from typing import Tuple, Dict
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


class SecureChatCrypto:
    """
    Handles all cryptographic operations for the secure chat application.
    
    Security Features:
    - AES-256-GCM: Authenticated encryption with 256-bit keys
    - Ed25519: EdDSA signatures for authentication (128-bit security level)
    - X25519: Elliptic curve Diffie-Hellman for key exchange
    - HKDF-SHA256: Key derivation function
    """
    
    def __init__(self):
        """Initialize cryptographic keys for the chat user."""
        # Generate signing key pair (Ed25519)
        self.signing_private_key = Ed25519PrivateKey.generate()
        self.signing_public_key = self.signing_private_key.public_key()
        
        # Generate key exchange key pair (X25519)
        self.kex_private_key = X25519PrivateKey.generate()
        self.kex_public_key = self.kex_private_key.public_key()
    
    def get_public_keys(self) -> Dict[str, bytes]:
        """
        Export public keys for sharing with other users.
        
        Returns:
            Dictionary containing base64-encoded public keys
        """
        signing_public_bytes = self.signing_public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        
        kex_public_bytes = self.kex_public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        
        return {
            'signing_key': base64.b64encode(signing_public_bytes).decode('utf-8'),
            'kex_key': base64.b64encode(kex_public_bytes).decode('utf-8')
        }
    
    def derive_shared_key(self, peer_kex_public_key_b64: str) -> bytes:
        """
        Perform X25519 key exchange to derive a shared secret.
        
        Args:
            peer_kex_public_key_b64: Peer's public key exchange key (base64 encoded)
            
        Returns:
            32-byte derived encryption key using HKDF-SHA256
        """
        peer_kex_public_bytes = base64.b64decode(peer_kex_public_key_b64)
        peer_kex_public_key = X25519PublicKey.from_public_bytes(peer_kex_public_bytes)
        
        # Perform key exchange
        shared_secret = self.kex_private_key.exchange(peer_kex_public_key)
        
        # Derive a 256-bit encryption key using HKDF-SHA256
        derived_key = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b'chatapp-encryption-key',
        ).derive(shared_secret)
        
        return derived_key
    
    def encrypt_message(self, message: str, encryption_key: bytes) -> Dict[str, str]:
        """
        Encrypt a message using AES-256-GCM.
        
        Args:
            message: The plaintext message to encrypt
            encryption_key: 32-byte encryption key
            
        Returns:
            Dictionary with base64-encoded nonce and ciphertext
        """
        # Generate a random 96-bit nonce (recommended for GCM)
        nonce = os.urandom(12)
        
        # Create AES-GCM cipher
        aesgcm = AESGCM(encryption_key)
        
        # Encrypt the message
        ciphertext = aesgcm.encrypt(nonce, message.encode('utf-8'), None)
        
        return {
            'nonce': base64.b64encode(nonce).decode('utf-8'),
            'ciphertext': base64.b64encode(ciphertext).decode('utf-8')
        }
    
    def decrypt_message(self, encrypted_data: Dict[str, str], encryption_key: bytes) -> str:
        """
        Decrypt a message using AES-256-GCM.
        
        Args:
            encrypted_data: Dictionary with nonce and ciphertext
            encryption_key: 32-byte encryption key
            
        Returns:
            Decrypted plaintext message
            
        Raises:
            Exception: If decryption or authentication fails
        """
        nonce = base64.b64decode(encrypted_data['nonce'])
        ciphertext = base64.b64decode(encrypted_data['ciphertext'])
        
        # Create AES-GCM cipher
        aesgcm = AESGCM(encryption_key)
        
        # Decrypt and verify authentication tag
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        
        return plaintext.decode('utf-8')
    
    def sign_message(self, message: str) -> str:
        """
        Create a digital signature for a message using Ed25519.
        
        Args:
            message: The message to sign
            
        Returns:
            Base64-encoded signature
        """
        signature = self.signing_private_key.sign(message.encode('utf-8'))
        return base64.b64encode(signature).decode('utf-8')
    
    def verify_signature(self, message: str, signature_b64: str, 
                        peer_signing_public_key_b64: str) -> bool:
        """
        Verify a digital signature using Ed25519.
        
        Args:
            message: The message that was signed
            signature_b64: Base64-encoded signature
            peer_signing_public_key_b64: Peer's public signing key (base64 encoded)
            
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            signature = base64.b64decode(signature_b64)
            peer_signing_public_bytes = base64.b64decode(peer_signing_public_key_b64)
            peer_signing_public_key = Ed25519PublicKey.from_public_bytes(
                peer_signing_public_bytes
            )
            
            # Verify signature (raises exception if invalid)
            peer_signing_public_key.verify(signature, message.encode('utf-8'))
            return True
        except Exception:
            return False
    
    def create_secure_message(self, message: str, encryption_key: bytes) -> Dict[str, str]:
        """
        Create a secure message with both encryption and signature.
        
        Args:
            message: The plaintext message
            encryption_key: 32-byte encryption key from key exchange
            
        Returns:
            Dictionary with encrypted message and signature
        """
        # First sign the message
        signature = self.sign_message(message)
        
        # Then encrypt the message
        encrypted = self.encrypt_message(message, encryption_key)
        
        return {
            'encrypted': encrypted,
            'signature': signature,
            'plaintext_for_signature': message  # For verification (sent separately or known)
        }
    
    def verify_and_decrypt_message(self, secure_message: Dict[str, str], 
                                   encryption_key: bytes,
                                   peer_signing_public_key_b64: str) -> Tuple[bool, str]:
        """
        Verify signature and decrypt a secure message.
        
        Args:
            secure_message: Dictionary with encrypted data and signature
            encryption_key: 32-byte encryption key
            peer_signing_public_key_b64: Peer's public signing key
            
        Returns:
            Tuple of (is_valid, decrypted_message)
        """
        # Decrypt the message first
        decrypted_message = self.decrypt_message(
            secure_message['encrypted'], 
            encryption_key
        )
        
        # Verify the signature
        is_valid = self.verify_signature(
            decrypted_message,
            secure_message['signature'],
            peer_signing_public_key_b64
        )
        
        return (is_valid, decrypted_message)


def demonstrate_secure_chat():
    """Demonstrate the secure chat functionality."""
    print("=== Secure Chat Application Demonstration ===\n")
    
    # Create two users (Alice and Bob)
    print("1. Initializing users with cryptographic keys...")
    alice = SecureChatCrypto()
    bob = SecureChatCrypto()
    
    # Exchange public keys
    alice_public_keys = alice.get_public_keys()
    bob_public_keys = bob.get_public_keys()
    print(f"   Alice's signing key: {alice_public_keys['signing_key'][:32]}...")
    print(f"   Bob's signing key: {bob_public_keys['signing_key'][:32]}...")
    
    # Perform key exchange
    print("\n2. Performing X25519 key exchange...")
    alice_shared_key = alice.derive_shared_key(bob_public_keys['kex_key'])
    bob_shared_key = bob.derive_shared_key(alice_public_keys['kex_key'])
    
    # Verify both derived the same key
    assert alice_shared_key == bob_shared_key, "Key exchange failed!"
    print(f"   Shared encryption key derived: {base64.b64encode(alice_shared_key[:16]).decode()}...")
    
    # Alice sends a secure message to Bob
    print("\n3. Alice sends encrypted and signed message to Bob...")
    message = "Hello Bob! This is a secure message with strong encryption and signature."
    secure_message = alice.create_secure_message(message, alice_shared_key)
    print(f"   Original message: {message}")
    print(f"   Encrypted (first 50 chars): {secure_message['encrypted']['ciphertext'][:50]}...")
    print(f"   Signature (first 32 chars): {secure_message['signature'][:32]}...")
    
    # Bob receives and verifies the message
    print("\n4. Bob receives, verifies signature, and decrypts message...")
    is_valid, decrypted_message = bob.verify_and_decrypt_message(
        secure_message,
        bob_shared_key,
        alice_public_keys['signing_key']
    )
    
    print(f"   Signature valid: {is_valid}")
    print(f"   Decrypted message: {decrypted_message}")
    
    # Verify the decrypted message matches original
    assert decrypted_message == message, "Decryption failed!"
    assert is_valid, "Signature verification failed!"
    
    print("\n✅ All security checks passed!")
    print("\nSecurity Features Demonstrated:")
    print("  - AES-256-GCM encryption with 96-bit random nonces")
    print("  - Ed25519 digital signatures (128-bit security)")
    print("  - X25519 key exchange (128-bit security)")
    print("  - HKDF-SHA256 key derivation")
    

if __name__ == "__main__":
    demonstrate_secure_chat()
