(function () {
  const WAIT_MSG = window.Games?.GAME_START_WAIT_MSG || "「게임 시작」 버튼을 눌러 주세요.";

  function toolbarHtml(statId, resetId) {
    return window.Games?.toolbarHtml?.(statId, resetId) || `
      <div class="game-toolbar">
        <div class="game-toolbar-stat" id="${statId}"></div>
        <button type="button" class="minesweeper-reset game-start-btn" id="${resetId}" title="게임 시작">게임 시작</button>
      </div>`;
  }

  function setupLeaderboard(ctx, container) {
    const root = container.querySelector(".mini-game");
    if (root && ctx?.mountLeaderboard) ctx.mountLeaderboard(root);
  }

  function renderSnake(container, ctx) {
    const COLS = 16;
    const ROWS = 16;
    const CELL = 18;
    const W = COLS * CELL;
    const H = ROWS * CELL;
    const fx = window.GameFX;

    const game = renderCanvasGame(container, ctx, {
      statId: "snake-score",
      resetId: "snake-reset",
      canvasId: "snake-canvas",
      statusId: "snake-status",
      hint: "방향키로 뱀을 조종하세요.",
      width: W,
      height: H,
      onReset(g, canvas, stat, status) {
        stat.textContent = "점수: 0";
        status.textContent = "";
        return {
          snake: [{ x: 8, y: 8 }],
          display: [{ x: 8, y: 8 }],
          dir: { x: 1, y: 0 },
          nextDir: { x: 1, y: 0 },
          food: { x: 12, y: 8 },
          score: 0,
          over: false,
          tickMs: 0,
          interval: 130,
          particles: [],
          foodPulse: 0
        };
      },
      loop(g, canvas, s, stat, status, dt) {
        fx.update(s.particles, dt);
        s.foodPulse += dt * 0.006;

        if (!s.over) {
          s.tickMs += dt;
          if (s.tickMs >= s.interval) {
            s.tickMs = 0;
            s.dir = s.nextDir;
            const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
            if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
              s.over = true;
              status.textContent = "벽에 부딪혔습니다!";
              fx.burst(s.particles, head.x * CELL + CELL / 2, head.y * CELL + CELL / 2, {
                count: 24,
                color: "#4ade80",
                speed: 4
              });
              ctx?.recordScore?.(s.score);
              ctx?.sfx?.("hit");
            } else if (s.snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
              s.over = true;
              status.textContent = "자신의 몸에 부딪혔습니다!";
              fx.burst(s.particles, head.x * CELL + CELL / 2, head.y * CELL + CELL / 2, {
                count: 20,
                color: "#f87171",
                speed: 3.5
              });
              ctx?.recordScore?.(s.score);
              ctx?.sfx?.("hit");
            } else {
              s.snake.unshift(head);
              if (head.x === s.food.x && head.y === s.food.y) {
                s.score += 10;
                stat.textContent = `점수: ${s.score}`;
                ctx?.sfx?.("eat");
                fx.burst(s.particles, head.x * CELL + CELL / 2, head.y * CELL + CELL / 2, {
                  count: 14,
                  color: "#fbbf24",
                  speed: 3
                });
                do {
                  s.food = {
                    x: Math.floor(Math.random() * COLS),
                    y: Math.floor(Math.random() * ROWS)
                  };
                } while (s.snake.some((seg) => seg.x === s.food.x && seg.y === s.food.y));
              } else {
                s.snake.pop();
              }
            }
          }
        }

        const lerp = Math.min(1, dt / 120);
        while (s.display.length < s.snake.length) {
          s.display.push({ ...s.snake[s.display.length] });
        }
        while (s.display.length > s.snake.length) s.display.pop();
        for (let i = 0; i < s.snake.length; i++) {
          s.display[i].x += (s.snake[i].x - s.display[i].x) * lerp;
          s.display[i].y += (s.snake[i].y - s.display[i].y) * lerp;
        }

        fx.fillBg(g, canvas.width, canvas.height, "#0a1628", "#0f172a");
        g.strokeStyle = "rgba(51, 65, 85, 0.35)";
        g.lineWidth = 1;
        for (let x = 0; x <= COLS; x++) {
          g.beginPath();
          g.moveTo(x * CELL, 0);
          g.lineTo(x * CELL, H);
          g.stroke();
        }
        for (let y = 0; y <= ROWS; y++) {
          g.beginPath();
          g.moveTo(0, y * CELL);
          g.lineTo(W, y * CELL);
          g.stroke();
        }

        const fp = 1 + Math.sin(s.foodPulse) * 0.12;
        fx.glowCircle(
          g,
          s.food.x * CELL + CELL / 2,
          s.food.y * CELL + CELL / 2,
          CELL * 0.32 * fp,
          "#fbbf24",
          "#f59e0b"
        );

        s.display.forEach((seg, i) => {
          const px = seg.x * CELL + 2;
          const py = seg.y * CELL + 2;
          const sz = CELL - 4;
          if (i === 0) {
            fx.roundRect(g, px, py, sz, sz, 6, "#4ade80", "#22c55e");
          } else {
            const t = 1 - i / Math.max(s.display.length, 1);
            g.fillStyle = `rgba(34, 197, 94, ${0.45 + t * 0.45})`;
            g.beginPath();
            g.roundRect(px, py, sz, sz, 5);
            g.fill();
          }
        });

        fx.draw(g, s.particles);
        return s;
      }
    });

    function onKey(e) {
      const s = game.getState();
      if (!s || s.over) return;
      const map = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }
      };
      const nd = map[e.key];
      if (!nd) return;
      if (s.dir.x + nd.x === 0 && s.dir.y + nd.y === 0) return;
      s.nextDir = nd;
      e.preventDefault();
    }

    document.addEventListener("keydown", onKey);
    ctx.addCleanup(() => document.removeEventListener("keydown", onKey));
    setupLeaderboard(ctx, container);
  }

  function renderGuessNumber(container, ctx) {
    let answer = Math.floor(Math.random() * 100) + 1;
    let tries = 0;
    let sessionActive = false;

    container.innerHTML = `
      <div class="mini-game">
        ${toolbarHtml("guess-stat", "guess-reset")}
        <p class="minesweeper-hint">1 ~ 100 사이 숫자를 맞춰 보세요.</p>
        <div class="guess-row">
          <input id="guess-input" type="number" min="1" max="100" placeholder="숫자 입력" disabled>
          <button type="button" class="action-btn guess-btn" id="guess-submit" disabled>확인</button>
        </div>
        <p class="minesweeper-status" id="guess-status">${WAIT_MSG}</p>
      </div>`;

    const input = document.getElementById("guess-input");
    const status = document.getElementById("guess-status");
    const stat = document.getElementById("guess-stat");
    const submitBtn = document.getElementById("guess-submit");

    function startGame() {
      sessionActive = true;
      answer = Math.floor(Math.random() * 100) + 1;
      tries = 0;
      input.disabled = false;
      submitBtn.disabled = false;
      input.value = "";
      stat.textContent = "시도: 0회";
      status.textContent = "숫자를 입력하세요.";
      input.focus();
    }

    function submit() {
      if (!sessionActive) return;
      const value = Number(input.value);
      if (!value || value < 1 || value > 100) {
        status.textContent = "1 ~ 100 사이 숫자를 입력하세요.";
        return;
      }
      tries++;
      stat.textContent = `시도: ${tries}회`;
      if (value === answer) {
        status.textContent = `정답! ${tries}번 만에 맞췄습니다.`;
        input.disabled = true;
        ctx?.recordScore?.(tries);
        ctx?.sfx?.("win");
        return;
      }
      status.textContent = `시도 ${tries}회 — ${value < answer ? "더 큽니다 ▲" : "더 작습니다 ▼"}`;
      input.value = "";
      input.focus();
    }

    document.getElementById("guess-submit").addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    ctx.bindGameStart(document.getElementById("guess-reset"), startGame);
    setupLeaderboard(ctx, container);
  }

  function renderReaction(container, ctx) {
    let state = "idle";
    let startTime = 0;
    let timeoutId = null;
    let best = null;
    let sessionActive = false;

    container.innerHTML = `
      <div class="mini-game">
        ${toolbarHtml("reaction-stat", "reaction-reset")}
        <button type="button" class="reaction-box" id="reaction-box" disabled>게임 시작 후 플레이</button>
        <p class="minesweeper-hint">초록색이 되면 최대한 빠르게 클릭하세요.</p>
        <p class="minesweeper-status" id="reaction-status">${WAIT_MSG}</p>
      </div>`;

    const box = document.getElementById("reaction-box");
    const stat = document.getElementById("reaction-stat");
    const status = document.getElementById("reaction-status");

    function setBox(cls, text, disabled = false) {
      box.className = `reaction-box ${cls}`;
      box.textContent = text;
      box.disabled = disabled;
    }

    function startSession() {
      sessionActive = true;
      state = "idle";
      clearTimeout(timeoutId);
      status.textContent = "클릭하여 라운드를 시작하세요.";
      setBox("", "클릭하여 시작", false);
    }

    function showWaiting() {
      sessionActive = false;
      clearTimeout(timeoutId);
      state = "idle";
      status.textContent = WAIT_MSG;
      setBox("", "게임 시작 후 플레이", true);
    }

    function startRound() {
      clearTimeout(timeoutId);
      state = "waiting";
      setBox("reaction-wait", "기다리세요...");
      status.textContent = "";
      const delay = 1000 + Math.random() * 3000;
      timeoutId = setTimeout(() => {
        state = "ready";
        startTime = performance.now();
        setBox("reaction-go", "클릭!");
      }, delay);
    }

    box.addEventListener("click", () => {
      if (!sessionActive) return;
      if (state === "idle") {
        startRound();
        return;
      }
      if (state === "waiting") {
        clearTimeout(timeoutId);
        state = "idle";
        setBox("reaction-bad", "너무 빨라요!");
        status.textContent = "초록색이 될 때까지 기다리세요.";
        return;
      }
      if (state === "ready") {
        const ms = Math.round(performance.now() - startTime);
        if (best === null || ms < best) best = ms;
        stat.textContent = `최고: ${best}ms`;
        status.textContent = `반응 속도: ${ms}ms`;
        ctx?.recordScore?.(ms);
        ctx?.sfx?.("score");
        state = "idle";
        setBox("reaction-done", `${ms}ms`);
      }
    });

    ctx.bindGameStart(document.getElementById("reaction-reset"), startSession);
    showWaiting();

    ctx.addCleanup(() => clearTimeout(timeoutId));
    setupLeaderboard(ctx, container);
  }

  function renderRPS(container, ctx) {
    const choices = [
      { id: "rock", label: "✊ 바위" },
      { id: "paper", label: "✋ 보" },
      { id: "scissors", label: "✌️ 가위" }
    ];
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let sessionActive = false;

    container.innerHTML = `
      <div class="mini-game">
        ${toolbarHtml("rps-score", "rps-reset")}
        <div class="rps-buttons" id="rps-buttons"></div>
        <p class="minesweeper-status" id="rps-status">${WAIT_MSG}</p>
      </div>`;

    const scoreEl = document.getElementById("rps-score");
    const status = document.getElementById("rps-status");
    const btnWrap = document.getElementById("rps-buttons");

    function updateScore() {
      scoreEl.textContent = `승 ${wins} · 패 ${losses} · 무 ${draws}`;
    }

    function play(player) {
      if (!sessionActive) return;
      const ai = choices[Math.floor(Math.random() * 3)].id;
      let result = "draw";
      if (
        (player === "rock" && ai === "scissors") ||
        (player === "paper" && ai === "rock") ||
        (player === "scissors" && ai === "paper")
      ) {
        result = "win";
        wins++;
        ctx?.recordScore?.(wins);
        ctx?.sfx?.("win");
      } else if (player !== ai) {
        result = "lose";
        losses++;
        ctx?.sfx?.("lose");
      } else {
        draws++;
      }
      const pl = choices.find((c) => c.id === player).label;
      const al = choices.find((c) => c.id === ai).label;
      status.textContent =
        result === "win"
          ? `${pl} vs ${al} — 승리!`
          : result === "lose"
            ? `${pl} vs ${al} — 패배`
            : `${pl} vs ${al} — 무승부`;
      updateScore();
    }

    choices.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "action-btn rps-btn";
      btn.textContent = c.label;
      btn.disabled = true;
      btn.addEventListener("click", () => play(c.id));
      btnWrap.appendChild(btn);
    });

    function startSession() {
      sessionActive = true;
      wins = losses = draws = 0;
      updateScore();
      status.textContent = "선택하세요!";
      btnWrap.querySelectorAll(".rps-btn").forEach((btn) => {
        btn.disabled = false;
      });
    }

    function showWaiting() {
      sessionActive = false;
      wins = losses = draws = 0;
      updateScore();
      status.textContent = WAIT_MSG;
      btnWrap.querySelectorAll(".rps-btn").forEach((btn) => {
        btn.disabled = true;
      });
    }

    ctx.bindGameStart(document.getElementById("rps-reset"), startSession);
    showWaiting();
    setupLeaderboard(ctx, container);
  }

  function renderMemory(container, ctx) {
    const icons = ["🍎", "🍋", "🍇", "🍒", "🥝", "🍑", "🍉", "🍌"];
    let cards = [];
    let flipped = [];
    let matched = 0;
    let lock = false;
    let startTime = Date.now();
    let sessionActive = false;

    container.innerHTML = `
      <div class="mini-game">
        ${toolbarHtml("memory-score", "memory-reset")}
        <div class="memory-grid" id="memory-grid"></div>
        <p class="minesweeper-hint">같은 그림의 짝을 찾으세요.</p>
        <p class="minesweeper-status" id="memory-status">${WAIT_MSG}</p>
      </div>`;

    const grid = document.getElementById("memory-grid");
    const scoreEl = document.getElementById("memory-score");
    const statusEl = document.getElementById("memory-status");

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function paint() {
      scoreEl.textContent = `맞춤: ${matched} / ${icons.length}`;
      grid.innerHTML = "";
      cards.forEach((card, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "memory-card";
        if (card.matched || card.open) {
          btn.textContent = card.icon;
          btn.classList.add("open");
        } else {
          btn.textContent = "?";
        }
        btn.disabled = card.matched || lock || !sessionActive;
        btn.addEventListener("click", () => flip(index));
        grid.appendChild(btn);
      });
    }

    function flip(index) {
      if (!sessionActive) return;
      const card = cards[index];
      if (card.matched || card.open || lock) return;
      card.open = true;
      flipped.push(index);
      paint();
      if (flipped.length < 2) return;
      lock = true;
      const [a, b] = flipped;
      if (cards[a].icon === cards[b].icon) {
        cards[a].matched = cards[b].matched = true;
        matched++;
        flipped = [];
        lock = false;
        ctx?.sfx?.("match");
        paint();
        if (matched === icons.length) {
          scoreEl.textContent = "완료! 모든 짝을 찾았습니다.";
          const seconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
          ctx?.recordScore?.(seconds);
          ctx?.sfx?.("win");
        }
        return;
      }
      setTimeout(() => {
        cards[a].open = cards[b].open = false;
        flipped = [];
        lock = false;
        ctx?.sfx?.("flip");
        paint();
      }, 700);
    }

    function reset() {
      sessionActive = true;
      statusEl.textContent = "";
      cards = shuffle([...icons, ...icons]).map((icon) => ({ icon, open: false, matched: false }));
      flipped = [];
      matched = 0;
      lock = false;
      startTime = Date.now();
      paint();
    }

    function showWaiting() {
      sessionActive = false;
      cards = [];
      flipped = [];
      matched = 0;
      lock = true;
      scoreEl.textContent = "맞춤: 0 / 8";
      statusEl.textContent = WAIT_MSG;
      grid.innerHTML = "";
    }

    ctx.bindGameStart(document.getElementById("memory-reset"), reset);
    showWaiting();
    setupLeaderboard(ctx, container);
  }

  function renderCanvasGame(container, ctx, options) {
    container.innerHTML = `
      <div class="mini-game">
        ${toolbarHtml(options.statId, options.resetId)}
        <canvas class="game-canvas" id="${options.canvasId}" width="${options.width}" height="${options.height}"></canvas>
        <p class="minesweeper-hint">${options.hint}</p>
        <p class="minesweeper-status" id="${options.statusId}"></p>
      </div>`;

    const canvas = document.getElementById(options.canvasId);
    const g = canvas.getContext("2d");
    const stat = document.getElementById(options.statId);
    const status = document.getElementById(options.statusId);
    let frameId = null;
    let lastTs = 0;
    let started = false;
    let state = null;

    function drawIdle() {
      g.fillStyle = "#0f172a";
      g.fillRect(0, 0, canvas.width, canvas.height);
    }

    function showWaiting() {
      started = false;
      lastTs = 0;
      stat.textContent = options.statIdle || "점수: 0";
      status.textContent = WAIT_MSG;
      drawIdle();
    }

    function beginGame() {
      started = true;
      lastTs = 0;
      state = options.onReset(g, canvas, stat, status);
      status.textContent = "";
    }

    function frame(ts) {
      const dt = lastTs ? Math.min(48, ts - lastTs) : 16;
      lastTs = ts;
      if (started) {
        state = options.loop(g, canvas, state, stat, status, dt) || state;
      }
      frameId = requestAnimationFrame(frame);
    }

    frameId = requestAnimationFrame(frame);
    ctx.bindGameStart(document.getElementById(options.resetId), beginGame);
    showWaiting();

    ctx.addCleanup(() => cancelAnimationFrame(frameId));
    return {
      getState: () => state,
      setState: (next) => {
        state = next;
      },
      getCanvas: () => canvas,
      isStarted: () => started
    };
  }

  function renderPong(container, ctx) {
    const fx = window.GameFX;
    const game = renderCanvasGame(container, ctx, {
      statId: "pong-stat",
      resetId: "pong-reset",
      canvasId: "pong-canvas",
      statusId: "pong-status",
      hint: "← → 키로 패들을 움직이세요.",
      width: 360,
      height: 360,
      onReset(g, canvas, stat) {
        stat.textContent = "점수: 0";
        return {
          ball: { x: 180, y: 180, vx: 3, vy: 2 },
          player: 150,
          ai: 150,
          pw: 60,
          playerScore: 0,
          keys: {},
          trail: [],
          particles: [],
          shake: null,
          playerSquash: 1
        };
      },
      loop(g, canvas, s, stat, status, dt) {
        fx.update(s.particles, dt);
        s.shake = fx.tickShake(s.shake, dt);
        s.playerSquash += (1 - s.playerSquash) * 0.15;

        if (s.keys.ArrowLeft) s.player = Math.max(0, s.player - 5);
        if (s.keys.ArrowRight) s.player = Math.min(canvas.width - s.pw, s.player + 5);
        s.ai += (s.ball.x - s.ai - s.pw / 2) * 0.08;
        s.ai = Math.max(0, Math.min(canvas.width - s.pw, s.ai));
        s.ball.x += s.ball.vx;
        s.ball.y += s.ball.vy;
        if (s.ball.x <= 4 || s.ball.x >= canvas.width - 4) s.ball.vx *= -1;
        if (s.ball.y <= 4) s.ball.vy *= -1;
        if (s.ball.y >= canvas.height - 14 && s.ball.x > s.player && s.ball.x < s.player + s.pw) {
          s.ball.vy = -Math.abs(s.ball.vy);
          s.playerSquash = 0.82;
          ctx?.sfx?.("pong");
          fx.burst(s.particles, s.ball.x, s.ball.y, { count: 8, color: "#60a5fa", speed: 2.5, angle: -Math.PI / 2 });
        }
        if (s.ball.y <= 14 && s.ball.x > s.ai && s.ball.x < s.ai + s.pw) {
          s.ball.vy = Math.abs(s.ball.vy);
          s.playerScore++;
          stat.textContent = `점수: ${s.playerScore}`;
          ctx?.recordScore?.(s.playerScore);
          ctx?.sfx?.("score");
          s.shake = fx.addShake(s.shake, 5, 180);
          fx.burst(s.particles, s.ball.x, s.ball.y, { count: 16, color: "#f87171", speed: 3 });
        }
        if (s.ball.y > canvas.height) {
          s.ball = { x: 180, y: 180, vx: 3 * (Math.random() > 0.5 ? 1 : -1), vy: -2 };
        }

        fx.pushTrail(s.trail, s.ball.x, s.ball.y);

        const off = fx.offset(s.shake);
        g.save();
        g.translate(off.x, off.y);
        fx.fillBg(g, canvas.width, canvas.height, "#0c1222", "#111827");
        g.setLineDash([6, 10]);
        g.strokeStyle = "rgba(148, 163, 184, 0.25)";
        g.beginPath();
        g.moveTo(0, canvas.height / 2);
        g.lineTo(canvas.width, canvas.height / 2);
        g.stroke();
        g.setLineDash([]);

        fx.drawTrail(g, s.trail, "#93c5fd");
        const ph = 8 * s.playerSquash;
        const py = canvas.height - 10 - (8 - ph);
        fx.roundRect(g, s.player, py, s.pw, ph, 4, "#60a5fa", "#3b82f6");
        fx.roundRect(g, s.ai, 2, s.pw, 8, 4, "#f87171", "#ef4444");
        fx.glowCircle(g, s.ball.x, s.ball.y, 6, "#f8fafc", "#e2e8f0");
        fx.draw(g, s.particles);
        g.restore();
        return s;
      }
    });

    function onKey(e) {
      const s = game.getState();
      if (!s?.keys) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        s.keys[e.key] = e.type === "keydown";
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);
    ctx.addCleanup(() => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
    });
    setupLeaderboard(ctx, container);
  }

  function renderBreakout(container, ctx) {
    const bricks = [];
    const BRICK_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#ec4899"];
    const fx = window.GameFX;
    const game = renderCanvasGame(container, ctx, {
      statId: "break-stat",
      resetId: "break-reset",
      canvasId: "break-canvas",
      statusId: "break-status",
      hint: "← → 키로 패들을 움직여 벽돌을 깨세요.",
      width: 360,
      height: 420,
      onReset(g, canvas, stat, status) {
        bricks.length = 0;
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 8; c++) {
            bricks.push({
              x: c * 44 + 4,
              y: r * 27 + 45,
              w: 40,
              h: 14,
              alive: true,
              color: BRICK_COLORS[r]
            });
          }
        }
        status.textContent = "";
        stat.textContent = `남은 벽돌: ${bricks.length}`;
        return {
          ball: { x: 180, y: 300, vx: 2.5, vy: -2.5 },
          paddle: 140,
          pw: 64,
          keys: {},
          win: false,
          trail: [],
          particles: [],
          shake: null,
          brickScore: 0
        };
      },
      loop(g, canvas, s, stat, status, dt) {
        if (s.win) {
          fx.update(s.particles, dt);
          fx.fillBg(g, canvas.width, canvas.height);
          fx.draw(g, s.particles);
          return s;
        }
        fx.update(s.particles, dt);
        s.shake = fx.tickShake(s.shake, dt);

        if (s.keys.ArrowLeft) s.paddle = Math.max(0, s.paddle - 5);
        if (s.keys.ArrowRight) s.paddle = Math.min(canvas.width - s.pw, s.paddle + 5);
        s.ball.x += s.ball.vx;
        s.ball.y += s.ball.vy;
        if (s.ball.x <= 4 || s.ball.x >= canvas.width - 4) s.ball.vx *= -1;
        if (s.ball.y <= 4) s.ball.vy *= -1;
        if (s.ball.y >= canvas.height - 14 && s.ball.x > s.paddle && s.ball.x < s.paddle + s.pw) {
          s.ball.vy = -Math.abs(s.ball.vy);
          const hit = (s.ball.x - (s.paddle + s.pw / 2)) / (s.pw / 2);
          s.ball.vx += hit * 0.8;
          fx.burst(s.particles, s.ball.x, s.ball.y, { count: 6, color: "#60a5fa", speed: 2, angle: -Math.PI / 2 });
        }
        if (s.ball.y > canvas.height) {
          status.textContent = "공을 놓쳤습니다. ↺ 로 다시 시작";
          s.ball.vy = 0;
          s.ball.vx = 0;
        }
        bricks.forEach((b) => {
          if (!b.alive) return;
          if (
            s.ball.x > b.x &&
            s.ball.x < b.x + b.w &&
            s.ball.y > b.y &&
            s.ball.y < b.y + b.h
          ) {
            b.alive = false;
            s.ball.vy *= -1;
            s.brickScore += 10;
            ctx?.sfx?.("hit");
            s.shake = fx.addShake(s.shake, 4, 120);
            fx.burst(s.particles, b.x + b.w / 2, b.y + b.h / 2, {
              count: 14,
              color: b.color,
              speed: 3.5
            });
          }
        });
        const left = bricks.filter((b) => b.alive).length;
        stat.textContent = `점수: ${s.brickScore} · 남은 벽돌: ${left}`;
        if (left === 0) {
          s.win = true;
          status.textContent = "클리어!";
          fx.burst(s.particles, canvas.width / 2, canvas.height / 2, {
            count: 40,
            color: "#fbbf24",
            speed: 5,
            spread: Math.PI * 2
          });
          ctx?.recordScore?.(s.brickScore);
          ctx?.sfx?.("win");
        }

        fx.pushTrail(s.trail, s.ball.x, s.ball.y);
        const off = fx.offset(s.shake);
        g.save();
        g.translate(off.x, off.y);
        fx.fillBg(g, canvas.width, canvas.height, "#0b1020", "#0f172a");
        bricks.forEach((b) => {
          if (!b.alive) return;
          fx.roundRect(g, b.x, b.y, b.w, b.h, 3, b.color, b.color);
        });
        fx.drawTrail(g, s.trail, "#c4b5fd");
        fx.roundRect(g, s.paddle, canvas.height - 10, s.pw, 8, 4, "#60a5fa", "#38bdf8");
        fx.glowCircle(g, s.ball.x, s.ball.y, 6, "#f8fafc", "#e2e8f0");
        fx.draw(g, s.particles);
        g.restore();
        return s;
      }
    });

    function onKey(e) {
      const s = game.getState();
      if (!s?.keys) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        s.keys[e.key] = e.type === "keydown";
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);
    ctx.addCleanup(() => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
    });
    setupLeaderboard(ctx, container);
  }

  function renderTetris(container, ctx) {
    const COLS = 10;
    const ROWS = 16;
    const SHAPES = {
      I: [[1, 1, 1, 1]],
      O: [
        [1, 1],
        [1, 1]
      ],
      T: [
        [0, 1, 0],
        [1, 1, 1]
      ],
      L: [
        [1, 0],
        [1, 0],
        [1, 1]
      ]
    };

    let board = [];
    let piece = null;
    let score = 0;
    let rafId = null;
    let lastDropAt = 0;
    const DROP_MS = 520;
    let over = false;
    let sessionActive = false;

    function gsap() {
      return window.GameAnim?.gsap?.() || window.gsap;
    }

    function animateActive(fromVars) {
      const g = gsap();
      if (!g) return;
      const active = boardEl.querySelectorAll(".tetris-cell.active");
      if (!active.length) return;
      g.from(active, {
        ...fromVars,
        duration: fromVars.duration ?? 0.11,
        ease: "power2.out",
        clearProps: "transform"
      });
    }

    container.innerHTML = `
      <div class="mini-game">
        ${toolbarHtml("tetris-score", "tetris-reset")}
        <div class="tetris-board" id="tetris-board"></div>
        <p class="minesweeper-hint">← → 이동 · ↑ 회전 · ↓ 빠르게 내리기</p>
        <p class="minesweeper-status" id="tetris-status"></p>
      </div>`;

    const boardEl = document.getElementById("tetris-board");
    const scoreEl = document.getElementById("tetris-score");
    const statusEl = document.getElementById("tetris-status");

    function emptyBoard() {
      return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    function newPiece() {
      const keys = Object.keys(SHAPES);
      const shape = SHAPES[keys[Math.floor(Math.random() * keys.length)]].map((r) => r.slice());
      return { shape, x: 3, y: 0 };
    }

    function collides(px, py, shape) {
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const ny = py + r;
          const nx = px + c;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && board[ny][nx]) return true;
        }
      }
      return false;
    }

    function merge() {
      piece.shape.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (!cell) return;
          const y = piece.y + r;
          const x = piece.x + c;
          if (y >= 0) board[y][x] = 1;
        });
      });
    }

    function clearLines() {
      const before = board.length;
      board = board.filter((row) => row.some((v) => !v));
      const removed = before - board.length;
      while (board.length < ROWS) {
        board.unshift(Array(COLS).fill(0));
        score += 100;
      }
      if (removed > 0) ctx?.sfx?.("line");
    }

    function paint(opts) {
      const animateDrop = opts?.animateDrop;
      const animateMove = opts?.animateMove;
      scoreEl.textContent = `점수: ${score}`;
      boardEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
      boardEl.innerHTML = "";
      const view = board.map((row) => row.slice());
      if (piece) {
        piece.shape.forEach((row, r) => {
          row.forEach((cell, c) => {
            if (!cell) return;
            const y = piece.y + r;
            const x = piece.x + c;
            if (y >= 0 && y < ROWS && x >= 0 && x < COLS) view[y][x] = 2;
          });
        });
      }
      view.forEach((row) => {
        row.forEach((v) => {
          const cell = document.createElement("div");
          cell.className = "tetris-cell" + (v ? " filled" : "") + (v === 2 ? " active" : "");
          boardEl.appendChild(cell);
        });
      });
      if (animateDrop) animateActive({ y: -16, duration: 0.13 });
      if (animateMove) animateActive(animateMove);
    }

    function tick(now) {
      if (!sessionActive || over) return;
        if (!lastDropAt) lastDropAt = now;
        if (now - lastDropAt >= DROP_MS) {
          lastDropAt = now;
          drop(true);
        }
        rafId = requestAnimationFrame(tick);
    }

    function drop(animated) {
      if (!sessionActive || over || !piece) return;
      if (!collides(piece.x, piece.y + 1, piece.shape)) {
        piece.y++;
        paint({ animateDrop: !!animated });
        return;
      }
      merge();
      clearLines();
      piece = newPiece();
      if (collides(piece.x, piece.y, piece.shape)) {
        over = true;
        statusEl.textContent = "게임 오버";
        if (rafId) cancelAnimationFrame(rafId);
        ctx?.recordScore?.(score);
        ctx?.sfx?.("lose");
      }
      paint();
    }

    function rotate() {
      if (!sessionActive || !piece || over) return;
      const rotated = piece.shape[0].map((_, i) =>
        piece.shape.map((row) => row[i]).reverse()
      );
      if (!collides(piece.x, piece.y, rotated)) {
        piece.shape = rotated;
        paint({ animateMove: { rotation: 90, scale: 0.92, duration: 0.1 } });
      }
    }

    function onKey(e) {
      if (!sessionActive || !piece || over) return;
      if (e.key === "ArrowLeft" && !collides(piece.x - 1, piece.y, piece.shape)) {
        piece.x--;
        paint({ animateMove: { x: 10, duration: 0.08 } });
      } else if (e.key === "ArrowRight" && !collides(piece.x + 1, piece.y, piece.shape)) {
        piece.x++;
        paint({ animateMove: { x: -10, duration: 0.08 } });
      } else if (e.key === "ArrowUp") {
        rotate();
      } else if (e.key === "ArrowDown") {
        drop(true);
        lastDropAt = performance.now();
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
      }
    }

    function reset() {
      if (rafId) cancelAnimationFrame(rafId);
      sessionActive = true;
      board = emptyBoard();
      piece = newPiece();
      score = 0;
      over = false;
      lastDropAt = 0;
      statusEl.textContent = "";
      paint();
      rafId = requestAnimationFrame(tick);
    }

    function showWaiting() {
      if (rafId) cancelAnimationFrame(rafId);
      sessionActive = false;
      board = emptyBoard();
      piece = null;
      score = 0;
      over = true;
      scoreEl.textContent = "점수: 0";
      statusEl.textContent = WAIT_MSG;
      paint();
    }

    ctx.bindGameStart(document.getElementById("tetris-reset"), reset);
    document.addEventListener("keydown", onKey);
    ctx.addCleanup(() => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", onKey);
    });
    showWaiting();
    setupLeaderboard(ctx, container);
  }

  function renderWordle(container, ctx) {
    const WORDS = ["APPLE", "BRAIN", "CHAIR", "DANCE", "EARTH", "FLAME", "GRAPE", "HEART", "IMAGE", "JUICE"];
    let answer = WORDS[Math.floor(Math.random() * WORDS.length)];
    let row = 0;
    let col = 0;
    let guesses = Array.from({ length: 6 }, () => Array(5).fill(""));
    let done = false;

    container.innerHTML = `
      <div class="mini-game">
        <h3 class="mini-game-title">Wordle</h3>
        <p class="minesweeper-hint">5글자 영어 단어를 6번 안에 맞추세요.</p>
        <div class="wordle-grid" id="wordle-grid"></div>
        <div class="wordle-keys" id="wordle-keys"></div>
        <p class="minesweeper-status" id="wordle-status"></p>
        <button type="button" class="secondary-btn" id="wordle-reset">새 게임</button>
      </div>`;

    const grid = document.getElementById("wordle-grid");
    const keysEl = document.getElementById("wordle-keys");
    const status = document.getElementById("wordle-status");

    function paint() {
      grid.innerHTML = "";
      for (let r = 0; r < 6; r++) {
        const rowEl = document.createElement("div");
        rowEl.className = "wordle-row";
        for (let c = 0; c < 5; c++) {
          const cell = document.createElement("div");
          cell.className = "wordle-cell";
          cell.textContent = guesses[r][c];
          if (r < row || (r === row && done)) {
            const ch = guesses[r][c];
            if (answer[c] === ch) cell.classList.add("correct");
            else if (answer.includes(ch)) cell.classList.add("present");
            else cell.classList.add("absent");
          }
          rowEl.appendChild(cell);
        }
        grid.appendChild(rowEl);
      }
    }

    function submitGuess() {
      const word = guesses[row].join("");
      if (word.length < 5) return;
      if (word === answer) {
        done = true;
        status.textContent = `${row + 1}번 만에 정답!`;
        ctx?.recordScore?.(row + 1);
        ctx?.sfx?.("win");
        row++;
        paint();
        return;
      }
      row++;
      col = 0;
      if (row >= 6) {
        done = true;
        status.textContent = `실패! 정답: ${answer}`;
        ctx?.sfx?.("lose");
      }
      paint();
    }

    function pressKey(key) {
      if (done) return;
      if (key === "Enter") {
        submitGuess();
        return;
      }
      if (key === "Backspace") {
        if (col > 0) col--;
        guesses[row][col] = "";
        paint();
        return;
      }
      if (!/^[A-Z]$/.test(key) || col >= 5) return;
      guesses[row][col] = key;
      col++;
      paint();
    }

    keysEl.innerHTML = "";
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((k) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wordle-key";
      btn.textContent = k;
      btn.addEventListener("click", () => pressKey(k));
      keysEl.appendChild(btn);
    });
    ["Enter", "⌫"].forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wordle-key wide";
      btn.textContent = label;
      btn.addEventListener("click", () => pressKey(label === "⌫" ? "Backspace" : "Enter"));
      keysEl.appendChild(btn);
    });

    function onKey(e) {
      if (e.key === "Enter") pressKey("Enter");
      else if (e.key === "Backspace") pressKey("Backspace");
      else if (/^[a-zA-Z]$/.test(e.key)) pressKey(e.key.toUpperCase());
    }

    ctx.addCleanup(() => document.removeEventListener("keydown", onKey));
    document.getElementById("wordle-reset").addEventListener("click", () => {
      answer = WORDS[Math.floor(Math.random() * WORDS.length)];
      row = 0;
      col = 0;
      guesses = Array.from({ length: 6 }, () => Array(5).fill(""));
      done = false;
      status.textContent = "";
      paint();
    });
    document.addEventListener("keydown", onKey);
    ctx.addCleanup(() => document.removeEventListener("keydown", onKey));
    paint();
    setupLeaderboard(ctx, container);
  }

  function renderSudoku(container, ctx) {
    const PUZZLE =
      "530070000600195000098000060000060003406000008000020000040000590000810000006000030";
    const SOLUTION =
      "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
    let cells = PUZZLE.split("").map((n, i) => ({
      value: n === "0" ? "" : n,
      fixed: n !== "0",
      index: i
    }));
    const startTime = Date.now();

    container.innerHTML = `
      <div class="mini-game">
        <h3 class="mini-game-title">스도쿠</h3>
        <p class="minesweeper-hint">빈 칸에 1~9 숫자를 채우세요.</p>
        <div class="sudoku-board" id="sudoku-board"></div>
        <button type="button" class="action-btn" id="sudoku-check">정답 확인</button>
        <p class="minesweeper-status" id="sudoku-status"></p>
      </div>`;

    const boardEl = document.getElementById("sudoku-board");
    const status = document.getElementById("sudoku-status");

    function paint() {
      boardEl.style.gridTemplateColumns = "repeat(9, 1fr)";
      boardEl.innerHTML = "";
      cells.forEach((cell, i) => {
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.maxLength = 1;
        input.className = "sudoku-cell";
        if ((Math.floor(i / 9) + Math.floor((i % 9) / 3)) % 2 === 0) input.classList.add("shade");
        if (cell.fixed) {
          input.value = cell.value;
          input.readOnly = true;
          input.classList.add("fixed");
        } else {
          input.value = cell.value;
          input.addEventListener("input", () => {
            const v = input.value.replace(/[^1-9]/g, "");
            input.value = v.slice(0, 1);
            cell.value = input.value;
          });
        }
        boardEl.appendChild(input);
      });
    }

    document.getElementById("sudoku-check").addEventListener("click", () => {
      const current = cells.map((c) => c.value || "0").join("");
      if (current.includes("0")) {
        status.textContent = "아직 빈 칸이 있습니다.";
        return;
      }
      status.textContent = current === SOLUTION ? "정답입니다!" : "틀린 칸이 있습니다.";
      if (current === SOLUTION) {
        const seconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        ctx?.recordScore?.(seconds);
        ctx?.sfx?.("win");
      }
    });
    paint();
    setupLeaderboard(ctx, container);
  }

  function renderConnect4(container, ctx) {
    const ROWS = 6;
    const COLS = 7;
    let board = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    let current = "R";
    let over = false;
    let moveCount = 0;
    let sessionActive = false;

    container.innerHTML = `
      <div class="mini-game">
        ${toolbarHtml("c4-score", "c4-reset")}
        <div class="connect4-board" id="c4-board"></div>
        <p class="minesweeper-hint">열을 클릭해 말을 떨어뜨리세요. R(나) vs Y(AI)</p>
        <p class="minesweeper-status" id="c4-status">${WAIT_MSG}</p>
      </div>`;

    const boardEl = document.getElementById("c4-board");
    const status = document.getElementById("c4-status");
    const scoreEl = document.getElementById("c4-score");

    function checkWin(player) {
      const dirs = [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1]
      ];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (board[r][c] !== player) continue;
          for (const [dr, dc] of dirs) {
            let count = 1;
            for (let i = 1; i < 4; i++) {
              const nr = r + dr * i;
              const nc = c + dc * i;
              if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
              if (board[nr][nc] !== player) break;
              count++;
            }
            if (count >= 4) return true;
          }
        }
      }
      return false;
    }

    function dropIn(col, player) {
      for (let r = ROWS - 1; r >= 0; r--) {
        if (!board[r][col]) {
          board[r][col] = player;
          return r;
        }
      }
      return -1;
    }

    function paint() {
      scoreEl.textContent = current === "R" ? "차례: 나 (R)" : "차례: AI (Y)";
      boardEl.innerHTML = "";
      const cols = document.createElement("div");
      cols.className = "connect4-cols";
      for (let c = 0; c < COLS; c++) {
        const colBtn = document.createElement("button");
        colBtn.type = "button";
        colBtn.className = "connect4-col-btn";
        colBtn.textContent = "▼";
        colBtn.disabled = over || current !== "R" || !sessionActive;
        colBtn.addEventListener("click", () => playerMove(c));
        cols.appendChild(colBtn);
      }
      boardEl.appendChild(cols);
      const grid = document.createElement("div");
      grid.className = "connect4-grid";
      grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = document.createElement("div");
          cell.className = "connect4-cell";
          if (board[r][c] === "R") cell.classList.add("red");
          if (board[r][c] === "Y") cell.classList.add("yellow");
          grid.appendChild(cell);
        }
      }
      boardEl.appendChild(grid);
    }

    function end(msg) {
      over = true;
      status.textContent = msg;
      paint();
    }

    function pickAiColumn() {
      const order = [3, 2, 4, 1, 5, 0, 6];
      for (const col of order) {
        const row = dropIn(col, "Y");
        if (row < 0) continue;
        const wins = checkWin("Y");
        board[row][col] = "";
        if (wins) return col;
      }
      for (const col of order) {
        const row = dropIn(col, "R");
        if (row < 0) continue;
        const blocks = checkWin("R");
        board[row][col] = "";
        if (blocks) return col;
      }
      for (const col of order) {
        for (let r = ROWS - 1; r >= 0; r--) {
          if (!board[r][col]) return col;
        }
      }
      return -1;
    }

    function playerMove(col) {
      if (!sessionActive || over || current !== "R") return;
      if (dropIn(col, "R") < 0) return;
      moveCount++;
      if (checkWin("R")) {
        end("승리!");
        ctx?.recordScore?.(moveCount);
        ctx?.sfx?.("win");
        return;
      }
      if (board.every((row) => row.every(Boolean))) {
        end("무승부");
        return;
      }
      current = "Y";
      paint();
      setTimeout(() => {
        if (over) return;
        const aiCol = pickAiColumn();
        if (aiCol < 0) {
          end("무승부");
          return;
        }
        dropIn(aiCol, "Y");
        moveCount++;
        if (checkWin("Y")) {
          end("AI 승리!");
          ctx?.sfx?.("lose");
        } else if (board.every((row) => row.every(Boolean))) {
          end("무승부");
        }
        current = "R";
        paint();
      }, 400);
    }

    function resetGame() {
      sessionActive = true;
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
      current = "R";
      over = false;
      moveCount = 0;
      status.textContent = "";
      paint();
    }

    function showWaiting() {
      sessionActive = false;
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
      current = "R";
      over = true;
      moveCount = 0;
      scoreEl.textContent = "대기 중";
      status.textContent = WAIT_MSG;
      paint();
    }

    ctx.bindGameStart(document.getElementById("c4-reset"), resetGame);
    showWaiting();
    setupLeaderboard(ctx, container);
  }

  window.GamesExtra = {
    renderSnake,
    renderGuessNumber,
    renderReaction,
    renderRPS,
    renderMemory,
    renderTetris,
    renderPong,
    renderBreakout,
    renderWordle,
    renderSudoku,
    renderConnect4
  };
})();
