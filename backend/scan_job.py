"""Global Stock Picks Re scan lock — one running job at a time."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

SCAN_REGION_ORDER = ("kospi", "kosdaq", "nasdaq", "nyse")
SCAN_REGION_LABELS = {
    "kospi": "KOSPI",
    "kosdaq": "KOSDAQ",
    "nasdaq": "NASDAQ",
    "nyse": "NYSE",
    "all": "전체",
    "kr": "한국",
    "us": "미국",
}

TARGET_LABELS: dict[str, str] = {
    "recommend2": "바닥매집",
    "golden-cross": "골든크로스",
    "bollinger": "볼린저밴드",
    "rsi-divergence": "RSI+다이버전스",
    "candle-support": "지지+반전캔들",
    "obv-divergence": "OBV+다이버전스",
    "bottom-pattern": "쌍·삼중바닥",
    "vcp": "VCP",
    "fundamentals": "가치·배당 (PER·ROE·PBR·배당)",
    "long-term-screens": "장기추천 (소형·저PBR·마법·F-스코어)",
    "quality-score": "재무 종합 점수",
    "sentiment:kr_kospi": "감성뉴스 KOSPI",
    "sentiment:kr_kosdaq": "감성뉴스 KOSDAQ",
    "sentiment:us": "감성뉴스 미국",
}

STUCK_JOB_MINUTES = 12
DM_COST = 1

_memory_job: dict[str, Any] | None = None


class ScanBusy(Exception):
    def __init__(self, job: dict[str, Any]):
        self.job = job
        super().__init__("scan_busy")


def _service_client():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        return None
    try:
        from supabase import create_client

        return create_client(url, key)
    except Exception:
        return None


def target_label(target: str) -> str:
    return TARGET_LABELS.get(target, target)


def dm_required_for_target(target: str) -> bool:
    return target != "recommend2"


def total_steps_for_target(target: str) -> int:
    if target.startswith("sentiment:"):
        return 1
    return 4


def _step_info(target: str, region: str) -> tuple[int, str, bool]:
    if target.startswith("sentiment:"):
        label = TARGET_LABELS.get(target, region)
        return 1, label, True
    if region == "all":
        return 4, "전체", True
    try:
        idx = SCAN_REGION_ORDER.index(region)
    except ValueError:
        return 1, SCAN_REGION_LABELS.get(region, region), region in ("nyse", "us", "kr")
    step = idx + 1
    return step, SCAN_REGION_LABELS[region], region == "nyse"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    return {
        "id": str(row.get("id") or ""),
        "target": str(row.get("target") or ""),
        "targetLabel": str(row.get("target_label") or row.get("targetLabel") or ""),
        "status": str(row.get("status") or ""),
        "step": int(row.get("step") or 0),
        "totalSteps": int(row.get("total_steps") or row.get("totalSteps") or 4),
        "stepLabel": row.get("step_label") or row.get("stepLabel"),
        "startedAt": row.get("started_at") or row.get("startedAt"),
        "updatedAt": row.get("updated_at") or row.get("updatedAt"),
        "completedAt": row.get("completed_at") or row.get("completedAt"),
        "errorMessage": row.get("error_message") or row.get("errorMessage"),
    }


def public_job(job: dict[str, Any] | None) -> dict[str, Any] | None:
    if not job:
        return None
    return {
        "id": job.get("id"),
        "target": job.get("target"),
        "targetLabel": job.get("targetLabel") or target_label(str(job.get("target") or "")),
        "status": job.get("status"),
        "step": job.get("step"),
        "totalSteps": job.get("totalSteps"),
        "stepLabel": job.get("stepLabel"),
        "startedAt": job.get("startedAt"),
        "updatedAt": job.get("updatedAt"),
        "completedAt": job.get("completedAt"),
        "message": _status_message(job),
    }


def _status_message(job: dict[str, Any]) -> str:
    label = job.get("targetLabel") or target_label(str(job.get("target") or ""))
    if job.get("status") != "running":
        return f"{label} 스캔 완료"
    step = int(job.get("step") or 0)
    total = int(job.get("totalSteps") or 4)
    step_label = job.get("stepLabel") or ""
    if step_label:
        return f"{label} 스캔 중 ({step}/{total}) · {step_label}"
    return f"{label} 스캔 중 ({step}/{total})"


def _is_stale(job: dict[str, Any]) -> bool:
    raw = job.get("updatedAt") or job.get("startedAt")
    if not raw:
        return False
    try:
        updated = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return False
    return datetime.now(timezone.utc) - updated > timedelta(minutes=STUCK_JOB_MINUTES)


def _fail_stale_job(job_id: str) -> None:
    client = _service_client()
    if client:
        client.table("stock_scan_jobs").update(
            {
                "status": "failed",
                "error_message": "timeout",
                "completed_at": _now_iso(),
                "updated_at": _now_iso(),
            }
        ).eq("id", job_id).eq("status", "running").execute()
    global _memory_job
    if _memory_job and str(_memory_job.get("id")) == job_id:
        _memory_job = None


def get_running_job() -> dict[str, Any] | None:
    global _memory_job
    client = _service_client()
    if client:
        try:
            resp = (
                client.table("stock_scan_jobs")
                .select("*")
                .eq("status", "running")
                .order("started_at", desc=True)
                .limit(1)
                .execute()
            )
            row = (resp.data or [None])[0]
            job = _normalize_row(row)
            if job and _is_stale(job):
                _fail_stale_job(job["id"])
                return None
            _memory_job = job
            return job
        except Exception:
            pass
    if _memory_job and _memory_job.get("status") == "running":
        if _is_stale(_memory_job):
            _memory_job = None
            return None
        return dict(_memory_job)
    return None


def _insert_job(
    target: str,
    label: str,
    *,
    started_by: str | None,
    total_steps: int,
    step: int,
    step_label: str,
) -> dict[str, Any]:
    global _memory_job
    now = _now_iso()
    row = {
        "target": target,
        "target_label": label,
        "status": "running",
        "step": step,
        "total_steps": total_steps,
        "step_label": step_label,
        "started_by": started_by,
        "started_at": now,
        "updated_at": now,
    }
    client = _service_client()
    if client:
        try:
            resp = client.table("stock_scan_jobs").insert(row).execute()
            created = _normalize_row((resp.data or [None])[0])
            if created:
                _memory_job = created
                return created
        except Exception as exc:
            err = str(exc).lower()
            if "unique" in err or "duplicate" in err:
                running = get_running_job()
                if running:
                    raise ScanBusy(running) from exc
            raise
    job = {
        "id": f"mem-{int(datetime.now(timezone.utc).timestamp())}",
        "target": target,
        "targetLabel": label,
        "status": "running",
        "step": step,
        "totalSteps": total_steps,
        "stepLabel": step_label,
        "startedAt": now,
        "updatedAt": now,
    }
    if _memory_job and _memory_job.get("status") == "running":
        raise ScanBusy(_memory_job)
    _memory_job = job
    return job


def _update_job(job_id: str, *, step: int, step_label: str, is_final: bool) -> dict[str, Any]:
    global _memory_job
    now = _now_iso()
    patch: dict[str, Any] = {
        "step": step,
        "step_label": step_label,
        "updated_at": now,
    }
    if is_final:
        patch["status"] = "completed"
        patch["completed_at"] = now
    client = _service_client()
    if client and not str(job_id).startswith("mem-"):
        resp = (
            client.table("stock_scan_jobs")
            .update(patch)
            .eq("id", job_id)
            .eq("status", "running")
            .execute()
        )
        job = _normalize_row((resp.data or [None])[0])
        if job:
            if is_final:
                _memory_job = None
            else:
                _memory_job = job
            return job
    if _memory_job and str(_memory_job.get("id")) == job_id:
        _memory_job = {
            **_memory_job,
            "step": step,
            "stepLabel": step_label,
            "updatedAt": now,
            "status": "completed" if is_final else "running",
            "completedAt": now if is_final else None,
        }
        if is_final:
            done = dict(_memory_job)
            _memory_job = None
            return done
        return dict(_memory_job)
    raise HTTPException(status_code=404, detail="Scan job not found or already finished")


def fail_job(job_id: str, message: str) -> None:
    global _memory_job
    now = _now_iso()
    client = _service_client()
    if client and not str(job_id).startswith("mem-"):
        client.table("stock_scan_jobs").update(
            {
                "status": "failed",
                "error_message": message[:500],
                "completed_at": now,
                "updated_at": now,
            }
        ).eq("id", job_id).eq("status", "running").execute()
    if _memory_job and str(_memory_job.get("id")) == job_id:
        _memory_job = None


def raise_scan_busy(job: dict[str, Any]) -> None:
    raise HTTPException(
        status_code=409,
        detail={
            "code": "scan_busy",
            "message": "이미 스캔 중입니다.",
            "job": public_job(job),
        },
    )


def gate_force_scan(
    *,
    target: str,
    region: str,
    scan_job_id: str | None,
    authorization: str | None,
) -> dict[str, Any]:
    """Acquire or continue a scan job. Raises HTTP 409 if another scan is active."""
    from auth_user import require_user_from_bearer, spend_digimon_with_token

    label = target_label(target)
    step, step_label, _is_final = _step_info(target, region)
    total = total_steps_for_target(target)
    running = get_running_job()

    if running:
        if scan_job_id and str(running.get("id")) == str(scan_job_id):
            if running.get("target") != target:
                raise HTTPException(status_code=400, detail="Scan job target mismatch")
            return _update_job(str(running["id"]), step=step, step_label=step_label, is_final=False)
        raise_scan_busy(running)

    if scan_job_id:
        raise HTTPException(status_code=404, detail="Scan job not found or expired")

    started_by: str | None = None
    if dm_required_for_target(target):
        user = require_user_from_bearer(authorization)
        started_by = user["id"]
        spend_digimon_with_token(
            user["access_token"],
            DM_COST,
            f"Stock Picks {label} Re",
        )
    elif authorization and authorization.startswith("Bearer "):
        try:
            user = require_user_from_bearer(authorization)
            started_by = user["id"]
        except HTTPException:
            started_by = None

    return _insert_job(
        target,
        label,
        started_by=started_by,
        total_steps=total,
        step=step,
        step_label=step_label,
    )


def finish_scan_step(job: dict[str, Any], *, target: str, region: str) -> dict[str, Any]:
    step, step_label, is_final = _step_info(target, region)
    return _update_job(str(job["id"]), step=step, step_label=step_label, is_final=is_final)


def attach_scan_job(payload: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
    out = dict(payload)
    out["scanJob"] = public_job(job)
    return out


def get_scan_status() -> dict[str, Any]:
    running = get_running_job()
    return {
        "activeJob": public_job(running),
        "busy": bool(running),
    }


def get_last_updated_meta() -> dict[str, str | None]:
    from pathlib import Path

    from stock_snapshot_store import list_global_snapshot_meta, pick_newer_timestamp

    root = Path(__file__).resolve().parent.parent
    out: dict[str, str | None] = {}
    global_meta = list_global_snapshot_meta()

    def _read_updated(path: Path) -> str | None:
        if not path.is_file():
            return None
        try:
            import json

            data = json.loads(path.read_text(encoding="utf-8"))
            return (
                data.get("updatedAt")
                or data.get("updatedAtKst")
                or data.get("updatedAtNy")
                or data.get("savedAt")
            )
        except Exception:
            return None

    out["recommend2"] = pick_newer_timestamp(
        _read_updated(root / "data" / "recommend2-bottom-accumulation.json"),
        global_meta.get("recommend2"),
    )

    strategy_files = {
        "golden-cross": "stock-strategy-golden.json",
        "bollinger": "stock-strategy-bollinger.json",
        "rsi-divergence": "stock-strategy-rsi.json",
        "candle-support": "stock-strategy-candle-support.json",
        "obv-divergence": "stock-strategy-obv.json",
        "bottom-pattern": "stock-strategy-bottom.json",
        "vcp": "stock-strategy-vcp.json",
    }
    for key, fname in strategy_files.items():
        out[key] = pick_newer_timestamp(
            _read_updated(root / "data" / fname),
            global_meta.get(key),
        )

    out["fundamentals"] = pick_newer_timestamp(
        _read_updated(root / "data" / "stock-fundamentals.json"),
        global_meta.get("fundamentals"),
    )

    out["quality-score"] = pick_newer_timestamp(
        _read_updated(root / "data" / "stock-quality-score.json"),
        global_meta.get("quality-score"),
    )

    out["long-term-screens"] = global_meta.get("long-term-screens")

    out["sentiment"] = _read_updated(root / "data" / "stock-picks.json")
    return out


def get_scan_meta() -> dict[str, Any]:
    return {
        **get_scan_status(),
        "lastUpdated": get_last_updated_meta(),
    }


def touch_cron_scan(
    target: str,
    *,
    step: int,
    total_steps: int,
    step_label: str,
    session_start: bool = False,
    session_complete: bool = False,
) -> dict[str, Any] | None:
    """GitHub Actions cron — Supabase running job for cross-tab/device UI."""
    label = target_label(target)
    running = get_running_job()

    if session_complete:
        if running and running.get("target") == target:
            return _update_job(
                str(running["id"]),
                step=max(step, int(running.get("step") or step)),
                step_label=step_label or "완료",
                is_final=True,
            )
        return running

    if running:
        if running.get("target") != target:
            return None
        return _update_job(
            str(running["id"]),
            step=step,
            step_label=step_label,
            is_final=False,
        )

    if not session_start:
        return None

    try:
        return _insert_job(
            target,
            label,
            started_by=None,
            total_steps=total_steps,
            step=step,
            step_label=step_label,
        )
    except ScanBusy:
        running = get_running_job()
        if running and running.get("target") == target:
            return _update_job(
                str(running["id"]),
                step=step,
                step_label=step_label,
                is_final=False,
            )
        return None
