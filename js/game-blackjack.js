(function () {
  const C = window.CardCommon;
  const BET = 10;

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

  function renderBlackjack(container, ctx) {
    let chips = 1000;
    let deck = [];
    let player = [];
    let dealer = [];
    let phase = "bet";
    let message = "";

    container.innerHTML = `
      <div class="mini-game blackjack-game">
        ${toolbarHtml("bj-stat", "bj-reset")}
        <div class="blackjack-table">
          <div class="blackjack-hand">
            <div class="blackjack-label">딜러 <span id="bj-dealer-val"></span></div>
            <div class="blackjack-cards" id="bj-dealer-cards"></div>
          </div>
          <div class="blackjack-hand">
            <div class="blackjack-label">나 <span id="bj-player-val"></span></div>
            <div class="blackjack-cards" id="bj-player-cards"></div>
          </div>
        </div>
        <div class="blackjack-actions" id="bj-actions"></div>
        <p class="minesweeper-hint">블랙잭 21! 딜러는 17 이상에서 스탠드. 배팅 ${BET} 칩.</p>
        <p class="minesweeper-status" id="bj-status"></p>
      </div>`;

    const statEl = document.getElementById("bj-stat");
    const statusEl = document.getElementById("bj-status");
    const actionsEl = document.getElementById("bj-actions");

    function drawCard() {
      return deck.pop();
    }

    function newShoe() {
      deck = C.shuffle(C.createDeck());
    }

    function updateStat() {
      statEl.textContent = `칩: ${chips}`;
      statusEl.textContent = message;
    }

    function renderHand(elId, cards, hideFirst) {
      const el = document.getElementById(elId);
      el.innerHTML = "";
      cards.forEach((card, i) => {
        const faceDown = hideFirst && i === 0;
        el.appendChild(C.cardEl(card, { faceDown }));
      });
    }

    function updateValues(hideDealer) {
      const pv = C.handValue(player);
      document.getElementById("bj-player-val").textContent = player.length ? `(${pv})` : "";
      if (hideDealer && dealer.length) {
        const up = dealer.slice(1);
        document.getElementById("bj-dealer-val").textContent = up.length ? `(${C.handValue(up)}+?)` : "";
      } else {
        document.getElementById("bj-dealer-val").textContent = dealer.length ? `(${C.handValue(dealer)})` : "";
      }
    }

    function isBlackjack(hand) {
      return hand.length === 2 && C.handValue(hand) === 21;
    }

    function endRound(result, chipDelta) {
      chips += chipDelta;
      phase = "bet";
      message = result;
      if (chips > 0) ctx?.recordScore?.(chips);
      paintActions();
      updateStat();
    }

    function dealerPlay() {
      phase = "dealer";
      renderHand("bj-dealer-cards", dealer, false);
      updateValues(false);

      while (C.handValue(dealer) < 17) {
        dealer.push(drawCard());
      }
      renderHand("bj-dealer-cards", dealer, false);
      updateValues(false);

      const pv = C.handValue(player);
      const dv = C.handValue(dealer);

      if (dv > 21) {
        endRound(`딜러 버스트! +${BET} 칩`, BET * 2);
      } else if (pv > dv) {
        endRound(`승리! +${BET} 칩`, BET * 2);
      } else if (pv < dv) {
        endRound(`패배... -${BET} 칩`, 0);
      } else {
        endRound("푸시 (무승부)", BET);
      }
    }

    function playerBust() {
      renderHand("bj-dealer-cards", dealer, false);
      updateValues(false);
      endRound(`버스트! -${BET} 칩`, 0);
    }

    function deal() {
      if (chips < BET) {
        message = "칩이 부족합니다. ↺ 로 리셋";
        updateStat();
        return;
      }
      chips -= BET;
      if (deck.length < 15) newShoe();

      player = [drawCard(), drawCard()];
      dealer = [drawCard(), drawCard()];
      phase = "play";
      message = "";

      renderHand("bj-player-cards", player, false);
      renderHand("bj-dealer-cards", dealer, true);
      updateValues(true);
      paintActions();
      updateStat();

      if (isBlackjack(player)) {
        renderHand("bj-dealer-cards", dealer, false);
        updateValues(false);
        if (isBlackjack(dealer)) {
          endRound("둘 다 블랙잭! 푸시", BET);
        } else {
          const win = BET + Math.floor(BET * 1.5);
          endRound(`블랙잭! +${win} 칩`, win);
        }
      }
    }

    function hit() {
      if (phase !== "play") return;
      player.push(drawCard());
      renderHand("bj-player-cards", player, false);
      updateValues(true);
      if (C.handValue(player) > 21) playerBust();
      else updateStat();
    }

    function stand() {
      if (phase !== "play") return;
      dealerPlay();
    }

    function paintActions() {
      actionsEl.innerHTML = "";
      if (phase === "bet") {
        const dealBtn = document.createElement("button");
        dealBtn.type = "button";
        dealBtn.className = "action-btn";
        dealBtn.textContent = chips < BET ? "칩 부족" : `딜 (${BET} 칩)`;
        dealBtn.disabled = chips < BET;
        dealBtn.addEventListener("click", deal);
        actionsEl.appendChild(dealBtn);
      } else if (phase === "play") {
        ["히트", "스탠드"].forEach((label, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "action-btn";
          btn.textContent = label;
          btn.addEventListener("click", i === 0 ? hit : stand);
          actionsEl.appendChild(btn);
        });
      }
    }

    function reset() {
      chips = 1000;
      player = [];
      dealer = [];
      phase = "bet";
      message = "";
      newShoe();
      renderHand("bj-player-cards", player, false);
      renderHand("bj-dealer-cards", dealer, false);
      updateValues(false);
      paintActions();
      updateStat();
    }

    document.getElementById("bj-reset").addEventListener("click", reset);
    reset();
    setupLeaderboard(ctx, container);
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderBlackjack = renderBlackjack;
})();
