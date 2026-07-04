"""Stock fundamentals — PER / ROE / PBR / 배당수익률 (TOP 200 → TOP 20)."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from dart_service import dart_configured, resolve_price_to_book, resolve_trailing_pe
from fundamentals_universes import (
    FUNDAMENTALS_TOP_N,
    FUNDAMENTALS_UNIVERSE_LIMIT,
    GLOBAL_UPDATE_SCHEDULE,
    MARKET_EXCHANGE_LABELS,
    NY,
    market_configs,
    region_market_keys,
)

STRATEGY_ID = "fundamentals"
SNAPSHOT_FILENAME = "stock-fundamentals.json"

FUNDAMENTALS_META = {
    "id": STRATEGY_ID,
    "title": "가치·배당 지표 (PER · ROE · PBR · 배당)",
    "universe": (
        f"KOSPI·KOSDAQ·NASDAQ·NYSE 각 시가총액 TOP {FUNDAMENTALS_UNIVERSE_LIMIT} "
        f"→ 지표별 TOP {FUNDAMENTALS_TOP_N}"
    ),
    "summary": (
        "Yahoo Finance 재무 지표로 시장별 저PER·고ROE·저PBR·고배당 종목을 순위화합니다. "
        "참고용 스크리닝이며 Push 알림 대상은 아닙니다."
    ),
    "rules": [
        f"유니버스: 시장별 시가총액 TOP {FUNDAMENTALS_UNIVERSE_LIMIT}",
        f"PER 탭: trailing PER 낮은 순 TOP {FUNDAMENTALS_TOP_N} (0 < PER ≤ 100, 적자 제외)",
        f"ROE 탭: ROE 높은 순 TOP {FUNDAMENTALS_TOP_N} (ROE > 0)",
        f"PBR 탭: PBR 낮은 순 TOP {FUNDAMENTALS_TOP_N} (0 < PBR ≤ 20)",
        f"배당 탭: 배당수익률 높은 순 TOP {FUNDAMENTALS_TOP_N} (배당 > 0)",
        "Re 1회로 PER·ROE·PBR·배당 4탭 데이터를 함께 갱신 (maspro79@naver.com 전용)",
        "일반 사용자: KOSPI·KOSDAQ 20:30 KST · NASDAQ·NYSE 21:30 ET 자동 갱신",
        "PER: Yahoo trailingPE → Yahoo EPS → 한국 종목 Open DART EPS(사업보고서)",
        "PBR: Yahoo priceToBook → bookValue → BS → 한국 Open DART BPS(주당순자산)",
        "ROE·배당: yfinance Ticker.info (returnOnEquity, dividendYield)",
    ],
    "patterns": [
        {
            "id": "per",
            "label": "PER (주가수익비율)",
            "description": "이익 대비 주가 — 낮을수록 상대적 저평가 후보",
        },
        {
            "id": "roe",
            "label": "ROE (자기자본이익률)",
            "description": "자본 효율 — 높을수록 주주 이익 창출력",
        },
        {
            "id": "pbr",
            "label": "PBR (주가순자산비율)",
            "description": "순자산 대비 주가 — 낮을수록 자산 대비 저평가",
        },
        {
            "id": "dividend",
            "label": "배당수익률",
            "description": "주가 대비 연간 배당 — 높을수록 현금 수익 비중",
        },
    ],
    "disclaimer": (
        "재무 지표는 Yahoo Finance·Open DART(한국 PER·PBR) 제공값 기준이며 "
        "시장·종목별 누락이 있을 수 있습니다. "
        "투자 권유가 아니며, 이 4개 지표 추천 종목은 8시 Push 알림에 포함되지 않습니다."
    ),
    "notificationExcluded": True,
}

METRIC_DEFS: dict[str, dict[str, Any]] = {
    "per": {
        "label": "PER",
        "field": "trailingPE",
        "asc": True,
        "min": 0.0,
        "max": 100.0,
        "display": lambda v: f"{v:.2f}",
    },
    "roe": {
        "label": "ROE",
        "field": "returnOnEquity",
        "asc": False,
        "min": 0.0,
        "max": None,
        "display": lambda v: f"{v * 100:.2f}%",
        "percent": True,
    },
    "pbr": {
        "label": "PBR",
        "field": "priceToBook",
        "asc": True,
        "min": 0.0,
        "max": 20.0,
        "display": lambda v: f"{v:.2f}",
    },
    "dividend": {
        "label": "배당수익률",
        "field": "dividendYield",
        "asc": False,
        "min": 0.0,
        "max": None,
        "display": lambda v: f"{v * 100:.2f}%",
        "percent": True,
    },
}


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        f = float(value)
        if f != f:
            return None
        return f
    except (TypeError, ValueError):
        return None


def _fetch_row(ticker: str, name: str, currency: str) -> dict[str, Any]:
    import yfinance as yf

    info = yf.Ticker(ticker).info or {}
    price = _safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
    yahoo_pe = _safe_float(info.get("trailingPE"))
    trailing_pe = resolve_trailing_pe(
        ticker,
        price=price,
        yahoo_trailing_pe=yahoo_pe,
        info=info,
    )
    forward_pe = _safe_float(info.get("forwardPE"))
    roe = _safe_float(info.get("returnOnEquity"))
    yahoo_pbr = _safe_float(info.get("priceToBook"))
    pbr = resolve_price_to_book(
        ticker,
        price=price,
        yahoo_pbr=yahoo_pbr,
        info=info,
    )
    div_yield = _safe_float(info.get("dividendYield"))
    if div_yield is None:
        div_rate = _safe_float(info.get("dividendRate"))
        if div_rate is not None and price and price > 0:
            div_yield = div_rate / price

    return {
        "ticker": ticker,
        "name": name,
        "currency": currency,
        "price": round(price, 2) if price is not None else None,
        "trailingPE": trailing_pe,
        "forwardPE": forward_pe,
        "returnOnEquity": roe,
        "priceToBook": pbr,
        "dividendYield": div_yield,
    }


def _metric_value(row: dict[str, Any], metric_key: str) -> float | None:
    field = METRIC_DEFS[metric_key]["field"]
    return _safe_float(row.get(field))


def _passes_filter(value: float | None, metric_key: str) -> bool:
    if value is None:
        return False
    spec = METRIC_DEFS[metric_key]
    if value <= spec["min"]:
        return False
    max_v = spec.get("max")
    if max_v is not None and value > max_v:
        return False
    return True


def _rank_metric(rows: list[dict[str, Any]], metric_key: str) -> list[dict[str, Any]]:
    spec = METRIC_DEFS[metric_key]
    filtered = [r for r in rows if _passes_filter(_metric_value(r, metric_key), metric_key)]
    filtered.sort(
        key=lambda r: (_metric_value(r, metric_key) or 0.0),
        reverse=not spec["asc"],
    )
    top = filtered[:FUNDAMENTALS_TOP_N]
    out: list[dict[str, Any]] = []
    for rank, row in enumerate(top, start=1):
        val = _metric_value(row, metric_key)
        if val is None:
            continue
        out.append(
            {
                "rank": rank,
                "ticker": row["ticker"],
                "name": row["name"],
                "currency": row["currency"],
                "price": row.get("price"),
                "value": round(val, 6),
                "displayValue": spec["display"](val),
                "trailingPE": row.get("trailingPE"),
                "returnOnEquity": row.get("returnOnEquity"),
                "priceToBook": row.get("priceToBook"),
                "dividendYield": row.get("dividendYield"),
                "exchange": MARKET_EXCHANGE_LABELS.get(
                    row.get("segment") or "", row.get("exchange") or ""
                ),
            }
        )
    return out


def scan_market_fundamentals(
    config: dict[str, Any],
    *,
    max_workers: int = 6,
) -> dict[str, Any]:
    market_id = config["id"]
    universe: list[tuple[str, str]] = config["universe"]
    tz: ZoneInfo = config["timezone"]
    currency: str = config.get("currency", "USD")

    now_local = datetime.now(tz)
    rows: list[dict[str, Any]] = []
    errors: list[str] = []

    def fetch_one(ticker_name: tuple[str, str]) -> dict[str, Any]:
        ticker, name = ticker_name
        row = _fetch_row(ticker, name, currency)
        row["segment"] = market_id
        row["exchange"] = MARKET_EXCHANGE_LABELS.get(market_id, market_id.upper())
        return row

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(fetch_one, item): item[0] for item in universe}
        for future in as_completed(futures):
            ticker = futures[future]
            try:
                rows.append(future.result())
            except Exception as exc:
                errors.append(f"{ticker}: {exc}")

    rankings: dict[str, Any] = {}
    for metric_key, spec in METRIC_DEFS.items():
        items = _rank_metric(rows, metric_key)
        rankings[metric_key] = {
            "metric": metric_key,
            "label": spec["label"],
            "sortAsc": spec["asc"],
            "topN": FUNDAMENTALS_TOP_N,
            "count": len(items),
            "items": items,
        }

    return {
        "market": market_id,
        "segmentTitle": config["title"],
        "universeSize": len(universe),
        "scannedCount": len(rows),
        "errorCount": len(errors),
        "errors": errors[:20],
        "rankings": rankings,
        "fundamentalsReady": True,
        "recentCount": sum(len(r["items"]) for r in rankings.values()),
        "analysisDate": now_local.date().isoformat(),
    }


def collect_fundamentals_scan(
    *,
    market_keys: tuple[str, ...] | None = None,
) -> dict[str, Any]:
    configs = market_configs()
    keys = market_keys or tuple(configs.keys())
    now_utc = datetime.now(timezone.utc)
    now_ny = now_utc.astimezone(NY)

    markets: dict[str, Any] = {}
    for key in keys:
        if key not in configs:
            continue
        markets[key] = scan_market_fundamentals(configs[key])

    return {
        "version": 1,
        "strategyId": STRATEGY_ID,
        "source": "live",
        "dartConfigured": dart_configured(),
        "savedAt": now_utc.isoformat(),
        "updatedAt": now_utc.isoformat(),
        "updatedAtNy": now_ny.isoformat(),
        "displayTimezone": "America/New_York",
        "updateSchedule": GLOBAL_UPDATE_SCHEDULE,
        "universe": FUNDAMENTALS_META["universe"],
        "strategy": FUNDAMENTALS_META,
        "markets": markets,
        "regions": {
            key: {"updatedAt": now_utc.isoformat(), "updatedAtNy": now_ny.isoformat()}
            for key in keys
        },
    }


def scan_region(region: str) -> dict[str, Any]:
    keys = region_market_keys(region)
    if region in keys:
        return collect_fundamentals_scan(market_keys=keys)
    payload = collect_fundamentals_scan(market_keys=(region,))
    return payload
