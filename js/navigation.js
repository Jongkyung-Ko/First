(function () {
  "use strict";

  let applyState = null;
  let currentState = { page: "welcome" };
  let isPopstate = false;

  function basePath() {
    return location.pathname.indexOf("/First") !== -1 ? "/First/" : "/";
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function normalizeState(raw) {
    const page = String(raw?.page || "welcome");
    const state = { page };

    if (page === "board" && raw?.boardPostId) {
      state.boardPostId = String(raw.boardPostId);
    }

    if (page === "books") {
      state.booksView = raw?.booksView === "reader" ? "reader" : "list";
      if (state.booksView === "reader" && raw?.booksBookId) {
        state.booksBookId = Number(raw.booksBookId);
      }
    }

    if (page === "games" && raw?.gamesGameId) {
      state.gamesGameId = String(raw.gamesGameId);
    }

    return state;
  }

  function statesEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function buildUrl(state) {
    const params = new URLSearchParams();
    if (state.page && state.page !== "welcome") {
      params.set("page", state.page);
    }
    if (state.page === "board" && state.boardPostId) {
      params.set("post", state.boardPostId);
    }
    if (state.page === "books" && state.booksView === "reader" && state.booksBookId) {
      params.set("book", String(state.booksBookId));
    }
    if (state.page === "games" && state.gamesGameId) {
      params.set("game", state.gamesGameId);
    }
    const qs = params.toString();
    return basePath() + (qs ? `?${qs}` : "");
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(location.search);
    const page = params.get("page") || "welcome";
    const raw = { page };

    const post = params.get("post");
    if (post) {
      raw.page = "board";
      raw.boardPostId = post;
    }

    const book = params.get("book");
    if (book) {
      raw.page = "books";
      raw.booksView = "reader";
      raw.booksBookId = book;
    }

    const game = params.get("game");
    if (game) {
      raw.page = "games";
      raw.gamesGameId = game;
    }

    return normalizeState(raw);
  }

  function navigate(partial, options) {
    if (!applyState) return;

    const opts = options || {};
    const pageChanged = partial.page && partial.page !== currentState.page;
    const merged = { ...currentState, ...partial };

    if (pageChanged) {
      if (!("boardPostId" in partial)) delete merged.boardPostId;
      if (!("booksView" in partial) && !("booksBookId" in partial)) {
        delete merged.booksView;
        delete merged.booksBookId;
      }
      if (!("gamesGameId" in partial)) delete merged.gamesGameId;
    }

    const next = normalizeState(merged);

    if (next.page !== "board") delete next.boardPostId;
    if (next.page !== "books") {
      delete next.booksView;
      delete next.booksBookId;
    } else if (next.booksView !== "reader") {
      delete next.booksBookId;
    }
    if (next.page !== "games") delete next.gamesGameId;

    const unchanged = statesEqual(next, currentState);
    currentState = cloneState(next);

    if (isPopstate) {
      applyState(currentState, { fromHistory: true });
      return;
    }

    if (unchanged && !opts.replace) {
      applyState(currentState, { fromHistory: false });
      return;
    }

    const url = buildUrl(currentState);
    const hist = cloneState(currentState);
    if (opts.replace) {
      history.replaceState(hist, "", url);
    } else if (opts.push !== false) {
      history.pushState(hist, "", url);
    }

    applyState(currentState, { fromHistory: false });
  }

  function back() {
    history.back();
  }

  function getState() {
    return cloneState(currentState);
  }

  function init(handler) {
    applyState = handler;

    window.addEventListener("popstate", () => {
      isPopstate = true;
      try {
        const next = history.state ? normalizeState(history.state) : readStateFromUrl();
        currentState = cloneState(next);
        applyState(currentState, { fromHistory: true });
      } finally {
        isPopstate = false;
      }
    });

    const fromUrl = readStateFromUrl();
    const hasDeepLink =
      fromUrl.page !== "welcome" ||
      fromUrl.boardPostId ||
      fromUrl.booksBookId ||
      fromUrl.gamesGameId;

    currentState = hasDeepLink ? cloneState(fromUrl) : { page: "welcome" };
    history.replaceState(cloneState(currentState), "", buildUrl(currentState));
    return cloneState(currentState);
  }

  window.AppNavigation = {
    init,
    navigate,
    back,
    getState,
    buildUrl,
    readStateFromUrl
  };
})();
