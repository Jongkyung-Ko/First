(function () {
  const STARTING_BALANCE = 100;
  const GAME_COST = 1;
  const STOCK_PICKS_COST = 1;
  const ZERO_REFILL_AMOUNT = 3;
  const REWARD_TOP10 = 5;
  const REWARD_TOP3 = 10;

  function badgeEl() {
    return document.getElementById("digimon-badge");
  }

  function balanceEl() {
    return document.getElementById("digimon-balance");
  }

  function format(amount) {
    return Number(amount || 0).toLocaleString();
  }

  function getClient() {
    return window.Auth?.getClient?.();
  }

  async function tryZeroRefill() {
    const supabase = getClient();
    const session = window.Auth?.getSession();
    if (!session || !supabase) {
      return null;
    }

    const { data, error } = await supabase.rpc("ensure_digimon_zero_refill");
    if (error) {
      return null;
    }

    return data;
  }

  async function getBalance() {
    if (!window.Auth?.getSession()) {
      return 0;
    }

    await tryZeroRefill();

    const { data, error } = await window.Auth.getProfile();
    if (error || !data) {
      return STARTING_BALANCE;
    }

    return data.digimon ?? STARTING_BALANCE;
  }

  async function refresh() {
    const badge = badgeEl();
    const balance = balanceEl();
    const session = window.Auth?.getSession();

    if (!badge || !balance) {
      return;
    }

    if (!session) {
      badge.hidden = true;
      return;
    }

    badge.hidden = false;
    balance.textContent = format(await getBalance());
    window.Games?.refreshGameAccess?.();
  }

  function hide() {
    const badge = badgeEl();
    if (badge) {
      badge.hidden = true;
    }
    window.Games?.refreshGameAccess?.();
  }

  function rewardForRank(rank) {
    if (!rank || rank < 1) return 0;
    if (rank <= 3) return REWARD_TOP3;
    if (rank <= 10) return REWARD_TOP10;
    return 0;
  }

  function showNotice(message, type) {
    if (!message) return;

    let el = document.getElementById("digimon-notice");
    if (!el) {
      el = document.createElement("div");
      el.id = "digimon-notice";
      el.className = "digimon-notice";
      document.body.appendChild(el);
    }

    el.textContent = message;
    el.className = `digimon-notice ${type || "info"}`;
    el.hidden = false;

    clearTimeout(showNotice._timer);
    showNotice._timer = setTimeout(() => {
      el.hidden = true;
    }, 4200);
  }

  function normalizeSpendOptions(amount, options) {
    if (typeof amount === "object" && amount !== null) {
      return { cost: GAME_COST, opts: amount };
    }
    return { cost: amount ?? GAME_COST, opts: options || {} };
  }

  async function spend(amount, options) {
    const { cost, opts } = normalizeSpendOptions(amount, options);
    const supabase = getClient();
    const session = window.Auth?.getSession();
    const insufficientMessage =
      opts.insufficientMessage ||
      "Digi-Mon이 부족합니다. TOP 10 랭킹에 들어 보상을 받거나, 0개일 때는 다음날 3개가 충전됩니다.";

    if (!session) {
      return { ok: false, balance: 0, error: opts.loginMessage || "로그인이 필요합니다." };
    }

    if (!supabase) {
      return { ok: false, balance: 0, error: "Supabase is not configured." };
    }

    const current = await getBalance();
    if (current < cost) {
      return { ok: false, balance: current, error: insufficientMessage };
    }

    const { data, error } = await supabase.rpc("spend_digimon", { amount: cost });
    if (error) {
      let message = error.message;
      if (/could not find the function|schema cache/i.test(message)) {
        message =
          "Supabase에 Digi-Mon 함수가 없습니다. SQL Editor에서 supabase/digimon_setup_all.sql 을 실행해 주세요.";
      } else if (/insufficient/i.test(message)) {
        message = insufficientMessage;
      }
      return { ok: false, balance: current, error: message };
    }

    await refresh();
    if (opts.successNotice) {
      showNotice(opts.successNotice, "info");
    }
    return { ok: true, balance: data, error: null };
  }

  async function grant(amount, reason) {
    const supabase = getClient();
    const session = window.Auth?.getSession();

    if (!session || !supabase || !amount || amount < 1) {
      return { ok: false, balance: await getBalance(), error: null };
    }

    const { data, error } = await supabase.rpc("grant_digimon", { amount });
    if (error) {
      let message = error.message;
      if (/could not find the function|schema cache/i.test(message)) {
        message =
          "Supabase에 게임용 Digi-Mon 함수가 없습니다. SQL Editor에서 supabase/digimon_setup_all.sql 을 실행해 주세요.";
      }
      return { ok: false, balance: await getBalance(), error: message };
    }

    await refresh();
    if (reason) {
      showNotice(reason, "success");
    }
    return { ok: true, balance: data, error: null };
  }

  async function canPlay() {
    if (!window.Auth?.getSession()) {
      return false;
    }
    return (await getBalance()) >= GAME_COST;
  }

  async function canViewStockPicks() {
    if (!window.Auth?.getSession()) {
      return false;
    }
    return (await getBalance()) >= STOCK_PICKS_COST;
  }

  async function spendForStockPicks() {
    return spend(STOCK_PICKS_COST, {
      insufficientMessage:
        "Digi-Mon이 없어 Stock Picks를 볼 수 없습니다. 0개일 때는 다음날(한국 시간) 3개가 충전됩니다. 게임 TOP 10 보상으로도 획득할 수 있습니다.",
      loginMessage: "Stock Picks를 보려면 로그인이 필요합니다.",
      successNotice: `Stock Picks 열람 — Digi-Mon ${STOCK_PICKS_COST}개 사용`
    });
  }

  window.Digimon = {
    STARTING_BALANCE,
    GAME_COST,
    STOCK_PICKS_COST,
    ZERO_REFILL_AMOUNT,
    REWARD_TOP10,
    REWARD_TOP3,
    format,
    getBalance,
    refresh,
    hide,
    spend,
    grant,
    canPlay,
    canViewStockPicks,
    spendForStockPicks,
    rewardForRank,
    showNotice
  };
})();
