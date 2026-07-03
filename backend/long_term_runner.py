"""Long-term screens — chunk runner, snapshot, recommendation history."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from long_term_screens import (
    HISTORY_LIMIT,
    LONG_TERM_META,
    MARKET_ORDER,
    RANKERS,
    SNAPSHOT_ID,
    STRATEGIES,
    STRATEGY_ORDER,
    scan_chunk,
    _universe_for,
)
from stock_snapshot_store import load_global_snapshot, save_global_snapshot


def _empty_market_block() -> dict[str, Any]:
    return {"rows": [], "picks": [], "offset": 0, "complete": False}


def _empty_payload() -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "version": 1,
        "strategyId": SNAPSHOT_ID,
        "source": "snapshot",
        "savedAt": now,
        "updatedAt": now,
        "strategy": LONG_TERM_META,
        "strategies": {
            sid: {
                "meta": STRATEGIES[sid],
                "markets": {m: _empty_market_block() for m in MARKET_ORDER},
            }
            for sid in STRATEGY_ORDER
        },
        "scanCursor": {
            "strategyId": STRATEGY_ORDER[0],
            "market": MARKET_ORDER[0],
            "offset": 0,
        },
        "lastChunkAt": None,
    }


def load_payload() -> dict[str, Any]:
    data = load_global_snapshot(SNAPSHOT_ID)
    if data and data.get("strategies"):
        return data
    return _empty_payload()


def save_payload(payload: dict[str, Any]) -> None:
    payload = dict(payload)
    now = datetime.now(timezone.utc).isoformat()
    payload["updatedAt"] = now
    payload.setdefault("savedAt", now)
    save_global_snapshot(SNAPSHOT_ID, payload, source=payload.get("source", "snapshot"))


def _advance_cursor(strategy_id: str, market: str, offset: int, limit: int) -> tuple[str, str, int]:
    universe = _universe_for(strategy_id, market)
    next_offset = offset + limit
    if next_offset < len(universe):
        return strategy_id, market, next_offset

    try:
        mi = MARKET_ORDER.index(market)
    except ValueError:
        mi = -1
    if mi + 1 < len(MARKET_ORDER):
        return strategy_id, MARKET_ORDER[mi + 1], 0

    try:
        si = STRATEGY_ORDER.index(strategy_id)
    except ValueError:
        si = -1
    if si + 1 < len(STRATEGY_ORDER):
        return STRATEGY_ORDER[si + 1], MARKET_ORDER[0], 0
    return STRATEGY_ORDER[0], MARKET_ORDER[0], 0


def _merge_rows(existing: list[dict[str, Any]], fresh: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_ticker = {r["ticker"]: r for r in existing if r.get("ticker")}
    for row in fresh:
        if row.get("ticker"):
            by_ticker[row["ticker"]] = row
    return list(by_ticker.values())


def _history_client():
    from predictions import _supabase_client

    return _supabase_client()


def fetch_history(limit: int = HISTORY_LIMIT) -> list[dict[str, Any]]:
    client = _history_client()
    if client is None:
        return []
    try:
        res = (
            client.table("long_term_recommendation_history")
            .select("*")
            .order("recommended_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [
            {
                "id": row.get("id"),
                "recommendedAt": row.get("recommended_at"),
                "strategyId": row.get("strategy_id"),
                "strategyLabel": row.get("strategy_label"),
                "market": row.get("market"),
                "ticker": row.get("ticker"),
                "name": row.get("name"),
                "price": row.get("price"),
                "metricLabel": row.get("metric_label"),
                "metricValue": row.get("metric_value"),
            }
            for row in (res.data or [])
        ]
    except Exception:
        return []


def _trim_history(client) -> None:
    try:
        res = (
            client.table("long_term_recommendation_history")
            .select("id")
            .order("recommended_at", desc=True)
            .execute()
        )
        ids = [r["id"] for r in (res.data or [])]
        if len(ids) <= HISTORY_LIMIT:
            return
        to_delete = ids[HISTORY_LIMIT:]
        for i in range(0, len(to_delete), 50):
            chunk = to_delete[i : i + 50]
            client.table("long_term_recommendation_history").delete().in_("id", chunk).execute()
    except Exception:
        pass


def append_history_entries(entries: list[dict[str, Any]]) -> int:
    client = _history_client()
    if client is None or not entries:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        {
            "recommended_at": e.get("recommendedAt") or now,
            "strategy_id": e.get("strategyId"),
            "strategy_label": e.get("strategyLabel"),
            "market": e.get("market"),
            "ticker": e.get("ticker"),
            "name": e.get("name"),
            "price": e.get("price"),
            "metric_label": e.get("metricLabel"),
            "metric_value": e.get("metricValue"),
        }
        for e in entries
    ]
    try:
        client.table("long_term_recommendation_history").insert(rows).execute()
        _trim_history(client)
        return len(rows)
    except Exception:
        return 0


def _history_from_picks(strategy_id: str, market: str, picks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    spec = STRATEGIES[strategy_id]
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "recommendedAt": now,
            "strategyId": strategy_id,
            "strategyLabel": spec["label"],
            "market": market,
            "ticker": pick.get("ticker"),
            "name": pick.get("name"),
            "price": pick.get("price"),
            "metricLabel": spec.get("metricLabel"),
            "metricValue": pick.get("metricDisplay") or str(pick.get("metricValue")),
        }
        for pick in picks
    ]


def _reset_all_markets(payload: dict[str, Any]) -> None:
    for sid in STRATEGY_ORDER:
        for m in MARKET_ORDER:
            payload["strategies"][sid]["markets"][m] = _empty_market_block()


def run_next_chunk() -> dict[str, Any]:
    payload = load_payload()
    cursor = dict(payload.get("scanCursor") or {})
    strategy_id = cursor.get("strategyId") or STRATEGY_ORDER[0]
    market = cursor.get("market") or MARKET_ORDER[0]
    offset = int(cursor.get("offset") or 0)
    spec = STRATEGIES[strategy_id]
    limit = int(spec["chunkSize"])

    chunk_result = scan_chunk(strategy_id, market, offset, limit)
    strat_block = payload["strategies"].setdefault(
        strategy_id, {"meta": spec, "markets": {m: _empty_market_block() for m in MARKET_ORDER}}
    )
    market_block = strat_block["markets"].setdefault(market, _empty_market_block())
    market_block["rows"] = _merge_rows(market_block.get("rows") or [], chunk_result.get("rows") or [])
    market_block["offset"] = offset + chunk_result.get("chunkSize", 0)
    market_block["lastChunkAt"] = chunk_result.get("scannedAt")
    market_block["errorCount"] = len(chunk_result.get("errors") or [])

    universe_size = chunk_result.get("universeSize") or 0
    completed_market = market_block["offset"] >= universe_size and universe_size > 0
    history_added = 0

    if completed_market and not market_block.get("complete"):
        picks = RANKERS[strategy_id](market_block["rows"])
        market_block["picks"] = picks
        market_block["complete"] = True
        market_block["completedAt"] = datetime.now(timezone.utc).isoformat()
        history_added = append_history_entries(_history_from_picks(strategy_id, market, picks))

    next_sid, next_market, next_offset = _advance_cursor(strategy_id, market, offset, limit)

    if (
        next_sid == STRATEGY_ORDER[0]
        and next_market == MARKET_ORDER[0]
        and next_offset == 0
        and not (strategy_id == STRATEGY_ORDER[0] and market == MARKET_ORDER[0] and offset == 0)
    ):
        _reset_all_markets(payload)

    payload["scanCursor"] = {
        "strategyId": next_sid,
        "market": next_market,
        "offset": next_offset,
    }
    payload["lastChunkAt"] = datetime.now(timezone.utc).isoformat()
    payload["source"] = "chunk"
    save_payload(payload)

    return {
        "ok": True,
        "chunk": {
            "strategyId": strategy_id,
            "market": market,
            "offset": offset,
            "chunkSize": chunk_result.get("chunkSize"),
            "rowsAdded": len(chunk_result.get("rows") or []),
            "errors": chunk_result.get("errors"),
        },
        "completedMarket": completed_market,
        "historyAdded": history_added,
        "nextCursor": payload["scanCursor"],
        "picksCount": len(market_block.get("picks") or []) if completed_market else 0,
    }


def get_public_payload() -> dict[str, Any]:
    payload = deepcopy(load_payload())
    payload["history"] = fetch_history(HISTORY_LIMIT)
    payload["source"] = payload.get("source") or "global_snapshot"
    return payload
