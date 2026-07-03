"""Long-term screens — chunk runner, snapshot, recommendation history."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from long_term_screens import (
    HISTORY_LIMIT,
    LONG_TERM_META,
    MARKET_ORDER,
    PICKS_TOP_N,
    RANKERS,
    SNAPSHOT_ID,
    STRATEGIES,
    STRATEGY_ORDER,
    build_strategy_top100,
    picks_top_n,
    scan_chunk,
    _universe_for,
)
from recommendation_history import (
    append_history_entries,
    clear_all_recommendation_history,
    compute_history_summary,
    fetch_current_closes,
    fetch_history_enriched,
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


def _advance_cursor(payload: dict[str, Any], strategy_id: str, market: str) -> tuple[str, str, int]:
    """시장 내 전략을 번갈아 스캔 — 소형·저PBR만 먼저 쌓이지 않도록."""
    try:
        si = STRATEGY_ORDER.index(strategy_id)
    except ValueError:
        si = 0
    for j in range(1, len(STRATEGY_ORDER) + 1):
        next_sid = STRATEGY_ORDER[(si + j) % len(STRATEGY_ORDER)]
        mb = payload["strategies"].setdefault(next_sid, {"meta": STRATEGIES[next_sid], "markets": {}})[
            "markets"
        ].setdefault(market, _empty_market_block())
        universe = len(_universe_for(next_sid, market))
        if universe > 0 and int(mb.get("offset") or 0) < universe:
            return next_sid, market, int(mb.get("offset") or 0)

    try:
        mi = MARKET_ORDER.index(market)
    except ValueError:
        mi = 0
    for k in range(1, len(MARKET_ORDER) + 1):
        next_market = MARKET_ORDER[(mi + k) % len(MARKET_ORDER)]
        for sid in STRATEGY_ORDER:
            mb = payload["strategies"].setdefault(sid, {"meta": STRATEGIES[sid], "markets": {}})[
                "markets"
            ].setdefault(next_market, _empty_market_block())
            universe = len(_universe_for(sid, next_market))
            if universe > 0 and int(mb.get("offset") or 0) < universe:
                return sid, next_market, int(mb.get("offset") or 0)
    return STRATEGY_ORDER[0], MARKET_ORDER[0], 0


def _cycle_complete(payload: dict[str, Any]) -> bool:
    for sid in STRATEGY_ORDER:
        for market in MARKET_ORDER:
            mb = (payload.get("strategies") or {}).get(sid, {}).get("markets", {}).get(market) or {}
            universe = len(_universe_for(sid, market))
            if universe > 0 and int(mb.get("offset") or 0) < universe:
                return False
    return True


def _merge_rows(existing: list[dict[str, Any]], fresh: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_ticker = {r["ticker"]: r for r in existing if r.get("ticker")}
    for row in fresh:
        if row.get("ticker"):
            by_ticker[row["ticker"]] = row
    return list(by_ticker.values())


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
            "rank": pick.get("rank"),
        }
        for pick in picks
    ]


def _refresh_market_picks(strategy_id: str, market_block: dict[str, Any], universe_size: int) -> None:
    rows = market_block.get("rows") or []
    picks = RANKERS[strategy_id](rows) if rows else []
    market_block["picks"] = picks
    market_block["pickCount"] = len(picks)
    market_block["pickLimit"] = picks_top_n(strategy_id)
    if universe_size > 0 and picks:
        market_block["recommendRatePct"] = round(len(picks) / universe_size * 100, 2)
    else:
        market_block["recommendRatePct"] = 0.0


def _reset_all_markets(payload: dict[str, Any]) -> None:
    for sid in STRATEGY_ORDER:
        for m in MARKET_ORDER:
            payload["strategies"][sid]["markets"][m] = _empty_market_block()


def trim_picks_and_clear_history() -> dict[str, Any]:
    """시장·전략별 picks TOP 2로 자르고 누적 추천 이력 전부 삭제."""
    payload = load_payload()
    trimmed = 0
    strategies = payload.get("strategies") or {}
    for sid in STRATEGY_ORDER:
        universe = int(STRATEGIES[sid]["universeLimit"])
        markets = (strategies.get(sid) or {}).get("markets") or {}
        for market_id in MARKET_ORDER:
            mb = markets.get(market_id)
            if not isinstance(mb, dict):
                continue
            before = len(mb.get("picks") or [])
            if mb.get("rows"):
                _refresh_market_picks(sid, mb, universe)
            else:
                mb["picks"] = (mb.get("picks") or [])[:PICKS_TOP_N]
                mb["pickCount"] = len(mb["picks"])
                mb["pickLimit"] = PICKS_TOP_N
                mb["recommendRatePct"] = (
                    round(len(mb["picks"]) / universe * 100, 2) if universe and mb["picks"] else 0.0
                )
            after = len(mb.get("picks") or [])
            if before > after:
                trimmed += before - after
    payload["source"] = "trim"
    save_payload(payload)
    history_deleted = clear_all_recommendation_history()
    return {
        "ok": True,
        "trimmedPickRows": trimmed,
        "historyDeleted": history_deleted,
        "pickLimitPerMarket": PICKS_TOP_N,
    }


def _process_single_chunk(
    payload: dict[str, Any],
    strategy_id: str,
    market: str,
    offset: int,
) -> tuple[dict[str, Any], dict[str, Any], bool, int]:
    """청크 1회 적용. (chunk_result, market_block, completed_market, history_added)"""
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
    _refresh_market_picks(strategy_id, market_block, universe_size)
    completed_market = market_block["offset"] >= universe_size and universe_size > 0
    history_added = 0

    if completed_market and not market_block.get("complete"):
        picks = market_block.get("picks") or []
        market_block["complete"] = True
        market_block["completedAt"] = datetime.now(timezone.utc).isoformat()
        if picks:
            history_added = append_history_entries(_history_from_picks(strategy_id, market, picks))

    return chunk_result, market_block, completed_market, history_added


def bootstrap_strategy_market(payload: dict[str, Any], strategy_id: str, market: str) -> dict[str, Any]:
    """한 전략·시장 유니버스를 끝까지 스캔해 TOP 2 picks 확보."""
    spec = STRATEGIES[strategy_id]
    universe_size = len(_universe_for(strategy_id, market))
    if universe_size <= 0:
        return {"strategyId": strategy_id, "market": market, "chunksRun": 0, "picksCount": 0, "skipped": True}

    strat_block = payload["strategies"].setdefault(
        strategy_id, {"meta": spec, "markets": {m: _empty_market_block() for m in MARKET_ORDER}}
    )
    market_block = strat_block["markets"].setdefault(market, _empty_market_block())
    if len(market_block.get("picks") or []) >= PICKS_TOP_N and market_block.get("complete"):
        return {
            "strategyId": strategy_id,
            "market": market,
            "chunksRun": 0,
            "picksCount": len(market_block.get("picks") or []),
            "skipped": True,
        }

    chunks_run = 0
    history_added = 0
    while int(market_block.get("offset") or 0) < universe_size:
        offset = int(market_block.get("offset") or 0)
        _, market_block, _, added = _process_single_chunk(payload, strategy_id, market, offset)
        history_added += added
        chunks_run += 1

    return {
        "strategyId": strategy_id,
        "market": market,
        "chunksRun": chunks_run,
        "picksCount": len(market_block.get("picks") or []),
        "historyAdded": history_added,
    }


def _markets_with_small_cap_picks(payload: dict[str, Any]) -> tuple[str, ...]:
    markets: list[str] = []
    sc_markets = (payload.get("strategies") or {}).get("small-cap-pbr", {}).get("markets") or {}
    for market in MARKET_ORDER:
        if len((sc_markets.get(market) or {}).get("picks") or []) > 0:
            markets.append(market)
    return tuple(markets) if markets else MARKET_ORDER


def run_bootstrap_gaps(markets: tuple[str, ...] | None = None) -> dict[str, Any]:
    """마법공식·F-스코어 picks 부족 시장을 즉시 풀스캔."""
    payload = load_payload()
    target_markets = markets or _markets_with_small_cap_picks(payload)
    results: list[dict[str, Any]] = []
    for sid in ("magic-formula", "f-score"):
        for market in target_markets:
            if market not in MARKET_ORDER:
                continue
            mb = (
                (payload.get("strategies") or {})
                .get(sid, {})
                .get("markets", {})
                .get(market, {})
            )
            if len(mb.get("picks") or []) >= PICKS_TOP_N:
                results.append(
                    {
                        "strategyId": sid,
                        "market": market,
                        "chunksRun": 0,
                        "picksCount": len(mb.get("picks") or []),
                        "skipped": True,
                    }
                )
                continue
            results.append(bootstrap_strategy_market(payload, sid, market))

    payload["lastChunkAt"] = datetime.now(timezone.utc).isoformat()
    payload["source"] = "bootstrap"
    save_payload(payload)
    return {"ok": True, "bootstrapped": results, "pickLimit": PICKS_TOP_N, "markets": list(target_markets)}


def run_next_chunk() -> dict[str, Any]:
    payload = load_payload()
    cursor = dict(payload.get("scanCursor") or {})
    strategy_id = cursor.get("strategyId") or STRATEGY_ORDER[0]
    market = cursor.get("market") or MARKET_ORDER[0]
    offset = int(cursor.get("offset") or 0)

    chunk_result, market_block, completed_market, history_added = _process_single_chunk(
        payload, strategy_id, market, offset
    )

    next_sid, next_market, next_offset = _advance_cursor(payload, strategy_id, market)

    if (
        next_sid == STRATEGY_ORDER[0]
        and next_market == MARKET_ORDER[0]
        and next_offset == 0
        and _cycle_complete(payload)
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
        "picksCount": len(market_block.get("picks") or []),
        "recommendRatePct": market_block.get("recommendRatePct"),
    }


def _four_market_picks_summary(strat_block: dict[str, Any]) -> dict[str, Any]:
    picks: list[dict[str, Any]] = []
    markets = strat_block.get("markets") or {}
    for market_id in MARKET_ORDER:
        mb = markets.get(market_id) or {}
        for pick in mb.get("picks") or []:
            picks.append({**pick, "market": market_id})
    if not picks:
        return {"up": 0, "down": 0, "flat": 0, "total": 0, "matchRatePct": None, "avgReturnPct": None}
    tickers = [p.get("ticker") for p in picks if p.get("ticker")]
    closes = fetch_current_closes(tickers)
    enriched: list[dict[str, Any]] = []
    for pick in picks:
        rec_price = pick.get("price")
        ticker = pick.get("ticker")
        current = closes.get(ticker) if ticker else None
        return_pct = None
        try:
            if rec_price is not None and current is not None and float(rec_price) > 0:
                return_pct = round(
                    (float(current) - float(rec_price)) / float(rec_price) * 100,
                    2,
                )
        except (TypeError, ValueError):
            return_pct = None
        enriched.append({**pick, "currentClose": current, "returnPct": return_pct})
    return compute_history_summary(enriched)


def get_public_payload() -> dict[str, Any]:
    payload = deepcopy(load_payload())
    strategies = payload.get("strategies")
    if isinstance(strategies, dict):
        for sid in STRATEGY_ORDER:
            strat_block = strategies.get(sid) or {}
            universe = int(STRATEGIES[sid]["universeLimit"])
            markets = strat_block.get("markets") or {}
            for market_id in MARKET_ORDER:
                market_block = markets.get(market_id)
                if not isinstance(market_block, dict):
                    continue
                if market_block.get("rows"):
                    _refresh_market_picks(sid, market_block, universe)
                market_block.pop("rows", None)
            strat_block["top100"] = build_strategy_top100(sid, strat_block)
            strat_block["fourMarketSummary"] = _four_market_picks_summary(strat_block)
    history, summary = fetch_history_enriched(limit=HISTORY_LIMIT)
    payload["history"] = history
    payload["historySummary"] = summary
    payload["source"] = payload.get("source") or "global_snapshot"
    return payload
