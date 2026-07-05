/**
 * 단기추천로직 Re(force live) — maspro79@naver.com 전용
 */
(function () {
  const SHORT_TERM_PAGE_IDS = new Set([
    "stock-picks",
    "recommend2",
    "strategy-golden",
    "strategy-bollinger",
    "strategy-rsi",
    "strategy-candle-support",
    "strategy-obv",
    "strategy-bottom",
    "strategy-vcp"
  ]);

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function forceEmail() {
    return normalizeEmail(
      window.SHORT_TERM_FORCE_EMAIL ||
        window.FUNDAMENTALS_FORCE_EMAIL ||
        "maspro79@naver.com"
    );
  }

  function canShortTermLiveRe(session) {
    if (!session?.user?.email) return false;
    return normalizeEmail(session.user.email) === forceEmail();
  }

  function isShortTermPage(pageId) {
    return !!pageId && SHORT_TERM_PAGE_IDS.has(pageId);
  }

  /** @param {HTMLElement|null} root */
  function syncShortTermReButton(root, btnSelector, opts = {}) {
    const btn = root?.querySelector?.(btnSelector);
    if (!btn) return;
    const session = window.Auth?.getSession?.();
    if (!session || !canShortTermLiveRe(session)) {
      btn.hidden = true;
      btn.setAttribute("aria-hidden", "true");
      return;
    }
    btn.hidden = false;
    btn.removeAttribute("aria-hidden");
    btn.title = opts.title || "운영자 실시간 스캔 (4시장 · 장중 점검용)";
  }

  window.StockLiveAuth = {
    SHORT_TERM_PAGE_IDS,
    canShortTermLiveRe,
    isShortTermPage,
    syncShortTermReButton
  };
})();
