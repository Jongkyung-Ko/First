(function () {
  const GAME_LIST = [
    { id: "minesweeper", name: "지뢰찾기", icon: "💣", available: true },
    { id: "coming-2", name: "준비 중", icon: "🎮", available: false },
    { id: "coming-3", name: "준비 중", icon: "🎮", available: false },
    { id: "coming-4", name: "준비 중", icon: "🎮", available: false }
  ];

  let activeGameId = null;
  let minesweeperState = null;

  function destroyMinesweeper() {
    minesweeperState = null;
  }

  function destroy() {
    destroyMinesweeper();
    activeGameId = null;
  }

  function renderGamesPage(container) {
    destroy();
    container.innerHTML = `
      <article class="content-panel games-panel">
        <h2>Games</h2>
        <p class="games-intro">게임을 선택하면 아래에서 플레이할 수 있습니다.</p>
        <div class="games-grid" id="games-grid"></div>
        <div id="game-play-area" class="game-play-area" hidden></div>
      </article>
    `;

    const gridEl = document.getElementById("games-grid");
    if (!gridEl) return;

    gridEl.innerHTML = GAME_LIST.map(
      (game) => `
      <button
        type="button"
        class="game-tile${game.available ? "" : " game-tile-disabled"}"
        data-game-id="${game.id}"
        ${game.available ? "" : "disabled"}
      >
        <span class="game-tile-icon">${game.icon}</span>
        <span class="game-tile-name">${game.name}</span>
      </button>
    `
    ).join("");

    gridEl.querySelectorAll(".game-tile:not(.game-tile-disabled)").forEach((tile) => {
      tile.addEventListener("click", () => selectGame(tile.dataset.gameId, gridEl));
    });
  }

  function selectGame(gameId, gridEl) {
    activeGameId = gameId;
    gridEl.querySelectorAll(".game-tile").forEach((tile) => {
      tile.classList.toggle("active", tile.dataset.gameId === gameId);
    });

    const playArea = document.getElementById("game-play-area");
    if (!playArea) return;

    playArea.hidden = false;
    destroyMinesweeper();

    if (gameId === "minesweeper") {
      renderMinesweeper(playArea);
      return;
    }

    playArea.innerHTML = `<p class="board-empty">이 게임은 아직 준비 중입니다.</p>`;
  }

  function renderMinesweeper(container) {
    const ROWS = 9;
    const COLS = 9;
    const MINES = 10;

    minesweeperState = {
      rows: ROWS,
      cols: COLS,
      mines: MINES,
      board: [],
      revealed: [],
      flagged: [],
      gameOver: false,
      won: false,
      started: false,
      timerId: null,
      seconds: 0
    };

    container.innerHTML = `
      <div class="minesweeper">
        <div class="minesweeper-header">
          <div class="minesweeper-stat" id="mine-counter">💣 ${MINES}</div>
          <button type="button" class="minesweeper-reset" id="minesweeper-reset" title="새 게임">🙂</button>
          <div class="minesweeper-stat" id="mine-timer">⏱ 0</div>
        </div>
        <div class="minesweeper-board" id="minesweeper-board" role="grid" aria-label="지뢰찾기"></div>
        <p class="minesweeper-hint">왼쪽 클릭: 열기 · 오른쪽 클릭: 깃발 표시</p>
        <p class="minesweeper-status" id="minesweeper-status"></p>
      </div>
    `;

    const boardEl = document.getElementById("minesweeper-board");
    const statusEl = document.getElementById("minesweeper-status");
    const counterEl = document.getElementById("mine-counter");
    const timerEl = document.getElementById("mine-timer");
    const resetBtn = document.getElementById("minesweeper-reset");

    function initBoard(safeRow, safeCol) {
      const state = minesweeperState;
      state.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
      state.revealed = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
      state.flagged = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
      state.gameOver = false;
      state.won = false;
      state.seconds = 0;

      const minePositions = new Set();
      while (minePositions.size < MINES) {
        const r = Math.floor(Math.random() * ROWS);
        const c = Math.floor(Math.random() * COLS);
        if (r === safeRow && c === safeCol) continue;
        if (Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1) continue;
        minePositions.add(`${r},${c}`);
      }

      minePositions.forEach((key) => {
        const [r, c] = key.split(",").map(Number);
        state.board[r][c] = -1;
      });

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (state.board[r][c] === -1) continue;
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && state.board[nr][nc] === -1) {
                count++;
              }
            }
          }
          state.board[r][c] = count;
        }
      }
    }

    function stopTimer() {
      if (minesweeperState.timerId) {
        clearInterval(minesweeperState.timerId);
        minesweeperState.timerId = null;
      }
    }

    function startTimer() {
      stopTimer();
      minesweeperState.timerId = setInterval(() => {
        minesweeperState.seconds++;
        timerEl.textContent = `⏱ ${minesweeperState.seconds}`;
      }, 1000);
    }

    function countFlags() {
      return minesweeperState.flagged.flat().filter(Boolean).length;
    }

    function updateCounter() {
      counterEl.textContent = `💣 ${Math.max(0, MINES - countFlags())}`;
    }

    function revealAllMines() {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (minesweeperState.board[r][c] === -1) {
            minesweeperState.revealed[r][c] = true;
          }
        }
      }
    }

    function checkWin() {
      let revealedSafe = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (minesweeperState.board[r][c] !== -1 && minesweeperState.revealed[r][c]) {
            revealedSafe++;
          }
        }
      }
      return revealedSafe === ROWS * COLS - MINES;
    }

    function floodReveal(row, col) {
      const stack = [[row, col]];
      while (stack.length) {
        const [r, c] = stack.pop();
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        if (minesweeperState.revealed[r][c] || minesweeperState.flagged[r][c]) continue;

        minesweeperState.revealed[r][c] = true;

        if (minesweeperState.board[r][c] === 0) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              stack.push([r + dr, c + dc]);
            }
          }
        }
      }
    }

    function endGame(won) {
      minesweeperState.gameOver = true;
      minesweeperState.won = won;
      stopTimer();
      resetBtn.textContent = won ? "😎" : "😵";
      if (!won) revealAllMines();
      statusEl.textContent = won ? "축하합니다! 모든 지뢰를 피했습니다." : "지뢰를 밟았습니다. 다시 도전해 보세요.";
      paintBoard();
    }

    function handleReveal(row, col) {
      if (minesweeperState.gameOver || minesweeperState.flagged[row][col]) return;

      if (!minesweeperState.started) {
        minesweeperState.started = true;
        initBoard(row, col);
        startTimer();
      }

      if (minesweeperState.board[row][col] === -1) {
        minesweeperState.revealed[row][col] = true;
        endGame(false);
        return;
      }

      floodReveal(row, col);

      if (checkWin()) {
        endGame(true);
        return;
      }

      paintBoard();
    }

    function handleFlag(row, col) {
      if (minesweeperState.gameOver || minesweeperState.revealed[row][col]) return;

      if (!minesweeperState.started) {
        minesweeperState.started = true;
        initBoard(row, col);
        startTimer();
      }

      minesweeperState.flagged[row][col] = !minesweeperState.flagged[row][col];
      updateCounter();
      paintBoard();
    }

    function paintBoard() {
      boardEl.innerHTML = "";
      boardEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "mine-cell";
          cell.dataset.row = String(r);
          cell.dataset.col = String(c);
          cell.setAttribute("role", "gridcell");

          const revealed = minesweeperState.revealed[r][c];
          const flagged = minesweeperState.flagged[r][c];
          const value = minesweeperState.board[r]?.[c];

          if (revealed) {
            cell.classList.add("revealed");
            if (value === -1) {
              cell.classList.add("mine");
              cell.textContent = "💣";
            } else if (value > 0) {
              cell.textContent = String(value);
              cell.classList.add(`n${value}`);
            }
          } else if (flagged) {
            cell.classList.add("flagged");
            cell.textContent = "🚩";
          }

          if (minesweeperState.gameOver) {
            cell.disabled = true;
          }

          cell.addEventListener("click", () => handleReveal(r, c));
          cell.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            handleFlag(r, c);
          });

          boardEl.appendChild(cell);
        }
      }
    }

    function resetGame() {
      stopTimer();
      destroyMinesweeper();
      renderMinesweeper(container);
    }

    resetBtn.addEventListener("click", resetGame);
    statusEl.textContent = "";
    timerEl.textContent = "⏱ 0";
    counterEl.textContent = `💣 ${MINES}`;
    resetBtn.textContent = "🙂";

    minesweeperState.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    minesweeperState.revealed = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    minesweeperState.flagged = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    paintBoard();
  }

  window.Games = {
    renderGamesPage,
    destroy
  };
})();
