(function () {
  "use strict";

  const HIDDEN_PAGES = new Set(["admin", "sign-in", "sign-up", "confirm", "sign-out"]);
  let lastTracked = "";

  function shouldTrack(pageKey) {
    if (!pageKey || HIDDEN_PAGES.has(pageKey)) return false;
    return true;
  }

  async function trackPageView(pageKey) {
    if (!shouldTrack(pageKey)) return;
    if (lastTracked === pageKey) return;
    lastTracked = pageKey;

    const client = window.Auth?.getClient?.();
    if (!client) return;

    const session = window.Auth?.getSession?.();
    const row = session?.user?.id
      ? { page_key: pageKey, user_id: session.user.id, is_guest: false }
      : { page_key: pageKey, user_id: null, is_guest: true };

    try {
      await client.from("menu_analytics").insert(row);
    } catch {
      /* analytics must not break navigation */
    }
  }

  function resetDedupe() {
    lastTracked = "";
  }

  window.AppAnalytics = {
    trackPageView,
    resetDedupe
  };
})();
