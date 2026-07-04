"""Shared recommendation history — Supabase store, return enrichment, summary stats."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

HISTORY_LIMIT = 100

FUNDAMENTALS_STRATEGY_IDS = (
    "fundamentals-per",
    "fundamentals-roe",
    "fundamentals-pbr",
    "fundamentals-dividend",
)


def _client():
    from predictions import _supabase_client

    return _supabase_client()


def fetch_history(limit: int = HISTORY_LIMIT, strategy_id: str | None = None) -> list[dict[str, Any]]:
    client = _client()
    if client is None:
        return []
    try:
        query = (
            client.table("long_term_recommendation_history")
            .select("*")
            .order("recommended_at", desc=True)
            .limit(limit)
        )
        if strategy_id:
            query = query.eq("strategy_id", strategy_id)
        res = query.execute()
        return [_row_from_db(row) for row in (res.data or [])]
    except Exception:
        return []


def _row_from_db(row: dict[str, Any]) -> dict[str, Any]:
    return {
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
        "rank": row.get("rank"),
        "repeatCount": int(row.get("repeat_count") or 1),
    }


def _trim_strategy_history(client, strategy_id: str, limit: int = HISTORY_LIMIT) -> None:
    try:
        res = (
            client.table("long_term_recommendation_history")
            .select("id")
            .eq("strategy_id", strategy_id)
            .order("recommended_at", desc=True)
            .execute()
        )
        ids = [r["id"] for r in (res.data or [])]
        if len(ids) <= limit:
            return
        to_delete = ids[limit:]
        for i in range(0, len(to_delete), 50):
            chunk = to_delete[i : i + 50]
            client.table("long_term_recommendation_history").delete().in_("id", chunk).execute()
    except Exception:
        pass


def _trim_history(client) -> None:
    """Legacy global trim — kept for safety; prefer _trim_strategy_history."""
    try:
        res = (
            client.table("long_term_recommendation_history")
            .select("id,strategy_id")
            .order("recommended_at", desc=True)
            .execute()
        )
        rows = res.data or []
        if len(rows) <= HISTORY_LIMIT:
            return
        by_strategy: dict[str, list[str]] = {}
        for row in rows:
            sid = str(row.get("strategy_id") or "")
            by_strategy.setdefault(sid, []).append(row["id"])
        for sid, ids in by_strategy.items():
            if len(ids) > HISTORY_LIMIT:
                _trim_strategy_history(client, sid, HISTORY_LIMIT)
    except Exception:
        pass


def append_history_entries(entries: list[dict[str, Any]]) -> int:
    client = _client()
    if client is None or not entries:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    inserted = 0
    try:
        for e in entries:
            strategy_id = e.get("strategyId")
            ticker = e.get("ticker")
            market = e.get("market")
            if not strategy_id or not ticker:
                continue
            query = (
                client.table("long_term_recommendation_history")
                .select("id,recommended_at,price,repeat_count")
                .eq("strategy_id", strategy_id)
                .eq("ticker", ticker)
            )
            if market:
                query = query.eq("market", market)
            existing = query.limit(1).execute()
            if existing.data:
                row = existing.data[0]
                repeat = int(row.get("repeat_count") or 1) + 1
                update_payload = {
                    "repeat_count": repeat,
                    "metric_label": e.get("metricLabel"),
                    "metric_value": e.get("metricValue"),
                    "rank": e.get("rank"),
                    "market": e.get("market"),
                    "name": e.get("name"),
                }
                try:
                    client.table("long_term_recommendation_history").update(update_payload).eq(
                        "id", row["id"]
                    ).execute()
                except Exception:
                    update_payload.pop("repeat_count", None)
                    client.table("long_term_recommendation_history").update(update_payload).eq(
                        "id", row["id"]
                    ).execute()
                inserted += 1
                continue

            row = {
                "recommended_at": e.get("recommendedAt") or now,
                "strategy_id": strategy_id,
                "strategy_label": e.get("strategyLabel"),
                "market": e.get("market"),
                "ticker": ticker,
                "name": e.get("name"),
                "price": e.get("price"),
                "metric_label": e.get("metricLabel"),
                "metric_value": e.get("metricValue"),
                "rank": e.get("rank"),
                "repeat_count": int(e.get("repeatCount") or 1),
            }
            try:
                client.table("long_term_recommendation_history").insert(row).execute()
            except Exception:
                row.pop("repeat_count", None)
                row.pop("rank", None)
                client.table("long_term_recommendation_history").insert(row).execute()
            inserted += 1
        touched: set[str] = set()
        for e in entries:
            sid = e.get("strategyId")
            if sid:
                touched.add(str(sid))
        for sid in touched:
            _trim_strategy_history(client, sid)
        return inserted
    except Exception:
        return 0


def clear_all_recommendation_history() -> int:
    client = _client()
    if client is None:
        return 0
    deleted = 0
    try:
        while True:
            res = (
                client.table("long_term_recommendation_history")
                .select("id")
                .limit(100)
                .execute()
            )
            ids = [r["id"] for r in (res.data or []) if r.get("id")]
            if not ids:
                break
            client.table("long_term_recommendation_history").delete().in_("id", ids).execute()
            deleted += len(ids)
    except Exception:
        pass
    return deleted


def _fetch_one_close(ticker: str) -> tuple[str, float | None]:
    try:
        import yfinance as yf

        info = yf.Ticker(ticker).info or {}
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        if price is None:
            return ticker, None
        return ticker, float(price)
    except Exception:
        return ticker, None


def fetch_current_closes(tickers: list[str], *, max_workers: int = 8) -> dict[str, float]:
    unique = [t for t in dict.fromkeys(tickers) if t]
    if not unique:
        return {}
    out: dict[str, float] = {}
    workers = min(max_workers, max(1, len(unique)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_fetch_one_close, t): t for t in unique}
        for future in as_completed(futures):
            try:
                ticker, price = future.result()
                if price is not None:
                    out[ticker] = price
            except Exception:
                continue
    return out


def compute_history_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    valid = [r for r in rows if r.get("returnPct") is not None]
    up = sum(1 for r in valid if float(r["returnPct"]) > 0)
    down = sum(1 for r in valid if float(r["returnPct"]) < 0)
    flat = sum(1 for r in valid if float(r["returnPct"]) == 0)
    total = len(valid)
    match_rate = round(up / total * 100, 1) if total else None
    avg_return = round(sum(float(r["returnPct"]) for r in valid) / total, 2) if total else None
    return {
        "up": up,
        "down": down,
        "flat": flat,
        "total": total,
        "matchRatePct": match_rate,
        "avgReturnPct": avg_return,
    }


def enrich_history_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tickers = [r.get("ticker") for r in rows if r.get("ticker")]
    closes = fetch_current_closes(tickers)
    enriched: list[dict[str, Any]] = []
    for row in rows:
        rec_price = row.get("price")
        ticker = row.get("ticker")
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
        enriched.append(
            {
                **row,
                "currentClose": round(current, 2) if current is not None else None,
                "returnPct": return_pct,
            }
        )
    return enriched


def fetch_history_enriched(
    *,
    limit: int = HISTORY_LIMIT,
    strategy_id: str | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rows = enrich_history_rows(fetch_history(limit, strategy_id))
    return rows, compute_history_summary(rows)


def fetch_fundamentals_history_enriched(
    *,
    limit: int = HISTORY_LIMIT,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    for strategy_id in FUNDAMENTALS_STRATEGY_IDS:
        merged.extend(enrich_history_rows(fetch_history(limit, strategy_id)))
    merged.sort(
        key=lambda row: str(row.get("recommendedAt") or ""),
        reverse=True,
    )
    return merged, compute_history_summary(merged)


def sync_missing_fundamentals_history(markets: dict[str, Any]) -> int:
    """Snapshot TOP N → DB (없는 종목만 insert, repeat_count 증가 없음)."""
    from fundamentals_universes import FUNDAMENTALS_TOP_N
    from stock_fundamentals import METRIC_DEFS

    client = _client()
    if client is None or not markets:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    inserted = 0
    touched: set[str] = set()
    try:
        for market_id, block in markets.items():
            if not isinstance(block, dict) or not block.get("fundamentalsReady"):
                continue
            rankings = block.get("rankings") or {}
            for metric_key, spec in METRIC_DEFS.items():
                strategy_id = f"fundamentals-{metric_key}"
                raw_items = (rankings.get(metric_key) or {}).get("items") or []
                for item in raw_items[:FUNDAMENTALS_TOP_N]:
                    ticker = item.get("ticker")
                    if not ticker:
                        continue
                    existing = (
                        client.table("long_term_recommendation_history")
                        .select("id")
                        .eq("strategy_id", strategy_id)
                        .eq("ticker", ticker)
                        .eq("market", market_id)
                        .limit(1)
                        .execute()
                    )
                    if existing.data:
                        continue
                    row = {
                        "recommended_at": now,
                        "strategy_id": strategy_id,
                        "strategy_label": spec["label"],
                        "market": market_id,
                        "ticker": ticker,
                        "name": item.get("name"),
                        "price": item.get("price"),
                        "metric_label": spec["label"],
                        "metric_value": item.get("displayValue") or str(item.get("value")),
                        "rank": item.get("rank"),
                        "repeat_count": 1,
                    }
                    try:
                        client.table("long_term_recommendation_history").insert(row).execute()
                    except Exception:
                        row.pop("repeat_count", None)
                        row.pop("rank", None)
                        client.table("long_term_recommendation_history").insert(row).execute()
                    inserted += 1
                    touched.add(strategy_id)
        for sid in touched:
            _trim_strategy_history(client, sid)
        return inserted
    except Exception:
        return inserted


def append_fundamentals_market_history(market_id: str, market_block: dict[str, Any]) -> int:
    from fundamentals_universes import FUNDAMENTALS_TOP_N
    from stock_fundamentals import METRIC_DEFS

    if not market_block.get("fundamentalsReady"):
        return 0
    now = datetime.now(timezone.utc).isoformat()
    rankings = market_block.get("rankings") or {}
    entries: list[dict[str, Any]] = []
    for metric_key, spec in METRIC_DEFS.items():
        strategy_id = f"fundamentals-{metric_key}"
        raw_items = (rankings.get(metric_key) or {}).get("items") or []
        items = raw_items[:FUNDAMENTALS_TOP_N]
        for item in items:
            rank = item.get("rank")
            if rank is not None and int(rank) > FUNDAMENTALS_TOP_N:
                continue
            entries.append(
                {
                    "recommendedAt": now,
                    "strategyId": strategy_id,
                    "strategyLabel": spec["label"],
                    "market": market_id,
                    "ticker": item.get("ticker"),
                    "name": item.get("name"),
                    "price": item.get("price"),
                    "metricLabel": spec["label"],
                    "metricValue": item.get("displayValue") or str(item.get("value")),
                    "rank": rank,
                }
            )
    return append_history_entries(entries)
