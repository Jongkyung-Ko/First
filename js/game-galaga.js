(function () {
  function toolbarHtml(statId, resetId) {
    return window.Games?.toolbarHtml?.(statId, resetId) || `
      <div class="game-toolbar">
        <div class="game-toolbar-stat" id="${statId}"></div>
        <button type="button" class="minesweeper-reset game-start-btn" id="${resetId}" title="게임 시작">게임 시작</button>
      </div>`;
  }

  function renderGalaga(container, ctx) {
    const W = 480;
    const H = 560;
    const fx = window.GameFX;
    let frameId = null;
    let lastTs = 0;
    let state = null;
    let keys = { left: false, right: false, fire: false };

    container.innerHTML = `
      <div class="mini-game">
        ${toolbarHtml("galaga-stat", "galaga-reset")}
        <canvas class="game-canvas" id="galaga-canvas" width="${W}" height="${H}"></canvas>
        <p class="minesweeper-hint">← → 이동 · 스페이스 발사 — 적 편대를 격추하세요!</p>
        <p class="minesweeper-status" id="galaga-status"></p>
      </div>`;

    const canvas = document.getElementById("galaga-canvas");
    const g = canvas.getContext("2d");
    const stat = document.getElementById("galaga-stat");
    const status = document.getElementById("galaga-status");
    const WAIT_MSG = window.Games?.GAME_START_WAIT_MSG || "「게임 시작」 버튼을 눌러 주세요.";
    let sessionActive = false;

    const ENEMY_COLORS = ["#f472b6", "#a78bfa", "#34d399", "#fb923c"];

    function buildFormation(wave) {
      const enemies = [];
      const cols = 8;
      const rows = 3 + Math.min(2, Math.floor(wave / 2));
      const startX = (W - cols * 44) / 2 + 22;
      const startY = 60;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          enemies.push({
            x: startX + c * 44,
            y: startY + r * 36,
            homeX: startX + c * 44,
            homeY: startY + r * 36,
            hp: 1 + Math.floor(wave / 3),
            r: 14,
            color: ENEMY_COLORS[r % ENEMY_COLORS.length],
            diving: false,
            diveT: 0,
            diveVx: 0,
            diveVy: 0,
            shootCd: 2000 + Math.random() * 3000
          });
        }
      }
      return enemies;
    }

    function reset() {
      sessionActive = true;
      lastTs = 0;
      state = {
        player: { x: W / 2, y: H - 48, w: 28, h: 24, cd: 0, inv: 0 },
        bullets: [],
        enemyBullets: [],
        enemies: buildFormation(1),
        formationDir: 1,
        formationX: 0,
        wave: 1,
        lives: 3,
        score: 0,
        over: false,
        waveClearTimer: 0,
        particles: [],
        shake: null,
        scoreRecorded: false
      };
      stat.textContent = "점수: 0 · 생명 3";
      status.textContent = "스페이스로 발사!";
    }

    function shoot() {
      const p = state.player;
      if (p.cd > 0 || state.over) return;
      p.cd = 220;
      state.bullets.push({ x: p.x, y: p.y - 16, vy: -7, r: 3 });
      ctx?.sfx?.("pong");
    }

    function enemyShoot(e) {
      state.enemyBullets.push({
        x: e.x,
        y: e.y + 12,
        vy: 3.2 + state.wave * 0.15,
        r: 3
      });
    }

    function startDive(e) {
      if (e.diving) return;
      e.diving = true;
      e.diveT = 0;
      const ang = Math.atan2(state.player.y - e.y, state.player.x - e.x);
      e.diveVx = Math.cos(ang) * 2.2;
      e.diveVy = Math.sin(ang) * 2.2 + 1.5;
    }

    function hitPlayer() {
      const p = state.player;
      if (p.inv > 0 || state.over) return;
      state.lives--;
      p.inv = 1800;
      state.shake = fx.addShake(state.shake, 10, 280);
      fx.burst(state.particles, p.x, p.y, { count: 20, color: "#60a5fa", speed: 4 });
      ctx?.sfx?.("hit");
      if (state.lives <= 0) {
        state.over = true;
        status.textContent = `게임 오버! 점수 ${state.score} — 「게임 시작」으로 다시 시작`;
        ctx?.sfx?.("lose");
        if (!state.scoreRecorded) {
          state.scoreRecorded = true;
          ctx?.recordScore?.(state.score);
        }
      } else {
        status.textContent = `피격! 생명 ${state.lives}`;
      }
    }

    function nextWave() {
      state.wave++;
      state.enemies = buildFormation(state.wave);
      state.formationX = 0;
      state.formationDir = 1;
      state.waveClearTimer = 0;
      status.textContent = `웨이브 ${state.wave}!`;
      ctx?.sfx?.("win");
    }

    function loop(ts) {
      const dt = lastTs ? Math.min(48, ts - lastTs) : 16;
      lastTs = ts;
      const s = state;
      fx.update(s.particles, dt);
      if (s.shake) s.shake = fx.tickShake(s.shake, dt);

      if (!s.over && sessionActive) {
        const p = s.player;
        if (p.inv > 0) p.inv -= dt;
        if (p.cd > 0) p.cd -= dt;

        const spd = 3.8 * (dt / 16);
        if (keys.left) p.x -= spd;
        if (keys.right) p.x += spd;
        p.x = Math.max(24, Math.min(W - 24, p.x));
        if (keys.fire) shoot();

        if (s.enemies.length === 0) {
          s.waveClearTimer += dt;
          if (s.waveClearTimer > 1200) nextWave();
        } else {
          const moveSpd = (0.35 + s.wave * 0.04) * (dt / 16);
          s.formationX += s.formationDir * moveSpd;
          let edge = false;
          s.enemies.forEach((e) => {
            if (!e.diving) {
              e.x = e.homeX + s.formationX;
              if (e.x < 24 || e.x > W - 24) edge = true;
            }
          });
          if (edge) {
            s.formationDir *= -1;
            s.enemies.forEach((e) => {
              if (!e.diving) e.homeY += 8;
            });
          }

          if (Math.random() < 0.002 * (dt / 16) * (1 + s.wave * 0.1)) {
            const candidates = s.enemies.filter((e) => !e.diving);
            if (candidates.length) startDive(candidates[Math.floor(Math.random() * candidates.length)]);
          }

          s.enemies.forEach((e) => {
            if (e.diving) {
              e.diveT += dt;
              e.x += e.diveVx * (dt / 16);
              e.y += e.diveVy * (dt / 16);
              if (e.y > H + 40) {
                e.diving = false;
                e.x = e.homeX + s.formationX;
                e.y = e.homeY;
              }
            } else {
              e.shootCd -= dt;
              if (e.shootCd <= 0 && e.y > 80) {
                e.shootCd = 2500 + Math.random() * 4000;
                if (Math.random() < 0.35) enemyShoot(e);
              }
            }
          });
        }

        for (let i = s.bullets.length - 1; i >= 0; i--) {
          const b = s.bullets[i];
          b.y += b.vy * (dt / 16);
          if (b.y < -10) {
            s.bullets.splice(i, 1);
            continue;
          }
          for (let j = s.enemies.length - 1; j >= 0; j--) {
            const e = s.enemies[j];
            if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
              e.hp--;
              s.bullets.splice(i, 1);
              if (e.hp <= 0) {
                s.score += 100 + s.wave * 20;
                fx.burst(s.particles, e.x, e.y, { count: 16, color: e.color, speed: 3.5 });
                s.enemies.splice(j, 1);
                ctx?.sfx?.("score");
              }
              break;
            }
          }
        }

        for (let i = s.enemyBullets.length - 1; i >= 0; i--) {
          const b = s.enemyBullets[i];
          b.y += b.vy * (dt / 16);
          if (b.y > H + 10) {
            s.enemyBullets.splice(i, 1);
            continue;
          }
          if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + 12) {
            s.enemyBullets.splice(i, 1);
            hitPlayer();
          }
        }

        s.enemies.forEach((e) => {
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 14) hitPlayer();
        });

        stat.textContent = `점수: ${s.score} · 생명 ${s.lives} · W${s.wave}`;
      }

      const off = fx.offset(s.shake);
      g.save();
      g.translate(off.x, off.y);
      fx.fillBg(g, W, H, "#020617", "#0f172a");

      g.fillStyle = "rgba(255,255,255,0.04)";
      for (let y = 0; y < H; y += 24) g.fillRect(0, y, W, 1);

      s.enemies.forEach((e) => {
        fx.glowCircle(g, e.x, e.y, e.r, e.color, e.color);
        g.fillStyle = "#fff";
        g.fillRect(e.x - 4, e.y - 2, 8, 4);
      });

      s.bullets.forEach((b) => {
        fx.glowCircle(g, b.x, b.y, b.r, "#fef08a", "#facc15");
      });
      s.enemyBullets.forEach((b) => {
        fx.glowCircle(g, b.x, b.y, b.r, "#f87171", "#ef4444");
      });

      const p = s.player;
      if (p.inv <= 0 || Math.floor(ts / 80) % 2 === 0) {
        g.fillStyle = "#38bdf8";
        g.beginPath();
        g.moveTo(p.x, p.y - 14);
        g.lineTo(p.x - 14, p.y + 12);
        g.lineTo(p.x + 14, p.y + 12);
        g.closePath();
        g.fill();
      }

      fx.draw(g, s.particles);
      g.restore();
      frameId = requestAnimationFrame(loop);
    }

    function setKey(e, down) {
      if (e.key === "ArrowLeft") keys.left = down;
      if (e.key === "ArrowRight") keys.right = down;
      if (e.key === " ") keys.fire = down;
    }

    function onKeyDown(e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setKey(e, true);
      }
      if (e.key === " ") {
        e.preventDefault();
        setKey(e, true);
        if (!state?.over) shoot();
      }
    }

    function onKeyUp(e) {
      setKey(e, false);
    }

    function showWaiting() {
      sessionActive = false;
      lastTs = 0;
      state = { over: true, score: 0, lives: 3, particles: [] };
      stat.textContent = "점수: 0";
      status.textContent = WAIT_MSG;
    }

    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!sessionActive) return;
      if (state?.over) {
        status.textContent = "「게임 시작」 버튼으로 다시 시작하세요.";
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      if (x < W / 2) keys.left = true;
      else keys.right = true;
      shoot();
    });
    canvas.addEventListener("pointerup", () => {
      keys.left = false;
      keys.right = false;
    });

    ctx.bindGameStart(document.getElementById("galaga-reset"), reset);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    ctx.addCleanup(() => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    });

    showWaiting();
    frameId = requestAnimationFrame(loop);
    ctx?.mountLeaderboard?.(container.querySelector(".mini-game"));
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderGalaga = renderGalaga;
})();
