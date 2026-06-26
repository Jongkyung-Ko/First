(function () {
  const C = window.CardCommon;
  const START_CHIPS = 10;

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
    let chips = START_CHIPS;
    let peakChips = START_CHIPS;
    let currentBet = 1;
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
        <div class="blackjack-bet-row" id="bj-bet-row">
          <label class="blackjack-bet-label" for="bj-bet-input">베팅 칩</label>
          <input type="number" class="blackjack-bet-input" id="bj-bet-input" min="1" value="1">
          <button type="button" class="secondary-btn bj-bet-quick" data-amount="1">1</button>
          <button type="button" class="secondary-btn bj-bet-quick" data-amount="half">절반</button>
          <button type="button" class="secondary-btn bj-bet-quick" data-amount="max">올인</button>
        </div>
        <div class="blackjack-actions" id="bj-actions"></div>
        <p class="minesweeper-hint">칩 ${START_CHIPS}개로 시작 · 원하는 만큼 베팅 · 칩을 모두 잃으면 게임 오버</p>
        <p class="minesweeper-status" id="bj-status"></p>
      </div>`;

    const statEl = document.getElementById("bj-stat");
    const statusEl = document.getElementById("bj-status");
    const actionsEl = document.getElementById("bj-actions");
    const betRow = document.getElementById("bj-bet-row");
    const betInput = document.getElementById("bj-bet-input");

    function drawCard() {
      return deck.pop();
    }

    function newShoe() {
      deck = C.shuffle(C.createDeck());
    }

    function recordPeak() {
      if (chips > peakChips) {
        peakChips = chips;
        ctx?.recordScore?.(peakChips);
      }
    }

    function clampBet(raw) {
      const n = Math.floor(Number(raw));
      if (!n || n < 1) return Math.min(1, chips);
      return Math.min(n, chips);
    }

    function readBet() {
      currentBet = clampBet(betInput.value);
      betInput.value = String(currentBet);
      return currentBet;
    }

    function updateStat() {
      const betInfo = phase === "play" ? ` · 베팅: ${currentBet}` : "";
      statEl.textContent = `칩: ${chips}${betInfo}`;
      statusEl.textContent = message;
      betInput.max = String(Math.max(chips, 1));
      if (phase === "bet" && chips > 0) {
        currentBet = clampBet(betInput.value);
        betInput.value = String(currentBet);
      }
    }

    function setBetPhaseUI(enabled) {
      betRow.style.display = enabled ? "flex" : "none";
      betInput.disabled = !enabled;
      betRow.querySelectorAll(".bj-bet-quick").forEach((btn) => {
        btn.disabled = !enabled;
      });
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

    function checkGameOver() {
      if (chips <= 0) {
        chips = 0;
        phase = "gameover";
        message = `게임 오버! 최고 기록: ${peakChips} 칩. ↺ 로 다시 시작`;
        setBetPhaseUI(false);
        paintActions();
        updateStat();
        return true;
      }
      return false;
    }

    function endRound(result, chipDelta) {
      chips += chipDelta;
      recordPeak();
      message = result;
      player = [];
      dealer = [];

      if (checkGameOver()) {
        renderHand("bj-player-cards", player, false);
        renderHand("bj-dealer-cards", dealer, false);
        updateValues(false);
        return;
      }

      phase = "bet";
      setBetPhaseUI(true);
      renderHand("bj-player-cards", player, false);
      renderHand("bj-dealer-cards", dealer, false);
      updateValues(false);
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
      const bet = currentBet;

      if (dv > 21) {
        endRound(`딜러 버스트! +${bet} 칩 획득`, bet * 2);
      } else if (pv > dv) {
        endRound(`승리! +${bet} 칩 획득`, bet * 2);
      } else if (pv < dv) {
        endRound(`패배... ${bet} 칩 잃음`, 0);
      } else {
        endRound("푸시 (무승부) — 베팅 반환", bet);
      }
    }

    function playerBust() {
      renderHand("bj-dealer-cards", dealer, false);
      updateValues(false);
      endRound(`버스트! ${currentBet} 칩 잃음`, 0);
    }

    function deal() {
      if (phase === "gameover") return;

      const bet = readBet();
      if (chips < 1) {
        checkGameOver();
        return;
      }
      if (bet < 1 || bet > chips) {
        message = `1 ~ ${chips} 사이로 베팅하세요.`;
        updateStat();
        return;
      }

      currentBet = bet;
      chips -= bet;
      if (deck.length < 15) newShoe();

      player = [drawCard(), drawCard()];
      dealer = [drawCard(), drawCard()];
      phase = "play";
      message = "";
      setBetPhaseUI(false);

      renderHand("bj-player-cards", player, false);
      renderHand("bj-dealer-cards", dealer, true);
      updateValues(true);
      paintActions();
      updateStat();

      if (isBlackjack(player)) {
        renderHand("bj-dealer-cards", dealer, false);
        updateValues(false);
        if (isBlackjack(dealer)) {
          endRound("둘 다 블랙잭! 푸시", bet);
        } else {
          const win = bet + Math.floor(bet * 1.5);
          endRound(`블랙잭! +${win} 칩 획득`, win);
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
      if (phase === "gameover") {
        return;
      }
      if (phase === "bet") {
        const dealBtn = document.createElement("button");
        dealBtn.type = "button";
        dealBtn.className = "action-btn";
        dealBtn.textContent = chips < 1 ? "칩 없음" : "딜 시작";
        dealBtn.disabled = chips < 1;
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
      chips = START_CHIPS;
      peakChips = START_CHIPS;
      currentBet = 1;
      player = [];
      dealer = [];
      phase = "bet";
      message = "";
      betInput.value = "1";
      newShoe();
      setBetPhaseUI(true);
      renderHand("bj-player-cards", player, false);
      renderHand("bj-dealer-cards", dealer, false);
      updateValues(false);
      paintActions();
      updateStat();
    }

    betInput.addEventListener("change", () => {
      if (phase !== "bet") return;
      readBet();
      updateStat();
    });

    betRow.querySelectorAll(".bj-bet-quick").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (phase !== "bet" || chips < 1) return;
        const mode = btn.dataset.amount;
        if (mode === "max") betInput.value = String(chips);
        else if (mode === "half") betInput.value = String(Math.max(1, Math.floor(chips / 2)));
        else betInput.value = String(Math.min(chips, Number(mode)));
        readBet();
        updateStat();
      });
    });

    document.getElementById("bj-reset").addEventListener("click", reset);
    reset();
    setupLeaderboard(ctx, container);
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderBlackjack = renderBlackjack;
})();
