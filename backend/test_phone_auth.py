"""Integration tests for Phone OTP Authentication (Firebase backend endpoints)."""
import time
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User

init_db()
client = TestClient(app)

def test_phone_auth_flow():
    # Use a unique test phone number
    test_phone = f"+9198{int(time.time()) % 100000000:08d}"
    mock_token = f"test-token:{test_phone}:uid_{int(time.time())}"

    # 1. Register with Phone OTP token (no email)
    reg_resp = client.post("/api/auth/phone/register", json={
        "id_token": mock_token,
        "name": "Puja Explorer"
    })
    assert reg_resp.status_code == 201, f"Register failed: {reg_resp.text}"
    data = reg_resp.json()
    assert "access_token" in data
    token = data["access_token"]

    # 2. Verify /api/auth/me works with this token
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200, f"Auth me failed: {me_resp.text}"
    user_info = me_resp.json()
    assert user_info["phone"] == test_phone
    assert user_info["name"] == "Puja Explorer"

    # 3. Duplicate phone registration should fail with 409
    dup_resp = client.post("/api/auth/phone/register", json={
        "id_token": mock_token,
        "name": "Another Name"
    })
    assert dup_resp.status_code == 409, f"Expected 409, got: {dup_resp.status_code}"

    # 4. Login with Phone OTP token
    login_resp = client.post("/api/auth/phone/login", json={
        "id_token": mock_token
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    assert "access_token" in login_resp.json()

    print(f"Phone auth test passed for {test_phone}!")


if __name__ == "__main__":
    test_phone_auth_flow()
