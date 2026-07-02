"""GitHub Actions → Render 스냅샷 JSON 업로드 (재스캔 없음)."""

from __future__ import annotations

from typing import Any

UPLOAD_TARGETS: dict[str, str] = {
    "recommend2": "recommend2",
    "golden-cross": "golden-cross",
    "bollinger": "bollinger",
    "rsi-divergence": "rsi-divergence",
    "candle-support": "candle-support",
    "obv-divergence": "obv-divergence",
    "bottom-pattern": "bottom-pattern",
    "vcp": "vcp",
    "chart-kr": "chart-kr",
    "chart-us": "chart-us",
}


def apply_upload(target: str, payload: dict[str, Any]) -> dict[str, Any]:
    key = target.strip().lower()
    if key not in UPLOAD_TARGETS:
        raise ValueError(f"Unknown upload target: {target}")

    if not isinstance(payload, dict):
        raise ValueError("JSON body must be an object")

    if key == "recommend2":
        from recommend2_snapshot import enrich_payload, save_snapshot

        out = enrich_payload(dict(payload))
        out["source"] = "snapshot"
        save_snapshot(out)
        return {"ok": True, "target": key, "savedAt": out.get("savedAt")}

    if key.startswith("chart-"):
        from chart_snapshot import save_snapshot

        region = "kr" if key == "chart-kr" else "us"
        body = dict(payload)
        body["source"] = "snapshot"
        save_snapshot(region, body)
        return {
            "ok": True,
            "target": key,
            "savedAt": body.get("savedAt"),
            "markets": list((body.get("markets") or {}).keys()),
        }

    from stock_strategy_snapshot import STRATEGY_REGISTRY, enrich_payload, save_strategy_snapshot_disk

    if key not in STRATEGY_REGISTRY:
        raise ValueError(f"Unknown strategy: {key}")
    out = enrich_payload(dict(payload), key)
    out["source"] = "snapshot"
    save_strategy_snapshot_disk(key, out)
    return {
        "ok": True,
        "target": key,
        "activeCount": out.get("activeCount", 0),
        "savedAt": out.get("savedAt"),
    }
