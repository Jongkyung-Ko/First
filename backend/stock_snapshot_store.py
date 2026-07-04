"""Global stock snapshot store in Supabase — shared across all users/devices."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

KNOWN_SNAPSHOT_IDS = frozenset(
    {
        "recommend2",
        "golden-cross",
        "bollinger",
        "rsi-divergence",
        "candle-support",
        "obv-divergence",
        "bottom-pattern",
        "vcp",
        "fundamentals",
        "quality-score",
        "long-term-screens",
        "chart-kr",
        "chart-us",
    }
)


def _client():
    from predictions import _supabase_client

    return _supabase_client()


def snapshot_configured() -> bool:
    return _client() is not None


def _payload_timestamp(payload: dict[str, Any]) -> str:
    return (
        payload.get("updatedAt")
        or payload.get("updatedAtKst")
        or payload.get("updatedAtNy")
        or payload.get("savedAt")
        or datetime.now(timezone.utc).isoformat()
    )


def save_global_snapshot(
    snapshot_id: str,
    payload: dict[str, Any],
    *,
    source: str | None = None,
) -> bool:
    """Upsert full UI payload. Returns False if Supabase is unavailable."""
    client = _client()
    if client is None or not snapshot_id:
        return False

    body = dict(payload)
    saved_at = _payload_timestamp(body)
    row = {
        "snapshot_id": snapshot_id,
        "payload": body,
        "source": source or body.get("source") or "snapshot",
        "saved_at": saved_at,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        client.table("stock_snapshots").upsert(row, on_conflict="snapshot_id").execute()
        return True
    except Exception:
        return False


def load_global_snapshot(snapshot_id: str) -> dict[str, Any] | None:
    client = _client()
    if client is None or not snapshot_id:
        return None
    try:
        res = (
            client.table("stock_snapshots")
            .select("payload,source,saved_at,updated_at")
            .eq("snapshot_id", snapshot_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        row = rows[0]
        payload = row.get("payload")
        if not isinstance(payload, dict):
            return None
        out = dict(payload)
        if row.get("source"):
            out.setdefault("source", row["source"])
        if row.get("saved_at") and not out.get("savedAt"):
            out["savedAt"] = row["saved_at"]
        return out
    except Exception:
        return None


def list_global_snapshot_meta() -> dict[str, str | None]:
    """snapshot_id -> best timestamp string for nav meta."""
    client = _client()
    if client is None:
        return {}
    try:
        res = (
            client.table("stock_snapshots")
            .select("snapshot_id,saved_at,updated_at,payload")
            .execute()
        )
        out: dict[str, str | None] = {}
        for row in res.data or []:
            sid = str(row.get("snapshot_id") or "")
            if not sid:
                continue
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            ts = (
                payload.get("updatedAt")
                or payload.get("updatedAtKst")
                or payload.get("updatedAtNy")
                or payload.get("savedAt")
                or row.get("saved_at")
                or row.get("updated_at")
            )
            out[sid] = str(ts) if ts else None
        return out
    except Exception:
        return {}


def pick_newer_timestamp(a: str | None, b: str | None) -> str | None:
    if not a:
        return b
    if not b:
        return a
    try:
        ta = datetime.fromisoformat(str(a).replace("Z", "+00:00")).timestamp()
        tb = datetime.fromisoformat(str(b).replace("Z", "+00:00")).timestamp()
        return a if ta >= tb else b
    except ValueError:
        return a or b
