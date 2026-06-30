(function () {
  function swScope() {
    return location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  }

  function swScriptUrl() {
    return swScope() + "sw.js";
  }

  function canUseServiceWorker() {
    return "serviceWorker" in navigator && location.protocol !== "file:";
  }

  async function clearAllCaches() {
    if (!("caches" in window)) return;
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }

  function renderAppVersion() {
    const version = Number(window.APP_VERSION);
    const label = Number.isFinite(version) && version > 0 ? `v${version}` : "v?";
    const el = document.getElementById("app-version-label");
    if (el) el.textContent = label;
    const btn = document.getElementById("app-update-btn");
    if (btn) btn.title = `최신 버전 불러오기 (현재 ${label})`;
  }

  async function forceUpdate() {
    const btn = document.getElementById("app-update-btn");
    if (btn) {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
    }

    try {
      if (canUseServiceWorker()) {
        const reg = await navigator.serviceWorker.getRegistration(swScope());
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        await reg?.update();
      }
      await clearAllCaches();

      const url = new URL(location.href);
      url.searchParams.set("v", String(Date.now()));
      location.replace(url.toString());
    } catch (err) {
      console.warn("App update failed:", err);
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
      }
      location.reload();
    }
  }

  function hideToast() {
    const toast = document.getElementById("pwa-update-toast");
    if (toast) toast.hidden = true;
  }

  function showUpdateToast() {
    let toast = document.getElementById("pwa-update-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "pwa-update-toast";
      toast.className = "pwa-toast";
      toast.innerHTML = `
        <p class="pwa-toast-text">새 버전이 있습니다.</p>
        <div class="pwa-toast-actions">
          <button type="button" class="pwa-toast-btn pwa-toast-btn--primary" id="pwa-update-apply">업데이트</button>
          <button type="button" class="pwa-toast-btn" id="pwa-update-dismiss">나중에</button>
        </div>
      `;
      document.body.appendChild(toast);
      document.getElementById("pwa-update-apply")?.addEventListener("click", () => void forceUpdate());
      document.getElementById("pwa-update-dismiss")?.addEventListener("click", hideToast);
    }
    toast.hidden = false;
  }

  async function registerServiceWorker() {
    if (!canUseServiceWorker()) return;

    try {
      const reg = await navigator.serviceWorker.register(swScriptUrl(), { scope: swScope() });

      if (reg.waiting && navigator.serviceWorker.controller) {
        showUpdateToast();
      }

      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast();
          }
        });
      });
    } catch (err) {
      console.warn("Service worker registration failed:", err);
    }
  }

  function bindUi() {
    renderAppVersion();
    document.getElementById("app-update-btn")?.addEventListener("click", () => void forceUpdate());
  }

  window.AppPWA = { forceUpdate };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindUi();
      void registerServiceWorker();
    });
  } else {
    bindUi();
    void registerServiceWorker();
  }
})();
