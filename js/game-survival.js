(function () {
  function toolbarHtml(statId, resetId) {
    return `
      <div class="game-toolbar">
        <div class="game-toolbar-stat" id="${statId}"></div>
        <button type="button" class="minesweeper-reset" id="${resetId}" title="새 게임">↺</button>
      </div>`;
  }

  const UPGRADES = [
    { id: "dmg", label: "공격력 +20%", desc: "투사체 피해 증가" },
    { id: "rate", label: "연사 +15%", desc: "공격 속도 증가" },
    { id: "speed", label: "이동 +12%", desc: "이동 속도 증가" },
    { id: "hp", label: "체력 +25", desc: "최대 HP 회복" },
    { id: "orbit", label: "회전 칼", desc: "주변을 도는 칼날" },
    { id: "spread", label: "3방향탄", desc: "부채꼴 발사" },
    { id: "magnet", label: "자석", desc: "경험치 끌어당김" }
  ];

  function renderSurvival(container, ctx) {
    const W = 540;
    const H = 480;
    const fx = window.GameFX;
    let frameId = null;
    let lastTs = 0;
    let state = null;
    let keys = { up: false, down: false, left: false, right: false };

    container.innerHTML = `
      <div class="mini-game survival-game">
        ${toolbarHtml("survival-stat", "survival-reset")}
        <canvas class="game-canvas" id="survival-canvas" width="${W}" height="${H}"></canvas>
        <p class="minesweeper-hint">방향키로 이동 — 공격은 자동! 경험치를 모아 강화하세요.</p>
        <p class="minesweeper-status" id="survival-status"></p>
        <div class="survival-levelup" id="survival-levelup" hidden>
          <p class="survival-levelup-title">레벨 업!</p>
          <p class="survival-levelup-desc">강화를 선택하세요</p>
          <div class="survival-levelup-btns" id="survival-levelup-btns"></div>
        </div>
      </div>`;

    const canvas = document.getElementById("survival-canvas");
    const g = canvas.getContext("2d");
    const stat = document.getElementById("survival-stat");
    const status = document.getElementById("survival-status");
    const levelupEl = document.getElementById("survival-levelup");
    const levelupBtns = document.getElementById("survival-levelup-btns");

    function pickUpgrades(n) {
      const pool = [...UPGRADES];
      const picks = [];
      while (picks.length < n && pool.length) {
        const i = Math.floor(Math.random() * pool.length);
        picks.push(pool.splice(i, 1)[0]);
      }
      return picks;
    }

    function applyUpgrade(id) {
      const p = state.player;
      if (id === "dmg") p.dmgMult *= 1.2;
      else if (id === "rate") p.rateMult *= 1.15;
      else if (id === "speed") p.speedMult *= 1.12;
      else if (id === "hp") {
        p.maxHp += 25;
        p.hp = Math.min(p.maxHp, p.hp + 25);
      } else if (id === "orbit") p.orbit = Math.min(6, p.orbit + 1);
      else if (id === "spread") p.spread = Math.min(5, p.spread + 1);
      else if (id === "magnet") p.magnet = Math.min(80, p.magnet + 20);
      ctx?.sfx?.("score");
    }

    function showLevelUp() {
      state.paused = true;
      levelupEl.hidden = false;
      const choices = pickUpgrades(3);
      levelupBtns.innerHTML = choices
        .map(
          (u) =>
            `<button type="button" class="action-btn survival-upgrade-btn" data-id="${u.id}">
              <strong>${u.label}</strong><br><span>${u.desc}</span>
            </button>`
        )
        .join("");
      levelupBtns.querySelectorAll(".survival-upgrade-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          applyUpgrade(btn.dataset.id);
          levelupEl.hidden = true;
          const p = state.player;
          if (p.pendingLevelUps > 0) {
            p.pendingLevelUps--;
            showLevelUp();
          } else {
            state.paused = false;
            status.textContent = "";
          }
        }, { once: true });
      });
    }

    function spawnEnemy() {
      const edge = Math.floor(Math.random() * 4);
      let x, y;
      const margin = 20;
      if (edge === 0) {
        x = margin + Math.random() * (W - margin * 2);
        y = -margin;
      } else if (edge === 1) {
        x = W + margin;
        y = margin + Math.random() * (H - margin * 2);
      } else if (edge === 2) {
        x = margin + Math.random() * (W - margin * 2);
        y = H + margin;
      } else {
        x = -margin;
        y = margin + Math.random() * (H - margin * 2);
      }
      const t = state.time;
      const tier = Math.min(3, Math.floor(t / 25000));
      const hp = 12 + tier * 8 + Math.floor(t / 15000) * 3;
      const speed = 0.7 + tier * 0.15 + Math.min(1.2, t / 120000);
      state.enemies.push({ x, y, hp, maxHp: hp, speed, r: 10 + tier * 2, dmg: 8 + tier * 4 });
    }

    function reset() {
      lastTs = 0;
      state = {
        player: {
          x: W / 2,
          y: H / 2,
          hp: 100,
          maxHp: 100,
          speed: 2.4,
          speedMult: 1,
          dmgMult: 1,
          rateMult: 1,
          level: 1,
          xp: 0,
          xpNext: 12,
          orbit: 0,
          orbitAngle: 0,
          spread: 1,
          magnet: 30,
          atkCd: 0,
          pendingLevelUps: 0
        },
        enemies: [],
        bullets: [],
        gems: [],
        particles: [],
        spawnTimer: 0,
        spawnInterval: 1400,
        time: 0,
        kills: 0,
        over: false,
        paused: false,
        shake: null,
        scoreRecorded: false
      };
      stat.textContent = "Lv.1 · HP 100 · 0초";
      status.textContent = "방향키로 이동! 적을 처치하고 살아남으세요.";
      levelupEl.hidden = true;
    }

    function finalScore() {
      const s = state;
      return Math.floor(s.time / 100) + s.kills * 15 + s.player.level * 40;
    }

    function gameOver() {
      state.over = true;
      const sc = finalScore();
      status.textContent = `게임 오버! 점수 ${sc} — ↺ 로 다시 시작`;
      ctx?.sfx?.("lose");
      if (!state.scoreRecorded) {
        state.scoreRecorded = true;
        ctx?.recordScore?.(sc);
      }
    }

    function nearestEnemy(px, py) {
      let best = null;
      let bestD = Infinity;
      state.enemies.forEach((e) => {
        const d = (e.x - px) ** 2 + (e.y - py) ** 2;
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      });
      return best;
    }

    function fireBullets(px, py) {
      const p = state.player;
      const target = nearestEnemy(px, py);
      if (!target) return;
      const base = Math.atan2(target.y - py, target.x - px);
      const spread = p.spread;
      const step = spread > 1 ? 0.35 : 0;
      for (let i = 0; i < spread; i++) {
        const off = spread === 1 ? 0 : (i - (spread - 1) / 2) * step;
        const a = base + off;
        state.bullets.push({
          x: px,
          y: py,
          vx: Math.cos(a) * 5.5,
          vy: Math.sin(a) * 5.5,
          dmg: 10 * p.dmgMult,
          life: 1.2,
          r: 4
        });
      }
    }

    function loop(ts) {
      const dt = lastTs ? Math.min(48, ts - lastTs) : 16;
      lastTs = ts;
      const s = state;
      fx.update(s.particles, dt);
      if (s.shake) s.shake = fx.tickShake(s.shake, dt);

      if (!s.over && !s.paused) {
        s.time += dt;
        const p = s.player;
        let mx = 0;
        let my = 0;
        if (keys.left) mx -= 1;
        if (keys.right) mx += 1;
        if (keys.up) my -= 1;
        if (keys.down) my += 1;
        if (mx || my) {
          const len = Math.hypot(mx, my) || 1;
          p.x += (mx / len) * p.speed * p.speedMult * (dt / 16);
          p.y += (my / len) * p.speed * p.speedMult * (dt / 16);
        }
        p.x = Math.max(16, Math.min(W - 16, p.x));
        p.y = Math.max(16, Math.min(H - 16, p.y));

        p.atkCd -= dt;
        const rate = 520 / p.rateMult;
        if (p.atkCd <= 0 && s.enemies.length) {
          p.atkCd = rate;
          fireBullets(p.x, p.y);
        }

        if (p.orbit > 0) {
          p.orbitAngle += dt * 0.004;
          for (let i = 0; i < p.orbit; i++) {
            const a = p.orbitAngle + (i / p.orbit) * Math.PI * 2;
            const ox = p.x + Math.cos(a) * 42;
            const oy = p.y + Math.sin(a) * 42;
            s.enemies.forEach((e) => {
              const d = Math.hypot(e.x - ox, e.y - oy);
              if (d < e.r + 10) {
                e.hp -= 0.35 * p.dmgMult * (dt / 16);
              }
            });
          }
        }

        s.spawnTimer += dt;
        const interval = Math.max(350, s.spawnInterval - s.time * 0.015);
        if (s.spawnTimer >= interval) {
          s.spawnTimer = 0;
          const count = 1 + Math.floor(s.time / 20000);
          for (let i = 0; i < count; i++) spawnEnemy();
        }

        s.enemies.forEach((e) => {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          e.x += (dx / d) * e.speed * (dt / 16);
          e.y += (dy / d) * e.speed * (dt / 16);
          if (d < e.r + 14) {
            p.hp -= e.dmg * (dt / 1000);
            s.shake = fx.addShake(s.shake, 4, 120);
          }
        });

        for (let i = s.bullets.length - 1; i >= 0; i--) {
          const b = s.bullets[i];
          b.x += b.vx * (dt / 16);
          b.y += b.vy * (dt / 16);
          b.life -= dt / 1000;
          if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
            s.bullets.splice(i, 1);
            continue;
          }
          s.enemies.forEach((e) => {
            if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
              e.hp -= b.dmg;
              b.life = 0;
            }
          });
        }

        for (let i = s.enemies.length - 1; i >= 0; i--) {
          const e = s.enemies[i];
          if (e.hp <= 0) {
            s.gems.push({ x: e.x, y: e.y, v: 3 + Math.floor(s.player.level / 3) });
            fx.burst(s.particles, e.x, e.y, { count: 14, color: "#f87171", speed: 3 });
            s.enemies.splice(i, 1);
            s.kills++;
            ctx?.sfx?.("score");
          }
        }

        s.gems.forEach((gem) => {
          const dx = p.x - gem.x;
          const dy = p.y - gem.y;
          const d = Math.hypot(dx, dy);
          if (d < p.magnet) {
            gem.x += (dx / (d || 1)) * 4 * (dt / 16);
            gem.y += (dy / (d || 1)) * 4 * (dt / 16);
          }
          if (d < 18) {
            p.xp += gem.v;
            gem.v = -1;
            ctx?.sfx?.("pickup");
          }
        });
        s.gems = s.gems.filter((g) => g.v > 0);

        while (p.xp >= p.xpNext) {
          p.xp -= p.xpNext;
          p.level++;
          p.xpNext = Math.floor(p.xpNext * 1.35 + 8);
          p.pendingLevelUps++;
        }
        if (!s.paused && p.pendingLevelUps > 0) {
          p.pendingLevelUps--;
          showLevelUp();
        }

        if (p.hp <= 0) gameOver();

        const sec = Math.floor(s.time / 1000);
        stat.textContent = `Lv.${p.level} · HP ${Math.ceil(p.hp)} · ${sec}초 · 처치 ${s.kills}`;
      }

      const off = fx.offset(s.shake);
      g.save();
      g.translate(off.x, off.y);
      fx.fillBg(g, W, H, "#0c0a1a", "#1a1035");

      s.gems.forEach((gem) => {
        fx.glowCircle(g, gem.x, gem.y, 5, "#38bdf8", "#38bdf8");
      });

      s.bullets.forEach((b) => {
        fx.glowCircle(g, b.x, b.y, b.r, "#fde047", "#fbbf24");
      });

      s.enemies.forEach((e) => {
        g.fillStyle = "#ef4444";
        g.beginPath();
        g.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        g.fill();
        if (e.hp < e.maxHp) {
          g.fillStyle = "#1e293b";
          g.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 4);
          g.fillStyle = "#22c55e";
          g.fillRect(e.x - e.r, e.y - e.r - 8, (e.r * 2 * e.hp) / e.maxHp, 4);
        }
      });

      const p = s.player;
      if (p.orbit > 0) {
        for (let i = 0; i < p.orbit; i++) {
          const a = p.orbitAngle + (i / p.orbit) * Math.PI * 2;
          const ox = p.x + Math.cos(a) * 42;
          const oy = p.y + Math.sin(a) * 42;
          g.strokeStyle = "#a78bfa";
          g.lineWidth = 3;
          g.beginPath();
          g.arc(ox, oy, 8, 0, Math.PI * 2);
          g.stroke();
        }
      }

      fx.glowCircle(g, p.x, p.y, 14, "#60a5fa", "#3b82f6");
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.arc(p.x + 5, p.y - 4, 3, 0, Math.PI * 2);
      g.fill();

      if (!s.over && !s.paused) {
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.fillRect(8, H - 18, W - 16, 10);
        g.fillStyle = "#22c55e";
        g.fillRect(8, H - 18, ((W - 16) * p.hp) / p.maxHp, 10);
        g.fillStyle = "#38bdf8";
        g.fillRect(8, H - 30, ((W - 16) * p.xp) / p.xpNext, 6);
      }

      fx.draw(g, s.particles);
      g.restore();
      frameId = requestAnimationFrame(loop);
    }

    function setKey(e, down) {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keys.up = down;
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.down = down;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = down;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = down;
    }

    function onKeyDown(e) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(e.key)) {
        e.preventDefault();
        setKey(e, true);
      }
    }

    function onKeyUp(e) {
      setKey(e, false);
    }

    document.getElementById("survival-reset").addEventListener("click", reset);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    ctx.addCleanup(() => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    });

    reset();
    frameId = requestAnimationFrame(loop);
    ctx?.mountLeaderboard?.(container.querySelector(".mini-game"));
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderSurvival = renderSurvival;
})();
