(function () {
  const COLS = 8;
  const ROWS = 8;
  const TYPES = 6;
  const MOVES_START = 25;
  const GAP = 5;
  const GEM_LABELS = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣"];

  function gsap() {
    return window.GameAnim?.gsap?.() || window.gsap;
  }

  function setupLeaderboard(ctx, container) {
    const root = container.querySelector(".mini-game");
    if (root && ctx?.mountLeaderboard) ctx.mountLeaderboard(root);
  }

  function createBoard() {
    const board = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => Math.floor(Math.random() * TYPES))
    );
    let safety = 0;
    while (findMatches(board).size > 0 && safety++ < 100) {
      resolveMatches(board, findMatches(board));
      applyGravity(board);
      fillEmpty(board);
    }
    return board;
  }

  function findMatches(board) {
    const matched = new Set();
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const type = board[r][c];
        if (type < 0) {
          c++;
          continue;
        }
        const start = c;
        while (c < COLS && board[r][c] === type) c++;
        if (c - start >= 3) {
          for (let i = start; i < c; i++) matched.add(`${r},${i}`);
        }
      }
    }
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const type = board[r][c];
        if (type < 0) {
          r++;
          continue;
        }
        const start = r;
        while (r < ROWS && board[r][c] === type) r++;
        if (r - start >= 3) {
          for (let i = start; i < r; i++) matched.add(`${i},${c}`);
        }
      }
    }
    return matched;
  }

  function resolveMatches(board, matched) {
    matched.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      board[r][c] = -1;
    });
  }

  function applyGravity(board) {
    for (let c = 0; c < COLS; c++) {
      const stack = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][c] >= 0) stack.push(board[r][c]);
      }
      for (let r = ROWS - 1; r >= 0; r--) {
        const idx = ROWS - 1 - r;
        board[r][c] = idx < stack.length ? stack[idx] : -1;
      }
    }
  }

  function fillEmpty(board) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] < 0) board[r][c] = Math.floor(Math.random() * TYPES);
      }
    }
  }

  function swapCells(board, r1, c1, r2, c2) {
    const tmp = board[r1][c1];
    board[r1][c1] = board[r2][c2];
    board[r2][c2] = tmp;
  }

  function isAdjacent(r1, c1, r2, c2) {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
  }

  function hasValidMove(board) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (c < COLS - 1) {
          swapCells(board, r, c, r, c + 1);
          const ok = findMatches(board).size > 0;
          swapCells(board, r, c, r, c + 1);
          if (ok) return true;
        }
        if (r < ROWS - 1) {
          swapCells(board, r, c, r + 1, c);
          const ok = findMatches(board).size > 0;
          swapCells(board, r, c, r + 1, c);
          if (ok) return true;
        }
      }
    }
    return false;
  }

  function shuffleBoard(board) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const types = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) types.push(board[r][c]);
      }
      for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
      }
      let k = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) board[r][c] = types[k++];
      }
      if (findMatches(board).size === 0 && hasValidMove(board)) return;
    }
    const fresh = createBoard();
    for (let r = 0; r < ROWS; r++) board[r] = fresh[r].slice();
  }

  function renderMatch3(container, ctx) {
    let board = createBoard();
    let score = 0;
    let moves = MOVES_START;
    let selected = null;
    let busy = false;
    let gameOver = false;
    let combo = 0;
    let lastTouchAt = 0;
    let cellSize = 38;
    let gemsLayer = null;

    container.innerHTML = `
      <div class="mini-game match3-game">
        <div class="game-toolbar match3-toolbar">
          <div class="game-toolbar-stat" id="match3-score">점수: 0</div>
          <div class="game-toolbar-stat" id="match3-moves">이동: ${MOVES_START}</div>
          <button type="button" class="minesweeper-reset" id="match3-reset" title="새 게임">↺</button>
        </div>
        <div class="match3-board-wrap">
          <div class="match3-board" id="match3-board" role="grid" aria-label="매치-3">
            <div class="match3-gems-layer" id="match3-gems-layer"></div>
          </div>
        </div>
        <p class="minesweeper-hint">인접한 보석 두 개를 탭(또는 스와이프)해서 맞바꾸세요. 3개 이상 연결!</p>
        <p class="minesweeper-status" id="match3-status"></p>
      </div>
    `;

    const boardEl = document.getElementById("match3-board");
    gemsLayer = document.getElementById("match3-gems-layer");
    const scoreEl = document.getElementById("match3-score");
    const movesEl = document.getElementById("match3-moves");
    const statusEl = document.getElementById("match3-status");

    function measure() {
      const inner = boardEl.clientWidth - 16;
      cellSize = Math.floor((inner - GAP * (COLS - 1)) / COLS);
      const h = 16 + ROWS * cellSize + (ROWS - 1) * GAP;
      boardEl.style.height = `${h}px`;
    }

    function posFor(r, c) {
      return {
        x: 8 + c * (cellSize + GAP),
        y: 8 + r * (cellSize + GAP)
      };
    }

    function updateHud() {
      scoreEl.textContent = `점수: ${score}`;
      movesEl.textContent = `이동: ${moves}`;
    }

    function createGemEl(r, c, type) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `match3-gem match3-gem-${type}`;
      btn.dataset.r = String(r);
      btn.dataset.c = String(c);
      btn.style.width = `${cellSize}px`;
      btn.style.height = `${cellSize}px`;
      const p = posFor(r, c);
      btn.style.left = `${p.x}px`;
      btn.style.top = `${p.y}px`;
      btn.innerHTML = `<span class="match3-gem-inner">${GEM_LABELS[type]}</span>`;
      btn.addEventListener("click", () => onCellClick(r, c));
      return btn;
    }

    function getGem(r, c) {
      return gemsLayer.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    }

    function syncGemsFromBoard(selectedCell) {
      measure();
      gemsLayer.innerHTML = "";
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const type = board[r][c];
          if (type < 0) continue;
          const gem = createGemEl(r, c, type);
          if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
            gem.classList.add("selected");
          }
          gemsLayer.appendChild(gem);
        }
      }
    }

    function setSelected(r, c, on) {
      const gem = getGem(r, c);
      if (gem) gem.classList.toggle("selected", on);
    }

    async function animateSwap(r1, c1, r2, c2) {
      const g = gsap();
      const a = getGem(r1, c1);
      const b = getGem(r2, c2);
      if (!g || !a || !b) {
        swapCells(board, r1, c1, r2, c2);
        syncGemsFromBoard();
        return;
      }

      const p1 = posFor(r1, c1);
      const p2 = posFor(r2, c2);
      const tl = g.timeline();
      tl.to(a, { left: p2.x, top: p2.y, duration: 0.22, ease: "power2.inOut" }, 0);
      tl.to(b, { left: p1.x, top: p1.y, duration: 0.22, ease: "power2.inOut" }, 0);
      await window.GameAnim.timelineDone(tl);

      swapCells(board, r1, c1, r2, c2);
      a.dataset.r = String(r2);
      a.dataset.c = String(c2);
      b.dataset.r = String(r1);
      b.dataset.c = String(c1);
    }

    async function animateInvalidSwap(r1, c1, r2, c2) {
      swapCells(board, r1, c1, r2, c2);
      await animateSwap(r1, c1, r2, c2);
      swapCells(board, r1, c1, r2, c2);
      await animateSwap(r1, c1, r2, c2);
    }

    async function animatePop(matched) {
      const g = gsap();
      const els = [];
      matched.forEach((key) => {
        const [r, c] = key.split(",").map(Number);
        const el = getGem(r, c);
        if (el) els.push(el);
      });
      if (!g || !els.length) return;
      const tl = g.timeline();
      tl.to(els, {
        scale: 1.2,
        duration: 0.1,
        ease: "power2.out"
      });
      tl.to(els, {
        scale: 0,
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
        stagger: 0.02
      });
      await window.GameAnim.timelineDone(tl);
      els.forEach((el) => el.remove());
    }

    async function animateGravityAndFill() {
      const g = gsap();
      const gems = [];
      gemsLayer.querySelectorAll(".match3-gem").forEach((el) => {
        gems.push({ el, r: Number(el.dataset.r), c: Number(el.dataset.c) });
      });

      applyGravity(board);

      const fallMoves = [];
      for (let c = 0; c < COLS; c++) {
        const colGems = gems.filter((x) => x.c === c).sort((a, b) => b.r - a.r);
        const targetRows = [];
        for (let r = ROWS - 1; r >= 0; r--) {
          if (board[r][c] >= 0) targetRows.push(r);
        }
        colGems.forEach((gem, i) => {
          const targetR = targetRows[i];
          if (targetR === undefined) return;
          if (gem.r !== targetR) fallMoves.push({ el: gem.el, r: targetR, c });
          gem.el.dataset.r = String(targetR);
        });
      }

      fillEmpty(board);

      const occupied = new Set();
      gemsLayer.querySelectorAll(".match3-gem").forEach((el) => {
        occupied.add(`${el.dataset.r},${el.dataset.c}`);
      });

      const spawns = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (occupied.has(`${r},${c}`)) continue;
          const gem = createGemEl(r, c, board[r][c]);
          const p = posFor(r, c);
          gem.style.left = `${p.x}px`;
          gem.style.top = `${p.y - (r + 1) * (cellSize + GAP)}px`;
          gem.style.opacity = "0.7";
          gemsLayer.appendChild(gem);
          spawns.push({ el: gem, r, c });
        }
      }

      if (!g) {
        syncGemsFromBoard();
        return;
      }

      const tl = g.timeline();
      fallMoves.forEach(({ el, r, c }) => {
        const p = posFor(r, c);
        tl.to(el, { left: p.x, top: p.y, duration: 0.3, ease: "bounce.out" }, 0);
      });
      spawns.forEach(({ el, r, c }, i) => {
        const p = posFor(r, c);
        tl.to(
          el,
          { top: p.y, opacity: 1, duration: 0.34, ease: "power2.out" },
          0.05 + i * 0.012
        );
      });
      await window.GameAnim.timelineDone(tl);
    }

    async function processCascades() {
      combo = 0;
      let totalMatched = findMatches(board);
      while (totalMatched.size > 0) {
        combo++;
        const pts = totalMatched.size * (15 + combo * 5);
        score += pts;
        updateHud();
        statusEl.textContent = combo > 1 ? `콤보 x${combo}! +${pts}` : `+${pts}`;

        await animatePop(totalMatched);
        resolveMatches(board, totalMatched);
        await animateGravityAndFill();

        totalMatched = findMatches(board);
      }
      statusEl.textContent = "";
    }

    async function trySwap(r1, c1, r2, c2) {
      if (busy || gameOver) return;
      busy = true;
      selected = null;
      setSelected(r1, c1, false);
      setSelected(r2, c2, false);

      await animateSwap(r1, c1, r2, c2);
      const matched = findMatches(board);

      if (!matched.size) {
        await animateInvalidSwap(r1, c1, r2, c2);
        statusEl.textContent = "매치가 없습니다.";
        await new Promise((r) => setTimeout(r, 350));
        statusEl.textContent = "";
        busy = false;
        return;
      }

      moves--;
      updateHud();
      await processCascades();

      if (!hasValidMove(board)) {
        shuffleBoard(board);
        syncGemsFromBoard();
      }

      if (moves <= 0) {
        gameOver = true;
        statusEl.textContent = `게임 종료! 최종 점수: ${score}`;
        ctx?.recordScore?.(score);
      }

      busy = false;
    }

    function onCellClick(r, c) {
      if (busy || gameOver) return;
      if (Date.now() - lastTouchAt < 450) return;

      if (!selected) {
        selected = { r, c };
        setSelected(r, c, true);
        return;
      }

      if (selected.r === r && selected.c === c) {
        setSelected(r, c, false);
        selected = null;
        return;
      }

      if (!isAdjacent(selected.r, selected.c, r, c)) {
        setSelected(selected.r, selected.c, false);
        selected = { r, c };
        setSelected(r, c, true);
        return;
      }

      const from = { ...selected };
      selected = null;
      setSelected(from.r, from.c, false);
      trySwap(from.r, from.c, r, c);
    }

    let touchStart = null;

    boardEl.addEventListener(
      "touchstart",
      (e) => {
        const t = e.changedTouches[0];
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const gem = el?.closest?.(".match3-gem");
        if (!gem) return;
        touchStart = {
          r: Number(gem.dataset.r),
          c: Number(gem.dataset.c),
          x: t.clientX,
          y: t.clientY
        };
      },
      { passive: true }
    );

    boardEl.addEventListener(
      "touchend",
      (e) => {
        if (!touchStart || busy || gameOver) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x;
        const dy = t.clientY - touchStart.y;
        const { r, c } = touchStart;
        touchStart = null;

        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
          lastTouchAt = Date.now();
          onCellClick(r, c);
          return;
        }

        let tr = r;
        let tc = c;
        if (Math.abs(dx) > Math.abs(dy)) tc += dx > 0 ? 1 : -1;
        else tr += dy > 0 ? 1 : -1;

        if (tr < 0 || tr >= ROWS || tc < 0 || tc >= COLS) return;
        lastTouchAt = Date.now();
        if (selected) setSelected(selected.r, selected.c, false);
        selected = null;
        trySwap(r, c, tr, tc);
      },
      { passive: true }
    );

    document.getElementById("match3-reset")?.addEventListener("click", () => {
      window.GameAnim?.killTarget?.(gemsLayer?.querySelectorAll?.(".match3-gem"));
      board = createBoard();
      score = 0;
      moves = MOVES_START;
      selected = null;
      busy = false;
      gameOver = false;
      combo = 0;
      statusEl.textContent = "";
      updateHud();
      syncGemsFromBoard();
    });

    window.addEventListener("resize", () => {
      if (!gemsLayer) return;
      measure();
      gemsLayer.querySelectorAll(".match3-gem").forEach((gem) => {
        const r = Number(gem.dataset.r);
        const c = Number(gem.dataset.c);
        const p = posFor(r, c);
        gem.style.width = `${cellSize}px`;
        gem.style.height = `${cellSize}px`;
        gem.style.left = `${p.x}px`;
        gem.style.top = `${p.y}px`;
      });
    });

    updateHud();
    syncGemsFromBoard();
    setupLeaderboard(ctx, container);
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderMatch3 = renderMatch3;
})();
