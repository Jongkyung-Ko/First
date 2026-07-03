"""Long-term value screens — small-cap PBR, magic formula, Piotroski F-Score."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from fundamentals_universes import MARKET_EXCHANGE_LABELS, market_configs
from stock_fundamentals import FUNDAMENTALS_META, _safe_float

SNAPSHOT_ID = "long-term-screens"
HISTORY_LIMIT = 100
PICKS_TOP_N = 2  # 전략·시장당 최대 추천 종목 수


def picks_top_n(strategy_id: str) -> int:  # noqa: ARG001
    return PICKS_TOP_N

STRATEGIES: dict[str, dict[str, Any]] = {
    "small-cap-pbr": {
        "id": "small-cap-pbr",
        "label": "소형주 + 저PBR",
        "shortLabel": "소형·저PBR",
        "universeLimit": 200,
        "chunkSize": 60,
        "maxWorkers": 4,
        "delaySec": 0.35,
        "metricLabel": "PBR",
        "summary": (
            "유니버스 내 시가총액 하위 50% 소형주 중 PBR(주가순자산비율)이 낮은 순으로 장기 가치 후보를 선별합니다."
        ),
        "rules": [
            "유니버스: 시장별 시가총액 TOP 200 (청크 분할 스캔)",
            "소형주: 스캔된 종목 중 시가총액 하위 50%",
            "정렬: PBR 낮은 순 TOP 2 (0 < PBR ≤ 20)",
            "데이터: yfinance marketCap, priceToBook",
            "장기 투자 참고용 · Push 알림 제외",
        ],
    },
    "magic-formula": {
        "id": "magic-formula",
        "label": "마법 공식 (그린블랫)",
        "shortLabel": "마법공식",
        "universeLimit": 150,
        "chunkSize": 40,
        "maxWorkers": 3,
        "delaySec": 0.55,
        "metricLabel": "복합순위",
        "summary": (
            "조엘 그린블랫 방식: 수익률(EBIT/EV)과 자본수익(ROC) 각각 순위를 매긴 뒤 합산 순위가 낮은 종목을 선호합니다."
        ),
        "rules": [
            "유니버스: 시장별 TOP 150 (금융·적자·EV/EBIT 누락 제외)",
            "수익률 순위: EBIT ÷ 기업가치(EV) — 높을수록 유리",
            "ROC 순위: EBIT ÷ (순운전자본+순고정자산) 또는 Yahoo ROC 근사",
            "복합순위 = 수익률순위 + ROC순위 (낮을수록 상위) · TOP 2",
            "데이터: yfinance info + balance_sheet",
        ],
    },
    "f-score": {
        "id": "f-score",
        "label": "피오트로스키 F-스코어",
        "shortLabel": "F-스코어",
        "universeLimit": 100,
        "chunkSize": 20,
        "maxWorkers": 2,
        "delaySec": 1.1,
        "metricLabel": "F-Score",
        "summary": (
            "재무제표 9개 항목(순이익·ROA·영업CF·부채·유동비율·발행주식·마진·회전율 등)을 0~9점으로 평가합니다."
        ),
        "rules": [
            "유니버스: 시장별 TOP 100",
            "9점 만점: 당기순이익+, ROA+, 영업CF+, CF>NI, 부채↓, 유동비율↑, 무증발, 마진↑, 회전율↑",
            "전년 대비 개선 여부는 연간 재무제표 2개년 기준",
            "F-Score 7점 이상 · TOP 2 우선 표시",
            "데이터: yfinance balance_sheet, cashflow, financials",
        ],
    },
}

LONG_TERM_META = {
    "id": SNAPSHOT_ID,
    "title": "장기 추천 로직",
    "summary": (
        "장기 투자 관점의 가치·재무 스크리닝입니다. API 부하 분산을 위해 한가한 시간대에 "
        "청크 단위로 순차 스캔하며, 결과는 전 사용자에게 공통 공유됩니다."
    ),
    "fundamentalsGuide": FUNDAMENTALS_META,
    "strategies": list(STRATEGIES.values()),
    "disclaimer": (
        "Yahoo Finance 비공식 데이터 기준이며 종목·시장별 누락이 있을 수 있습니다. "
        "투자 권유가 아니며 Push 알림에 포함되지 않습니다."
    ),
    "notificationExcluded": True,
}

STRATEGY_ORDER = ("small-cap-pbr", "magic-formula", "f-score")
MARKET_ORDER = ("kospi", "kosdaq", "nasdaq", "nyse")


def _universe_for(strategy_id: str, market_id: str) -> list[tuple[str, str]]:
    cfg = market_configs().get(market_id)
    if not cfg:
        return []
    limit = int(STRATEGIES[strategy_id]["universeLimit"])
    return list(cfg["universe"][:limit])


def _fetch_info(ticker: str) -> dict[str, Any]:
    import yfinance as yf

    return yf.Ticker(ticker).info or {}


def _row_base(ticker: str, name: str, market_id: str, info: dict[str, Any]) -> dict[str, Any]:
    currency = "KRW" if market_id in ("kospi", "kosdaq") else "USD"
    price = _safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
    return {
        "ticker": ticker,
        "name": name,
        "market": market_id,
        "exchange": MARKET_EXCHANGE_LABELS.get(market_id, market_id.upper()),
        "currency": currency,
        "price": round(price, 2) if price is not None else None,
        "marketCap": _safe_float(info.get("marketCap")),
        "priceToBook": _safe_float(info.get("priceToBook")),
        "trailingPE": _safe_float(info.get("trailingPE")),
        "returnOnEquity": _safe_float(info.get("returnOnEquity")),
    }


def _compute_roc(info: dict[str, Any], ticker: str) -> float | None:
    roce = _safe_float(info.get("returnOnCapitalEmployed"))
    if roce is not None and roce > 0:
        return roce
    try:
        import yfinance as yf

        bs = yf.Ticker(ticker).balance_sheet
        if bs is None or bs.empty:
            return None
        ebit = _safe_float(info.get("ebit") or info.get("operatingIncome"))
        if ebit is None or ebit <= 0:
            return None

        def _latest(row_name: str) -> float | None:
            if row_name not in bs.index:
                return None
            for val in bs.loc[row_name]:
                f = _safe_float(val)
                if f is not None:
                    return f
            return None

        current_assets = _latest("Total Current Assets") or _latest("Current Assets")
        current_liab = _latest("Total Current Liab") or _latest("Current Liabilities")
        ppe = _latest("Net PPE") or _latest("Property Plant Equipment")
        if current_assets is None or current_liab is None:
            return None
        capital = (current_assets - current_liab) + (ppe or 0)
        if capital <= 0:
            return None
        return ebit / capital
    except Exception:
        return None


def analyze_small_cap_pbr(ticker: str, name: str, market_id: str) -> dict[str, Any] | None:
    info = _fetch_info(ticker)
    row = _row_base(ticker, name, market_id, info)
    pbr = row.get("priceToBook")
    cap = row.get("marketCap")
    if cap is None or cap <= 0 or pbr is None or pbr <= 0 or pbr > 20:
        return None
    row["metricValue"] = pbr
    row["metricDisplay"] = f"PBR {pbr:.2f}"
    return row


def analyze_magic_formula(ticker: str, name: str, market_id: str) -> dict[str, Any] | None:
    info = _fetch_info(ticker)
    sector = str(info.get("sector") or "").lower()
    if "financial" in sector or "insurance" in sector:
        return None
    ev = _safe_float(info.get("enterpriseValue"))
    ebit = _safe_float(info.get("ebit") or info.get("operatingIncome"))
    if ev is None or ev <= 0 or ebit is None or ebit <= 0:
        return None
    earnings_yield = ebit / ev
    roc = _compute_roc(info, ticker)
    if roc is None or roc <= 0:
        return None
    row = _row_base(ticker, name, market_id, info)
    row["earningsYield"] = earnings_yield
    row["roc"] = roc
    ebitda = _safe_float(info.get("ebitda"))
    row["evEbitda"] = (ev / ebitda) if ebitda and ebitda > 0 else None
    row["metricValue"] = earnings_yield
    row["metricDisplay"] = f"EY {(earnings_yield * 100):.1f}% · ROC {(roc * 100):.1f}%"
    return row


def _bs_value(df, row_names: tuple[str, ...], col: int = 0) -> float | None:
    if df is None or df.empty:
        return None
    for name in row_names:
        if name in df.index:
            try:
                return _safe_float(df.iloc[name, col])
            except Exception:
                continue
    return None


def compute_f_score(ticker: str) -> tuple[int | None, str]:
    try:
        import yfinance as yf

        t = yf.Ticker(ticker)
        bs = t.balance_sheet
        cf = t.cashflow
        inc = t.financials
        if bs is None or bs.empty or cf is None or cf.empty or inc is None or inc.empty:
            return None, ""
        if bs.shape[1] < 2:
            return None, ""

        score = 0
        ni0 = _bs_value(inc, ("Net Income", "Net Income Common Stockholders"), 0)
        ta0 = _bs_value(bs, ("Total Assets",), 0)
        ta1 = _bs_value(bs, ("Total Assets",), 1)
        ocf0 = _bs_value(cf, ("Operating Cash Flow", "Total Cash From Operating Activities"), 0)
        ltd0 = _bs_value(bs, ("Long Term Debt", "Total Long Term Debt"), 0)
        ltd1 = _bs_value(bs, ("Long Term Debt", "Total Long Term Debt"), 1)
        ca0 = _bs_value(bs, ("Total Current Assets", "Current Assets"), 0)
        cl0 = _bs_value(bs, ("Total Current Liab", "Current Liabilities"), 0)
        ca1 = _bs_value(bs, ("Total Current Assets", "Current Assets"), 1)
        cl1 = _bs_value(bs, ("Total Current Liab", "Current Liabilities"), 1)
        shares0 = _bs_value(bs, ("Ordinary Shares Number", "Share Issued"), 0)
        shares1 = _bs_value(bs, ("Ordinary Shares Number", "Share Issued"), 1)
        rev0 = _bs_value(inc, ("Total Revenue", "Revenue"), 0)
        rev1 = _bs_value(inc, ("Total Revenue", "Revenue"), 1)
        gp0 = _bs_value(inc, ("Gross Profit",), 0)
        gp1 = _bs_value(inc, ("Gross Profit",), 1)

        if ni0 is not None and ni0 > 0:
            score += 1
        if ni0 is not None and ta0 and ta0 > 0 and ni0 / ta0 > 0:
            score += 1
        if ocf0 is not None and ocf0 > 0:
            score += 1
        if ocf0 is not None and ni0 is not None and ocf0 > ni0:
            score += 1
        if ltd0 is not None and ltd1 is not None and ta0 and ta1 and ta0 > 0 and ta1 > 0:
            if ltd0 / ta0 < ltd1 / ta1:
                score += 1
        if ca0 and cl0 and cl0 > 0 and ca1 and cl1 and cl1 > 0:
            if ca0 / cl0 > ca1 / cl1:
                score += 1
        if shares0 is not None and shares1 is not None and shares0 <= shares1:
            score += 1
        if gp0 and rev0 and rev0 > 0 and gp1 and rev1 and rev1 > 0:
            if gp0 / rev0 > gp1 / rev1:
                score += 1
        if rev0 and ta0 and ta0 > 0 and rev1 and ta1 and ta1 > 0:
            if rev0 / ta0 > rev1 / ta1:
                score += 1
        return score, f"F-Score {score}/9"
    except Exception:
        return None, ""


def analyze_f_score(ticker: str, name: str, market_id: str) -> dict[str, Any] | None:
    info = _fetch_info(ticker)
    score, display = compute_f_score(ticker)
    if score is None:
        return None
    row = _row_base(ticker, name, market_id, info)
    row["fScore"] = score
    row["metricValue"] = float(score)
    row["metricDisplay"] = display
    return row


ANALYZERS = {
    "small-cap-pbr": analyze_small_cap_pbr,
    "magic-formula": analyze_magic_formula,
    "f-score": analyze_f_score,
}


def scan_chunk(strategy_id: str, market_id: str, offset: int, limit: int) -> dict[str, Any]:
    spec = STRATEGIES[strategy_id]
    universe = _universe_for(strategy_id, market_id)
    chunk = universe[offset : offset + limit]
    analyzer = ANALYZERS[strategy_id]
    rows: list[dict[str, Any]] = []
    errors: list[str] = []
    delay = float(spec.get("delaySec") or 0.5)
    workers = int(spec.get("maxWorkers") or 2)

    def work(item: tuple[str, str]) -> dict[str, Any] | None:
        ticker, name = item
        time.sleep(delay)
        try:
            return analyzer(ticker, name, market_id)
        except Exception as exc:
            errors.append(f"{ticker}: {exc}")
            return None

    if workers <= 1:
        for item in chunk:
            row = work(item)
            if row:
                rows.append(row)
    else:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(work, item): item[0] for item in chunk}
            for future in as_completed(futures):
                try:
                    row = future.result()
                    if row:
                        rows.append(row)
                except Exception as exc:
                    errors.append(f"{futures[future]}: {exc}")

    return {
        "strategyId": strategy_id,
        "market": market_id,
        "offset": offset,
        "limit": limit,
        "chunkSize": len(chunk),
        "universeSize": len(universe),
        "rows": rows,
        "errors": errors[:10],
        "scannedAt": datetime.now(timezone.utc).isoformat(),
    }


def rank_small_cap_pbr(rows: list[dict[str, Any]], top_n: int | None = None) -> list[dict[str, Any]]:
    if not rows:
        return []
    caps = sorted(r["marketCap"] for r in rows if r.get("marketCap"))
    if not caps:
        return []
    cutoff = caps[len(caps) // 2]
    small = [r for r in rows if r.get("marketCap") and r["marketCap"] <= cutoff]
    small.sort(key=lambda r: r.get("priceToBook") or 999)
    limit = top_n if top_n is not None else picks_top_n("small-cap-pbr")
    return [{**row, "rank": i, "strategyId": "small-cap-pbr"} for i, row in enumerate(small[:limit], start=1)]


def rank_magic_formula(rows: list[dict[str, Any]], top_n: int | None = None) -> list[dict[str, Any]]:
    valid = [r for r in rows if r.get("earningsYield") and r.get("roc")]
    if not valid:
        return []
    ey_sorted = sorted(valid, key=lambda r: r["earningsYield"], reverse=True)
    roc_sorted = sorted(valid, key=lambda r: r["roc"], reverse=True)
    ey_rank = {r["ticker"]: i + 1 for i, r in enumerate(ey_sorted)}
    roc_rank = {r["ticker"]: i + 1 for i, r in enumerate(roc_sorted)}
    for r in valid:
        r["combinedRank"] = ey_rank[r["ticker"]] + roc_rank[r["ticker"]]
        r["metricDisplay"] = f"복합순위 {r['combinedRank']}"
    valid.sort(key=lambda r: r["combinedRank"])
    limit = top_n if top_n is not None else picks_top_n("magic-formula")
    return [{**row, "rank": i, "strategyId": "magic-formula"} for i, row in enumerate(valid[:limit], start=1)]


def rank_f_score(rows: list[dict[str, Any]], top_n: int | None = None) -> list[dict[str, Any]]:
    valid = [r for r in rows if r.get("fScore") is not None]
    valid.sort(key=lambda r: (-int(r["fScore"]), r.get("ticker") or ""))
    strong = [r for r in valid if int(r["fScore"]) >= 7]
    pool = strong if strong else valid
    limit = top_n if top_n is not None else picks_top_n("f-score")
    return [{**row, "rank": i, "strategyId": "f-score"} for i, row in enumerate(pool[:limit], start=1)]


RANKERS = {
    "small-cap-pbr": rank_small_cap_pbr,
    "magic-formula": rank_magic_formula,
    "f-score": rank_f_score,
}

TOP100_LIMIT = 100


def merged_strategy_rows(strat_block: dict[str, Any]) -> list[dict[str, Any]]:
    by_ticker: dict[str, dict[str, Any]] = {}
    markets = strat_block.get("markets") or {}
    for market_id in MARKET_ORDER:
        mb = markets.get(market_id) or {}
        for row in mb.get("rows") or []:
            ticker = row.get("ticker")
            if ticker:
                by_ticker[ticker] = row
    return list(by_ticker.values())


def build_strategy_top100(strategy_id: str, strat_block: dict[str, Any]) -> list[dict[str, Any]]:
    rows = merged_strategy_rows(strat_block)
    if not rows:
        return []
    ranked = RANKERS[strategy_id](rows, TOP100_LIMIT)
    return [
        {
            "rank": item.get("rank"),
            "name": item.get("name"),
            "ticker": item.get("ticker"),
            "market": item.get("market"),
            "metricDisplay": item.get("metricDisplay"),
            "price": item.get("price"),
        }
        for item in ranked
    ]
