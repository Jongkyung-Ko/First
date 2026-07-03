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
    "strategy-vcp": "vcp",
    "fundamentals-per": "fundamentals",
    "fundamentals-roe": "fundamentals",
    "fundamentals-pbr": "fundamentals",
    "fundamentals-dividend": "fundamentals",
    "long-term-small-cap-pbr": "long-term-screens",
    "long-term-magic-formula": "long-term-screens",
    "long-term-f-score": "long-term-screens",
    "long-term-screens": "long-term-screens"
  };

  const LAST_UPDATED_LS_KEY = "dw_stock_nav_last_updated_v1";

  let metaCache = {
    lastUpdated: readPersistedLastUpdated(),
    activeJob: null,
    busy: false
  };
  let pollTimer = null;
  let clientScanRunning = false;
  let clientScanPageId = null;
  const statusWatchers = new Set();

  function isFundamentalsPage(pageId) {
    return !!pageId && String(pageId).startsWith("fundamentals-");
  }

  function jobMatchesPage(pageId, job) {
    if (!pageId || !job?.target) return false;
    const expected = PAGE_TARGET[pageId];
    if (!expected) return false;
    if (job.target === expected) return true;
    if (job.target === "fundamentals" && isFundamentalsPage(pageId)) return true;
    if (expected === "sentiment" && String(job.target).startsWith("sentiment:")) return true;
    return false;
  }

  function isScanActiveForPage(pageId) {
    if (clientScanRunning && clientScanPageId) {
      return !pageId || pageId === clientScanPageId;
    }
    if (!pageId || !metaCache.busy || !metaCache.activeJob) return false;
    return jobMatchesPage(pageId, metaCache.activeJob);
  }

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

  /** 탭 이탈 시에도 Re HTTP 유지 — 해당 페이지에서 시작한 스캔만 */
  function shouldKeepLiveScan(pageId) {
    if (clientScanRunning) {
      if (!clientScanPageId) return true;
      if (!pageId) return true;
      if (isFundamentalsPage(pageId) && isFundamentalsPage(clientScanPageId)) return true;
      return pageId === clientScanPageId;
    }
    return isScanActiveForPage(pageId);
  }

  function jobStartedMs(job) {
    if (!job?.startedAt) return null;
    const t = new Date(job.startedAt).getTime();
    return Number.isNaN(t) ? null : t;
  }

  /**
   * 전역 스캔 중 status — activeJob.target이 일치하는 페이지만 표시
   * @param {string} pageId
   * @param {(msg:string, kind:string|null, busy:boolean, startedAtMs:number|null)=>void} setStatusFn
   * @returns {() => void} unbind
   */
  function bindScanStatus(pageId, setStatusFn) {
    if (typeof setStatusFn !== "function") return () => {};
    const apply = (meta = metaCache) => {
      if (!meta?.busy || !meta.activeJob || !jobMatchesPage(pageId, meta.activeJob)) {
        setStatusFn("", null, false, null);
        return false;
      }
      const job = meta.activeJob;
      const msg = job.message || `${job.targetLabel || "스캔"} 스캔 중…`;
      setStatusFn(msg, "info", true, jobStartedMs(job));
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
    if (!iso) return "--/-- --:--";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
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
    const priorLastUpdated = mergeLastUpdatedMaps(
      readPersistedLastUpdated(),
      metaCache.lastUpdated || {}
    );
    let remote = null;
    try {
      remote = await fetchJson("/api/stock-picks/scan/meta");
    } catch {
      remote = null;
    }
    metaCache = {
      activeJob: remote?.activeJob ?? null,
      busy: remote?.busy ?? false,
      lastUpdated: mergeLastUpdatedMaps(priorLastUpdated, remote?.lastUpdated || {})
    };
    await mergeStaticMetaTimes();
    persistLastUpdatedMeta();
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

  const STATIC_META_PATHS = {
    recommend2: window.RECOMMEND2_JSON_URL || "data/recommend2-bottom-accumulation.json",
    "golden-cross": window.STOCK_STRATEGY_GOLDEN_JSON_URL || "data/stock-strategy-golden.json",
    bollinger: window.STOCK_STRATEGY_BOLLINGER_JSON_URL || "data/stock-strategy-bollinger.json",
    "rsi-divergence": window.STOCK_STRATEGY_RSI_JSON_URL || "data/stock-strategy-rsi.json",
    "candle-support":
      window.STOCK_STRATEGY_CANDLE_JSON_URL || "data/stock-strategy-candle-support.json",
    "obv-divergence": window.STOCK_STRATEGY_OBV_JSON_URL || "data/stock-strategy-obv.json",
    "bottom-pattern": window.STOCK_STRATEGY_BOTTOM_JSON_URL || "data/stock-strategy-bottom.json",
    vcp: window.STOCK_STRATEGY_VCP_JSON_URL || "data/stock-strategy-vcp.json",
    fundamentals: window.STOCK_FUNDAMENTALS_JSON_URL || "data/stock-fundamentals.json",
    sentiment: window.STOCK_PICKS_JSON_URL || "data/stock-picks.json"
  };

  function mergeUpdatedAt(a, b) {
    if (!a) return b || null;
    if (!b) return a || null;
    const ta = Date.parse(a) || 0;
    const tb = Date.parse(b) || 0;
    return tb >= ta ? b : a;
  }

  function readPersistedLastUpdated() {
    try {
      const raw = localStorage.getItem(LAST_UPDATED_LS_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function writePersistedLastUpdated(map) {
    try {
      if (!map || typeof map !== "object") return;
      localStorage.setItem(LAST_UPDATED_LS_KEY, JSON.stringify(map));
    } catch {
      /* storage full or disabled */
    }
  }

  function mergeLastUpdatedMaps(...maps) {
    const out = {};
    for (const map of maps) {
      if (!map || typeof map !== "object") continue;
      for (const [key, iso] of Object.entries(map)) {
        if (!iso) continue;
        out[key] = mergeUpdatedAt(out[key], iso);
      }
    }
    return out;
  }

  function payloadUpdatedIso(payload) {
    if (!payload || typeof payload !== "object") return null;
    return (
      payload.updatedAtNy ||
      payload.updatedAtKst ||
      payload.updatedAt ||
      payload.savedAt ||
      null
    );
  }

  function shouldRecordPayload(payload) {
    if (!payload || payload.empty === true || payload.source === "placeholder") return false;
    return !!payloadUpdatedIso(payload);
  }

  function recordLastUpdated(key, iso) {
    if (!key || !iso) return;
    const next = mergeLastUpdatedMaps(readPersistedLastUpdated(), metaCache.lastUpdated, {
      [key]: iso
    });
    metaCache = { ...metaCache, lastUpdated: next };
    writePersistedLastUpdated(next);
    applyNavUpdatedTimes();
  }

  function recordPagePayload(pageId, payload) {
    const key = PAGE_TARGET[pageId];
    if (!key || !shouldRecordPayload(payload)) return;
    recordLastUpdated(key, payloadUpdatedIso(payload));
  }

  function persistLastUpdatedMeta() {
    const next = mergeLastUpdatedMaps(readPersistedLastUpdated(), metaCache.lastUpdated);
    metaCache = { ...metaCache, lastUpdated: next };
    writePersistedLastUpdated(next);
  }

  async function mergeStaticMetaTimes() {
    const loader = window.SnapshotFirstLoad;
    if (!loader?.fetchStaticUpdatedAt) return;
    const next = { ...(metaCache.lastUpdated || {}) };
    const entries = Object.entries(STATIC_META_PATHS);
    await Promise.all(
      entries.map(async ([key, path]) => {
        const iso = await loader.fetchStaticUpdatedAt(path);
        if (iso) next[key] = mergeUpdatedAt(next[key], iso);
      })
    );
    metaCache = { ...metaCache, lastUpdated: next };
    persistLastUpdatedMeta();
  }

  function applyNavUpdatedTimes() {
    document.querySelectorAll(".stock-strategy-nav-btn[data-page]").forEach((btn) => {
      const pageId = btn.dataset.page;
      const iso = getLastUpdatedForPage(pageId);
      let el = btn.querySelector(".stock-nav-updated-at");
      if (!el) {
        el = document.createElement("span");
        el.className = "stock-nav-updated-at";
        btn.appendChild(el);
      }
      if (!iso) {
        el.textContent = "--/-- --:--";
        el.title = "아직 갱신 기록 없음";
        el.classList.add("stock-nav-updated-at--empty");
        el.setAttribute("aria-label", "갱신 일시 없음");
        return;
      }
      el.textContent = formatShortUpdated(iso);
      el.title = `마지막 갱신: ${iso}`;
      el.classList.remove("stock-nav-updated-at--empty");
      el.removeAttribute("aria-label");
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
    clientScanPageId = opts.pageId || null;

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
      clientScanPageId = null;
    }

    await refreshMeta();
    return { blocked: false, joined: false, payload };
  }

  function marketsComplete(payload, steps) {
    return steps.every((step) => {
      const market = payload?.markets?.[step.region];
      if (!market) return false;
      if (market.fundamentalsReady) return true;
      return typeof market.recentCount === "number" || typeof market.signalCount === "number";
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
    recordLastUpdated,
    recordPagePayload,
    applyNavUpdatedTimes,
    notifyScanBusy,
    guardReClick,
    runLiveScan,
    fetchForceUrl,
    isBusy,
    jobMatchesPage,
    isScanActiveForPage,
    shouldKeepLiveScan,
    bindScanStatus,
    hideJoinOverlay,
    startMetaPolling,
    stopMetaPolling
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => applyNavUpdatedTimes());
  } else {
    applyNavUpdatedTimes();
  }
})();
