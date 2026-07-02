"""Supabase JWT user resolution for authenticated API routes."""

from __future__ import annotations

import os
from typing import Any

from fastapi import HTTPException

DEFAULT_SUPABASE_URL = "https://djxoshkygirqgunawvye.supabase.co"
DEFAULT_SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeG9zaGt5Z2lycWd1bmF3dnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzg1MDMsImV4cCI6MjA5NzUxNDUwM30.Biam_Xx-At_J-a_qmXRDeD6QbxoJM5cIUeBHi7FVXPk"
)


def require_user_from_bearer(authorization: str | None) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token required")

    url = os.getenv("SUPABASE_URL", "").strip() or DEFAULT_SUPABASE_URL
    anon = os.getenv("SUPABASE_ANON_KEY", "").strip() or DEFAULT_SUPABASE_ANON_KEY
    try:
        from supabase import create_client

        auth_client = create_client(url, anon)
        user_resp = auth_client.auth.get_user(token)
        user = user_resp.user if user_resp else None
        if not user:
            raise HTTPException(status_code=401, detail="Invalid session")
        return {
            "id": str(user.id),
            "email": user.email or "",
            "user": user,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid session") from exc
