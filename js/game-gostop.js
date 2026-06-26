(function () {
  const H = window.HwatuCommon;
  const WIN = H.WIN_THRESHOLD;

  function toolbarHtml(statId, resetId) {
    return `
      <div class="game-toolbar">
        <div class="game-toolbar-stat" id="${statId}"></div>
        <button type="button" class="minesweeper-reset" id="${resetId}" title="새 게임">↺</button>
      </div>`;
  }

  function countByMonth(cards) {
    const map = new Map();
    cards.forEach((c) => map.set(c.month, (map.get(c.month) || 0) + 1));
    return map;
  }

  function hasFourOnField(field) {
    return [...countByMonth(field).values()].some((n) => n >= 4);
  }

  function dealHands() {
    let tries = 0;
    while (tries < 40) {
      const deck = H.shuffle(H.buildDeck());
      const field = deck.splice(0, 8);
      if (!hasFourOnField(field)) {
        return {
          field,
          playerHand: deck.splice(0, 10),
          cpuHand: deck.splice(0, 10),
          stock: deck
        };
      }
      tries++;
    }
    const deck = H.shuffle(H.buildDeck());
    return {
      field: deck.splice(0, 8),
      playerHand: deck.splice(0, 10),
      cpuHand: deck.splice(0, 10),
      stock: deck
    };
  }

  function matchesOnField(month, field) {
    return field.filter((c) => c.month === month);
  }

  function resolveCard(card, field, captured, matchId) {
    const hits = matchesOnField(card.month, field);
    const rest = field.filter((c) => c.month !== card.month);

    if (hits.length === 0) {
      return { field: [...field, card], captured, taken: [card], message: `${card.month}월 — 바닥에 놓음` };
    }
    if (hits.length === 1) {
      const hit = hits[0];
      return {
        field: rest,
        captured: [...captured, card, hit],
        taken: [card, hit],
        message: `${card.month}월 — 뻑! 2장 획득`
      };
    }
    if (hits.length === 2) {
      if (!matchId) return { needChoice: true, hits, card };
      const hit = hits.find((c) => c.id === matchId) || hits[0];
      const other = hits.find((c) => c.id !== hit.id);
      return {
        field: other ? [...rest, other] : rest,
        captured: [...captured, card, hit],
        taken: [card, hit],
        message: `${card.month}월 — 2장 중 1장 매칭`
      };
    }
    return {
      field: rest,
      captured: [...captured, card, ...hits],
      taken: [card, ...hits],
      message: `${card.month}월 — 따닥! ${hits.length + 1}장 획득`,
      ttadak: true
    };
  }

  function renderGostop(container, ctx) {
    let state = null;
    let scoreRecorded = false;
    let cpuTimer = null;

    container.innerHTML = `
      <div class="mini-game gostop-game">
        ${toolbarHtml("gs-stat", "gs-reset")}
        <div class="gostop-scores">
          <div class="gostop-score-box" id="gs-player-score">나: 0점</div>
          <div class="gostop-score-box cpu" id="gs-cpu-score">CPU: 0점</div>
          <div class="gostop-go-badge" id="gs-go-badge" hidden></div>
        </div>
        <div class="gostop-field-wrap">
          <div class="gostop-label">바닥 <span id="gs-stock-label"></span></div>
          <div class="gostop-field" id="gs-field"></div>
        </div>
        <div class="gostop-hand-wrap">
          <div class="gostop-label">내 패</div>
          <div class="gostop-hand" id="gs-hand"></div>
        </div>
        <div class="gostop-captured">
          <div class="gostop-cap-col">
            <div class="gostop-label">내 획득</div>
            <div class="gostop-cap-list" id="gs-player-cap"></div>
            <ul class="gostop-breakdown" id="gs-player-bd"></ul>
          </div>
          <div class="gostop-cap-col">
            <div class="gostop-label">CPU 획득</div>
            <div class="gostop-cap-list" id="gs-cpu-cap"></div>
            <ul class="gostop-breakdown" id="gs-cpu-bd"></ul>
          </div>
        </div>
        <div class="gostop-actions" id="gs-actions"></div>
        <p class="minesweeper-hint">7점 이상이면 고/스톱 · 3번 고 후 승리 시 쓰리고(×3 보너스) · 1인 vs CPU · 카드: <a href="https://commons.wikimedia.org/wiki/File:Hwatu_overview.svg" target="_blank" rel="noopener">CC BY-SA 4.0</a></p>
        <p class="minesweeper-status" id="gs-status"></p>
        <div class="gostop-overlay" id="gs-overlay" hidden>
          <div class="gostop-overlay-panel">
            <p class="gostop-overlay-msg" id="gs-overlay-msg"></p>
            <p class="gostop-overlay-sub" id="gs-overlay-sub"></p>
            <button type="button" class="action-btn" id="gs-overlay-btn">확인</button>
          </div>
        </div>
      </div>`;

    const statEl = document.getElementById("gs-stat");
    const statusEl = document.getElementById("gs-status");
    const fieldEl = document.getElementById("gs-field");
    const handEl = document.getElementById("gs-hand");
    const actionsEl = document.getElementById("gs-actions");
    const stockLabel = document.getElementById("gs-stock-label");
    const playerScoreEl = document.getElementById("gs-player-score");
    const cpuScoreEl = document.getElementById("gs-cpu-score");
    const goBadge = document.getElementById("gs-go-badge");
    const playerCapEl = document.getElementById("gs-player-cap");
    const cpuCapEl = document.getElementById("gs-cpu-cap");
    const playerBdEl = document.getElementById("gs-player-bd");
    const cpuBdEl = document.getElementById("gs-cpu-bd");
    const overlayEl = document.getElementById("gs-overlay");
    const overlayMsg = document.getElementById("gs-overlay-msg");
    const overlaySub = document.getElementById("gs-overlay-sub");
    const overlayBtn = document.getElementById("gs-overlay-btn");

    function playerPts() {
      return H.scoreCaptured(state.playerCaptured).total;
    }

    function cpuPts() {
      return H.scoreCaptured(state.cpuCaptured).total;
    }

    function setStatus(msg) {
      state.lastMsg = msg;
      statusEl.textContent = msg || "";
    }

    function clearCpuTimer() {
      if (cpuTimer) {
        clearTimeout(cpuTimer);
        cpuTimer = null;
      }
    }

    function hideOverlay() {
      overlayEl.hidden = true;
    }

    function showEndOverlay(title, sub, onOk) {
      overlayMsg.textContent = title;
      overlaySub.textContent = sub || "";
      overlayBtn.onclick = () => {
        hideOverlay();
        onOk?.();
      };
      overlayEl.hidden = false;
    }

    const CAP_KIND_GROUPS = [
      { kind: "gwang", label: "광" },
      { kind: "pi", label: "피" },
      { kind: "tti", label: "띠" },
      { kind: "yeol", label: "열끗" }
    ];

    function paintBreakdown(el, captured) {
      const { total, breakdown } = H.scoreCaptured(captured);
      el.innerHTML = breakdown.map((b) => `<li>${b}</li>`).join("") || `<li>조합 없음 (${total}점)</li>`;
    }

    function paintCaptured(el, captured) {
      el.innerHTML = "";
      CAP_KIND_GROUPS.forEach(({ kind, label }) => {
        const cards = captured.filter((c) => c.kind === kind).sort((a, b) => a.month - b.month);
        const group = document.createElement("div");
        group.className = "gostop-cap-group";

        const groupLabel = document.createElement("span");
        groupLabel.className = "gostop-cap-group-label";
        groupLabel.textContent = `${label} ${cards.length}`;

        const row = document.createElement("div");
        row.className = "gostop-cap-group-cards";
        cards.forEach((card) => {
          row.appendChild(H.cardEl(card, { readonly: true, small: true }));
        });

        group.appendChild(groupLabel);
        group.appendChild(row);
        el.appendChild(group);
      });
    }

    function updateScores() {
      const pp = playerPts();
      const cp = cpuPts();
      playerScoreEl.textContent = `나: ${pp}점`;
      cpuScoreEl.textContent = `CPU: ${cp}점`;
      if (state.playerGo > 0) {
        goBadge.hidden = false;
        goBadge.textContent = `${state.playerGo}고${state.playerGo >= 3 ? " · 쓰리고!" : ""} (×${Math.pow(2, state.playerGo)})`;
      } else {
        goBadge.hidden = true;
      }
      paintCaptured(playerCapEl, state.playerCaptured);
      paintCaptured(cpuCapEl, state.cpuCaptured);
      paintBreakdown(playerBdEl, state.playerCaptured);
      paintBreakdown(cpuBdEl, state.cpuCaptured);
      stockLabel.textContent = `· 남은 패 ${state.stock.length}장`;
      statEl.textContent = state.turn === "player" ? "내 차례" : "CPU 차례";
    }

    function paintField(highlightIds) {
      fieldEl.innerHTML = "";
      state.field.forEach((card) => {
        const el = H.cardEl(card, { selected: highlightIds?.has(card.id) });
        if (state.phase === "choosePlay" || state.phase === "chooseDraw") {
          if (highlightIds?.has(card.id)) {
            el.addEventListener("click", () => onPickMatch(card.id));
          } else {
            el.classList.add("dim");
            el.disabled = true;
          }
        }
        fieldEl.appendChild(el);
      });
    }

    function paintHand() {
      handEl.innerHTML = "";
      const canPlay = state.turn === "player" && state.phase === "select" && !state.over;
      state.playerHand.forEach((card) => {
        const el = H.cardEl(card, { selected: state.selectedId === card.id });
        if (canPlay) {
          el.addEventListener("click", () => {
            state.selectedId = card.id;
            paintHand();
            paintActions();
          });
        } else {
          el.disabled = true;
        }
        handEl.appendChild(el);
      });
    }

    function paintActions() {
      actionsEl.innerHTML = "";
      if (state.over) return;

      if (state.phase === "goStop" && state.turn === "player") {
        const stopBtn = document.createElement("button");
        stopBtn.type = "button";
        stopBtn.className = "action-btn";
        stopBtn.textContent = "스톱";
        stopBtn.addEventListener("click", () => playerStop());
        actionsEl.appendChild(stopBtn);

        const goBtn = document.createElement("button");
        goBtn.type = "button";
        goBtn.className = "secondary-btn";
        goBtn.textContent = state.playerGo >= 2 ? "고 (쓰리고 도전)" : "고";
        goBtn.addEventListener("click", () => playerGo());
        actionsEl.appendChild(goBtn);
        return;
      }

      if (state.phase === "select" && state.turn === "player") {
        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "action-btn";
        playBtn.textContent = "카드 내기";
        playBtn.disabled = !state.selectedId;
        playBtn.addEventListener("click", () => playerPlayCard());
        actionsEl.appendChild(playBtn);
      }
    }

    function paintAll() {
      updateScores();
      paintField(state.matchChoices ? new Set(state.matchChoices.map((c) => c.id)) : null);
      paintHand();
      paintActions();
    }

    function checkPlayerGoStop() {
      if (state.over || state.turn !== "player") return;
      if (playerPts() >= WIN) {
        state.phase = "goStop";
        setStatus(`${playerPts()}점 달성! 고를 부르거나 스톱하세요.`);
        paintAll();
      }
    }

    function checkCpuGoStop() {
      if (state.over) return;
      const cp = cpuPts();
      const pp = playerPts();
      if (cp >= WIN) {
        if (state.playerGo > 0 && cp >= pp) {
          endGame("cpu", `CPU가 ${cp}점으로 승리! ${state.playerGo}고 패배 (광박)`);
          return true;
        }
        if (cp >= pp) {
          endGame("cpu", `CPU가 ${cp}점으로 스톱!`);
          return true;
        }
        if (Math.random() < 0.25 && state.cpuGo < 2) {
          state.cpuGo++;
          setStatus(`CPU가 ${state.cpuGo}고를 불렀습니다!`);
        } else {
          endGame("cpu", `CPU가 ${cp}점으로 스톱!`);
          return true;
        }
      }
      return false;
    }

    function afterPlayerTurn() {
      if (state.over) return;
      if (state.stock.length === 0) {
        resolveByStock();
        return;
      }
      checkPlayerGoStop();
      if (state.phase === "goStop") return;
      startCpuTurn();
    }

    function startCpuTurn() {
      if (state.over) return;
      state.turn = "cpu";
      state.phase = "cpu";
      setStatus("CPU가 생각 중...");
      paintAll();
      cpuTimer = setTimeout(cpuPlayTurn, 700);
    }

    function cpuChooseCard() {
      const hand = state.cpuHand;
      for (const card of hand) {
        const hits = matchesOnField(card.month, state.field);
        if (hits.length === 1 || hits.length === 3) return card;
      }
      for (const card of hand) {
        if (matchesOnField(card.month, state.field).length === 2) return card;
      }
      return hand[Math.floor(Math.random() * hand.length)];
    }

    function cpuPlayTurn() {
      if (state.over || state.cpuHand.length === 0) {
        resolveByStock();
        return;
      }

      const card = cpuChooseCard();
      state.cpuHand = state.cpuHand.filter((c) => c.id !== card.id);
      const hits = matchesOnField(card.month, state.field);
      let matchId = null;
      if (hits.length === 2) matchId = hits[Math.floor(Math.random() * 2)].id;

      let res = resolveCard(card, state.field, state.cpuCaptured, matchId);
      state.field = res.field;
      state.cpuCaptured = res.captured;
      setStatus(`CPU: ${res.message}`);

      if (state.stock.length === 0) {
        paintAll();
        resolveByStock();
        return;
      }

      const drawn = state.stock.pop();
      const drawHits = matchesOnField(drawn.month, state.field);
      matchId = null;
      if (drawHits.length === 2) matchId = drawHits[Math.floor(Math.random() * 2)].id;
      res = resolveCard(drawn, state.field, state.cpuCaptured, matchId);
      state.field = res.field;
      state.cpuCaptured = res.captured;
      setStatus(`CPU 뒤집기: ${drawn.month}월 — ${res.message}`);

      paintAll();

      if (checkCpuGoStop()) return;

      if (state.stock.length === 0) {
        resolveByStock();
        return;
      }

      state.turn = "player";
      state.phase = "select";
      state.selectedId = null;
      setStatus("내 차례 — 패에서 카드를 고르세요.");
      paintAll();
    }

    function onPickMatch(matchId) {
      if (!state.pendingCard) return;
      const card = state.pendingCard;
      const capKey = state.pendingOwner === "player" ? "playerCaptured" : "cpuCaptured";
      const res = resolveCard(card, state.field, state[capKey], matchId);
      state.field = res.field;
      state[capKey] = res.captured;
      setStatus(res.message);

      state.pendingCard = null;
      state.matchChoices = null;

      if (state.pendingSource === "play") {
        playerDrawPhase();
      } else {
        finishPlayerTurn();
      }
    }

    function playerPlayCard() {
      if (state.phase !== "select" || !state.selectedId) return;
      const idx = state.playerHand.findIndex((c) => c.id === state.selectedId);
      if (idx < 0) return;
      const card = state.playerHand.splice(idx, 1)[0];
      state.selectedId = null;

      const hits = matchesOnField(card.month, state.field);
      if (hits.length === 2) {
        state.pendingCard = card;
        state.pendingSource = "play";
        state.pendingOwner = "player";
        state.matchChoices = hits;
        state.phase = "choosePlay";
        setStatus(`${card.month}월 — 바닥 2장 중 하나를 선택하세요.`);
        paintAll();
        return;
      }

      const res = resolveCard(card, state.field, state.playerCaptured, null);
      state.field = res.field;
      state.playerCaptured = res.captured;
      setStatus(res.message);
      playerDrawPhase();
    }

    function playerDrawPhase() {
      if (state.stock.length === 0) {
        paintAll();
        afterPlayerTurn();
        return;
      }
      const drawn = state.stock.pop();
      const hits = matchesOnField(drawn.month, state.field);
      if (hits.length === 2) {
        state.pendingCard = drawn;
        state.pendingSource = "draw";
        state.pendingOwner = "player";
        state.matchChoices = hits;
        state.phase = "chooseDraw";
        setStatus(`뒤집은 ${drawn.month}월 — 바닥 2장 중 하나를 선택하세요.`);
        paintAll();
        return;
      }
      const res = resolveCard(drawn, state.field, state.playerCaptured, null);
      state.field = res.field;
      state.playerCaptured = res.captured;
      setStatus(`뒤집기: ${res.message}`);
      finishPlayerTurn();
    }

    function finishPlayerTurn() {
      state.phase = "select";
      paintAll();
      afterPlayerTurn();
    }

    function playerGo() {
      state.playerGo++;
      state.phase = "select";
      const mult = Math.pow(2, state.playerGo);
      setStatus(
        state.playerGo >= 3
          ? `쓰리고! ${state.playerGo}고 (×${mult}) — 계속 플레이`
          : `${state.playerGo}고! (×${mult}) — 계속 플레이`
      );
      paintAll();
      startCpuTurn();
    }

    function playerStop() {
      const base = playerPts();
      const isThreeGo = state.playerGo >= 3;
      const payout = H.finalPayout(base, state.playerGo, isThreeGo);
      const label = isThreeGo ? `쓰리고 승리!` : "스톱 승리!";
      endGame("player", `${label} ${base}점 → 최종 ${payout}점`, payout);
    }

    function resolveByStock() {
      const pp = playerPts();
      const cp = cpuPts();
      if (state.playerGo > 0 && cp > pp) {
        endGame("cpu", `패 소진 — CPU ${cp}점 승리 (${state.playerGo}고 실패)`);
        return;
      }
      if (pp > cp) {
        const payout = H.finalPayout(pp, state.playerGo, state.playerGo >= 3);
        endGame("player", `패 소진 — 나 ${pp}점 승리! 최종 ${payout}점`, payout);
      } else if (cp > pp) {
        endGame("cpu", `패 소진 — CPU ${cp}점 승리`);
      } else {
        endGame("draw", `패 소진 — 무승부 (${pp}점)`);
      }
    }

    function endGame(winner, message, payout) {
      clearCpuTimer();
      state.over = true;
      state.winner = winner;
      state.phase = "over";

      let finalScore = 0;
      let sub = "";
      if (winner === "player") {
        finalScore = payout ?? H.finalPayout(playerPts(), state.playerGo, state.playerGo >= 3);
        sub = `최종 점수: ${finalScore}점`;
        if (state.playerGo >= 3) sub += "\n쓰리고 보너스 적용!";
      } else if (winner === "cpu" && state.playerGo > 0) {
        sub = `${state.playerGo}고 실패 — 기록 없음`;
      } else if (winner === "draw") {
        sub = "무승부 — 기록 없음";
      } else {
        sub = "패배 — 기록 없음";
      }

      setStatus(message);
      paintAll();

      showEndOverlay(message, sub, () => {
        if (winner === "player" && finalScore > 0 && !scoreRecorded) {
          scoreRecorded = true;
          ctx?.recordScore?.(finalScore);
        }
      });
    }

    function reset() {
      clearCpuTimer();
      hideOverlay();
      scoreRecorded = false;
      const deal = dealHands();
      state = {
        ...deal,
        playerCaptured: [],
        cpuCaptured: [],
        turn: "player",
        phase: "select",
        selectedId: null,
        playerGo: 0,
        cpuGo: 0,
        over: false,
        pendingCard: null,
        pendingSource: null,
        pendingOwner: null,
        matchChoices: null
      };
      setStatus("내 차례 — 패에서 카드를 고르고 「카드 내기」를 누르세요.");
      paintAll();
    }

    document.getElementById("gs-reset").addEventListener("click", reset);
    ctx.addCleanup(clearCpuTimer);
    reset();
    if (ctx?.mountLeaderboard) ctx.mountLeaderboard(container.querySelector(".gostop-game"));
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderGostop = renderGostop;
})();
