(function () {
  function toolbarHtml(statId, resetId) {
    return `
      <div class="game-toolbar">
        <div class="game-toolbar-stat" id="${statId}"></div>
        <button type="button" class="minesweeper-reset" id="${resetId}" title="새 게임">↺</button>
      </div>`;
  }

  function renderRunner(container, ctx) {
    const W = 540;
    const H = 400;
    const SPEED = 0.8;
    const PLAYER_X = W * (56 / 360);
    const GROUND = H - 48;
    const fx = window.GameFX;
    let frameId = null;
    let lastTs = 0;
    let state = null;

    container.innerHTML = `
      <div class="mini-game">
        ${toolbarHtml("runner-stat", "runner-reset")}
        <canvas class="game-canvas" id="runner-canvas" width="${W}" height="${H}"></canvas>
        <p class="minesweeper-hint">스페이스/▲ 으로 점프! 장애물을 피하세요.</p>
        <p class="minesweeper-status" id="runner-status"></p>
      </div>`;

    const canvas = document.getElementById("runner-canvas");
    const g = canvas.getContext("2d");
    const stat = document.getElementById("runner-stat");
    const status = document.getElementById("runner-status");

    function reset() {
      lastTs = 0;
      state = {
        player: { y: GROUND, vy: 0, grounded: true },
        obstacles: [],
        bgLayers: [
          { color: "rgba(30,41,59,0.4)", speed: 0.3, y: 120, h: 40 },
          { color: "rgba(51,65,85,0.5)", speed: 0.6, y: 180, h: 50 }
        ],
        scroll: 0,
        score: 0,
        over: false,
        spawnTimer: 0,
        particles: [],
        dust: []
      };
      stat.textContent = "점수: 0";
      status.textContent = "";
    }

    function jump() {
      if (!state || state.over) {
        reset();
        return;
      }
      if (state.player.grounded) {
        state.player.vy = -11;
        state.player.grounded = false;
        ctx?.sfx?.("jump");
        fx.burst(state.dust, PLAYER_X, GROUND, {
          count: 6,
          color: "#94a3b8",
          speed: 2,
          angle: -Math.PI / 2,
          spread: 1.2
        });
      }
    }

    function loop(ts) {
      const dt = lastTs ? Math.min(48, ts - lastTs) : 16;
      lastTs = ts;
      const s = state;
      fx.prepare(g);
      fx.update(s.particles, dt);
      fx.update(s.dust, dt);

      if (!s.over) {
        s.scroll += dt * 0.12 * SPEED;
        s.score = Math.floor(s.scroll / 8);
        stat.textContent = `점수: ${s.score}`;

        s.player.vy += 0.55;
        s.player.y += s.player.vy;
        if (s.player.y >= GROUND) {
          s.player.y = GROUND;
          s.player.vy = 0;
          s.player.grounded = true;
        }

        s.spawnTimer += dt;
        if (s.spawnTimer > (1400 - Math.min(600, s.score * 3)) / SPEED) {
          s.spawnTimer = 0;
          const tall = Math.random() > 0.65;
          s.obstacles.push({
            x: W + 20,
            w: tall ? 22 : 28,
            h: tall ? 52 : 34,
            color: tall ? "#f87171" : "#fb923c"
          });
        }

        const moveSpeed = (4.2 + Math.min(2, s.score * 0.02)) * SPEED;
        s.obstacles.forEach((o) => {
          o.x -= moveSpeed;
        });
        s.obstacles = s.obstacles.filter((o) => o.x > -40);

        const px = PLAYER_X;
        const py = s.player.y - 28;
        s.obstacles.forEach((o) => {
          const ox = o.x;
          const oy = GROUND - o.h;
          if (px + 20 > ox && px - 10 < ox + o.w && py + 28 > oy) {
            s.over = true;
            status.textContent = "충돌! 스페이스로 다시 시작";
            ctx?.sfx?.("hit");
            fx.burst(s.particles, px, py + 14, { count: 24, color: "#f87171", speed: 4 });
            ctx?.recordScore?.(s.score);
          }
        });
      }

      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#1e1b4b");
      sky.addColorStop(0.5, "#312e81");
      sky.addColorStop(1, "#4c1d95");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);

      s.bgLayers.forEach((layer, i) => {
        const off = (s.scroll * layer.speed * SPEED) % (W + 80);
        g.fillStyle = layer.color;
        for (let x = -off; x < W + 80; x += 80) {
          g.beginPath();
          g.roundRect(x, layer.y, 60 + i * 10, layer.h, 8);
          g.fill();
        }
      });

      g.fillStyle = "#334155";
      g.fillRect(0, GROUND + 4, W, H - GROUND);
      g.fillStyle = "#475569";
      g.fillRect(0, GROUND, W, 6);
      g.strokeStyle = "rgba(148,163,184,0.3)";
      g.setLineDash([8, 12]);
      g.beginPath();
      g.moveTo(0, GROUND + 20);
      g.lineTo(W, GROUND + 20);
      g.stroke();
      g.setLineDash([]);

      s.obstacles.forEach((o) => {
        fx.roundRect(g, o.x, GROUND - o.h, o.w, o.h, 4, o.color, o.color);
      });

      g.save();
      g.translate(PLAYER_X, s.player.y - 28);
      const bob = s.player.grounded ? Math.sin(s.scroll * 0.08) * 2 : 0;
      g.translate(0, bob);
      fx.roundRect(g, 0, 0, 24, 28, 6, "#60a5fa", "#3b82f6");
      g.fillStyle = "#1e293b";
      g.fillRect(16, 6, 4, 4);
      g.restore();

      fx.draw(g, s.dust);
      fx.draw(g, s.particles);
      frameId = requestAnimationFrame(loop);
    }

    function onKey(e) {
      if (e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    }

    document.getElementById("runner-reset").addEventListener("click", reset);
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
  window.GamesExtra.renderRunner = renderRunner;
})();
