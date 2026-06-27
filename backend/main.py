"""Stock headlines API powered by yfinance (Yahoo Finance)."""

from __future__ import annotations

import json
import math
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
    "373220.KS",
    "207940.KS",
    "005380.KS",
    "329180.KS",
    "000270.KS",
    "105560.KS",
    "035420.KS",
    "055550.KS",
    "247540.KQ",
    "196170.KQ",
    "277810.KQ",
    "086520.KQ",
    "403870.KQ",
    "141080.KQ",
    "028300.KQ",
    "145020.KQ",
    "214450.KQ",
    "310210.KQ",
]

# 시가총액 상위 10 (수동 갱신 — 참고용 고정 리스트)
KOSPI_TOP_10: list[tuple[str, str]] = [
    ("005930.KS", "삼성전자"),
    ("000660.KS", "SK하이닉스"),
    ("373220.KS", "LG에너지솔루션"),
    ("207940.KS", "삼성바이오로직스"),
    ("005380.KS", "현대차"),
    ("329180.KS", "HD현대중공업"),
    ("000270.KS", "기아"),
    ("105560.KS", "KB금융"),
    ("035420.KS", "NAVER"),
    ("055550.KS", "신한지주"),
]

KOSDAQ_TOP_10: list[tuple[str, str]] = [
    ("247540.KQ", "에코프로비엠"),
    ("196170.KQ", "알테오젠"),
    ("277810.KQ", "레인보우로보틱스"),
    ("086520.KQ", "에코프로"),
    ("403870.KQ", "HPSP"),
    ("141080.KQ", "레고켐바이오"),
    ("028300.KQ", "HLB"),
    ("145020.KQ", "휴젤"),
    ("214450.KQ", "파마리서치"),
    ("310210.KQ", "보로노이"),
]

US_TOP_10: list[tuple[str, str]] = [
    ("AAPL", "Apple"),
    ("MSFT", "Microsoft"),
    ("NVDA", "NVIDIA"),
    ("GOOGL", "Alphabet"),
    ("AMZN", "Amazon"),
    ("META", "Meta"),
    ("TSLA", "Tesla"),
    ("AVGO", "Broadcom"),
    ("BRK-B", "Berkshire Hathaway"),
    ("LLY", "Eli Lilly"),
]

MARKET_UNIVERSES: dict[str, dict[str, Any]] = {
    "kr_kospi": {
        "title": "KOSPI 시가총액 TOP 10",
        "segment": "kospi",
        "headline_market": "kr",
        "stocks": KOSPI_TOP_10,
    },
    "kr_kosdaq": {
        "title": "KOSDAQ 시가총액 TOP 10",
        "segment": "kosdaq",
        "headline_market": "kr",
        "stocks": KOSDAQ_TOP_10,
    },
    "us": {
        "title": "미국 시가총액 TOP 10",
        "segment": "us",
        "headline_market": "us",
        "stocks": US_TOP_10,
    },
}

PICK_TICKERS = {
    ticker: "kr" if ticker.endswith((".KS", ".KQ")) else "us"
    for ticker, _ in KOSPI_TOP_10 + KOSDAQ_TOP_10 + US_TOP_10
}

TICKER_NAMES = {ticker: name for ticker, name in KOSPI_TOP_10 + KOSDAQ_TOP_10 + US_TOP_10}
TICKER_NAMES.update({
    "035720.KQ": "카카오",
    "051910.KS": "LG화학",
    "006400.KS": "삼성SDI",
})

CACHE_TTL = int(os.getenv("HEADLINES_CACHE_TTL", "600"))
PICKS_NEWS_WINDOW_DAYS = int(os.getenv("PICKS_NEWS_WINDOW_DAYS", "7"))
PICKS_MAX_ARTICLES_PER_SENTIMENT = int(os.getenv("PICKS_MAX_ARTICLES_PER_SENTIMENT", "5"))
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


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not math.isfinite(value):
            return None
        return value
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if hasattr(value, "item"):
        try:
            return _json_safe(value.item())
        except Exception:
            return str(value)
    return str(value)


def _parse_timestamp(value: Any) -> int:
    if value is None:
        return 0
    if hasattr(value, "item"):
        try:
            value = value.item()
        except Exception:
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


def _image_url_from_thumbnail_field(field: Any) -> str | None:
    if isinstance(field, str) and field.startswith("http"):
        return field
    if not isinstance(field, dict):
        return None

    for key in ("originalUrl", "url"):
        url = field.get(key)
        if isinstance(url, str) and url.startswith("http"):
            return url

    resolutions = field.get("resolutions")
    if isinstance(resolutions, list) and resolutions:
        candidates: list[tuple[int, str]] = []
        for res in resolutions:
            if not isinstance(res, dict):
                continue
            url = res.get("url")
            if not isinstance(url, str) or not url.startswith("http"):
                continue
            width = int(res.get("width") or 0)
            candidates.append((width, url))

        if candidates:
            in_range = [item for item in candidates if 72 <= item[0] <= 220]
            if in_range:
                return min(in_range, key=lambda item: item[0])[1]
            return min(candidates, key=lambda item: abs(item[0] - 120))[1]

    return None


def _image_url_from_raw(raw: dict[str, Any], content: dict[str, Any]) -> str | None:
    for source in (
        content.get("thumbnail"),
        raw.get("thumbnail"),
        content.get("heroImage"),
        raw.get("heroImage"),
        content.get("previewImage"),
        content.get("image"),
    ):
        url = _image_url_from_thumbnail_field(source)
        if url:
            return url
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
    image_url = _image_url_from_raw(raw, content)

    item: dict[str, Any] = {
        "title": title,
        "summary": summary,
        "link": link,
        "publisher": publisher or "Yahoo Finance",
        "publishedAt": published_at,
        "sourceTicker": source_ticker,
        "market": market,
        "relatedTickers": related if isinstance(related, list) else [],
    }
    if image_url:
        item["imageUrl"] = image_url
    return item


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
        last = _safe_float(hist["Close"].iloc[-1])
        prev = _safe_float(hist["Close"].iloc[-2])
        if last is None or prev is None:
            return {"price": None, "changePct": None}
        if prev == 0:
            return {"price": round(last, 2), "changePct": None}
        change_pct = _safe_float((last / prev - 1) * 100)
        return {
            "price": round(last, 2),
            "changePct": round(change_pct, 2) if change_pct is not None else None,
        }
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
        reasons.append(f"최근 {PICKS_NEWS_WINDOW_DAYS}일 호재 뉴스 {bullish}건")
    if bearish:
        reasons.append(f"최근 {PICKS_NEWS_WINDOW_DAYS}일 악재 뉴스 {bearish}건")

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


def _recommendation_status(score: int, bullish: int, bearish: int) -> tuple[bool, str, str]:
    if bearish >= 2 and bearish > bullish:
        return False, "주의", "caution"
    if score >= 4:
        return True, "추천", "recommend"
    return False, "관망", "watch"


def _pick_article_payload(item: dict[str, Any], sentiment: str, label: str) -> dict[str, Any]:
    summary = item.get("summary") or ""
    payload: dict[str, Any] = {
        "title": item.get("title") or "",
        "summaryShort": _truncate(summary or item.get("title") or "", 140),
        "publishedAt": item.get("publishedAt"),
        "link": item.get("link"),
        "sentiment": sentiment,
        "sentimentLabel": label,
    }
    if item.get("imageUrl"):
        payload["imageUrl"] = item["imageUrl"]
    return payload


def _normalize_logo_url(url: str | None) -> str | None:
    if not isinstance(url, str):
        return None
    trimmed = url.strip()
    if trimmed.startswith("https://"):
        return trimmed
    if trimmed.startswith("http://"):
        return "https://" + trimmed[len("http://") :]
    return None


def _fetch_logo_url(ticker: str) -> str | None:
    kr_match = re.match(r"^(\d{6})\.(KS|KQ)$", ticker, re.I)
    if kr_match:
        return f"https://ssl.pstatic.net/imgstock/fn/real/logo/{kr_match.group(1)}.png"

    try:
        info = yf.Ticker(ticker).info or {}
        logo = _normalize_logo_url(info.get("logo_url") or info.get("logoUrl"))
        if logo:
            return logo
    except Exception:
        pass

    symbol = ticker.split(".")[0].upper()
    if symbol.isalpha() and 1 <= len(symbol) <= 5:
        return f"https://financialmodelingprep.com/image-stock/{symbol}.png"
    return None


def _pick_display_image(
    logo_url: str | None,
    bullish_articles: list[dict[str, Any]],
    bearish_articles: list[dict[str, Any]],
) -> str | None:
    normalized_logo = _normalize_logo_url(logo_url)
    if normalized_logo:
        return normalized_logo
    for articles in (bullish_articles, bearish_articles):
        for article in articles:
            url = _normalize_logo_url(article.get("imageUrl"))
            if url:
                return url
    return None


def _analyze_ticker_news(ticker: str, market: str, lang: str = "ko") -> dict[str, Any]:
    cutoff = time.time() - PICKS_NEWS_WINDOW_DAYS * 86400
    counts = {"bullish": 0, "bearish": 0, "neutral": 0}
    bullish_articles: list[dict[str, Any]] = []
    bearish_articles: list[dict[str, Any]] = []
    included_times: list[int] = []

    for raw in fetch_ticker_news(ticker):
        if not isinstance(raw, dict):
            continue
        item = normalize_news_item(raw, ticker, market)
        if not item:
            continue

        published_at = int(item.get("publishedAt") or 0)
        if published_at and published_at < cutoff:
            continue

        if published_at:
            included_times.append(published_at)

        sentiment, label = analyze_sentiment(item.get("title") or "", item.get("summary") or "")
        counts[sentiment] = counts.get(sentiment, 0) + 1

        article = _pick_article_payload(item, sentiment, label)
        if sentiment == "bullish" and len(bullish_articles) < PICKS_MAX_ARTICLES_PER_SENTIMENT:
            bullish_articles.append(article)
        elif sentiment == "bearish" and len(bearish_articles) < PICKS_MAX_ARTICLES_PER_SENTIMENT:
            bearish_articles.append(article)

    bullish_articles.sort(key=lambda row: row.get("publishedAt") or 0, reverse=True)
    bearish_articles.sort(key=lambda row: row.get("publishedAt") or 0, reverse=True)

    if lang == "ko":
        for article in bullish_articles + bearish_articles:
            title = article.get("title") or ""
            if title and not _is_mostly_korean(title):
                article["title"] = _translate_title(title, "ko")

    return {
        "counts": counts,
        "bullishArticles": bullish_articles,
        "bearishArticles": bearish_articles,
        "newsWindowDays": PICKS_NEWS_WINDOW_DAYS,
        "newsAnalyzedFrom": min(included_times) if included_times else None,
        "newsAnalyzedTo": max(included_times) if included_times else None,
    }


def collect_recommendations(market: str, limit: int = 10, lang: str = "ko") -> dict[str, Any]:
    if market not in MARKET_UNIVERSES:
        raise ValueError(f"Unknown market: {market}")

    universe = MARKET_UNIVERSES[market]
    stocks = universe["stocks"][:limit]

    cache_key = f"recs:{market}:{limit}:{lang}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached["ts"] < CACHE_TTL:
        payload = _json_safe(dict(cached["data"]))
        payload["cached"] = True
        payload["cacheAgeSeconds"] = int(now - cached["ts"])
        return payload

    mkt_label = "kr" if market.startswith("kr_") else "us"
    analyses: dict[str, dict[str, Any]] = {}
    logos: dict[str, str | None] = {}
    quotes: dict[str, dict[str, Any]] = {}

    with ThreadPoolExecutor(max_workers=8) as pool:
        analysis_futures = {
            pool.submit(_analyze_ticker_news, ticker, mkt_label, lang): ticker
            for ticker, _ in stocks
        }
        logo_futures = {
            pool.submit(_fetch_logo_url, ticker): ticker for ticker, _ in stocks
        }
        quote_futures = {
            pool.submit(_fetch_price_change, ticker): ticker for ticker, _ in stocks
        }
        for future in as_completed(analysis_futures):
            ticker = analysis_futures[future]
            try:
                analyses[ticker] = future.result()
            except Exception:
                analyses[ticker] = {
                    "counts": {"bullish": 0, "bearish": 0, "neutral": 0},
                    "bullishArticles": [],
                    "bearishArticles": [],
                    "newsWindowDays": PICKS_NEWS_WINDOW_DAYS,
                    "newsAnalyzedFrom": None,
                    "newsAnalyzedTo": None,
                }
        for future in as_completed(logo_futures):
            ticker = logo_futures[future]
            try:
                logos[ticker] = future.result()
            except Exception:
                logos[ticker] = None
        for future in as_completed(quote_futures):
            ticker = quote_futures[future]
            try:
                quotes[ticker] = future.result()
            except Exception:
                quotes[ticker] = {"price": None, "changePct": None}

    picks: list[dict[str, Any]] = []
    for rank, (ticker, name) in enumerate(stocks, start=1):
        analysis = analyses.get(ticker, {})
        counts = analysis.get("counts", {"bullish": 0, "bearish": 0, "neutral": 0})
        bullish_articles = analysis.get("bullishArticles", [])
        bearish_articles = analysis.get("bearishArticles", [])
        quote = quotes.get(ticker, {"price": None, "changePct": None})
        logo_url = logos.get(ticker)
        image_url = _pick_display_image(logo_url, bullish_articles, bearish_articles)
        score, reason = _score_ticker(
            ticker,
            mkt_label,
            counts["bullish"],
            counts["bearish"],
            quote.get("changePct"),
        )
        recommended, recommend_label, stance = _recommendation_status(
            score, counts["bullish"], counts["bearish"]
        )
        pick: dict[str, Any] = {
            "rank": rank,
            "ticker": ticker,
            "name": name,
            "market": mkt_label,
            "segment": universe["segment"],
            "score": score,
            "recommended": recommended,
            "recommendLabel": recommend_label,
            "stance": stance,
            "stanceLabel": recommend_label,
            "reason": reason,
            "price": quote.get("price"),
            "changePct": quote.get("changePct"),
            "bullishNews": counts["bullish"],
            "bearishNews": counts["bearish"],
            "bullishArticles": bullish_articles,
            "bearishArticles": bearish_articles,
            "newsWindowDays": analysis.get("newsWindowDays", PICKS_NEWS_WINDOW_DAYS),
            "newsAnalyzedFrom": analysis.get("newsAnalyzedFrom"),
            "newsAnalyzedTo": analysis.get("newsAnalyzedTo"),
        }
        if image_url:
            pick["imageUrl"] = image_url
        if logo_url:
            pick["logoUrl"] = logo_url
        picks.append(pick)

    payload = {
        "market": market,
        "segmentTitle": universe["title"],
        "lang": lang,
        "count": len(picks),
        "items": picks,
        "newsWindowDays": PICKS_NEWS_WINDOW_DAYS,
        "newsWindowLabel": f"최근 {PICKS_NEWS_WINDOW_DAYS}일 뉴스 기준",
        "cached": False,
        "cacheAgeSeconds": 0,
        "disclaimer": "시가총액 상위 종목 기준 자동 분석 참고용이며 투자 권유가 아닙니다.",
    }
    payload = _json_safe(payload)
    _cache[cache_key] = {"ts": now, "data": payload}
    return payload


def _empty_market_payload(market: str, lang: str, error: str | None = None) -> dict[str, Any]:
    universe = MARKET_UNIVERSES[market]
    payload: dict[str, Any] = {
        "market": market,
        "segmentTitle": universe["title"],
        "lang": lang,
        "count": 0,
        "items": [],
        "newsWindowDays": PICKS_NEWS_WINDOW_DAYS,
        "newsWindowLabel": f"최근 {PICKS_NEWS_WINDOW_DAYS}일 뉴스 기준",
        "cached": False,
        "cacheAgeSeconds": 0,
        "disclaimer": "시가총액 상위 종목 기준 자동 분석 참고용이며 투자 권유가 아닙니다.",
    }
    if error:
        payload["error"] = error
    return payload


def collect_recommendations_bundle(limit: int = 10, lang: str = "ko") -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    markets: dict[str, Any] = {}
    for market_id in MARKET_UNIVERSES:
        try:
            markets[market_id] = collect_recommendations(market_id, limit, lang)
        except Exception as exc:
            markets[market_id] = _empty_market_payload(market_id, lang, str(exc))
    payload = {
        "version": 1,
        "updatedAt": now.isoformat(),
        "updateSchedule": "방문·새로고침 시 실시간 분석",
        "trigger": "live",
        "lang": lang,
        "newsWindowDays": PICKS_NEWS_WINDOW_DAYS,
        "newsWindowLabel": f"최근 {PICKS_NEWS_WINDOW_DAYS}일 뉴스 기준",
        "markets": markets,
    }
    return _json_safe(payload)


@app.get("/")
def root():
    return {
        "service": "First Stock API",
        "endpoints": {
            "headlines": "/api/headlines?market=all|kr|us&lang=ko&limit=40",
            "recommendations": "/api/recommendations?market=kr_kospi|kr_kosdaq|us&lang=ko&limit=10",
            "recommendations_bundle": "/api/recommendations/bundle?limit=10&lang=ko",
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


@app.get("/api/recommendations/bundle")
def recommendations_bundle(
    limit: int = Query(10, ge=1, le=10),
    lang: str = Query("ko", pattern="^(ko|original)$"),
):
    try:
        payload = collect_recommendations_bundle(limit, lang)
        json.dumps(payload)
        return payload
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to build recommendations bundle: {exc}") from exc


@app.get("/api/recommendations")
def recommendations(
    market: str = Query("kr_kospi", pattern="^(kr_kospi|kr_kosdaq|us)$"),
    limit: int = Query(10, ge=1, le=10),
    lang: str = Query("ko", pattern="^(ko|original)$"),
):
    try:
        payload = collect_recommendations(market, limit, lang)
        json.dumps(payload)
        return payload
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to build recommendations: {exc}") from exc
