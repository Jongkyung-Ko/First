"""JSON 파일 읽기 — UTF-8·CP949 등 인코딩 폴백."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_READ_ENCODINGS = ("utf-8", "utf-8-sig", "cp949", "euc-kr", "latin-1")


def read_json_file(path: Path | str) -> dict[str, Any] | list[Any] | None:
    """스냅샷 JSON 로드. 인코딩 불일치 시 폴백."""
    p = Path(path)
    if not p.is_file():
        return None
    try:
        raw = p.read_bytes()
    except OSError:
        return None
    if not raw.strip():
        return None

    for encoding in _READ_ENCODINGS:
        try:
            text = raw.decode(encoding)
            data = json.loads(text)
            if isinstance(data, (dict, list)):
                return data
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
    return None


def write_json_file(path: Path | str, payload: Any) -> None:
    """UTF-8로 JSON 저장."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
