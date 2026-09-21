import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.config import settings

logger = logging.getLogger("app.services.email")


def _build_reset_email_html(reset_link: str, user_name: Optional[str] = None) -> str:
    greeting = f"Hello {user_name}," if user_name else "Hello,"
    expire_minutes = settings.password_reset_token_expire_minutes

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your PujaFinder Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f1117; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: linear-gradient(180deg, #1a1e29 0%, #131620 100%); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%); padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                🪔 PujaFinder
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500;">
                Kolkata Durga Puja Experience
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #f8fafc;">
                Password Reset Request
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                {greeting}
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                We received a request to reset the password for your PujaFinder account. Click the button below to create a new password. This link is valid for <strong>{expire_minutes} minutes</strong>.
              </p>

              <!-- Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="{reset_link}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4); text-align: center;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 12px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                If button does not work, copy and paste this URL into your browser:
              </p>
              <p style="margin: 0 0 24px 0; font-size: 12px; word-break: break-all; color: #f59e0b; background: rgba(245, 158, 11, 0.08); padding: 10px 14px; border-radius: 8px; border: 1px dashed rgba(245, 158, 11, 0.3);">
                {reset_link}
              </p>

              <hr style="border: none; border-top: 1px solid rgba(148, 163, 184, 0.15); margin: 24px 0;" />

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px; background-color: #0b0d13; text-align: center; border-top: 1px solid rgba(255,255,255,0.05);">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                © 2026 PujaFinder Kolkata. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send_smtp_email_sync(to_email: str, subject: str, html_body: str, plain_body: str) -> None:
    """Synchronous SMTP mail delivery with STARTTLS or SSL."""
    if not settings.smtp_host:
        logger.warning(
            "[EMAIL SERVICE] SMTP_HOST not configured. Email will not be sent over network.\n"
            f"To: {to_email}\nSubject: {subject}\nBody:\n{plain_body}"
        )
        return

    from_email = settings.smtp_from_email or settings.smtp_user
    from_header = f"{settings.smtp_from_name} <{from_email}>" if settings.smtp_from_name else from_email

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_header
    msg["To"] = to_email

    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    if settings.smtp_port == 465:
        # SSL
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(from_email, [to_email], msg.as_string())
    else:
        # 587 or standard with STARTTLS
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_tls:
                server.starttls()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(from_email, [to_email], msg.as_string())

    logger.info(f"Password reset email sent to {to_email}")


async def send_password_reset_email(to_email: str, reset_token: str, user_name: Optional[str] = None) -> None:
    """Constructs the reset link and sends the password reset email asynchronously."""
    frontend_base = settings.frontend_url.rstrip("/")
    reset_link = f"{frontend_base}/reset-password?token={reset_token}"
    subject = "Reset Your PujaFinder Password"

    plain_body = (
        f"Hello,\n\n"
        f"We received a request to reset your PujaFinder password.\n"
        f"Click the link below to set a new password (valid for {settings.password_reset_token_expire_minutes} minutes):\n\n"
        f"{reset_link}\n\n"
        f"If you did not request this, please ignore this message.\n\n"
        f"— PujaFinder Team"
    )
    html_body = _build_reset_email_html(reset_link, user_name)

    # Always log reset link in development console for easy testing
    logger.info(f"\n=======================================================\n"
                f"[PASSWORD RESET LINK for {to_email}]\n{reset_link}\n"
                f"=======================================================\n")

    try:
        await asyncio.to_thread(_send_smtp_email_sync, to_email, subject, html_body, plain_body)
    except Exception as exc:
        logger.error(f"Failed to deliver password reset email to {to_email}: {exc}", exc_info=True)
