"""Admin Digi-Mon grants via Supabase service role."""

from __future__ import annotations

import os
from typing import Any

from predictions import _supabase_client


def grant_digimon_by_email(email: str, amount: int, reason: str = "관리자 충전") -> dict[str, Any]:
    client = _supabase_client()
    if client is None:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    email_clean = (email or "").strip()
    if not email_clean:
        raise ValueError("email is required")
    if amount < 1:
        raise ValueError("amount must be >= 1")

    response = client.rpc(
        "admin_grant_digimon_by_email",
        {
            "p_email": email_clean,
            "p_amount": amount,
            "p_reason": reason or "관리자 충전",
        },
    ).execute()

    balance = response.data
    if balance is None:
        raise RuntimeError("Grant failed: empty response")

    return {
        "email": email_clean,
        "amount": amount,
        "balance": balance,
        "reason": reason or "관리자 충전",
    }
