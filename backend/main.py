"""Stock headlines API powered by yfinance (Yahoo Finance)."""

from __future__ import annotations

import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

import yfinance as yf
from deep_translator import GoogleTranslator
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

US_TICKERS = [
    "^GSPC",
    "^IXIC",
    "^DJI",
    "AAPL",
    "NVDA",
    "MSFT",
    "TSLA",
    "AMZN",
    "GOOGL",
    "META",
]

KR_TICKERS = [
    "^KS11",
    "005930.KS",
    "000660.KS",
    "035420.KS",
    "035720.KQ",
    "051910.KS",
    "006400.KS",
    "105560.KS",
]

PICK_TICKERS = {
    ticker: market
    for ticker, market in (
        [(t, "us") for t in US_TICKERS if not t.startswith("^")]
        + [(t, "kr") for t in KR_TICKERS if not t.startswith("^")]
    )
}

TICKER_NAMES = {
    "AAPL": "Apple",
    "NVDA": "NVIDIA",
    "MSFT": "Microsoft",
    "TSLA": "Tesla",
    "AMZN": "Amazon",
    "GOOGL": "Alphabet",
    "META": "Meta",
    "005930.KS": "삼성전자",
    "000660.KS": "SK하이닉스",
    "035420.KS": "NAVER",
    "035720.KQ": "카카오",
    "051910.KS": "LG화학",
    "006400.KS": "삼성SDI",
    "105560.KS": "KB금융",
}

CACHE_TTL = int(os.getenv("HEADLINES_CACHE_TTL", "600"))
_cache: dict[str, dict[str, Any]] = {}
_translate_cache: dict[str, str] = {}

DEFAULT_ORIGINS = [
    "https://jongkyung-ko.github.io",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

extra_origins = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = DEFAULT_ORIGINS + [o.strip() for o in extra_origins.split(",") if o.strip()]

app = FastAPI(title="First Stock API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _parse_timestamp(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp())
        except ValueError:
            return 0
    return 0


def _url_from_field(field: Any) -> str | None:
    if isinstance(field, dict):
        return field.get("url")
    if isinstance(field, str):
        return field
    return None


def normalize_news_item(raw: dict[str, Any], source_ticker: str, market: str) -> dict[str, Any] | None:
    content = raw.get("content") if isinstance(raw.get("content"), dict) else raw

    title = content.get("title") or raw.get("title")
    if not title:
        return None

    summary = (
        content.get("summary")
        or content.get("description")
        or raw.get("summary")
        or raw.get("description")
        or ""
    )
    if isinstance(summary, dict):
        summary = summary.get("text") or summary.get("content") or ""
    summary = re.sub(r"<[^>]+>", " ", str(summary)).strip()
    summary = re.sub(r"\s+", " ", summary)

    link = (
        _url_from_field(content.get("canonicalUrl"))
        or _url_from_field(content.get("clickThroughUrl"))
        or content.get("link")
        or raw.get("link")
    )

    provider = content.get("provider") or raw.get("publisher")
    if isinstance(provider, dict):
        publisher = provider.get("displayName") or provider.get("name")
    else:
        publisher = provider

    published_at = _parse_timestamp(
        raw.get("providerPublishTime") or content.get("pubDate") or content.get("displayTime")
    )

    related = raw.get("relatedTickers") or content.get("relatedTickers") or []

    return {
        "title": title,
        "summary": summary,
        "link": link,
        "publisher": publisher or "Yahoo Finance",
        "publishedAt": published_at,
        "sourceTicker": source_ticker,
        "market": market,
        "relatedTickers": related if isinstance(related, list) else [],
    }


def fetch_ticker_news(ticker: str) -> list[dict[str, Any]]:
    try:
        news = yf.Ticker(ticker).news
        return news if isinstance(news, list) else []
    except Exception:
        return []


def _is_mostly_korean(text: str) -> bool:
    hangul = len(re.findall(r"[가-힣]", text))
    letters = len(re.findall(r"[A-Za-z가-힣]", text))
    return letters > 0 and hangul / letters >= 0.35


def _translate_text(text: str, target: str = "ko") -> str:
    if not text or target != "ko" or _is_mostly_korean(text):
        return text
    cached = _translate_cache.get(text)
    if cached:
        return cached
    try:
        chunk = text[:4500]
        translated = GoogleTranslator(source="auto", target="ko").translate(chunk)
        result = translated or text
        _translate_cache[text] = result
        return result
    except Exception:
        return text


def _translate_title(title: str, target: str = "ko") -> str:
    return _translate_text(title, target)


POSITIVE_KEYWORDS = [
    "surge", "soar", "rally", "gain", "gains", "profit", "profits", "beat", "beats",
    "upgrade", "upgraded", "growth", "record", "high", "bullish", "outperform",
    "strong", "boost", "rise", "rises", "rising", "jump", "jumps", "buy", "positive",
    "상승", "급등", "호재", "흑자", "실적 호조", "목표가 상향", "매수", "성장", "최고",
    "호조", "개선", "증가", "돌파", "강세", "수주", "흑전",
]

NEGATIVE_KEYWORDS = [
    "fall", "falls", "drop", "drops", "plunge", "plunges", "loss", "losses", "miss",
    "misses", "downgrade", "downgraded", "layoff", "layoffs", "recession", "bearish",
    "weak", "decline", "declines", "cut", "cuts", "lawsuit", "fine", "probe", "warning",
    "crash", "slump", "sell", "negative", "underperform",
    "하락", "급락", "악재", "적자", "실적 부진", "목표가 하향", "매도", "감소", "약세",
    "축소", "구조조정", "소송", "규제", "적신호", "우려", "부진",
]


def analyze_sentiment(title: str, summary: str) -> tuple[str, str]:
    text = f"{title} {summary}".lower()
    score = 0
    for kw in POSITIVE_KEYWORDS:
        if kw.lower() in text:
            score += 1
    for kw in NEGATIVE_KEYWORDS:
        if kw.lower() in text:
            score -= 1
    if score >= 1:
        return "bullish", "호재"
    if score <= -1:
        return "bearish", "악재"
    return "neutral", "중립"


def _truncate(text: str, max_len: int = 160) -> str:
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def _enrich_items(items: list[dict[str, Any]], lang: str) -> list[dict[str, Any]]:
    texts_to_translate: list[tuple[dict[str, Any], str, str]] = []
    for item in items:
        if lang == "ko":
            if item.get("summary") and not _is_mostly_korean(item["summary"]):
                texts_to_translate.append((item, "summary", item["summary"]))

    if texts_to_translate:
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = {
                pool.submit(_translate_text, text, "ko"): (item, field, text)
                for item, field, text in texts_to_translate
            }
            for future in as_completed(futures):
                item, field, original = futures[future]
                try:
                    translated = future.result()
                    if translated != original:
                        item[f"{field}Original"] = original
                        item[field] = translated
                except Exception:
                    pass

    for item in items:
        summary = item.get("summary") or ""
        if not summary:
            summary = item.get("title") or ""
        item["summaryShort"] = _truncate(summary, 180)
        sentiment, label = analyze_sentiment(item.get("title") or "", summary)
        item["sentiment"] = sentiment
        item["sentimentLabel"] = label
    return items


def _apply_korean_titles(items: list[dict[str, Any]], max_translate: int = 12) -> list[dict[str, Any]]:
    to_translate = [
        item
        for item in items[:max_translate]
        if not _is_mostly_korean(item.get("title") or "")
    ]
    if not to_translate:
        for item in items:
            item["translated"] = False
        return items

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            pool.submit(_translate_title, item["title"], "ko"): item
            for item in to_translate
            if item.get("title")
        }
        for future in as_completed(futures):
            item = futures[future]
            original = item["title"]
            try:
                item["titleOriginal"] = original
                item["title"] = future.result()
                item["translated"] = item["title"] != original
            except Exception:
                item["translated"] = False

    for item in items:
        if "translated" not in item:
            item["translated"] = False
    return items


def collect_headlines(market: str, limit: int, lang: str = "ko") -> dict[str, Any]:
    cache_key = f"{market}:{limit}:{lang}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached["ts"] < CACHE_TTL:
        payload = dict(cached["data"])
        payload["cached"] = True
        payload["cacheAgeSeconds"] = int(now - cached["ts"])
        return payload

    ticker_pairs: list[tuple[str, str]] = []
    if market in ("all", "us"):
        ticker_pairs.extend((t, "us") for t in US_TICKERS)
    if market in ("all", "kr"):
        ticker_pairs.extend((t, "kr") for t in KR_TICKERS)

    seen: set[str] = set()
    items: list[dict[str, Any]] = []

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {
            pool.submit(fetch_ticker_news, ticker): (ticker, mkt)
            for ticker, mkt in ticker_pairs
        }
        for future in as_completed(futures):
            ticker, mkt = futures[future]
            try:
                raw_items = future.result()
            except Exception:
                continue
            for raw in raw_items:
                if not isinstance(raw, dict):
                    continue
                item = normalize_news_item(raw, ticker, mkt)
                if not item:
                    continue
                dedupe_key = (item.get("link") or item.get("title") or "").strip().lower()
                if not dedupe_key or dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
                items.append(item)

    items.sort(key=lambda x: x.get("publishedAt") or 0, reverse=True)
    items = items[:limit]

    if lang == "ko":
        items = _apply_korean_titles(items)

    items = _enrich_items(items, lang)

    payload = {
        "market": market,
        "lang": lang,
        "count": len(items),
        "items": items,
        "cached": False,
        "cacheAgeSeconds": 0,
    }
    _cache[cache_key] = {"ts": now, "data": payload}
    return payload


def _ticker_display_name(ticker: str) -> str:
    return TICKER_NAMES.get(ticker, ticker)


def _fetch_price_change(ticker: str) -> dict[str, Any]:
    try:
        hist = yf.Ticker(ticker).history(period="5d", interval="1d")
        if hist is None or hist.empty or len(hist) < 2:
            return {"price": None, "changePct": None}
        last = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2])
        if prev == 0:
            return {"price": last, "changePct": None}
        return {"price": round(last, 2), "changePct": round((last / prev - 1) * 100, 2)}
    except Exception:
        return {"price": None, "changePct": None}


def _score_ticker(
    ticker: str,
    market: str,
    bullish: int,
    bearish: int,
    change_pct: float | None,
) -> tuple[int, str]:
    score = bullish * 3 - bearish * 2
    reasons: list[str] = []

    if bullish:
        reasons.append(f"최근 호재 뉴스 {bullish}건")
    if bearish:
        reasons.append(f"악재 뉴스 {bearish}건")

    if change_pct is not None:
        if change_pct > 0:
            score += 2
            reasons.append(f"최근 1일 상승 {change_pct:+.2f}%")
        elif change_pct < 0:
            score -= 1
            reasons.append(f"최근 1일 하락 {change_pct:+.2f}%")
        else:
            reasons.append("최근 가격 횡보")

    if not reasons:
        reasons.append("뉴스·가격 데이터 기반 종합 점수")

    if score >= 8:
        stance = "적극 관심"
    elif score >= 4:
        stance = "관심"
    else:
        stance = "관망"

    reason = f"{stance} — " + " · ".join(reasons[:3])
    return score, reason


def collect_recommendations(market: str, limit: int = 8, lang: str = "ko") -> dict[str, Any]:
    cache_key = f"recs:{market}:{limit}:{lang}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached["ts"] < CACHE_TTL:
        payload = dict(cached["data"])
        payload["cached"] = True
        payload["cacheAgeSeconds"] = int(now - cached["ts"])
        return payload

    headlines = collect_headlines(market, limit=80, lang=lang)
    sentiment_map: dict[str, dict[str, int]] = {}

    for item in headlines.get("items", []):
        tickers = {item.get("sourceTicker")}
        related = item.get("relatedTickers") or []
        if isinstance(related, list):
            tickers.update(t for t in related if isinstance(t, str))
        sentiment = item.get("sentiment") or "neutral"
        for ticker in tickers:
            if not ticker or ticker not in PICK_TICKERS:
                continue
            bucket = sentiment_map.setdefault(ticker, {"bullish": 0, "bearish": 0, "neutral": 0})
            bucket[sentiment] = bucket.get(sentiment, 0) + 1

    candidates: list[dict[str, Any]] = []
    tickers = [t for t, mkt in PICK_TICKERS.items() if market in ("all", mkt)]

    quotes: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        quote_futures = {pool.submit(_fetch_price_change, ticker): ticker for ticker in tickers}
        for future in as_completed(quote_futures):
            ticker = quote_futures[future]
            try:
                quotes[ticker] = future.result()
            except Exception:
                quotes[ticker] = {"price": None, "changePct": None}

    for ticker, mkt in PICK_TICKERS.items():
        if market not in ("all", mkt):
            continue
        counts = sentiment_map.get(ticker, {"bullish": 0, "bearish": 0, "neutral": 0})
        quote = quotes.get(ticker, {"price": None, "changePct": None})
        score, reason = _score_ticker(
            ticker,
            mkt,
            counts["bullish"],
            counts["bearish"],
            quote.get("changePct"),
        )
        if score < 2 and counts["bullish"] == 0:
            continue
        candidates.append(
            {
                "ticker": ticker,
                "name": _ticker_display_name(ticker),
                "market": mkt,
                "score": score,
                "stance": "buy" if score >= 4 else "watch",
                "stanceLabel": "관심" if score >= 4 else "관망",
                "reason": reason,
                "price": quote.get("price"),
                "changePct": quote.get("changePct"),
                "bullishNews": counts["bullish"],
                "bearishNews": counts["bearish"],
            }
        )

    candidates.sort(key=lambda x: (x["score"], x.get("changePct") or 0), reverse=True)
    picks = candidates[:limit]

    payload = {
        "market": market,
        "lang": lang,
        "count": len(picks),
        "items": picks,
        "cached": False,
        "cacheAgeSeconds": 0,
        "disclaimer": "자동 분석 기반 참고용 추천이며 투자 권유가 아닙니다.",
    }
    _cache[cache_key] = {"ts": now, "data": payload}
    return payload


@app.get("/")
def root():
    return {
        "service": "First Stock API",
        "endpoints": {
            "headlines": "/api/headlines?market=all|kr|us&lang=ko&limit=40",
            "recommendations": "/api/recommendations?market=all|kr|us&lang=ko&limit=8",
            "health": "/health",
        },
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/headlines")
def headlines(
    market: str = Query("all", pattern="^(all|kr|us)$"),
    limit: int = Query(40, ge=5, le=80),
    lang: str = Query("ko", pattern="^(ko|original)$"),
):
    try:
        return collect_headlines(market, limit, lang)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch headlines: {exc}") from exc


@app.get("/api/recommendations")
def recommendations(
    market: str = Query("all", pattern="^(all|kr|us)$"),
    limit: int = Query(8, ge=3, le=15),
    lang: str = Query("ko", pattern="^(ko|original)$"),
):
    try:
        return collect_recommendations(market, limit, lang)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to build recommendations: {exc}") from exc
