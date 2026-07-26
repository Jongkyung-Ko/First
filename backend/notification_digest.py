"""Stock Picks 9-formula digest for push notifications."""

from __future__ import annotations

import json
import os
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from stock_strategy_snapshot import STRATEGY_REGISTRY, load_snapshot as load_strategy_snapshot

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")
US_TZ = ZoneInfo("America/New_York")

KR_MARKET_KEYS = ("kospi", "kosdaq")
US_MARKET_KEYS = ("nasdaq", "nyse")

FORMULA_DEFS: list[dict[str, str]] = [
    {"id": "sentiment", "label": "감성뉴스", "kind": "sentiment"},
    {"id": "bottom-accumulation", "label": "바닥매집", "kind": "recommend2"},
    {"id": "golden-cross", "label": "골든크로스", "kind": "strategy"},
    {"id": "bollinger", "label": "볼린저밴드", "kind": "strategy"},
    {"id": "rsi-divergence", "label": "RSI+다이버전스", "kind": "strategy"},
    {"id": "candle-support", "label": "지지+반전캔들", "kind": "strategy"},
    {"id": "obv-divergence", "label": "OBV+다이버전스", "kind": "strategy"},
    {"id": "bottom-pattern", "label": "쌍·삼중바닥", "kind": "strategy"},
    {"id": "vcp", "label": "VCP", "kind": "strategy"},
]

STRATEGY_JSON_FILES = {
    sid: entry["filename"] for sid, entry in STRATEGY_REGISTRY.items()
}


def _snapshot_base_url() -> str:
    return (
        os.getenv("NOTIFICATION_SNAPSHOT_BASE_URL", "").strip()
        or os.getenv("SITE_PRIMARY_URL", "").strip()
        or "https://jongkyung-ko.github.io/First/"
    ).rstrip("/")


def _fetch_remote_json(relative_path: str) -> dict[str, Any] | None:
    url = f"{_snapshot_base_url()}/{relative_path.lstrip('/')}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DigitalWorld-Notifications/1"})
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read()
        data = json.loads(raw.decode("utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _read_local_json(relative_path: str) -> dict[str, Any] | None:
    from json_io import read_json_file

    path = ROOT / relative_path
    data = read_json_file(path)
    return data if isinstance(data, dict) else None


def _load_json_snapshot(relative_path: str) -> dict[str, Any] | None:
    local = _read_local_json(relative_path)
    if local and not local.get("empty"):
        return local
    remote = _fetch_remote_json(relative_path)
    if remote and not remote.get("empty"):
        return remote
    return local or remote


def _region_timezone(region: str) -> ZoneInfo:
    return KST if region == "kr" else US_TZ


def notification_send_date(region: str, when: datetime | None = None) -> date:
    tz = _region_timezone(region)
    return (when or datetime.now(tz)).date()


def notification_recommend_date(region: str, when: datetime | None = None) -> date:
    """전략 signalDate 필터 — 18:00 스냅샷 기준 전일."""
    return notification_send_date(region, when) - timedelta(days=1)


def notification_sentiment_trade_date(region: str, when: datetime | None = None) -> date:
    """감성뉴스 trade_date — 06:50 record 직후 당일."""
    return notification_send_date(region, when)


def _pick_signal_date(sig: dict[str, Any]) -> str:
    for key in ("signalDate", "day1"):
        val = sig.get(key)
        if val:
            return str(val)[:10]
    return ""


def _signal_matches_recommend_date(sig: dict[str, Any], recommend_date: str) -> bool:
    sig_day = _pick_signal_date(sig)
    return bool(sig_day and sig_day == recommend_date)


def _is_watch_pick(item: dict[str, Any]) -> bool:
    label = str(
        item.get("recommendLabel")
        or item.get("recommend_label")
        or item.get("stanceLabel")
        or ""
    )
    stance = str(item.get("stance") or "")
    if label == "관망" or stance == "watch":
        return True
    recommended = item.get("recommended")
    if recommended is False and label not in ("추천", "주의"):
        return True
    return False


def _sentiment_picks_for_region(region: str, recommend_date: str) -> list[dict[str, Any]]:
    from predictions import MARKET_GROUPS, _supabase_client

    client = _supabase_client()
    if client is None:
        return []

    market_ids = MARKET_GROUPS.get(region, [])
    picks: list[dict[str, Any]] = []
    seen: set[str] = set()

    for market_id in market_ids:
        try:
            response = (
                client.table("stock_pick_predictions")
                .select("ticker,name,recommend_label,stance,market")
                .eq("trade_date", recommend_date)
                .eq("market", market_id)
                .execute()
            )
        except Exception:
            continue
        for item in response.data or []:
            if _is_watch_pick(item):
                continue
            label = str(item.get("recommend_label") or "")
            stance = str(item.get("stance") or "")
            if label not in ("추천", "주의") and stance not in ("recommend", "caution"):
                continue
            ticker = str(item.get("ticker") or "")
            if not ticker or ticker in seen:
                continue
            seen.add(ticker)
            segment = (
                "kospi"
                if market_id == "kr_kospi"
                else "kosdaq"
                if market_id == "kr_kosdaq"
                else "us"
            )
            picks.append(
                {
                    "ticker": ticker,
                    "name": item.get("name") or ticker,
                    "exchange": segment,
                    "label": label or "추천",
                    "signalDate": recommend_date,
                }
            )
    return picks


def _signal_row(sig: dict[str, Any], exchange: str) -> dict[str, Any]:
    sig_day = _pick_signal_date(sig)
    return {
        "ticker": sig.get("ticker") or "",
        "name": sig.get("name") or sig.get("ticker") or "",
        "exchange": sig.get("exchange") or exchange,
        "label": sig.get("patternLabel") or sig.get("pattern") or "신호",
        "signalDate": sig_day or None,
    }


def _active_signals_from_payload(
    payload: dict[str, Any] | None,
    market_keys: tuple[str, ...],
    *,
    recommend_date: str,
) -> list[dict[str, Any]]:
    if not payload:
        return []

    out: list[dict[str, Any]] = []
    seen: set[str] = set()

    region_key = "kr" if market_keys == KR_MARKET_KEYS else "us"
    by_region = (payload.get("activeByRegion") or {}).get(region_key) or {}
    for sig in by_region.get("signals") or []:
        if not _signal_matches_recommend_date(sig, recommend_date):
            continue
        key = f"{sig.get('ticker')}|{_pick_signal_date(sig)}"
        if key in seen:
            continue
        seen.add(key)
        out.append(_signal_row(sig, sig.get("exchange") or region_key.upper()))

    markets = payload.get("markets") or {}
    for mkey in market_keys:
        block = markets.get(mkey) or {}
        exchange = block.get("title") or mkey.upper()
        for sig in block.get("activeSignals") or []:
            if not _signal_matches_recommend_date(sig, recommend_date):
                continue
            key = f"{sig.get('ticker')}|{_pick_signal_date(sig)}"
            if key in seen:
                continue
            seen.add(key)
            out.append(_signal_row(sig, exchange))

    return out


def _recommend2_picks(region: str, recommend_date: str) -> list[dict[str, Any]]:
    from recommend2_snapshot import load_snapshot

    payload = load_snapshot()
    if not payload:
        payload = _load_json_snapshot("data/recommend2-bottom-accumulation.json")
    keys = KR_MARKET_KEYS if region == "kr" else US_MARKET_KEYS
    return _active_signals_from_payload(payload, keys, recommend_date=recommend_date)


def _strategy_picks(strategy_id: str, region: str, recommend_date: str) -> list[dict[str, Any]]:
    payload = load_strategy_snapshot(strategy_id, use_memory=True)
    if not payload or payload.get("empty"):
        rel = f"data/{STRATEGY_JSON_FILES.get(strategy_id, '')}"
        if rel.endswith(".json"):
            payload = _load_json_snapshot(rel)
    keys = KR_MARKET_KEYS if region == "kr" else US_MARKET_KEYS
    return _active_signals_from_payload(payload, keys, recommend_date=recommend_date)


def build_region_digest(region: str) -> dict[str, Any]:
    region = region.strip().lower()
    if region not in ("kr", "us"):
        raise ValueError("region must be kr or us")

    send_date = notification_send_date(region)
    recommend_day = notification_recommend_date(region)
    recommend_date = recommend_day.isoformat()
    sentiment_trade_date = notification_sentiment_trade_date(region).isoformat()

    formulas: list[dict[str, Any]] = []
    for fdef in FORMULA_DEFS:
        kind = fdef["kind"]
        if kind == "sentiment":
            picks = _sentiment_picks_for_region(region, sentiment_trade_date)
        elif kind == "recommend2":
            picks = _recommend2_picks(region, recommend_date)
        else:
            picks = _strategy_picks(fdef["id"], region, recommend_date)
        formulas.append(
            {
                "id": fdef["id"],
                "label": fdef["label"],
                "picks": picks,
            }
        )

    return {
        "region": region,
        "sendDate": send_date.isoformat(),
        "recommendDate": recommend_date,
        "sentimentTradeDate": sentiment_trade_date,
        "tradeDate": recommend_date,
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "formulaCount": len(formulas),
        "formulas": formulas,
    }


def _format_pick_line(picks: list[dict[str, Any]], max_show: int = 4) -> str:
    if not picks:
        return "—"
    shown = picks[:max_show]
    parts = [f"{p.get('name') or p.get('ticker')}" for p in shown if p.get("name") or p.get("ticker")]
    if not parts:
        return "—"
    text = ", ".join(parts)
    extra = len(picks) - len(shown)
    if extra > 0:
        text += f" 외 {extra}건"
    return text


def digest_to_notification_payload(digest: dict[str, Any], *, site_base: str | None = None) -> dict[str, Any]:
    region = digest.get("region") or "kr"
    region_label = "한국장" if region == "kr" else "미국장"
    lines = []
    for block in digest.get("formulas") or []:
        label = block.get("label") or block.get("id") or "공식"
        lines.append(f"■ {label}: {_format_pick_line(block.get('picks') or [])}")

    body = "\n".join(lines)
    if len(body) > 3200:
        body = body[:3190] + "…"

    base = (site_base or _snapshot_base_url()).rstrip("/") + "/"
    url = f"{base}?page=stock-picks-formulas"

    return {
        "title": f"[Digital World] {region_label} 추천 (9공식)",
        "body": body,
        "url": url,
        "tag": f"stock-digest-{region}-{digest.get('tradeDate')}",
        "region": region,
        "digest": digest,
    }
