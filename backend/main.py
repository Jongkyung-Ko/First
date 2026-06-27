"""Stock headlines API powered by yfinance (Yahoo Finance)."""

from __future__ import annotations

import base64
import json
import math
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

import yfinance as yf
from deep_translator import GoogleTranslator
from fastapi import Body, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from predictions import (
    accuracy_summary_for_market,
    accuracy_summary_for_ticker,
    backfill_closes_for_group,
    finalize_predictions_for_group,
    record_predictions_for_group,
)

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
CRON_SECRET = os.getenv("CRON_SECRET", "").strip()
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
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=[
        "X-TTS-Engine",
        "X-TTS-Chars-Used",
        "X-TTS-Monthly-Used",
        "X-TTS-Monthly-Limit",
        "X-TTS-Hourly-Used",
        "X-TTS-Hourly-Limit",
    ],
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
    if "ssl.pstatic.net/imgstock" in trimmed:
        return None
    if trimmed.startswith("https://"):
        return trimmed
    if trimmed.startswith("http://"):
        return "https://" + trimmed[len("http://") :]
    return None


def _kr_fmp_logo_url(ticker: str) -> str | None:
    kr_match = re.match(r"^(\d{6})\.(KS|KQ)$", ticker, re.I)
    if not kr_match:
        return None
    code = kr_match.group(1)
    exchange = kr_match.group(2).upper()
    return f"https://images.financialmodelingprep.com/symbol/{code}.{exchange}.png"


def _fetch_logo_url(ticker: str) -> str | None:
    fmp_kr = _kr_fmp_logo_url(ticker)
    if fmp_kr:
        return fmp_kr

    try:
        info = yf.Ticker(ticker).info or {}
        logo = _normalize_logo_url(info.get("logo_url") or info.get("logoUrl"))
        if logo and "ssl.pstatic.net/imgstock" not in logo:
            return logo
    except Exception:
        pass

    symbol = ticker.split(".")[0].upper()
    if symbol.isalpha() and 1 <= len(symbol) <= 5:
        return f"https://images.financialmodelingprep.com/symbol/{symbol}.png"
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


def _news_relates_to_ticker(item: dict[str, Any], ticker: str) -> bool:
    related = {item.get("sourceTicker"), *(item.get("relatedTickers") or [])}
    if ticker in related:
        return True

    blob = f"{item.get('title') or ''} {item.get('summary') or ''}".lower()
    name = TICKER_NAMES.get(ticker, "")
    if name and name.lower() in blob:
        return True

    aliases = {
        "000660.KS": ["sk hynix", "하이닉스"],
        "005930.KS": ["samsung", "삼성전자", "삼성 전자"],
        "035420.KS": ["naver", "네이버"],
        "005380.KS": ["hyundai motor", "현대차"],
        "000270.KS": ["kia", "기아"],
    }
    for token in aliases.get(ticker, []):
        if token in blob:
            return True
    return False


def _ingest_pick_news_item(
    item: dict[str, Any],
    cutoff: int,
    counts: dict[str, int],
    bullish_articles: list[dict[str, Any]],
    bearish_articles: list[dict[str, Any]],
    included_times: list[int],
) -> None:
    published_at = int(item.get("publishedAt") or 0)
    if published_at and published_at < cutoff:
        return

    if published_at:
        included_times.append(published_at)

    sentiment, label = analyze_sentiment(item.get("title") or "", item.get("summary") or "")
    counts[sentiment] = counts.get(sentiment, 0) + 1

    article = _pick_article_payload(item, sentiment, label)
    if sentiment == "bullish" and len(bullish_articles) < PICKS_MAX_ARTICLES_PER_SENTIMENT:
        bullish_articles.append(article)
    elif sentiment == "bearish" and len(bearish_articles) < PICKS_MAX_ARTICLES_PER_SENTIMENT:
        bearish_articles.append(article)


def _analyze_ticker_news(ticker: str, market: str, lang: str = "ko") -> dict[str, Any]:
    cutoff = time.time() - PICKS_NEWS_WINDOW_DAYS * 86400
    counts = {"bullish": 0, "bearish": 0, "neutral": 0}
    bullish_articles: list[dict[str, Any]] = []
    bearish_articles: list[dict[str, Any]] = []
    included_times: list[int] = []
    seen_keys: set[str] = set()

    for raw in fetch_ticker_news(ticker):
        if not isinstance(raw, dict):
            continue
        item = normalize_news_item(raw, ticker, market)
        if not item:
            continue
        dedupe_key = (item.get("link") or item.get("title") or "").strip().lower()
        if not dedupe_key or dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)
        _ingest_pick_news_item(item, int(cutoff), counts, bullish_articles, bearish_articles, included_times)

    if sum(counts.values()) == 0:
        pool: list[tuple[str, str]] = []
        if market == "kr":
            pool = [(t, "kr") for t, _ in KOSPI_TOP_10 + KOSDAQ_TOP_10]
        else:
            pool = [(t, "us") for t, _ in US_TOP_10]

        for pool_ticker, pool_market in pool:
            for raw in fetch_ticker_news(pool_ticker):
                if not isinstance(raw, dict):
                    continue
                item = normalize_news_item(raw, pool_ticker, pool_market)
                if not item or not _news_relates_to_ticker(item, ticker):
                    continue
                dedupe_key = (item.get("link") or item.get("title") or "").strip().lower()
                if not dedupe_key or dedupe_key in seen_keys:
                    continue
                seen_keys.add(dedupe_key)
                _ingest_pick_news_item(item, int(cutoff), counts, bullish_articles, bearish_articles, included_times)

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



def _is_allowed_chart_ticker(ticker: str) -> bool:
    if ticker in PICK_TICKERS:
        return True
    if re.match(r"^\d{6}\.(KS|KQ)$", ticker, re.I):
        return True
    if re.match(r"^[A-Z][A-Z0-9.\-]{0,9}$", ticker):
        return True
    return False


def collect_chart_data(ticker: str, period: str = "3mo", interval: str = "1d") -> dict[str, Any]:
    if not _is_allowed_chart_ticker(ticker):
        raise ValueError(f"Unsupported ticker: {ticker}")

    cache_key = f"chart:{ticker}:{period}:{interval}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached["ts"] < CACHE_TTL:
        payload = _json_safe(dict(cached["data"]))
        payload["cached"] = True
        payload["cacheAgeSeconds"] = int(now - cached["ts"])
        return payload

    try:
        hist = yf.Ticker(ticker).history(period=period, interval=interval, auto_adjust=False)
    except Exception as exc:
        raise RuntimeError(f"Failed to fetch chart for {ticker}: {exc}") from exc

    candles: list[dict[str, Any]] = []
    if hist is not None and not hist.empty:
        for idx, row in hist.iterrows():
            close = _safe_float(row.get("Close"))
            if close is None:
                continue
            open_px = _safe_float(row.get("Open")) or close
            high_px = _safe_float(row.get("High")) or close
            low_px = _safe_float(row.get("Low")) or close
            volume = _safe_float(row.get("Volume")) or 0
            if hasattr(idx, "strftime"):
                time_label = idx.strftime("%Y-%m-%d")
            else:
                time_label = str(idx)[:10]
            candles.append(
                {
                    "time": time_label,
                    "open": round(open_px, 4),
                    "high": round(high_px, 4),
                    "low": round(low_px, 4),
                    "close": round(close, 4),
                    "volume": int(volume),
                }
            )

    market = PICK_TICKERS.get(ticker, "us" if not ticker.endswith((".KS", ".KQ")) else "kr")
    payload = _json_safe(
        {
            "ticker": ticker,
            "name": TICKER_NAMES.get(ticker, ticker),
            "market": market,
            "period": period,
            "interval": interval,
            "count": len(candles),
            "candles": candles,
            "cached": False,
            "cacheAgeSeconds": 0,
        }
    )
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
        "version": 2,
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
            "chart": "/api/chart?ticker=005930.KS&period=3mo&interval=1d",
            "predictions_history": "/api/predictions/history?ticker=005930.KS&market=kr_kospi&days=30",
            "predictions_summary": "/api/predictions/summary?market=kr_kospi&days=30",
            "predictions_backfill": "POST /api/predictions/backfill?market=all|kr|us&days=30",
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


@app.get("/api/chart")
def chart(
    ticker: str = Query(..., min_length=3, max_length=16),
    period: str = Query("3mo", pattern="^(1mo|3mo|6mo|1y|2y)$"),
    interval: str = Query("1d", pattern="^(1d|1wk)$"),
):
    try:
        payload = collect_chart_data(ticker, period, interval)
        json.dumps(payload)
        return payload
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch chart: {exc}") from exc


def _verify_cron(authorization: str | None = Header(default=None)) -> None:
    if not CRON_SECRET:
        return
    if authorization != f"Bearer {CRON_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.post("/api/predictions/record")
def predictions_record(
    market: str = Query(..., pattern="^(kr|us)$"),
    authorization: str | None = Header(default=None),
):
    _verify_cron(authorization)
    try:
        return record_predictions_for_group(market, collect_recommendations)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to record predictions: {exc}") from exc


@app.post("/api/predictions/finalize")
def predictions_finalize(
    market: str = Query(..., pattern="^(kr|us)$"),
    authorization: str | None = Header(default=None),
):
    _verify_cron(authorization)
    try:
        return finalize_predictions_for_group(market)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to finalize predictions: {exc}") from exc


@app.post("/api/predictions/backfill")
def predictions_backfill(
    market: str = Query("all", pattern="^(all|kr|us)$"),
    days: int = Query(30, ge=1, le=60),
    authorization: str | None = Header(default=None),
):
    _verify_cron(authorization)
    try:
        return backfill_closes_for_group(market, collect_recommendations, days)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to backfill prediction closes: {exc}") from exc


@app.get("/api/predictions/history")
def predictions_history(
    ticker: str = Query(..., min_length=3, max_length=16),
    market: str | None = Query(None, pattern="^(kr_kospi|kr_kosdaq|us)$"),
    days: int = Query(30, ge=1, le=60),
):
    try:
        return accuracy_summary_for_ticker(ticker, market, days)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch prediction history: {exc}") from exc


@app.get("/api/predictions/summary")
def predictions_summary(
    market: str = Query(..., pattern="^(kr_kospi|kr_kosdaq|us)$"),
    days: int = Query(30, ge=1, le=60),
):
    try:
        return accuracy_summary_for_market(market, days)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch prediction summary: {exc}") from exc


GUTENDEX_BASE = "https://gutendex.com"
GUTENDEX_UA = "First-Books-API/1.0 (Project Gutenberg reader; commercial PD only)"


def _gutendex_request(path: str, params: dict[str, Any] | None = None) -> Any:
    url = f"{GUTENDEX_BASE}{path}"
    if params:
        clean = {k: v for k, v in params.items() if v is not None and v != ""}
        if clean:
            url = f"{url}?{urllib.parse.urlencode(clean)}"
    req = urllib.request.Request(url, headers={"User-Agent": GUTENDEX_UA})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=exc.code, detail=f"Gutendex error: {exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Gutendex unreachable: {exc.reason}") from exc


def _is_commercial_pd(book: dict[str, Any]) -> bool:
    return book.get("copyright") is False


def _pick_text_url(formats: dict[str, str], book_id: int) -> str:
    for key in (
        "text/plain; charset=utf-8",
        "text/plain; charset=us-ascii",
        "text/plain",
    ):
        url = formats.get(key)
        if url:
            return url
    return f"https://www.gutenberg.org/ebooks/{book_id}.txt.utf-8"


def _fetch_url_text(url: str, max_bytes: int = 8_000_000) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": GUTENDEX_UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read(max_bytes + 1)
            if len(raw) > max_bytes:
                raise HTTPException(status_code=413, detail="Book text too large for this endpoint")
            return raw.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=exc.code, detail=f"Failed to download book text: {exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to download book text: {exc.reason}") from exc


def _serialize_book(book: dict[str, Any]) -> dict[str, Any]:
    authors = book.get("authors") or []
    author_names = ", ".join(a.get("name", "") for a in authors if a.get("name"))
    return {
        "id": book.get("id"),
        "title": book.get("title") or "Untitled",
        "authors": author_names,
        "subjects": book.get("subjects") or [],
        "bookshelves": book.get("bookshelves") or [],
        "languages": book.get("languages") or [],
        "download_count": book.get("download_count"),
        "copyright": book.get("copyright"),
        "license": "public_domain_us",
    }


@app.get("/api/gutenberg/books")
def gutenberg_books(
    search: str | None = Query(None, max_length=120),
    topic: str | None = Query(None, max_length=80),
    author_year: str | None = Query(None, pattern=r"^\d{4}-\d{4}$"),
    page: int = Query(1, ge=1, le=500),
    languages: str = Query("en", max_length=16),
):
    params: dict[str, Any] = {"page": page, "languages": languages}
    if search:
        params["search"] = search.strip()
    if topic:
        params["topic"] = topic.strip()
    if author_year:
        params["author_year"] = author_year

    try:
        data = _gutendex_request("/books", params)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch book catalog: {exc}") from exc

    results = [_serialize_book(b) for b in data.get("results", []) if _is_commercial_pd(b)]
    return {
        "count": data.get("count"),
        "page": page,
        "next": data.get("next"),
        "previous": data.get("previous"),
        "results": results,
        "pd_only": True,
        "license_note": (
            "Only US public-domain titles (copyright=false) are returned. "
            "Commercial use permitted under Project Gutenberg terms."
        ),
    }


@app.get("/api/gutenberg/books/{book_id}")
def gutenberg_book_detail(book_id: int):
    try:
        book = _gutendex_request(f"/books/{book_id}", None)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch book metadata: {exc}") from exc

    if not _is_commercial_pd(book):
        raise HTTPException(
            status_code=403,
            detail="This title is not marked public domain (commercial use not included).",
        )
    return _serialize_book(book)


@app.get("/api/gutenberg/text/{book_id}")
def gutenberg_book_text(book_id: int):
    try:
        book = _gutendex_request(f"/books/{book_id}", None)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch book metadata: {exc}") from exc

    if not _is_commercial_pd(book):
        raise HTTPException(
            status_code=403,
            detail="This title is not marked public domain (commercial use not included).",
        )

    text_url = _pick_text_url(book.get("formats") or {}, book_id)
    text = _fetch_url_text(text_url)
    return {
        "id": book_id,
        "title": book.get("title") or "Untitled",
        "authors": ", ".join(a.get("name", "") for a in book.get("authors") or [] if a.get("name")),
        "text": text,
        "source_url": text_url,
        "license": "public_domain_us",
        "license_note": "Project Gutenberg — US public domain. Commercial use permitted.",
    }


# --- Books: multi-engine TTS + translation ----------------------------------

GOOGLE_TTS_API_KEY = os.getenv("GOOGLE_TTS_API_KEY", "").strip()
FREETTS_API_KEY = os.getenv("FREETTS_API_KEY", "").strip()
FREETTS_API_BASE = os.getenv("FREETTS_API_BASE", "https://freetts.org/api").rstrip("/")

PUBLIC_TTS_ENGINES = ("freetts", "google")

ENGINE_MONTHLY_LIMITS: dict[str, int] = {
    "google": int(os.getenv("GOOGLE_TTS_MONTHLY_LIMIT", "1000000")),
}

ENGINE_REQUEST_LIMITS: dict[str, int] = {
    "google": int(os.getenv("GOOGLE_TTS_MAX_CHARS", "4500")),
}

_freetts_cooldown_until: float = 0.0

FREETTS_VOICES = {
    "en-US-JennyNeural": {"label": "Jenny (EN)", "lang": "en-US"},
    "en-US-GuyNeural": {"label": "Guy (EN)", "lang": "en-US"},
    "en-US-AriaNeural": {"label": "Aria (EN)", "lang": "en-US"},
    "ko-KR-SunHiNeural": {"label": "선히 (KO)", "lang": "ko-KR"},
    "ko-KR-InJoonNeural": {"label": "인준 (KO)", "lang": "ko-KR"},
}

GOOGLE_NEURAL2_VOICES = {
    "en-US-Neural2-A": {"label": "Neural2 A (EN)", "lang": "en-US"},
    "en-US-Neural2-C": {"label": "Neural2 C (EN)", "lang": "en-US"},
    "en-US-Neural2-D": {"label": "Neural2 D (EN)", "lang": "en-US"},
    "en-US-Neural2-F": {"label": "Neural2 F (EN)", "lang": "en-US"},
    "ko-KR-Neural2-A": {"label": "Neural2 A (KO)", "lang": "ko-KR"},
    "ko-KR-Neural2-B": {"label": "Neural2 B (KO)", "lang": "ko-KR"},
    "ko-KR-Neural2-C": {"label": "Neural2 C (KO)", "lang": "ko-KR"},
}

ENGINE_VOICE_CATALOG: dict[str, dict[str, dict[str, str]]] = {
    "freetts": FREETTS_VOICES,
    "google": GOOGLE_NEURAL2_VOICES,
}

ENGINE_LABELS = {
    "freetts": "FreeTTS",
    "google": "Cloud TTS Neural2",
}

ENGINE_DEFAULT_VOICE = {
    "freetts": {"en": "en-US-JennyNeural", "ko": "ko-KR-SunHiNeural"},
    "google": {"en": "en-US-Neural2-A", "ko": "ko-KR-Neural2-A"},
}

_tts_usage_by_engine: dict[str, dict[str, Any]] = {}


def _freetts_authenticated() -> bool:
    return bool(FREETTS_API_KEY)


def _freetts_monthly_limit() -> int:
    default = "1000000" if _freetts_authenticated() else "5000"
    return int(os.getenv("FREETTS_TTS_MONTHLY_LIMIT", default))


def _freetts_hourly_limit() -> int:
    if _freetts_authenticated():
        return int(os.getenv("FREETTS_TTS_HOURLY_LIMIT", "0"))
    return int(os.getenv("FREETTS_TTS_HOURLY_LIMIT", "1000"))


def _freetts_chunk_limit() -> int:
    default = "10000" if _freetts_authenticated() else "1000"
    return int(os.getenv("FREETTS_TTS_MAX_CHARS", default))


def _freetts_rate_limited() -> bool:
    return time.time() < _freetts_cooldown_until


def _freetts_mark_rate_limited(seconds: int = 3600) -> None:
    global _freetts_cooldown_until
    _freetts_cooldown_until = max(_freetts_cooldown_until, time.time() + seconds)


def _freetts_usage_bucket() -> dict[str, Any]:
    bucket = _tts_usage_by_engine.setdefault(
        "freetts",
        {"month": "", "chars": 0, "hour": "", "hour_chars": 0},
    )
    month = time.strftime("%Y-%m")
    hour = time.strftime("%Y-%m-%d-%H")
    if bucket.get("month") != month:
        bucket["month"] = month
        bucket["chars"] = 0
    if bucket.get("hour") != hour:
        bucket["hour"] = hour
        bucket["hour_chars"] = 0
    return bucket


def _freetts_hourly_snapshot() -> dict[str, int]:
    bucket = _freetts_usage_bucket()
    limit = _freetts_hourly_limit()
    used = int(bucket.get("hour_chars") or 0)
    remaining = max(0, limit - used) if limit > 0 else 999_999_999
    return {
        "hourly_limit": limit,
        "hourly_used": used,
        "hourly_remaining": remaining,
    }


def _parse_freetts_http_error(status: int, body: str) -> str:
    message = ""
    try:
        payload = json.loads(body)
        detail = payload.get("detail")
        if isinstance(detail, dict):
            message = str(detail.get("error") or detail.get("message") or "")
            limit_type = detail.get("limit_type")
            if limit_type == "hourly_ip":
                used = detail.get("used")
                limit = detail.get("limit")
                return (
                    "FreeTTS 시간당 한도에 도달했습니다 "
                    f"({used}/{limit}자, 서버 IP 공유). "
                    "약 1시간 후 다시 시도하거나 Cloud TTS Neural2를 사용하세요. "
                    "FreeTTS PRO API 키(FREETTS_API_KEY)로 한도를 늘릴 수 있습니다."
                )
        elif isinstance(detail, str):
            message = detail
    except json.JSONDecodeError:
        message = body.strip()

    if status in (402, 429):
        if message:
            return f"FreeTTS 한도 초과: {message}"
        return (
            "FreeTTS 요청 한도에 도달했습니다. 잠시 후 다시 시도하거나 "
            "Cloud TTS Neural2를 사용하세요."
        )
    if message:
        return f"FreeTTS 오류: {message}"
    return f"FreeTTS 오류 (HTTP {status})"


def _google_tts_configured() -> bool:
    return bool(GOOGLE_TTS_API_KEY)


def _engine_configured(engine: str) -> bool:
    if engine == "google":
        return _google_tts_configured()
    if engine == "freetts":
        if _freetts_rate_limited():
            return False
        hourly = _freetts_hourly_snapshot()
        if hourly["hourly_limit"] > 0 and hourly["hourly_remaining"] <= 0:
            return False
        monthly = _engine_usage_snapshot("freetts")
        return int(monthly["chars_remaining"]) > 0
    return False


def _normalize_engine(engine: str | None) -> str:
    value = (engine or "freetts").strip().lower()
    if value not in ENGINE_VOICE_CATALOG:
        raise HTTPException(status_code=400, detail=f"Unknown TTS engine: {engine}")
    return value


def _engine_usage_snapshot(engine: str) -> dict[str, int | str]:
    if engine == "freetts":
        bucket = _freetts_usage_bucket()
        limit = _freetts_monthly_limit()
        used = int(bucket.get("chars") or 0)
        hourly = _freetts_hourly_snapshot()
        return {
            "engine": engine,
            "month": bucket["month"],
            "chars_used": used,
            "monthly_limit": limit,
            "chars_remaining": max(0, limit - used),
            **hourly,
        }

    month = time.strftime("%Y-%m")
    bucket = _tts_usage_by_engine.setdefault(engine, {"month": "", "chars": 0})
    if bucket.get("month") != month:
        bucket["month"] = month
        bucket["chars"] = 0
    limit = ENGINE_MONTHLY_LIMITS.get(engine, 1_000_000)
    used = int(bucket.get("chars") or 0)
    return {
        "engine": engine,
        "month": month,
        "chars_used": used,
        "monthly_limit": limit,
        "chars_remaining": max(0, limit - used),
        "hourly_limit": 0,
        "hourly_used": 0,
        "hourly_remaining": 0,
    }


def _all_engine_usage() -> list[dict[str, Any]]:
    rows = []
    for engine_id in PUBLIC_TTS_ENGINES:
        snap = _engine_usage_snapshot(engine_id)
        rows.append({
            "id": engine_id,
            "label": ENGINE_LABELS[engine_id],
            "configured": _engine_configured(engine_id),
            "authenticated": _freetts_authenticated() if engine_id == "freetts" else False,
            "monthly_limit": snap["monthly_limit"],
            "chars_used": snap["chars_used"],
            "chars_remaining": snap["chars_remaining"],
            "hourly_limit": snap.get("hourly_limit", 0),
            "hourly_used": snap.get("hourly_used", 0),
            "hourly_remaining": snap.get("hourly_remaining", 0),
            "chunk_max": _freetts_chunk_limit() if engine_id == "freetts" else ENGINE_REQUEST_LIMITS.get(engine_id, 4000),
            "rate_limited": _freetts_rate_limited() if engine_id == "freetts" else False,
            "note": (
                "무료: IP당 시간 1,000자·월 5,000자 (Render 서버 공유). PRO API 키 또는 Google Neural2 권장."
                if engine_id == "freetts" and not _freetts_authenticated()
                else None
            ),
            "voices": [
                {"id": voice_id, **meta}
                for voice_id, meta in ENGINE_VOICE_CATALOG[engine_id].items()
            ],
        })
    return rows


def _tts_reserve_chars(engine: str, char_count: int) -> dict[str, int | str]:
    if engine == "freetts":
        bucket = _freetts_usage_bucket()
        monthly_limit = _freetts_monthly_limit()
        monthly_used = int(bucket.get("chars") or 0)
        if monthly_used + char_count > monthly_limit:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"FreeTTS 월간 한도에 도달했습니다 ({monthly_limit:,}자). "
                    "다음 달까지 기다리거나 Cloud TTS Neural2를 사용하세요."
                ),
            )
        hourly_limit = _freetts_hourly_limit()
        hourly_used = int(bucket.get("hour_chars") or 0)
        if hourly_limit > 0 and hourly_used + char_count > hourly_limit:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"FreeTTS 시간당 한도에 도달했습니다 ({hourly_limit:,}자/시간, 서버 IP 공유). "
                    "약 1시간 후 다시 시도하거나 Cloud TTS Neural2를 사용하세요."
                ),
            )
        bucket["chars"] = monthly_used + char_count
        bucket["hour_chars"] = hourly_used + char_count
        return {
            "engine": engine,
            "chars_used": bucket["chars"],
            "monthly_limit": monthly_limit,
            "chars_this_request": char_count,
            "hourly_used": bucket["hour_chars"],
            "hourly_limit": hourly_limit,
        }

    usage = _engine_usage_snapshot(engine)
    projected = int(usage["chars_used"]) + char_count
    limit = int(usage["monthly_limit"])
    if projected > limit:
        label = ENGINE_LABELS.get(engine, engine)
        raise HTTPException(
            status_code=429,
            detail=(
                f"Monthly {label} limit reached ({limit:,} characters). "
                "Resets next calendar month."
            ),
        )
    _tts_usage_by_engine[engine]["chars"] = projected
    return {
        "engine": engine,
        "chars_used": projected,
        "monthly_limit": limit,
        "chars_this_request": char_count,
    }


def _default_voice_for_lang(engine: str, lang: str) -> str:
    key = "ko" if lang.startswith("ko") else "en"
    return ENGINE_DEFAULT_VOICE.get(engine, ENGINE_DEFAULT_VOICE["freetts"])[key]


def _validate_voice(engine: str, voice: str | None, lang: str | None = None) -> str:
    catalog = ENGINE_VOICE_CATALOG.get(engine, FREETTS_VOICES)
    if voice and voice in catalog:
        return voice
    if lang:
        return _default_voice_for_lang(engine, lang)
    return _default_voice_for_lang(engine, "en")


def _rate_to_freetts(rate: str) -> str:
    try:
        factor = float(rate)
    except (TypeError, ValueError):
        return "+0%"
    pct = int(round((factor - 1.0) * 100))
    pct = max(-50, min(100, pct))
    return f"{pct:+d}%"


def _translate_book_chunk(text: str, target: str = "ko") -> str:
    text = text.strip()
    if not text:
        return text
    if target == "ko" and _is_mostly_korean(text):
        return text
    cache_key = f"book:{target}:{text}"
    cached = _translate_cache.get(cache_key)
    if cached:
        return cached
    try:
        translated = GoogleTranslator(source="auto", target=target).translate(text[:4500])
        result = translated or text
        _translate_cache[cache_key] = result
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Translation failed: {exc}") from exc


def _freetts_synthesize(text: str, voice: str, rate: str = "1.0") -> bytes:
    max_chars = _freetts_chunk_limit()
    payload = json.dumps({
        "text": text[:max_chars],
        "voice": voice,
        "rate": _rate_to_freetts(rate),
        "pitch": "+0Hz",
    }).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "First-Books-TTS/1.0",
    }
    if FREETTS_API_KEY:
        headers["Authorization"] = f"Bearer {FREETTS_API_KEY}"
    req = urllib.request.Request(
        f"{FREETTS_API_BASE}/tts",
        data=payload,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        if exc.code in (402, 429):
            _freetts_mark_rate_limited()
            try:
                detail = json.loads(body).get("detail")
                if isinstance(detail, dict) and detail.get("limit_type") == "hourly_ip":
                    bucket = _freetts_usage_bucket()
                    bucket["hour_chars"] = int(detail.get("used") or bucket.get("hour_chars") or 0)
            except json.JSONDecodeError:
                pass
        raise HTTPException(
            status_code=exc.code,
            detail=_parse_freetts_http_error(exc.code, body),
        ) from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"FreeTTS unreachable: {exc.reason}") from exc

    file_id = data.get("file_id")
    if not file_id:
        raise HTTPException(status_code=502, detail="FreeTTS returned no file_id")

    audio_req = urllib.request.Request(
        f"{FREETTS_API_BASE}/audio/{file_id}",
        headers={"User-Agent": "First-Books-TTS/1.0"},
    )
    try:
        with urllib.request.urlopen(audio_req, timeout=90) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:300]
        raise HTTPException(
            status_code=exc.code,
            detail=f"FreeTTS audio download error: {exc.reason}. {body}".strip(),
        ) from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"FreeTTS audio unreachable: {exc.reason}") from exc


def _google_tts_synthesize(text: str, voice: str, rate: str = "1.0") -> bytes:
    if not _google_tts_configured():
        raise HTTPException(
            status_code=503,
            detail="Google Cloud TTS is not configured. Set GOOGLE_TTS_API_KEY on the API server.",
        )

    voice_meta = GOOGLE_NEURAL2_VOICES.get(voice) or GOOGLE_NEURAL2_VOICES["en-US-Neural2-A"]
    try:
        speaking_rate = float(rate)
    except (TypeError, ValueError):
        speaking_rate = 1.0
    speaking_rate = max(0.25, min(4.0, speaking_rate))

    payload = json.dumps({
        "input": {"text": text},
        "voice": {"languageCode": voice_meta["lang"], "name": voice},
        "audioConfig": {"audioEncoding": "MP3", "speakingRate": speaking_rate},
    }).encode("utf-8")
    url = (
        "https://texttospeech.googleapis.com/v1/text:synthesize"
        f"?key={urllib.parse.quote(GOOGLE_TTS_API_KEY)}"
    )
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "First-Books-TTS/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:300]
        raise HTTPException(
            status_code=exc.code,
            detail=f"Google Cloud TTS error: {exc.reason}. {body}".strip(),
        ) from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Google Cloud TTS unreachable: {exc.reason}") from exc

    audio_b64 = data.get("audioContent")
    if not audio_b64:
        raise HTTPException(status_code=502, detail="Google Cloud TTS returned no audio")
    return base64.b64decode(audio_b64)


def _synthesize_with_engine(engine: str, text: str, voice: str, rate: str) -> bytes:
    if engine == "freetts":
        return _freetts_synthesize(text, voice=voice, rate=rate)
    if engine == "google":
        return _google_tts_synthesize(text, voice=voice, rate=rate)
    raise HTTPException(status_code=400, detail=f"Unknown TTS engine: {engine}")


@app.get("/api/books/speech/status")
def books_speech_status():
    month = time.strftime("%Y-%m")
    engines = _all_engine_usage()
    return {
        "month": month,
        "engines": engines,
        "default_engine": "google" if _google_tts_configured() else "freetts",
        "license_note": (
            "FreeTTS free: 1,000 chars/hour and 5,000/month per server IP (shared on Render). "
            "Set FREETTS_API_KEY for PRO limits, or use Google Neural2."
        ),
    }


@app.post("/api/books/translate")
def books_translate_chunk(body: dict[str, Any] = Body(...)):
    text = str(body.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > 4500:
        raise HTTPException(status_code=400, detail="text exceeds 4,500 character limit per request")
    target = str(body.get("target") or "ko")
    if target not in ("ko", "en"):
        raise HTTPException(status_code=400, detail="target must be ko or en")
    translated = _translate_book_chunk(text, target=target)
    return {
        "text": translated,
        "source_chars": len(text),
        "target": target,
    }


@app.post("/api/books/tts")
def books_tts(body: dict[str, Any] = Body(...)):
    text = str(body.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    engine = _normalize_engine(body.get("engine"))
    if not _engine_configured(engine):
        label = ENGINE_LABELS.get(engine, engine)
        if engine == "freetts":
            hourly = _freetts_hourly_snapshot()
            if _freetts_rate_limited() or (
                hourly["hourly_limit"] > 0 and hourly["hourly_remaining"] <= 0
            ):
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "FreeTTS 시간당 한도(1,000자/시간, 서버 IP 공유)에 도달했습니다. "
                        "약 1시간 후 다시 시도하거나 Cloud TTS Neural2를 사용하세요."
                    ),
                )
        raise HTTPException(status_code=503, detail=f"{label} is not configured on this server.")

    max_chars = _freetts_chunk_limit() if engine == "freetts" else ENGINE_REQUEST_LIMITS.get(engine, 4000)
    if len(text) > max_chars:
        raise HTTPException(
            status_code=400,
            detail=f"text exceeds {max_chars:,} character limit for {ENGINE_LABELS[engine]}",
        )

    lang = str(body.get("lang") or "en")
    voice = _validate_voice(engine, body.get("voice"), lang)
    rate = str(body.get("rate") or "1.0")
    usage = _tts_reserve_chars(engine, len(text))
    audio = _synthesize_with_engine(engine, text, voice=voice, rate=rate)
    response_headers = {
        "X-TTS-Engine": engine,
        "X-TTS-Chars-Used": str(usage["chars_this_request"]),
        "X-TTS-Monthly-Used": str(usage["chars_used"]),
        "X-TTS-Monthly-Limit": str(usage["monthly_limit"]),
        "Cache-Control": "no-store",
    }
    if usage.get("hourly_limit"):
        response_headers["X-TTS-Hourly-Used"] = str(usage.get("hourly_used", 0))
        response_headers["X-TTS-Hourly-Limit"] = str(usage["hourly_limit"])
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers=response_headers,
    )
