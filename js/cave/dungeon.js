(function () {
  const WALL = 1;
  const FLOOR = 0;

  const MONSTER_DEFS = {
    slime: { name: "슬라임", hp: 15, atk: 4, aggro: 6, icon: "🟢", gold: [3, 8] },
    bat: { name: "박쥐", hp: 10, atk: 6, aggro: 8, icon: "🦇", gold: [2, 6] },
    skeleton: { name: "스켈레톤", hp: 25, atk: 8, aggro: 7, icon: "💀", gold: [8, 15] },
    orc: { name: "오크", hp: 40, atk: 12, aggro: 8, icon: "👹", gold: [12, 25] },
    boss: { name: "동굴 군주", hp: 200, atk: 18, aggro: 12, icon: "👺", gold: [100, 150] }
  };

  const ITEM_DEFS = {
    potion: { name: "HP 포션", icon: "🧪", effect: "heal", value: 30 },
    sword: { name: "검", icon: "⚔️", effect: "atk", value: 5 },
    shield: { name: "방패", icon: "🛡️", effect: "def", value: 3 },
    key: { name: "열쇠", icon: "🗝️", effect: "key", value: 1 },
    gold: { name: "골드", icon: "💰", effect: "gold", value: 0 },
    lantern: { name: "랜턴", icon: "🧿", effect: "lantern", value: 2 }
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function carveRoom(grid, x, y, w, h) {
    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        grid[ry][rx] = FLOOR;
      }
    }
  }

  function carveLine(grid, x0, y0, x1, y1) {
    let x = x0;
    let y = y0;
    while (x !== x1 || y !== y1) {
      grid[y][x] = FLOOR;
      if (x !== x1) x += x < x1 ? 1 : -1;
      else if (y !== y1) y += y < y1 ? 1 : -1;
    }
    grid[y1][x1] = FLOOR;
  }

  function roomCenter(room) {
    return {
      x: Math.floor(room.x + room.w / 2),
      y: Math.floor(room.y + room.h / 2)
    };
  }

  function isWalkable(grid, x, y, w, h) {
    return x >= 0 && x < w && y >= 0 && y < h && grid[y][x] === FLOOR;
  }

  function generateFloor(floor, runSeed) {
    const rng = mulberry32((runSeed + floor * 7919) >>> 0);
    const width = 40;
    const height = 30;
    const grid = Array.from({ length: height }, () => Array(width).fill(WALL));
    const rooms = [];

    const targetRooms = 6 + Math.floor(rng() * 3);
    for (let attempt = 0; attempt < 80 && rooms.length < targetRooms; attempt++) {
      const rw = 4 + Math.floor(rng() * 6);
      const rh = 4 + Math.floor(rng() * 5);
      const rx = 1 + Math.floor(rng() * (width - rw - 2));
      const ry = 1 + Math.floor(rng() * (height - rh - 2));
      const overlap = rooms.some(
        (r) => !(rx + rw + 1 < r.x || rx > r.x + r.w + 1 || ry + rh + 1 < r.y || ry > r.y + r.h + 1)
      );
      if (!overlap) {
        rooms.push({ x: rx, y: ry, w: rw, h: rh });
        carveRoom(grid, rx, ry, rw, rh);
      }
    }

    if (rooms.length < 2) {
      carveRoom(grid, 2, 2, 8, 6);
      carveRoom(grid, 20, 10, 8, 6);
      rooms.push({ x: 2, y: 2, w: 8, h: 6 }, { x: 20, y: 10, w: 8, h: 6 });
    }

    for (let i = 1; i < rooms.length; i++) {
      const a = roomCenter(rooms[i - 1]);
      const b = roomCenter(rooms[i]);
      if (rng() > 0.5) {
        carveLine(grid, a.x, a.y, b.x, a.y);
        carveLine(grid, b.x, a.y, b.x, b.y);
      } else {
        carveLine(grid, a.x, a.y, a.x, b.y);
        carveLine(grid, a.x, b.y, b.x, b.y);
      }
    }

    const start = roomCenter(rooms[0]);
    const end = roomCenter(rooms[rooms.length - 1]);
    const stairsDown = isBossFloor ? null : { x: end.x, y: end.y };
    const stairsUp = floor > 1 ? { x: start.x, y: start.y } : null;

    const floorTiles = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === FLOOR && !(x === start.x && y === start.y) && !(x === end.x && y === end.y)) {
          floorTiles.push({ x, y });
        }
      }
    }

    function pickTile() {
      return floorTiles[Math.floor(rng() * floorTiles.length)];
    }

    const isBossFloor = floor >= 10;
    const monsterCount = isBossFloor ? 0 : 3 + Math.floor(floor * 0.8) + Math.floor(rng() * 3);
    const monsters = [];
    const pool =
      floor <= 2
        ? ["slime", "bat"]
        : floor <= 5
          ? ["slime", "bat", "skeleton"]
          : ["bat", "skeleton", "orc"];

    for (let i = 0; i < monsterCount; i++) {
      const t = pickTile();
      const type = pool[Math.floor(rng() * pool.length)];
      const def = MONSTER_DEFS[type];
      const scale = 1 + (floor - 1) * 0.12;
      monsters.push({
        id: `${floor}-${i}-${Math.floor(rng() * 9999)}`,
        type,
        x: t.x,
        y: t.y,
        hp: Math.floor(def.hp * scale),
        maxHp: Math.floor(def.hp * scale),
        atk: Math.floor(def.atk * scale)
      });
    }

    if (isBossFloor) {
      const t = pickTile();
      const def = MONSTER_DEFS.boss;
      monsters.push({
        id: "boss",
        type: "boss",
        x: t.x,
        y: t.y,
        hp: def.hp,
        maxHp: def.hp,
        atk: def.atk
      });
    }

    const items = [];
    const itemCount = 2 + Math.floor(rng() * 3) + Math.floor(floor / 2);
    for (let i = 0; i < itemCount; i++) {
      const t = pickTile();
      const roll = rng();
      let type = "potion";
      if (roll > 0.75) type = "gold";
      else if (roll > 0.55) type = floor > 3 && rng() > 0.5 ? "sword" : "potion";
      else if (roll > 0.4 && floor > 2) type = "shield";
      else if (roll > 0.92 && floor > 4) type = "lantern";
      else if (roll > 0.88 && floor > 3) type = "key";

      const item = { id: `item-${floor}-${i}`, type, x: t.x, y: t.y };
      if (type === "gold") item.amount = 10 + Math.floor(rng() * 30) + floor * 3;
      items.push(item);
    }

    const fog = Array.from({ length: height }, () => Array(width).fill(0));

    return {
      width,
      height,
      grid,
      floor,
      stairsDown,
      stairsUp,
      monsters,
      items,
      fog,
      playerStart: { x: start.x, y: start.y }
    };
  }

  function hasLineOfSight(grid, x0, y0, x1, y1) {
    let x = x0;
    let y = y0;
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    while (x !== x1 || y !== y1) {
      if (grid[y][x] === WALL) return false;
      if (x !== x1) x += dx;
      else if (y !== y1) y += dy;
    }
    return true;
  }

  function updateFog(state) {
    const { grid, fog, player, width, height } = state;
    const radius = 6 + (player.lantern ? 2 : 0);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (fog[y][x] === 2) fog[y][x] = 1;
      }
    }

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = player.x + dx;
        const y = player.y + dy;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        if (hasLineOfSight(grid, player.x, player.y, x, y)) {
          fog[y][x] = 2;
        }
      }
    }
  }

  function monsterAt(state, x, y) {
    return state.monsters.find((m) => m.x === x && m.y === y);
  }

  function itemAt(state, x, y) {
    return state.items.find((i) => i.x === x && i.y === y);
  }

  function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function calcDamage(atk, def) {
    const roll = Math.floor(Math.random() * 5) - 2;
    return Math.max(1, atk - def + roll);
  }

  window.CaveDungeon = {
    WALL,
    FLOOR,
    MONSTER_DEFS,
    ITEM_DEFS,
    generateFloor,
    updateFog,
    hasLineOfSight,
    monsterAt,
    itemAt,
    manhattan,
    calcDamage,
    isWalkable
  };
})();
