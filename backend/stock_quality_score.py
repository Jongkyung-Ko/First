"""재무 종합 점수 — ROE·영업이익률·부채비율·FCF수익률·EPS성장 (TOP 100 → 등급 합 5~25)."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

from stock_fundamentals import _safe_float
from stock_strategy_universes import (
    ALL_MARKET_KEYS,
    GLOBAL_UPDATE_SCHEDULE,
    KST,
    MARKET_EXCHANGE_LABELS,
    NY,
    market_configs,
    region_market_keys,
)

STRATEGY_ID = "quality-score"
SNAPSHOT_FILENAME = "stock-quality-score.json"
UNIVERSE_LIMIT = 100

KR_UPDATE_SCHEDULE = "매일 02:00·03:00 (KST) · 시총 TOP 100 청크 스캔"
US_UPDATE_SCHEDULE = "매일 02:00·03:00 (뉴욕 ET) · 시총 TOP 100 청크 스캔"
QUALITY_UPDATE_SCHEDULE = (
    "KOSPI·KOSDAQ 02:00·03:00 KST · NASDAQ·NYSE 02:00·03:00 뉴욕(ET) · "
    "각 50종목씩 2회 분할"
)

FINANCIAL_SECTOR_KEYWORDS = ("financial", "bank", "insurance", "capital markets")

QUALITY_META = {
    "id": STRATEGY_ID,
    "title": "재무 종합 점수",
    "universe": f"KOSPI·KOSDAQ·NASDAQ·NYSE 각 시가총액 TOP {UNIVERSE_LIMIT}",
    "summary": (
        "ROE·영업이익률·부채비율·잉여현금흐름(시총 대비)·EPS 성장률 5개 지표를 "
        "1~5등급으로 평가해 합산(5~25점) 순위를 매깁니다."
    ),
    "rules": [
        f"유니버스: 시장별 시가총액 TOP {UNIVERSE_LIMIT}",
        "ROE·영업이익률·EPS성장: 높을수록 고등급 (5>20%, 4=15~20%, 3=10~15%, 2=5~10%, 1<5%)",
        "부채비율(부채÷자본×100): 낮을수록 고등급 (5<50%, 4=50~100%, 3=100~150%, 2=150~200%, 1>200%)",
        "FCF 수익률(FCF÷시총×100): 5≥6%, 4=3~6%, 3=1~3%, 2=0~1%, 1=적자/없음",
        "종합점수 = 5개 등급 합계 (최대 25) · 전체 TOP 100 순위",
        "금융주 부채비율 누락 시 부채 등급 3(보통) 처리",
        "매일 02:00·03:00 시장별 50종목씩 2회 청크 스캔 · Push 알림 제외",
        "데이터: yfinance (한국 종목은 추후 DART 보강 예정)",
    ],
    "metrics": [
        {"id": "roe", "label": "ROE", "unit": "%"},
        {"id": "operatingMargin", "label": "영업이익률", "unit": "%"},
        {"id": "debtRatio", "label": "부채비율", "unit": "%"},
        {"id": "fcfYield", "label": "FCF 수익률", "unit": "%"},
        {"id": "epsGrowth", "label": "EPS 성장률", "unit": "%"},
    ],
    "disclaimer": (
        "Yahoo Finance 비공식 데이터 기준이며 종목·시장별 누락이 있을 수 있습니다. "
        "투자 권유가 아니며 Push 알림에 포함되지 않습니다."
    ),
    "notificationExcluded": True,
}


def _is_financial_sector(sector: str | None, industry: str | None = None) -> bool:
    text = f"{sector or ''} {industry or ''}".lower()
    return any(kw in text for kw in FINANCIAL_SECTOR_KEYWORDS)


def grade_higher(value: float | None, *, t5: float = 20, t4: float = 15, t3: float = 10, t2: float = 5) -> int:
    if value is None:
        return 1
    if value > t5:
        return 5
    if value >= t4:
        return 4
    if value >= t3:
        return 3
    if value >= t2:
        return 2
    return 1


def grade_debt_ratio(value: float | None) -> int:
    if value is None:
        return 1
    if value < 50:
        return 5
    if value <= 100:
        return 4
    if value <= 150:
        return 3
    if value <= 200:
        return 2
    return 1


def grade_fcf_yield(value: float | None) -> int:
    if value is None:
        return 1
    if value < 0:
        return 1
    if value >= 6:
        return 5
    if value >= 3:
        return 4
    if value >= 1:
        return 3
    if value > 0:
        return 2
    return 1


def _bs_val(df, names: tuple[str, ...], col: int = 0) -> float | None:
    if df is None or getattr(df, "empty", True) or col >= df.shape[1]:
        return None
    for name in names:
        if name in df.index:
            try:
                return _safe_float(df.loc[name, df.columns[col]])
            except Exception:
                continue
    return None


def fetch_quality_row(ticker: str, name: str, market_id: str) -> dict[str, Any]:
    import yfinance as yf

    stock = yf.Ticker(ticker)
    info = stock.info or {}
    bs = stock.balance_sheet
    cf = stock.cashflow
    inc = stock.financials

    currency = "KRW" if market_id in ("kospi", "kosdaq") else "USD"
    price = _safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
    sector = str(info.get("sector") or "")
    industry = str(info.get("industry") or "")
    is_financial = _is_financial_sector(sector, industry)

    roe_raw = _safe_float(info.get("returnOnEquity"))
    roe = roe_raw * 100 if roe_raw is not None else None

    om_raw = _safe_float(info.get("operatingMargins"))
    if om_raw is not None:
        op_margin = om_raw * 100
    else:
        rev = _bs_val(inc, ("Total Revenue", "Revenue"), 0)
        oi = _bs_val(inc, ("Operating Income", "EBIT"), 0)
        op_margin = (oi / rev * 100) if oi and rev and rev > 0 else None

    liab = _bs_val(bs, ("Total Liab", "Total Liabilities"), 0)
    equity = _bs_val(
        bs,
        ("Total Stockholder Equity", "Stockholders Equity", "Common Stock Equity"),
        0,
    )
    if liab and equity and equity > 0:
        debt_ratio = liab / equity * 100
    else:
        debt_ratio = _safe_float(info.get("debtToEquity"))

    mcap = _safe_float(info.get("marketCap"))
    fcf = _bs_val(cf, ("Free Cash Flow",), 0)
    if fcf is None:
        ocf = _bs_val(cf, ("Operating Cash Flow", "Total Cash From Operating Activities"), 0)
        capex = _bs_val(cf, ("Capital Expenditure", "Capital Expenditures"), 0)
        if ocf is not None and capex is not None:
            fcf = ocf + capex
    fcf_yield = (fcf / mcap * 100) if fcf is not None and mcap and mcap > 0 else None

    eg_raw = _safe_float(info.get("earningsGrowth"))
    if eg_raw is not None:
        eps_growth = eg_raw * 100
    else:
        ni0 = _bs_val(inc, ("Net Income", "Net Income Common Stockholders"), 0)
        ni1 = _bs_val(inc, ("Net Income", "Net Income Common Stockholders"), 1)
        shares = _bs_val(bs, ("Ordinary Shares Number", "Share Issued"), 0)
        if ni0 and ni1 and shares and shares > 0:
            shares1 = _bs_val(bs, ("Ordinary Shares Number", "Share Issued"), 1) or shares
            eps0 = ni0 / shares
            eps1 = ni1 / shares1
            eps_growth = (eps0 - eps1) / abs(eps1) * 100 if eps1 and abs(eps1) > 0 else None
        else:
            eps_growth = None

    debt_grade = grade_debt_ratio(debt_ratio)
    if is_financial and debt_ratio is None:
        debt_grade = 3

    grades = {
        "roe": grade_higher(roe),
        "operatingMargin": grade_higher(op_margin),
        "debt": debt_grade,
        "fcf": grade_fcf_yield(fcf_yield),
        "epsGrowth": grade_higher(eps_growth),
    }
    values = [roe, op_margin, debt_ratio, fcf_yield, eps_growth]

    return {
        "ticker": ticker,
        "name": name,
        "market": market_id,
        "exchange": MARKET_EXCHANGE_LABELS.get(market_id, market_id.upper()),
        "currency": currency,
        "price": round(price, 2) if price is not None else None,
        "sector": sector or None,
        "compositeScore": sum(grades.values()),
        "grades": grades,
        "roe": round(roe, 2) if roe is not None else None,
        "operatingMargin": round(op_margin, 2) if op_margin is not None else None,
        "debtRatio": round(debt_ratio, 2) if debt_ratio is not None else None,
        "fcfYield": round(fcf_yield, 2) if fcf_yield is not None else None,
        "epsGrowth": round(eps_growth, 2) if eps_growth is not None else None,
        "metricsOk": sum(1 for v in values if v is not None),
        "isFinancial": is_financial,
    }


def rank_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ranked = sorted(
        rows,
        key=lambda r: (
            -(r.get("compositeScore") or 0),
            -(r.get("grades") or {}).get("roe", 0),
            -(r.get("grades") or {}).get("operatingMargin", 0),
            r.get("name") or "",
        ),
    )
    out: list[dict[str, Any]] = []
    for i, row in enumerate(ranked, start=1):
        item = dict(row)
        item["rank"] = i
        out.append(item)
    return out


def scan_market_chunk(
    market_id: str,
    offset: int,
    limit: int,
    *,
    delay_sec: float = 0.35,
) -> tuple[list[dict[str, Any]], list[str]]:
    config = market_configs(universe_limit=UNIVERSE_LIMIT).get(market_id)
    if not config:
        return [], [f"unknown market: {market_id}"]
    universe = config["universe"]
    chunk = universe[offset : offset + limit]
    if not chunk:
        return [], []

    rows: list[dict[str, Any]] = []
    errors: list[str] = []
    workers = min(3, max(1, len(chunk)))

    def work(item: tuple[str, str]) -> dict[str, Any]:
        ticker, nm = item
        time.sleep(delay_sec)
        return fetch_quality_row(ticker, nm, market_id)

    if workers <= 1:
        for item in chunk:
            try:
                rows.append(work(item))
            except Exception as exc:
                errors.append(f"{item[0]}: {exc}")
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(work, item): item[0] for item in chunk}
            for future in as_completed(futures):
                ticker = futures[future]
                try:
                    rows.append(future.result())
                except Exception as exc:
                    errors.append(f"{ticker}: {exc}")

    return rows, errors


def scan_region(region: str) -> dict[str, Any]:
    keys = (region,) if region in ALL_MARKET_KEYS else region_market_keys(region)
    markets: dict[str, Any] = {}
    for market_id in keys:
        config = market_configs(universe_limit=UNIVERSE_LIMIT)[market_id]
        all_rows: list[dict[str, Any]] = []
        errors: list[str] = []
        offset = 0
        chunk_size = 10
        while offset < len(config["universe"]):
            rows, errs = scan_market_chunk(market_id, offset, chunk_size)
            all_rows.extend(rows)
            errors.extend(errs)
            offset += chunk_size
        items = rank_rows(all_rows)
        now_local = datetime.now(config["timezone"])
        markets[market_id] = {
            "market": market_id,
            "segmentTitle": config["title"],
            "universeSize": len(config["universe"]),
            "scannedCount": len(all_rows),
            "errorCount": len(errors),
            "errors": errors[:20],
            "items": items,
            "qualityReady": True,
            "analysisDate": now_local.date().isoformat(),
            "updateSchedule": config.get("updateSchedule"),
        }

    now_utc = datetime.now(timezone.utc)
    return {
        "markets": markets,
        "updatedAt": now_utc.isoformat(),
        "updatedAtKst": now_utc.astimezone(KST).isoformat(),
        "updatedAtNy": now_utc.astimezone(NY).isoformat(),
        "scanRegion": region,
    }
