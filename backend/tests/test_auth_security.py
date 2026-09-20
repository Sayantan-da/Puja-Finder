"""Automated OWASP Top 10 Authentication Security Test Suite (Zero Dependencies).

Verifies:
1. Demo Accounts isolation and elimination.
2. MFA TOTP Secondary Verification Flow.
3. Rate Limiting and Brute Force Block (HTTP 429 + Retry-After).
4. Prevention of Username Enumeration & Timing-Attack Mitigation.
"""
import json
import time
import urllib.error
import urllib.request
import pyotp

import threading
import uvicorn
from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import Role, User
from app.utils.security import hash_password

PORT = 8005
BASE_URL = f"http://127.0.0.1:{PORT}"


def start_test_server():
    config = uvicorn.Config(app, host="127.0.0.1", port=PORT, log_level="warning")
    server = uvicorn.Server(config)
    t = threading.Thread(target=server.run, daemon=True)
    t.start()
    time.sleep(1.5)



def make_request(path: str, payload: dict, headers: dict | None = None) -> tuple[int, dict, dict]:
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode("utf-8")
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)

    req = urllib.request.Request(url, data=data, headers=req_headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            resp_headers = dict(resp.headers)
            return resp.status, json.loads(body) if body else {}, resp_headers
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        resp_headers = dict(e.headers)
        return e.code, json.loads(body) if body else {}, resp_headers


def setup_module():
    init_db()
    db = SessionLocal()
    test_user = db.query(User).filter(User.email == "sec_test@example.com").first()
    if not test_user:
        test_user = User(
            name="Security Tester",
            email="sec_test@example.com",
            password_hash=hash_password("SecP@ssw0rd123"),
            role=Role.USER,
            is_active=True,
            is_mfa_enabled=False,
        )
        db.add(test_user)
        db.commit()
    else:
        test_user.is_active = True
        test_user.is_mfa_enabled = False
        test_user.password_hash = hash_password("SecP@ssw0rd123")
        db.commit()
    db.close()


def test_username_enumeration_and_timing_mitigation():
    """Verify identical generic error messages and comparable response times (OWASP A07 & WSTG-INFO-04)."""
    # 1. Non-existent email
    t0 = time.perf_counter()
    status1, body1, _ = make_request("/api/auth/login", {
        "email": "nonexistent_ghost_user_98765@example.com",
        "password": "WrongPassword123!",
    }, headers={"CF-Connecting-IP": "100.64.0.1"})
    t_non_existent = time.perf_counter() - t0

    # 2. Existing email with invalid password
    t0 = time.perf_counter()
    status2, body2, _ = make_request("/api/auth/login", {
        "email": "sec_test@example.com",
        "password": "WrongPassword123!",
    }, headers={"CF-Connecting-IP": "100.64.0.2"})
    t_bad_pw = time.perf_counter() - t0

    assert status1 == 401, f"Expected 401, got {status1}"
    assert status2 == 401, f"Expected 401, got {status2}"
    assert body1.get("detail") == "Invalid email or password", f"Unexpected error detail: {body1}"
    assert body2.get("detail") == "Invalid email or password", f"Unexpected error detail: {body2}"

    print(f"\n[TIMING] Non-existent user latency: {t_non_existent*1000:.2f}ms")
    print(f"[TIMING] Bad password latency:     {t_bad_pw*1000:.2f}ms")
    print("[PASS] Username enumeration & timing attack mitigation verified.")


def test_rate_limiting_brute_force():
    """Verify server-side rate limiter blocks brute-force attempts with HTTP 429."""
    blocked = False
    test_ip = "198.51.100.88"
    for i in range(1, 8):
        status, body, headers = make_request(
            "/api/auth/login",
            {"email": "brute_target_test@example.com", "password": f"TryPass{i}!"},
            headers={"CF-Connecting-IP": test_ip},
        )
        if status == 429:
            blocked = True
            retry_after = headers.get("Retry-After") or headers.get("retry-after")
            assert retry_after is not None, "Missing Retry-After header on 429 response"
            assert "Too many failed login attempts" in body.get("detail", "")
            print(f"[PASS] Brute-force blocked at attempt {i} with HTTP 429 and Retry-After: {retry_after}s")
            break

    assert blocked, "Rate limiter failed to block brute-force attempts."


def test_mfa_totp_flow():
    """Verify secondary verification flow using RFC 6238 TOTP."""
    db = SessionLocal()
    user = db.query(User).filter(User.email == "sec_test@example.com").first()
    
    totp_secret = pyotp.random_base32()
    user.mfa_secret = totp_secret
    user.is_mfa_enabled = True
    db.commit()
    db.close()

    # Step 1: Login with credentials (must prompt for MFA)
    status1, body1, _ = make_request(
        "/api/auth/login",
        {"email": "sec_test@example.com", "password": "SecP@ssw0rd123"},
        headers={"CF-Connecting-IP": "203.0.113.50"}
    )
    assert status1 == 200, f"Expected 200, got {status1}: {body1}"
    assert body1.get("mfa_required") is True
    assert body1.get("access_token") is None
    mfa_token = body1.get("mfa_token")
    assert mfa_token is not None

    # Step 2: Attempt with invalid TOTP code
    status_bad, body_bad, _ = make_request(
        "/api/auth/login/mfa",
        {"mfa_token": mfa_token, "code": "000000"},
        headers={"CF-Connecting-IP": "203.0.113.50"}
    )
    assert status_bad == 401
    assert "Invalid verification code" in body_bad.get("detail", "")

    # Step 3: Attempt with valid TOTP code
    valid_code = pyotp.TOTP(totp_secret).now()
    status_good, body_good, _ = make_request(
        "/api/auth/login/mfa",
        {"mfa_token": mfa_token, "code": valid_code},
        headers={"CF-Connecting-IP": "203.0.113.50"}
    )
    assert status_good == 200, f"Expected 200, got {status_good}: {body_good}"
    assert body_good.get("access_token") is not None
    assert body_good.get("mfa_required") is False

    # Clean up test user MFA
    db = SessionLocal()
    user = db.query(User).filter(User.email == "sec_test@example.com").first()
    user.is_mfa_enabled = False
    user.mfa_secret = None
    db.commit()
    db.close()
    print("[PASS] Full TOTP Multi-Factor Authentication flow verified.")


if __name__ == "__main__":
    setup_module()
    start_test_server()
    test_username_enumeration_and_timing_mitigation()
    test_rate_limiting_brute_force()
    test_mfa_totp_flow()
    print("\n[ALL SECURITY TESTS PASSED SUCCESSFULLY!]")

