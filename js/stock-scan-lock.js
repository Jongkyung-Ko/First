/**
 * Stock Picks Re — 전역 스캔 락 (1건 running) · 짧은 안내 토스트 · 마지막 갱신 메타
 */
(function () {
  const POLL_MS = 2000;
  const FORCE_FETCH_TIMEOUT_MS = 360000;
  const LIVE_SCAN_STEPS = [
    { region: "kospi", label: "KOSPI" },
    { region: "kosdaq", label: "KOSDAQ" },
    { region: "nasdaq", label: "NASDAQ" },
    { region: "nyse", label: "NYSE" }
  ];

  const PAGE_TARGET = {
    "stock-picks": "sentiment",
    recommend2: "recommend2",
    "strategy-golden": "golden-cross",
    "strategy-bollinger": "bollinger",
    "strategy-rsi": "rsi-divergence",
    "strategy-candle-support": "candle-support",
    "strategy-obv": "obv-divergence",
    "strategy-bottom": "bottom-pattern",
    "strategy-vcp": "vcp"
  };

  let metaCache = { lastUpdated: {}, activeJob: null, busy: false };
  let pollTimer = null;
  let clientScanRunning = false;
  const statusWatchers = new Set();

  function schedulePollInterval() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      void refreshMeta();
    }, metaCache.busy ? POLL_MS : 30000);
  }

  function notifyStatusWatchers() {
    statusWatchers.forEach((fn) => {
      try {
        fn(metaCache);
      } catch {
        /* DOM detached */
      }
    });
  }

  /** 탭 이탈 시에도 Re HTTP 유지 (전역 스캔·다른 탭 표시용) */
  function shouldKeepLiveScan() {
    return clientScanRunning || !!metaCache.busy;
  }

  /**
   * 전역 스캔 중 status 한 줄 갱신 (모든 접속자·탭 공통 meta)
   * @returns {() => void} unbind
   */
  function bindScanStatus(setStatusFn) {
    if (typeof setStatusFn !== "function") return () => {};
    const apply = (meta = metaCache) => {
      if (!meta?.busy || !meta.activeJob) {
        setStatusFn("", null, false);
        return false;
      }
      const job = meta.activeJob;
      const msg = job.message || `${job.targetLabel || "스캔"} 스캔 중…`;
      setStatusFn(msg, "info", true);
      return true;
    };
    statusWatchers.add(apply);
    void refreshMeta().then(() => apply());
    return () => statusWatchers.delete(apply);
  }

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function getAuthHeaders() {
    const token = window.Auth?.getSession?.()?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function formatShortUpdated(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd} ${hh}:${mi}`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function fetchJson(path, { signal } = {}) {
    const base = getApiBase();
    if (!base) throw new Error("STOCK_API_URL이 설정되지 않았습니다.");
    const res = await fetch(`${base}${path}`, {
      signal,
      headers: { ...getAuthHeaders() }
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) {
      const err = new Error(body?.detail?.message || "이미 스캔 중입니다.");
      err.code = "scan_busy";
      err.job = body?.detail?.job || null;
      err.detail = body?.detail;
      throw err;
    }
    if (!res.ok) {
      const msg = typeof body?.detail === "string" ? body.detail : body?.detail?.message;
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return body;
  }

  async function refreshMeta() {
    try {
      metaCache = await fetchJson("/api/stock-picks/scan/meta");
    } catch {
      /* ignore */
    }
    applyNavUpdatedTimes();
    notifyStatusWatchers();
    schedulePollInterval();
    return metaCache;
  }

  function getActiveJob() {
    return metaCache.activeJob || null;
  }

  function getLastUpdatedForPage(pageId) {
    const key = PAGE_TARGET[pageId];
    if (!key) return null;
    if (key === "sentiment") {
      return metaCache.lastUpdated?.sentiment || null;
    }
    return metaCache.lastUpdated?.[key] || null;
  }

  function applyNavUpdatedTimes() {
    document.querySelectorAll(".stock-strategy-nav-btn[data-page]").forEach((btn) => {
      const pageId = btn.dataset.page;
      const iso = getLastUpdatedForPage(pageId);
      let el = btn.querySelector(".stock-nav-updated-at");
      if (!iso) {
        el?.remove();
        return;
      }
      if (!el) {
        el = document.createElement("span");
        el.className = "stock-nav-updated-at";
        btn.appendChild(el);
      }
      el.textContent = formatShortUpdated(iso);
      el.title = `마지막 갱신: ${iso}`;
    });
  }

  /** Re 클릭 시에만 — 화면 막지 않고 짧은 토스트 */
  function notifyScanBusy(job) {
    const detail = job?.message || job?.targetLabel;
    const msg = detail
      ? `이미 스캔 중입니다. (${detail}) 다른 메뉴는 그대로 보실 수 있습니다.`
      : "이미 스캔 중입니다. 완료 후 Re를 다시 눌러 주세요.";
    if (window.Digimon?.showNotice) {
      window.Digimon.showNotice(msg, "info");
    } else {
      console.info(msg);
    }
  }

  function blockedResult() {
    return { blocked: true, joined: false, payload: null };
  }

  function appendScanParams(url, scanJobId) {
    const u = new URL(url, window.location.href);
    if (scanJobId) u.searchParams.set("scan_job_id", scanJobId);
    return u.href;
  }

  async function fetchForceUrl(url, { scanJobId, signal, timeoutMs = FORCE_FETCH_TIMEOUT_MS } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    try {
      const res = await fetch(appendScanParams(url, scanJobId), {
        signal: controller.signal,
        headers: { ...getAuthHeaders() }
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const err = new Error(body?.detail?.message || "이미 스캔 중입니다.");
        err.code = "scan_busy";
        err.job = body?.detail?.job || null;
        throw err;
      }
      if (!res.ok) {
        const msg = typeof body?.detail === "string" ? body.detail : body?.detail?.message;
        throw new Error(msg || `HTTP ${res.status}`);
      }
      return body;
    } catch (err) {
      if (err.name === "AbortError") {
        const minutes = Math.round(timeoutMs / 60000);
        throw new Error(
          `요청 시간 초과 (약 ${minutes}분). 서버에서 아직 스캔 중일 수 있습니다. 잠시 후 다시 확인해 주세요.`
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  }

  /**
   * Re 직전 호출 — busy면 토스트만 띄우고 false
   */
  async function guardReClick() {
    await refreshMeta();
    if (!metaCache.busy) return true;
    notifyScanBusy(metaCache.activeJob);
    return false;
  }

  /**
   * @param {object} opts
   * @param {(region:string, scanJobId:string|null)=>string} opts.buildUrl
   * @param {AbortSignal} [opts.signal]
   * @param {(p:{step:number,total:number,label:string})=>void} [opts.onProgress]
   * @param {(partial:object)=>void} [opts.onPartial]
   */
  async function runLiveScan(opts) {
    const steps = opts.steps || LIVE_SCAN_STEPS;
    let scanJobId = null;
    let payload = null;
    clientScanRunning = true;

    try {
      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        opts.onProgress?.({
          step: i + 1,
          total: steps.length,
          region: step.region,
          label: step.label
        });

        try {
          const url = opts.buildUrl(step.region, scanJobId);
          payload = await fetchForceUrl(url, { scanJobId, signal: opts.signal });
          scanJobId = payload?.scanJob?.id || scanJobId;
          if (payload) opts.onPartial?.(payload);

          if (!payload?.scanRegion && marketsComplete(payload, steps)) {
            break;
          }
          if (payload?.scanRegion === step.region) {
            continue;
          }
          if (marketsComplete(payload, steps)) {
            break;
          }
        } catch (err) {
          if (err.code === "scan_busy") {
            notifyScanBusy(err.job);
            return blockedResult();
          }
          throw err;
        }
      }
    } finally {
      clientScanRunning = false;
    }

    await refreshMeta();
    return { blocked: false, joined: false, payload };
  }

  function marketsComplete(payload, steps) {
    return steps.every((step) => {
      const market = payload?.markets?.[step.region];
      return market && (typeof market.signalCount === "number" || typeof market.recentCount === "number");
    });
  }

  function renderUpdatedLine(iso, prefix) {
    if (!iso) return "";
    const p = prefix || "마지막 갱신";
    return `${p}: <span class="stock-picks-updated-at">${escapeHtml(formatShortUpdated(iso))}</span>`;
  }

  function startMetaPolling() {
    void refreshMeta();
  }

  function stopMetaPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function isBusy() {
    return !!metaCache.busy;
  }

  function hideJoinOverlay() {
    /* 이전 전체 화면 오버레이 제거 */
    document.getElementById("stock-scan-join-overlay")?.remove();
  }

  window.StockScanLock = {
    LIVE_SCAN_STEPS,
    PAGE_TARGET,
    FORCE_FETCH_TIMEOUT_MS,
    getApiBase,
    getAuthHeaders,
    formatShortUpdated,
    renderUpdatedLine,
    refreshMeta,
    getActiveJob,
    getLastUpdatedForPage,
    applyNavUpdatedTimes,
    notifyScanBusy,
    guardReClick,
    runLiveScan,
    fetchForceUrl,
    isBusy,
    shouldKeepLiveScan,
    bindScanStatus,
    hideJoinOverlay,
    startMetaPolling,
    stopMetaPolling
  };
})();
