"""공유마당 만료저작물(텍스트) Open API — Poem page proxy."""

from __future__ import annotations

import os
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from typing import Any

POEM_UA = "DigitalWorld-Poem/1.0 (educational; github.com/Jongkyung-Ko/First)"
GONGU_BASE = "http://openapi.copyright.or.kr/openapi/service/rest/ShrWrtgService"
LIST_PATH = "getTxtExpWrtgList"
DETAIL_PATH = "getTxtExpWrtgDetail"
CACHE_TTL_LIST = 86400
CACHE_TTL_DETAIL = 604800

_CACHE: dict[str, tuple[float, Any]] = {}


def _api_key() -> str:
    key = (
        os.environ.get("GONGU_SERVICE_KEY")
        or os.environ.get("GONGU_API_KEY")
        or os.environ.get("DATA_GO_KR_SERVICE_KEY")
        or ""
    ).strip()
    if not key:
        raise ValueError(
            "GONGU_SERVICE_KEY 환경변수가 설정되지 않았습니다. "
            "공공데이터포털 공유(만료)저작물 API 키를 Render에 등록해 주세요."
        )
    return key


def _cache_get(key: str, ttl: int) -> Any | None:
    row = _CACHE.get(key)
    if row and time.time() - row[0] < ttl:
        return row[1]
    return None


def _cache_set(key: str, value: Any) -> None:
    _CACHE[key] = (time.time(), value)


def _local_tag(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _child_text(item: ET.Element, *names: str) -> str:
    wanted = {n.lower() for n in names}
    for child in item:
        if _local_tag(child.tag).lower() in wanted:
            text = (child.text or "").strip()
            if text:
                return unescape(text)
    return ""


def _header_code(root: ET.Element) -> tuple[str, str]:
    code = ""
    msg = ""
    for elem in root.iter():
        tag = _local_tag(elem.tag).lower()
        if tag == "resultcode" and elem.text:
            code = elem.text.strip()
        elif tag == "resultmsg" and elem.text:
            msg = elem.text.strip()
    return code, msg


def _fetch_xml(path: str, params: dict[str, str | int]) -> ET.Element:
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = f"{GONGU_BASE}/{path}?{query}"
    req = urllib.request.Request(url, headers={"User-Agent": POEM_UA, "Accept": "application/xml"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        raw = resp.read()
    root = ET.fromstring(raw)
    code, msg = _header_code(root)
    if code and code not in ("00", "0", "0000"):
        if code in ("03", "3"):
            return root
        raise ValueError(msg or f"공유마당 API 오류 (code={code})")
    return root


def _parse_list_item(item: ET.Element) -> dict[str, Any]:
    work_id = _child_text(
        item,
        "expWrtgId",
        "wrtgId",
        "mgmtNo",
        "shrWrtgId",
        "wrtgMgmtNo",
    )
    title = _child_text(item, "wrtgNm", "wrtgTitle", "title", "ttl")
    author = _child_text(item, "wrtrNm", "autNm", "author", "writer")
    year = _child_text(item, "crtYear", "makDt", "pubYear", "wrtgYear", "pubDt")
    genre = _child_text(item, "wrtgClNm", "wrtgType", "wrtgForm")
    return {
        "id": work_id or f"{author}-{title}",
        "title": title or "(제목 없음)",
        "author": author,
        "year": year,
        "genre": genre,
        "source": "공유마당 만료저작물",
        "license": "만료저작물",
    }


def _items_from_root(root: ET.Element) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for elem in root.iter():
        if _local_tag(elem.tag).lower() == "item":
            parsed = _parse_list_item(elem)
            if parsed.get("title"):
                items.append(parsed)
    return items


def _total_count(root: ET.Element) -> int:
    for elem in root.iter():
        if _local_tag(elem.tag).lower() == "totalcount" and elem.text:
            try:
                return int(elem.text.strip())
            except ValueError:
                return len(_items_from_root(root))
    return len(_items_from_root(root))


def _strip_html(text: str) -> str:
    clean = re.sub(r"<[^>]+>", "\n", text or "")
    clean = unescape(clean)
    clean = re.sub(r"\r\n?", "\n", clean)
    clean = re.sub(r"\n{3,}", "\n\n", clean)
    return clean.strip()


def _fetch_text_url(url: str) -> str:
    if not url or not url.startswith("http"):
        return ""
    req = urllib.request.Request(url, headers={"User-Agent": POEM_UA})
    with urllib.request.urlopen(req, timeout=45) as resp:
        raw = resp.read(2_000_000)
    charset = "utf-8"
    ct = resp.headers.get("Content-Type", "")
    m = re.search(r"charset=([\w-]+)", ct, re.I)
    if m:
        charset = m.group(1)
    try:
        text = raw.decode(charset, errors="replace")
    except LookupError:
        text = raw.decode("utf-8", errors="replace")
    if "<" in text[:200] and ">" in text[:500]:
        return _strip_html(text)
    return text.strip()


def _parse_detail(root: ET.Element) -> dict[str, Any]:
    item = None
    for elem in root.iter():
        if _local_tag(elem.tag).lower() == "item":
            item = elem
            break
    if item is None:
        raise ValueError("저작물 상세 정보를 찾을 수 없습니다.")

    base = _parse_list_item(item)
    body = _child_text(
        item,
        "wrtgCtn",
        "wrtgCn",
        "cn",
        "content",
        "wrtgCont",
        "wrtgBody",
        "mainText",
    )
    file_url = _child_text(
        item,
        "filePath",
        "fileUrl",
        "downloadUrl",
        "wrtgFileUrl",
        "orgnlFileUrl",
        "orgFileUrl",
    )
    page_url = _child_text(item, "pageUrl", "linkUrl", "wrtgUrl", "url")

    if not body and file_url:
        try:
            body = _fetch_text_url(file_url)
        except Exception:
            body = ""

    if body:
        body = _strip_html(body)

    base["body"] = body
    base["fileUrl"] = file_url
    base["pageUrl"] = page_url
    base["attribution"] = "출처: 공유마당(한국저작권위원회) 만료저작물"
    return base


def list_text_works(
    *,
    author: str | None = None,
    title: str | None = None,
    page: int = 1,
    rows: int = 100,
) -> dict[str, Any]:
    author_q = (author or "").strip()
    title_q = (title or "").strip()
    if not author_q and not title_q:
        raise ValueError("저작자명 또는 제목 검색어가 필요합니다.")

    cache_key = f"list:{author_q}:{title_q}:{page}:{rows}"
    cached = _cache_get(cache_key, CACHE_TTL_LIST)
    if cached is not None:
        return cached

    params: dict[str, str | int] = {
        "serviceKey": _api_key(),
        "pageNo": max(1, page),
        "numOfRows": min(max(1, rows), 100),
    }
    if author_q:
        params["wrtrNm"] = author_q
    if title_q:
        params["wrtgNm"] = title_q

    root = _fetch_xml(LIST_PATH, params)
    works = _items_from_root(root)
    total = _total_count(root)
    payload = {
        "count": total,
        "page": page,
        "rows": rows,
        "author": author_q,
        "title_query": title_q,
        "results": works,
        "attribution": "출처: 공유마당(한국저작권위원회) 만료저작물",
    }
    _cache_set(cache_key, payload)
    return payload


def get_text_work_detail(work_id: str) -> dict[str, Any]:
    wid = (work_id or "").strip()
    if not wid:
        raise ValueError("저작물 ID가 필요합니다.")

    cache_key = f"detail:{wid}"
    cached = _cache_get(cache_key, CACHE_TTL_DETAIL)
    if cached is not None:
        return cached

    params: dict[str, str | int] = {
        "serviceKey": _api_key(),
    }
    for key in ("expWrtgId", "wrtgId", "mgmtNo"):
        try:
            root = _fetch_xml(DETAIL_PATH, {**params, key: wid})
            detail = _parse_detail(root)
            if detail.get("body") or detail.get("title"):
                _cache_set(cache_key, detail)
                return detail
        except ValueError:
            continue

    raise ValueError("저작물 본문을 불러오지 못했습니다.")
