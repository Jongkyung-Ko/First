"""Record stock strategy live scan results (Re / cron) to Supabase."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")

MARKET_KEYS = ("kospi", "kosdaq", "nasdaq", "nyse")


def payload_has_signals(payload: dict[str, Any] | None) -> bool:
    if not payload or payload.get("empty") is True:
        return False
    if int(payload.get("activeCount") or 0) > 0:
        return True
    markets = payload.get("markets") or {}
    for key in MARKET_KEYS:
        block = markets.get(key) or {}
        if int(block.get("recentCount") or 0) > 0:
            return True
        if int(block.get("activeCount") or 0) > 0:
            return True
        if (block.get("recentSignals") or []) or (block.get("activeSignals") or []):
            return True
    return bool(payload.get("recentSignals") or payload.get("activeSignals"))


def is_placeholder_payload(payload: dict[str, Any] | None) -> bool:
    if not payload:
        return True
    if payload.get("empty") is True:
        return True
    if payload.get("source") == "placeholder":
        return True
    return not payload_has_signals(payload)


def _db_row_to_signal(row: dict[str, Any]) -> dict[str, Any]:
    signal_date = str(row.get("signal_date") or "")[:10]
    close_pct = row.get("close_pct")
    close = row.get("close_price")
    day_return = row.get("day_return_pct")
    return {
        "ticker": row.get("ticker") or "",
        "name": row.get("name"),
        "signalDate": signal_date,
        "pattern": row.get("pattern"),
        "patternLabel": row.get("pattern_label"),
        "close": float(close) if close is not None else None,
        "closePct": float(close_pct) if close_pct is not None else None,
        "dayReturnPct": float(day_return) if day_return is not None else None,
        "directionMatch": row.get("direction_match"),
        "currency": row.get("currency"),
        "market": row.get("segment"),
        "up": (float(close_pct) if close_pct is not None else 0) > 0,
    }


def fetch_latest_run_payload(strategy_id: str) -> dict[str, Any] | None:
    """Rebuild UI payload from the most recent Supabase run."""
    client = _supabase_client()
    if client is None:
        return None

    from stock_strategy_engine import finalize_payload
    from stock_strategy_snapshot import STRATEGY_REGISTRY
    from stock_strategy_universes import GLOBAL_UPDATE_SCHEDULE, RECENT_DAYS, market_configs

    entry = STRATEGY_REGISTRY.get(strategy_id)
    if not entry:
        return None

    run_res = (
        client.table("stock_strategy_runs")
        .select("*")
        .eq("strategy_id", strategy_id)
        .order("run_at", desc=True)
        .limit(1)
        .execute()
    )
    if not run_res.data:
        return None
    run = run_res.data[0]
    run_id = run.get("id")
    if not run_id:
        return None

    sig_res = (
        client.table("stock_strategy_signals")
        .select("*")
        .eq("run_id", run_id)
        .execute()
    )
    rows = sig_res.data or []
    if not rows:
        return None

    run_at_raw = run.get("run_at") or ""
    try:
        run_at = datetime.fromisoformat(str(run_at_raw).replace("Z", "+00:00"))
    except ValueError:
        run_at = datetime.now(timezone.utc)
    cutoff = (run_at - timedelta(days=RECENT_DAYS)).date()
    analysis_date = str(run.get("analysis_date") or "")[:10] or None

    configs = market_configs()
    markets: dict[str, Any] = {}
    for segment in MARKET_KEYS:
        cfg = configs.get(segment) or {}
        seg_sigs = [_db_row_to_signal(r) for r in rows if r.get("segment") == segment]
        seg_sigs.sort(key=lambda s: (s.get("signalDate") or "", s.get("ticker") or ""))
        recent_signals = [
            s for s in seg_sigs if s.get("signalDate") and str(s["signalDate"]) >= str(cutoff)
        ]
        active_signals = [
            s
            for s in seg_sigs
            if analysis_date and str(s.get("signalDate")) == analysis_date
        ]
        markets[segment] = {
            "id": segment,
            "title": cfg.get("title", segment.upper()),
            "timezone": str(cfg.get("timezone", "")),
            "updateSchedule": cfg.get("updateSchedule"),
            "analysisDate": analysis_date,
            "latestSignalDate": analysis_date,
            "activeSignals": active_signals,
            "activeDisplayDate": analysis_date,
            "activeIsFallback": False,
            "recentSignals": recent_signals,
            "activeCount": len(active_signals),
            "recentCount": len(recent_signals),
            "recentDays": RECENT_DAYS,
            "matchStats": compute_match_stats(recent_signals),
            "currency": cfg.get("currency", "USD"),
        }

    meta = {
        "version": 1,
        "strategyId": strategy_id,
        "source": "latest_run",
        "savedAt": run_at_raw,
        "updatedAt": run_at_raw,
        "updatedAtNy": run.get("updated_at_ny"),
        "displayTimezone": "America/New_York",
        "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
        "universe": entry["meta"].get("universe"),
        "strategy": entry["meta"],
        "recentDays": RECENT_DAYS,
        "lastRecord": {
            "runId": str(run_id),
            "signalCount": int(run.get("signal_count") or len(rows)),
            "runAt": run_at_raw,
            "updatedAtNy": run.get("updated_at_ny"),
        },
    }
    return finalize_payload(
        markets,
        meta=meta,
        active_label=entry.get("active_label", "진입 관찰 구간"),
    )


def _supabase_client():
    from predictions import _supabase_client as client_fn

    return client_fn()


def strategy_db_configured() -> bool:
    return _supabase_client() is not None


def compute_match_stats(signals: list[dict[str, Any]]) -> dict[str, Any]:
    judged = [
        s
        for s in signals
        if s.get("directionMatch") in ("일치", "불일치")
    ]
    match = sum(1 for s in judged if s.get("directionMatch") == "일치")
    mismatch = sum(1 for s in judged if s.get("directionMatch") == "불일치")
    total = match + mismatch
    rate = round((match / total) * 100) if total else None
    return {
        "match": match,
        "mismatch": mismatch,
        "judged": total,
        "matchRatePct": rate,
        "pending": max(0, len(signals) - total),
    }


def _signal_row(
    run_id: str,
    strategy_id: str,
    segment: str,
    sig: dict[str, Any],
) -> dict[str, Any]:
    signal_date = str(sig.get("signalDate") or "")[:10]
    return {
        "run_id": run_id,
        "strategy_id": strategy_id,
        "segment": segment,
        "ticker": sig.get("ticker") or "",
        "name": sig.get("name"),
        "signal_date": signal_date,
        "pattern": sig.get("pattern"),
        "pattern_label": sig.get("patternLabel"),
        "close_price": sig.get("close"),
        "close_pct": sig.get("closePct"),
        "day_return_pct": sig.get("dayReturnPct"),
        "direction_match": sig.get("directionMatch"),
        "currency": sig.get("currency"),
    }


def _collect_all_signals(payload: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    markets = payload.get("markets") or {}
    out: list[tuple[str, dict[str, Any]]] = []
    for segment in MARKET_KEYS:
        block = markets.get(segment) or {}
        signals = block.get("allSignals")
        if not signals:
            signals = block.get("recentSignals") or []
        for sig in signals:
            out.append((segment, sig))
    return out


def record_strategy_run(
    strategy_id: str,
    payload: dict[str, Any],
    *,
    source: str = "user_re",
) -> dict[str, Any]:
    client = _supabase_client()
    if client is None:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    pairs = _collect_all_signals(payload)
    if not pairs:
        return {
            "strategyId": strategy_id,
            "source": source,
            "runId": None,
            "signalCount": 0,
            "skipped": True,
        }

    now_utc = datetime.now(timezone.utc)
    now_ny = now_utc.astimezone(NY)
    run_row = {
        "strategy_id": strategy_id,
        "run_at": now_utc.isoformat(),
        "source": source,
        "analysis_date": (payload.get("analysisDate") or "")[:10] or None,
        "active_count": int(payload.get("activeCount") or 0),
        "signal_count": len(pairs),
        "updated_at_ny": now_ny.isoformat(),
    }
    run_res = client.table("stock_strategy_runs").insert(run_row).execute()
    run_data = (run_res.data or [None])[0]
    if not run_data or not run_data.get("id"):
        raise RuntimeError("Failed to insert stock_strategy_runs row")
    run_id = str(run_data["id"])

    rows = [
        _signal_row(run_id, strategy_id, segment, sig) for segment, sig in pairs
    ]
    # Supabase upsert batch — insert in chunks
    chunk_size = 200
    for i in range(0, len(rows), chunk_size):
        client.table("stock_strategy_signals").upsert(
            rows[i : i + chunk_size],
            on_conflict="run_id,segment,ticker,signal_date,pattern",
        ).execute()

    return {
        "strategyId": strategy_id,
        "source": source,
        "runId": run_id,
        "signalCount": len(rows),
        "runAt": run_row["run_at"],
        "updatedAtNy": run_row["updated_at_ny"],
    }


def strip_all_signals_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Remove allSignals from API response to keep payload small."""
    out = dict(payload)
    markets = dict(out.get("markets") or {})
    for key, block in markets.items():
        if isinstance(block, dict) and "allSignals" in block:
            slim = dict(block)
            del slim["allSignals"]
            markets[key] = slim
    out["markets"] = markets
    return out
