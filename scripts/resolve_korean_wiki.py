#!/usr/bin/env python3
"""Resolve Korean painting entries to real Wikimedia Commons files."""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from korean_art_curated import KOREAN_PAINTING_ENTRIES  # noqa: E402

UA = "DigitalWorld-Verify/1.0 (https://github.com/Jongkyung-Ko/First)"


def api(params: dict) -> dict:
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
        {**params, "format": "json"}
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def resolve_file(fname: str, width: int = 960) -> str | None:
    title = fname if fname.startswith("File:") else f"File:{fname}"
    data = api(
        {
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|thumburl",
            "iiurlwidth": str(width),
        }
    )
    for page in data.get("query", {}).get("pages", {}).values():
        if page.get("missing"):
            return None
        info = (page.get("imageinfo") or [{}])[0]
        return info.get("thumburl") or info.get("url")
    return None


def search(q: str, limit: int = 8) -> list[str]:
    data = api(
        {
            "action": "query",
            "list": "search",
            "srsearch": q,
            "srlimit": limit,
            "srnamespace": 6,
        }
    )
    return [x["title"].replace("File:", "") for x in data["query"]["search"]]


def is_image_file(name: str) -> bool:
    lower = name.lower()
    if any(x in lower for x in (".djvu", ".pdf", ".svg")):
        return False
    return lower.endswith((".jpg", ".jpeg", ".png", ".webp"))


MANUAL: dict[str, list[str]] = {
    "몽유도원도": ["Ahn Gyeon-Mongyu dowondo.jpg"],
    "주초충도": ["Chochungdo 01.jpg", "Shin Saimdang Chochungdo"],
    "인왕제색도": ["Inwangjesaekdo.jpg"],
    "죽하맹호도": ["죽하맹호도.jpg"],
    "소림추적도": ["소림추적도.jpg", "So-rim chasing a tiger Kim Hong-do"],
    "세객체축": ["Byeon Sangbyeok-Myojakdo.jpg", "Korean art-Byeon Sangbyeok-Mother Hen and Chicks.jpg"],
    "미인도": ["Miindo (Standing Beauty).jpg"],
    "향기놀이": ["Hyewon-Cheonggeum.sangryeon.jpg", "Hyewon incense"],
    "단오풍경": ["Hyewon-Dano.pungjeong.jpg"],
    "채죽도": ["Hyewon bamboo painting", "Hyewon bamboo Joseon"],
    "산수도": ["Joseon-Kang Huian-Gosagwansudo.jpg"],
    "청자와 화병": ["Byeon Sangbyeok celadon", "Joseon celadon painting"],
    "해바라기": ["Owon-Ssangma.inmuldo-detail.jpg", "Jang Seung-eop sunflower"],
    "연잎": ["Lotus and frog Joseon", "Yi Am lotus"],
    "산속의 말": ["나들이.jpg", "Kim Hong-do horse"],
    "대합": ["Kim Hong-do crab", "crab Joseon Kim Hong-do"],
    "금강산도": ["Jeong Seon Geumgangsan", "Geumgangsan painting Jeong Seon"],
    "해거름": ["Jeong Seon sunset painting", "Jeong Seon landscape"],
    "속어": ["Joseon carp painting", "fish painting Joseon"],
    "매화도": ["Chusa-Buliseonrando-01.jpg", "Kim Jeong-hui plum"],
    "십장생도": ["Ten longevity symbols Korean folk", "Sipjangsaengdo"],
    "호랑이": ["Korea-Minhwa-Magpie and tiger.jpg"],
    "화조도": ["Korean folk flower bird painting", "minhwa flower bird"],
    "황소": ["White Ox (1954) - Lee Jung Seob.jpg"],
    "까치": ["Park Soo-keun magpie", "Park Soo Keun bird painting"],
    "고향": ["Park Soo-keun village", "Park Soo Keun hometown"],
    "등": ["Kim Whanki untitled 1.jpg", "Kim Whanki Where and When"],
    "거북": ["Kim Whanki turtle", "Kim Whanki painting"],
    "우국": ["Lee Sang Obstacle", "Lee Sang painting"],
    "TV밀": ["TV Cello (1966).jpg", "Nam June Paik TV Buddha"],
    "산수 (유영국)": ["Yoo Youngkuk mountain", "Yoo Young-kuk abstract"],
    "화조 (천경자)": ["Cheon Kyung-ja flower", "Cheon Kyungja painting"],
    "산수 (서양)": ["Seo Yang landscape Korean"],
    "연꽃 (허백련)": ["Heo Baek-ryeon lotus", "Heo Baekryeon painting"],
    "산수 (김기창)": ["Kim Ki-chang mountain landscape"],
    "무인": ["Lee Ufan From Point", "Lee Ufan point painting"],
    "우산을 쓴 여인": ["Park Ree umbrella woman", "Korean woman umbrella painting"],
    "정글 (김환기)": ["Kim Whanki birds", "Kim Whanki abstract birds"],
    "소": ["Lee Jung Seob ox painting", "Lee Joong-seop ox"],
    "가족": ["Park Soo-keun family painting", "Park Soo Keun family"],
}


def pick(title: str, artist: str) -> tuple[str, str] | None:
    queries = MANUAL.get(title, [title, artist])
    for q in queries:
        if q.lower().endswith((".jpg", ".jpeg", ".png")):
            url = resolve_file(q)
            if url:
                return q, url
        for cand in search(q, 8):
            if not is_image_file(cand):
                continue
            url = resolve_file(cand)
            if url:
                return cand, url
        time.sleep(0.12)
    return None


def main() -> None:
    out: dict[str, dict[str, str]] = {}
    for title, artist, date, desc, _ in KOREAN_PAINTING_ENTRIES:
        hit = pick(title, artist)
        out[title] = {
            "artist": artist,
            "file": hit[0] if hit else "",
            "url": hit[1] if hit else "",
        }
        label = hit[0][:60] if hit else "MISSING"
        print(f"{title}: {label}")

    missing = [t for t, v in out.items() if not v["url"]]
    print(f"\nresolved={len(out)-len(missing)}/{len(out)} missing={len(missing)}")
    if missing:
        print("missing:", missing)

    path = Path(__file__).with_name("korean_wiki_resolved.json")
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", path)


if __name__ == "__main__":
    main()
