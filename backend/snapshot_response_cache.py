"""In-memory TTL cache for enriched GET responses (recommend2 + stock strategies)."""

from __future__ import annotations

import time
from copy import deepcopy
from typing import Any

TTL_SECONDS = 600

_entries: dict[str, dict[str, Any]] = {}


def get_cached(key: str) -> dict[str, Any] | None:
    entry = _entries.get(key)
    if not entry:
        return None
    if time.monotonic() - float(entry.get("mono") or 0) >= TTL_SECONDS:
        _entries.pop(key, None)
        return None
    payload = entry.get("payload")
    if not isinstance(payload, dict):
        return None
    return deepcopy(payload)


def set_cached(key: str, payload: dict[str, Any]) -> None:
    _entries[key] = {
        "mono": time.monotonic(),
        "payload": deepcopy(payload),
    }


def invalidate(key: str) -> None:
    _entries.pop(key, None)


def invalidate_prefix(prefix: str) -> None:
    for k in list(_entries.keys()):
        if k.startswith(prefix):
            _entries.pop(k, None)
