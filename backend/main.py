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
from datetime import datetime, timedelta, timezone
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
    predictions_configured,
    record_predictions_for_group,
)
from art_service import (
    art_genres_list,
    fetch_artist_samples,
    fetch_artist_works,
    fetch_eras_artists,
    fetch_portrait_image,
)
from art_cache import (
    get_genre_works_response,
    load_aic_image_disk,
    load_bgm_audio,
    load_work_image,
    refresh_all_genre_caches,
    refresh_genre_cache,
    warm_all_portraits,
)
from artic_service import fetch_aic_image_bytes
from lotto_service import check_lotto_lines, check_lotto_qr, fetch_lotto_draw, parse_lotto_qr
from dino_service import fetch_dino_image, list_dinosaurs, list_eras, read_cached_image
from joke_service import (
    fetch_joke_kind,
    fetch_personal_fortune,
    fetch_zodiac_horoscopes,
)
from weather_service import fetch_weather_at, search_weather_places
from space_service import (
    fetch_apod_by_date,
    fetch_apod_gallery,
    fetch_planet_images,
    fetch_planets_overview,
    list_planets,
)
from books_author_service import fetch_author_image
from music_service import (
    fetch_composer_image,
    fetch_stream_bytes,
    fetch_tracks,
    music_genres,
    resolve_stream_url,
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

# 시가총액 상위 10 (수동 갱신 — Stock Picks 등 참고용 고정 리스트)
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

# 시가총액 상위 30 (2026-06 기준, ETF·우선주 제외 — Chart·분석용)
from kr_market_universes import KOSDAQ_TOP_100, KOSPI_TOP_100
from us_market_universes import NASDAQ_TOP_100, NYSE_TOP_100

KOSPI_TOP_30: list[tuple[str, str]] = [
    ("005930.KS", "삼성전자"),
    ("000660.KS", "SK하이닉스"),
    ("402340.KS", "SK스퀘어"),
    ("009150.KS", "삼성전기"),
    ("005380.KS", "현대차"),
    ("373220.KS", "LG에너지솔루션"),
    ("032830.KS", "삼성생명"),
    ("028260.KS", "삼성물산"),
    ("329180.KS", "HD현대중공업"),
    ("034020.KS", "두산에너빌리티"),
    ("000270.KS", "기아"),
    ("207940.KS", "삼성바이오로직스"),
    ("012450.KS", "한화에어로스페이스"),
    ("105560.KS", "KB금융"),
    ("012330.KS", "현대모비스"),
    ("034730.KS", "SK"),
    ("055550.KS", "신한지주"),
    ("006400.KS", "삼성SDI"),
    ("042660.KS", "한화오션"),
    ("267260.KS", "HD현대일렉트릭"),
    ("068270.KS", "셀트리온"),
    ("010120.KS", "LS ELECTRIC"),
    ("035420.KS", "NAVER"),
    ("066570.KS", "LG전자"),
    ("298040.KS", "효성중공업"),
    ("086790.KS", "하나금융지주"),
    ("009540.KS", "HD한국조선해양"),
    ("005490.KS", "POSCO홀딩스"),
    ("042700.KS", "한미반도체"),
    ("000810.KS", "삼성화재"),
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

NYSE_TOP_10: list[tuple[str, str]] = [
    ("BRK-B", "Berkshire Hathaway"),
    ("JPM", "JPMorgan Chase"),
    ("V", "Visa"),
    ("UNH", "UnitedHealth"),
    ("XOM", "Exxon Mobil"),
    ("JNJ", "Johnson & Johnson"),
    ("WMT", "Walmart"),
    ("PG", "Procter & Gamble"),
    ("MA", "Mastercard"),
    ("HD", "Home Depot"),
]

NASDAQ_TOP_10: list[tuple[str, str]] = [
    ("AAPL", "Apple"),
    ("MSFT", "Microsoft"),
    ("NVDA", "NVIDIA"),
    ("GOOGL", "Alphabet"),
    ("AMZN", "Amazon"),
    ("META", "Meta"),
    ("TSLA", "Tesla"),
    ("AVGO", "Broadcom"),
    ("COST", "Costco"),
    ("NFLX", "Netflix"),
]

CHART_MARKET_UNIVERSES: dict[str, dict[str, Any]] = {
    "kr_kospi": {
        "title": "KOSPI 시가총액 TOP 100",
        "stocks": KOSPI_TOP_100,
        "limit": 30,
        "universe_limit": 100,
    },
    "kr_kosdaq": {
        "title": "KOSDAQ 시가총액 TOP 100",
        "stocks": KOSDAQ_TOP_100,
        "limit": 30,
        "universe_limit": 100,
    },
    "nyse": {
        "title": "NYSE 시가총액 TOP 100",
        "stocks": NYSE_TOP_100,
        "limit": 30,
        "universe_limit": 100,
    },
    "nasdaq": {
        "title": "NASDAQ 시가총액 TOP 100",
        "stocks": NASDAQ_TOP_100,
        "limit": 30,
        "universe_limit": 100,
    },
}

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

_ALL_STOCK_LISTS = (
    KOSPI_TOP_30
    + KOSPI_TOP_100
    + KOSDAQ_TOP_10
    + KOSDAQ_TOP_100
    + US_TOP_10
    + NYSE_TOP_10
    + NASDAQ_TOP_10
    + NASDAQ_TOP_100
    + NYSE_TOP_100
)

PICK_TICKERS = {
    ticker: "kr" if ticker.endswith((".KS", ".KQ")) else "us"
    for ticker, _ in _ALL_STOCK_LISTS
}

TICKER_NAMES = {ticker: name for ticker, name in _ALL_STOCK_LISTS}
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
    "https://first-66f.pages.dev",
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
    score = bullish * 2 - bearish * 2
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


def collect_chart_data(
    ticker: str,
    period: str = "3mo",
    interval: str = "1d",
    tz: Any = None,
    after_scheduled_update: bool | None = None,
    skip_snapshot: bool = False,
) -> dict[str, Any]:
    if not _is_allowed_chart_ticker(ticker):
        raise ValueError(f"Unsupported ticker: {ticker}")

    if not skip_snapshot:
        try:
            from chart_snapshot import get_chart_from_snapshot

            snap_payload = get_chart_from_snapshot(ticker, period)
            if snap_payload and snap_payload.get("candles"):
                return snap_payload
        except Exception:
            pass

    after_key = (
        "1" if after_scheduled_update is True
        else "0" if after_scheduled_update is False
        else "a"
    )
    cache_key = f"chart:{ticker}:{period}:{interval}:{after_key}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached["ts"] < CACHE_TTL:
        payload = _json_safe(dict(cached["data"]))
        payload["cached"] = True
        payload["cacheAgeSeconds"] = int(now - cached["ts"])
        return payload

    try:
        from recommend2_bottom_accumulation import (
            ET,
            KST,
            yfinance_history_end_str,
            yfinance_history_start_str,
        )

        zone = tz or (KST if ticker.endswith((".KS", ".KQ")) else ET)
        hist = yf.Ticker(ticker).history(
            start=yfinance_history_start_str(period, zone),
            end=yfinance_history_end_str(zone, after_scheduled_update=after_scheduled_update),
            interval=interval,
            auto_adjust=False,
        )
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


def collect_live_chart_data(
    ticker: str,
    period: str = "3mo",
    interval: str = "1d",
    tz: Any = None,
    after_scheduled_update: bool | None = None,
) -> dict[str, Any]:
    """Re·cron 실시간 스캔 — chart_snapshot 캐시 무시, 현재 시각 기준 yfinance."""
    return collect_chart_data(
        ticker,
        period,
        interval,
        tz=tz,
        after_scheduled_update=after_scheduled_update,
        skip_snapshot=True,
    )


def collect_market_top10(
    market: str,
    *,
    offset: int = 0,
    limit: int = 30,
    skip_snapshot: bool = False,
) -> dict[str, Any]:
    if market not in CHART_MARKET_UNIVERSES:
        raise ValueError(f"Unknown chart market: {market}")

    universe = CHART_MARKET_UNIVERSES[market]
    universe_limit = int(universe.get("universe_limit", 100))
    snapshot_limit = int(universe.get("limit", 30))
    all_stocks = universe["stocks"][:universe_limit]

    if offset < 0 or offset >= len(all_stocks):
        return _json_safe(
            {
                "market": market,
                "segmentTitle": universe["title"],
                "count": 0,
                "items": [],
                "offset": offset,
                "limit": limit,
                "universeTotal": len(all_stocks),
                "snapshotCount": snapshot_limit,
                "source": "api",
                "cached": False,
                "cacheAgeSeconds": 0,
            }
        )

    slice_limit = min(limit, len(all_stocks) - offset)

    if not skip_snapshot and offset == 0 and slice_limit <= snapshot_limit:
        try:
            from chart_snapshot import get_market_top_from_snapshot

            snap_payload = get_market_top_from_snapshot(market)
            if snap_payload and snap_payload.get("items"):
                items = list(snap_payload["items"])[:slice_limit]
                payload = dict(snap_payload)
                payload["items"] = items
                payload["count"] = len(items)
                payload["offset"] = offset
                payload["limit"] = slice_limit
                payload["universeTotal"] = len(all_stocks)
                payload["snapshotCount"] = snapshot_limit
                return _json_safe(payload)
        except Exception:
            pass

    stocks = all_stocks[offset : offset + slice_limit]
    cache_key = f"market_top:{market}:{offset}:{slice_limit}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached["ts"] < CACHE_TTL:
        payload = _json_safe(dict(cached["data"]))
        payload["cached"] = True
        payload["cacheAgeSeconds"] = int(now - cached["ts"])
        return payload

    quotes: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        quote_futures = {
            pool.submit(_fetch_price_change, ticker): ticker for ticker, _ in stocks
        }
        for future in as_completed(quote_futures):
            ticker = quote_futures[future]
            try:
                quotes[ticker] = future.result()
            except Exception:
                quotes[ticker] = {"price": None, "changePct": None}

    items: list[dict[str, Any]] = []
    for i, (ticker, name) in enumerate(stocks):
        quote = quotes.get(ticker, {"price": None, "changePct": None})
        items.append(
            {
                "rank": offset + i + 1,
                "ticker": ticker,
                "name": name,
                "price": quote.get("price"),
                "changePct": quote.get("changePct"),
            }
        )

    payload = _json_safe(
        {
            "market": market,
            "segmentTitle": universe["title"],
            "count": len(items),
            "items": items,
            "offset": offset,
            "limit": slice_limit,
            "universeTotal": len(all_stocks),
            "snapshotCount": snapshot_limit,
            "source": "api",
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
            "chart_kr_snapshot": "/api/chart/kr-snapshot?market=kr_kospi|kr_kosdaq",
            "chart_us_snapshot": "/api/chart/us-snapshot?market=nyse|nasdaq",
            "chart_cron_build": "POST /api/chart/cron/build?region=kr|us",
            "market_top10": "/api/market-top10?market=kr_kospi&offset=0&limit=30",
            "predictions_history": "/api/predictions/history?ticker=005930.KS&market=kr_kospi&days=30",
            "predictions_summary": "/api/predictions/summary?market=kr_kospi&days=30",
            "predictions_backfill": "POST /api/predictions/backfill?market=all|kr|us&days=30",
            "music_genres": "/api/music/genres",
            "music_tracks": "/api/music/tracks?genre=jazz|classical|pop|rock|folkhiphop&page=1&limit=10",
            "music_stream": "/api/music/stream/{source}/{track_id}",
            "joke": "/api/joke/{kind}?count=10",
            "joke_fortune_zodiac": "/api/joke/fortune/zodiac",
            "joke_fortune_personal": "POST /api/joke/fortune/personal",
            "joke_weather": "/api/joke/weather?lat=&lon=",
            "joke_weather_search": "/api/joke/weather/search?q=Seoul",
            "space_apod": "/api/space/apod?count=20",
            "space_planets": "/api/space/planets",
            "space_cron_refresh": "POST /api/space/cron/refresh",
            "space_planet": "/api/space/planet/{id}",
            "lotto_draw": "/api/lotto/draw/{round}",
            "lotto_draw_latest": "/api/lotto/draw/latest",
            "lotto_check": "POST /api/lotto/check",
            "lotto_check_qr": "POST /api/lotto/check-qr",
            "dino_eras": "/api/dino/eras",
            "dino_list": "/api/dino/dinosaurs?era=triassic|jurassic|cretaceous",
            "dino_image": "/api/dino/image-file/{id}",
            "health": "/health",
        },
    }


@app.get("/health")
def health():
    from dart_service import dart_configured

    return {
        "ok": True,
        "predictionsDb": predictions_configured(),
        "cronSecretSet": bool(CRON_SECRET),
        "openDartConfigured": dart_configured(),
    }


@app.get("/api/dart/ping")
def dart_ping():
    """Open DART 키·삼성전자 EPS/BPS 샘플 진단 (가벼운 ping, corp zip 미다운로드)."""
    from dart_service import dart_health_ping

    return dart_health_ping()


@app.get("/api/dart/metrics/{stock_code}")
def dart_metrics(stock_code: str, refresh: bool = Query(False)):
    """단일 종목 DART EPS/BPS + PBR (진단용)."""
    from dart_service import (
        clear_per_share_cache,
        dart_configured,
        fetch_dart_per_share,
        resolve_price_to_book,
        resolve_trailing_pe,
    )

    code = stock_code.strip()
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="stock_code must be 6 digits")

    if refresh:
        clear_per_share_cache(code)

    suffix = ".KS"
    ticker = f"{code}{suffix}"
    try:
        import yfinance as yf

        info = yf.Ticker(ticker).info or {}
        price_raw = info.get("currentPrice") or info.get("regularMarketPrice")
        price = float(price_raw) if price_raw else None
    except Exception:
        info = {}
        price = None

    metrics = fetch_dart_per_share(code)
    pbr = resolve_price_to_book(ticker, price=price, yahoo_pbr=None, info=info)
    pe = resolve_trailing_pe(ticker, price=price, yahoo_trailing_pe=None, info=info)

    return {
        "configured": dart_configured(),
        "stockCode": code,
        "ticker": ticker,
        "price": price,
        "dart": metrics,
        "pbr": pbr,
        "trailingPE": pe,
    }


@app.get("/api/dart/diagnose/{stock_code}")
def dart_diagnose(stock_code: str, refresh: bool = Query(False)):
    """DART corp 매핑·연도별 API 응답 진단."""
    from dart_service import dart_diagnose_stock

    return dart_diagnose_stock(stock_code, refresh=refresh)


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
    force: bool = Query(False, description="true면 Re 실시간 분석 (전역 스캔 락)"),
    scan_job_id: str | None = Query(None, description="진행 중 Re Job ID"),
    authorization: str | None = Header(default=None),
):
    try:
        from scan_job import attach_scan_job, fail_job, finish_scan_step, gate_force_scan

        if force:
            target = f"sentiment:{market}"
            job = gate_force_scan(
                target=target,
                region=market,
                scan_job_id=scan_job_id,
                authorization=authorization,
            )
            try:
                payload = collect_recommendations(market, limit, lang)
                payload["source"] = "live"
                job = finish_scan_step(job, target=target, region=market)
                json.dumps(payload)
                return attach_scan_job(payload, job)
            except Exception as exc:
                fail_job(str(job["id"]), str(exc))
                raise
        payload = collect_recommendations(market, limit, lang)
        json.dumps(payload)
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to build recommendations: {exc}") from exc


@app.get("/api/recommend2/bottom-accumulation")
def recommend2_bottom_accumulation(
    period: str = Query("3mo", pattern="^(1mo|3mo|6mo)$"),
    force: bool = Query(False, description="true면 실시간 스캔 후 스냅샷 저장"),
    region: str = Query(
        "all",
        pattern="^(all|kr|us|kospi|kosdaq|nasdaq|nyse)$",
        description="force=true일 때 스캔 범위 (시장별 분할 권장)",
    ),
    scan_job_id: str | None = Query(None, description="진행 중 Re Job ID"),
    authorization: str | None = Header(default=None),
):
    try:
        from recommend2_snapshot import build_and_save_snapshot, enrich_payload, load_snapshot
        from scan_job import attach_scan_job, fail_job, finish_scan_step, gate_force_scan

        if force:
            job = gate_force_scan(
                target="recommend2",
                region=region,
                scan_job_id=scan_job_id,
                authorization=authorization,
            )
            try:
                payload = build_and_save_snapshot(
                    collect_live_chart_data,
                    region=region,
                    period=period,
                    after_scheduled_update=None,
                )
                payload["source"] = "live"
                payload["scanRegion"] = region
                job = finish_scan_step(job, target="recommend2", region=region)
                json.dumps(payload)
                return attach_scan_job(payload, job)
            except Exception as exc:
                fail_job(str(job["id"]), str(exc))
                raise
        else:
            from stock_snapshot_store import load_global_snapshot
            from stock_strategy_record import is_placeholder_payload as _is_ph_r2

            payload = load_global_snapshot("recommend2")
            if payload and not _is_ph_r2(payload):
                payload = enrich_payload(dict(payload))
                payload["source"] = "global_snapshot"
            else:
                payload = load_snapshot()
                if not payload:
                    payload = build_and_save_snapshot(
                        collect_live_chart_data,
                        region="all",
                        period=period,
                        after_scheduled_update=None,
                    )
                    payload["source"] = "live"
                else:
                    payload = enrich_payload(dict(payload))
                    payload["source"] = "snapshot"
        from hold_return_backfill import ensure_payload_hold_returns

        payload = ensure_payload_hold_returns(payload, use_recommend2_series=True)
        json.dumps(payload)
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to load bottom accumulation: {exc}",
        ) from exc


@app.post("/api/recommend2/cron/build")
def recommend2_cron_build(
    region: str = Query("all", pattern="^(kr|us|all)$"),
    period: str = Query("3mo", pattern="^(1mo|3mo|6mo)$"),
    authorization: str | None = Header(default=None),
):
    _verify_cron(authorization)
    try:
        from recommend2_snapshot import build_and_save_snapshot

        payload = build_and_save_snapshot(
            collect_live_chart_data,
            region=region,
            period=period,
            after_scheduled_update=True,
        )
        payload["source"] = "cron"
        json.dumps(payload)
        return {
            "ok": True,
            "region": region,
            "analysisDate": payload.get("analysisDate"),
            "savedAt": payload.get("savedAt"),
            "markets": {
                k: {
                    "analysisDate": (payload.get("markets") or {}).get(k, {}).get("analysisDate"),
                    "recentCount": (payload.get("markets") or {}).get(k, {}).get("recentCount", 0),
                }
                for k in (payload.get("markets") or {})
            },
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to build recommend2 snapshot: {exc}",
        ) from exc


def _stock_strategy_get(
    strategy_key: str,
    force: bool = False,
    region: str = "all",
    *,
    scan_job_id: str | None = None,
    authorization: str | None = None,
):
    from stock_strategy_engine import collect_strategy_scan, make_yfinance_fetcher
    from stock_strategy_snapshot import (
        STRATEGY_REGISTRY,
        build_and_save_snapshot,
        enrich_payload,
        load_snapshot,
    )

    if strategy_key not in STRATEGY_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Unknown strategy: {strategy_key}")
    entry = STRATEGY_REGISTRY[strategy_key]
    if force:
        from scan_job import attach_scan_job, fail_job, finish_scan_step, gate_force_scan

        job = gate_force_scan(
            target=strategy_key,
            region=region,
            scan_job_id=scan_job_id,
            authorization=authorization,
        )
        try:
            payload = build_and_save_snapshot(
                strategy_key,
                make_yfinance_fetcher(),
                period="6mo",
                region=region,
                after_scheduled_update=None,
            )
            payload["source"] = "live"
            payload["scanRegion"] = region
            try:
                from stock_strategy_record import record_strategy_run, strip_all_signals_from_payload

                payload["lastRecord"] = record_strategy_run(
                    strategy_key, payload, source="user_re"
                )
            except Exception as exc:
                payload["recordError"] = str(exc)
            payload = strip_all_signals_from_payload(payload)
            job = finish_scan_step(job, target=strategy_key, region=region)
            json.dumps(payload)
            return attach_scan_job(payload, job)
        except HTTPException:
            raise
        except Exception as exc:
            fail_job(str(job["id"]), str(exc))
            raise
    else:
        from stock_snapshot_store import load_global_snapshot
        from stock_strategy_record import (
            fetch_latest_run_payload,
            is_placeholder_payload,
            payload_has_signals,
        )

        payload = load_global_snapshot(strategy_key)
        if payload and not is_placeholder_payload(payload):
            payload = enrich_payload(dict(payload), strategy_key)
            payload["source"] = "global_snapshot"
        else:
            payload = load_snapshot(strategy_key)
            if payload:
                payload = enrich_payload(dict(payload), strategy_key)
                payload["source"] = "snapshot"
        if is_placeholder_payload(payload):
            latest = fetch_latest_run_payload(strategy_key)
            if latest and payload_has_signals(latest):
                payload = latest
            elif not payload:
                payload = build_and_save_snapshot(
                    strategy_key,
                    make_yfinance_fetcher(),
                    period="6mo",
                    region="all",
                    after_scheduled_update=None,
                )
                payload["source"] = "live"
        elif not payload:
            latest = fetch_latest_run_payload(strategy_key)
            if latest and payload_has_signals(latest):
                payload = latest
            else:
                payload = build_and_save_snapshot(
                    strategy_key,
                    make_yfinance_fetcher(),
                    period="6mo",
                    region="all",
                    after_scheduled_update=None,
                )
                payload["source"] = "live"
    from hold_return_backfill import ensure_payload_hold_returns

    payload = ensure_payload_hold_returns(payload)
    json.dumps(payload)
    return payload


STOCK_STRATEGY_REGION_QUERY = Query(
    "all",
    pattern="^(all|kr|us|kospi|kosdaq|nasdaq|nyse)$",
    description="force=true일 때 스캔 범위 (시장별 분할 권장)",
)


@app.get("/api/stock-picks/scan/status")
def stock_picks_scan_status():
    from scan_job import get_scan_status

    return get_scan_status()


@app.get("/api/stock-picks/scan/meta")
def stock_picks_scan_meta():
    from scan_job import get_scan_meta

    return get_scan_meta()


@app.get("/api/stock-strategy/golden-cross")
def stock_strategy_golden(
    force: bool = Query(False, description="true면 실시간 스캔"),
    region: str = STOCK_STRATEGY_REGION_QUERY,
    scan_job_id: str | None = Query(None),
    authorization: str | None = Header(default=None),
):
    try:
        return _stock_strategy_get(
            "golden-cross",
            force=force,
            region=region,
            scan_job_id=scan_job_id,
            authorization=authorization,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"golden-cross failed: {exc}") from exc


@app.get("/api/stock-strategy/bollinger")
def stock_strategy_bollinger(
    force: bool = Query(False, description="true면 실시간 스캔"),
    region: str = STOCK_STRATEGY_REGION_QUERY,
    scan_job_id: str | None = Query(None),
    authorization: str | None = Header(default=None),
):
    try:
        return _stock_strategy_get(
            "bollinger",
            force=force,
            region=region,
            scan_job_id=scan_job_id,
            authorization=authorization,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"bollinger failed: {exc}") from exc


@app.get("/api/stock-strategy/rsi-divergence")
def stock_strategy_rsi(
    force: bool = Query(False, description="true면 실시간 스캔"),
    region: str = STOCK_STRATEGY_REGION_QUERY,
    scan_job_id: str | None = Query(None),
    authorization: str | None = Header(default=None),
):
    try:
        return _stock_strategy_get(
            "rsi-divergence",
            force=force,
            region=region,
            scan_job_id=scan_job_id,
            authorization=authorization,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"rsi-divergence failed: {exc}") from exc


@app.get("/api/stock-strategy/candle-support")
def stock_strategy_candle_support(
    force: bool = Query(False, description="true면 실시간 스캔"),
    region: str = STOCK_STRATEGY_REGION_QUERY,
    scan_job_id: str | None = Query(None),
    authorization: str | None = Header(default=None),
):
    try:
        return _stock_strategy_get(
            "candle-support",
            force=force,
            region=region,
            scan_job_id=scan_job_id,
            authorization=authorization,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"candle-support failed: {exc}") from exc


@app.get("/api/stock-strategy/obv-divergence")
def stock_strategy_obv(
    force: bool = Query(False, description="true면 실시간 스캔"),
    region: str = STOCK_STRATEGY_REGION_QUERY,
    scan_job_id: str | None = Query(None),
    authorization: str | None = Header(default=None),
):
    try:
        return _stock_strategy_get(
            "obv-divergence",
            force=force,
            region=region,
            scan_job_id=scan_job_id,
            authorization=authorization,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"obv-divergence failed: {exc}") from exc


@app.get("/api/stock-strategy/bottom-pattern")
def stock_strategy_bottom(
    force: bool = Query(False, description="true면 실시간 스캔"),
    region: str = STOCK_STRATEGY_REGION_QUERY,
    scan_job_id: str | None = Query(None),
    authorization: str | None = Header(default=None),
):
    try:
        return _stock_strategy_get(
            "bottom-pattern",
            force=force,
            region=region,
            scan_job_id=scan_job_id,
            authorization=authorization,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"bottom-pattern failed: {exc}") from exc


@app.get("/api/stock-strategy/vcp")
def stock_strategy_vcp(
    force: bool = Query(False, description="true면 실시간 스캔"),
    region: str = STOCK_STRATEGY_REGION_QUERY,
    scan_job_id: str | None = Query(None),
    authorization: str | None = Header(default=None),
):
    try:
        return _stock_strategy_get(
            "vcp",
            force=force,
            region=region,
            scan_job_id=scan_job_id,
            authorization=authorization,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"vcp failed: {exc}") from exc


def _fundamentals_get(
    force: bool = False,
    region: str = "all",
    *,
    scan_job_id: str | None = None,
    authorization: str | None = None,
    chunk: bool = False,
    offset: int = 0,
    limit: int = 5,
    fast: bool = True,
    finalize: bool = False,
):
    from fundamentals_universes import ALL_MARKET_KEYS, KR_MARKET_KEYS
    from stock_fundamentals_snapshot import (
        build_and_save_all,
        build_and_save_region,
        enrich_payload,
        load_snapshot,
        payload_has_data,
    )
    from stock_snapshot_store import load_global_snapshot

    if force:
        from fundamentals_auth import require_fundamentals_force_user
        from scan_job import attach_scan_job, fail_job, finish_scan_step, gate_force_scan

        require_fundamentals_force_user(authorization)
        job = gate_force_scan(
            target="fundamentals",
            region=region,
            scan_job_id=scan_job_id,
            authorization=authorization,
        )
        try:
            if chunk and region in ALL_MARKET_KEYS:
                from stock_fundamentals_batch import (
                    FUNDAMENTALS_CHUNK_SIZE,
                    FUNDAMENTALS_KR_RE_CHUNK_SIZE,
                    build_and_save_batch_market,
                )

                chunk_limit = min(
                    limit,
                    FUNDAMENTALS_KR_RE_CHUNK_SIZE
                    if region in KR_MARKET_KEYS
                    else FUNDAMENTALS_CHUNK_SIZE,
                )
                chunk_fast = False if region in KR_MARKET_KEYS else fast
                batch_result = build_and_save_batch_market(
                    region,
                    offset=offset,
                    limit=chunk_limit,
                    finalize=finalize,
                    fast=chunk_fast,
                )
                snapshot = load_snapshot(use_memory=True)
                payload = enrich_payload(dict(snapshot) if snapshot else {})
                payload["source"] = "live"
                payload["scanRegion"] = region
                payload["chunkResult"] = batch_result
                if batch_result.get("done") or finalize:
                    job = finish_scan_step(job, target="fundamentals", region=region)
                json.dumps(payload)
                return attach_scan_job(payload, job)

            if region == "all":
                payload = build_and_save_all()
            else:
                payload = build_and_save_region(region)
            payload["source"] = "live"
            payload["scanRegion"] = region
            job = finish_scan_step(job, target="fundamentals", region=region)
            json.dumps(payload)
            return attach_scan_job(payload, job)
        except HTTPException:
            raise
        except Exception as exc:
            fail_job(str(job["id"]), str(exc))
            raise
    payload = load_global_snapshot("fundamentals")
    if payload and payload_has_data(payload):
        payload = enrich_payload(dict(payload))
        payload["source"] = "global_snapshot"
    else:
        payload = load_snapshot()
        if payload:
            payload = enrich_payload(dict(payload))
            payload["source"] = "snapshot"
        else:
            payload = enrich_payload(None)
    try:
        from recommendation_history import fetch_fundamentals_history, sync_missing_fundamentals_history

        sync_missing_fundamentals_history(payload.get("markets") or {})
        history, summary = fetch_fundamentals_history()
        payload = dict(payload)
        payload["history"] = history
        payload["historySummary"] = summary
    except Exception:
        pass
    json.dumps(payload)
    return payload


@app.get("/api/stock-fundamentals")
def stock_fundamentals(
    force: bool = Query(False, description="true면 TOP200 재무 스캔 (4탭 공통)"),
    region: str = STOCK_STRATEGY_REGION_QUERY,
    scan_job_id: str | None = Query(None),
    chunk: bool = Query(False, description="true면 offset/limit 청크 스캔 (Re·Render 30s 대응)"),
    offset: int = Query(0, ge=0, le=200),
    limit: int = Query(5, ge=1, le=20),
    fast: bool = Query(True, description="false=DART 포함 (KR PBR는 항상 DART)"),
    finalize: bool = Query(False),
    authorization: str | None = Header(default=None),
):
    try:
        return _fundamentals_get(
            force=force,
            region=region,
            scan_job_id=scan_job_id,
            authorization=authorization,
            chunk=chunk,
            offset=offset,
            limit=limit,
            fast=fast,
            finalize=finalize,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"fundamentals failed: {exc}") from exc


@app.post("/api/fundamentals/cron/build")
def fundamentals_cron_build(
    region: str = Query(
        "kospi",
        pattern="^(all|kr|us|kospi|kosdaq|nasdaq|nyse)$",
        description="kr/us/all 또는 단일 시장",
    ),
    market: str | None = Query(
        None,
        pattern="^(kospi|kosdaq|nasdaq|nyse)$",
        description="청크 스캔 시장 (region보다 우선)",
    ),
    offset: int = Query(0, ge=0, le=200),
    limit: int = Query(8, ge=1, le=20),
    finalize: bool = Query(False),
    fast: bool = Query(True, description="true=Yahoo만(빠름), false=DART 포함"),
    session_start: bool = Query(False, description="cron 세션 시작 — scan job 등록"),
    session_complete: bool = Query(False, description="cron 세션 종료 — scan job 완료"),
    authorization: str | None = Header(default=None),
):
    """GitHub Actions cron — 시장당 8종목 청크 (Render 502 방지)."""
    _verify_cron(authorization)
    try:
        from scan_job import SCAN_REGION_LABELS, SCAN_REGION_ORDER, touch_cron_scan
        from stock_fundamentals_batch import (
            CRON_BATCH_API_VERSION,
            FUNDAMENTALS_CHUNK_SIZE,
            _markets_for_region,
            build_and_save_batch_market,
        )

        if session_complete and not market and not finalize:
            touch_cron_scan(
                "fundamentals",
                step=4,
                total_steps=4,
                step_label="자동 갱신 완료",
                session_complete=True,
            )
            return {"ok": True, "sessionComplete": True, "apiVersion": CRON_BATCH_API_VERSION}

        def _market_step(market_key: str) -> tuple[int, str]:
            try:
                step_idx = SCAN_REGION_ORDER.index(market_key) + 1
            except ValueError:
                step_idx = 1
            market_label = SCAN_REGION_LABELS.get(market_key, market_key.upper())
            return step_idx, market_label

        def _begin_fundamentals_job(market_key: str, chunk_offset: int) -> None:
            if not (session_start or chunk_offset == 0):
                return
            step_idx, market_label = _market_step(market_key)
            touch_cron_scan(
                "fundamentals",
                step=step_idx,
                total_steps=4,
                step_label=f"{market_label} {chunk_offset}/200",
                session_start=True,
            )

        def _progress_fundamentals_job(result: dict[str, Any], market_key: str, chunk_offset: int) -> None:
            step_idx, market_label = _market_step(market_key)
            scanned = int(result.get("scannedCount") or chunk_offset)
            universe = int(result.get("universeSize") or 200)
            touch_cron_scan(
                "fundamentals",
                step=step_idx,
                total_steps=4,
                step_label=f"{market_label} {scanned}/{universe}",
                session_complete=session_complete,
            )

        if market:
            _begin_fundamentals_job(market, offset)
            result = build_and_save_batch_market(
                market,
                offset=offset,
                limit=min(limit, FUNDAMENTALS_CHUNK_SIZE),
                finalize=finalize,
                fast=fast,
            )
            result["apiVersion"] = CRON_BATCH_API_VERSION
            _progress_fundamentals_job(result, market, offset)
            json.dumps(result)
            return result

        if region in ("all", "kr", "us"):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Use market=kospi|kosdaq|nasdaq|nyse with offset/limit chunks "
                    f"(region={region} expands to {','.join(_markets_for_region(region))})"
                ),
            )

        _begin_fundamentals_job(region, offset)
        result = build_and_save_batch_market(
            region,
            offset=offset,
            limit=min(limit, FUNDAMENTALS_CHUNK_SIZE),
            finalize=finalize,
            fast=fast,
        )
        result["apiVersion"] = CRON_BATCH_API_VERSION
        _progress_fundamentals_job(result, region, offset)
        json.dumps(result)
        return result
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"fundamentals cron build failed: {exc}") from exc


def _quality_score_get():
    from stock_quality_score_snapshot import enrich_payload, load_snapshot, payload_has_data
    from stock_snapshot_store import load_global_snapshot

    payload = load_global_snapshot("quality-score")
    if payload and payload_has_data(payload):
        payload = enrich_payload(dict(payload))
        payload["source"] = "global_snapshot"
    else:
        payload = load_snapshot()
        if payload:
            payload = enrich_payload(dict(payload))
            payload["source"] = "snapshot"
        else:
            payload = enrich_payload(None)
    json.dumps(payload)
    return payload


@app.get("/api/stock-quality-score")
def stock_quality_score_get():
    """재무 종합 점수 스냅샷 — TOP 100 순위."""
    try:
        return _quality_score_get()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"quality-score failed: {exc}") from exc


@app.post("/api/quality-score/cron/build")
def quality_score_cron_build(
    market: str = Query(
        "kospi",
        pattern="^(kospi|kosdaq|nasdaq|nyse)$",
        description="청크 스캔 시장",
    ),
    offset: int = Query(0, ge=0, le=100),
    limit: int = Query(8, ge=1, le=15),
    max_offset: int | None = Query(None, ge=1, le=100, description="Phase1: 50 — 이 offset까지 스캔 후 중단"),
    finalize: bool = Query(False, description="partial 병합 후 순위 확정"),
    reset_market: bool = Query(False, description="시장 partial 초기화 (Phase1 첫 청크)"),
    session_start: bool = Query(False),
    session_complete: bool = Query(False),
    authorization: str | None = Header(default=None),
):
    """GitHub Actions cron — 시장당 8종목 청크 · 02:00(0~49) · 03:00(50~99)."""
    _verify_cron(authorization)
    try:
        from scan_job import SCAN_REGION_LABELS, SCAN_REGION_ORDER, touch_cron_scan
        from stock_quality_score_batch import (
            CRON_BATCH_API_VERSION,
            QUALITY_CHUNK_SIZE,
            build_and_save_batch_market,
            reset_market_partial,
        )

        if session_complete and not finalize and offset == 0 and not reset_market:
            touch_cron_scan(
                "quality-score",
                step=4,
                total_steps=4,
                step_label="재무종합 자동 갱신 완료",
                session_complete=True,
            )
            return {"ok": True, "sessionComplete": True, "apiVersion": CRON_BATCH_API_VERSION}

        if reset_market and offset == 0:
            reset_market_partial(market)

        try:
            step_idx = SCAN_REGION_ORDER.index(market) + 1
        except ValueError:
            step_idx = 1
        market_label = SCAN_REGION_LABELS.get(market, market.upper())

        if session_start or offset == 0:
            touch_cron_scan(
                "quality-score",
                step=step_idx,
                total_steps=4,
                step_label=f"{market_label} {offset}/100",
                session_start=True,
            )

        result = build_and_save_batch_market(
            market,
            offset=offset,
            limit=min(limit, QUALITY_CHUNK_SIZE),
            finalize=finalize,
            max_offset=max_offset,
        )
        result["apiVersion"] = CRON_BATCH_API_VERSION

        scanned = int(result.get("scannedCount") or offset)
        touch_cron_scan(
            "quality-score",
            step=step_idx,
            total_steps=4,
            step_label=f"{market_label} {scanned}/100",
            session_complete=session_complete,
        )
        json.dumps(result)
        return result
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"quality-score cron build failed: {exc}") from exc


STOCK_PICKS_BATCH_REGION_QUERY = Query(
    "kospi",
    pattern="^(kospi|kosdaq|nasdaq|nyse)$",
    description="통합 배치 스캔 시장 (1회 1시장)",
)


@app.post("/api/stock-picks/batch-build")
def stock_picks_batch_build(
    region: str = STOCK_PICKS_BATCH_REGION_QUERY,
    offset: int = Query(0, ge=0, le=200),
    limit: int = Query(25, ge=1, le=100),
    finalize: bool = Query(False, description="true면 병합된 시장 블록 활성 신호만 재계산"),
):
    """TOP 100 청크 스캔 — 바닥매집 + 전략 7개 (시장·청크 1회)."""
    try:
        from stock_picks_batch import build_and_save_batch_market

        payload = build_and_save_batch_market(
            region,
            collect_chart_data,
            after_scheduled_update=None,
            source="live",
            offset=offset,
            limit=limit,
            finalize=finalize,
        )
        json.dumps(payload)
        return payload
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"batch-build failed: {exc}") from exc


@app.post("/api/snapshots/cron/upload")
def snapshots_cron_upload(
    target: str = Query(..., description="recommend2 | golden-cross | … | chart-kr | chart-us"),
    authorization: str | None = Header(default=None),
    body: dict = Body(...),
):
    """GitHub Actions가 빌드한 JSON을 Render 디스크에 반영 (재스캔 없음)."""
    _verify_cron(authorization)
    try:
        from snapshot_upload import apply_upload

        return apply_upload(target, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"snapshot upload failed: {exc}") from exc


@app.get("/api/long-term/screens")
def long_term_screens_get():
    """장기 추천 로직 스냅샷 + 최근 100건 이력."""
    try:
        from long_term_runner import get_public_payload

        payload = get_public_payload()
        json.dumps(payload)
        return payload
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"long-term screens failed: {exc}") from exc


@app.post("/api/long-term/cron/chunk")
def long_term_cron_chunk(
    trim_first: bool = Query(False, description="먼저 TOP 2로 자르고 누적 이력 삭제"),
    skip_chunk: bool = Query(False, description="trim/bootstrap만 수행하고 청크 스캔 생략"),
    bootstrap_gaps: bool = Query(False, description="마법공식·F-스코어 picks 부족 시장 즉시 풀스캔"),
    session_start: bool = Query(False, description="cron 세션 시작 — scan job 등록"),
    session_complete: bool = Query(False, description="cron 세션 종료 — scan job 완료"),
    authorization: str | None = Header(default=None),
):
    """한가한 시간대 청크 1회 — 전략별 배치 크기 자동. trim_first·bootstrap_gaps 지원."""
    _verify_cron(authorization)
    try:
        from scan_job import touch_cron_scan

        if session_complete and skip_chunk and not trim_first and not bootstrap_gaps:
            touch_cron_scan(
                "long-term-screens",
                step=12,
                total_steps=12,
                step_label="자동 갱신 완료",
                session_complete=True,
            )
            return {"ok": True, "sessionComplete": True}

        trim_result = None
        bootstrap_result = None
        if trim_first:
            from long_term_runner import trim_picks_and_clear_history

            trim_result = trim_picks_and_clear_history()
        if bootstrap_gaps:
            from long_term_runner import run_bootstrap_gaps

            bootstrap_result = run_bootstrap_gaps()
        if skip_chunk:
            out = {"ok": True, "skippedChunk": True}
            if trim_result is not None:
                out["trim"] = trim_result
            if bootstrap_result is not None:
                out["bootstrap"] = bootstrap_result
            json.dumps(out)
            return out
        from long_term_runner import MARKET_ORDER, STRATEGIES, STRATEGY_ORDER, run_next_chunk

        if session_start:
            touch_cron_scan(
                "long-term-screens",
                step=1,
                total_steps=len(STRATEGY_ORDER) * len(MARKET_ORDER),
                step_label="장기추천 청크 스캔 시작",
                session_start=True,
            )

        result = run_next_chunk()
        chunk = result.get("chunk") or {}
        strategy_id = str(chunk.get("strategyId") or STRATEGY_ORDER[0])
        market = str(chunk.get("market") or MARKET_ORDER[0])
        offset = int(chunk.get("offset") or 0)
        chunk_size = int(chunk.get("chunkSize") or 1)
        strategy_label = (STRATEGIES.get(strategy_id) or {}).get("label") or strategy_id
        try:
            strat_idx = STRATEGY_ORDER.index(strategy_id)
            market_idx = MARKET_ORDER.index(market)
            step = strat_idx * len(MARKET_ORDER) + market_idx + 1
        except ValueError:
            step = 1
        total_steps = len(STRATEGY_ORDER) * len(MARKET_ORDER)
        step_label = f"{strategy_label} · {market.upper()} offset {offset}+{chunk_size}"

        touch_cron_scan(
            "long-term-screens",
            step=step,
            total_steps=total_steps,
            step_label=step_label,
            session_complete=session_complete,
        )
        if trim_result is not None:
            result = {**result, "trim": trim_result}
        if bootstrap_result is not None:
            result = {**result, "bootstrap": bootstrap_result}
        json.dumps(result)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"long-term chunk failed: {exc}") from exc


@app.post("/api/long-term/cron/trim-picks")
def long_term_cron_trim_picks(authorization: str | None = Header(default=None)):
    """전략·시장별 추천 TOP 2로 자르고 누적 추천 이력 전부 삭제."""
    _verify_cron(authorization)
    try:
        from long_term_runner import trim_picks_and_clear_history

        result = trim_picks_and_clear_history()
        json.dumps(result)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"long-term trim failed: {exc}") from exc


@app.post("/api/stock-picks/cron/batch-build")
def stock_picks_cron_batch_build(
    region: str = Query(
        "kospi",
        pattern="^(all|kr|us|kospi|kosdaq|nasdaq|nyse)$",
    ),
    offset: int = Query(0, ge=0, le=200),
    limit: int = Query(25, ge=1, le=100),
    finalize: bool = Query(False),
    authorization: str | None = Header(default=None),
):
    _verify_cron(authorization)
    try:
        from stock_picks_batch import build_and_save_batch_market, build_and_save_batch_region

        if region in ("kospi", "kosdaq", "nasdaq", "nyse"):
            payload = build_and_save_batch_market(
                region,
                collect_chart_data,
                after_scheduled_update=True,
                source="cron",
                offset=offset,
                limit=limit,
                finalize=finalize,
            )
        else:
            payload = build_and_save_batch_region(
                collect_chart_data,
                region=region,
                after_scheduled_update=True,
                source="cron",
            )
        json.dumps(payload)
        return payload
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"cron batch-build failed: {exc}") from exc


@app.post("/api/stock-strategy/cron/build")
def stock_strategy_cron_build(
    region: str = Query("all", pattern="^(kr|us|all)$"),
    strategy: str = Query(
        "all",
        pattern="^(golden-cross|bollinger|rsi-divergence|candle-support|obv-divergence|bottom-pattern|vcp|all)$",
    ),
    authorization: str | None = Header(default=None),
):
    _verify_cron(authorization)
    try:
        from stock_strategy_engine import make_yfinance_fetcher
        from stock_strategy_snapshot import STRATEGY_REGISTRY, build_and_save_snapshot

        fetch = make_yfinance_fetcher()
        keys = list(STRATEGY_REGISTRY.keys()) if strategy == "all" else [strategy]
        results: dict[str, Any] = {}
        for sid in keys:
            payload = build_and_save_snapshot(
                sid,
                fetch,
                period="6mo",
                region=region,
                after_scheduled_update=True,
            )
            record_info = None
            record_error = None
            try:
                from stock_strategy_record import record_strategy_run

                record_info = record_strategy_run(sid, payload, source="cron")
            except Exception as exc:
                record_error = str(exc)
            results[sid] = {
                "activeCount": payload.get("activeCount", 0),
                "updatedAtNy": payload.get("updatedAtNy"),
                "record": record_info,
                "recordError": record_error,
            }
        return {"ok": True, "region": region, "strategies": results}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to build stock strategy snapshot: {exc}",
        ) from exc


@app.post("/api/stock-strategy/cron/backfill-hold-returns")
def stock_strategy_cron_backfill_hold_returns(
    days: int = Query(14, ge=1, le=60, description="최근 N일 신호만 보유일 수익률 재계산"),
    include_recommend2: bool = Query(True),
    authorization: str | None = Header(default=None),
):
    """기존 스냅샷 recentSignals에 holdDay2~5ReturnPct 실제 종가 기준 백필."""
    _verify_cron(authorization)
    try:
        from hold_return_backfill import backfill_recommend2_snapshot, backfill_strategy_snapshots

        results: dict[str, Any] = {
            "ok": True,
            "days": days,
            "strategies": backfill_strategy_snapshots(
                lookback_days=days,
                save_disk=True,
                save_supabase=True,
            ),
        }
        if include_recommend2:
            results["recommend2"] = backfill_recommend2_snapshot(
                lookback_days=days,
                save_disk=True,
                save_supabase=True,
            )
        json.dumps(results)
        return results
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"hold return backfill failed: {exc}",
        ) from exc


@app.get("/api/chart/kr-snapshot")
def chart_kr_snapshot(
    market: str | None = Query(None, pattern="^(kr_kospi|kr_kosdaq)$"),
):
    return _chart_region_snapshot("kr", market)


@app.get("/api/chart/us-snapshot")
def chart_us_snapshot(
    market: str | None = Query(None, pattern="^(nyse|nasdaq)$"),
):
    return _chart_region_snapshot("us", market)


def _chart_region_snapshot(region: str, market: str | None) -> dict[str, Any]:
    try:
        from chart_snapshot import load_snapshot

        payload = load_snapshot(region, refresh=True)
        if not payload:
            raise HTTPException(status_code=404, detail=f"{region.upper()} chart snapshot not found")
        if market:
            block = (payload.get("markets") or {}).get(market)
            if not block:
                raise HTTPException(status_code=404, detail=f"No snapshot for market: {market}")
            out = dict(block)
            out["updatedAt"] = payload.get("updatedAt")
            out["updateSchedule"] = payload.get("updateSchedule")
            out["source"] = "snapshot"
            out["region"] = region
            json.dumps(out)
            return out
        json.dumps(payload)
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load chart snapshot: {exc}") from exc


@app.post("/api/chart/cron/build")
def chart_cron_build(
    region: str = Query("kr", pattern="^(kr|us)$"),
    authorization: str | None = Header(default=None),
):
    _verify_cron(authorization)
    try:
        from chart_snapshot import REGION_CONFIG, build_and_save_region_snapshot

        def fetch_chart(ticker: str, period: str, interval: str = "1d", **kwargs: Any) -> dict[str, Any]:
            return collect_chart_data(
                ticker,
                period,
                interval,
                after_scheduled_update=kwargs.get("after_scheduled_update", True),
                skip_snapshot=True,
            )

        payload = build_and_save_region_snapshot(
            region,
            fetch_chart,
            _fetch_price_change,
            CHART_MARKET_UNIVERSES,
            after_scheduled_update=True,
        )
        payload["source"] = "cron"
        json.dumps(payload)
        market_keys = REGION_CONFIG[region]["market_keys"]
        return {
            "ok": True,
            "region": region,
            "savedAt": payload.get("savedAt"),
            "updatedAt": payload.get("updatedAt"),
            "markets": {
                k: {"count": (payload.get("markets") or {}).get(k, {}).get("count", 0)}
                for k in market_keys
            },
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to build chart snapshot: {exc}") from exc


@app.get("/api/chart")
def chart(
    ticker: str = Query(..., min_length=3, max_length=16),
    period: str = Query("3mo", pattern="^(1mo|3mo|6mo|1y|2y|5y|10y)$"),
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


@app.get("/api/market-top10")
def market_top10(
    market: str = Query("kr_kospi", pattern="^(kr_kospi|kr_kosdaq|nyse|nasdaq)$"),
    offset: int = Query(0, ge=0, le=99),
    limit: int = Query(30, ge=1, le=30),
):
    try:
        payload = collect_market_top10(market, offset=offset, limit=limit)
        json.dumps(payload)
        return payload
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch market top10: {exc}") from exc


def _verify_cron(authorization: str | None = Header(default=None)) -> None:
    if not CRON_SECRET:
        return
    if authorization != f"Bearer {CRON_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.post("/api/master/grant-digimon")
def master_grant_digimon(
    email: str = Query(..., min_length=3, max_length=200),
    amount: int = Query(..., ge=1, le=1_000_000),
    reason: str = Query("관리자 충전", max_length=200),
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = authorization.removeprefix("Bearer ").strip()
    url = os.getenv("SUPABASE_URL", "").strip() or "https://djxoshkygirqgunawvye.supabase.co"
    anon = os.getenv("SUPABASE_ANON_KEY", "").strip() or (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeG9zaGt5Z2lycWd1bmF3dnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzg1MDMsImV4cCI6MjA5NzUxNDUwM30.Biam_Xx-At_J-a_qmXRDeD6QbxoJM5cIUeBHi7FVXPk"
    )
    try:
        from supabase import create_client

        auth_client = create_client(url, anon)
        user_resp = auth_client.auth.get_user(token)
        user = user_resp.user if user_resp else None
        if not user:
            raise HTTPException(status_code=401, detail="Invalid session")
        meta = user.user_metadata or {}
        from admin_service import ADMIN_EMAILS

        is_master = meta.get("role") == "master" or (user.email or "").strip().lower() in ADMIN_EMAILS
        if not is_master:
            raise HTTPException(status_code=403, detail="Master account required")
        from digimon_admin import grant_digimon_by_email

        payload = grant_digimon_by_email(email, amount, reason)
        json.dumps(payload)
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to grant Digi-Mon: {exc}") from exc


@app.post("/api/admin/grant-digimon")
def admin_grant_digimon(
    email: str = Query(..., min_length=3, max_length=200),
    amount: int = Query(..., ge=1, le=1_000_000),
    reason: str = Query("관리자 충전", max_length=200),
    authorization: str | None = Header(default=None),
):
    _verify_cron(authorization)
    try:
        from digimon_admin import grant_digimon_by_email

        payload = grant_digimon_by_email(email, amount, reason)
        json.dumps(payload)
        return payload
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to grant Digi-Mon: {exc}") from exc


@app.get("/api/admin/users")
def admin_list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: str = Query("", max_length=200),
    authorization: str | None = Header(default=None),
):
    from admin_service import list_users, verify_admin_from_bearer

    verify_admin_from_bearer(authorization)
    try:
        return list_users(page=page, limit=limit, search=search)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Admin users query failed: {exc}") from exc


@app.get("/api/admin/users/{user_id}/dm-history")
def admin_user_dm_history(
    user_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    authorization: str | None = Header(default=None),
):
    from admin_service import user_dm_history, verify_admin_from_bearer

    verify_admin_from_bearer(authorization)
    try:
        return user_dm_history(user_id=user_id, limit=limit, offset=offset)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Admin DM history failed: {exc}") from exc


@app.get("/api/admin/menu-stats")
def admin_menu_stats(
    days: int = Query(30, ge=1, le=365),
    authorization: str | None = Header(default=None),
):
    from admin_service import menu_stats, verify_admin_from_bearer

    verify_admin_from_bearer(authorization)
    try:
        return menu_stats(days=days)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Admin menu stats failed: {exc}") from exc


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
    trade_date: str | None = Query(
        None,
        description="Optional YYYY-MM-DD; defaults to today in market timezone",
    ),
    lookback_days: int = Query(7, ge=1, le=30),
    authorization: str | None = Header(default=None),
):
    _verify_cron(authorization)
    trade_day = None
    if trade_date:
        try:
            from datetime import date as date_cls

            trade_day = date_cls.fromisoformat(trade_date[:10])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid trade_date") from exc
    try:
        return finalize_predictions_for_group(
            market,
            trade_day=trade_day,
            lookback_days=lookback_days,
        )
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


@app.get("/api/notifications/vapid-public-key")
def notifications_vapid_public_key():
    from push_notifications import get_vapid_public_key, vapid_configured

    if not vapid_configured():
        raise HTTPException(
            status_code=503,
            detail="Push notifications are not configured (VAPID keys missing on server).",
        )
    return {"publicKey": get_vapid_public_key()}


@app.get("/api/notifications/status")
def notifications_status(authorization: str | None = Header(default=None)):
    from auth_user import require_user_from_bearer
    from push_notifications import get_subscription_status, vapid_configured

    user = require_user_from_bearer(authorization)
    status = get_subscription_status(user["id"])
    status["vapidConfigured"] = vapid_configured()
    return status


@app.post("/api/notifications/subscribe")
def notifications_subscribe(
    body: dict[str, Any],
    authorization: str | None = Header(default=None),
):
    from auth_user import require_user_from_bearer, spend_digimon_with_token
    from push_notifications import upsert_subscription, user_region_enabled, vapid_configured

    if not vapid_configured():
        raise HTTPException(
            status_code=503,
            detail="Push 알림이 아직 설정되지 않았습니다 (Render VAPID 키 확인).",
        )

    user = require_user_from_bearer(authorization)
    endpoint = str(body.get("endpoint") or "").strip()
    keys = body.get("keys") or {}
    p256dh = str(keys.get("p256dh") or "").strip()
    auth_key = str(keys.get("auth") or "").strip()
    region = str(body.get("region") or "").strip().lower()
    if region not in ("kr", "us"):
        raise HTTPException(status_code=400, detail="region must be kr or us")
    if not endpoint or not p256dh or not auth_key:
        raise HTTPException(status_code=400, detail="Invalid push subscription")

    region_label = "한국장" if region == "kr" else "미국장"
    dm_spent = False
    digimon_balance: int | None = None

    try:
        if not user_region_enabled(user["id"], region):
            digimon_balance = spend_digimon_with_token(
                user["access_token"],
                1,
                f"{region_label} Stock 알림 설정",
            )
            dm_spent = True

        kr_flag = True if region == "kr" else None
        us_flag = True if region == "us" else None
        status = upsert_subscription(
            user["id"],
            endpoint,
            p256dh,
            auth_key,
            kr_enabled=kr_flag,
            us_enabled=us_flag,
        )
        status["dmSpent"] = dm_spent
        if digimon_balance is not None:
            status["digimonBalance"] = digimon_balance
        json.dumps(status)
        return status
    except HTTPException:
        raise
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Subscribe failed: {exc}") from exc


@app.patch("/api/notifications/preferences")
def notifications_preferences(
    body: dict[str, Any],
    authorization: str | None = Header(default=None),
):
    from auth_user import require_user_from_bearer
    from push_notifications import set_region_enabled

    user = require_user_from_bearer(authorization)
    region = str(body.get("region") or "").strip().lower()
    if region not in ("kr", "us"):
        raise HTTPException(status_code=400, detail="region must be kr or us")
    enabled = body.get("enabled")
    if not isinstance(enabled, bool):
        raise HTTPException(status_code=400, detail="enabled must be boolean")
    try:
        return set_region_enabled(user["id"], region, enabled)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Preferences update failed: {exc}") from exc


@app.post("/api/notifications/test")
def notifications_test(
    region: str = Query(..., pattern="^(kr|us)$"),
    authorization: str | None = Header(default=None),
):
    from auth_user import require_user_from_bearer
    from notification_digest import build_region_digest, digest_to_notification_payload
    from push_notifications import (
        get_subscription_status,
        send_digest_to_subscriptions,
        vapid_configured,
    )

    if not vapid_configured():
        raise HTTPException(status_code=503, detail="Push notifications are not configured")

    user = require_user_from_bearer(authorization)
    status = get_subscription_status(user["id"])
    if region == "kr" and not status.get("krEnabled"):
        raise HTTPException(status_code=400, detail="한국장 알림이 켜져 있지 않습니다.")
    if region == "us" and not status.get("usEnabled"):
        raise HTTPException(status_code=400, detail="미국장 알림이 켜져 있지 않습니다.")

    try:
        digest = build_region_digest(region)
        payload = digest_to_notification_payload(digest)
        result = send_digest_to_subscriptions(region, payload, user_id=user["id"])
        json.dumps(result)
        return {"ok": True, "preview": payload, **result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Test notification failed: {exc}") from exc


@app.get("/api/notifications/last-digest")
def notifications_last_digest(region: str = Query(..., pattern="^(kr|us)$")):
    from push_notifications import get_last_digest_log, vapid_configured

    if not vapid_configured():
        return {"ok": False, "configured": False, "last": None}
    row = get_last_digest_log(region)
    return {"ok": True, "configured": True, "last": row}


@app.post("/api/notifications/cron/digest")
def notifications_cron_digest(
    region: str = Query(..., pattern="^(kr|us)$"),
    authorization: str | None = Header(default=None),
):
    _verify_cron(authorization)
    from notification_digest import build_region_digest, digest_to_notification_payload
    from push_notifications import log_digest_send, send_digest_to_subscriptions, vapid_configured

    if not vapid_configured():
        raise HTTPException(status_code=503, detail="Push notifications are not configured")

    try:
        digest = build_region_digest(region)
        payload = digest_to_notification_payload(digest)
        result = send_digest_to_subscriptions(region, payload)
        log_digest_send(region, digest.get("sendDate") or digest.get("tradeDate") or "", digest, result)
        json.dumps(result)
        out = {"ok": True, "preview": payload, **result}
        if result.get("subscriberCount", 0) > 0 and result.get("successCount", 0) == 0:
            raise HTTPException(
                status_code=502,
                detail="Digest built but push delivery failed for all subscribers",
            )
        return out
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Digest send failed: {exc}") from exc


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


def _gutenberg_text_source_urls(book_id: int, primary_url: str) -> list[str]:
    """Ordered fallbacks when the primary Gutendex text URL is unreachable."""
    urls: list[str] = []
    for candidate in (
        primary_url,
        f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt",
        f"https://www.gutenberg.org/ebooks/{book_id}.txt.utf-8",
    ):
        if candidate and candidate not in urls:
            urls.append(candidate)
    return urls


_BOOK_TEXT_CACHE: dict[int, tuple[str, str, float]] = {}
_BOOK_TEXT_CACHE_MAX = 48
_BOOK_TEXT_CACHE_TTL_SEC = 7 * 24 * 3600


def _book_text_cache_get(book_id: int) -> tuple[str, str] | None:
    row = _BOOK_TEXT_CACHE.get(book_id)
    if not row:
        return None
    text, source_url, cached_at = row
    if time.time() - cached_at > _BOOK_TEXT_CACHE_TTL_SEC:
        _BOOK_TEXT_CACHE.pop(book_id, None)
        return None
    return text, source_url


def _book_text_cache_put(book_id: int, text: str, source_url: str) -> None:
    if not text:
        return
    _BOOK_TEXT_CACHE[book_id] = (text, source_url, time.time())
    if len(_BOOK_TEXT_CACHE) <= _BOOK_TEXT_CACHE_MAX:
        return
    oldest = sorted(_BOOK_TEXT_CACHE.items(), key=lambda item: item[1][2])
    for key, _ in oldest[: len(_BOOK_TEXT_CACHE) - _BOOK_TEXT_CACHE_MAX]:
        _BOOK_TEXT_CACHE.pop(key, None)


def _fetch_url_text_once(url: str, max_bytes: int = 8_000_000) -> str:
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


def _fetch_gutenberg_book_text(book_id: int, primary_url: str) -> tuple[str, str]:
    cached = _book_text_cache_get(book_id)
    if cached:
        return cached

    urls = _gutenberg_text_source_urls(book_id, primary_url)
    last_detail = "unknown error"
    for url in urls:
        for attempt in range(3):
            try:
                text = _fetch_url_text_once(url)
                if text.strip():
                    _book_text_cache_put(book_id, text, url)
                    return text, url
            except HTTPException as exc:
                last_detail = str(exc.detail)
            except Exception as exc:
                last_detail = str(exc)
            if attempt < 2:
                time.sleep(1.2 * (attempt + 1))
    raise HTTPException(status_code=502, detail=f"Failed to download book text: {last_detail}")


def _pick_cover_url(formats: dict[str, str], book_id: int) -> str:
    cover = formats.get("image/jpeg")
    if cover:
        return cover
    return f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.cover.medium.jpg"


def _pick_html_url(formats: dict[str, str], book_id: int) -> str:
    html_url = formats.get("text/html")
    if html_url:
        return html_url
    return f"https://www.gutenberg.org/ebooks/{book_id}.html.images"


def _decode_utf8_prefix(raw: bytes) -> str:
    if not raw:
        return ""
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        for trim in range(1, min(4, len(raw)) + 1):
            try:
                return raw[:-trim].decode("utf-8")
            except UnicodeDecodeError:
                continue
        return raw.decode("utf-8", errors="replace")


def _fetch_url_text_prefix(url: str, preview_bytes: int) -> tuple[str, bool]:
    """Return (text, is_partial). Reads at most preview_bytes from the source."""
    limit = max(1024, min(int(preview_bytes), 500_000))
    range_req = urllib.request.Request(
        url,
        headers={
            "User-Agent": GUTENDEX_UA,
            "Range": f"bytes=0-{limit - 1}",
        },
    )
    try:
        with urllib.request.urlopen(range_req, timeout=60) as resp:
            code = resp.getcode()
            raw = resp.read(limit + 1)
            if code == 206:
                body = raw[:limit]
                content_range = resp.headers.get("Content-Range", "")
                total_size: int | None = None
                if "/" in content_range:
                    try:
                        total_size = int(content_range.rsplit("/", 1)[-1])
                    except ValueError:
                        total_size = None
                is_partial = total_size is None or total_size > len(body)
                return _decode_utf8_prefix(body), is_partial
            if code == 200:
                is_partial = len(raw) > limit
                body = raw[:limit] if is_partial else raw
                return _decode_utf8_prefix(body), is_partial
    except urllib.error.HTTPError as exc:
        if exc.code not in (416, 501, 403):
            raise HTTPException(
                status_code=exc.code,
                detail=f"Failed to download book text preview: {exc.reason}",
            ) from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to download book text preview: {exc.reason}") from exc

    plain_req = urllib.request.Request(url, headers={"User-Agent": GUTENDEX_UA})
    try:
        with urllib.request.urlopen(plain_req, timeout=60) as resp:
            raw = resp.read(limit + 1)
            is_partial = len(raw) > limit
            body = raw[:limit] if is_partial else raw
            return _decode_utf8_prefix(body), is_partial
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=exc.code, detail=f"Failed to download book text: {exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to download book text: {exc.reason}") from exc


def _fetch_url_text(url: str, max_bytes: int = 8_000_000) -> str:
    return _fetch_url_text_once(url, max_bytes)


HTML_MAX_BYTES = 12_000_000


def _inject_html_base(html: str, source_url: str) -> str:
    """Resolve relative assets against the Gutenberg source path."""
    parsed = urllib.parse.urlparse(source_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    path = parsed.path or ""
    if "/" in path:
        base_href = origin + path.rsplit("/", 1)[0] + "/"
    else:
        base_href = origin + "/"
    base_tag = f'<base href="{base_href}">'
    if re.search(r"<base\s", html, flags=re.I):
        return html
    head_match = re.search(r"<head[^>]*>", html, flags=re.I)
    if head_match:
        insert_at = head_match.end()
        return html[:insert_at] + base_tag + html[insert_at:]
    return base_tag + html


def _fetch_url_html(url: str, max_bytes: int = HTML_MAX_BYTES) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": GUTENDEX_UA})
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read(max_bytes + 1)
            if len(raw) > max_bytes:
                raise HTTPException(status_code=413, detail="Book HTML too large for this endpoint")
            charset = resp.headers.get_content_charset() or "utf-8"
            try:
                return raw.decode(charset, errors="replace")
            except LookupError:
                return raw.decode("utf-8", errors="replace")
    except HTTPException:
        raise
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=exc.code, detail=f"Failed to download book HTML: {exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to download book HTML: {exc.reason}") from exc


def _author_years_label(authors: list[dict[str, Any]]) -> str:
    if not authors:
        return ""
    primary = authors[0] or {}
    birth = primary.get("birth_year")
    death = primary.get("death_year")
    if birth is not None and death is not None:
        return f"{birth}–{death}"
    if birth is not None:
        return f"{birth}–?"
    if death is not None:
        return f"?–{death}"
    return ""


def _serialize_book(book: dict[str, Any]) -> dict[str, Any]:
    authors = book.get("authors") or []
    author_names = ", ".join(a.get("name", "") for a in authors if a.get("name"))
    formats = book.get("formats") or {}
    book_id = book.get("id")
    payload: dict[str, Any] = {
        "id": book_id,
        "title": book.get("title") or "Untitled",
        "authors": author_names,
        "author_years": _author_years_label(authors),
        "subjects": book.get("subjects") or [],
        "bookshelves": book.get("bookshelves") or [],
        "languages": book.get("languages") or [],
        "download_count": book.get("download_count"),
        "copyright": book.get("copyright"),
        "license": "public_domain_us",
    }
    if book_id:
        payload["cover_url"] = _pick_cover_url(formats, int(book_id))
        payload["html_url"] = _pick_html_url(formats, int(book_id))
    for epub_key in ("application/epub+zip", "application/epub+zip; charset=utf-8"):
        epub_url = formats.get(epub_key)
        if epub_url:
            payload["epub_url"] = epub_url
            break
    return payload


GUTENBERG_THEMES: dict[str, dict[str, Any]] = {
    "shakespeare": {
        "label": "셰익스피어 명작",
        "description": "햄릿, 로미오와 줄리엣, 맥베스, 오셀로, 리어 왕 등",
        "book_ids": [1524, 1513, 1533, 1531, 1532, 1120, 1514, 1515, 1530, 1041],
    },
    "classic_novels": {
        "label": "영미 고전 소설",
        "description": "오만과 편견, 제인 에어, 위더링 하이츠, 위대한 유산 등",
        "book_ids": [1342, 1260, 768, 1400, 2701, 84, 345, 174, 120, 1661, 161, 514],
    },
    "romance": {
        "label": "로맨스 명작",
        "description": "사랑과 운명을 다룬 고전 로맨스",
        "book_ids": [1342, 1513, 161, 768, 1260, 10554, 1399, 514, 1259],
    },
    "mystery": {
        "label": "미스터리·추리",
        "description": "셜록 홈즈, 드라큘라, 추리 고전",
        "book_ids": [1661, 2097, 244, 345, 6133, 834, 69087],
    },
    "scifi_fantasy": {
        "label": "SF·판타지",
        "description": "프랑켄슈타인, 이상한 나라의 앨리스, 타임머신 등",
        "book_ids": [84, 11, 35, 36, 188, 16, 55, 74],
    },
    "children": {
        "label": "어린이·동화 고전",
        "description": "이상한 나라의 앨리스, 오즈, 정글북, 어린 왕자 등",
        "book_ids": [11, 55, 236, 16, 120, 2610, 46, 2781],
    },
    "philosophy": {
        "label": "철학·고전 사상",
        "description": "플라톤, 마르쿠스 아우렐리우스, 마키아벨리 등",
        "book_ids": [1497, 2680, 1232, 4363, 5827, 2600],
    },
    "american_classics": {
        "label": "미국 문학 명작",
        "description": "모비딕, 허클베리 핀, 독자 연설, 월든 등",
        "book_ids": [2701, 76, 74, 25344, 205, 514, 43],
    },
    "arabian_nights": {
        "label": "아라비안 나이트",
        "description": "천일야화, 아라비아·동방 무협·환상 이야기",
        "book_ids": [128, 3435, 19860, 7128, 3825],
    },
    "aesop_fables": {
        "label": "이솝 우화",
        "description": "이솝 우화집과 교훈 이야기",
        "book_ids": [21, 11339, 18732, 1837, 620],
    },
    "andersen_fairy": {
        "label": "안데르센 동화",
        "description": "인어공주, 성냥팔이 소녀, 미운 오리 새끼 등",
        "book_ids": [1597, 32572, 27200, 35611, 902],
    },
    "grimm_fairy": {
        "label": "그림 형제 동화",
        "description": "신데렐라, 백설공주, 헨젤과 그레텔 등",
        "book_ids": [2591, 55658, 5314, 19036, 32572],
    },
    "world_fairy_tales": {
        "label": "세계 동화 모음",
        "description": "안데르센, 그림, 이솝, 동방 설화를 한데",
        "book_ids": [1597, 2591, 21, 128, 55, 16, 236, 2781],
    },
    "edwardian_children": {
        "label": "근대 아동문학",
        "description": "1900년대 초 아동·청소년 고전 (PD)",
        "book_ids": [1695, 2781, 16, 55, 236, 2610, 175, 47],
    },
    "greek_roman_myth": {
        "label": "그리스·로마 신화",
        "description": "일리아드, 오디세이, 불핀치 신화 등",
        "book_ids": [6130, 1727, 2199, 260, 34893, 16389],
    },
    "adventure_tales": {
        "label": "모험·탐험 이야기",
        "description": "보물섬, 지구 중심 여행, 로빈슨 등",
        "book_ids": [120, 188, 103, 209, 829, 74, 76, 215],
    },
    "gothic_horror": {
        "label": "고딕·호러",
        "description": "프랑켄슈타인, 드라큘라, 지킬 밀스터 등",
        "book_ids": [84, 345, 42, 2147, 69087, 42324],
    },
    "short_story_masters": {
        "label": "단편 명작",
        "description": "에드거 앨런 포, 모파상 등 단편집",
        "book_ids": [2147, 932, 834, 20583, 40436, 1952],
    },
    "wisdom_parables": {
        "label": "우화·교훈·격언",
        "description": "이솝, 교훈 이야기, 삶의 지혜 고전",
        "book_ids": [21, 2680, 1232, 1497, 1998, 8800],
    },
    "nursery_rhymes": {
        "label": "동요·놀이동시",
        "description": "Mother Goose, 동요· nursery rhyme 모음",
        "book_ids": [13214, 17661, 18546, 3314, 19551],
    },
    "legend_knights": {
        "label": "기사·전설·아thur",
        "description": "아서 왕, 기사도, 중세 전설",
        "book_ids": [1251, 1739, 49260, 14328, 8712],
    },
}

THEME_GUTENDEX_EXPAND: dict[str, dict[str, Any]] = {
    "shakespeare": {
        "search_queries": ["Shakespeare"],
        "topics": ["Drama", "Tragedies"],
    },
    "classic_novels": {
        "search_queries": ["English fiction", "British fiction"],
        "topics": ["England -- Fiction", "Historical fiction"],
    },
    "romance": {
        "search_queries": ["romance fiction"],
        "topics": ["Romance fiction", "Love stories"],
    },
    "mystery": {
        "search_queries": ["mystery detective", "Sherlock Holmes"],
        "topics": ["Detective and mystery stories", "Mystery fiction"],
    },
    "scifi_fantasy": {
        "search_queries": ["science fiction", "fantasy fiction"],
        "topics": ["Science fiction", "Fantasy fiction"],
    },
    "children": {
        "search_queries": ["children's literature", "juvenile fiction"],
        "topics": ["Children's literature", "Juvenile fiction"],
    },
    "philosophy": {
        "search_queries": ["philosophy Plato", "Stoics"],
        "topics": ["Philosophy", "Ethics"],
    },
    "american_classics": {
        "search_queries": ["American fiction classics"],
        "topics": ["United States -- Fiction", "American fiction"],
    },
    "arabian_nights": {
        "search_queries": ["Arabian Nights", "One Thousand and One Nights"],
        "topics": ["Folklore -- Arab countries", "Arabian nights"],
    },
    "aesop_fables": {
        "search_queries": ["Aesop fables"],
        "topics": ["Fables", "Aesop's fables"],
    },
    "andersen_fairy": {
        "search_queries": ["Hans Christian Andersen fairy tales"],
        "topics": ["Fairy tales", "Andersen"],
    },
    "grimm_fairy": {
        "search_queries": ["Grimm fairy tales", "Household stories"],
        "topics": ["Fairy tales", "Folklore -- Germany"],
    },
    "world_fairy_tales": {
        "search_queries": ["fairy tales", "folk tales", "Grimm", "Andersen", "Aesop fables"],
        "topics": ["Fairy tales", "Folklore", "Children's stories"],
    },
    "edwardian_children": {
        "search_queries": ["children's books Edwardian", "juvenile literature"],
        "topics": ["Children's literature", "Juvenile fiction"],
    },
    "greek_roman_myth": {
        "search_queries": ["Greek mythology", "Roman mythology", "Homer"],
        "topics": ["Mythology, Greek", "Mythology, Roman"],
    },
    "adventure_tales": {
        "search_queries": ["adventure fiction", "Treasure Island"],
        "topics": ["Adventure stories", "Sea stories"],
    },
    "gothic_horror": {
        "search_queries": ["gothic horror", "Dracula Frankenstein"],
        "topics": ["Horror tales", "Gothic fiction"],
    },
    "short_story_masters": {
        "search_queries": ["short stories Poe", "Maupassant"],
        "topics": ["Short stories", "American fiction"],
    },
    "wisdom_parables": {
        "search_queries": ["fables parables", "Aesop"],
        "topics": ["Fables", "Ethics"],
    },
    "nursery_rhymes": {
        "search_queries": ["Mother Goose nursery rhymes"],
        "topics": ["Nursery rhymes", "Children's poetry"],
    },
    "legend_knights": {
        "search_queries": ["King Arthur knights", "Arthurian legends"],
        "topics": ["Arthurian romances", "Knights and knighthood"],
    },
}

for _theme_id, _expand in THEME_GUTENDEX_EXPAND.items():
    if _theme_id in GUTENBERG_THEMES:
        GUTENBERG_THEMES[_theme_id].update(_expand)

GUTENBERG_AUTHORS: dict[str, dict[str, Any]] = {
    "shakespeare": {"label": "셰익스피어", "description": "햄릿, 로미오와 줄리엣, 맥베스 등", "book_ids": [1524, 1513, 1533, 1531, 1532, 1120]},
    "jane_austen": {"label": "제인 오스틴", "description": "오만과 편견, 엠마, 설득력 등", "book_ids": [1342, 161, 105, 121]},
    "charles_dickens": {"label": "찰스 디킨스", "description": "위대한 유산, 올리버 트위스트 등", "book_ids": [1400, 98, 766, 730]},
    "mark_twain": {"label": "마크 트웨인", "description": "허클베리 핀, 톰 소여의 모험 등", "book_ids": [76, 74, 245, 3186]},
    "leo_tolstoy": {"label": "톨스토이", "description": "안나 카레니나, 전쟁과 평화 등", "book_ids": [2600, 986, 243]},
    "dostoyevsky": {"label": "도스토옙스키", "description": "죄와 벌, 카라마조프가의 형제들 등", "book_ids": [2554, 2373, 219]},
    "homer": {"label": "호메로스", "description": "일리아드, 오디세이", "book_ids": [6130, 1727, 2199]},
    "edgar_allan_poe": {"label": "에드거 앨런 포", "description": "시·단편, 미스터리 고전", "book_ids": [2147, 932, 834, 20583]},
    "arthur_conan_doyle": {"label": "아서 코난 도일", "description": "셜록 홈즈 시리즈", "book_ids": [1661, 2097, 834, 2350]},
    "charlotte_bronte": {"label": "샬럿 브론테", "description": "제인 에어, 빌레트 등", "book_ids": [1260, 969]},
    "emily_bronte": {"label": "에밀리 브론테", "description": "위더링 하이츠", "book_ids": [768]},
    "mary_shelley": {"label": "메리 셸리", "description": "프랑켄슈타인", "book_ids": [84, 42324]},
    "herman_melville": {"label": "허먼 멜빌", "description": "모비딕, 빌리 버드 등", "book_ids": [2701, 804, 1125]},
    "oscar_wilde": {"label": "오스카 와일드", "description": "도리안 그레이의 초상, 행복의 왕자 등", "book_ids": [174, 844, 902]},
    "jonathan_swift": {"label": "조너선 스위프트", "description": "걸리버 여행기", "book_ids": [829, 1080]},
    "lewis_carroll": {"label": "루이스 캐럴", "description": "이상한 나라의 앨리스", "book_ids": [11, 928, 19033]},
    "jules_verne": {"label": "쥘 베른", "description": "해저 2만 리, 80일간의 세계일주 등", "book_ids": [164, 103, 5097, 18857]},
    "hg_wells": {"label": "H.G. 웰스", "description": "타임머신, 우주전쟁 등", "book_ids": [35, 36, 5230, 11870]},
    "robert_louis_stevenson": {"label": "로버트 루이스 스티븐슨", "description": "보물섬, 지킬 밀스터 박사 등", "book_ids": [120, 42, 1023]},
    "franz_kafka": {"label": "프란츠 카프카", "description": "변신, 심판, 성 등", "book_ids": [7849, 17989, 5200]},
    "plato": {"label": "플라톤", "description": "국가, 대화편 등", "book_ids": [1497, 1656, 1570]},
    "dante": {"label": "단테", "description": "신곡", "book_ids": [1004, 1000, 8800]},
    "virgil": {"label": "베르길리우스", "description": "아이네이스", "book_ids": [228, 5022]},
    "charles_darwin": {"label": "찰스 다윈", "description": "종의 기원 등", "book_ids": [1228, 2300, 944]},
    "benjamin_franklin": {"label": "벤저민 프랭클린", "description": "프랭클린 자서전 등", "book_ids": [20203, 148]},
    "sun_tzu": {"label": "손자", "description": "손자병법", "book_ids": [132, 17489]},
    "voltaire": {"label": "볼테르", "description": "캉디드 등", "book_ids": [19942, 4650]},
    "alexandre_dumas": {"label": "알렉상드르 뒤마", "description": "몬테크리스토 백작, 삼총사 등", "book_ids": [1257, 1184, 1259]},
    "victor_hugo": {"label": "빅토르 위고", "description": "레 미제라블, 노트르담 드 파리 등", "book_ids": [135, 2610, 48734]},
    "moliere": {"label": "몰리에르", "description": "타르티프, 여성들의 학교 등", "book_ids": [6790, 9017, 9070]},
}

AUTHOR_GUTENDEX_EXPAND: dict[str, dict[str, Any]] = {
    "shakespeare": {"search_queries": ["William Shakespeare"]},
    "jane_austen": {"search_queries": ["Jane Austen"]},
    "charles_dickens": {"search_queries": ["Charles Dickens"]},
    "mark_twain": {"search_queries": ["Mark Twain"]},
    "leo_tolstoy": {"search_queries": ["Leo Tolstoy", "Tolstoy"]},
    "dostoyevsky": {"search_queries": ["Dostoyevsky", "Dostoevsky"]},
    "homer": {"search_queries": ["Homer"]},
    "edgar_allan_poe": {"search_queries": ["Edgar Allan Poe"]},
    "arthur_conan_doyle": {"search_queries": ["Arthur Conan Doyle"]},
    "charlotte_bronte": {"search_queries": ["Charlotte Brontë", "Charlotte Bronte"]},
    "emily_bronte": {"search_queries": ["Emily Brontë", "Emily Bronte"]},
    "mary_shelley": {"search_queries": ["Mary Shelley"]},
    "herman_melville": {"search_queries": ["Herman Melville"]},
    "oscar_wilde": {"search_queries": ["Oscar Wilde"]},
    "jonathan_swift": {"search_queries": ["Jonathan Swift"]},
    "lewis_carroll": {"search_queries": ["Lewis Carroll"]},
    "jules_verne": {"search_queries": ["Jules Verne"]},
    "hg_wells": {"search_queries": ["H. G. Wells", "Wells Herbert"]},
    "robert_louis_stevenson": {"search_queries": ["Robert Louis Stevenson"]},
    "franz_kafka": {"search_queries": ["Franz Kafka"]},
    "plato": {"search_queries": ["Plato"]},
    "dante": {"search_queries": ["Dante Alighieri", "Dante"]},
    "virgil": {"search_queries": ["Virgil"]},
    "charles_darwin": {"search_queries": ["Charles Darwin"]},
    "benjamin_franklin": {"search_queries": ["Benjamin Franklin"]},
    "sun_tzu": {"search_queries": ["Sun Tzu"]},
    "voltaire": {"search_queries": ["Voltaire"]},
    "alexandre_dumas": {"search_queries": ["Alexandre Dumas"]},
    "victor_hugo": {"search_queries": ["Victor Hugo"]},
    "moliere": {"search_queries": ["Molière", "Moliere"]},
}

for _author_id, _expand in AUTHOR_GUTENDEX_EXPAND.items():
    if _author_id in GUTENBERG_AUTHORS:
        GUTENBERG_AUTHORS[_author_id].update(_expand)

THEME_PAGE_SIZE = 32
THEME_GUTENDEX_MAX = 96
THEME_GUTENDEX_MAX_PAGES = 8


def _theme_meta(theme_id: str) -> dict[str, Any]:
    theme = GUTENBERG_THEMES.get(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail=f"Unknown book theme: {theme_id}")
    return theme


def _author_meta(author_id: str) -> dict[str, Any]:
    author = GUTENBERG_AUTHORS.get(author_id)
    if not author:
        raise HTTPException(status_code=404, detail=f"Unknown book author: {author_id}")
    return author


def _fetch_author_books(author_id: str, search: str | None = None) -> list[dict[str, Any]]:
    return _fetch_curated_books(_author_meta(author_id), search=search)


def _gutendex_collect_books(
    *,
    search: str | None = None,
    topic: str | None = None,
    max_books: int = THEME_GUTENDEX_MAX,
) -> dict[int, dict[str, Any]]:
    by_id: dict[int, dict[str, Any]] = {}
    page = 1
    while len(by_id) < max_books and page <= THEME_GUTENDEX_MAX_PAGES:
        params: dict[str, Any] = {"page": page, "languages": "en"}
        if search:
            params["search"] = search
        if topic:
            params["topic"] = topic
        data = _gutendex_request("/books", params)
        results = data.get("results") or []
        if not results:
            break
        for book in results:
            if not _is_commercial_pd(book):
                continue
            book_id = book.get("id")
            if book_id is None:
                continue
            bid = int(book_id)
            if bid not in by_id:
                by_id[bid] = _serialize_book(book)
        if not data.get("next"):
            break
        page += 1
    return by_id


def _fetch_curated_books(meta: dict[str, Any], search: str | None = None) -> list[dict[str, Any]]:
    by_id: dict[int, dict[str, Any]] = {}
    max_books = int(meta.get("max_books") or THEME_GUTENDEX_MAX)

    for book_id in meta.get("book_ids") or []:
        try:
            book = _gutendex_request(f"/books/{book_id}", None)
        except HTTPException:
            continue
        if _is_commercial_pd(book):
            by_id[int(book_id)] = _serialize_book(book)

    for q in meta.get("search_queries") or []:
        if len(by_id) >= max_books:
            break
        for bid, row in _gutendex_collect_books(
            search=q, max_books=max_books - len(by_id)
        ).items():
            if bid not in by_id:
                by_id[bid] = row

    for topic in meta.get("topics") or []:
        if len(by_id) >= max_books:
            break
        for bid, row in _gutendex_collect_books(
            topic=topic, max_books=max_books - len(by_id)
        ).items():
            if bid not in by_id:
                by_id[bid] = row

    books = list(by_id.values())
    query = (search or "").strip().lower()
    if query:
        books = [
            row
            for row in books
            if query in f"{row.get('title', '')} {row.get('authors', '')}".lower()
        ]
    books.sort(key=lambda b: b.get("download_count") or 0, reverse=True)
    return books


def _fetch_theme_books(theme_id: str, search: str | None = None) -> list[dict[str, Any]]:
    return _fetch_curated_books(_theme_meta(theme_id), search=search)


@app.get("/api/gutenberg/themes")
def gutenberg_themes():
    return {
        "themes": [
            {
                "id": theme_id,
                "label": meta["label"],
                "description": meta["description"],
                "book_count": len(meta["book_ids"]),
            }
            for theme_id, meta in GUTENBERG_THEMES.items()
        ]
    }


@app.get("/api/gutenberg/authors")
def gutenberg_authors():
    return {
        "authors": [
            {
                "id": author_id,
                "label": meta["label"],
                "description": meta["description"],
                "book_count": len(meta.get("book_ids") or []),
            }
            for author_id, meta in GUTENBERG_AUTHORS.items()
        ]
    }


@app.get("/api/gutenberg/author-image")
def gutenberg_author_image(file: str = Query(..., min_length=3, max_length=200)):
    try:
        data, content_type = fetch_author_image(file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Image provider error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load image: {exc}") from exc
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=604800"},
    )


@app.get("/api/gutenberg/books")
def gutenberg_books(
    search: str | None = Query(None, max_length=120),
    topic: str | None = Query(None, max_length=80),
    author_year: str | None = Query(None, pattern=r"^\d{4}-\d{4}$"),
    theme: str | None = Query(None, max_length=40),
    author: str | None = Query(None, max_length=40),
    page: int = Query(1, ge=1, le=500),
    languages: str = Query("en", max_length=16),
):
    if theme and author:
        raise HTTPException(status_code=400, detail="theme and author cannot be used together")
    if theme:
        theme_id = theme.strip()
        meta = _theme_meta(theme_id)
        books = _fetch_theme_books(theme_id, search=search)
        total = len(books)
        start = (page - 1) * THEME_PAGE_SIZE
        end = start + THEME_PAGE_SIZE
        return {
            "count": total,
            "page": page,
            "next": page * THEME_PAGE_SIZE < total,
            "previous": page > 1,
            "results": books[start:end],
            "pd_only": True,
            "theme": theme_id,
            "theme_label": meta["label"],
            "theme_description": meta["description"],
            "license_note": (
                "Curated US public-domain theme collection. "
                "Commercial use permitted under Project Gutenberg terms."
            ),
        }

    if author:
        author_id = author.strip()
        meta = _author_meta(author_id)
        books = _fetch_author_books(author_id, search=search)
        total = len(books)
        start = (page - 1) * THEME_PAGE_SIZE
        end = start + THEME_PAGE_SIZE
        return {
            "count": total,
            "page": page,
            "next": page * THEME_PAGE_SIZE < total,
            "previous": page > 1,
            "results": books[start:end],
            "pd_only": True,
            "author": author_id,
            "author_label": meta["label"],
            "author_description": meta["description"],
            "license_note": (
                "Curated US public-domain author collection. "
                "Commercial use permitted under Project Gutenberg terms."
            ),
        }

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
def gutenberg_book_text(
    book_id: int,
    preview_bytes: int | None = Query(None, ge=1024, le=500_000),
):
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
    authors = ", ".join(a.get("name", "") for a in book.get("authors") or [] if a.get("name"))
    title = book.get("title") or "Untitled"
    base = {
        "id": book_id,
        "title": title,
        "authors": authors,
        "source_url": text_url,
        "license": "public_domain_us",
        "license_note": "Project Gutenberg — US public domain. Commercial use permitted.",
    }
    if preview_bytes:
        text, is_partial = _fetch_url_text_prefix(text_url, preview_bytes)
        return {
            **base,
            "text": text,
            "partial": is_partial,
            "preview_bytes": preview_bytes,
        }
    text, resolved_url = _fetch_gutenberg_book_text(book_id, text_url)
    return {
        **base,
        "text": text,
        "partial": False,
        "source_url": resolved_url,
    }


@app.get("/api/gutenberg/html/{book_id}")
def gutenberg_book_html(book_id: int):
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

    formats = book.get("formats") or {}
    html_url = _pick_html_url(formats, book_id)
    try:
        html = _fetch_url_html(html_url)
    except HTTPException as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404, detail="HTML edition not available for this title.") from exc
        raise
    html = _inject_html_base(html, html_url)
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={
            "Cache-Control": "public, max-age=3600",
            "X-Books-Source-Url": html_url,
        },
    )


# --- Books: multi-engine TTS + translation ----------------------------------

GOOGLE_TTS_API_KEY = os.getenv("GOOGLE_TTS_API_KEY", "").strip()
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
FREETTS_API_KEY = os.getenv("FREETTS_API_KEY", "").strip()
FREETTS_API_BASE = os.getenv("FREETTS_API_BASE", "https://freetts.org/api").rstrip("/")

PUBLIC_TTS_ENGINES = ("freetts", "google")

ENGINE_MONTHLY_LIMITS: dict[str, int] = {
    "google": int(os.getenv("GOOGLE_TTS_MONTHLY_LIMIT", "1000000")),
}

ENGINE_REQUEST_LIMITS: dict[str, int] = {
    "google": int(os.getenv("GOOGLE_TTS_MAX_CHARS", "4500")),
}

ENGINE_REQUEST_BYTE_LIMITS: dict[str, int] = {
    "google": int(os.getenv("GOOGLE_TTS_MAX_BYTES", "512")),
}


def _google_chunk_byte_limit() -> int:
    return ENGINE_REQUEST_BYTE_LIMITS.get("google", 1024)

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
            "chunk_max": _freetts_chunk_limit() if engine_id == "freetts" else (
                _google_chunk_byte_limit() if engine_id == "google" else ENGINE_REQUEST_LIMITS.get(engine_id, 4000)
            ),
            "chunk_unit": "bytes" if engine_id == "google" else "chars",
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
    payload = text[:4500]
    try:
        result = text
        for source_lang in ("auto", "en"):
            translated = GoogleTranslator(source=source_lang, target=target).translate(payload)
            candidate = (translated or "").strip()
            if not candidate:
                continue
            result = candidate
            if target != "ko" or _is_mostly_korean(candidate):
                break
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


def _parse_google_tts_http_error(status: int, body: str) -> str:
    message = ""
    try:
        payload = json.loads(body)
        error = payload.get("error") or {}
        message = str(error.get("message") or "")
    except json.JSONDecodeError:
        message = body.strip()

    blocked = "blocked" in message.lower() or "permission_denied" in message.lower()
    if status == 403 and blocked:
        return (
            "Google Cloud TTS가 차단되었습니다 (403). Render 서버용 API 키 설정을 확인하세요: "
            "1) Cloud Text-to-Speech API 활성화, "
            "2) API 키 '애플리케이션 제한' = 없음(서버 호출), "
            "3) API 키 'API 제한'에 Cloud Text-to-Speech API 포함, "
            "4) 결제 계정 연결. "
            "HTTP 리퍼러 제한이 있으면 서버에서 실패합니다."
        )
    if status == 403:
        return (
            "Google Cloud TTS 권한 거부 (403). API 활성화·결제·키 제한 설정을 확인하세요. "
            f"{message}".strip()
        )
    if status == 400:
        return f"Google Cloud TTS 요청 오류: {message or body[:200]}"
    if message:
        return f"Google Cloud TTS 오류 (HTTP {status}): {message}"
    return f"Google Cloud TTS 오류 (HTTP {status})"


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
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "First-Books-TTS/1.0",
    }
    if GOOGLE_CLOUD_PROJECT:
        headers["x-goog-user-project"] = GOOGLE_CLOUD_PROJECT
    req = urllib.request.Request(
        url,
        data=payload,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(
            status_code=exc.code,
            detail=_parse_google_tts_http_error(exc.code, body),
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
    if engine == "google":
        byte_len = len(text.encode("utf-8"))
        max_bytes = _google_chunk_byte_limit()
        if byte_len > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"text exceeds {max_bytes:,} byte UTF-8 limit for {ENGINE_LABELS[engine]} "
                    f"(received {byte_len:,} bytes). Split into 512 byte chunks."
                ),
            )
    elif len(text) > max_chars:
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


@app.get("/api/music/genres")
def music_genres_list():
    return {"genres": music_genres()}


@app.get("/api/music/tracks")
def music_tracks_list(
    genre: str = Query("jazz", pattern="^(jazz|classical|pop|rock|folkhiphop)$"),
    subtheme: str | None = Query(None, max_length=40),
    page: int = Query(1, ge=1, le=500),
    limit: int = Query(10, ge=1, le=20),
    q: str | None = Query(None, max_length=120),
):
    try:
        return fetch_tracks(genre, page=page, limit=limit, q=q, subtheme_id=subtheme)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Music provider error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load tracks: {exc}") from exc


@app.get("/api/music/composer-image")
def music_composer_image(file: str = Query(..., min_length=3, max_length=200)):
    try:
        data, content_type = fetch_composer_image(file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Image provider error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load image: {exc}") from exc
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/api/music/stream/{source}/{track_id}")
def music_stream_proxy(
    source: str,
    track_id: str,
    range: str | None = Header(None, alias="Range"),
):
    try:
        upstream = resolve_stream_url(source.lower(), track_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Stream lookup failed: {exc}") from exc

    try:
        data, status, _total, content_type, content_range, content_length = fetch_stream_bytes(
            upstream, range_header=range
        )
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Stream failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Stream failed: {exc}") from exc

    headers: dict[str, str] = {
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
    }
    if content_length:
        headers["Content-Length"] = content_length
    elif data:
        headers["Content-Length"] = str(len(data))
    if content_range:
        headers["Content-Range"] = content_range

    if range and status == 206:
        return Response(content=data, status_code=206, media_type=content_type, headers=headers)
    return Response(content=data, status_code=200, media_type=content_type, headers=headers)


@app.get("/api/art/genres")
def art_genres():
    return {"genres": art_genres_list()}


@app.get("/api/art/works")
def art_works(
    genre: str = Query(
        "masterpiece",
        pattern="^(masterpiece|history|portrait|landscape|genre|still_life)$",
    ),
):
    try:
        return get_genre_works_response(genre)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Art API error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load artworks: {exc}") from exc


@app.post("/api/art/works/refresh")
def art_works_refresh(
    genre: str = Query(
        ...,
        pattern="^(masterpiece|history|portrait|landscape|genre|still_life)$",
    ),
):
    try:
        return refresh_genre_cache(genre, trigger="manual")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Art API error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to refresh artworks: {exc}") from exc


@app.post("/api/art/cron/refresh-genres")
def art_cron_refresh_genres(authorization: str | None = Header(default=None)):
    _verify_cron(authorization)
    try:
        return refresh_all_genre_caches(trigger="schedule")
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Art API error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to refresh art genres: {exc}") from exc


@app.get("/api/art/work-image")
def art_work_image(
    genre: str = Query(..., pattern="^(masterpiece|history|portrait|landscape|genre|still_life)$"),
    id: str = Query(..., min_length=1, max_length=40),
    kind: str = Query("full", pattern="^(thumb|preview|full)$"),
):
    try:
        data, content_type = load_work_image(genre, id, kind)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load image: {exc}") from exc
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=7200",
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    )


@app.get("/api/art/eras")
def art_eras():
    try:
        return {"eras": fetch_eras_artists()}
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Art API error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load artists: {exc}") from exc


@app.get("/api/art/artist-samples")
def art_artist_samples(name: str = Query(..., min_length=2, max_length=120)):
    try:
        return fetch_artist_samples(name)
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Art API error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load artist samples: {exc}") from exc


@app.get("/api/art/artist-works")
def art_artist_works(name: str = Query(..., min_length=2, max_length=120)):
    try:
        return fetch_artist_works(name)
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Art API error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load artist works: {exc}") from exc


@app.get("/api/art/portrait")
def art_portrait_proxy(
    name: str = Query(..., min_length=2, max_length=120),
    w: int = Query(320, ge=120, le=640),
):
    try:
        data, content_type = fetch_portrait_image(name, width=w)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Portrait provider error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load portrait: {exc}") from exc
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    )


@app.get("/api/art/bgm")
def art_bgm_audio():
    try:
        data, content_type = load_bgm_audio()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load ART BGM: {exc}") from exc
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Cross-Origin-Resource-Policy": "cross-origin",
            "Accept-Ranges": "bytes",
        },
    )


@app.get("/api/art/aic-image")
def art_aic_image(
    iid: str = Query(..., min_length=8, max_length=80),
    size: int = Query(843, ge=200, le=2000),
):
    try:
        data, content_type = fetch_aic_image_bytes(iid, size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"AIC image error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load AIC image: {exc}") from exc
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    )


@app.post("/api/art/cron/warm-portraits")
def art_cron_warm_portraits(authorization: str | None = Header(default=None)):
    _verify_cron(authorization)
    try:
        return warm_all_portraits()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to warm portraits: {exc}") from exc


@app.post("/api/joke/cron/warm-cache")
def joke_cron_warm_cache(
    authorization: str | None = Header(default=None),
    grant_email: str | None = Query(None, min_length=3, max_length=200),
    grant_amount: int | None = Query(None, ge=1, le=1_000_000),
    grant_reason: str = Query("관리자 충전", max_length=200),
):
    _verify_cron(authorization)
    grant_result = None
    if grant_email and grant_amount:
        try:
            from digimon_admin import grant_digimon_by_email

            grant_result = grant_digimon_by_email(grant_email, grant_amount, grant_reason)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to grant Digi-Mon: {exc}") from exc
    try:
        from joke_cache import warm_all_joke_caches

        result = warm_all_joke_caches()
        if grant_result:
            result["digimonGrant"] = grant_result
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to warm Fun caches: {exc}") from exc


@app.get("/api/joke/fortune/zodiac")
def joke_fortune_zodiac():
    try:
        from joke_cache import get_zodiac_response

        return get_zodiac_response()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load zodiac horoscope: {exc}") from exc


@app.post("/api/joke/fortune/personal")
def joke_fortune_personal(body: dict = Body(...)):
    try:
        return fetch_personal_fortune(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"FreeAstroAPI error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load personal fortune: {exc}") from exc


@app.get("/api/joke/weather/search")
def joke_weather_search(q: str = Query("", min_length=0, max_length=80)):
    try:
        return search_weather_places(q)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to search places: {exc}") from exc


@app.get("/api/joke/weather")
def joke_weather_coords(
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
):
    try:
        if (lat is None) ^ (lon is None):
            raise ValueError("Both lat and lon are required together")
        return fetch_weather_at(lat, lon)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load weather: {exc}") from exc


@app.get("/api/joke/{kind}")
def joke_content(
    kind: str,
    count: int = Query(5, ge=1, le=10),
    refresh: bool = Query(False),
):
    try:
        key = (kind or "").strip().lower()
        if key in ("facts", "illusions", "magic"):
            from joke_cache import get_joke_kind_response

            return get_joke_kind_response(key, count=count, refresh=refresh)
        return fetch_joke_kind(kind, count=count)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Fun upstream error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load Fun content: {exc}") from exc


@app.post("/api/space/cron/refresh")
def space_cron_refresh(
    authorization: str | None = Header(default=None),
    force: bool = Query(False),
):
    _verify_cron(authorization)
    try:
        from space_cache import refresh_space_cache

        return refresh_space_cache(trigger="schedule", force=force)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to refresh space cache: {exc}") from exc


@app.get("/api/space/image")
def space_cached_image(
    kind: str = Query(..., pattern="^(apod|planet)$"),
    id: str = Query(..., min_length=1, max_length=140),
):
    try:
        from space_cache import load_space_image

        data, content_type = load_space_image(kind, id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load space image: {exc}") from exc
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=14400",
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    )


@app.get("/api/space/apod")
def space_apod(
    count: int = Query(0, ge=0, le=20),
    date: str = Query("", max_length=10),
    exclude: str = Query("", max_length=400),
    refresh: bool = Query(False),
):
    try:
        if date.strip():
            return fetch_apod_by_date(date.strip())
        exclude_dates = [part.strip() for part in exclude.split(",") if part.strip()] if exclude.strip() else None
        if count > 0:
            from space_cache import get_cached_apod_gallery

            return get_cached_apod_gallery(count=count, exclude_dates=exclude_dates, refresh=refresh)
        return fetch_apod_by_date(None)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"NASA APOD error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load NASA APOD: {exc}") from exc


@app.get("/api/space/planets")
def space_planets_list():
    return list_planets()


@app.get("/api/space/planets/overview")
def space_planets_overview(per_planet: int = Query(1, ge=1, le=3)):
    try:
        from space_cache import get_cached_planets_overview

        return get_cached_planets_overview(per_planet=per_planet)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load planet overview: {exc}") from exc


@app.get("/api/space/planet/{planet_id}")
def space_planet_images(
    planet_id: str,
    limit: int = Query(8, ge=1, le=12),
    skip: int = Query(0, ge=0, le=500),
):
    try:
        from space_cache import get_cached_planet_images

        return get_cached_planet_images(planet_id, limit=limit, skip=skip)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"NASA image search error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load planet images: {exc}") from exc


@app.get("/api/lotto/draw/latest")
def lotto_draw_latest():
    try:
        return fetch_lotto_draw(None)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load lotto draw: {exc}") from exc


@app.get("/api/lotto/draw/{round_no}")
def lotto_draw(round_no: int):
    try:
        return fetch_lotto_draw(round_no)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load lotto draw: {exc}") from exc


@app.post("/api/lotto/check")
def lotto_check(body: dict = Body(...)):
    try:
        round_no = int(body.get("round") or body.get("drwNo") or 0)
        lines = body.get("lines") or body.get("games") or []
        return check_lotto_lines(round_no, lines)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to check lotto: {exc}") from exc


@app.post("/api/lotto/check-qr")
def lotto_check_qr(body: dict = Body(...)):
    try:
        raw = str(body.get("raw") or body.get("qr") or body.get("text") or "").strip()
        if not raw:
            raise ValueError("QR 데이터를 입력해 주세요.")
        return check_lotto_qr(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to check lotto QR: {exc}") from exc


@app.post("/api/lotto/parse-qr")
def lotto_parse_qr(body: dict = Body(...)):
    try:
        raw = str(body.get("raw") or body.get("qr") or "").strip()
        return {"kind": "lotto_qr_parsed", **parse_lotto_qr(raw)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/dino/eras")
def dino_eras():
    return list_eras()


@app.get("/api/dino/dinosaurs")
def dino_list(era: str = Query("cretaceous", max_length=32)):
    try:
        return list_dinosaurs(era)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load dinosaurs: {exc}") from exc


@app.get("/api/dino/image-file/{dino_id}")
def dino_image_file(dino_id: str):
    try:
        data, content_type = read_cached_image(dino_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Image not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=604800",
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    )


@app.get("/api/dino/image/{dino_id}")
def dino_image(dino_id: str, w: int = Query(640, ge=120, le=1280), pick: int | None = Query(None, ge=0, le=5)):
    try:
        data, content_type = fetch_dino_image(dino_id, width=w, pick=pick)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Image not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load dinosaur image: {exc}") from exc
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=604800",
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    )
