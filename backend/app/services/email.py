import os
import resend
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
# If using a verified domain, change this. Otherwise, use 'onboarding@resend.dev' for testing.
# For production usage with a custom domain, update this env var or string.
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev") 

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def send_otp_email(email: str, otp_code: str, purpose: str = "verification") -> bool:
    """
    Send an OTP email using Resend API.
    
    Args:
        email: Recipient email address.
        otp_code: The 6-digit OTP code.
        purpose: 'verification', 'login', or 'resend'.
        
    Returns:
        True if sent successfully (or accepted by API), False otherwise.
    """
    if not RESEND_API_KEY:
        print("[EMAIL WARNING] RESEND_API_KEY not found. Printing OTP to logs.")
        print(f"[OTP FALLBACK] {email} → {otp_code}")
        return True # Return True to allow flow to continue, effectively mocking it.

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

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ margin: 0; padding: 0; background-color: #0d1117; font-family: 'Segoe UI', Arial, sans-serif; }}
            .container {{ max-width: 480px; margin: 0 auto; padding: 0; }}
            .header {{ background: linear-gradient(135deg, #0a0e17 0%, #111827 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center; }}
            .content {{ background-color: #1a1f2e; padding: 32px 24px; color: #e5e7eb; }}
            .footer {{ background-color: #111827; padding: 16px 24px; border-radius: 0 0 12px 12px; text-align: center; }}
            .otp-box {{ background-color: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }}
            .otp-code {{ font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0466c8; font-family: 'Courier New', monospace; }}
            h1 {{ margin: 0; font-size: 28px; }}
            .brand-fin {{ color: #ffffff; font-weight: 300; }}
            .brand-ally {{ color: #0466c8; font-weight: 700; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1><span class="brand-fin">Fin</span><span class="brand-ally">Ally</span></h1>
                <p style="color: #9ca3af; font-size: 13px; margin-top: 4px;">Intelligence meets finance</p>
            </div>
            <div class="content">
                <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">{heading}</h2>
                <p style="color: #9ca3af; font-size: 14px; line-height: 1.6;">
                    {body_text}<br>
                    This code expires in <strong style="color: #ffffff;">5 minutes</strong>.
                </p>
                <div class="otp-box">
                    <span class="otp-code">{otp_code}</span>
                </div>
                <p style="color: #6b7280; font-size: 12px;">
                    If you didn't request this code, you can safely ignore this email.<br>
                    Never share this code with anyone.
                </p>
            </div>
            <div class="footer">
                <p style="color: #4b5563; font-size: 11px; margin: 0;">
                    &copy; 2026 FinAlly by ByteStorm &mdash; All rights reserved
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    try:
        r = resend.Emails.send({
            "from": FROM_EMAIL,
            "to": email,
            "subject": subject,
            "html": html_content
        })
        print(f"[EMAIL] Resend API success: {r}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send via Resend: {e}")
        # Consider falling back to printing to logs if Resend fails (e.g., misconfig)
        print(f"[OTP FALLBACK] {email} → {otp_code}")
        return False

