"""Stock pick prediction recording and accuracy evaluation (Supabase)."""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import yfinance as yf

KR_TZ = ZoneInfo("Asia/Seoul")
US_TZ = ZoneInfo("America/New_York")

MARKET_GROUPS: dict[str, list[str]] = {
    "kr": ["kr_kospi", "kr_kosdaq"],
    "us": ["us"],
}

MARKET_TIMEZONES: dict[str, ZoneInfo] = {
    "kr_kospi": KR_TZ,
    "kr_kosdaq": KR_TZ,
    "us": US_TZ,
}

WATCH_BAND_PCT = 0.5
BACKFILL_LABEL = "—"


def _supabase_client():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        return None
    try:
        from supabase import create_client

        return create_client(url, key)
    except Exception:
        return None


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


def market_trade_date(market_id: str, when: datetime | None = None) -> date:
    tz = MARKET_TIMEZONES.get(market_id, timezone.utc)
    return (when or datetime.now(tz)).date()


def evaluate_prediction(stance: str, change_pct: float | None) -> bool | None:
    if change_pct is None:
        return None
    if stance == "watch":
        return abs(change_pct) <= WATCH_BAND_PCT
    if stance == "recommend":
        return change_pct > WATCH_BAND_PCT
    if stance == "caution":
        return change_pct < -WATCH_BAND_PCT
    return None


def _closes_for_ticker(ticker: str, trade_date: date) -> tuple[float | None, float | None, float | None]:
    start = trade_date - timedelta(days=12)
    end = trade_date + timedelta(days=1)
    try:
        hist = yf.Ticker(ticker).history(
            start=start.isoformat(),
            end=end.isoformat(),
            interval="1d",
            auto_adjust=False,
        )
    except Exception:
        return None, None, None

    if hist is None or hist.empty:
        return None, None, None

    rows: list[tuple[date, float]] = []
    for idx, row in hist.iterrows():
        close = _safe_float(row.get("Close"))
        if close is None:
            continue
        day = idx.date() if hasattr(idx, "date") else trade_date
        rows.append((day, close))

    rows.sort(key=lambda item: item[0])
    close_today = None
    prev_close = None
    for i, (day, close) in enumerate(rows):
        if day == trade_date:
            close_today = close
            if i > 0:
                prev_close = rows[i - 1][1]
            break

    if close_today is None or prev_close is None or prev_close == 0:
        return close_today, prev_close, None

    change_pct = round((close_today / prev_close - 1) * 100, 2)
    return close_today, prev_close, change_pct


def _daily_closes_series(
    ticker: str,
    end_date: date,
    trading_days: int = 30,
) -> list[dict[str, Any]]:
    start = end_date - timedelta(days=trading_days * 2 + 20)
    try:
        hist = yf.Ticker(ticker).history(
            start=start.isoformat(),
            end=(end_date + timedelta(days=1)).isoformat(),
            interval="1d",
            auto_adjust=False,
        )
    except Exception:
        return []

    if hist is None or hist.empty:
        return []

    closes: list[tuple[date, float]] = []
    for idx, row in hist.iterrows():
        close = _safe_float(row.get("Close"))
        if close is None:
            continue
        day = idx.date() if hasattr(idx, "date") else None
        if day is None or day > end_date:
            continue
        closes.append((day, close))

    closes.sort(key=lambda item: item[0])
    series: list[dict[str, Any]] = []
    for index, (day, close) in enumerate(closes):
        prev_close = closes[index - 1][1] if index > 0 else None
        change_pct = None
        if prev_close is not None and prev_close != 0:
            change_pct = round((close / prev_close - 1) * 100, 2)
        series.append(
            {
                "trade_date": day,
                "close_price": close,
                "prev_close": prev_close,
                "change_pct": change_pct,
            }
        )

    return series[-trading_days:]


def _existing_prediction_dates(
    client,
    market_id: str,
    ticker: str,
    cutoff: date,
) -> set[str]:
    response = (
        client.table("stock_pick_predictions")
        .select("trade_date,recommend_label")
        .eq("market", market_id)
        .eq("ticker", ticker)
        .gte("trade_date", cutoff.isoformat())
        .neq("recommend_label", BACKFILL_LABEL)
        .execute()
    )
    return {str(row["trade_date"])[:10] for row in (response.data or [])}


def backfill_market_closes(
    market_id: str,
    picks: list[dict[str, Any]],
    days: int = 30,
) -> dict[str, Any]:
    client = _supabase_client()
    if client is None:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    tz = MARKET_TIMEZONES[market_id]
    end_date = market_trade_date(market_id)
    cutoff = end_date - timedelta(days=days + 5)
    rows: list[dict[str, Any]] = []

    for item in picks:
        ticker = item["ticker"]
        name = item.get("name")
        protected_dates = _existing_prediction_dates(client, market_id, ticker, cutoff)
        for day_row in _daily_closes_series(ticker, end_date, days):
            trade_day = day_row["trade_date"]
            trade_key = trade_day.isoformat()
            if trade_key in protected_dates:
                continue
            predicted_at = (
                datetime.combine(trade_day, datetime.min.time(), tzinfo=tz)
                .astimezone(timezone.utc)
                .isoformat()
            )
            rows.append(
                {
                    "trade_date": trade_key,
                    "market": market_id,
                    "ticker": ticker,
                    "name": name,
                    "score": 0,
                    "recommend_label": BACKFILL_LABEL,
                    "stance": "watch",
                    "predicted_at": predicted_at,
                    "close_price": day_row["close_price"],
                    "prev_close": day_row["prev_close"],
                    "change_pct": day_row["change_pct"],
                    "matched": None,
                    "finalized_at": None,
                }
            )

    if not rows:
        return {
            "market": market_id,
            "trade_date": end_date.isoformat(),
            "days": days,
            "count": 0,
        }

    chunk_size = 200
    for offset in range(0, len(rows), chunk_size):
        client.table("stock_pick_predictions").upsert(
            rows[offset : offset + chunk_size],
            on_conflict="trade_date,market,ticker",
        ).execute()

    return {
        "market": market_id,
        "trade_date": end_date.isoformat(),
        "days": days,
        "count": len(rows),
        "tickers": len(picks),
    }


def backfill_closes_for_group(
    group: str,
    collect_market_fn,
    days: int = 30,
) -> dict[str, Any]:
    if group == "all":
        market_ids = ["kr_kospi", "kr_kosdaq", "us"]
    else:
        market_ids = MARKET_GROUPS.get(group, [])

    results = []
    for market_id in market_ids:
        payload = collect_market_fn(market_id)
        picks = payload.get("items") or []
        results.append(backfill_market_closes(market_id, picks, days))

    return {"group": group, "days": days, "markets": results}


def record_market_predictions(market_id: str, picks: list[dict[str, Any]]) -> dict[str, Any]:
    client = _supabase_client()
    if client is None:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    trade_day = market_trade_date(market_id)
    predicted_at = datetime.now(MARKET_TIMEZONES[market_id]).astimezone(timezone.utc).isoformat()
    rows = []
    for item in picks:
        rows.append(
            {
                "trade_date": trade_day.isoformat(),
                "market": market_id,
                "ticker": item["ticker"],
                "name": item.get("name"),
                "score": int(item.get("score") or 0),
                "recommend_label": item.get("recommendLabel") or item.get("stanceLabel") or "관망",
                "stance": item.get("stance") or "watch",
                "predicted_at": predicted_at,
                "close_price": None,
                "prev_close": None,
                "change_pct": None,
                "matched": None,
                "finalized_at": None,
            }
        )

    if not rows:
        return {"market": market_id, "trade_date": trade_day.isoformat(), "count": 0}

    client.table("stock_pick_predictions").upsert(
        rows,
        on_conflict="trade_date,market,ticker",
    ).execute()

    return {"market": market_id, "trade_date": trade_day.isoformat(), "count": len(rows)}


def record_predictions_for_group(group: str, collect_market_fn) -> dict[str, Any]:
    markets = MARKET_GROUPS.get(group, [])
    results = []
    for market_id in markets:
        payload = collect_market_fn(market_id)
        picks = payload.get("items") or []
        results.append(record_market_predictions(market_id, picks))
    return {"group": group, "markets": results}


def finalize_market_predictions(market_id: str, trade_day: date | None = None) -> dict[str, Any]:
    client = _supabase_client()
    if client is None:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    day = trade_day or market_trade_date(market_id)
    response = (
        client.table("stock_pick_predictions")
        .select("id,ticker,stance,recommend_label")
        .eq("market", market_id)
        .eq("trade_date", day.isoformat())
        .is_("matched", "null")
        .execute()
    )
    pending = response.data or []

    updated = 0
    finalized_at = datetime.now(timezone.utc).isoformat()
    for row in pending:
        if row.get("recommend_label") == BACKFILL_LABEL:
            continue
        ticker = row["ticker"]
        stance = row["stance"]
        close_price, prev_close, change_pct = _closes_for_ticker(ticker, day)
        if close_price is None or prev_close is None or change_pct is None:
            continue
        matched = evaluate_prediction(stance, change_pct)
        if matched is None:
            continue
        client.table("stock_pick_predictions").update(
            {
                "close_price": close_price,
                "prev_close": prev_close,
                "change_pct": change_pct,
                "matched": matched,
                "finalized_at": finalized_at,
            }
        ).eq("id", row["id"]).execute()
        updated += 1

    return {
        "market": market_id,
        "trade_date": day.isoformat(),
        "pending": len(pending),
        "updated": updated,
    }


def finalize_predictions_for_group(group: str) -> dict[str, Any]:
    markets = MARKET_GROUPS.get(group, [])
    results = []
    for market_id in markets:
        results.append(finalize_market_predictions(market_id))
    return {"group": group, "markets": results}


def fetch_prediction_history(
    ticker: str,
    market: str | None = None,
    days: int = 30,
) -> list[dict[str, Any]]:
    client = _supabase_client()
    if client is None:
        return []

    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
    query = (
        client.table("stock_pick_predictions")
        .select(
            "trade_date,market,ticker,name,score,recommend_label,stance,"
            "close_price,prev_close,change_pct,matched,predicted_at,finalized_at"
        )
        .eq("ticker", ticker)
        .gte("trade_date", cutoff)
        .order("trade_date", desc=True)
    )
    if market:
        query = query.eq("market", market)
    response = query.limit(days + 5).execute()
    return response.data or []


def compute_accuracy(rows: list[dict[str, Any]], days: int) -> dict[str, Any]:
    cutoff = datetime.now(timezone.utc).date() - timedelta(days=days)
    eligible = []
    for row in rows:
        trade_date = row.get("trade_date")
        if not trade_date:
            continue
        try:
            day = date.fromisoformat(str(trade_date)[:10])
        except ValueError:
            continue
        if day < cutoff:
            continue
        if row.get("matched") is None:
            continue
        eligible.append(row)

    if not eligible:
        return {"days": days, "total": 0, "matched": 0, "accuracyPct": None}

    matched_count = sum(1 for row in eligible if row.get("matched") is True)
    total = len(eligible)
    return {
        "days": days,
        "total": total,
        "matched": matched_count,
        "accuracyPct": round(matched_count / total * 100, 1),
    }


def accuracy_summary_for_market(market_id: str, days: int = 30) -> dict[str, Any]:
    client = _supabase_client()
    if client is None:
        return {"market": market_id, "tickers": {}, "days": days}

    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
    response = (
        client.table("stock_pick_predictions")
        .select("trade_date,ticker,matched")
        .eq("market", market_id)
        .gte("trade_date", cutoff)
        .order("trade_date", desc=True)
        .execute()
    )
    rows = response.data or []
    by_ticker: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_ticker.setdefault(row["ticker"], []).append(row)

    tickers: dict[str, Any] = {}
    for ticker, ticker_rows in by_ticker.items():
        tickers[ticker] = {
            "accuracy7d": compute_accuracy(ticker_rows, 7),
            "accuracy30d": compute_accuracy(ticker_rows, 30),
        }

    return {"market": market_id, "days": days, "tickers": tickers}


def accuracy_summary_for_ticker(
    ticker: str,
    market: str | None = None,
    days: int = 30,
) -> dict[str, Any]:
    rows = fetch_prediction_history(ticker, market, days)
    return {
        "ticker": ticker,
        "market": market,
        "items": rows,
        "accuracy7d": compute_accuracy(rows, 7),
        "accuracy30d": compute_accuracy(rows, 30),
    }
