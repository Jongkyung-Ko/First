"""Chart KR 스냅샷 — KOSPI·KOSDAQ 시세·차트 디스크 저장·조회."""

from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from recommend2_bottom_accumulation import KST

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SNAPSHOT_PATH = ROOT / "data" / "chart-kr-snapshot.json"

KR_MARKET_KEYS = ("kr_kospi", "kr_kosdaq")
CHART_SNAPSHOT_PERIODS = ("1mo", "3mo", "6mo", "1y", "2y", "5y", "10y")
UPDATE_SCHEDULE = "매일 18:00 (KST) · 장 마감(15:30) 후 차트·시세 반영"

_memory_snapshot: dict[str, Any] | None = None


def snapshot_path() -> Path:
    raw = os.getenv("CHART_SNAPSHOT_PATH", "").strip()
    return Path(raw) if raw else DEFAULT_SNAPSHOT_PATH


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        return None
    return value


def assemble_payload(markets: dict[str, Any], *, source: str = "snapshot", saved_at: str | None = None) -> dict[str, Any]:
    now_utc = datetime.now(timezone.utc)
    now_kst = now_utc.astimezone(KST)
    return _json_safe(
        {
            "version": 1,
            "source": source,
            "savedAt": saved_at or now_utc.isoformat(),
            "updatedAt": now_utc.isoformat(),
            "updatedAtKst": now_kst.isoformat(),
            "updateSchedule": UPDATE_SCHEDULE,
            "timezone": "Asia/Seoul",
            "periods": list(CHART_SNAPSHOT_PERIODS),
            "markets": markets,
        }
    )


def load_snapshot(*, refresh: bool = False) -> dict[str, Any] | None:
    global _memory_snapshot
    if not refresh and _memory_snapshot is not None:
        return _memory_snapshot

    path = snapshot_path()
    if not path.is_file():
        return None
    try:
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict) and data.get("markets"):
            _memory_snapshot = data
            return data
    except (OSError, json.JSONDecodeError):
        return None
    return None


def save_snapshot(payload: dict[str, Any]) -> Path:
    global _memory_snapshot
    path = snapshot_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(payload)
    payload["source"] = "snapshot"
    payload["savedAt"] = payload.get("savedAt") or datetime.now(timezone.utc).isoformat()

    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    _memory_snapshot = payload
    return path


def _snapshot_age_seconds(payload: dict[str, Any]) -> int:
    saved = payload.get("savedAt") or payload.get("updatedAt")
    if not saved:
        return 0
    try:
        dt = datetime.fromisoformat(str(saved).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max(0, int(time.time() - dt.timestamp()))
    except ValueError:
        return 0


def get_chart_from_snapshot(ticker: str, period: str) -> dict[str, Any] | None:
    snap = load_snapshot()
    if not snap:
        return None
    for market in (snap.get("markets") or {}).values():
        charts = (market.get("charts") or {}).get(ticker)
        if not isinstance(charts, dict):
            continue
        entry = charts.get(period)
        if not isinstance(entry, dict) or not entry.get("candles"):
            continue
        payload = dict(entry)
        payload["cached"] = True
        payload["source"] = "snapshot"
        payload["cacheAgeSeconds"] = _snapshot_age_seconds(snap)
        return _json_safe(payload)
    return None


def get_market_top_from_snapshot(market: str) -> dict[str, Any] | None:
    if market not in KR_MARKET_KEYS:
        return None
    snap = load_snapshot()
    if not snap:
        return None
    block = (snap.get("markets") or {}).get(market)
    if not isinstance(block, dict) or not block.get("items"):
        return None
    payload = dict(block)
    payload["cached"] = True
    payload["source"] = "snapshot"
    payload["cacheAgeSeconds"] = _snapshot_age_seconds(snap)
    payload["updatedAt"] = snap.get("updatedAt")
    payload["updateSchedule"] = snap.get("updateSchedule")
    return _json_safe(payload)


def build_kr_market_block(
    market_id: str,
    universe: dict[str, Any],
    fetch_chart: Callable[..., dict[str, Any]],
    fetch_quote: Callable[[str], dict[str, Any]],
    *,
    after_scheduled_update: bool = True,
    max_workers: int = 6,
) -> dict[str, Any]:
    limit = int(universe.get("limit", 10))
    stocks = universe["stocks"][:limit]

    quotes: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        quote_futures = {pool.submit(fetch_quote, ticker): ticker for ticker, _ in stocks}
        for future in as_completed(quote_futures):
            ticker = quote_futures[future]
            try:
                quotes[ticker] = future.result()
            except Exception:
                quotes[ticker] = {"price": None, "changePct": None}

    items: list[dict[str, Any]] = []
    for rank, (ticker, name) in enumerate(stocks, start=1):
        quote = quotes.get(ticker, {"price": None, "changePct": None})
        items.append(
            {
                "rank": rank,
                "ticker": ticker,
                "name": name,
                "price": quote.get("price"),
                "changePct": quote.get("changePct"),
            }
        )

    charts: dict[str, dict[str, Any]] = {ticker: {} for ticker, _ in stocks}

    def fetch_one(ticker: str, period: str) -> tuple[str, str, dict[str, Any] | None]:
        try:
            data = fetch_chart(
                ticker,
                period,
                interval="1d",
                after_scheduled_update=after_scheduled_update,
            )
            return ticker, period, data
        except Exception:
            return ticker, period, None

    tasks = [(ticker, period) for ticker, _ in stocks for period in CHART_SNAPSHOT_PERIODS]
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(fetch_one, ticker, period) for ticker, period in tasks]
        for future in as_completed(futures):
            ticker, period, data = future.result()
            if data and data.get("candles"):
                charts[ticker][period] = {
                    k: v
                    for k, v in data.items()
                    if k in ("ticker", "name", "market", "period", "interval", "count", "candles")
                }

    return {
        "market": market_id,
        "segmentTitle": universe["title"],
        "count": len(items),
        "items": items,
        "charts": charts,
    }


def build_and_save_kr_snapshot(
    fetch_chart: Callable[..., dict[str, Any]],
    fetch_quote: Callable[[str], dict[str, Any]],
    market_universes: dict[str, dict[str, Any]],
    *,
    after_scheduled_update: bool = True,
) -> dict[str, Any]:
    markets: dict[str, Any] = {}
    for market_id in KR_MARKET_KEYS:
        universe = market_universes[market_id]
        print(f"Building chart snapshot for {market_id} ({universe.get('limit', 10)} tickers)...")
        markets[market_id] = build_kr_market_block(
            market_id,
            universe,
            fetch_chart,
            fetch_quote,
            after_scheduled_update=after_scheduled_update,
        )

    payload = assemble_payload(markets, source="snapshot")
    save_snapshot(payload)
    return payload
