(function () {
  const COLS = 8;
  const ROWS = 8;
  const TYPES = 6;
  const MOVES_START = 25;
  const GEM_LABELS = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣"];

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
        if (type == null || type < 0) {
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
        if (type == null || type < 0) {
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

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

    container.innerHTML = `
      <div class="mini-game match3-game">
        <div class="game-toolbar match3-toolbar">
          <div class="game-toolbar-stat" id="match3-score">점수: 0</div>
          <div class="game-toolbar-stat" id="match3-moves">이동: ${MOVES_START}</div>
          <button type="button" class="minesweeper-reset" id="match3-reset" title="새 게임">↺</button>
        </div>
        <div class="match3-board-wrap">
          <div class="match3-board" id="match3-board" role="grid" aria-label="매치-3"></div>
        </div>
        <p class="minesweeper-hint">인접한 보석 두 개를 탭(또는 스와이프)해서 맞바꾸세요. 3개 이상 연결!</p>
        <p class="minesweeper-status" id="match3-status"></p>
      </div>
    `;

    const boardEl = document.getElementById("match3-board");
    const scoreEl = document.getElementById("match3-score");
    const movesEl = document.getElementById("match3-moves");
    const statusEl = document.getElementById("match3-status");

    function updateHud() {
      scoreEl.textContent = `점수: ${score}`;
      movesEl.textContent = `이동: ${moves}`;
    }

    function paintBoard(options = {}) {
      const { pop = new Set(), selectedCell = null, swapPair = null } = options;
      boardEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
      boardEl.innerHTML = "";

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const type = board[r][c];
          if (type < 0) continue;

          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `match3-gem match3-gem-${type}`;
          btn.dataset.r = String(r);
          btn.dataset.c = String(c);
          btn.setAttribute("role", "gridcell");
          btn.innerHTML = `<span class="match3-gem-inner">${GEM_LABELS[type]}</span>`;

          if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
            btn.classList.add("selected");
          }
          if (pop.has(`${r},${c}`)) btn.classList.add("pop");
          if (swapPair) {
            const [a, b] = swapPair;
            if ((a.r === r && a.c === c) || (b.r === r && b.c === c)) {
              btn.classList.add("swap");
            }
          }

          btn.addEventListener("click", () => onCellClick(r, c));
          boardEl.appendChild(btn);
        }
      }
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

        paintBoard({ pop: totalMatched, selectedCell: null });
        await wait(280);

        resolveMatches(board, totalMatched);
        applyGravity(board);
        paintBoard();
        await wait(180);

        fillEmpty(board);
        paintBoard({ selectedCell: null });
        await wait(120);

        totalMatched = findMatches(board);
      }
      statusEl.textContent = "";
    }

    async function trySwap(r1, c1, r2, c2) {
      if (busy || gameOver) return;
      busy = true;
      selected = null;

      paintBoard({ swapPair: [{ r: r1, c: c1 }, { r: r2, c: c2 }] });
      await wait(160);

      swapCells(board, r1, c1, r2, c2);
      const matched = findMatches(board);

      if (!matched.size) {
        swapCells(board, r1, c1, r2, c2);
        paintBoard();
        statusEl.textContent = "매치가 없습니다.";
        await wait(400);
        statusEl.textContent = "";
        busy = false;
        return;
      }

      moves--;
      updateHud();
      await processCascades();

      if (!hasValidMove(board)) shuffleBoard(board);
      paintBoard();

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
        paintBoard({ selectedCell: selected });
        return;
      }

      if (selected.r === r && selected.c === c) {
        selected = null;
        paintBoard();
        return;
      }

      if (!isAdjacent(selected.r, selected.c, r, c)) {
        selected = { r, c };
        paintBoard({ selectedCell: selected });
        return;
      }

      const from = { ...selected };
      selected = null;
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
        selected = null;
        trySwap(r, c, tr, tc);
      },
      { passive: true }
    );

    document.getElementById("match3-reset")?.addEventListener("click", () => {
      board = createBoard();
      score = 0;
      moves = MOVES_START;
      selected = null;
      busy = false;
      gameOver = false;
      combo = 0;
      statusEl.textContent = "";
      updateHud();
      paintBoard();
    });

    updateHud();
    paintBoard();
    setupLeaderboard(ctx, container);
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderMatch3 = renderMatch3;
})();
