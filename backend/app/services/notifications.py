"""
KrishiDrishti AI — SMS & Email Notification Service
Delivers alerts via real Twilio REST API when credentials are configured.
Falls back to structured logging (development sandbox mode) when Twilio creds are absent.
5-day alert cooldown is enforced in predictions_router to prevent duplicate alerts.
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional

import httpx

from app.config import get_settings
from app.models import NotificationChannel, DeliveryStatus

settings = get_settings()
logger = logging.getLogger("krishidristi.notifications")


class NotificationService:
    """Delivers early warning alerts via SMS (Twilio) with full audit logging."""

    # ──────────────────────────────────────────────────────────
    # Message Formatting
    # ──────────────────────────────────────────────────────────
    @staticmethod
    def format_sms_message(
        farmer_name: str,
        aoi_name: str,
        alert_type: str,
        recommendation: str,
        language: str = "en",
    ) -> str:
        """Format a concise, actionable SMS in English or Hindi."""
        if language == "hi":
            return (
                f"[कृषिदृष्टि AI चेतावनी] नमस्ते {farmer_name}, "
                f"आपके खेत '{aoi_name}' में तनाव देखा गया है। "
                f"सलाह: {recommendation}"
            )
        elif language == "mr":
            return (
                f"[कृषिदृष्टि AI सूचना] नमस्कार {farmer_name}, "
                f"तुमच्या शेतात '{aoi_name}' ताण आढळला आहे. "
                f"सल्ला: {recommendation}"
            )
        return (
            f"[KrishiDrishti AI Alert] Dear {farmer_name}, "
            f"drought stress detected on '{aoi_name}'. "
            f"Recommendation: {recommendation}"
        )

    # ──────────────────────────────────────────────────────────
    # SMS via Twilio REST API
    # ──────────────────────────────────────────────────────────
    def send_sms(
        self,
        phone_number: str,
        message: str,
    ) -> Dict[str, Any]:
        """
        Send SMS via Twilio when credentials are set, otherwise log only.
        Returns a delivery result dict with status and external SID.
        """
        if not phone_number:
            logger.warning("[SMS] No phone number — skipping.")
            return {
                "status": DeliveryStatus.FAILED,
                "external_id": None,
                "error": "No phone number registered",
            }

        # ── Real Twilio delivery ───────────────────────────────
        if (
            settings.TWILIO_ACCOUNT_SID
            and settings.TWILIO_AUTH_TOKEN
            and settings.TWILIO_FROM_NUMBER
        ):
            return self._send_via_twilio(phone_number, message)

        # ── Sandbox fallback (log only) ────────────────────────
        logger.info(
            "[SMS Sandbox] Would send to %s: %s",
            phone_number,
            message,
        )
        try:
            print(
                f"[SMS Sandbox] Twilio not configured - simulated delivery to {phone_number}:\n"
                f"  -> {message}"
            )
        except Exception:
            pass
        ext_id = f"SM_SANDBOX_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        return {
            "status": DeliveryStatus.DELIVERED,
            "external_id": ext_id,
            "sent_at": datetime.utcnow(),
            "delivered_at": datetime.utcnow(),
            "mode": "sandbox",
        }

    def _send_via_twilio(
        self,
        phone_number: str,
        message: str,
    ) -> Dict[str, Any]:
        """Make a real Twilio REST API call to send the SMS."""
        url = (
            f"https://api.twilio.com/2010-04-01/Accounts/"
            f"{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        )
        try:
            res = httpx.post(
                url,
                data={
                    "To": phone_number,
                    "From": settings.TWILIO_FROM_NUMBER,
                    "Body": message,
                },
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                timeout=10.0,
            )

            if res.status_code in (200, 201):
                payload = res.json()
                sid = payload.get("sid", "")
                logger.info(
                    "[SMS Twilio] ✅ Sent to %s — SID: %s",
                    phone_number,
                    sid,
                )
                print(f"[Twilio SMS Live] ✅ Delivered to {phone_number} (SID: {sid})")
                return {
                    "status": DeliveryStatus.DELIVERED,
                    "external_id": sid,
                    "sent_at": datetime.utcnow(),
                    "delivered_at": datetime.utcnow(),
                    "mode": "twilio_live",
                }
            else:
                error_payload = res.json()
                err_msg = error_payload.get("message", res.text[:200])
                logger.error(
                    "[SMS Twilio] ❌ Failed %s — %s",
                    res.status_code,
                    err_msg,
                )
                print(f"[Twilio SMS Error] {res.status_code}: {err_msg}")
                return {
                    "status": DeliveryStatus.FAILED,
                    "external_id": None,
                    "error": err_msg,
                }
        except Exception as exc:
            logger.error("[SMS Twilio] Connection error: %s", exc)
            print(f"[Twilio SMS Error] {exc}")
            return {
                "status": DeliveryStatus.FAILED,
                "external_id": None,
                "error": str(exc),
            }

    # ──────────────────────────────────────────────────────────
    # Email (stub — ready for SendGrid/SES wiring)
    # ──────────────────────────────────────────────────────────
    @staticmethod
    def send_email(
        email_address: str,
        subject: str,
        body_text: str,
    ) -> Dict[str, Any]:
        """Deliver email notification. Stub — wire SendGrid/SES here."""
        if not email_address:
            return {
                "status": DeliveryStatus.FAILED,
                "external_id": None,
                "error": "No email address",
            }
        logger.info("[Email] Sending to %s — Subject: %s", email_address, subject)
        print(f"[Email Sandbox] → {email_address} | {subject}")
        ext_id = f"MSG_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        return {
            "status": DeliveryStatus.DELIVERED,
            "external_id": ext_id,
            "sent_at": datetime.utcnow(),
            "delivered_at": datetime.utcnow(),
        }


notification_service = NotificationService()
