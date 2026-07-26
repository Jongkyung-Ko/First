(function () {
  function ensureRoundRect(g) {
    if (!g.roundRect) {
      g.roundRect = function (x, y, w, h, r) {
        const rad = typeof r === "number" ? r : r[0] || 0;
        this.moveTo(x + rad, y);
        this.arcTo(x + w, y, x + w, y + h, rad);
        this.arcTo(x + w, y + h, x, y + h, rad);
        this.arcTo(x, y + h, x, y, rad);
        this.arcTo(x, y, x + w, y, rad);
        this.closePath();
      };
    }
  }

  function burst(pool, x, y, opts = {}) {
    const {
      count = 12,
      color = "#60a5fa",
      speed = 3,
      life = 0.5,
      size = 3,
      spread = Math.PI * 2
    } = opts;
    const base = opts.angle ?? -Math.PI / 2;
    for (let i = 0; i < count; i++) {
      const a = base + (Math.random() - 0.5) * spread;
      const v = speed * (0.4 + Math.random() * 0.6);
      pool.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        maxLife: life,
        color,
        size: size * (0.6 + Math.random() * 0.8)
      });
    }
  }

  function update(pool, dt) {
    const step = dt / 16;
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += 0.08 * step;
      p.life -= dt / 1000;
      if (p.life <= 0) pool.splice(i, 1);
    }
  }

  function draw(g, pool) {
    pool.forEach((p) => {
      const alpha = Math.max(0, p.life / p.maxLife);
      g.globalAlpha = alpha;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
  }

  function pushTrail(trail, x, y, max = 14) {
    trail.push({ x, y });
    while (trail.length > max) trail.shift();
  }

  function drawTrail(g, trail, color = "#93c5fd") {
    if (trail.length < 2) return;
    for (let i = 1; i < trail.length; i++) {
      const t = i / trail.length;
      g.strokeStyle = color;
      g.globalAlpha = t * 0.45;
      g.lineWidth = t * 8;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(trail[i - 1].x, trail[i - 1].y);
      g.lineTo(trail[i].x, trail[i].y);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function tickShake(shake, dt) {
    if (!shake || shake.t <= 0) return shake;
    shake.t -= dt;
    return shake;
  }

  function addShake(shake, intensity = 6, duration = 200) {
    return { amp: intensity, t: duration };
  }

  function offset(shake) {
    if (!shake || shake.t <= 0) return { x: 0, y: 0 };
    const f = shake.t / 200;
    return {
      x: (Math.random() - 0.5) * shake.amp * f,
      y: (Math.random() - 0.5) * shake.amp * f
    };
  }

  function fillBg(g, w, h, top = "#0f172a", bottom = "#1e293b") {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }

  function roundRect(g, x, y, w, h, r, fill, glow) {
    ensureRoundRect(g);
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    if (glow) {
      g.shadowColor = glow;
      g.shadowBlur = 12;
    }
    g.fillStyle = fill;
    g.fill();
    g.shadowBlur = 0;
  }

  function glowCircle(g, x, y, r, fill, glowColor) {
    g.shadowColor = glowColor || fill;
    g.shadowBlur = 16;
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  }

  window.GameFX = {
    prepare: ensureRoundRect,
    burst,
    update,
    draw,
    pushTrail,
    drawTrail,
    tickShake,
    addShake,
    offset,
    fillBg,
    roundRect,
    glowCircle
  };
})();
