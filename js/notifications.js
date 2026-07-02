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
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `VAPID 키 로드 실패 (HTTP ${res.status})`);
    }
    const data = await res.json();
    if (!data.publicKey) throw new Error("VAPID 공개키가 없습니다.");
    return data.publicKey;
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
    if (!res.ok) {
      throw new Error(`상태 조회 실패 (HTTP ${res.status})`);
    }
    const data = await res.json();
    return { ...data, supported: supportsPush() };
  }

  async function subscribeRegion(region) {
    if (!supportsPush()) {
      throw new Error("이 브라우저는 Web Push를 지원하지 않습니다. PWA로 설치한 Chrome·Edge를 권장합니다.");
    }
    if (!window.Auth?.getSession?.()) {
      throw new Error("로그인이 필요합니다.");
    }

    const spend = await window.Digimon?.spendForStockNotification?.(region);
    if (!spend?.ok) {
      throw new Error(spend?.error || "Digi-Mon 차감에 실패했습니다.");
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
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `구독 저장 실패 (HTTP ${res.status})`);
    }
    return res.json();
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
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `설정 변경 실패 (HTTP ${res.status})`);
    }
    return res.json();
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
      throw new Error(body.detail || `테스트 발송 실패 (HTTP ${res.status})`);
    }
    return body;
  }

  window.StockNotifications = {
    REGION_LABELS,
    supportsPush,
    getStatus,
    subscribeRegion,
    disableRegion,
    sendTest
  };
})();
