(function () {
  const TILE = 32;
  const VIEW_W = 15;
  const VIEW_H = 13;
  const CANVAS_W = VIEW_W * TILE;
  const CANVAS_H = VIEW_H * TILE;
  const MAX_FLOOR = 10;
  const MAX_INV = 8;

  const D = window.CaveDungeon;
  const fx = () => window.GameFX;

  function toolbarHtml(statId, resetId) {
    return `
      <div class="game-toolbar cave-toolbar">
        <div class="game-toolbar-stat" id="${statId}"></div>
        <button type="button" class="minesweeper-reset" id="${resetId}" title="새 게임">↺</button>
      </div>`;
  }

  function pushLog(state, msg) {
    state.log.unshift(msg);
    if (state.log.length > 4) state.log.length = 4;
    const el = document.getElementById("cave-log");
    if (el) el.textContent = state.log.join("\n");
  }

  function updateHud(state) {
    const p = state.player;
    const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
    document.getElementById("cave-stat").innerHTML = `
      <span class="cave-hp">HP <span class="cave-hp-bar"><span style="width:${hpPct}%"></span></span> ${p.hp}/${p.maxHp}</span>
      <span>B${state.floor}F</span>
      <span>⚔${p.atk}</span>
      <span>🛡${p.def}</span>
      <span>💰${p.gold}</span>
      ${p.keys ? `<span>🗝${p.keys}</span>` : ""}`;
    document.getElementById("cave-status").textContent = state.statusText || "";
    const invEl = document.getElementById("cave-inventory");
    if (invEl) {
      let html = state.inventory
        .map(
          (it, i) =>
            `<button type="button" class="cave-inv-slot" data-idx="${i}" title="${D.ITEM_DEFS[it.type]?.name || it.type}">${D.ITEM_DEFS[it.type]?.icon || "?"}</button>`
        )
        .join("");
      for (let i = state.inventory.length; i < MAX_INV; i++) {
        html += `<span class="cave-inv-slot empty">·</span>`;
      }
      invEl.innerHTML = html;
      invEl.querySelectorAll(".cave-inv-slot[data-idx]").forEach((btn) => {
        btn.onclick = () => useItem(state, Number(btn.dataset.idx));
      });
    }
  }

  function useItem(state, idx) {
    if (state.gameOver || state.victory || state.animating) return;
    const item = state.inventory[idx];
    if (!item) return;
    const def = D.ITEM_DEFS[item.type];
    const p = state.player;

    if (item.type === "potion") {
      p.hp = Math.min(p.maxHp, p.hp + def.value);
      state.inventory.splice(idx, 1);
      pushLog(state, `${def.name} 사용! HP +${def.value}`);
      fx()?.burst(state.particles, state.player.x * TILE, state.player.y * TILE, {
        count: 8,
        color: "#4ade80",
        speed: 2
      });
    } else if (item.type === "sword") {
      p.atk += def.value;
      state.inventory.splice(idx, 1);
      pushLog(state, `${def.name} 장착! ATK +${def.value}`);
    } else if (item.type === "shield") {
      p.def += def.value;
      state.inventory.splice(idx, 1);
      pushLog(state, `${def.name} 장착! DEF +${def.value}`);
    } else if (item.type === "lantern") {
      p.lantern = true;
      state.inventory.splice(idx, 1);
      pushLog(state, `${def.name} 장착! 시야 +2`);
    } else if (item.type === "key") {
      pushLog(state, "열쇠는 문 앞에서 사용합니다.");
      return;
    } else {
      return;
    }
    D.updateFog(state);
    updateHud(state);
    draw(state);
  }

  function newRun() {
    const runSeed = (Math.random() * 0xffffffff) >>> 0;
    const floorData = D.generateFloor(1, runSeed);
    const state = {
      ...floorData,
      runSeed,
      player: {
        x: floorData.playerStart.x,
        y: floorData.playerStart.y,
        hp: 100,
        maxHp: 100,
        atk: 12,
        def: 3,
        gold: 0,
        keys: 0,
        lantern: false,
        kills: 0
      },
      inventory: [],
      log: [],
      statusText: "",
      gameOver: false,
      victory: false,
      animating: false,
      particles: [],
      shake: null
    };
    D.updateFog(state);
    pushLog(state, "동굴 입구에 들어섰다. B1F");
    return state;
  }

  function nextFloor(state) {
    const next = state.floor + 1;
    if (next > MAX_FLOOR) return;
    const floorData = D.generateFloor(next, state.runSeed);
    Object.assign(state, {
      grid: floorData.grid,
      width: floorData.width,
      height: floorData.height,
      monsters: floorData.monsters,
      items: floorData.items,
      stairsDown: floorData.stairsDown,
      stairsUp: floorData.stairsUp,
      fog: floorData.fog,
      floor: next
    });
    state.player.x = floorData.playerStart.x;
    state.player.y = floorData.playerStart.y;
    D.updateFog(state);
    pushLog(state, `B${next}F 로 내려왔다.`);
    state.statusText = "";
  }

  function scoreOf(state) {
    return state.floor * 100 + state.player.kills * 10 + state.player.gold;
  }

  function pickupItem(state, item) {
    const def = D.ITEM_DEFS[item.type];
    if (item.type === "gold") {
      const amt = item.amount || 15;
      state.player.gold += amt;
      pushLog(state, `골드 +${amt}`);
      state.items = state.items.filter((i) => i.id !== item.id);
      return;
    }
    if (state.inventory.length >= MAX_INV) {
      pushLog(state, "인벤토리가 가득 찼습니다.");
      return;
    }
    state.inventory.push({ type: item.type });
    state.items = state.items.filter((i) => i.id !== item.id);
    pushLog(state, `${def.name} 획득!`);
  }

  function tryMove(state, dx, dy, ctx) {
    if (state.gameOver || state.victory || state.animating) return;

    const nx = state.player.x + dx;
    const ny = state.player.y + dy;
    if (!D.isWalkable(state.grid, nx, ny, state.width, state.height)) return;

    const monster = D.monsterAt(state, nx, ny);
    if (monster) {
      const dmg = D.calcDamage(state.player.atk, 0);
      monster.hp -= dmg;
      pushLog(state, `${D.MONSTER_DEFS[monster.type].name}에게 ${dmg} 피해!`);
      fx()?.burst(state.particles, nx * TILE, ny * TILE, { count: 10, color: "#f87171", speed: 2.5 });
      if (monster.hp <= 0) {
        const def = D.MONSTER_DEFS[monster.type];
        const gold = def.gold[0] + Math.floor(Math.random() * (def.gold[1] - def.gold[0] + 1));
        state.player.gold += gold;
        state.player.kills++;
        state.monsters = state.monsters.filter((m) => m.id !== monster.id);
        pushLog(state, `${def.name} 처치! +${gold} 골드`);
        fx()?.burst(state.particles, nx * TILE, ny * TILE, { count: 16, color: "#fbbf24", speed: 3 });
        if (monster.type === "boss") {
          state.victory = true;
          state.statusText = "동굴 군주를 물리쳤다! 승리!";
          ctx?.recordScore?.(scoreOf(state));
        }
      }
    } else {
      state.player.x = nx;
      state.player.y = ny;
      const item = D.itemAt(state, nx, ny);
      if (item) pickupItem(state, item);
      if (state.stairsDown && nx === state.stairsDown.x && ny === state.stairsDown.y) {
        nextFloor(state);
      }
    }

    monsterTurn(state, ctx);
    D.updateFog(state);
    updateHud(state);
    draw(state);
  }

  function monsterTurn(state, ctx) {
    if (state.gameOver || state.victory) return;
    const p = state.player;

    state.monsters.forEach((m) => {
      if (state.fog[m.y][m.x] !== 2) return;
      const def = D.MONSTER_DEFS[m.type];
      const dist = D.manhattan(m.x, m.y, p.x, p.y);

      if (dist === 1) {
        const dmg = D.calcDamage(m.atk, p.def);
        p.hp -= dmg;
        pushLog(state, `${def.name}의 공격! ${dmg} 피해`);
        state.shake = fx()?.addShake(state.shake, 5, 150);
        fx()?.burst(state.particles, p.x * TILE, p.y * TILE, { count: 8, color: "#ef4444", speed: 2 });
        return;
      }

      if (dist > def.aggro) return;

      let mx = m.x;
      let my = m.y;
      if (Math.abs(p.x - m.x) > Math.abs(p.y - m.y)) {
        mx += p.x > m.x ? 1 : -1;
      } else {
        my += p.y > m.y ? 1 : -1;
      }

      if (mx === p.x && my === p.y) return;
      if (!D.isWalkable(state.grid, mx, my, state.width, state.height)) return;
      if (D.monsterAt(state, mx, my)) return;
      if (mx === p.x && my === p.y) return;
      m.x = mx;
      m.y = my;
    });

    if (p.hp <= 0) {
      p.hp = 0;
      state.gameOver = true;
      state.statusText = "쓰러졌다... ↺ 로 다시 시작";
      ctx?.recordScore?.(scoreOf(state));
      pushLog(state, `사망. 점수: ${scoreOf(state)}`);
    }
  }

  function draw(state) {
    const canvas = document.getElementById("cave-canvas");
    if (!canvas) return;
    const g = canvas.getContext("2d");
    fx()?.prepare(g);
    if (state.shake) state.shake = fx()?.tickShake(state.shake, 16);
    const off = fx()?.offset(state.shake) || { x: 0, y: 0 };

    g.save();
    g.translate(off.x, off.y);

    const camX = Math.max(0, Math.min(state.width - VIEW_W, state.player.x - Math.floor(VIEW_W / 2)));
    const camY = Math.max(0, Math.min(state.height - VIEW_H, state.player.y - Math.floor(VIEW_H / 2)));

    g.fillStyle = "#050810";
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (let vy = 0; vy < VIEW_H; vy++) {
      for (let vx = 0; vx < VIEW_W; vx++) {
        const mx = camX + vx;
        const my = camY + vy;
        if (mx >= state.width || my >= state.height) continue;

        const vis = state.fog[my][mx];
        if (vis === 0) continue;

        const px = vx * TILE;
        const py = vy * TILE;

        if (state.grid[my][mx] === D.WALL) {
          g.fillStyle = vis === 2 ? "#334155" : "#1e293b";
          g.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          if (vis === 2) {
            g.fillStyle = "#475569";
            g.fillRect(px + 4, py + 4, TILE - 8, 4);
          }
        } else {
          g.fillStyle = vis === 2 ? "#1a2332" : "#111827";
          g.fillRect(px, py, TILE, TILE);
          if (vis === 2) {
            g.strokeStyle = "rgba(51,65,85,0.4)";
            g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          }
        }

        if (vis !== 2) continue;

        if (state.stairsDown && mx === state.stairsDown.x && my === state.stairsDown.y) {
          g.font = "22px sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText("⬇️", px + TILE / 2, py + TILE / 2);
        }

        const item = D.itemAt(state, mx, my);
        if (item) {
          g.font = "20px sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(D.ITEM_DEFS[item.type]?.icon || "?", px + TILE / 2, py + TILE / 2);
        }

        const monster = D.monsterAt(state, mx, my);
        if (monster) {
          g.font = "22px sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(D.MONSTER_DEFS[monster.type]?.icon || "?", px + TILE / 2, py + TILE / 2);
          if (monster.hp < monster.maxHp) {
            g.fillStyle = "#ef4444";
            g.fillRect(px + 4, py + 2, ((TILE - 8) * monster.hp) / monster.maxHp, 3);
          }
        }
      }
    }

    const pvx = (state.player.x - camX) * TILE;
    const pvy = (state.player.y - camY) * TILE;
    if (state.player.x >= camX && state.player.x < camX + VIEW_W && state.player.y >= camY && state.player.y < camY + VIEW_H) {
      fx()?.glowCircle(g, pvx + TILE / 2, pvy + TILE / 2, 12, "#fbbf24", "#f59e0b");
      g.font = "24px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("🧙", pvx + TILE / 2, pvy + TILE / 2);
    }

    for (let vy = 0; vy < VIEW_H; vy++) {
      for (let vx = 0; vx < VIEW_W; vx++) {
        const mx = camX + vx;
        const my = camY + vy;
        if (mx >= state.width || my >= state.height) continue;
        const vis = state.fog[my][mx];
        const px = vx * TILE;
        const py = vy * TILE;
        if (vis === 0) {
          g.fillStyle = "rgba(0,0,0,1)";
          g.fillRect(px, py, TILE, TILE);
        } else if (vis === 1) {
          g.fillStyle = "rgba(0,0,0,0.72)";
          g.fillRect(px, py, TILE, TILE);
        }
      }
    }

    if (state.player.lantern) {
      const grad = g.createRadialGradient(
        pvx + TILE / 2,
        pvy + TILE / 2,
        8,
        pvx + TILE / 2,
        pvy + TILE / 2,
        TILE * 4
      );
      grad.addColorStop(0, "rgba(251,191,36,0.08)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    fx()?.draw(g, state.particles);
    g.restore();
  }

  function renderCave(container, ctx) {
    container.innerHTML = `
      <div class="mini-game cave-game">
        ${toolbarHtml("cave-stat", "cave-reset")}
        <canvas class="game-canvas cave-canvas" id="cave-canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
        <div class="cave-inventory" id="cave-inventory"></div>
        <p class="cave-log" id="cave-log"></p>
        <p class="minesweeper-hint">방향키 이동·공격 · 인벤토리 클릭으로 아이템 사용 · ⬇️ 계단으로 하층</p>
        <p class="minesweeper-status" id="cave-status"></p>
      </div>`;

    let state;
    try {
      if (!window.CaveDungeon) throw new Error("동굴 모듈을 불러오지 못했습니다.");
      state = newRun();
      updateHud(state);
      draw(state);
    } catch (err) {
      console.error(err);
      document.getElementById("cave-status").textContent =
        "게임을 시작할 수 없습니다. 페이지를 새로고침해 주세요.";
      return;
    }

    let animId = null;
    function tick() {
      if (state.particles.length) {
        fx()?.update(state.particles, 16);
        draw(state);
      }
      animId = requestAnimationFrame(tick);
    }
    animId = requestAnimationFrame(tick);

    function onKey(e) {
      const map = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0]
      };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      tryMove(state, d[0], d[1], ctx);
    }

    document.getElementById("cave-reset").addEventListener("click", () => {
      state = newRun();
      updateHud(state);
      draw(state);
    });

    document.addEventListener("keydown", onKey);
    ctx.addCleanup(() => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(animId);
    });

    ctx?.mountLeaderboard?.(container.querySelector(".cave-game"));
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderCave = renderCave;
})();
