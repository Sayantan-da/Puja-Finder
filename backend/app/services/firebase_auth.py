import os
import logging
from typing import Optional, Dict, Any

from app.config import settings

logger = logging.getLogger("app.services.firebase_auth")

_firebase_initialized = False

try:
    import firebase_admin
    from firebase_admin import credentials, auth as fb_auth

    # Initialize Firebase Admin if not already initialized
    if not firebase_admin._apps:
        cred_path = settings.firebase_credentials_path
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info("Firebase Admin initialized with service account certificate from %s", cred_path)
        elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS") and os.path.exists(os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")):
            firebase_admin.initialize_app()
            _firebase_initialized = True
            logger.info("Firebase Admin initialized with application default credentials")
        elif settings.firebase_project_id:
            firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})
            _firebase_initialized = True
            logger.info("Firebase Admin initialized with project ID: %s", settings.firebase_project_id)
        else:
            logger.warning(
                "Firebase credentials not found (FIREBASE_CREDENTIALS_PATH or GOOGLE_APPLICATION_CREDENTIALS). "
                "Firebase Admin running in mock/development mode."
            )
    else:
        _firebase_initialized = True
except ImportError:
    logger.warning("firebase-admin package is not installed. Running in mock/development mode.")
    fb_auth = None


def is_firebase_initialized() -> bool:
    """Return whether Firebase Admin has been successfully initialized with real credentials."""
    return _firebase_initialized and fb_auth is not None


def verify_firebase_id_token(id_token: str) -> Dict[str, Any]:
    """
    Verifies a Firebase ID token.
    
    Returns a dictionary containing token claims, including:
    - 'uid': The user's Firebase UID
    - 'phone_number': The verified E.164 phone number (if authenticated via phone)
    - 'email': The user's email address (if present)
    """
    if not id_token:
        raise ValueError("Firebase ID token is required")

    # Development / Testing fallback mode:
    # Allows testing phone flows locally without needing live Firebase Service credentials:
    # Format: "test-token:+919876543210:test-uid" or "mock-token:+919999999999"
    if (id_token.startswith("test-token:") or id_token.startswith("mock-token:")) and not _firebase_initialized:
        parts = id_token.split(":")
        phone = parts[1] if len(parts) > 1 else "+919999999999"
        uid = parts[2] if len(parts) > 2 else f"mock_uid_{phone.replace('+', '')}"
        logger.info("Using mock Firebase token for dev/testing: phone=%s, uid=%s", phone, uid)
        return {
            "uid": uid,
            "phone_number": phone,
            "email": f"{phone.replace('+', '')}@example.com",
            "firebase": {"sign_in_provider": "phone"},
        }

    if not is_firebase_initialized():
        raise RuntimeError(
            "Firebase Admin SDK is not initialized. Please configure FIREBASE_CREDENTIALS_PATH "
            "or GOOGLE_APPLICATION_CREDENTIALS in your backend environment."
        )

    # Real Firebase verification
    try:
        decoded_claims = fb_auth.verify_id_token(id_token)
        return decoded_claims
    except Exception as e:
        logger.error("Failed to verify Firebase ID token: %s", str(e))
        raise
