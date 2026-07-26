"""Supabase store for Tour daily editions."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any


def _client():
    from predictions import _supabase_client

    return _supabase_client()


def tour_store_configured() -> bool:
    return _client() is not None


def load_tour_edition(edition_date: date) -> dict[str, Any] | None:
    client = _client()
    if client is None:
        return None
    try:
        res = (
            client.table("tour_editions")
            .select("edition_date, title, places, refreshed_at")
            .eq("edition_date", edition_date.isoformat())
            .maybe_single()
            .execute()
        )
        return res.data if res.data else None
    except Exception:
        return None


def save_tour_edition(
    edition_date: date,
    places: list[dict[str, Any]],
    *,
    title: str = "Trending / Hot Place",
) -> bool:
    client = _client()
    if client is None:
        return False

    now = datetime.now(timezone.utc).isoformat()
    row = {
        "edition_date": edition_date.isoformat(),
        "title": title,
        "places": places,
        "refreshed_at": now,
    }
    try:
        client.table("tour_editions").upsert(row, on_conflict="edition_date").execute()
        return True
    except Exception:
        return False
