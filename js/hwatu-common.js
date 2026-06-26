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

  function buildDeck() {
    const cards = [];
    let seq = 0;
    const add = (month, kind, extra = {}) => {
      cards.push({ id: `hw-${seq++}`, month, kind, piValue: 1, ...extra });
    };

    add(1, "gwang");
    add(1, "yeol");
    add(1, "tti", { dan: "cheong", poem: true });
    add(1, "pi");

    add(2, "gwang");
    add(2, "yeol");
    add(2, "tti", { dan: "cheong", poem: true });
    add(2, "pi");

    add(3, "gwang");
    add(3, "yeol");
    add(3, "tti", { dan: "hong", poem: true });
    add(3, "pi");

    add(4, "yeol");
    add(4, "tti", { dan: "chodan" });
    add(4, "pi");
    add(4, "pi");

    add(5, "yeol", { godori: true });
    add(5, "tti", { dan: "chodan" });
    add(5, "pi");
    add(5, "pi");

    add(6, "yeol");
    add(6, "tti", { dan: "hong" });
    add(6, "pi");
    add(6, "pi");

    add(7, "yeol", { godori: true });
    add(7, "tti", { dan: "chodan" });
    add(7, "pi");
    add(7, "pi");

    add(8, "gwang");
    add(8, "yeol");
    add(8, "tti", { dan: "chodan" });
    add(8, "pi");

    add(9, "yeol");
    add(9, "tti", { dan: "hong" });
    add(9, "pi");
    add(9, "pi");

    add(10, "yeol");
    add(10, "tti", { dan: "chodan" });
    add(10, "pi");
    add(10, "pi");

    add(11, "gwang");
    add(11, "yeol", { godori: true });
    add(11, "tti", { dan: "hong" });
    add(11, "pi");

    add(12, "gwang", { biGwang: true });
    add(12, "gwang");
    add(12, "tti", { dan: "chodan" });
    add(12, "pi", { piValue: 2 });

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
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `hwatu-card ${kindClass(card)}${opts.selected ? " selected" : ""}${opts.faceDown ? " face-down" : ""}${opts.dim ? " dim" : ""}`;
    btn.dataset.cardId = card.id;
    btn.title = `${monthLabel(card.month)} · ${cardShortLabel(card)}`;

    if (opts.faceDown) {
      btn.innerHTML = '<span class="hwatu-back">花</span>';
    } else {
      btn.innerHTML = `
        <span class="hwatu-month">${card.month}월</span>
        <span class="hwatu-kind">${cardShortLabel(card)}</span>
        <span class="hwatu-name">${monthLabel(card.month).split(" ")[1] || ""}</span>`;
    }
    return btn;
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
    WIN_THRESHOLD: 7,
    buildDeck,
    shuffle,
    monthLabel,
    cardShortLabel,
    cardEl,
    piCount,
    scoreCaptured,
    finalPayout
  };
})();
