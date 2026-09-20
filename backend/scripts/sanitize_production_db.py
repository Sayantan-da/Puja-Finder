"""Production Database Sanitization Script (OWASP A07 / A01).

Purges or disables known demo accounts ('admin@pujafinder.in', 'demo@pujafinder.in')
to prevent unauthorized access via default/seed credentials in staging/production environments.

Usage:
    python -m scripts.sanitize_production_db [--purge]
"""
import argparse
import sys
from pathlib import Path

# Ensure backend root is in Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.user import User

DEMO_EMAILS = [
    "admin@pujafinder.in",
    "demo@pujafinder.in",
]


def sanitize(purge: bool = False):
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.email.in_(DEMO_EMAILS)).all()
        if not users:
            print("[INFO] No demo accounts detected in database.")
            return

        for user in users:
            if purge:
                db.delete(user)
                print(f"[PURGED] Demo account deleted: {user.email}")
            else:
                user.is_active = False
                user.password_hash = "DISABLED_DEMO_ACCOUNT"
                print(f"[DEACTIVATED] Demo account deactivated: {user.email}")

        db.commit()
        print("[SUCCESS] Production database sanitization completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Sanitization failed: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sanitize production database demo accounts.")
    parser.add_argument(
        "--purge",
        action="store_true",
        help="Permanently delete demo accounts instead of deactivating them.",
    )
    args = parser.parse_args()
    sanitize(purge=args.purge)
