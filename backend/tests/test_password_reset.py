import os
import unittest

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.utils.security import create_password_reset_token, verify_password_reset_token


class TestPasswordReset(unittest.TestCase):
    def test_token_creation_and_verification(self):
        email = "testuser@example.com"
        token = create_password_reset_token(email)
        self.assertIsNotNone(token)
        self.assertIsInstance(token, str)

        verified_email = verify_password_reset_token(token)
        self.assertEqual(verified_email, email)

    def test_invalid_token(self):
        self.assertIsNone(verify_password_reset_token("invalid.token.string"))
        self.assertIsNone(verify_password_reset_token(""))


if __name__ == "__main__":
    unittest.main()
