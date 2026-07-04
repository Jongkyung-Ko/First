"""Open DART (금융감독원 전자공시) — 한국 종목 EPS/PER · BPS/PBR 보강."""

from __future__ import annotations

import io
import json
import os
import re
import threading
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from typing import Any

DART_UA = "DigitalWorld-Fundamentals/1.0 (github.com/Jongkyung-Ko/First)"
DART_BASE = "https://opendart.fss.or.kr/api"
CORP_CACHE_TTL_SEC = 86400
PER_SHARE_CACHE_TTL_SEC = 43200
ANNUAL_REPORT_CODE = "11011"

_corp_lock = threading.Lock()
_corp_map: dict[str, str] | None = None
_corp_loaded_at: float = 0.0
_per_share_cache: dict[str, tuple[float, dict[str, float | None] | None]] = {}
_per_share_lock = threading.Lock()

_EPS_ACCOUNT_NAMES = (
    "기본주당순이익",
    "주당순이익",
    "기본주당이익(손실)",
    "기본주당이익",
)

_BPS_ACCOUNT_NAMES = (
    "주당순자산",
    "기본주당순자산",
    "주당순자산(손실)",
    "기본주당순자산(손실)",
)


def dart_api_key() -> str:
    return (
        os.environ.get("OPEN_DART_API_KEY")
        or os.environ.get("OPENDART_API_KEY")
        or ""
    ).strip()


def dart_configured() -> bool:
    return bool(dart_api_key())


def is_kr_ticker(ticker: str) -> bool:
    upper = ticker.upper()
    return upper.endswith(".KS") or upper.endswith(".KQ")


def stock_code_from_ticker(ticker: str) -> str | None:
    base = ticker.split(".", 1)[0].strip()
    if len(base) == 6 and base.isdigit():
        return base
    return None


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        f = float(value)
        if f != f:
            return None
        return f
    except (TypeError, ValueError):
        return None


def _parse_dart_amount(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in ("-", "—"):
        return None
    text = text.replace(",", "")
    if text.startswith("(") and text.endswith(")"):
        text = f"-{text[1:-1]}"
    return _safe_float(text)


def _fetch_bytes(url: str, *, timeout: int = 45) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": DART_UA}, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _dart_json(endpoint: str, params: dict[str, str]) -> dict[str, Any]:
    key = dart_api_key()
    if not key:
        return {"status": "901", "message": "OPEN_DART_API_KEY not set"}
    query = {"crtfc_key": key, **params}
    url = f"{DART_BASE}/{endpoint}?{urllib.parse.urlencode(query)}"
    try:
        payload = json.loads(_fetch_bytes(url).decode("utf-8"))
    except Exception as exc:
        return {"status": "999", "message": str(exc)}
    if not isinstance(payload, dict):
        return {"status": "999", "message": "invalid json"}
    return payload


def _load_corp_map(*, force: bool = False) -> dict[str, str]:
    global _corp_map, _corp_loaded_at

    if not dart_configured():
        return {}

    now = time.time()
    if not force and _corp_map is not None and now - _corp_loaded_at < CORP_CACHE_TTL_SEC:
        return _corp_map

    with _corp_lock:
        now = time.time()
        if not force and _corp_map is not None and now - _corp_loaded_at < CORP_CACHE_TTL_SEC:
            return _corp_map

        key = dart_api_key()
        url = f"{DART_BASE}/corpCode.xml?{urllib.parse.urlencode({'crtfc_key': key})}"
        mapping: dict[str, str] = {}
        try:
            raw = _fetch_bytes(url)
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                xml_name = next((n for n in zf.namelist() if n.lower().endswith(".xml")), None)
                if not xml_name:
                    raise ValueError("corpCode zip has no xml")
                root = ET.fromstring(zf.read(xml_name))
            for item in root.findall("list"):
                corp_code = (item.findtext("corp_code") or "").strip()
                stock_code = (item.findtext("stock_code") or "").strip()
                if not corp_code or not stock_code or not re.fullmatch(r"\d{6}", stock_code):
                    continue
                mapping[stock_code] = corp_code
        except Exception:
            if _corp_map is not None:
                return _corp_map
            return {}

        _corp_map = mapping
        _corp_loaded_at = time.time()
        return mapping


def _corp_code_for_stock(stock_code: str) -> str | None:
    return _load_corp_map().get(stock_code)


def _pick_amount_from_accounts(
    items: list[dict[str, Any]],
    account_names: tuple[str, ...],
    *,
    exclude_diluted: bool = True,
    require_positive: bool = True,
) -> float | None:
    candidates: list[tuple[int, float]] = []
    for row in items:
        if not isinstance(row, dict):
            continue
        name = str(row.get("account_nm") or "").strip()
        if not name:
            continue
        if not any(token in name for token in account_names):
            continue
        if exclude_diluted and "희석" in name:
            continue
        amount = _parse_dart_amount(row.get("thstrm_amount"))
        if amount is None:
            continue
        if require_positive and amount <= 0:
            continue
        fs_div = str(row.get("fs_div") or "")
        priority = 2 if fs_div == "CFS" else 1 if fs_div == "OFS" else 0
        candidates.append((priority, amount))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def _fetch_annual_account_items(corp_code: str) -> list[dict[str, Any]] | None:
    """사업보고서 계정 — 최근 확정 연도 우선 (당해 연도는 공시 전일 수 있음)."""
    year = time.localtime().tm_year
    best_items: list[dict[str, Any]] | None = None
    for bsns_year in (str(year - 1), str(year - 2), str(year - 3), str(year)):
        payload = _dart_json(
            "fnlttSinglAcnt.json",
            {
                "corp_code": corp_code,
                "bsns_year": bsns_year,
                "reprt_code": ANNUAL_REPORT_CODE,
            },
        )
        status = str(payload.get("status") or "")
        if status not in ("000", "013"):
            continue
        items = payload.get("list")
        if not isinstance(items, list) or not items:
            continue
        has_eps = _pick_amount_from_accounts(items, _EPS_ACCOUNT_NAMES) is not None
        has_bps = _pick_amount_from_accounts(items, _BPS_ACCOUNT_NAMES) is not None
        if has_eps or has_bps:
            return items
        if best_items is None:
            best_items = items
    return best_items


def fetch_dart_per_share(stock_code: str) -> dict[str, float | None]:
    """최근 사업보고서 기준 EPS·BPS (KRW)."""
    empty = {"eps": None, "bps": None}
    if not dart_configured():
        return empty

    now = time.time()
    with _per_share_lock:
        cached = _per_share_cache.get(stock_code)
        if cached and now - cached[0] < PER_SHARE_CACHE_TTL_SEC:
            return cached[1] or empty

    corp_code = _corp_code_for_stock(stock_code)
    if not corp_code:
        with _per_share_lock:
            _per_share_cache[stock_code] = (time.time(), empty)
        return empty

    items = _fetch_annual_account_items(corp_code)
    metrics = {
        "eps": _pick_amount_from_accounts(items or [], _EPS_ACCOUNT_NAMES),
        "bps": _pick_amount_from_accounts(items or [], _BPS_ACCOUNT_NAMES),
    } if items else empty

    with _per_share_lock:
        _per_share_cache[stock_code] = (time.time(), metrics)
    return metrics


def fetch_trailing_eps(stock_code: str) -> float | None:
    return fetch_dart_per_share(stock_code).get("eps")


def fetch_book_value_per_share(stock_code: str) -> float | None:
    return fetch_dart_per_share(stock_code).get("bps")


def _pbr_from_balance_sheet(ticker: str, price: float, info: dict[str, Any]) -> float | None:
    if price <= 0:
        return None
    try:
        import yfinance as yf

        stock = yf.Ticker(ticker)
        bs = stock.balance_sheet
        if bs is None or getattr(bs, "empty", True):
            return None
        equity = None
        for key in (
            "Total Stockholder Equity",
            "Stockholders Equity",
            "Total Equity Gross Minority Interest",
            "Common Stock Equity",
        ):
            if key in bs.index:
                val = _safe_float(bs.loc[key].iloc[0])
                if val is not None and val > 0:
                    equity = val
                    break
        shares = _safe_float(
            info.get("sharesOutstanding")
            or info.get("impliedSharesOutstanding")
            or info.get("shareOutstanding")
        )
        if equity is None or shares is None or shares <= 0:
            return None
        bps = equity / shares
        if bps <= 0:
            return None
        return price / bps
    except Exception:
        return None


def resolve_trailing_pe(
    ticker: str,
    *,
    price: float | None,
    yahoo_trailing_pe: float | None,
    info: dict[str, Any] | None = None,
) -> float | None:
    """PER: Yahoo trailingPE → Yahoo EPS → Open DART EPS (한국)."""
    if yahoo_trailing_pe is not None and yahoo_trailing_pe > 0:
        return yahoo_trailing_pe

    info = info or {}
    if price is not None and price > 0:
        for field in ("trailingEps", "epsTrailingTwelveMonths"):
            eps = _safe_float(info.get(field))
            if eps is not None and eps > 0:
                return price / eps

    if not is_kr_ticker(ticker) or price is None or price <= 0:
        return None

    stock_code = stock_code_from_ticker(ticker)
    if not stock_code:
        return None

    eps = fetch_trailing_eps(stock_code)
    if eps is None or eps <= 0:
        return None
    return price / eps


def resolve_price_to_book(
    ticker: str,
    *,
    price: float | None,
    yahoo_pbr: float | None,
    info: dict[str, Any] | None = None,
) -> float | None:
    """PBR: Yahoo priceToBook → 주가÷bookValue → BS → Open DART BPS (한국)."""
    if yahoo_pbr is not None and yahoo_pbr > 0:
        return yahoo_pbr

    info = info or {}
    if price is not None and price > 0:
        book = _safe_float(info.get("bookValue"))
        if book is not None and book > 0:
            return price / book

    if price is not None and price > 0:
        bs_pbr = _pbr_from_balance_sheet(ticker, price, info)
        if bs_pbr is not None and bs_pbr > 0:
            return bs_pbr

    if not is_kr_ticker(ticker) or price is None or price <= 0:
        return None

    stock_code = stock_code_from_ticker(ticker)
    if not stock_code:
        return None

    bps = fetch_book_value_per_share(stock_code)
    if bps is None or bps <= 0:
        return None
    return price / bps
