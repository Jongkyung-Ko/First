/**
 * Stock Picks Web Push notifications
 */
(function () {
  const REGION_LABELS = { kr: "한국장", us: "미국장" };

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function apiErrorMessage(res, body, fallback) {
    const detail = body?.detail;
    if (res.status === 404) {
      return (
        "알림 API를 찾을 수 없습니다 (404). Render에 최신 백엔드가 배포되었는지 확인하세요."
      );
    }
    if (res.status === 503 && detail) {
      return String(detail);
    }
    if (res.status === 402) {
      return detail || "Digi-Mon이 부족합니다.";
    }
    if (detail) return String(detail);
    return fallback || `요청 실패 (HTTP ${res.status})`;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function swScope() {
    return location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  }

  function authHeaders() {
    const session = window.Auth?.getSession?.();
    const token = session?.access_token;
    if (!token) return null;
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  function supportsPush() {
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      location.protocol !== "file:"
    );
  }

  async function fetchVapidPublicKey() {
    const base = getApiBase();
    if (!base) throw new Error("API URL이 설정되지 않았습니다.");
    const res = await fetch(`${base}/api/notifications/vapid-public-key`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(apiErrorMessage(res, body, "VAPID 키 로드 실패"));
    }
    if (!body.publicKey) throw new Error("VAPID 공개키가 없습니다.");
    return body.publicKey;
  }

  async function ensureServiceWorker() {
    const reg = await navigator.serviceWorker.register(swScope() + "sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  }

  async function getStatus() {
    const headers = authHeaders();
    const base = getApiBase();
    if (!headers || !base) {
      return {
        subscribed: false,
        krEnabled: false,
        usEnabled: false,
        pushReady: false,
        vapidConfigured: false,
        supported: supportsPush()
      };
    }
    const res = await fetch(`${base}/api/notifications/status`, { headers, cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(apiErrorMessage(res, body, "상태 조회 실패"));
    }
    return { ...body, supported: supportsPush() };
  }

  async function subscribeRegion(region) {
    if (!supportsPush()) {
      throw new Error("이 브라우저는 Web Push를 지원하지 않습니다. PWA로 설치한 Chrome·Edge를 권장합니다.");
    }
    if (!window.Auth?.getSession?.()) {
      throw new Error("로그인이 필요합니다.");
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("알림 권한이 거부되었습니다.");
    }

    const publicKey = await fetchVapidPublicKey();
    const reg = await ensureServiceWorker();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    const json = sub.toJSON();
    const headers = authHeaders();
    const base = getApiBase();
    if (!headers || !base) throw new Error("API 연결 실패");

    const res = await fetch(`${base}/api/notifications/subscribe`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        region
      })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(apiErrorMessage(res, body, "구독 저장 실패"));
    }

    if (body.dmSpent) {
      await window.Digimon?.refresh?.();
    }
    return body;
  }

  async function disableRegion(region) {
    const headers = authHeaders();
    const base = getApiBase();
    if (!headers || !base) throw new Error("로그인이 필요합니다.");
    const res = await fetch(`${base}/api/notifications/preferences`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ region, enabled: false })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(apiErrorMessage(res, body, "설정 변경 실패"));
    }
    return body;
  }

  async function sendTest(region) {
    const headers = authHeaders();
    const base = getApiBase();
    if (!headers || !base) throw new Error("로그인이 필요합니다.");
    const res = await fetch(`${base}/api/notifications/test?region=${encodeURIComponent(region)}`, {
      method: "POST",
      headers
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(apiErrorMessage(res, body, "테스트 발송 실패"));
    }
    return body;
  }

  async function getLastDigest(region) {
    const base = getApiBase();
    if (!base) return null;
    const res = await fetch(`${base}/api/notifications/last-digest?region=${encodeURIComponent(region)}`, {
      cache: "no-store"
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    return body.last || null;
  }

  function formatDigestLog(row) {
    if (!row?.sent_at) return null;
    const d = new Date(row.sent_at);
    if (Number.isNaN(d.getTime())) return null;
    const when = d.toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    const ok = Number(row.success_count) || 0;
    const subs = Number(row.subscriber_count) || 0;
    return `${when} · 발송 ${ok}/${subs}`;
  }

  window.StockNotifications = {
    REGION_LABELS,
    supportsPush,
    getStatus,
    getLastDigest,
    formatDigestLog,
    subscribeRegion,
    disableRegion,
    sendTest
  };
})();
