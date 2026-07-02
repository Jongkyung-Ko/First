"""Stock Picks 9-formula digest for push notifications."""

from __future__ import annotations

import json
import os
import urllib.request
from datetime import datetime, timezone
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


def _is_watch_pick(item: dict[str, Any]) -> bool:
    label = str(item.get("recommendLabel") or item.get("stanceLabel") or "")
    stance = str(item.get("stance") or "")
    if label == "관망" or stance == "watch":
        return True
    if item.get("recommended") is False and label not in ("추천", "주의"):
        return True
    return False


def _sentiment_picks_for_region(region: str) -> list[dict[str, Any]]:
    from main import collect_recommendations

    market_ids = ("kr_kospi", "kr_kosdaq") if region == "kr" else ("us",)
    picks: list[dict[str, Any]] = []
    seen: set[str] = set()

    for market_id in market_ids:
        try:
            payload = collect_recommendations(market_id, limit=10, lang="ko")
        except Exception:
            continue
        for item in payload.get("items") or []:
            if _is_watch_pick(item):
                continue
            ticker = str(item.get("ticker") or "")
            if not ticker or ticker in seen:
                continue
            seen.add(ticker)
            picks.append(
                {
                    "ticker": ticker,
                    "name": item.get("name") or ticker,
                    "exchange": item.get("segment") or market_id,
                    "label": item.get("recommendLabel") or "추천",
                }
            )
    return picks


def _signal_row(sig: dict[str, Any], exchange: str) -> dict[str, Any]:
    return {
        "ticker": sig.get("ticker") or "",
        "name": sig.get("name") or sig.get("ticker") or "",
        "exchange": sig.get("exchange") or exchange,
        "label": sig.get("patternLabel") or sig.get("pattern") or "신호",
    }


def _active_signals_from_payload(payload: dict[str, Any] | None, market_keys: tuple[str, ...]) -> list[dict[str, Any]]:
    if not payload:
        return []

    out: list[dict[str, Any]] = []
    seen: set[str] = set()

    region_key = "kr" if market_keys == KR_MARKET_KEYS else "us"
    by_region = (payload.get("activeByRegion") or {}).get(region_key) or {}
    for sig in by_region.get("signals") or []:
        key = f"{sig.get('ticker')}|{sig.get('signalDate')}"
        if key in seen:
            continue
        seen.add(key)
        out.append(_signal_row(sig, sig.get("exchange") or region_key.upper()))

    markets = payload.get("markets") or {}
    for mkey in market_keys:
        block = markets.get(mkey) or {}
        exchange = block.get("title") or mkey.upper()
        for sig in block.get("activeSignals") or []:
            key = f"{sig.get('ticker')}|{sig.get('signalDate')}"
            if key in seen:
                continue
            seen.add(key)
            out.append(_signal_row(sig, exchange))

    return out


def _recommend2_picks(region: str) -> list[dict[str, Any]]:
    from recommend2_snapshot import load_snapshot

    payload = load_snapshot()
    if not payload:
        payload = _load_json_snapshot("data/recommend2-bottom-accumulation.json")
    keys = KR_MARKET_KEYS if region == "kr" else US_MARKET_KEYS
    return _active_signals_from_payload(payload, keys)


def _strategy_picks(strategy_id: str, region: str) -> list[dict[str, Any]]:
    payload = load_strategy_snapshot(strategy_id, use_memory=True)
    if not payload or payload.get("empty"):
        rel = f"data/{STRATEGY_JSON_FILES.get(strategy_id, '')}"
        if rel.endswith(".json"):
            payload = _load_json_snapshot(rel)
    keys = KR_MARKET_KEYS if region == "kr" else US_MARKET_KEYS
    return _active_signals_from_payload(payload, keys)


def build_region_digest(region: str) -> dict[str, Any]:
    region = region.strip().lower()
    if region not in ("kr", "us"):
        raise ValueError("region must be kr or us")

    formulas: list[dict[str, Any]] = []
    for fdef in FORMULA_DEFS:
        kind = fdef["kind"]
        if kind == "sentiment":
            picks = _sentiment_picks_for_region(region)
        elif kind == "recommend2":
            picks = _recommend2_picks(region)
        else:
            picks = _strategy_picks(fdef["id"], region)
        formulas.append(
            {
                "id": fdef["id"],
                "label": fdef["label"],
                "picks": picks,
            }
        )

    now_kst = datetime.now(KST)
    now_us = datetime.now(US_TZ)
    trade_date = now_kst.date().isoformat() if region == "kr" else now_us.date().isoformat()

    return {
        "region": region,
        "tradeDate": trade_date,
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
