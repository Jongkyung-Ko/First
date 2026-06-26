(function () {
  function toolbarHtml(statId, resetId) {
    return `
      <div class="game-toolbar">
        <div class="game-toolbar-stat" id="${statId}"></div>
        <button type="button" class="minesweeper-reset" id="${resetId}" title="새 게임">↺</button>
      </div>`;
  }

  function renderFlappy(container, ctx) {
    const W = 540;
    const H = 480;
    const SPEED = 0.8;
    const VERTICAL_SPEED = 0.7; // 상하 이동 30% 느리게
    const BIRD_X = W * 0.2;
    const PIPE_W = 52;
    const PIPE_GAP = 130;
    const PIPE_SPACING = 270;
    const fx = window.GameFX;
    let frameId = null;
    let lastTs = 0;
    let state = null;

    container.innerHTML = `
      <div class="mini-game">
        ${toolbarHtml("flappy-stat", "flappy-reset")}
        <canvas class="game-canvas" id="flappy-canvas" width="${W}" height="${H}"></canvas>
        <p class="minesweeper-hint">스페이스/탭/▲ 으로 날갯짓! 파이프 사이를 통과하세요.</p>
        <p class="minesweeper-status" id="flappy-status"></p>
      </div>`;

    const canvas = document.getElementById("flappy-canvas");
    const g = canvas.getContext("2d");
    const stat = document.getElementById("flappy-stat");
    const status = document.getElementById("flappy-status");

    function newPipe(offsetX) {
      const topH = 60 + Math.random() * (H - PIPE_GAP - 140);
      return { x: offsetX, topH, gap: PIPE_GAP, scored: false };
    }

    function reset() {
      lastTs = 0;
      state = {
        bird: { y: H / 2, vy: 0, rot: 0 },
        pipes: [newPipe(W + 120), newPipe(W + 120 + PIPE_SPACING), newPipe(W + 120 + PIPE_SPACING * 2)],
        clouds: [
          { x: W * 0.1, y: 60, s: 0.6 },
          { x: W * 0.45, y: 100, s: 0.9 },
          { x: W * 0.75, y: 40, s: 0.5 }
        ],
        scroll: 0,
        score: 0,
        over: false,
        started: false,
        particles: [],
        flapAnim: 0
      };
      stat.textContent = "점수: 0";
      status.textContent = "탭하거나 스페이스로 시작!";
    }

    function flap() {
      if (!state) return;
      if (state.over) {
        reset();
        return;
      }
      state.started = true;
      state.bird.vy = -6.2 * VERTICAL_SPEED;
      state.flapAnim = 1;
      status.textContent = "";
    }

    function loop(ts) {
      const dt = lastTs ? Math.min(48, ts - lastTs) : 16;
      lastTs = ts;
      const s = state;
      fx.update(s.particles, dt);
      s.scroll += dt * 0.04 * SPEED;
      s.flapAnim = Math.max(0, s.flapAnim - dt * 0.004);

      if (s.started && !s.over) {
        s.bird.vy += 0.28 * VERTICAL_SPEED;
        s.bird.y += s.bird.vy;
        s.bird.rot = Math.max(-0.5, Math.min(0.8, s.bird.vy * 0.06));

        const pipeSpeed = 2.2 * SPEED;
        s.pipes.forEach((p) => {
          p.x -= pipeSpeed;
        });
        if (s.pipes[0].x < -PIPE_W - 20) {
          s.pipes.shift();
          s.pipes.push(newPipe(s.pipes[s.pipes.length - 1].x + PIPE_SPACING));
        }

        s.pipes.forEach((p) => {
          const bx = BIRD_X;
          const by = s.bird.y;
          const inX = bx + 14 > p.x && bx - 14 < p.x + PIPE_W;
          const hitTop = by - 14 < p.topH;
          const hitBot = by + 14 > p.topH + p.gap;
          if (inX && !p.scored && p.x + PIPE_W < bx) {
            p.scored = true;
            s.score++;
            stat.textContent = `점수: ${s.score}`;
            fx.burst(s.particles, bx, by, { count: 10, color: "#fbbf24", speed: 2.5 });
          }
          if (inX && (hitTop || hitBot)) {
            s.over = true;
            status.textContent = "충돌! 탭하여 다시 시작";
            fx.burst(s.particles, bx, by, { count: 22, color: "#f87171", speed: 4 });
            ctx?.recordScore?.(s.score);
          }
        });

        if (s.bird.y > H - 20 || s.bird.y < 10) {
          s.over = true;
          status.textContent = "추락! 탭하여 다시 시작";
          fx.burst(s.particles, BIRD_X, s.bird.y, { count: 20, color: "#fb923c", speed: 3.5 });
          ctx?.recordScore?.(s.score);
        }
      }

      s.clouds.forEach((c) => {
        c.x -= 0.3 * (c.s + 0.4) * SPEED;
        if (c.x < -60) c.x = W + 40;
      });

      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0ea5e9");
      sky.addColorStop(0.55, "#38bdf8");
      sky.addColorStop(1, "#86efac");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);

      s.clouds.forEach((c) => {
        g.fillStyle = "rgba(255,255,255,0.55)";
        g.beginPath();
        g.ellipse(c.x, c.y, 28 * c.s, 14 * c.s, 0, 0, Math.PI * 2);
        g.ellipse(c.x + 20 * c.s, c.y - 6, 22 * c.s, 12 * c.s, 0, 0, Math.PI * 2);
        g.fill();
      });

      s.pipes.forEach((p) => {
        const grad = g.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
        grad.addColorStop(0, "#22c55e");
        grad.addColorStop(1, "#16a34a");
        g.fillStyle = grad;
        g.fillRect(p.x, 0, PIPE_W, p.topH);
        g.fillRect(p.x, p.topH + p.gap, PIPE_W, H - p.topH - p.gap);
        g.fillStyle = "#15803d";
        g.fillRect(p.x - 2, p.topH - 8, PIPE_W + 4, 8);
        g.fillRect(p.x - 2, p.topH + p.gap, PIPE_W + 4, 8);
      });

      g.fillStyle = "#65a30d";
      g.fillRect(0, H - 24, W, 24);
      g.fillStyle = "#84cc16";
      g.fillRect(0, H - 24, W, 6);

      g.save();
      g.translate(BIRD_X, s.bird.y);
      g.rotate(s.bird.rot - s.flapAnim * 0.3);
      g.fillStyle = "#fbbf24";
      g.beginPath();
      g.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(6, -4, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#1e293b";
      g.beginPath();
      g.arc(7, -4, 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#f97316";
      g.beginPath();
      g.moveTo(14, 2);
      g.lineTo(22, 4);
      g.lineTo(14, 6);
      g.fill();
      g.restore();

      fx.draw(g, s.particles);
      frameId = requestAnimationFrame(loop);
    }

    function onKey(e) {
      if (e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    }

    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      flap();
    });

    document.getElementById("flappy-reset").addEventListener("click", reset);
    document.addEventListener("keydown", onKey);
    ctx.addCleanup(() => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", onKey);
    });

    reset();
    frameId = requestAnimationFrame(loop);
    ctx?.mountLeaderboard?.(container.querySelector(".mini-game"));
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderFlappy = renderFlappy;
})();
