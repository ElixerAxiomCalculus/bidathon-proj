"""
Email service — send OTP verification emails using smtplib.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))


def send_otp_email(email: str, otp_code: str, purpose: str = "verification") -> bool:
    """
    Send an OTP email to the user via smtplib.

    Args:
        email: Recipient email address.
        otp_code: The 6-digit OTP code.
        purpose: Either 'verification', 'login', or 'resend'.

    Returns:
        True if email was sent successfully, False otherwise.
    """
    subject_map = {
        "verification": "FinAlly — Verify Your Account",
        "login": "FinAlly — Your Login OTP",
        "resend": "FinAlly — New Verification Code",
    }
    subject = subject_map.get(purpose, "FinAlly — Your OTP Code")

    heading = "Welcome! Verify your email" if purpose == "verification" else "Your login code"
    body_text = (
        "Use the code below to complete your account setup."
        if purpose == "verification"
        else "Use the code below to sign in to your account."
    )

    html_body = f"""\
<html>
<body style="margin:0;padding:0;background:#0d1117;">
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;padding:0;">
    <div style="background:linear-gradient(135deg,#0a0e17 0%,#111827 100%);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="margin:0;font-size:28px;">
            <span style="color:#ffffff;font-weight:300;">Fin</span><span style="color:#0466c8;font-weight:700;">Ally</span>
        </h1>
        <p style="color:#9ca3af;font-size:13px;margin:4px 0 0;">Intelligence meets finance</p>
    </div>
    <div style="background:#1a1f2e;padding:32px 24px;color:#e5e7eb;">
        <h2 style="color:#ffffff;font-size:20px;margin:0 0 8px;">{heading}</h2>
        <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 24px;">
            {body_text}
            This code expires in <strong style="color:#ffffff;">5 minutes</strong>.
        </p>
        <div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0466c8;font-family:'Courier New',monospace;">
                {otp_code}
            </span>
        </div>
        <p style="color:#6b7280;font-size:12px;margin:0;line-height:1.5;">
            If you didn't request this code, you can safely ignore this email.
            Never share this code with anyone.
        </p>
    </div>
    <div style="background:#111827;padding:16px 24px;border-radius:0 0 12px 12px;text-align:center;">
        <p style="color:#4b5563;font-size:11px;margin:0;">
            &copy; 2026 FinAlly by ByteStorm &mdash; All rights reserved
        </p>
    </div>
</div>
</body>
</html>"""

    plain_body = (
        f"{heading}\n\n"
        f"{body_text}\n"
        f"Your OTP is: {otp_code}\n\n"
        f"This code expires in 5 minutes.\n"
        f"If you didn't request this code, ignore this email."
    )

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"FinAlly <{SMTP_EMAIL}>"
        msg["To"] = email

        msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, email, msg.as_string())
        server.quit()

        print(f"[EMAIL] OTP sent to {email}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send OTP to {email}: {e}")
        print(f"[OTP FALLBACK] {email} → {otp_code}")
        return False
