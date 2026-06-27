(function () {
  function collectPixels() {
    const pts = new Set();

    function add(x, y) {
      if (x >= 0 && x < 32 && y >= 0 && y < 32) {
        pts.add(`${x},${y}`);
      }
    }

    function addRect(x, y, w, h) {
      for (let dy = 0; dy < h; dy += 1) {
        for (let dx = 0; dx < w; dx += 1) {
          add(x + dx, y + dy);
        }
      }
    }

    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const d = Math.hypot(x - 15.5, y - 15.5);
        if (d >= 11.5 && d <= 14.2) {
          add(x, y);
        }
      }
    }

    addRect(15, 5, 2, 3);
    addRect(15, 24, 2, 3);

    addRect(12, 10, 2, 13);
    addRect(14, 10, 4, 2);
    addRect(14, 14, 4, 2);
    addRect(14, 18, 4, 2);
    addRect(14, 21, 4, 2);
    addRect(17, 11, 2, 3);
    addRect(17, 15, 2, 3);
    addRect(17, 19, 2, 4);

    return pts;
  }

  const PIXEL_RECTS = [...collectPixels()]
    .map((key) => {
      const [x, y] = key.split(",").map(Number);
      return `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    })
    .join("");

  function svg(extraClass = "") {
    const cls = extraClass ? `dm-icon ${extraClass}` : "dm-icon";
    return `<svg class="${cls}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="presentation" shape-rendering="crispEdges"><g fill="currentColor">${PIXEL_RECTS}</g></svg>`;
  }

  function withText(text, extraClass = "") {
    return `<span class="dm-with-icon">${svg(extraClass)}<span>${text}</span></span>`;
  }

  function amountDm(formattedAmount) {
    return `<span class="dm-with-icon dm-amount-line"><span class="dm-amount">${formattedAmount}</span>${svg()}<span>DM</span></span>`;
  }

  function setBalance(el, formattedAmount) {
    if (!el) return;
    el.innerHTML = amountDm(formattedAmount);
  }

  function setText(el, text, extraClass = "") {
    if (!el) return;
    el.innerHTML = withText(text, extraClass);
  }

  window.DmIcon = {
    svg,
    withText,
    amountDm,
    setBalance,
    setText
  };
})();
