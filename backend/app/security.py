"""Shared secret hashing -- used for both coach account passwords and
tracker user PINs. One pbkdf2 scheme, one place, instead of two copies
drifting apart."""

import hashlib
import hmac
import os


def hash_secret(secret: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", secret.encode(), salt, 100_000)
    return salt.hex() + ":" + digest.hex()


def verify_secret(secret: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split(":", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac("sha256", secret.encode(), salt, 100_000)
    return hmac.compare_digest(digest.hex(), digest_hex)
