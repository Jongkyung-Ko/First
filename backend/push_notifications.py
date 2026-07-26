"""Web Push — subscriptions storage and delivery."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from predictions import _supabase_client

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:master@digitalworld.local").strip()


def vapid_configured() -> bool:
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


def get_vapid_public_key() -> str:
    return VAPID_PUBLIC_KEY


def _service_client():
    client = _supabase_client()
    if client is None:
        raise RuntimeError(
            "Supabase service role가 설정되지 않았습니다 (SUPABASE_SERVICE_ROLE_KEY)."
        )
    return client


def _wrap_db_error(exc: Exception) -> RuntimeError:
    msg = str(exc)
    if "push_subscriptions" in msg and (
        "does not exist" in msg.lower() or "schema cache" in msg.lower()
    ):
        return RuntimeError(
            "push_subscriptions 테이블이 없습니다. Supabase SQL Editor에서 "
            "supabase/push_subscriptions.sql 을 실행해 주세요."
        )
    return RuntimeError(msg)


def user_region_enabled(user_id: str, region: str) -> bool:
    try:
        client = _service_client()
        column = "kr_enabled" if region == "kr" else "us_enabled"
        resp = (
            client.table("push_subscriptions")
            .select("id")
            .eq("user_id", user_id)
            .eq(column, True)
            .limit(1)
            .execute()
        )
        return bool(resp.data)
    except Exception:
        return False


def upsert_subscription(
    user_id: str,
    endpoint: str,
    p256dh: str,
    auth_key: str,
    *,
    kr_enabled: bool | None = None,
    us_enabled: bool | None = None,
) -> dict[str, Any]:
    client = _service_client()
    now = datetime.now(timezone.utc).isoformat()

    existing = (
        client.table("push_subscriptions")
        .select("id,user_id,kr_enabled,us_enabled")
        .eq("endpoint", endpoint)
        .limit(1)
        .execute()
    )
    rows = existing.data or []

    if rows:
        row = rows[0]
        if row.get("user_id") and str(row.get("user_id")) != str(user_id):
            raise PermissionError("Subscription belongs to another user")
        patch: dict[str, Any] = {
            "user_id": user_id,
            "p256dh": p256dh,
            "auth_key": auth_key,
            "updated_at": now,
        }
        if kr_enabled is not None:
            patch["kr_enabled"] = kr_enabled
        if us_enabled is not None:
            patch["us_enabled"] = us_enabled
        try:
            client.table("push_subscriptions").update(patch).eq("endpoint", endpoint).execute()
        except Exception as exc:
            raise _wrap_db_error(exc) from exc
    else:
        try:
            client.table("push_subscriptions").insert(
                {
                    "user_id": user_id,
                    "endpoint": endpoint,
                    "p256dh": p256dh,
                    "auth_key": auth_key,
                    "kr_enabled": bool(kr_enabled),
                    "us_enabled": bool(us_enabled),
                    "updated_at": now,
                }
            ).execute()
        except Exception as exc:
            raise _wrap_db_error(exc) from exc

    return get_subscription_status(user_id)


def set_region_enabled(user_id: str, region: str, enabled: bool) -> dict[str, Any]:
    client = _service_client()
    column = "kr_enabled" if region == "kr" else "us_enabled"
    now = datetime.now(timezone.utc).isoformat()
    client.table("push_subscriptions").update({column: enabled, "updated_at": now}).eq(
        "user_id", user_id
    ).execute()
    return get_subscription_status(user_id)


def delete_subscription(user_id: str, endpoint: str) -> dict[str, Any]:
    client = _service_client()
    client.table("push_subscriptions").delete().eq("user_id", user_id).eq(
        "endpoint", endpoint
    ).execute()
    return get_subscription_status(user_id)


def get_subscription_status(user_id: str) -> dict[str, Any]:
    client = _service_client()
    try:
        resp = (
            client.table("push_subscriptions")
            .select("endpoint,kr_enabled,us_enabled,updated_at")
            .eq("user_id", user_id)
            .execute()
        )
        rows = resp.data or []
    except Exception:
        rows = []

    kr = any(bool(r.get("kr_enabled")) for r in rows)
    us = any(bool(r.get("us_enabled")) for r in rows)
    return {
        "subscribed": len(rows) > 0,
        "deviceCount": len(rows),
        "krEnabled": kr,
        "usEnabled": us,
        "pushReady": vapid_configured(),
    }


def list_subscriptions_for_region(region: str, *, user_id: str | None = None) -> list[dict[str, Any]]:
    client = _service_client()
    column = "kr_enabled" if region == "kr" else "us_enabled"
    query = (
        client.table("push_subscriptions")
        .select("id,user_id,endpoint,p256dh,auth_key,kr_enabled,us_enabled")
        .eq(column, True)
    )
    if user_id:
        query = query.eq("user_id", user_id)
    resp = query.execute()
    return resp.data or []


def _send_one(sub: dict[str, Any], payload: dict[str, Any]) -> bool:
    if not vapid_configured():
        raise RuntimeError("VAPID keys are not configured on the server")

    from pywebpush import WebPushException, webpush

    subscription_info = {
        "endpoint": sub["endpoint"],
        "keys": {"p256dh": sub["p256dh"], "auth": sub["auth_key"]},
    }
    data = json.dumps(
        {
            "title": payload.get("title"),
            "body": payload.get("body"),
            "url": payload.get("url"),
            "tag": payload.get("tag"),
        },
        ensure_ascii=False,
    )
    try:
        webpush(
            subscription_info=subscription_info,
            data=data,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
        )
        return True
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None) if exc.response else None
        if status in (404, 410):
            try:
                _service_client().table("push_subscriptions").delete().eq("id", sub["id"]).execute()
            except Exception:
                pass
        return False


def send_digest_to_subscriptions(
    region: str,
    notification_payload: dict[str, Any],
    *,
    user_id: str | None = None,
) -> dict[str, Any]:
    subs = list_subscriptions_for_region(region, user_id=user_id)
    success = 0
    for sub in subs:
        if _send_one(sub, notification_payload):
            success += 1
    return {
        "region": region,
        "subscriberCount": len(subs),
        "successCount": success,
    }


def get_last_digest_log(region: str) -> dict[str, Any] | None:
    try:
        client = _service_client()
        resp = (
            client.table("notification_digest_log")
            .select("region,trade_date,sent_at,subscriber_count,success_count")
            .eq("region", region)
            .order("sent_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None
    except Exception:
        return None


def log_digest_send(region: str, trade_date: str, digest: dict[str, Any], result: dict[str, Any]) -> None:
    try:
        client = _service_client()
        client.table("notification_digest_log").upsert(
            {
                "region": region,
                "trade_date": trade_date,
                "digest_json": digest,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "subscriber_count": result.get("subscriberCount", 0),
                "success_count": result.get("successCount", 0),
            },
            on_conflict="region,trade_date",
        ).execute()
    except Exception:
        pass
