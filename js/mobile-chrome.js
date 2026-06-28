(function () {
  "use strict";

  const MOBILE_MQ = window.matchMedia("(max-width: 768px)");
  const SCROLL_THRESHOLD = 10;
  const TOP_SHOW_Y = 16;

  let scrollRoot = null;
  let leftMenu = null;
  let lastY = 0;
  let collapsed = false;
  let enabled = false;

  function isBlocked() {
    if (!MOBILE_MQ.matches) return true;
    if (document.body.classList.contains("books-filter-menu-open")) return true;
    if (document.body.classList.contains("books-reader-fs-open")) return true;
    if (scrollRoot?.classList.contains("games-page-active")) return true;
    const panel = document.getElementById("header-panel");
    if (panel && !panel.hidden) return true;
    return false;
  }

  function setCollapsed(next) {
    if (collapsed === next) return;
    collapsed = next;
    document.body.classList.toggle("mobile-menu-collapsed", next);
    if (leftMenu) leftMenu.setAttribute("aria-hidden", next ? "true" : "false");
  }

  function showMenu() {
    setCollapsed(false);
  }

  function hideMenu() {
    if (isBlocked()) return;
    setCollapsed(true);
  }

  function onScroll() {
    if (!enabled || !scrollRoot) return;
    if (isBlocked()) {
      showMenu();
      lastY = scrollRoot.scrollTop;
      return;
    }

    const y = scrollRoot.scrollTop;
    const delta = y - lastY;

    if (y <= TOP_SHOW_Y) {
      showMenu();
    } else if (delta > SCROLL_THRESHOLD) {
      hideMenu();
    } else if (delta < -SCROLL_THRESHOLD) {
      showMenu();
    }
    lastY = y;
  }

  function syncEnabled() {
    enabled = MOBILE_MQ.matches;
    if (!enabled) showMenu();
    lastY = scrollRoot?.scrollTop ?? 0;
  }

  function reset() {
    showMenu();
    lastY = scrollRoot?.scrollTop ?? 0;
  }

  function bind() {
    scrollRoot = document.getElementById("content-area");
    leftMenu = document.querySelector(".left-menu");
    if (!scrollRoot || !leftMenu) return;

    leftMenu.setAttribute("aria-hidden", "false");
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    MOBILE_MQ.addEventListener("change", syncEnabled);
    syncEnabled();
  }

  window.MobileChrome = { reset, showMenu };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
