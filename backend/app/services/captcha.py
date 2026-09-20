"""Cloudflare Turnstile Bot Protection Service (OWASP A04/A07).

Validates user response tokens against Cloudflare's siteverify endpoint.
"""
import json
import logging
import urllib.parse
import urllib.request
from typing import Optional

from app.config import settings

logger = logging.getLogger("pujafinder.captcha")

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify_turnstile_token(token: Optional[str], remote_ip: Optional[str] = None) -> bool:
    """Verify a Turnstile token against Cloudflare's siteverify API.

    If Turnstile is disabled in settings (e.g., local development/testing),
    verification automatically passes.
    """
    if not settings.turnstile_enabled:
        return True

    if not token or not settings.turnstile_secret_key:
        logger.warning("Turnstile verification failed: missing token or secret key")
        return False

    try:
        data = urllib.parse.urlencode({
            "secret": settings.turnstile_secret_key,
            "response": token,
            "remoteip": remote_ip or "",
        }).encode("utf-8")

        req = urllib.request.Request(
            TURNSTILE_VERIFY_URL,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=5.0) as response:
            result = json.loads(response.read().decode("utf-8"))
            success = bool(result.get("success", False))
            if not success:
                logger.warning("Turnstile check failed: %s", result.get("error-codes", []))
            return success

    except Exception as e:
        logger.error("Error during Turnstile verification: %s", e)
        return False
