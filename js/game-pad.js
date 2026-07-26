(function () {
  const PAD_LAYOUT = {
    snake: "dpad",
    game2048: "dpad",
    tetris: "dpad",
    pong: "horizontal",
    breakout: "horizontal",
    flappy: "dpad",
    runner: "dpad",
    cave: "dpad",
    survival: "dpad",
    pacman: "dpad",
    galaga: "shooter"
  };

  const HOLD_DPAD_GAMES = new Set(["survival"]);

  let padEl = null;
  let activeGameId = null;
  let holdTimers = new Map();

  function isMobileViewport() {
    return (
      window.matchMedia("(max-width: 768px)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    );
  }

  function dispatchKey(key, type) {
    const code =
      key === " "
        ? "Space"
        : key.startsWith("Arrow")
          ? key
          : key.length === 1
            ? `Key${key.toUpperCase()}`
            : key;
    document.dispatchEvent(
      new KeyboardEvent(type, {
        key,
        code,
        bubbles: true,
        cancelable: true
      })
    );
  }

  function clearHolds() {
    holdTimers.forEach((timer, key) => {
      clearInterval(timer);
      dispatchKey(key, "keyup");
    });
    holdTimers.clear();
  }

  function hapticTap() {
    if (!isMobileViewport() || !navigator.vibrate) return;
    try {
      navigator.vibrate(14);
    } catch (_) {
      /* noop */
    }
  }

  function bindDirectionButton(btn, key, options) {
    const { repeat = false } = options;

    function press(event) {
      event.preventDefault();
      hapticTap();
      try {
        btn.setPointerCapture(event.pointerId);
      } catch (_) {
        /* ignore */
      }
      dispatchKey(key, "keydown");
      if (repeat && !holdTimers.has(key)) {
        const timer = setInterval(() => dispatchKey(key, "keydown"), 120);
        holdTimers.set(key, timer);
      }
    }

    function release(event) {
      event.preventDefault();
      if (holdTimers.has(key)) {
        clearInterval(holdTimers.get(key));
        holdTimers.delete(key);
      }
      dispatchKey(key, "keyup");
    }

    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("lostpointercapture", release);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function buildDpad() {
    return `
      <div class="game-pad-dpad">
        <button type="button" class="game-pad-btn game-pad-up" data-key="ArrowUp" aria-label="위">▲</button>
        <button type="button" class="game-pad-btn game-pad-left" data-key="ArrowLeft" aria-label="왼쪽">◀</button>
        <button type="button" class="game-pad-btn game-pad-center" disabled aria-hidden="true">◎</button>
        <button type="button" class="game-pad-btn game-pad-right" data-key="ArrowRight" aria-label="오른쪽">▶</button>
        <button type="button" class="game-pad-btn game-pad-down" data-key="ArrowDown" aria-label="아래">▼</button>
      </div>
    `;
  }

  function buildHorizontal() {
    return `
      <div class="game-pad-horizontal">
        <button type="button" class="game-pad-btn game-pad-wide" data-key="ArrowLeft" aria-label="왼쪽">◀</button>
        <button type="button" class="game-pad-btn game-pad-wide" data-key="ArrowRight" aria-label="오른쪽">▶</button>
      </div>
    `;
  }

  function buildShooter() {
    return `
      <div class="game-pad-shooter">
        <div class="game-pad-horizontal">
          <button type="button" class="game-pad-btn game-pad-wide" data-key="ArrowLeft" aria-label="왼쪽">◀</button>
          <button type="button" class="game-pad-btn game-pad-wide" data-key="ArrowRight" aria-label="오른쪽">▶</button>
        </div>
        <button type="button" class="game-pad-btn game-pad-fire" data-key=" " aria-label="발사">●</button>
      </div>
    `;
  }

  function ensurePad() {
    if (padEl) return padEl;

    padEl = document.createElement("div");
    padEl.id = "game-control-pad";
    padEl.className = "game-control-pad";
    padEl.hidden = true;
    padEl.innerHTML = `<div class="game-control-pad-shell" id="game-control-pad-shell"></div>`;
    document.body.appendChild(padEl);
    return padEl;
  }

  function wireButtons(layout, gameId) {
    const shell = document.getElementById("game-control-pad-shell");
    if (!shell) return;

    clearHolds();

    shell.innerHTML =
      layout === "horizontal"
        ? buildHorizontal()
        : layout === "shooter"
          ? buildShooter()
          : buildDpad();

    shell.querySelectorAll(".game-pad-btn[data-key]").forEach((btn) => {
      const key = btn.dataset.key;
      if (layout === "horizontal" || layout === "shooter") {
        if (btn.classList.contains("game-pad-fire")) {
          bindDirectionButton(btn, key, { repeat: true });
        } else {
          bindDirectionButton(btn, key, { hold: true });
        }
      } else if (HOLD_DPAD_GAMES.has(gameId)) {
        bindDirectionButton(btn, key, { hold: true });
      } else {
        bindDirectionButton(btn, key, { repeat: true });
      }
    });
  }

  function show(gameId) {
    activeGameId = gameId;
    const layout = PAD_LAYOUT[gameId];
    const pad = ensurePad();

    if (!layout || !isMobileViewport()) {
      hide();
      return;
    }

    wireButtons(layout, gameId);
    pad.hidden = false;
    document.body.classList.add("game-pad-active");
  }

  function hide() {
    clearHolds();
    activeGameId = null;
    if (padEl) padEl.hidden = true;
    document.body.classList.remove("game-pad-active");
  }

  function refresh() {
    if (activeGameId) show(activeGameId);
    else hide();
  }

  window.addEventListener("resize", refresh);

  window.GamePad = {
    show,
    hide,
    refresh,
    isMobileViewport
  };
})();
