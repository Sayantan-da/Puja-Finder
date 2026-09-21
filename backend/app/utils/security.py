from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings


import pyotp

# Constant-time timing attack protection (OWASP WSTG-INFO-04)
# We pre-compute a dummy bcrypt hash on startup so that if an email does NOT exist,
# we still run bcrypt.checkpw with the exact same CPU work factor as an existing user.
DUMMY_BCRYPT_HASH: str = bcrypt.hashpw(b"timing_attack_mitigation_dummy_hash", bcrypt.gensalt()).decode("utf-8")


# ---------- Password hashing (bcrypt) ----------

def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def dummy_verify_password(plain: str) -> bool:
    """Execute bcrypt against a dummy hash to normalize response times."""
    return verify_password(plain, DUMMY_BCRYPT_HASH)


# ---------- JWT & MFA Tokens ----------

def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "scope": "access", "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> str | None:
    """Return the subject (user id) or None if invalid/expired or wrong scope."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("scope", "access") != "access":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def create_mfa_token(user_id: int) -> str:
    """Create a temporary, strictly scoped JWT token for the second MFA step."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.mfa_token_expire_minutes)
    payload = {"sub": str(user_id), "scope": "mfa_pending", "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_mfa_token(token: str) -> int | None:
    """Validate that token is an active MFA pending token and return user_id."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("scope") != "mfa_pending":
            return None
        user_id_str = payload.get("sub")
        return int(user_id_str) if user_id_str else None
    except (JWTError, ValueError):
        return None


# ---------- TOTP Multi-Factor Authentication (RFC 6238) ----------

def generate_totp_secret() -> str:
    """Generate a cryptographically secure random base32 TOTP secret."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, user_email: str) -> str:
    """Generate otpauth:// URI for QR code rendering."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=user_email, issuer_name=settings.mfa_issuer_name)


def verify_totp_code(secret: str, code: str, valid_window: int = 1) -> bool:
    """Verify a 6-digit TOTP code with time drift window (prevents clock skew)."""
    if not secret or not code:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=valid_window)


# ---------- Password Reset Tokens ----------

def create_password_reset_token(email: str) -> str:
    """Create a temporary, signed token for password reset."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_token_expire_minutes)
    payload = {"sub": email.lower(), "scope": "password_reset", "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def verify_password_reset_token(token: str) -> str | None:
    """Validate password reset token and return user email or None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("scope") != "password_reset":
            return None
        return payload.get("sub")
    except JWTError:
        return None


