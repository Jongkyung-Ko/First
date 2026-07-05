"""Fundamentals Re(force) — single authorized operator."""

from __future__ import annotations

from fastapi import HTTPException

from auth_user import require_user_from_bearer

FUNDAMENTALS_FORCE_EMAIL = "maspro79@naver.com"


def normalize_email(value: str | None) -> str:
    return (value or "").strip().lower()


def is_fundamentals_force_user(email: str | None) -> bool:
    return normalize_email(email) == normalize_email(FUNDAMENTALS_FORCE_EMAIL)


def require_fundamentals_force_user(authorization: str | None) -> dict:
    user = require_user_from_bearer(authorization)
    if not is_fundamentals_force_user(user.get("email")):
        raise HTTPException(status_code=403, detail="권한없음")
    return user


# 단기추천로직 Re(force) — 동일 운영자
require_short_term_force_user = require_fundamentals_force_user
is_short_term_force_user = is_fundamentals_force_user
