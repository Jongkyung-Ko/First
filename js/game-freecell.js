(function () {
  const C = window.CardCommon;

  function setupLeaderboard(ctx, container) {
    const root = container.querySelector(".mini-game");
    if (root && ctx?.mountLeaderboard) ctx.mountLeaderboard(root);
  }

  function toolbarHtml(statId, resetId) {
    return `
      <div class="game-toolbar">
        <div class="game-toolbar-stat" id="${statId}"></div>
        <button type="button" class="minesweeper-reset" id="${resetId}" title="새 게임">↺</button>
      </div>`;
  }

  function canOnColumn(card, top) {
    if (!top) return true;
    return C.oppositeColor(card, top) && card.rank === top.rank - 1;
  }

  function canOnFoundation(card, top) {
    if (!top) return card.rank === 1;
    return card.suit === top.suit && card.rank === top.rank + 1;
  }

  function deal(columns, deck) {
    let i = 0;
    for (let col = 0; col < 8; col++) {
      const count = col < 4 ? 7 : 6;
      for (let j = 0; j < count; j++) columns[col].push(deck[i++]);
    }
  }

  function renderFreecell(container, ctx) {
    let columns = Array.from({ length: 8 }, () => []);
    let freecells = [null, null, null, null];
    let foundations = [[], [], [], []];
    let selected = null;
    let moves = 0;
    let startTime = Date.now();
    let won = false;

    container.innerHTML = `
      <div class="mini-game freecell-game">
        ${toolbarHtml("fc-stat", "fc-reset")}
        <div class="freecell-top">
          <div class="freecell-foundation" id="fc-foundations"></div>
          <div class="freecell-cells" id="fc-freecells"></div>
        </div>
        <div class="freecell-columns" id="fc-columns"></div>
        <p class="minesweeper-hint">카드를 탭해 선택 → 목적지 탭으로 이동. 더블탭/더블클릭 시 슈트 홈으로 자동 이동.</p>
        <p class="minesweeper-status" id="fc-status"></p>
      </div>`;

    const statEl = document.getElementById("fc-stat");
    const statusEl = document.getElementById("fc-status");

    function foundationSuitIndex(card) {
      return C.SUITS.findIndex((s) => s.id === card.suit);
    }

    function clearSelect() {
      selected = null;
    }

    function updateStat() {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      const found = foundations.reduce((n, f) => n + f.length, 0);
      statEl.textContent = `이동: ${moves} · 시간: ${sec}초 · 홈: ${found}/52`;
    }

    function checkWin() {
      if (foundations.every((f) => f.length === 13)) {
        won = true;
        const sec = Math.floor((Date.now() - startTime) / 1000);
        statusEl.textContent = `클리어! ${moves}수 · ${sec}초`;
        ctx?.recordScore?.(sec * 1000 + moves);
      }
    }

    function removeCard(source) {
      if (source.type === "column") {
        return columns[source.col].pop();
      }
      if (source.type === "freecell") {
        const card = freecells[source.idx];
        freecells[source.idx] = null;
        return card;
      }
      return null;
    }

    function tryMove(card, source, dest) {
      if (!card || won) return false;

      if (dest.type === "foundation") {
        const fi = dest.idx;
        const top = foundations[fi][foundations[fi].length - 1];
        if (!canOnFoundation(card, top)) return false;
        if (top && card.suit !== top.suit) return false;
        if (!top && foundationSuitIndex(card) !== fi) return false;
        removeCard(source);
        foundations[fi].push(card);
        moves++;
        clearSelect();
        return true;
      }

      if (dest.type === "freecell") {
        if (freecells[dest.idx]) return false;
        removeCard(source);
        freecells[dest.idx] = card;
        moves++;
        clearSelect();
        return true;
      }

      if (dest.type === "column") {
        const col = columns[dest.col];
        const top = col[col.length - 1];
        if (!canOnColumn(card, top)) return false;
        removeCard(source);
        col.push(card);
        moves++;
        clearSelect();
        return true;
      }

      return false;
    }

    function autoFoundation(source) {
      if (!source) return;
      let card = null;
      if (source.type === "column" && columns[source.col].length) {
        card = columns[source.col][columns[source.col].length - 1];
      } else if (source.type === "freecell") {
        card = freecells[source.idx];
      }
      if (!card) return;

      const fi = foundationSuitIndex(card);
      const top = foundations[fi][foundations[fi].length - 1];
      if (canOnFoundation(card, top)) {
        tryMove(card, source, { type: "foundation", idx: fi });
        paint();
        checkWin();
        updateStat();
      }
    }

    function onCardClick(dest, destCard) {
      if (won) return;

      if (dest.type === "column" && destCard) {
        const col = columns[dest.col];
        if (col[col.length - 1]?.id !== destCard.id) return;
      }
      if (dest.type === "freecell" && destCard) {
        if (!freecells[dest.idx] || freecells[dest.idx].id !== destCard.id) return;
      }

      if (!selected) {
        if (!destCard) return;
        selected = { source: dest, card: destCard };
        paint();
        return;
      }

      const destTarget =
        dest.type === "column"
          ? { type: "column", col: dest.col }
          : dest.type === "freecell"
            ? { type: "freecell", idx: dest.idx }
            : { type: "foundation", idx: dest.idx };

      const moved = tryMove(selected.card, selected.source, destTarget);
      if (moved) {
        paint();
        checkWin();
        updateStat();
        return;
      }

      if (destCard) {
        selected = { source: dest, card: destCard };
      } else {
        clearSelect();
      }
      paint();
    }

    function clickEmpty(dest) {
      if (!selected || won) return;
      if (tryMove(selected.card, selected.source, dest)) {
        paint();
        checkWin();
        updateStat();
      }
    }

    function bindCard(btn, source, card) {
      const sel =
        selected &&
        selected.card.id === card.id &&
        selected.source.type === source.type &&
        (source.type !== "column" || selected.source.col === source.col) &&
        (source.type !== "freecell" || selected.source.idx === source.idx);

      if (sel) btn.classList.add("selected");

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onCardClick(source, card);
      });
      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        autoFoundation(source);
      });
    }

    function paint() {
      updateStat();

      const fcEl = document.getElementById("fc-freecells");
      fcEl.innerHTML = "";
      freecells.forEach((card, idx) => {
        const slot = document.createElement("div");
        slot.className = "card-slot";
        if (card) {
          const btn = C.cardEl(card);
          bindCard(btn, { type: "freecell", idx }, card);
          slot.appendChild(btn);
        } else {
          slot.addEventListener("click", () => clickEmpty({ type: "freecell", idx }));
        }
        fcEl.appendChild(slot);
      });

      const foundEl = document.getElementById("fc-foundations");
      foundEl.innerHTML = "";
      C.SUITS.forEach((suit, idx) => {
        const slot = document.createElement("div");
        slot.className = "card-slot foundation-slot";
        const pile = foundations[idx];
        const top = pile[pile.length - 1];
        if (top) {
          const btn = C.cardEl(top);
          bindCard(btn, { type: "foundation", idx }, top);
          slot.appendChild(btn);
        } else {
          slot.textContent = suit.symbol;
          slot.classList.add("foundation-empty");
          slot.addEventListener("click", () => clickEmpty({ type: "foundation", idx }));
        }
        foundEl.appendChild(slot);
      });

      const colEl = document.getElementById("fc-columns");
      colEl.innerHTML = "";
      columns.forEach((col, colIdx) => {
        const wrap = document.createElement("div");
        wrap.className = "freecell-column";
        if (!col.length) {
          wrap.addEventListener("click", () => clickEmpty({ type: "column", col: colIdx }));
        }
        col.forEach((card, i) => {
          const btn = C.cardEl(card);
          btn.style.marginTop = i === 0 ? "0" : "-72px";
          btn.style.position = "relative";
          btn.style.zIndex = String(i);
          bindCard(btn, { type: "column", col: colIdx }, card);
          wrap.appendChild(btn);
        });
        colEl.appendChild(wrap);
      });
    }

    function reset() {
      const deck = C.shuffle(C.createDeck());
      columns = Array.from({ length: 8 }, () => []);
      freecells = [null, null, null, null];
      foundations = [[], [], [], []];
      selected = null;
      moves = 0;
      startTime = Date.now();
      won = false;
      statusEl.textContent = "";
      deal(columns, deck);
      paint();
    }

    document.getElementById("fc-reset").addEventListener("click", reset);
    reset();
    setupLeaderboard(ctx, container);
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderFreecell = renderFreecell;
})();
