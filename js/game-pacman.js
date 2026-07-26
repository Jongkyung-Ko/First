(function () {
  function toolbarHtml(statId, resetId) {
    return window.Games?.toolbarHtml?.(statId, resetId) || `
      <div class="game-toolbar">
        <div class="game-toolbar-stat" id="${statId}"></div>
        <button type="button" class="minesweeper-reset game-start-btn" id="${resetId}" title="게임 시작">게임 시작</button>
      </div>`;
  }

  const MAZE_RAW = [
    "###################",
    "#........#........#",
    "#.###.###.#.###.#.#",
    "#o###.###.#.###.#o#",
    "#.................#",
    "#.###.#.#####.#.###",
    "#.....#...#...#.....#",
    "#####.## # ##.#####",
    "   #.#       #.#   ",
    "#####.# ## ## #.#####",
    "#.........#.........#",
    "#.###.###.#.###.###.#",
    "#o..#.....#.....#..o#",
    "###.#.#.#####.#.#.###",
    "#...#.#.......#.#...#",
    "#.###.###.#.###.###.#",
    "#.................#",
    "###################"
  ];

  const GHOST_COLORS = ["#ef4444", "#f472b6", "#22d3ee", "#fbbf24"];
  const SCATTER_TARGETS = [
    { c: 17, r: 0 },
    { c: 1, r: 0 },
    { c: 17, r: 17 },
    { c: 1, r: 17 }
  ];

  function renderPacman(container, ctx) {
    const TILE = 22;
    const ROWS = MAZE_RAW.length;
    const COLS = MAZE_RAW[0].length;
    const W = COLS * TILE;
    const H = ROWS * TILE;
    const fx = window.GameFX;
    let frameId = null;
    let lastTs = 0;
    let state = null;

    container.innerHTML = `
      <div class="mini-game pacman-game">
        ${toolbarHtml("pacman-stat", "pacman-reset")}
        <canvas class="game-canvas" id="pacman-canvas" width="${W}" height="${H}"></canvas>
        <p class="minesweeper-hint">방향키로 이동 — 점을 모두 먹고 유령을 피하세요!</p>
        <p class="minesweeper-status" id="pacman-status"></p>
      </div>`;

    const canvas = document.getElementById("pacman-canvas");
    const g = canvas.getContext("2d");
    const stat = document.getElementById("pacman-stat");
    const status = document.getElementById("pacman-status");
    const WAIT_MSG = window.Games?.GAME_START_WAIT_MSG || "「게임 시작」 버튼을 눌러 주세요.";
    let sessionActive = false;

    function startGame() {
      sessionActive = true;
      reset(true);
    }

    function showWaiting() {
      sessionActive = false;
      state = { over: true, score: 0, lives: 3, particles: [], grid: [], dotsLeft: 0 };
      stat.textContent = "점수: 0";
      status.textContent = WAIT_MSG;
    }

    function parseMaze() {
      const grid = [];
      let dots = 0;
      for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
          const ch = MAZE_RAW[r][c] || "#";
          if (ch === "#") row.push(1);
          else if (ch === "o") {
            row.push(3);
            dots++;
          } else if (ch === " ") row.push(2);
          else {
            row.push(0);
            dots++;
          }
        }
        grid.push(row);
      }
      return { grid, dots };
    }

    function tileCenter(c, r) {
      return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
    }

    function findStart() {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (MAZE_RAW[r][c] === " ") return { c, r };
        }
      }
      return { c: 9, r: 9 };
    }

    function canWalk(grid, c, r) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
      return grid[r][c] !== 1;
    }

    function wrapCol(c) {
      if (c < 0) return COLS - 1;
      if (c >= COLS) return 0;
      return c;
    }

    function ghostHome() {
      return { c: 9, r: 9 };
    }

    function makeGhosts(home) {
      return GHOST_COLORS.map((color, i) => ({
        c: home.c + (i % 2 ? 1 : -1),
        r: home.r,
        x: 0,
        y: 0,
        dir: { c: 0, r: 0 },
        color,
        mode: "scatter",
        frightened: false,
        eaten: false
      }));
    }

    function reset(full = true) {
      const { grid, dots } = parseMaze();
      const home = ghostHome();
      const start = { c: 1, r: 13 };
      const pos = tileCenter(start.c, start.r);

      if (full || !state) {
        lastTs = 0;
        state = {
          grid,
          dotsLeft: dots,
          player: {
            c: start.c,
            r: start.r,
            x: pos.x,
            y: pos.y,
            dir: { c: 0, r: 0 },
            nextDir: { c: 0, r: 0 },
            mouth: 0,
            speed: 2.1
          },
          ghosts: makeGhosts(home),
          powerTimer: 0,
          lives: 3,
          score: 0,
          level: 1,
          over: false,
          win: false,
          freeze: 0,
          ghostCombo: 0,
          scoreRecorded: false,
          particles: []
        };
      } else {
        state.grid = grid;
        state.dotsLeft = dots;
        const p = state.player;
        p.c = start.c;
        p.r = start.r;
        p.x = pos.x;
        p.y = pos.y;
        p.dir = { c: 0, r: 0 };
        p.nextDir = { c: 0, r: 0 };
        state.ghosts = makeGhosts(home);
        state.powerTimer = 0;
        state.freeze = 1200;
        state.ghostCombo = 0;
      }

      state.ghosts.forEach((gh) => {
        const p = tileCenter(gh.c, gh.r);
        gh.x = p.x;
        gh.y = p.y;
      });

      stat.textContent = `점수: ${state.score} · 생명 ${state.lives}`;
      status.textContent = full ? "방향키로 출발!" : "준비...";
    }

    function atCenter(ent) {
      const cx = ent.c * TILE + TILE / 2;
      const cy = ent.r * TILE + TILE / 2;
      return Math.abs(ent.x - cx) < 2 && Math.abs(ent.y - cy) < 2;
    }

    function snapToCenter(ent) {
      ent.x = ent.c * TILE + TILE / 2;
      ent.y = ent.r * TILE + TILE / 2;
    }

    function tryTurn(ent, dir) {
      if (!dir.c && !dir.r) return false;
      const nc = ent.c + dir.c;
      const nr = ent.r + dir.r;
      if (canWalk(state.grid, wrapCol(nc), nr)) {
        ent.dir = { ...dir };
        return true;
      }
      return false;
    }

    function moveEntity(ent, speed, dt) {
      const step = speed * (dt / 16);
      if (atCenter(ent)) {
        snapToCenter(ent);
        if (ent.nextDir) tryTurn(ent, ent.nextDir);
        if (!ent.dir.c && !ent.dir.r) return;
        const nc = ent.c + ent.dir.c;
        const nr = ent.r + ent.dir.r;
        const wc = wrapCol(nc);
        if (!canWalk(state.grid, wc, nr)) {
          ent.dir = { c: 0, r: 0 };
          return;
        }
        ent.c = wc;
        ent.r = nr;
      }
      const target = tileCenter(ent.c, ent.r);
      const dx = target.x - ent.x;
      const dy = target.y - ent.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= step) {
        ent.x = target.x;
        ent.y = target.y;
      } else {
        ent.x += (dx / dist) * step;
        ent.y += (dy / dist) * step;
      }
    }

    function ghostTarget(gh, idx) {
      const p = state.player;
      if (gh.frightened) {
        return { c: Math.floor(Math.random() * COLS), r: Math.floor(Math.random() * ROWS) };
      }
      if (gh.mode === "scatter") return SCATTER_TARGETS[idx];
      return { c: p.c, r: p.r };
    }

    function chooseGhostDir(gh, idx) {
      if (!atCenter(gh)) return;
      const target = ghostTarget(gh, idx);
      const dirs = [
        { c: 1, r: 0 },
        { c: -1, r: 0 },
        { c: 0, r: 1 },
        { c: 0, r: -1 }
      ].filter((d) => !(d.c === -gh.dir.c && d.r === -gh.dir.r));
      let best = null;
      let bestD = Infinity;
      dirs.forEach((d) => {
        const nc = wrapCol(gh.c + d.c);
        const nr = gh.r + d.r;
        if (!canWalk(state.grid, nc, nr)) return;
        const dist = (target.c - nc) ** 2 + (target.r - nr) ** 2;
        if (dist < bestD) {
          bestD = dist;
          best = d;
        }
      });
      if (best) gh.dir = best;
    }

    function eatDot(c, r) {
      const cell = state.grid[r][c];
      if (cell === 0) {
        state.grid[r][c] = 2;
        state.dotsLeft--;
        state.score += 10;
        ctx?.sfx?.("eat");
      } else if (cell === 3) {
        state.grid[r][c] = 2;
        state.dotsLeft--;
        state.score += 50;
        state.powerTimer = 6000;
        state.ghostCombo = 0;
        state.ghosts.forEach((gh) => {
          gh.frightened = true;
          gh.eaten = false;
          gh.dir = { c: -gh.dir.c, r: -gh.dir.r };
        });
        ctx?.sfx?.("score");
      }
    }

    function loseLife() {
      state.lives--;
      ctx?.sfx?.("hit");
      if (state.lives <= 0) {
        state.over = true;
        status.textContent = `게임 오버! 점수 ${state.score}`;
        ctx?.sfx?.("lose");
        if (!state.scoreRecorded) {
          state.scoreRecorded = true;
          ctx?.recordScore?.(state.score);
        }
      } else {
        status.textContent = `잡혔다! 생명 ${state.lives}`;
        reset(false);
      }
    }

    function levelClear() {
      state.level++;
      state.ghosts.forEach((gh) => {
        gh.mode = "scatter";
      });
      state.player.speed = Math.min(3.2, state.player.speed + 0.08);
      status.textContent = `레벨 ${state.level}!`;
      ctx?.sfx?.("win");
      reset(false);
    }

    function loop(ts) {
      const dt = lastTs ? Math.min(48, ts - lastTs) : 16;
      lastTs = ts;
      const s = state;
      s.player.mouth += dt * 0.012;

      if (!s.over && !s.win && s.freeze > 0) {
        s.freeze -= dt;
      } else if (!s.over && !s.win && sessionActive) {
        if (s.powerTimer > 0) {
          s.powerTimer -= dt;
          if (s.powerTimer <= 0) {
            s.ghosts.forEach((gh) => {
              gh.frightened = false;
            });
          }
        }

        const p = s.player;
        moveEntity(p, p.speed, dt);
        if (atCenter(p)) {
          eatDot(p.c, p.r);
          if (s.dotsLeft <= 0) {
            levelClear();
          }
        }

        s.ghosts.forEach((gh, i) => {
          chooseGhostDir(gh, i);
          const spd = gh.frightened ? 1.4 : 1.85 + s.level * 0.05;
          moveEntity(gh, spd, dt);

          if (Math.hypot(gh.x - p.x, gh.y - p.y) < TILE * 0.55) {
            if (gh.frightened && !gh.eaten) {
              gh.eaten = true;
              gh.frightened = false;
              s.ghostCombo++;
              const pts = 200 * Math.pow(2, s.ghostCombo - 1);
              s.score += pts;
              const home = ghostHome();
              gh.c = home.c;
              gh.r = home.r;
              snapToCenter(gh);
              gh.dir = { c: 0, r: 0 };
              fx.burst(s.particles, gh.x, gh.y, {
                count: 12,
                color: gh.color,
                speed: 3
              });
              ctx?.sfx?.("match");
            } else if (!gh.eaten) {
              loseLife();
            }
          }
        });

        stat.textContent = `점수: ${s.score} · 생명 ${s.lives} · Lv.${s.level}`;
      }

      fx.fillBg(g, W, H, "#0a0a12", "#111827");

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = s.grid[r][c];
          const x = c * TILE;
          const y = r * TILE;
          if (cell === 1) {
            g.fillStyle = "#312e81";
            g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
            g.strokeStyle = "#4338ca";
            g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
          } else if (cell === 0) {
            g.fillStyle = "#fde68a";
            g.beginPath();
            g.arc(x + TILE / 2, y + TILE / 2, 2.5, 0, Math.PI * 2);
            g.fill();
          } else if (cell === 3) {
            g.fillStyle = "#fbbf24";
            g.beginPath();
            g.arc(x + TILE / 2, y + TILE / 2, 5, 0, Math.PI * 2);
            g.fill();
          }
        }
      }

      s.ghosts.forEach((gh) => {
        const col = gh.frightened ? (Math.floor(ts / 200) % 2 ? "#3b82f6" : "#1d4ed8") : gh.color;
        if (gh.eaten) return;
        g.fillStyle = col;
        g.beginPath();
        g.arc(gh.x, gh.y - 2, TILE * 0.38, Math.PI, 0);
        g.lineTo(gh.x + TILE * 0.38, gh.y + TILE * 0.3);
        for (let i = 3; i >= 0; i--) {
          const gx = gh.x - TILE * 0.38 + (i * (TILE * 0.76)) / 3;
          g.lineTo(gx, gh.y + TILE * 0.3 + (i % 2 ? 4 : 0));
        }
        g.closePath();
        g.fill();
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(gh.x - 5, gh.y - 4, 4, 0, Math.PI * 2);
        g.arc(gh.x + 5, gh.y - 4, 4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#1e293b";
        g.beginPath();
        g.arc(gh.x - 5, gh.y - 4, 2, 0, Math.PI * 2);
        g.arc(gh.x + 5, gh.y - 4, 2, 0, Math.PI * 2);
        g.fill();
      });

      const p = s.player;
      const mouthOpen = 0.25 + Math.abs(Math.sin(p.mouth)) * 0.55;
      let angle = 0;
      if (p.dir.c === 1) angle = 0;
      else if (p.dir.c === -1) angle = Math.PI;
      else if (p.dir.r === -1) angle = -Math.PI / 2;
      else if (p.dir.r === 1) angle = Math.PI / 2;

      g.fillStyle = "#facc15";
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.arc(p.x, p.y, TILE * 0.42, angle + mouthOpen * Math.PI, angle - mouthOpen * Math.PI, true);
      g.closePath();
      g.fill();

      if (s.particles) fx.draw(g, s.particles);

      frameId = requestAnimationFrame(loop);
    }

    function onKey(e) {
      if (!sessionActive || s_over()) return;
      const map = {
        ArrowUp: { c: 0, r: -1 },
        ArrowDown: { c: 0, r: 1 },
        ArrowLeft: { c: -1, r: 0 },
        ArrowRight: { c: 1, r: 0 }
      };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      state.player.nextDir = d;
      if (atCenter(state.player)) tryTurn(state.player, d);
    }

    function s_over() {
      return state?.over;
    }

    ctx.bindGameStart(document.getElementById("pacman-reset"), startGame);
    document.addEventListener("keydown", onKey);
    ctx.addCleanup(() => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", onKey);
    });

    showWaiting();
    frameId = requestAnimationFrame(loop);
    ctx?.mountLeaderboard?.(container.querySelector(".mini-game"));
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderPacman = renderPacman;
})();
