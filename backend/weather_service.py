"""Korean weather via 기상청 API허브 (동네예보 + 중기예보)."""

from __future__ import annotations

import json
import math
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

WEATHER_UA = "DigitalWorld-Weather/1.0 (educational; github.com/Jongkyung-Ko/First)"
KMA_HUB = "https://apihub.kma.go.kr"
KST = ZoneInfo("Asia/Seoul")
CACHE_TTL_SEC = 900

SEOUL_LAT = 37.5665
SEOUL_LON = 126.9780

_KOREA_BBOX = (33.0, 39.5, 124.0, 132.1)
_WEATHER_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}

KOREA_PLACES: list[dict[str, Any]] = [
    {"label": "서울", "lat": 37.5665, "lng": 126.9780, "land_reg": "11B00000", "ta_reg": "11B10101"},
    {"label": "인천", "lat": 37.4563, "lng": 126.7052, "land_reg": "11B00000", "ta_reg": "11B20201"},
    {"label": "수원", "lat": 37.2636, "lng": 127.0286, "land_reg": "11B00000", "ta_reg": "11B20601"},
    {"label": "부산", "lat": 35.1796, "lng": 129.0756, "land_reg": "11H20000", "ta_reg": "11H20201"},
    {"label": "대구", "lat": 35.8714, "lng": 128.6014, "land_reg": "11H10000", "ta_reg": "11H10701"},
    {"label": "광주", "lat": 35.1595, "lng": 126.8526, "land_reg": "11F20000", "ta_reg": "11F20501"},
    {"label": "대전", "lat": 36.3504, "lng": 127.3845, "land_reg": "11C20000", "ta_reg": "11C20401"},
    {"label": "울산", "lat": 35.5384, "lng": 129.3114, "land_reg": "11H20000", "ta_reg": "11H20101"},
    {"label": "세종", "lat": 36.4800, "lng": 127.2890, "land_reg": "11C20000", "ta_reg": "11C20404"},
    {"label": "제주", "lat": 33.4996, "lng": 126.5312, "land_reg": "11G00000", "ta_reg": "11G00201"},
    {"label": "춘천", "lat": 37.8813, "lng": 127.7298, "land_reg": "11D10000", "ta_reg": "11D10301"},
    {"label": "강릉", "lat": 37.7519, "lng": 128.8761, "land_reg": "11D20000", "ta_reg": "11D20501"},
    {"label": "청주", "lat": 36.6424, "lng": 127.4890, "land_reg": "11C10000", "ta_reg": "11C10301"},
    {"label": "전주", "lat": 35.8242, "lng": 127.1480, "land_reg": "11F10000", "ta_reg": "11F10201"},
    {"label": "창원", "lat": 35.2285, "lng": 128.6811, "land_reg": "11H20000", "ta_reg": "11H20301"},
    {"label": "포항", "lat": 36.0190, "lng": 129.3435, "land_reg": "11H10000", "ta_reg": "11H10201"},
]


def _korea_now() -> datetime:
    return datetime.now(KST)


def _auth_key() -> str:
    key = (os.environ.get("KMA_AUTH_KEY") or os.environ.get("KMA_API_KEY") or "").strip()
    if not key:
        raise ValueError("KMA_AUTH_KEY 환경변수가 설정되지 않았습니다.")
    return key


def _in_korea(lat: float, lon: float) -> bool:
    lat_min, lat_max, lon_min, lon_max = _KOREA_BBOX
    return lat_min <= lat <= lat_max and lon_min <= lon <= lon_max


def _fetch_text(url: str, *, timeout: int = 25) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": WEATHER_UA}, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _fetch_json(url: str, *, timeout: int = 25) -> Any:
    return json.loads(_fetch_text(url, timeout=timeout))


def _kma_items(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    header = payload.get("response", {}).get("header", {})
    code = str(header.get("resultCode", ""))
    if code and code not in ("00", "0", "NORMAL_SERVICE"):
        msg = header.get("resultMsg") or "기상청 API 오류"
        raise ValueError(str(msg))
    items = payload.get("response", {}).get("body", {}).get("items", {}).get("item", [])
    if isinstance(items, dict):
        return [items]
    if isinstance(items, list):
        return [row for row in items if isinstance(row, dict)]
    return []


def _kma_open_api(path: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    query = {**params, "authKey": _auth_key(), "dataType": "JSON"}
    url = f"{KMA_HUB}{path}?{urllib.parse.urlencode(query)}"
    return _kma_items(_fetch_json(url))


def _grid_from_lonlat(lat: float, lon: float) -> tuple[int, int]:
    query = urllib.parse.urlencode(
        {"lon": f"{lon:.6f}", "lat": f"{lat:.6f}", "help": "0", "authKey": _auth_key()}
    )
    url = f"{KMA_HUB}/api/typ01/cgi-bin/url/nph-dfs_xy_lonlat?{query}"
    text = _fetch_text(url)
    match = re.search(r"[xX]\s*=\s*(\d+)[^\d]+[yY]\s*=\s*(\d+)", text)
    if not match:
        raise ValueError("격자 좌표 변환에 실패했습니다.")
    return int(match.group(1)), int(match.group(2))


def _vilage_base(now: datetime | None = None) -> tuple[str, str]:
    now = now or _korea_now()
    issue_hours = (23, 20, 17, 14, 11, 8, 5, 2)
    base = now.replace(minute=0, second=0, microsecond=0)
    for hour in issue_hours:
        candidate = base.replace(hour=hour)
        if now >= candidate + timedelta(minutes=10):
            return candidate.strftime("%Y%m%d"), f"{hour:02d}00"
    prev = base - timedelta(days=1)
    return prev.strftime("%Y%m%d"), "2300"


def _ultra_ncst_base(now: datetime | None = None) -> tuple[str, str]:
    now = now or _korea_now()
    base = now.replace(minute=0, second=0, microsecond=0)
    if now.minute < 40:
        base -= timedelta(hours=1)
    return base.strftime("%Y%m%d"), base.strftime("%H00")


def _mid_tm_fc(now: datetime | None = None) -> str:
    now = now or _korea_now()
    today = now.date()
    for hour in (18, 6):
        candidate = datetime(today.year, today.month, today.day, hour, 0, tzinfo=KST)
        if now >= candidate + timedelta(minutes=30):
            return candidate.strftime("%Y%m%d%H%M")
    prev = today - timedelta(days=1)
    return datetime(prev.year, prev.month, prev.day, 18, 0, tzinfo=KST).strftime("%Y%m%d%H%M")


def _sky_pty_label(sky: str | None, pty: str | None) -> str:
    p = str(pty or "0").strip()
    if p == "1":
        return "비"
    if p == "2":
        return "비/눈"
    if p == "3":
        return "눈"
    if p == "4":
        return "소나기"
    s = str(sky or "1").strip()
    return {"1": "맑음", "3": "구름많음", "4": "흐림"}.get(s, "—")


def _closest_place(lat: float, lon: float) -> dict[str, Any]:
    best = KOREA_PLACES[0]
    best_d = float("inf")
    for place in KOREA_PLACES:
        d = (place["lat"] - lat) ** 2 + (place["lng"] - lon) ** 2
        if d < best_d:
            best_d = d
            best = place
    return best


def _mid_land_reg_id(lat: float, lon: float) -> str:
    if lon >= 128.8 and lat >= 37.5:
        return "11D20000"
    if lat >= 38.0:
        return "11D10000"
    if lat < 34.0:
        return "11G00000"
    if lat < 35.3 and lon < 127.0:
        return "11F20000"
    if lat < 35.8 and lon < 128.0:
        return "11F10000"
    if lat < 36.3 and lon < 127.5:
        return "11C20000"
    if lat < 37.0 and lon < 128.5:
        return "11C10000"
    if lat < 36.8 and lon >= 128.5:
        return "11H10000"
    if lat >= 35.0 and lon >= 128.0:
        return "11H20000"
    return "11B00000"


def _place_label(lat: float, lon: float) -> str:
    place = _closest_place(lat, lon)
    dist_km = math.sqrt((place["lat"] - lat) ** 2 + (place["lng"] - lon) ** 2) * 111
    if dist_km < 35:
        return f"{place['label']} (기상청)"
    return f"위도 {lat:.2f}, 경도 {lon:.2f}"


def _parse_vilage_series(items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    by_time: dict[str, dict[str, str]] = {}
    for row in items:
        t = str(row.get("fcstDate", "")) + str(row.get("fcstTime", "")).zfill(4)
        cat = str(row.get("category", ""))
        val = str(row.get("fcstValue", ""))
        by_time.setdefault(t, {})[cat] = val

    hourly: list[dict[str, Any]] = []
    now_stamp = _korea_now().strftime("%Y%m%d%H%M")
    for t in sorted(by_time.keys()):
        if len(t) < 12:
            continue
        if t < now_stamp[: len(t)]:
            continue
        if len(hourly) >= 24:
            break
        cats = by_time[t]
        if "TMP" not in cats:
            continue
        hourly.append(
            {
                "time": t,
                "temp": int(float(cats["TMP"])) if cats.get("TMP") else None,
                "summary": _sky_pty_label(cats.get("SKY"), cats.get("PTY")),
                "pop": int(cats["POP"]) if cats.get("POP") not in (None, "") else None,
            }
        )

    by_date: dict[str, dict[str, Any]] = {}
    for t, cats in by_time.items():
        date = t[:8]
        bucket = by_date.setdefault(date, {"temps": [], "pops": [], "sky": [], "pty": []})
        if cats.get("TMP"):
            try:
                bucket["temps"].append(int(float(cats["TMP"])))
            except ValueError:
                pass
        if cats.get("POP") not in (None, ""):
            try:
                bucket["pops"].append(int(cats["POP"]))
            except ValueError:
                pass
        if cats.get("SKY"):
            bucket["sky"].append(cats["SKY"])
        if cats.get("PTY"):
            bucket["pty"].append(cats["PTY"])

    daily: list[dict[str, Any]] = []
    today = _korea_now().strftime("%Y%m%d")
    for date in sorted(by_date.keys())[:3]:
        bucket = by_date[date]
        temps = bucket["temps"]
        if not temps:
            continue
        sky = bucket["sky"][-1] if bucket["sky"] else "1"
        pty = bucket["pty"][-1] if bucket["pty"] else "0"
        label = "오늘" if date == today else date[4:6] + "/" + date[6:8]
        daily.append(
            {
                "date": date,
                "label": label,
                "min": min(temps),
                "max": max(temps),
                "summary": _sky_pty_label(sky, pty),
                "pop": max(bucket["pops"]) if bucket["pops"] else None,
            }
        )
    return hourly, daily


def _parse_mid_weekly(land_item: dict[str, Any], ta_item: dict[str, Any] | None) -> list[dict[str, Any]]:
    weekly: list[dict[str, Any]] = []
    now = _korea_now().date()
    for offset in range(3, 11):
        day = now + timedelta(days=offset)
        key = str(offset)
        wf_am = land_item.get(f"wf{key}Am")
        wf_pm = land_item.get(f"wf{key}Pm")
        pop_am = land_item.get(f"rnSt{key}Am")
        pop_pm = land_item.get(f"rnSt{key}Pm")
        ta_min = ta_item.get(f"taMin{key}") if ta_item else None
        ta_max = ta_item.get(f"taMax{key}") if ta_item else None
        if not any([wf_am, wf_pm, ta_min, ta_max]):
            continue
        weekly.append(
            {
                "date": day.strftime("%Y%m%d"),
                "label": day.strftime("%m/%d"),
                "am": str(wf_am or "—"),
                "pm": str(wf_pm or "—"),
                "min": int(ta_min) if ta_min not in (None, "") else None,
                "max": int(ta_max) if ta_max not in (None, "") else None,
                "pop_am": int(pop_am) if pop_am not in (None, "") else None,
                "pop_pm": int(pop_pm) if pop_pm not in (None, "") else None,
            }
        )
    return weekly


def _fetch_kma_weather(lat: float, lon: float, *, label: str) -> dict[str, Any]:
    if not _in_korea(lat, lon):
        raise ValueError("기상청 API는 국내 지역(한반도)만 지원합니다.")

    nx, ny = _grid_from_lonlat(lat, lon)
    place = _closest_place(lat, lon)
    land_reg = _mid_land_reg_id(lat, lon)
    ta_reg = str(place.get("ta_reg") or land_reg)

    ncst_date, ncst_time = _ultra_ncst_base()
    ncst_rows = _kma_open_api(
        "/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtNcst",
        {"pageNo": 1, "numOfRows": 100, "base_date": ncst_date, "base_time": ncst_time, "nx": nx, "ny": ny},
    )
    ncst_map = {str(r.get("category")): r.get("obsrValue") for r in ncst_rows}

    vil_date, vil_time = _vilage_base()
    vil_rows = _kma_open_api(
        "/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst",
        {"pageNo": 1, "numOfRows": 1000, "base_date": vil_date, "base_time": vil_time, "nx": nx, "ny": ny},
    )
    hourly, daily = _parse_vilage_series(vil_rows)

    tm_fc = _mid_tm_fc()
    land_items = _kma_open_api(
        "/api/typ02/openApi/MidFcstInfoService/getMidLandFcst",
        {"pageNo": 1, "numOfRows": 10, "regId": land_reg, "tmFc": tm_fc},
    )
    ta_items = _kma_open_api(
        "/api/typ02/openApi/MidFcstInfoService/getMidTa",
        {"pageNo": 1, "numOfRows": 10, "regId": ta_reg, "tmFc": tm_fc},
    )
    weekly = _parse_mid_weekly(land_items[0], ta_items[0] if ta_items else None)

    temp = ncst_map.get("T1H")
    humidity = ncst_map.get("REH")
    wind = ncst_map.get("WSD")
    summary = _sky_pty_label(None, ncst_map.get("PTY"))

    try:
        wind_kmh = round(float(wind) * 3.6, 1) if wind not in (None, "") else None
    except ValueError:
        wind_kmh = None

    return {
        "kind": "weather",
        "city": label,
        "source": "kma",
        "latitude": lat,
        "longitude": lon,
        "nx": nx,
        "ny": ny,
        "timezone": "Asia/Seoul",
        "temperature_c": int(float(temp)) if temp not in (None, "") else None,
        "feels_like_c": None,
        "humidity_pct": int(float(humidity)) if humidity not in (None, "") else None,
        "wind_kmh": wind_kmh,
        "summary": summary,
        "updated_at": f"{ncst_date} {ncst_time} KST",
        "hourly": hourly,
        "daily": daily,
        "weekly": weekly,
    }


def search_weather_places(query: str, *, limit: int = 8) -> dict[str, Any]:
    q = (query or "").strip()
    if not q:
        return {"kind": "weather_search", "count": 0, "items": []}

    q_lower = q.lower()
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for place in KOREA_PLACES:
        label = str(place["label"])
        if q_lower not in label.lower() and q not in label:
            continue
        pid = f"{place['lat']:.4f}:{place['lng']:.4f}"
        if pid in seen:
            continue
        seen.add(pid)
        items.append(
            {
                "id": pid,
                "label": f"{label} (대한민국)",
                "lat": place["lat"],
                "lng": place["lng"],
                "country": "KR",
                "admin1": label,
            }
        )
        if len(items) >= limit:
            break

    return {"kind": "weather_search", "count": len(items), "items": items}


def fetch_weather_at(
    lat: float | None = None,
    lon: float | None = None,
    *,
    city: str = "Seoul",
) -> dict[str, Any]:
    del city
    use_lat = lat if lat is not None else SEOUL_LAT
    use_lon = lon if lon is not None else SEOUL_LON
    label = _place_label(use_lat, use_lon)

    cache_key = f"{use_lat:.3f}:{use_lon:.3f}"
    cached = _WEATHER_CACHE.get(cache_key)
    if cached and time.time() - cached[0] < CACHE_TTL_SEC:
        return cached[1]

    payload = _fetch_kma_weather(use_lat, use_lon, label=label)
    _WEATHER_CACHE[cache_key] = (time.time(), payload)
    return payload
