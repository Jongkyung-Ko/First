"""Record stock strategy live scan results (Re / cron) to Supabase."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")

MARKET_KEYS = ("kospi", "kosdaq", "nasdaq", "nyse")


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
