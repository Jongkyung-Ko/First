"""Korean Lotto 6/45 — dhlottery proxy and prize check."""

from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from typing import Any

LOTTO_UA = "DigitalWorld-Lotto/1.0 (educational; github.com/Jongkyung-Ko/First)"
DHLOTTERY_REFERER = "https://www.dhlottery.co.kr/lt645/result"
DHLOTTERY_INFO_URL = "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do"


def _fetch_dhlottery(params: dict[str, str], *, timeout: int = 25) -> Any:
    query = urllib.parse.urlencode(params)
    url = f"{DHLOTTERY_INFO_URL}?{query}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": LOTTO_UA,
            "Accept": "application/json, text/plain, */*",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": DHLOTTERY_REFERER,
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _normalize_draw_row(row: dict[str, Any]) -> dict[str, Any]:
    numbers = [
        int(row["tm1WnNo"]),
        int(row["tm2WnNo"]),
        int(row["tm3WnNo"]),
        int(row["tm4WnNo"]),
        int(row["tm5WnNo"]),
        int(row["tm6WnNo"]),
    ]
    date_raw = str(row.get("ltRflYmd") or "")
    if len(date_raw) == 8:
        date_fmt = f"{date_raw[0:4]}-{date_raw[4:6]}-{date_raw[6:8]}"
    else:
        date_fmt = date_raw
    return {
        "round": int(row["ltEpsd"]),
        "date": date_fmt,
        "numbers": numbers,
        "bonus": int(row["bnsWnNo"]),
        "first_prize": int(row.get("rnk1WnAmt") or 0),
        "first_winners": int(row.get("rnk1WnNope") or 0),
        "total_sales": int(row.get("rlvtEpsdSumNtslAmt") or 0),
    }


def fetch_lotto_draw(round_no: int | None = None) -> dict[str, Any]:
    params: dict[str, str] = {"_": str(int(time.time() * 1000))}
    if round_no is None:
        params["srchLtEpsd"] = ""
    else:
        if round_no < 1 or round_no > 9999:
            raise ValueError("회차는 1~9999 사이여야 합니다.")
        params["srchLtEpsd"] = str(round_no)
    data = _fetch_dhlottery(params)
    rows = ((data.get("data") or {}).get("list") or []) if isinstance(data, dict) else []
    if not rows:
        raise RuntimeError("당첨 정보를 찾지 못했습니다.")
    draw = _normalize_draw_row(rows[0])
    return {"kind": "lotto_draw", **draw}


def _valid_line(nums: list[int]) -> bool:
    if len(nums) != 6:
        return False
    if len(set(nums)) != 6:
        return False
    return all(1 <= n <= 45 for n in nums)


def rank_lotto_line(picks: list[int], winning: list[int], bonus: int) -> int:
    if not _valid_line(picks):
        return 0
    matched = len(set(picks) & set(winning))
    if matched == 6:
        return 1
    if matched == 5 and bonus in picks:
        return 2
    if matched == 5:
        return 3
    if matched == 4:
        return 4
    if matched == 3:
        return 5
    return 0


RANK_LABELS = {
    0: "낙첨",
    1: "1등",
    2: "2등",
    3: "3등",
    4: "4등",
    5: "5등",
}


def parse_lotto_qr(raw: str) -> dict[str, Any]:
    text = str(raw or "").strip()
    if not text:
        raise ValueError("QR 데이터가 비어 있습니다.")
    if "v=" in text:
        payload = text.split("v=", 1)[1].split("&")[0].split("#")[0].strip()
    else:
        payload = text
    payload = payload.strip()
    if len(payload) < 16:
        raise ValueError("QR 형식이 올바르지 않습니다.")
    round_no = int(payload[:4])
    game_data = payload[4:]
    game_data = re.sub(r"[a-zA-Z]", ",", game_data)
    lines: list[list[int]] = []
    for chunk in game_data.split(","):
        chunk = chunk.strip()
        if len(chunk) < 12:
            continue
        nums = [int(chunk[i : i + 2]) for i in range(0, 12, 2)]
        if _valid_line(nums):
            lines.append(sorted(nums))
    if not lines:
        raise ValueError("QR에서 유효한 번호 조합을 찾지 못했습니다.")
    return {"round": round_no, "lines": lines}


def check_lotto_lines(round_no: int, lines: list[list[int]]) -> dict[str, Any]:
    if round_no < 1:
        raise ValueError("회차를 입력해 주세요.")
    normalized: list[list[int]] = []
    for row in lines:
        nums = sorted(int(n) for n in row)
        if not _valid_line(nums):
            raise ValueError("각 줄은 1~45의 서로 다른 숫자 6개여야 합니다.")
        normalized.append(nums)
    if not normalized:
        raise ValueError("확인할 번호가 없습니다.")
    draw = fetch_lotto_draw(round_no)
    winning = draw["numbers"]
    bonus = draw["bonus"]
    results = []
    for index, picks in enumerate(normalized, start=1):
        rank = rank_lotto_line(picks, winning, bonus)
        matched = sorted(set(picks) & set(winning))
        results.append(
            {
                "line": index,
                "numbers": picks,
                "matched": matched,
                "match_count": len(matched),
                "bonus_hit": bonus in picks,
                "rank": rank,
                "rank_label": RANK_LABELS.get(rank, "낙첨"),
            }
        )
    return {
        "kind": "lotto_check",
        "round": draw["round"],
        "draw": draw,
        "results": results,
    }


def check_lotto_qr(raw: str) -> dict[str, Any]:
    parsed = parse_lotto_qr(raw)
    checked = check_lotto_lines(parsed["round"], parsed["lines"])
    checked["qr"] = parsed
    return checked
