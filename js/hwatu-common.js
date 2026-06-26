(function () {
  const MONTH_LABELS = [
    "",
    "1월 송학",
    "2월 매조",
    "3월 벚꽃",
    "4월 등나무",
    "5월 난초",
    "6월 모란",
    "7월 홍싸리",
    "8월 억새",
    "9월 국화",
    "10월 단풍",
    "11월 오동",
    "12월 비"
  ];

  const KIND_LABELS = { gwang: "광", yeol: "열끗", tti: "띠", pi: "피" };

  const SPRITE_COLS = 12;
  const SPRITE_ROWS = 4;
  const SPRITE_URL = "images/hwatu/overview.png";
  const BACK_URL = "images/hwatu/back.png";

  /** Sprite sheet layout: 12×4 grid (Marcus Richert Hwatu overview). Row 4 order: Oct, Dec, Nov. */
  const MONTH_BLOCK = {
    1: 0,
    2: 4,
    3: 8,
    4: 12,
    5: 16,
    6: 20,
    7: 24,
    8: 28,
    9: 32,
    10: 36,
    11: 44,
    12: 40
  };

  function spritePosition(spriteIndex) {
    const col = spriteIndex % SPRITE_COLS;
    const row = Math.floor(spriteIndex / SPRITE_COLS);
    const x = SPRITE_COLS > 1 ? (col / (SPRITE_COLS - 1)) * 100 : 0;
    const y = SPRITE_ROWS > 1 ? (row / (SPRITE_ROWS - 1)) * 100 : 0;
    return { x, y };
  }

  function spriteStyle(spriteIndex) {
    const { x, y } = spritePosition(spriteIndex);
    return {
      backgroundImage: `url("${SPRITE_URL}")`,
      backgroundSize: `${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}%`,
      backgroundPosition: `${x}% ${y}%`
    };
  }

  function buildDeck() {
    const cards = [];
    let seq = 0;
    const add = (month, kind, extra = {}, slot = 0) => {
      cards.push({
        id: `hw-${seq++}`,
        month,
        kind,
        piValue: 1,
        spriteIndex: MONTH_BLOCK[month] + slot,
        ...extra
      });
    };

    add(1, "gwang", {}, 0);
    add(1, "yeol", {}, 1);
    add(1, "tti", { dan: "cheong", poem: true }, 2);
    add(1, "pi", {}, 3);

    add(2, "gwang", {}, 0);
    add(2, "yeol", {}, 1);
    add(2, "tti", { dan: "cheong", poem: true }, 2);
    add(2, "pi", {}, 3);

    add(3, "gwang", {}, 0);
    add(3, "yeol", {}, 1);
    add(3, "tti", { dan: "hong", poem: true }, 2);
    add(3, "pi", {}, 3);

    add(4, "yeol", {}, 0);
    add(4, "tti", { dan: "chodan" }, 1);
    add(4, "pi", {}, 2);
    add(4, "pi", {}, 3);

    add(5, "yeol", { godori: true }, 0);
    add(5, "tti", { dan: "chodan" }, 1);
    add(5, "pi", {}, 2);
    add(5, "pi", {}, 3);

    add(6, "yeol", {}, 0);
    add(6, "tti", { dan: "hong" }, 1);
    add(6, "pi", {}, 2);
    add(6, "pi", {}, 3);

    add(7, "yeol", { godori: true }, 0);
    add(7, "tti", { dan: "chodan" }, 1);
    add(7, "pi", {}, 2);
    add(7, "pi", {}, 3);

    add(8, "gwang", {}, 0);
    add(8, "yeol", {}, 1);
    add(8, "tti", { dan: "chodan" }, 2);
    add(8, "pi", {}, 3);

    add(9, "yeol", {}, 0);
    add(9, "tti", { dan: "hong" }, 1);
    add(9, "pi", {}, 2);
    add(9, "pi", {}, 3);

    add(10, "yeol", {}, 0);
    add(10, "tti", { dan: "chodan" }, 1);
    add(10, "pi", {}, 2);
    add(10, "pi", {}, 3);

    add(11, "gwang", {}, 0);
    add(11, "yeol", { godori: true }, 1);
    add(11, "tti", { dan: "hong" }, 2);
    add(11, "pi", {}, 3);

    add(12, "gwang", { biGwang: true }, 0);
    add(12, "gwang", {}, 1);
    add(12, "tti", { dan: "chodan" }, 2);
    add(12, "pi", { piValue: 2 }, 3);

    return cards;
  }

  function shuffle(deck) {
    const arr = deck.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function monthLabel(month) {
    return MONTH_LABELS[month] || `${month}월`;
  }

  function cardShortLabel(card) {
    const k = KIND_LABELS[card.kind] || card.kind;
    if (card.kind === "gwang" && card.biGwang) return "비광";
    if (card.godori) return "고도리";
    if (card.dan === "hong") return "홍단";
    if (card.dan === "cheong") return "청단";
    if (card.dan === "chodan") return "초단";
    if (card.piValue > 1) return "쌍피";
    return k;
  }

  function kindClass(card) {
    return `hwatu-${card.kind}${card.biGwang ? " hwatu-bi" : ""}${card.godori ? " hwatu-godori" : ""}`;
  }

  function cardEl(card, opts = {}) {
    const tag = opts.readonly ? "div" : "button";
    const el = document.createElement(tag);
    if (!opts.readonly) el.type = "button";
    el.className = `hwatu-card ${kindClass(card)}${opts.small ? " hwatu-card-small" : ""}${opts.selected ? " selected" : ""}${opts.faceDown ? " face-down" : ""}${opts.dim ? " dim" : ""}${opts.readonly ? " hwatu-card-readonly" : ""}`;
    el.dataset.cardId = card.id;
    const label = `${monthLabel(card.month)} · ${cardShortLabel(card)}`;
    el.title = label;
    if (opts.readonly) {
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", label);
    }

    if (opts.faceDown) {
      const back = document.createElement("span");
      back.className = "hwatu-sprite hwatu-sprite-back";
      back.style.backgroundImage = `url("${BACK_URL}")`;
      el.appendChild(back);
    } else {
      const face = document.createElement("span");
      face.className = "hwatu-sprite";
      face.setAttribute("aria-hidden", "true");
      const style = spriteStyle(card.spriteIndex);
      face.style.backgroundImage = style.backgroundImage;
      face.style.backgroundSize = style.backgroundSize;
      face.style.backgroundPosition = style.backgroundPosition;
      el.appendChild(face);
    }
    return el;
  }

  function piCount(cards) {
    return cards.filter((c) => c.kind === "pi").reduce((s, c) => s + (c.piValue || 1), 0);
  }

  function scoreCaptured(captured) {
    const breakdown = [];
    let total = 0;

    const gwang = captured.filter((c) => c.kind === "gwang");
    const yeol = captured.filter((c) => c.kind === "yeol");
    const tti = captured.filter((c) => c.kind === "tti");
    const pi = piCount(captured);

    const gN = gwang.length;
    const hasBi = gwang.some((c) => c.biGwang);
    const brightGwang = gwang.filter((c) => !c.biGwang).length;

    if (gN >= 5) {
      total += 15;
      breakdown.push("5광 15점");
    } else if (gN === 4) {
      const pts = hasBi && brightGwang < 4 ? 4 : 5;
      total += pts;
      breakdown.push(`4광 ${pts}점`);
    } else if (gN === 3) {
      const pts = hasBi && brightGwang < 2 ? 2 : 3;
      total += pts;
      breakdown.push(`3광 ${pts}점`);
    }

    const godoriMonths = [5, 7, 11];
    if (godoriMonths.every((m) => yeol.some((c) => c.month === m && c.godori))) {
      total += 5;
      breakdown.push("고도리 5점");
    }

    const hongMonths = [3, 6, 9];
    if (hongMonths.every((m) => tti.some((c) => c.month === m && c.dan === "hong"))) {
      total += 3;
      breakdown.push("홍단 3점");
    }

    const cheongMonths = [1, 2, 3];
    if (cheongMonths.every((m) => tti.some((c) => c.month === m && c.dan === "cheong"))) {
      total += 3;
      breakdown.push("청단 3점");
    }

    const chodanMonths = [4, 5, 6, 7];
    if (chodanMonths.every((m) => tti.some((c) => c.month === m && c.dan === "chodan"))) {
      total += 3;
      breakdown.push("초단 3점");
    }

    if (yeol.length >= 5) {
      const pts = yeol.length - 4;
      total += pts;
      breakdown.push(`열끗 ${yeol.length}장 ${pts}점`);
    }

    if (tti.length >= 5) {
      const pts = tti.length - 4;
      total += pts;
      breakdown.push(`띠 ${tti.length}장 ${pts}점`);
    }

    if (pi >= 10) {
      const pts = pi - 9;
      total += pts;
      breakdown.push(`피 ${pi}장 ${pts}점`);
    }

    return { total, breakdown };
  }

  function finalPayout(basePoints, goCount, isThreeGo) {
    const mult = Math.pow(2, goCount);
    const threeBonus = isThreeGo && goCount >= 3 ? 3 : 1;
    return basePoints * mult * threeBonus;
  }

  window.HwatuCommon = {
    MONTH_LABELS,
    KIND_LABELS,
    SPRITE_URL,
    BACK_URL,
    WIN_THRESHOLD: 7,
    buildDeck,
    shuffle,
    monthLabel,
    cardShortLabel,
    cardEl,
    spriteStyle,
    piCount,
    scoreCaptured,
    finalPayout
  };
})();
