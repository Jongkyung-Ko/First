"""Global stock snapshot store in Supabase — shared across all users/devices."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Callable

logger = logging.getLogger(__name__)

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


def payload_timestamp(payload: dict[str, Any] | None) -> str | None:
    if not payload or not isinstance(payload, dict):
        return None
    return (
        payload.get("updatedAt")
        or payload.get("updatedAtKst")
        or payload.get("updatedAtNy")
        or payload.get("savedAt")
        or payload.get("holdReturnBackfillAt")
    )


def _payload_timestamp(payload: dict[str, Any]) -> str:
    return payload_timestamp(payload) or datetime.now(timezone.utc).isoformat()


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


def pick_newer_payload(
    a: dict[str, Any] | None,
    b: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Return whichever payload has the newer timestamp (tie → a)."""
    if not a:
        return b
    if not b:
        return a
    ta = payload_timestamp(a)
    tb = payload_timestamp(b)
    winner = pick_newer_timestamp(ta, tb)
    if winner == tb and ta != tb:
        return b
    return a


def _is_user_scan_source(source: str | None) -> bool:
    return (source or "").lower() in ("user_re", "live")


def should_skip_supabase_upsert(
    *,
    incoming_source: str | None,
    incoming_ts: str,
    existing_payload: dict[str, Any] | None,
    existing_row_source: str | None = None,
) -> bool:
    """Skip upsert when incoming is older, or cron would clobber a newer user Re."""
    if not existing_payload:
        return False
    if _is_user_scan_source(incoming_source):
        return False

    existing_ts = payload_timestamp(existing_payload)
    if not existing_ts:
        return False

    existing_source = existing_row_source or existing_payload.get("source")
    if (incoming_source or "").lower() == "cron" and (existing_source or "").lower() == "user_re":
        if pick_newer_timestamp(incoming_ts, existing_ts) != incoming_ts:
            logger.info(
                "skip cron supabase upsert — existing user_re is newer incoming=%s existing=%s",
                incoming_ts,
                existing_ts,
            )
            return True
        if incoming_ts == existing_ts:
            logger.info(
                "skip cron supabase upsert — tie with user_re snapshot_id incoming=%s",
                incoming_ts,
            )
            return True

    return (
        pick_newer_timestamp(incoming_ts, existing_ts) == existing_ts
        and incoming_ts != existing_ts
    )


def market_block_has_scan_data(block: dict[str, Any] | None) -> bool:
    """True when a market block looks like a completed scan (even with zero signals)."""
    if not block or not isinstance(block, dict):
        return False
    if block.get("analysisDate"):
        return True
    if block.get("universeSize"):
        return True
    if block.get("recentCount") is not None:
        return True
    return bool(block.get("recentSignals") or block.get("activeSignals"))


def merge_market_block(
    existing: dict[str, Any] | None,
    fresh: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Prefer fresh scan when it has data; keep existing if fresh scan is empty."""
    if not fresh:
        return existing
    if not existing:
        return fresh
    if market_block_has_scan_data(fresh):
        return fresh
    if market_block_has_scan_data(existing):
        return existing
    return fresh


def load_newest_snapshot(
    snapshot_id: str,
    *,
    load_disk: Callable[[], dict[str, Any] | None],
) -> dict[str, Any] | None:
    """Supabase vs Render disk — serve the newer payload."""
    global_payload = load_global_snapshot(snapshot_id)
    disk_payload = load_disk()
    return pick_newer_payload(global_payload, disk_payload)


def save_global_snapshot(
    snapshot_id: str,
    payload: dict[str, Any],
    *,
    source: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Upsert full UI payload. Skips when incoming is older than existing row."""
    client = _client()
    if client is None or not snapshot_id:
        return {
            "ok": False,
            "supabaseSaved": False,
            "skipped": True,
            "reason": "supabase_not_configured",
        }

    body = dict(payload)
    saved_at = _payload_timestamp(body)
    effective_source = source or body.get("source")

    if _is_user_scan_source(effective_source):
        force = True

    if not force:
        existing_row = _load_global_snapshot_row(snapshot_id)
        existing_payload = existing_row.get("payload") if existing_row else None
        if existing_payload and should_skip_supabase_upsert(
            incoming_source=effective_source,
            incoming_ts=saved_at,
            existing_payload=existing_payload,
            existing_row_source=existing_row.get("source") if existing_row else None,
        ):
            existing_ts = payload_timestamp(existing_payload)
            logger.info(
                "skip supabase upsert snapshot_id=%s incoming=%s existing=%s source=%s",
                snapshot_id,
                saved_at,
                existing_ts,
                effective_source,
            )
            return {
                "ok": True,
                "supabaseSaved": False,
                "skipped": True,
                "reason": "older_than_existing",
                "existingAt": existing_ts,
                "incomingAt": saved_at,
            }

    row = {
        "snapshot_id": snapshot_id,
        "payload": body,
        "source": source or body.get("source") or "snapshot",
        "saved_at": saved_at,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        client.table("stock_snapshots").upsert(row, on_conflict="snapshot_id").execute()
        return {
            "ok": True,
            "supabaseSaved": True,
            "skipped": False,
            "savedAt": saved_at,
        }
    except Exception as exc:
        logger.warning(
            "supabase upsert failed snapshot_id=%s: %s",
            snapshot_id,
            exc,
            exc_info=True,
        )
        return {
            "ok": False,
            "supabaseSaved": False,
            "skipped": False,
            "reason": str(exc),
        }


def _load_global_snapshot_row(snapshot_id: str) -> dict[str, Any] | None:
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
        return rows[0] if rows else None
    except Exception as exc:
        logger.warning("_load_global_snapshot_row failed snapshot_id=%s: %s", snapshot_id, exc)
        return None


def load_global_snapshot(snapshot_id: str) -> dict[str, Any] | None:
    row = _load_global_snapshot_row(snapshot_id)
    if not row:
        return None
    payload = row.get("payload")
    if not isinstance(payload, dict):
        return None
    out = dict(payload)
    if row.get("source"):
        out.setdefault("source", row["source"])
    if row.get("saved_at") and not out.get("savedAt"):
        out["savedAt"] = row["saved_at"]
    return out


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
                payload_timestamp(payload)
                or row.get("saved_at")
                or row.get("updated_at")
            )
            out[sid] = str(ts) if ts else None
        return out
    except Exception as exc:
        logger.warning("list_global_snapshot_meta failed: %s", exc)
        return {}


def require_save_ok(
    result: dict[str, Any],
    *,
    require_supabase: bool | None = None,
    label: str = "snapshot",
) -> None:
    """Raise RuntimeError when disk or Supabase save failed."""
    if require_supabase is None:
        require_supabase = snapshot_configured()
    if result.get("skipped") and result.get("reason") == "older_than_existing":
        return
    if not result.get("diskSaved", True):
        raise RuntimeError(f"{label}: disk save failed")
    if require_supabase and not result.get("supabaseSaved") and not result.get("skipped"):
        reason = result.get("reason") or "unknown"
        raise RuntimeError(f"{label}: supabase save failed ({reason})")


def incoming_is_newer_than_stored(
    snapshot_id: str,
    payload: dict[str, Any],
    *,
    load_disk: Callable[[], dict[str, Any] | None],
) -> bool:
    """False when payload is older than Supabase or disk copy."""
    if _is_user_scan_source(payload.get("source")):
        return True
    existing = load_newest_snapshot(snapshot_id, load_disk=load_disk)
    if not existing:
        return True
    incoming_ts = payload_timestamp(payload)
    existing_ts = payload_timestamp(existing)
    if not incoming_ts or not existing_ts:
        return True
    if (existing.get("source") or "").lower() == "user_re":
        return pick_newer_timestamp(incoming_ts, existing_ts) == incoming_ts
    return pick_newer_timestamp(incoming_ts, existing_ts) == incoming_ts
