(function () {
  const REWARD_AMOUNT = 100;

  function renderReward(container, ctx) {
    let granting = false;

    container.innerHTML = `
      <div class="mini-game reward-game">
        <h3 class="mini-game-title">보상 게임</h3>
        <p class="reward-game-desc">
          아래 <strong>보상 받기</strong> 버튼을 누를 때마다 Digi-Mon <strong>${REWARD_AMOUNT}개</strong>가 충전됩니다.
        </p>
        <p class="reward-game-balance" id="reward-game-balance" aria-live="polite"></p>
        <button type="button" class="reward-game-btn" id="reward-game-btn">
          보상 받기 (+${REWARD_AMOUNT} DM)
        </button>
        <p class="minesweeper-status" id="reward-game-status"></p>
      </div>
    `;

    const balanceEl = document.getElementById("reward-game-balance");
    const btn = document.getElementById("reward-game-btn");
    const statusEl = document.getElementById("reward-game-status");

    async function paintBalance() {
      if (!balanceEl) return;
      if (ctx.isGuest) {
        balanceEl.textContent = "로그인 후 보상을 받을 수 있습니다.";
        return;
      }
      const balance = await window.Digimon?.getBalance?.();
      balanceEl.innerHTML = `현재 보유: <strong>${window.Digimon?.format?.(balance) ?? balance}</strong> DM`;
    }

    async function handleGrant() {
      if (granting) return;

      if (ctx.isGuest) {
        statusEl.textContent = "보상을 받으려면 로그인해 주세요.";
        window.Digimon?.showNotice?.("보상을 받으려면 로그인이 필요합니다.", "info");
        return;
      }

      granting = true;
      btn.disabled = true;
      statusEl.textContent = "충전 중…";

      const result = await window.Digimon?.grant?.(
        REWARD_AMOUNT,
        `보상 게임 — Digi-Mon ${REWARD_AMOUNT}개 충전`,
        "보상 게임"
      );

      granting = false;
      btn.disabled = false;

      if (!result?.ok) {
        statusEl.textContent = result?.error || "충전에 실패했습니다.";
        if (result?.error) {
          window.Digimon?.showNotice?.(result.error, "info");
        }
        await paintBalance();
        await window.Games?.refreshGameAccess?.();
        return;
      }

      statusEl.textContent = `+${REWARD_AMOUNT} DM 충전 완료!`;
      ctx?.sfx?.("win");
      await paintBalance();
      await window.Games?.refreshGameAccess?.();
    }

    btn?.addEventListener("click", () => {
      void handleGrant();
    });

    void paintBalance();
  }

  window.GamesExtra = window.GamesExtra || {};
  window.GamesExtra.renderReward = renderReward;
})();
