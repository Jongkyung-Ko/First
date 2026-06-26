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
    { id: "connect4", name: "커넥트4", icon: "🔴", available: true },
    { id: "match3", name: "매치-3", icon: "💎", available: true },
    { id: "flappy", name: "플래피", icon: "🐦", available: true },
    { id: "runner", name: "러너", icon: "🏃", available: true },
    { id: "cave", name: "동굴 탐험", icon: "🗡️", available: true },
    { id: "freecell", name: "프리셀", icon: "🂡", available: true },
    { id: "blackjack", name: "블랙잭", icon: "🃏", available: true },
    { id: "gostop", name: "고스톱", icon: "🎴", available: true },
    { id: "survival", name: "서바이벌", icon: "⚔️", available: true },
    { id: "galaga", name: "갤러그", icon: "🚀", available: true },
    { id: "pacman", name: "팩맨", icon: "👻", available: true }
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
    connect4: "renderConnect4",
    match3: "renderMatch3",
    flappy: "renderFlappy",
    runner: "renderRunner",
    cave: "renderCave",
    freecell: "renderFreecell",
    blackjack: "renderBlackjack",
    gostop: "renderGostop",
    survival: "renderSurvival",
    galaga: "renderGalaga",
    pacman: "renderPacman"
  };

  function getGameContext(gameId) {
    return {
      addCleanup,
      gameId,
      sfx(name) {
        window.GameAudio?.sfx?.(name);
      },
      playBgm(track) {
        window.GameAudio?.playBgm?.(track);
      },
      stopBgm() {
        window.GameAudio?.stopBgm?.();
      },
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
    window.GameAudio?.stopBgm?.();
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
        <p class="games-intro">게임을 선택하면 아래에서 플레이할 수 있습니다. 플레이마다 <strong>Digi-Mon 1개</strong>가 소비됩니다. TOP 10 랭킹 진입 시 <strong>5개</strong>, TOP 3 진입 시 <strong>10개</strong>를 돌려받습니다.</p>
        <p class="games-intro games-digimon-hint" id="games-digimon-hint" hidden></p>
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
        <span class="game-tile-cost">-1 DM</span>
      </button>
    `
    ).join("");

    gridEl.querySelectorAll(".game-tile:not(.game-tile-disabled)").forEach((tile) => {
      tile.addEventListener("click", async () => {
        await selectGame(tile.dataset.gameId, gridEl);
      });
    });
    refreshGameAccess();
    window.GamePad?.hide?.();
  }

  function showPlayAreaMessage(playArea, message, type) {
    if (!playArea) return;
    playArea.hidden = false;
    playArea.innerHTML = `<p class="auth-message ${type || "error"}">${message}</p>`;
    window.GamePad?.hide?.();
  }

  async function refreshGameAccess() {
    const gridEl = document.getElementById("games-grid");
    const hintEl = document.getElementById("games-digimon-hint");
    if (!gridEl) return;

    const session = window.Auth?.getSession();
    let canPlay = false;
    let balance = 0;

    if (session && window.Digimon) {
      balance = await window.Digimon.getBalance();
      canPlay = balance >= window.Digimon.GAME_COST;
    }

    if (hintEl) {
      if (!session) {
        hintEl.textContent = "게임을 하려면 로그인하세요.";
        hintEl.hidden = false;
      } else if (!canPlay) {
        hintEl.textContent = `Digi-Mon이 ${window.Digimon.format(balance)}개입니다. 게임을 하려면 최소 1개가 필요합니다.`;
        hintEl.hidden = false;
      } else {
        hintEl.textContent = `보유 Digi-Mon: ${window.Digimon.format(balance)}개`;
        hintEl.hidden = false;
      }
    }

    gridEl.querySelectorAll(".game-tile:not(.game-tile-disabled)").forEach((tile) => {
      const blocked = Boolean(session && !canPlay);
      tile.disabled = blocked;
      tile.classList.toggle("game-tile-no-digimon", blocked);
    });
  }

  async function selectGame(gameId, gridEl) {
    const playArea = document.getElementById("game-play-area");
    if (!playArea) return;

    if (!window.Auth?.getSession()) {
      showPlayAreaMessage(playArea, "게임을 하려면 로그인이 필요합니다.");
      return;
    }

    const game = GAME_LIST.find((g) => g.id === gameId);
    const spendResult = await window.Digimon?.spend?.(window.Digimon.GAME_COST, {
      reason: `게임 ${game?.name || gameId} 플레이`
    });
    if (!spendResult?.ok) {
      showPlayAreaMessage(playArea, spendResult?.error || "Digi-Mon이 부족합니다.");
      await refreshGameAccess();
      return;
    }

    activeGameId = gameId;
    gridEl.querySelectorAll(".game-tile").forEach((tile) => {
      tile.classList.toggle("active", tile.dataset.gameId === gameId);
    });

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

  const BGM_GAMES = {
    flappy: "flappy",
    runner: "runner",
    cave: "cave",
    pong: "arcade",
    breakout: "arcade",
    tetris: "arcade",
    snake: "arcade",
    survival: "arcade",
    galaga: "arcade",
    pacman: "arcade"
  };

  function afterGameMount(gameId) {
    window.GamePad?.show?.(gameId);
    const root = document.querySelector("#game-play-area .mini-game");
    window.GameAudio?.mountToggle?.(root);
    const track = BGM_GAMES[gameId];
    if (track) window.GameAudio?.playBgm?.(track);
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
      ctx?.sfx?.(won ? "win" : "mine");
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
        ctx?.sfx?.("mine");
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
      ctx?.sfx?.("flag");
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
        ctx?.sfx?.("win");
      } else if (result === "O") {
        statusEl.textContent = "O(AI) 승리! 다시 도전해 보세요.";
        ctx?.sfx?.("lose");
      } else {
        statusEl.textContent = "무승부입니다.";
        ctx?.sfx?.("click");
      }
      turnEl.textContent = "게임 종료";
      paintBoard();
    }

    function handleMove(index) {
      if (gameOver || board[index] || currentPlayer !== "X") return;

      board[index] = "X";
      moveCount++;
      ctx?.sfx?.("click");
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
    const GAP = 6;
    const PAD = 6;
    let tilePx = 72;
    let grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    let score = 0;
    let gameOver = false;
    let scoreRecorded = false;
    let tileId = 1;
    let tileGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    let tileEls = new Map();
    let lastSpawn = null;

    container.innerHTML = `
      <div class="mini-game game-2048">
        <div class="game-toolbar">
          <div class="game-toolbar-stat" id="g2048-score">점수: 0</div>
          <button type="button" class="minesweeper-reset" id="g2048-reset" title="새 게임">↺</button>
        </div>
        <div class="game-2048-board" id="g2048-board" tabindex="0" aria-label="2048">
          <div class="game-2048-bg" id="g2048-bg"></div>
          <div class="game-2048-tiles" id="g2048-tiles"></div>
        </div>
        <p class="minesweeper-hint">방향키(또는 화면 스와이프)로 타일을 합치세요. 2048을 만들면 승리!</p>
        <p class="minesweeper-status" id="g2048-status"></p>
      </div>
    `;

    const boardEl = document.getElementById("g2048-board");
    const bgEl = document.getElementById("g2048-bg");
    const tilesEl = document.getElementById("g2048-tiles");
    const scoreEl = document.getElementById("g2048-score");
    const statusEl = document.getElementById("g2048-status");
    const resetBtn = document.getElementById("g2048-reset");

    function gsap() {
      return window.GameAnim?.gsap?.() || window.gsap;
    }

    function cellPos(r, c) {
      return {
        x: c * (tilePx + GAP),
        y: r * (tilePx + GAP)
      };
    }

    function syncBoardMetrics() {
      const sample = bgEl.querySelector(".tile-2048-wrap");
      tilePx = sample?.offsetWidth || 72;
      const boardW = SIZE * tilePx + (SIZE - 1) * GAP;
      boardEl.style.width = `${boardW + PAD * 2}px`;
      boardEl.style.height = `${boardW + PAD * 2}px`;
    }

    function buildBackground() {
      bgEl.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
      bgEl.innerHTML = "";
      for (let i = 0; i < SIZE * SIZE; i++) {
        const cell = document.createElement("div");
        cell.className = "tile-2048-wrap";
        const tile = document.createElement("div");
        tile.className = "tile-2048 tile-2048-empty";
        cell.appendChild(tile);
        bgEl.appendChild(cell);
      }
      syncBoardMetrics();
    }

    function tileClass(value) {
      return `tile-2048-real tile-2048-${value}`;
    }

    function createTileEl(id, value, r, c) {
      const el = document.createElement("div");
      el.className = tileClass(value);
      el.dataset.id = String(id);
      el.textContent = String(value);
      const p = cellPos(r, c);
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      tilesEl.appendChild(el);
      tileEls.set(id, el);
      return el;
    }

    function removeTile(id) {
      const el = tileEls.get(id);
      if (el) el.remove();
      tileEls.delete(id);
    }

    function spawnTile() {
      const empty = [];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (grid[r][c] === 0) empty.push([r, c]);
        }
      }
      if (!empty.length) return false;
      const [r, c] = empty[Math.floor(Math.random() * empty.length)];
      const value = Math.random() < 0.9 ? 2 : 4;
      grid[r][c] = value;
      const id = tileId++;
      tileGrid[r][c] = { id, value };
      lastSpawn = { id, r, c };
      return true;
    }

    function slideLine(line, lineTiles) {
      const cells = line.map((value, i) => ({ value, tile: lineTiles[i] }));
      const filtered = cells.filter((c) => c.value !== 0);
      const merged = [];
      let gained = 0;
      for (let i = 0; i < filtered.length; i++) {
        if (filtered[i].value === filtered[i + 1]?.value) {
          const value = filtered[i].value * 2;
          merged.push({
            value,
            tile: filtered[i].tile,
            mergedFrom: filtered[i + 1].tile
          });
          gained += value;
          i++;
        } else {
          merged.push({ value: filtered[i].value, tile: filtered[i].tile });
        }
      }
      while (merged.length < SIZE) merged.push({ value: 0, tile: null });
      return { cells: merged, gained };
    }

    function getColumn(col) {
      return Array.from({ length: SIZE }, (_, r) => grid[r][col]);
    }

    function getColumnTiles(col) {
      return Array.from({ length: SIZE }, (_, r) => tileGrid[r][col]);
    }

    function setColumn(col, cells) {
      cells.forEach((cell, r) => {
        grid[r][col] = cell.value;
        if (cell.mergedFrom) removeTile(cell.mergedFrom.id);
        tileGrid[r][col] = cell.tile ? { id: cell.tile.id, value: cell.value } : null;
      });
    }

    function setRow(r, cells) {
      cells.forEach((cell, c) => {
        grid[r][c] = cell.value;
        if (cell.mergedFrom) removeTile(cell.mergedFrom.id);
        tileGrid[r][c] = cell.tile ? { id: cell.tile.id, value: cell.value } : null;
      });
    }

    function move(direction) {
      if (gameOver) return false;

      let moved = false;
      let gained = 0;

      if (direction === "left") {
        for (let r = 0; r < SIZE; r++) {
          const result = slideLine(grid[r].slice(), tileGrid[r].slice());
          gained += result.gained;
          if (result.cells.some((cell, i) => cell.value !== grid[r][i])) moved = true;
          setRow(r, result.cells);
        }
      } else if (direction === "right") {
        for (let r = 0; r < SIZE; r++) {
          const reversed = grid[r].slice().reverse();
          const revTiles = tileGrid[r].slice().reverse();
          const result = slideLine(reversed, revTiles);
          gained += result.gained;
          const cells = result.cells.reverse();
          if (cells.some((cell, i) => cell.value !== grid[r][i])) moved = true;
          setRow(r, cells);
        }
      } else if (direction === "up") {
        for (let c = 0; c < SIZE; c++) {
          const result = slideLine(getColumn(c), getColumnTiles(c));
          gained += result.gained;
          const before = getColumn(c);
          setColumn(c, result.cells);
          if (result.cells.some((cell, i) => cell.value !== before[i])) moved = true;
        }
      } else if (direction === "down") {
        for (let c = 0; c < SIZE; c++) {
          const reversed = getColumn(c).reverse();
          const revTiles = getColumnTiles(c).reverse();
          const result = slideLine(reversed, revTiles);
          gained += result.gained;
          const cells = result.cells.reverse();
          const before = getColumn(c);
          setColumn(c, cells);
          if (cells.some((cell, i) => cell.value !== before[i])) moved = true;
        }
      }

      if (!moved) return false;

      score += gained;
      ctx?.sfx?.(gained > 0 ? "match" : "move");
      spawnTile();
      updateUI(direction);

      if (grid.some((row) => row.some((v) => v >= 2048))) {
        statusEl.textContent = "2048 달성! 계속 플레이하거나 새 게임을 시작하세요.";
      }

      if (!canMove()) {
        gameOver = true;
        statusEl.textContent = "더 이상 움직일 수 없습니다. 새 게임을 시작하세요.";
        if (!scoreRecorded) {
          scoreRecorded = true;
          ctx?.recordScore?.(score);
          ctx?.sfx?.("lose");
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

    function updateUI(direction) {
      scoreEl.textContent = `점수: ${score}`;
      syncBoardMetrics();
      const g = gsap();
      const tweens = [];
      const activeIds = new Set();

      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const cell = tileGrid[r][c];
          if (!cell) continue;
          activeIds.add(cell.id);
          let el = tileEls.get(cell.id);
          if (!el) {
            el = createTileEl(cell.id, cell.value, r, c);
            if (lastSpawn && lastSpawn.id === cell.id) {
              if (g) {
                g.set(el, { scale: 0 });
                tweens.push({ el, spawn: true });
              }
            }
          } else {
            el.className = tileClass(cell.value);
            el.textContent = String(cell.value);
            const p = cellPos(r, c);
            if (g) {
              tweens.push({ el, x: p.x, y: p.y });
            } else {
              el.style.left = `${p.x}px`;
              el.style.top = `${p.y}px`;
            }
          }
        }
      }

      tileEls.forEach((el, id) => {
        if (!activeIds.has(id)) {
          el.remove();
          tileEls.delete(id);
        }
      });

      if (g && tweens.length) {
        const tl = g.timeline();
        tweens.forEach((t) => {
          if (t.spawn) {
            tl.to(t.el, { scale: 1, duration: 0.16, ease: "back.out(1.4)", clearProps: "transform" }, 0.12);
          } else {
            tl.to(t.el, { left: t.x, top: t.y, duration: 0.14, ease: "power2.out" }, 0);
          }
        });
      }

      lastSpawn = null;
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
      window.GameAnim?.killTarget?.(tilesEl?.querySelectorAll?.(".tile-2048-real"));
      grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
      tileGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      tileEls.clear();
      tilesEl.innerHTML = "";
      score = 0;
      gameOver = false;
      scoreRecorded = false;
      statusEl.textContent = "";
      buildBackground();
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
    refreshGameAccess,
    destroy
  };
})();
