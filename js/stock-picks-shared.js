/**
 * Stock Picks — 공통 유틸 (전략·렌더러·셸 공유)
 */
(function () {
  const GUEST_REFRESH_MSG = "Guest 모드에서는 새로고침을 사용할 수 없습니다. 로그인 후 이용하세요.";

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  function getApiBase() {
    const url = window.STOCK_API_URL;
    if (!url || typeof url !== "string") return null;
    return url.replace(/\/$/, "");
  }

  function formatFetchError(err, base) {
    if (err?.name === "AbortError") {
      return "요청이 취소되었거나 시간이 초과되었습니다. 잠시 후 다시 시도해 보세요.";
    }
    const msg = String(err?.message || err || "");
    if (/internal server error|http 500|http 502|failed to build recommendations/i.test(msg)) {
      return "주식 API 서버 오류가 발생했습니다. 잠시 후 ↺ 새로고침을 다시 눌러 주세요.";
    }
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      if (window.IS_LOCAL_FILE_PREVIEW) {
        return "HTML 파일을 직접 열면 API가 차단됩니다. Live Server 또는 GitHub Pages로 열어 주세요.";
      }
      if (base?.includes("localhost")) {
        return "로컬 API(localhost:8000)에 연결할 수 없습니다. backend 폴더에서 uvicorn을 실행했는지 확인하세요.";
      }
      return "주식 API 서버에 연결할 수 없습니다. Render 무료 서버는 첫 요청 시 최대 1~2분 걸릴 수 있습니다.";
    }
    if (/not found/i.test(msg)) {
      return "추천 API가 아직 배포되지 않았습니다.";
    }
    return msg || "데이터를 불러오지 못했습니다.";
  }

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function warmApi(base) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      await fetch(`${base}/health`, { signal: controller.signal });
      clearTimeout(timer);
    } catch (_) {
      /* noop */
    }
  }

  async function fetchJsonWithRetry(url, externalSignal, options = {}) {
    const retries = options.retries ?? 2;
    const timeoutMs = options.timeoutMs ?? 90000;
    let lastError = null;
    const base = getApiBase();

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (externalSignal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onExternalAbort = () => controller.abort();
      externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        externalSignal?.removeEventListener("abort", onExternalAbort);
        if (!res.ok) {
          let detail = res.statusText;
          try {
            const body = await res.json();
            detail = body.detail || detail;
          } catch (_) {
            /* noop */
          }
          throw new Error(detail || `HTTP ${res.status}`);
        }
        return res.json();
      } catch (err) {
        clearTimeout(timer);
        externalSignal?.removeEventListener("abort", onExternalAbort);
        if (externalSignal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        lastError = err;
        if (attempt < retries) {
          await warmApi(base);
          await sleep(1500 * (attempt + 1));
        }
      }
    }
    throw lastError || new Error("Failed to fetch");
  }

  function formatTime(unix) {
    if (!unix) return "";
    const d = new Date(unix * 1000);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "방금";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatLastUpdated(date) {
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function formatPct(value) {
    if (value == null || !Number.isFinite(value)) return "—";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }

  function formatPrice(value) {
    if (value == null || !Number.isFinite(value)) return "—";
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function marketLabel(market) {
    if (market === "kr") return "국내";
    if (market === "us") return "해외";
    return "";
  }

  function headlineThumbHtml(item, link) {
    const rawUrl = item.imageUrl || item.thumbnailUrl || "";
    if (!/^https:\/\//i.test(rawUrl)) return "";
    const imageUrl = escapeHtml(rawUrl);
    const href = link || imageUrl;
    return `<a class="stock-headline-thumb-link" href="${href}" target="_blank" rel="noopener noreferrer" aria-hidden="true" tabindex="-1"><img class="stock-headline-thumb" src="${imageUrl}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.remove()"></a>`;
  }

  function isGuestMode() {
    return !window.Auth?.getSession?.();
  }

  function isStockRefreshButton(btn) {
    return btn?.id === "stock-refresh-btn" || btn?.id === "stock-picks-refresh-btn";
  }

  function setStatus(el, message, kind) {
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      el.className = "stock-status";
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.className = `stock-status${kind === "error" ? " stock-status--error" : kind === "info" ? " stock-status--info" : ""}`;
  }

  let updateTimerId = null;
  let updateStartedAt = 0;

  function clearUpdateTimer(root) {
    if (updateTimerId) {
      clearInterval(updateTimerId);
      updateTimerId = null;
    }
    if (root) {
      const elapsedEl = root.querySelector("#stock-update-elapsed");
      if (elapsedEl) elapsedEl.textContent = "0초";
    }
  }

  function tickUpdateElapsed(root) {
    const elapsedEl = root.querySelector("#stock-update-elapsed");
    if (!elapsedEl) return;
    const sec = Math.max(0, Math.floor((Date.now() - updateStartedAt) / 1000));
    elapsedEl.textContent = `${sec}초`;
  }

  function setUpdating(root, updating, options = {}) {
    const panel = root.classList?.contains("stock-panel") ? root : root.querySelector(".stock-panel");
    const overlay = root.querySelector("#stock-update-overlay");
    const msgEl = root.querySelector("#stock-update-message");

    if (panel) panel.classList.toggle("stock-panel--updating", updating);

    if (updating) {
      if (msgEl && options.message) msgEl.textContent = options.message;
      updateStartedAt = Date.now();
      tickUpdateElapsed(root);
      clearUpdateTimer(root);
      updateTimerId = setInterval(() => tickUpdateElapsed(root), 1000);
      if (overlay) overlay.hidden = false;
    } else {
      clearUpdateTimer(root);
      if (overlay) overlay.hidden = true;
    }

    root.querySelectorAll(".stock-tab, #stock-refresh-btn, #stock-picks-refresh-btn").forEach((btn) => {
      if (isStockRefreshButton(btn) && isGuestMode()) {
        btn.disabled = true;
      } else {
        btn.disabled = updating;
      }
    });
  }

  function applyGuestRefreshControls(root) {
    if (!root) return;
    const guest = isGuestMode();
    root.querySelectorAll("#stock-refresh-btn, #stock-picks-refresh-btn").forEach((btn) => {
      if (guest) {
        btn.disabled = true;
        btn.title = GUEST_REFRESH_MSG;
        btn.classList.add("stock-refresh-guest-disabled");
      } else {
        btn.classList.remove("stock-refresh-guest-disabled");
        btn.title = "새로고침";
      }
    });
  }

  window.DwStockPicksShared = {
    escapeHtml,
    getApiBase,
    formatFetchError,
    warmApi,
    fetchJsonWithRetry,
    sleep,
    formatTime,
    formatLastUpdated,
    formatPct,
    formatPrice,
    marketLabel,
    headlineThumbHtml,
    isGuestMode,
    GUEST_REFRESH_MSG,
    isStockRefreshButton,
    setStatus,
    setUpdating,
    clearUpdateTimer,
    applyGuestRefreshControls
  };
})();
