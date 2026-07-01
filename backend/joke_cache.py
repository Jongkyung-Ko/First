"""Disk cache for Fun (JOKE) page — daily + TTL content."""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from joke_service import (
    _korea_today_iso,
    fetch_illusions,
    fetch_useless_facts,
    fetch_zodiac_horoscopes,
)

KST = timezone(timedelta(hours=9))
DAILY_KINDS = frozenset({"illusions", "fortune_zodiac"})
TTL_SECONDS: dict[str, int] = {
    "facts": 3 * 3600,
}


def cache_root() -> Path:
    custom = os.getenv("JOKE_CACHE_DIR", "").strip()
    if custom:
        return Path(custom)
    return Path(__file__).resolve().parent / "data" / "joke-cache"


def _cache_file(kind: str, count: int = 3) -> Path:
    safe = kind.replace("/", "_").replace("..", "")
    return cache_root() / f"{safe}_n{count}.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_joke_cache(kind: str, count: int = 3) -> dict[str, Any] | None:
    path = _cache_file(kind, count)
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) and data.get("payload") else None
    except (OSError, json.JSONDecodeError):
        return None


def write_joke_cache(kind: str, count: int, payload: dict[str, Any]) -> dict[str, Any]:
    path = _cache_file(kind, count)
    path.parent.mkdir(parents=True, exist_ok=True)
    envelope: dict[str, Any] = {
        "kind": kind,
        "count": count,
        "updated_at": _now_iso(),
        "date_kst": _korea_today_iso(),
        "payload": payload,
    }
    path.write_text(json.dumps(envelope, ensure_ascii=False, indent=0), encoding="utf-8")
    return envelope


def is_joke_cache_stale(entry: dict[str, Any] | None, kind: str) -> bool:
    if not entry or not entry.get("payload"):
        return True
    if kind in DAILY_KINDS:
        return str(entry.get("date_kst") or "") != _korea_today_iso()
    ttl = TTL_SECONDS.get(kind, 3 * 3600)
    updated_at = entry.get("updated_at") or ""
    try:
        base = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        if base.tzinfo is None:
            base = base.replace(tzinfo=timezone.utc)
    except ValueError:
        return True
    return (datetime.now(timezone.utc) - base).total_seconds() >= ttl


def _fetch_fresh(kind: str, count: int = 5, *, refresh: bool = False) -> dict[str, Any]:
    if kind == "facts":
        return fetch_useless_facts(count=count)
    if kind == "illusions":
        return fetch_illusions(count=count, refresh=refresh)
    if kind == "fortune_zodiac":
        return fetch_zodiac_horoscopes()
    raise ValueError(f"Unknown joke cache kind: {kind}")


def get_joke_kind_response(kind: str, count: int = 5, *, refresh: bool = False) -> dict[str, Any]:
    key = (kind or "").strip().lower()
    if key not in ("facts", "illusions"):
        raise ValueError(f"Unsupported cached kind: {kind}")
    if refresh:
        return _fetch_fresh(key, count, refresh=True)
    cached = read_joke_cache(key, count)
    if cached and not is_joke_cache_stale(cached, key):
        return cached["payload"]
    payload = _fetch_fresh(key, count, refresh=False)
    write_joke_cache(key, count, payload)
    return payload


def get_zodiac_response() -> dict[str, Any]:
    kind = "fortune_zodiac"
    cached = read_joke_cache(kind, 1)
    if cached and not is_joke_cache_stale(cached, kind):
        return cached["payload"]
    payload = fetch_zodiac_horoscopes()
    write_joke_cache(kind, 1, payload)
    return payload


def refresh_joke_cache(kind: str, count: int = 5) -> dict[str, Any]:
    payload = _fetch_fresh(kind, count, refresh=True)
    envelope = write_joke_cache(kind, count, payload)
    return {
        "kind": kind,
        "count": count,
        "updated_at": envelope["updated_at"],
        "date_kst": envelope["date_kst"],
        "item_count": payload.get("count") or len(payload.get("items") or []),
    }


def warm_all_joke_caches(*, force: bool = False) -> dict[str, Any]:
    started = time.time()
    results: dict[str, Any] = {}
    specs = (("facts", 5), ("illusions", 5), ("fortune_zodiac", 1))
    for kind, count in specs:
        try:
            if not force:
                cached = read_joke_cache(kind, count)
                if cached and not is_joke_cache_stale(cached, kind):
                    results[kind] = {
                        "skipped": True,
                        "updated_at": cached.get("updated_at"),
                        "date_kst": cached.get("date_kst"),
                    }
                    continue
            results[kind] = refresh_joke_cache(kind, count)
        except Exception as exc:
            results[kind] = {"error": str(exc)}
    return {
        "ok": not any(isinstance(v, dict) and v.get("error") for v in results.values()),
        "results": results,
        "elapsed_sec": round(time.time() - started, 2),
        "updated_at": _now_iso(),
    }
