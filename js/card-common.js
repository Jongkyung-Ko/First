(function () {
  const SUITS = [
    { id: "s", symbol: "♠", color: "black" },
    { id: "h", symbol: "♥", color: "red" },
    { id: "d", symbol: "♦", color: "red" },
    { id: "c", symbol: "♣", color: "black" }
  ];

  const RANK_LABELS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  function createDeck() {
    const deck = [];
    SUITS.forEach((suit) => {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ suit: suit.id, rank, id: `${suit.id}-${rank}` });
      }
    });
    return deck;
  }

  function shuffle(deck) {
    const arr = deck.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function suitOf(card) {
    return SUITS.find((s) => s.id === card.suit);
  }

  function cardLabel(card) {
    return `${RANK_LABELS[card.rank - 1]}${suitOf(card).symbol}`;
  }

  function isRed(card) {
    return suitOf(card).color === "red";
  }

  function oppositeColor(a, b) {
    return isRed(a) !== isRed(b);
  }

  function cardEl(card, opts = {}) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `playing-card ${isRed(card) ? "card-red" : "card-black"}${opts.selected ? " selected" : ""}${opts.faceDown ? " face-down" : ""}`;
    btn.dataset.cardId = card.id;
    if (opts.faceDown) {
      btn.innerHTML = '<span class="card-back">🂠</span>';
    } else {
      const rank = RANK_LABELS[card.rank - 1];
      const sym = suitOf(card).symbol;
      btn.innerHTML = `<span class="card-corner tl">${rank}<br>${sym}</span><span class="card-center">${sym}</span><span class="card-corner br">${rank}<br>${sym}</span>`;
    }
    return btn;
  }

  function handValue(cards) {
    let total = 0;
    let aces = 0;
    cards.forEach((c) => {
      if (c.rank === 1) {
        aces++;
        total += 11;
      } else if (c.rank >= 10) total += 10;
      else total += c.rank;
    });
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }

  window.CardCommon = {
    SUITS,
    RANK_LABELS,
    createDeck,
    shuffle,
    suitOf,
    cardLabel,
    isRed,
    oppositeColor,
    cardEl,
    handValue
  };
})();
