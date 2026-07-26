"""Author portrait images for Books — download once from Wikimedia, cache on disk."""

from __future__ import annotations

import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

_AUTHOR_FILE_RE = re.compile(r"^[\w.,()'\- \u00c0-\u017f\u0100-\u024f]+$")
_memory_cache: dict[str, tuple[float, bytes, str]] = {}
_MEMORY_CACHE_TTL = 3600


def author_image_dir() -> Path:
    return Path(__file__).resolve().parent / "data" / "author-images"


def _content_type_for_path(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    return "image/jpeg"


def _disk_cache_path(filename: str) -> Path | None:
    stem = Path(filename).stem
    if not stem:
        return None
    folder = author_image_dir()
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        candidate = folder / f"{stem}{ext}"
        if candidate.is_file():
            return candidate
    return None


def fetch_author_image(filename: str) -> tuple[bytes, str]:
    name = (filename or "").strip()
    if not name or not _AUTHOR_FILE_RE.match(name):
        raise ValueError("Invalid author image filename")

    cached = _memory_cache.get(name)
    if cached and cached[0] > time.time():
        return cached[1], cached[2]

    disk_path = _disk_cache_path(name)
    if disk_path:
        data = disk_path.read_bytes()
        content_type = _content_type_for_path(disk_path)
        _memory_cache[name] = (time.time() + _MEMORY_CACHE_TTL, data, content_type)
        return data, content_type

    url = (
        "https://commons.wikimedia.org/wiki/Special:FilePath/"
        + urllib.parse.quote(name)
        + "?width=320"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "DigitalWorld-Books/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read(800_000)
        content_type = resp.headers.get("Content-Type", "image/jpeg")
    if not data:
        raise ValueError("Empty author image")

    folder = author_image_dir()
    folder.mkdir(parents=True, exist_ok=True)
    ext = ".png" if "png" in content_type.lower() else ".jpg"
    out_path = folder / f"{Path(name).stem}{ext}"
    try:
        out_path.write_bytes(data)
    except OSError:
        pass

    _memory_cache[name] = (time.time() + _MEMORY_CACHE_TTL, data, content_type)
    return data, content_type
