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

from pathlib import Path

DART_UA = "DigitalWorld-Fundamentals/1.0 (github.com/Jongkyung-Ko/First)"
DART_BASE = "https://opendart.fss.or.kr/api"
CORP_CACHE_TTL_SEC = 86400
PER_SHARE_CACHE_TTL_SEC = 43200
ANNUAL_REPORT_CODE = "11011"
SAMPLE_STOCK_CODE = "005930"
SAMPLE_CORP_CODE = "00126380"  # Samsung Electronics — ping sample (no corp zip load)

_CORP_DISK_PATH = Path(__file__).resolve().parent / "data" / "dart-corp-map.json"

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

_NET_INCOME_EXACT_NAMES = ("당기순이익", "분기순이익")
_EQUITY_EXACT_NAMES = (
    "지배기업의 소유주에게 귀속되는 자본",
    "자본총계",
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


def _dart_json(endpoint: str, params: dict[str, str], *, timeout: int = 45) -> dict[str, Any]:
    key = dart_api_key()
    if not key:
        return {"status": "901", "message": "OPEN_DART_API_KEY not set"}
    query = {"crtfc_key": key, **params}
    url = f"{DART_BASE}/{endpoint}?{urllib.parse.urlencode(query)}"
    try:
        payload = json.loads(_fetch_bytes(url, timeout=timeout).decode("utf-8"))
    except Exception as exc:
        return {"status": "999", "message": str(exc)}
    if not isinstance(payload, dict):
        return {"status": "999", "message": "invalid json"}
    return payload


def _read_corp_map_disk() -> dict[str, str] | None:
    try:
        if not _CORP_DISK_PATH.is_file():
            return None
        payload = json.loads(_CORP_DISK_PATH.read_text(encoding="utf-8"))
        saved_at = float(payload.get("savedAt") or 0)
        if time.time() - saved_at > CORP_CACHE_TTL_SEC:
            return None
        mapping = payload.get("map")
        return mapping if isinstance(mapping, dict) else None
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return None


def _write_corp_map_disk(mapping: dict[str, str]) -> None:
    try:
        _CORP_DISK_PATH.parent.mkdir(parents=True, exist_ok=True)
        _CORP_DISK_PATH.write_text(
            json.dumps({"savedAt": time.time(), "map": mapping}, ensure_ascii=False),
            encoding="utf-8",
        )
    except OSError:
        pass


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

        if not force:
            disk_map = _read_corp_map_disk()
            if disk_map:
                _corp_map = disk_map
                _corp_loaded_at = time.time()
                return disk_map

        key = dart_api_key()
        url = f"{DART_BASE}/corpCode.xml?{urllib.parse.urlencode({'crtfc_key': key})}"
        mapping: dict[str, str] = {}
        try:
            raw = _fetch_bytes(url, timeout=120)
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
            disk_map = _read_corp_map_disk()
            if disk_map:
                _corp_map = disk_map
                _corp_loaded_at = time.time()
                return disk_map
            return {}

        _corp_map = mapping
        _corp_loaded_at = time.time()
        _write_corp_map_disk(mapping)
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


def _pick_exact_account(
    items: list[dict[str, Any]],
    exact_names: tuple[str, ...],
    *,
    sj_div: str | None = None,
    require_positive: bool = True,
) -> float | None:
    candidates: list[tuple[int, float]] = []
    for row in items:
        if not isinstance(row, dict):
            continue
        name = str(row.get("account_nm") or "").strip()
        if name not in exact_names:
            continue
        if sj_div and str(row.get("sj_div") or "") != sj_div:
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


def _fetch_account_items(
    corp_code: str,
    bsns_year: str,
    *,
    endpoint: str = "fnlttSinglAcnt.json",
    timeout: int = 45,
) -> list[dict[str, Any]] | None:
    payload = _dart_json(
        endpoint,
        {
            "corp_code": corp_code,
            "bsns_year": bsns_year,
            "reprt_code": ANNUAL_REPORT_CODE,
        },
        timeout=timeout,
    )
    if str(payload.get("status") or "") not in ("000", "013"):
        return None
    items = payload.get("list")
    return items if isinstance(items, list) and items else None


def _compute_metrics_from_items(
    items: list[dict[str, Any]],
    corp_code: str,
    bsns_year: str,
) -> dict[str, float | None]:
    metrics: dict[str, float | None] = {
        "eps": _pick_amount_from_accounts(items, _EPS_ACCOUNT_NAMES),
        "bps": _pick_amount_from_accounts(items, _BPS_ACCOUNT_NAMES),
    }
    if metrics["eps"] and metrics["bps"]:
        return metrics
    shares = _fetch_listed_shares(corp_code, bsns_year)
    if not shares or shares <= 0:
        return metrics
    if not metrics["eps"]:
        net_income = _pick_exact_account(items, _NET_INCOME_EXACT_NAMES, sj_div="IS")
        if net_income and net_income > 0:
            metrics["eps"] = net_income / shares
    if not metrics["bps"]:
        equity = _pick_exact_account(items, _EQUITY_EXACT_NAMES, sj_div="BS")
        if equity and equity > 0:
            metrics["bps"] = equity / shares
    return metrics


def _items_have_financials(items: list[dict[str, Any]]) -> bool:
    if _pick_amount_from_accounts(items, _EPS_ACCOUNT_NAMES):
        return True
    if _pick_amount_from_accounts(items, _BPS_ACCOUNT_NAMES):
        return True
    has_ni = _pick_exact_account(items, _NET_INCOME_EXACT_NAMES, sj_div="IS") is not None
    has_eq = _pick_exact_account(items, _EQUITY_EXACT_NAMES, sj_div="BS") is not None
    return has_ni and has_eq


def _fetch_listed_shares(corp_code: str, bsns_year: str) -> float | None:
    payload = _dart_json(
        "stockTotqySttus.json",
        {"corp_code": corp_code, "bsns_year": bsns_year},
    )
    if str(payload.get("status") or "") not in ("000", "013"):
        return None
    items = payload.get("list")
    if not isinstance(items, list):
        return None
    best: float | None = None
    for row in items:
        if not isinstance(row, dict):
            continue
        for field in ("distb_stock_co", "istc_totqy", "lstg_stqt"):
            qty = _parse_dart_amount(row.get(field))
            if qty is not None and qty > 0:
                best = max(best or 0.0, qty)
    return best


def _fetch_annual_account_items(corp_code: str) -> tuple[list[dict[str, Any]] | None, str | None]:
    """사업보고서 계정 + 해당 사업연도 (주요계정 우선, 필요 시 전체계정 1회)."""
    year = time.localtime().tm_year
    best_items: list[dict[str, Any]] | None = None
    best_year: str | None = None
    for bsns_year in (str(year - 1), str(year - 2), str(year - 3)):
        items = _fetch_account_items(corp_code, bsns_year)
        if items and _items_have_financials(items):
            return items, bsns_year
        if items and best_items is None:
            best_items, best_year = items, bsns_year
    if best_items and best_year:
        return best_items, best_year
    last_year = str(year - 1)
    items = _fetch_account_items(corp_code, last_year, endpoint="fnlttSinglAcntAll.json")
    if items:
        return items, last_year
    return None, None


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

    items, bsns_year = _fetch_annual_account_items(corp_code)
    metrics = {"eps": None, "bps": None}
    if items and bsns_year:
        metrics = _compute_metrics_from_items(items, corp_code, bsns_year)

    with _per_share_lock:
        _per_share_cache[stock_code] = (time.time(), metrics)
    return metrics


def fetch_trailing_eps(stock_code: str) -> float | None:
    return fetch_dart_per_share(stock_code).get("eps")


def fetch_book_value_per_share(stock_code: str) -> float | None:
    return fetch_dart_per_share(stock_code).get("bps")


def dart_health_ping() -> dict[str, Any]:
    """Lightweight ping — max 2 DART calls, ~20s (Render gateway safe)."""
    if not dart_configured():
        return {
            "ok": False,
            "configured": False,
            "message": "OPEN_DART_API_KEY not set on server",
        }

    ping_timeout = 10
    company = _dart_json("company.json", {"corp_code": SAMPLE_CORP_CODE}, timeout=ping_timeout)
    company_status = str(company.get("status") or "")
    if company_status == "020":
        return {
            "ok": False,
            "configured": True,
            "dartReachable": True,
            "message": "OPEN_DART_API_KEY invalid (status 020)",
        }
    if company_status not in ("000", "013"):
        return {
            "ok": False,
            "configured": True,
            "dartReachable": False,
            "dartStatus": company_status,
            "message": str(company.get("message") or "DART unreachable"),
        }

    year = time.localtime().tm_year
    items: list[dict[str, Any]] | None = None
    bsns_year: str | None = None
    for yr in (str(year - 2), str(year - 3)):
        items = _fetch_account_items(SAMPLE_CORP_CODE, yr, timeout=ping_timeout)
        if items and _items_have_financials(items):
            bsns_year = yr
            break

    eps = bps = None
    if items and bsns_year:
        eps = _pick_amount_from_accounts(items, _EPS_ACCOUNT_NAMES)
        bps = _pick_amount_from_accounts(items, _BPS_ACCOUNT_NAMES)
    metrics_ok = bool(eps and eps > 0 and bps and bps > 0)

    return {
        "ok": True,
        "configured": True,
        "dartReachable": True,
        "metricsOk": metrics_ok,
        "sample": {
            "stockCode": SAMPLE_STOCK_CODE,
            "ticker": f"{SAMPLE_STOCK_CODE}.KS",
            "corpCode": SAMPLE_CORP_CODE,
            "bsnsYear": bsns_year,
            "eps": eps,
            "bps": bps,
        },
        "message": None if metrics_ok else "DART key OK — EPS/BPS sample null (fundamentals Re로 갱신)",
    }


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
