"""Admin Digi-Mon grants via Supabase service role."""

from __future__ import annotations

import os
from typing import Any

from predictions import _supabase_client

DEFAULT_SUPABASE_URL = "https://djxoshkygirqgunawvye.supabase.co"
DEFAULT_SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeG9zaGt5Z2lycWd1bmF3dnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzg1MDMsImV4cCI6MjA5NzUxNDUwM30.Biam_Xx-At_J-a_qmXRDeD6QbxoJM5cIUeBHi7FVXPk"
)


def _find_user_id_by_email(admin_client: Any, email_clean: str) -> str:
    page = 1
    per_page = 200
    target = email_clean.lower()

    while True:
        users = admin_client.auth.admin.list_users(page=page, per_page=per_page)
        batch = getattr(users, "users", None) or users
        if not batch:
            break

        for user in batch:
            user_email = getattr(user, "email", None) or ""
            if user_email.lower() == target:
                return str(user.id)

        if len(batch) < per_page:
            break
        page += 1

    raise ValueError(f"User not found: {email_clean}")


def _grant_via_user_session(email_clean: str, amount: int, reason: str) -> int:
    url = os.getenv("SUPABASE_URL", "").strip() or DEFAULT_SUPABASE_URL
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    anon_key = os.getenv("SUPABASE_ANON_KEY", "").strip() or DEFAULT_SUPABASE_ANON_KEY

    if not service_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required")

    from supabase import create_client

    admin_client = create_client(url, service_key)
    _find_user_id_by_email(admin_client, email_clean)

    link = admin_client.auth.admin.generate_link(
        {
            "type": "magiclink",
            "email": email_clean,
        }
    )

    props = getattr(link, "properties", None) or {}
    if not isinstance(props, dict):
        props = props.__dict__ if hasattr(props, "__dict__") else {}

    token_hash = props.get("hashed_token")
    email_otp = props.get("email_otp")

    session_client = create_client(url, anon_key)
    verified = None

    if token_hash:
        verified = session_client.auth.verify_otp(
            {
                "token_hash": token_hash,
                "type": "email",
            }
        )
    elif email_otp:
        verified = session_client.auth.verify_otp(
            {
                "email": email_clean,
                "token": email_otp,
                "type": "email",
            }
        )
    else:
        raise RuntimeError("Failed to create user session for grant")

    session = getattr(verified, "session", None)
    if session is None and isinstance(verified, dict):
        session = verified.get("session")
    if not session:
        raise RuntimeError("Failed to verify admin grant session")

    authed = create_client(url, anon_key)
    authed.auth.set_session(session.access_token, session.refresh_token)
    grant = authed.rpc(
        "grant_digimon",
        {
            "amount": amount,
            "p_reason": reason or "관리자 충전",
        },
    ).execute()

    balance = grant.data
    if balance is None:
        raise RuntimeError("Grant failed: empty response")
    return int(balance)


def grant_digimon_by_email(email: str, amount: int, reason: str = "관리자 충전") -> dict[str, Any]:
    client = _supabase_client()
    if client is None:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    email_clean = (email or "").strip()
    if not email_clean:
        raise ValueError("email is required")
    if amount < 1:
        raise ValueError("amount must be >= 1")

    reason_clean = reason or "관리자 충전"
    balance: int | None = None

    try:
        response = client.rpc(
            "admin_grant_digimon_by_email",
            {
                "p_email": email_clean,
                "p_amount": amount,
                "p_reason": reason_clean,
            },
        ).execute()
        if response.data is not None:
            balance = int(response.data)
    except Exception:
        balance = None

    if balance is None:
        balance = _grant_via_user_session(email_clean, amount, reason_clean)

    return {
        "email": email_clean,
        "amount": amount,
        "balance": balance,
        "reason": reason_clean,
    }
