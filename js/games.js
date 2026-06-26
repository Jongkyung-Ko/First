(function () {
  const GAME_LIST = [
    { id: "minesweeper", name: "지뢰찾기", icon: "💣", available: true },
    { id: "tictactoe", name: "틱택토", icon: "⭕", available: true },
    { id: "game2048", name: "2048", icon: "🔢", available: true },
    { id: "snake", name: "스네이크", icon: "🐍", available: true },
    { id: "guess", name: "숫자 맞추기", icon: "🔍", available: true },
    { id: "reaction", name: "반응속도", icon: "⚡", available: true },
    { id: "rps", name: "가위바위보", icon: "✊", available: true },
    { id: "memory", name: "메모리", icon: "🃏", available: true },
    { id: "tetris", name: "테트리스", icon: "🧱", available: true },
    { id: "pong", name: "퐁", icon: "🏓", available: true },
    { id: "breakout", name: "벽돌깨기", icon: "🎯", available: true },
    { id: "wordle", name: "Wordle", icon: "📝", available: true },
    { id: "sudoku", name: "스도쿠", icon: "🔢", available: true },
    { id: "connect4", name: "커넥트4", icon: "🔴", available: true }
  ];

  const EXTRA_RENDERERS = {
    snake: "renderSnake",
    guess: "renderGuessNumber",
    reaction: "renderReaction",
    rps: "renderRPS",
    memory: "renderMemory",
    tetris: "renderTetris",
    pong: "renderPong",
    breakout: "renderBreakout",
    wordle: "renderWordle",
    sudoku: "renderSudoku",
    connect4: "renderConnect4"
  };

  function getGameContext(gameId) {
    return {
      addCleanup,
      gameId,
      mountLeaderboard(parentEl) {
        window.Leaderboard?.mount(parentEl, gameId);
      },
      recordScore(score) {
        window.Leaderboard?.tryRecord(gameId, score);
      }
    };
  }

  let activeGameId = null;
  let minesweeperState = null;
  const cleanupFns = [];

  function addCleanup(fn) {
    cleanupFns.push(fn);
  }

  function runCleanups() {
    cleanupFns.forEach((fn) => fn());
    cleanupFns.length = 0;
  }

  function destroyMinesweeper() {
    if (minesweeperState?.timerId) {
      clearInterval(minesweeperState.timerId);
    }
    minesweeperState = null;
  }

  function destroyActiveGame() {
    runCleanups();
    destroyMinesweeper();
    window.GamePad?.hide?.();
  }

  function destroy() {
    destroyActiveGame();
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
    window.GamePad?.hide?.();
  }

  function selectGame(gameId, gridEl) {
    activeGameId = gameId;
    gridEl.querySelectorAll(".game-tile").forEach((tile) => {
      tile.classList.toggle("active", tile.dataset.gameId === gameId);
    });

    const playArea = document.getElementById("game-play-area");
    if (!playArea) return;

    playArea.hidden = false;
    destroyActiveGame();

    if (gameId === "minesweeper") {
      renderMinesweeper(playArea, getGameContext("minesweeper"));
      afterGameMount(gameId);
      return;
    }

    if (gameId === "tictactoe") {
      renderTicTacToe(playArea, getGameContext("tictactoe"));
      afterGameMount(gameId);
      return;
    }

    if (gameId === "game2048") {
      render2048(playArea, getGameContext("game2048"));
      afterGameMount(gameId);
      return;
    }

    const extraFn = EXTRA_RENDERERS[gameId];
    if (extraFn && window.GamesExtra?.[extraFn]) {
      window.GamesExtra[extraFn](playArea, getGameContext(gameId));
      afterGameMount(gameId);
      return;
    }

    playArea.innerHTML = `<p class="board-empty">이 게임은 아직 준비 중입니다.</p>`;
    window.GamePad?.hide?.();
  }

  function afterGameMount(gameId) {
    window.GamePad?.show?.(gameId);
  }

  function renderMinesweeper(container, ctx) {
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
      <div class="mini-game minesweeper">
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
      if (won) ctx?.recordScore?.(minesweeperState.seconds);
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
      renderMinesweeper(container, ctx);
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
    ctx?.mountLeaderboard?.(container.querySelector(".minesweeper"));
  }

  function renderTicTacToe(container, ctx) {
    const SIZE = 3;
    let board = Array(SIZE * SIZE).fill("");
    let currentPlayer = "X";
    let gameOver = false;
    let moveCount = 0;

    container.innerHTML = `
      <div class="mini-game tictactoe">
        <div class="game-toolbar">
          <div class="game-toolbar-stat" id="ttt-turn">차례: X (나)</div>
          <button type="button" class="minesweeper-reset" id="ttt-reset" title="새 게임">↺</button>
        </div>
        <div class="tictactoe-board" id="ttt-board" role="grid" aria-label="틱택토"></div>
        <p class="minesweeper-hint">X가 먼저 둡니다. 3개를 연속으로 놓으면 승리합니다.</p>
        <p class="minesweeper-status" id="ttt-status"></p>
      </div>
    `;

    const boardEl = document.getElementById("ttt-board");
    const statusEl = document.getElementById("ttt-status");
    const turnEl = document.getElementById("ttt-turn");
    const resetBtn = document.getElementById("ttt-reset");

    function getLines() {
      const lines = [];
      for (let r = 0; r < SIZE; r++) {
        lines.push([r * SIZE, r * SIZE + 1, r * SIZE + 2]);
      }
      for (let c = 0; c < SIZE; c++) {
        lines.push([c, c + SIZE, c + SIZE * 2]);
      }
      lines.push([0, 4, 8], [2, 4, 6]);
      return lines;
    }

    function checkWinner(cells) {
      for (const [a, b, c] of getLines()) {
        if (cells[a] && cells[a] === cells[b] && cells[b] === cells[c]) {
          return cells[a];
        }
      }
      if (cells.every(Boolean)) return "draw";
      return null;
    }

    function emptyIndices(cells) {
      return cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    }

    function minimax(cells, player) {
      const result = checkWinner(cells);
      if (result === "X") return { score: 1 };
      if (result === "O") return { score: -1 };
      if (result === "draw") return { score: 0 };

      const moves = emptyIndices(cells);
      if (player === "O") {
        let best = { score: -Infinity, index: moves[0] };
        for (const index of moves) {
          const next = cells.slice();
          next[index] = "O";
          const score = minimax(next, "X").score;
          if (score > best.score) best = { score, index };
        }
        return best;
      }

      let best = { score: Infinity, index: moves[0] };
      for (const index of moves) {
        const next = cells.slice();
        next[index] = "X";
        const score = minimax(next, "O").score;
        if (score < best.score) best = { score, index };
      }
      return best;
    }

    function paintBoard() {
      boardEl.innerHTML = "";
      boardEl.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;

      board.forEach((mark, index) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "ttt-cell";
        if (mark === "X") cell.classList.add("ttt-x");
        if (mark === "O") cell.classList.add("ttt-o");
        cell.textContent = mark;
        cell.disabled = Boolean(mark) || gameOver || currentPlayer !== "X";
        cell.addEventListener("click", () => handleMove(index));
        boardEl.appendChild(cell);
      });
    }

    function finish(result, moves) {
      gameOver = true;
      if (result === "X") {
        statusEl.textContent = "축하합니다! X 승리!";
        ctx?.recordScore?.(moves);
      } else if (result === "O") {
        statusEl.textContent = "O(AI) 승리! 다시 도전해 보세요.";
      } else {
        statusEl.textContent = "무승부입니다.";
      }
      turnEl.textContent = "게임 종료";
      paintBoard();
    }

    function handleMove(index) {
      if (gameOver || board[index] || currentPlayer !== "X") return;

      board[index] = "X";
      moveCount++;
      const playerWin = checkWinner(board);
      if (playerWin) {
        paintBoard();
        finish(playerWin, moveCount);
        return;
      }

      currentPlayer = "O";
      turnEl.textContent = "차례: O (AI)";
      paintBoard();

      setTimeout(() => {
        if (gameOver) return;
        const aiMove = minimax(board, "O").index;
        board[aiMove] = "O";
        moveCount++;
        const aiWin = checkWinner(board);
        if (aiWin) {
          paintBoard();
          finish(aiWin, moveCount);
          return;
        }
        currentPlayer = "X";
        turnEl.textContent = "차례: X (나)";
        paintBoard();
      }, 280);
    }

    function resetGame() {
      board = Array(SIZE * SIZE).fill("");
      currentPlayer = "X";
      gameOver = false;
      moveCount = 0;
      statusEl.textContent = "";
      turnEl.textContent = "차례: X (나)";
      paintBoard();
    }

    resetBtn.addEventListener("click", resetGame);
    paintBoard();
    ctx?.mountLeaderboard?.(container.querySelector(".tictactoe"));
  }

  function render2048(container, ctx) {
    const SIZE = 4;
    let grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    let score = 0;
    let gameOver = false;
    let scoreRecorded = false;

    container.innerHTML = `
      <div class="mini-game game-2048">
        <div class="game-toolbar">
          <div class="game-toolbar-stat" id="g2048-score">점수: 0</div>
          <button type="button" class="minesweeper-reset" id="g2048-reset" title="새 게임">↺</button>
        </div>
        <div class="game-2048-board" id="g2048-board" tabindex="0" aria-label="2048"></div>
        <p class="minesweeper-hint">방향키(또는 화면 스와이프)로 타일을 합치세요. 2048을 만들면 승리!</p>
        <p class="minesweeper-status" id="g2048-status"></p>
      </div>
    `;

    const boardEl = document.getElementById("g2048-board");
    const scoreEl = document.getElementById("g2048-score");
    const statusEl = document.getElementById("g2048-status");
    const resetBtn = document.getElementById("g2048-reset");

    function spawnTile() {
      const empty = [];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (grid[r][c] === 0) empty.push([r, c]);
        }
      }
      if (!empty.length) return false;
      const [r, c] = empty[Math.floor(Math.random() * empty.length)];
      grid[r][c] = Math.random() < 0.9 ? 2 : 4;
      return true;
    }

    function slideLine(line) {
      const filtered = line.filter((n) => n !== 0);
      const merged = [];
      let gained = 0;
      for (let i = 0; i < filtered.length; i++) {
        if (filtered[i] === filtered[i + 1]) {
          const value = filtered[i] * 2;
          merged.push(value);
          gained += value;
          i++;
        } else {
          merged.push(filtered[i]);
        }
      }
      while (merged.length < SIZE) merged.push(0);
      return { line: merged, gained };
    }

    function getColumn(col) {
      return Array.from({ length: SIZE }, (_, r) => grid[r][col]);
    }

    function setColumn(col, line) {
      line.forEach((value, r) => {
        grid[r][col] = value;
      });
    }

    function move(direction) {
      if (gameOver) return false;

      let moved = false;
      let gained = 0;

      if (direction === "left") {
        for (let r = 0; r < SIZE; r++) {
          const result = slideLine(grid[r].slice());
          gained += result.gained;
          if (result.line.some((v, i) => v !== grid[r][i])) moved = true;
          grid[r] = result.line;
        }
      } else if (direction === "right") {
        for (let r = 0; r < SIZE; r++) {
          const reversed = grid[r].slice().reverse();
          const result = slideLine(reversed);
          gained += result.gained;
          const line = result.line.reverse();
          if (line.some((v, i) => v !== grid[r][i])) moved = true;
          grid[r] = line;
        }
      } else if (direction === "up") {
        for (let c = 0; c < SIZE; c++) {
          const result = slideLine(getColumn(c));
          gained += result.gained;
          const before = getColumn(c);
          setColumn(c, result.line);
          if (result.line.some((v, i) => v !== before[i])) moved = true;
        }
      } else if (direction === "down") {
        for (let c = 0; c < SIZE; c++) {
          const reversed = getColumn(c).reverse();
          const result = slideLine(reversed);
          gained += result.gained;
          const line = result.line.reverse();
          const before = getColumn(c);
          setColumn(c, line);
          if (line.some((v, i) => v !== before[i])) moved = true;
        }
      }

      if (!moved) return false;

      score += gained;
      spawnTile();
      updateUI();

      if (grid.some((row) => row.some((v) => v >= 2048))) {
        statusEl.textContent = "2048 달성! 계속 플레이하거나 새 게임을 시작하세요.";
      }

      if (!canMove()) {
        gameOver = true;
        statusEl.textContent = "더 이상 움직일 수 없습니다. 새 게임을 시작하세요.";
        if (!scoreRecorded) {
          scoreRecorded = true;
          ctx?.recordScore?.(score);
        }
      }

      return true;
    }

    function canMove() {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const value = grid[r][c];
          if (value === 0) return true;
          if (c < SIZE - 1 && value === grid[r][c + 1]) return true;
          if (r < SIZE - 1 && value === grid[r + 1][c]) return true;
        }
      }
      return false;
    }

    function updateUI() {
      scoreEl.textContent = `점수: ${score}`;
      boardEl.innerHTML = "";
      boardEl.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;

      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const value = grid[r][c];
          const cell = document.createElement("div");
          cell.className = "tile-2048-wrap";
          const tile = document.createElement("div");
          tile.className = value ? `tile-2048 tile-2048-${value}` : "tile-2048 tile-2048-empty";
          if (value) tile.textContent = String(value);
          cell.appendChild(tile);
          boardEl.appendChild(cell);
        }
      }
    }

    function handleKeyDown(event) {
      const keyMap = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down"
      };
      const direction = keyMap[event.key];
      if (!direction) return;
      event.preventDefault();
      move(direction);
    }

    let touchStartX = 0;
    let touchStartY = 0;

    function handleTouchStart(event) {
      const touch = event.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }

    function handleTouchEnd(event) {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < 24) return;

      if (absX > absY) {
        move(dx > 0 ? "right" : "left");
      } else {
        move(dy > 0 ? "down" : "up");
      }
    }

    function resetGame() {
      grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
      score = 0;
      gameOver = false;
      scoreRecorded = false;
      statusEl.textContent = "";
      spawnTile();
      spawnTile();
      updateUI();
      boardEl.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    boardEl.addEventListener("touchstart", handleTouchStart, { passive: true });
    boardEl.addEventListener("touchend", handleTouchEnd, { passive: true });
    resetBtn.addEventListener("click", resetGame);

    addCleanup(() => document.removeEventListener("keydown", handleKeyDown));
    addCleanup(() => boardEl.removeEventListener("touchstart", handleTouchStart));
    addCleanup(() => boardEl.removeEventListener("touchend", handleTouchEnd));

    resetGame();
    ctx?.mountLeaderboard?.(container.querySelector(".game-2048"));
  }

  window.Games = {
    renderGamesPage,
    destroy
  };
})();
