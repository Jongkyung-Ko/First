/**
 * Stock Picks Re — 전역 스캔 락 (1건 running) · 합류 UI · 마지막 갱신 메타
 */
(function () {
  const POLL_MS = 2000;
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
  let joinOverlayEl = null;
  let joinStartedAt = 0;
  let joinElapsedTimer = null;

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
    return metaCache;
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

  function ensureJoinOverlay() {
    if (joinOverlayEl) return joinOverlayEl;
    joinOverlayEl = document.createElement("div");
    joinOverlayEl.id = "stock-scan-join-overlay";
    joinOverlayEl.className = "stock-scan-join-overlay";
    joinOverlayEl.hidden = true;
    joinOverlayEl.setAttribute("role", "status");
    joinOverlayEl.setAttribute("aria-live", "polite");
    joinOverlayEl.innerHTML = `
      <div class="stock-scan-join-panel">
        <span class="stock-scan-join-spinner" aria-hidden="true"></span>
        <p class="stock-scan-join-title">이미 스캔 중입니다.</p>
        <p class="stock-scan-join-message" id="stock-scan-join-message"></p>
        <p class="stock-scan-join-elapsed" id="stock-scan-join-elapsed">0초</p>
        <p class="stock-scan-join-hint">다른 추천 방식 Re는 완료 후 가능합니다. 진행 상황만 표시됩니다.</p>
      </div>`;
    document.body.appendChild(joinOverlayEl);
    return joinOverlayEl;
  }

  function tickJoinElapsed() {
    const el = document.getElementById("stock-scan-join-elapsed");
    if (!el || joinOverlayEl?.hidden) return;
    const sec = Math.max(0, Math.floor((Date.now() - joinStartedAt) / 1000));
    el.textContent = `${sec}초`;
  }

  function showJoinOverlay(job) {
    const overlay = ensureJoinOverlay();
    const msg = document.getElementById("stock-scan-join-message");
    if (msg) {
      msg.textContent = job?.message || job?.targetLabel || "스캔 진행 중…";
    }
    joinStartedAt = Date.now();
    tickJoinElapsed();
    clearInterval(joinElapsedTimer);
    joinElapsedTimer = setInterval(tickJoinElapsed, 1000);
    overlay.hidden = false;
  }

  function hideJoinOverlay() {
    if (joinOverlayEl) joinOverlayEl.hidden = true;
    clearInterval(joinElapsedTimer);
    joinElapsedTimer = null;
  }

  function updateJoinOverlay(job) {
    const msg = document.getElementById("stock-scan-join-message");
    if (msg && job) {
      msg.textContent = job.message || job.targetLabel || "스캔 진행 중…";
    }
  }

  async function pollUntilIdle({ signal, onJob } = {}) {
    while (!signal?.aborted) {
      const status = await fetchJson("/api/stock-picks/scan/status", { signal });
      if (status.activeJob) {
        onJob?.(status.activeJob);
        updateJoinOverlay(status.activeJob);
      }
      if (!status.busy) {
        hideJoinOverlay();
        await refreshMeta();
        return status;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    throw new DOMException("Aborted", "AbortError");
  }

  function appendScanParams(url, scanJobId) {
    const u = new URL(url, window.location.href);
    if (scanJobId) u.searchParams.set("scan_job_id", scanJobId);
    return u.href;
  }

  async function fetchForceUrl(url, { scanJobId, signal, timeoutMs = 180000 } = {}) {
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
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  }

  /**
   * @param {object} opts
   * @param {string} opts.target
   * @param {Array<{region:string,label:string}>} [opts.steps]
   * @param {(region:string, scanJobId:string|null)=>string} opts.buildUrl
   * @param {AbortSignal} [opts.signal]
   * @param {(p:{step:number,total:number,label:string})=>void} [opts.onProgress]
   * @param {(partial:object)=>void} [opts.onPartial]
   */
  async function runLiveScan(opts) {
    const steps = opts.steps || LIVE_SCAN_STEPS;
    let scanJobId = null;
    let payload = null;

    const meta = await refreshMeta();
    if (meta.busy && meta.activeJob) {
      showJoinOverlay(meta.activeJob);
      await pollUntilIdle({ signal: opts.signal, onJob: opts.onBlocked });
      return { joined: true, payload: null };
    }

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
          showJoinOverlay(err.job);
          opts.onBlocked?.(err.job);
          await pollUntilIdle({ signal: opts.signal, onJob: opts.onBlocked });
          return { joined: true, payload: null };
        }
        throw err;
      }
    }

    hideJoinOverlay();
    await refreshMeta();
    return { joined: false, payload };
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
    if (pollTimer) return;
    void refreshMeta();
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      void refreshMeta();
    }, 30000);
  }

  function stopMetaPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function isBusy() {
    return !!metaCache.busy;
  }

  window.StockScanLock = {
    LIVE_SCAN_STEPS,
    PAGE_TARGET,
    getApiBase,
    getAuthHeaders,
    formatShortUpdated,
    renderUpdatedLine,
    refreshMeta,
    getLastUpdatedForPage,
    applyNavUpdatedTimes,
    runLiveScan,
    pollUntilIdle,
    fetchForceUrl,
    showJoinOverlay,
    hideJoinOverlay,
    isBusy,
    startMetaPolling,
    stopMetaPolling
  };
})();
