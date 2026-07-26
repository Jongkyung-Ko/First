(function () {
  let deferredInstallPrompt = null;
  let installBound = false;

  function swScope() {
    return location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  }

  function swScriptUrl() {
    return swScope() + "sw.js";
  }

  function canUseServiceWorker() {
    return "serviceWorker" in navigator && location.protocol !== "file:";
  }

  function isStandaloneDisplay() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIosSafari() {
    const ua = navigator.userAgent || "";
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const webkit = /WebKit/i.test(ua);
    const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Android/i.test(ua);
    return iOS && webkit && (notOther || /Safari/i.test(ua));
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

  function setHint(text, visible) {
    const hint = document.getElementById("pwa-install-hint");
    if (!hint) return;
    if (text) hint.textContent = text;
    hint.hidden = !visible;
  }

  function refreshInstallUi() {
    const wrap = document.getElementById("pwa-install-wrap");
    const btn = document.getElementById("pwa-install-btn");
    if (!wrap || !btn) return;

    if (isStandaloneDisplay()) {
      wrap.hidden = true;
      setHint("", false);
      return;
    }

    wrap.hidden = false;
    btn.disabled = false;

    if (deferredInstallPrompt) {
      btn.textContent = "앱으로 저장";
      setHint("홈 화면에 Digital World를 추가합니다.", true);
      return;
    }

    if (isIosSafari()) {
      btn.textContent = "앱으로 저장하는 방법";
      setHint("공유 버튼(□↑) → '홈 화면에 추가'를 선택하세요.", true);
      return;
    }

    btn.textContent = "앱으로 저장";
    setHint("브라우저 메뉴에서 '앱 설치' 또는 '홈 화면에 추가'를 선택하세요.", true);
  }

  async function promptInstall() {
    const btn = document.getElementById("pwa-install-btn");

    if (isStandaloneDisplay()) {
      setHint("이미 앱으로 실행 중입니다.", true);
      return;
    }

    if (deferredInstallPrompt) {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      if (btn) btn.disabled = true;
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === "accepted") {
          setHint("앱이 설치되었습니다.", true);
          const wrap = document.getElementById("pwa-install-wrap");
          if (wrap) wrap.hidden = true;
          return;
        }
        setHint("설치가 취소되었습니다. 나중에 다시 시도할 수 있습니다.", true);
      } catch (err) {
        console.warn("PWA install prompt failed:", err);
        setHint("설치를 열지 못했습니다. 브라우저 메뉴의 앱 설치를 이용해 주세요.", true);
      } finally {
        if (btn) btn.disabled = false;
        refreshInstallUi();
      }
      return;
    }

    if (isIosSafari()) {
      setHint("공유 버튼(□↑)을 누른 뒤 '홈 화면에 추가'를 선택하세요.", true);
      return;
    }

    setHint("브라우저 주소창 옆 설치 아이콘, 또는 메뉴의 '앱 설치' / '홈 화면에 추가'를 이용하세요.", true);
  }

  function bindInstallUi() {
    if (installBound) {
      refreshInstallUi();
      return;
    }
    installBound = true;

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      refreshInstallUi();
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      const wrap = document.getElementById("pwa-install-wrap");
      if (wrap) wrap.hidden = true;
      setHint("", false);
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest("#pwa-install-btn");
      if (!btn) return;
      event.preventDefault();
      void promptInstall();
    });

    refreshInstallUi();
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
    bindInstallUi();
  }

  window.AppPWA = { forceUpdate, refreshInstallUi, promptInstall };

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
