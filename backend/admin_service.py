"""Admin dashboard API helpers (service role, paginated)."""

from __future__ import annotations

import os
from typing import Any

from fastapi import HTTPException

from predictions import _supabase_client

ADMIN_EMAILS = frozenset(
    {
        "maspro79@naver.com",
        "master@digitalworld.local",
    }
)

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100


def verify_admin_from_bearer(authorization: str | None) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token required")

    url = os.getenv("SUPABASE_URL", "").strip() or "https://djxoshkygirqgunawvye.supabase.co"
    anon = os.getenv("SUPABASE_ANON_KEY", "").strip() or (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeG9zaGt5Z2lycWd1bmF3dnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzg1MDMsImV4cCI6MjA5NzUxNDUwM30.Biam_Xx-At_J-a_qmXRDeD6QbxoJM5cIUeBHi7FVXPk"
    )
    try:
        from supabase import create_client

        auth_client = create_client(url, anon)
        user_resp = auth_client.auth.get_user(token)
        user = user_resp.user if user_resp else None
        if not user:
            raise HTTPException(status_code=401, detail="Invalid session")
        meta = user.user_metadata or {}
        email = (user.email or "").strip().lower()
        is_admin = meta.get("role") == "master" or email in ADMIN_EMAILS
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        return {
            "id": str(user.id),
            "email": email,
            "role": meta.get("role"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid session") from exc


def _require_client():
    client = _supabase_client()
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Admin API unavailable (SUPABASE_SERVICE_ROLE_KEY not configured)",
        )
    return client


def list_users(
    page: int = 1,
    limit: int = DEFAULT_PAGE_SIZE,
    search: str = "",
) -> dict[str, Any]:
    client = _require_client()
    page = max(1, page)
    limit = min(max(1, limit), MAX_PAGE_SIZE)
    offset = (page - 1) * limit

    query = client.table("profiles").select(
        "id, email, full_name, created_at, last_connected_at, digimon",
        count="exact",
    )
    search_clean = (search or "").strip()
    if search_clean:
        query = query.or_(
            f"email.ilike.%{search_clean}%,full_name.ilike.%{search_clean}%"
        )
    response = (
        query.order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    rows = response.data or []
    total = response.count if response.count is not None else len(rows)

    user_ids = [row["id"] for row in rows if row.get("id")]
    totals_map: dict[str, dict[str, Any]] = {}
    if user_ids:
        totals_resp = (
            client.table("digimon_user_totals")
            .select("user_id, dm_spent, dm_granted, tx_count, last_tx_at")
            .in_("user_id", user_ids)
            .execute()
        )
        for item in totals_resp.data or []:
            totals_map[str(item["user_id"])] = item

    chart_spend_map = _chart_spend_by_users(client, user_ids)

    users = []
    for row in rows:
        uid = str(row.get("id") or "")
        totals = totals_map.get(uid) or {}
        users.append(
            {
                "id": uid,
                "email": row.get("email") or "",
                "full_name": row.get("full_name") or "",
                "created_at": row.get("created_at"),
                "last_connected_at": row.get("last_connected_at"),
                "digimon": row.get("digimon"),
                "dm_spent": int(totals.get("dm_spent") or 0),
                "dm_granted": int(totals.get("dm_granted") or 0),
                "dm_tx_count": int(totals.get("tx_count") or 0),
                "dm_last_tx_at": totals.get("last_tx_at"),
                "chart_dm_spent": int(chart_spend_map.get(uid) or 0),
            }
        )

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": max(1, (total + limit - 1) // limit) if total else 1,
        "users": users,
    }


def _chart_spend_by_users(client: Any, user_ids: list[str]) -> dict[str, int]:
    if not user_ids:
        return {}
    try:
        resp = (
            client.table("digimon_history")
            .select("user_id, amount")
            .in_("user_id", user_ids)
            .eq("entry_type", "spend")
            .ilike("reason", "Chart%")
            .execute()
        )
    except Exception:
        return {}
    out: dict[str, int] = {}
    for row in resp.data or []:
        uid = str(row.get("user_id") or "")
        out[uid] = out.get(uid, 0) + int(row.get("amount") or 0)
    return out


def user_dm_history(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    client = _require_client()
    limit = min(max(1, limit), 100)
    offset = max(0, offset)
    response = (
        client.table("digimon_history")
        .select("id, amount, entry_type, reason, created_at", count="exact")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {
        "user_id": user_id,
        "limit": limit,
        "offset": offset,
        "total": response.count if response.count is not None else len(response.data or []),
        "items": response.data or [],
    }


def menu_stats(days: int = 30) -> dict[str, Any]:
    client = _require_client()
    days = min(max(1, days), 365)

    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(days=days)
    since_iso = since.isoformat()

    events_resp = (
        client.table("menu_analytics")
        .select("page_key, user_id, is_guest, created_at")
        .gte("created_at", since_iso)
        .limit(50000)
        .execute()
    )
    events = events_resp.data or []

    by_page: dict[str, dict[str, Any]] = {}
    for ev in events:
        key = ev.get("page_key") or "unknown"
        bucket = by_page.setdefault(
            key,
            {
                "page_key": key,
                "clicks": 0,
                "guest_clicks": 0,
                "user_ids": set(),
                "last_click_at": None,
            },
        )
        bucket["clicks"] += 1
        if ev.get("is_guest"):
            bucket["guest_clicks"] += 1
        uid = ev.get("user_id")
        if uid:
            bucket["user_ids"].add(str(uid))
        created = ev.get("created_at")
        if created and (bucket["last_click_at"] is None or created > bucket["last_click_at"]):
            bucket["last_click_at"] = created

    pages = []
    for bucket in by_page.values():
        pages.append(
            {
                "page_key": bucket["page_key"],
                "clicks": bucket["clicks"],
                "guest_clicks": bucket["guest_clicks"],
                "unique_users": len(bucket["user_ids"]),
                "last_click_at": bucket["last_click_at"],
            }
        )
    pages.sort(key=lambda x: (-x["clicks"], x["page_key"]))

    return {
        "days": days,
        "since": since_iso,
        "total_events": len(events),
        "pages": pages,
    }
