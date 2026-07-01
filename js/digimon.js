(function () {
  const STARTING_BALANCE = 100;
  const GAME_COST = 1;
  const STOCK_PICKS_COST = 1;
  const CHART_BEYOND_TOP30_COST = 1;
  const ZERO_REFILL_AMOUNT = 3;
  const REWARD_TOP10 = 5;
  const REWARD_TOP3 = 10;
  const DM_ADMIN_EMAIL = "maspro79@naver.com";
  const DM_ADMIN_GRANT_AMOUNT = 100;

  function balanceEl() {
    return document.getElementById("digimon-balance");
  }

  function format(amount) {
    return Number(amount || 0).toLocaleString();
  }

  function formatHistoryTimestamp(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    const parts = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date);
    const pick = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}:${pick("second")}`;
  }

  function formatHistoryEntry(entry) {
    const action = entry.entry_type === "grant" ? "충전" : "사용";
    const cssClass = entry.entry_type === "grant" ? "grant" : "spend";
    const time = formatHistoryTimestamp(entry.created_at);
    const reason = entry.reason || (entry.entry_type === "grant" ? "충전" : "사용");
    return `
      <li class="digimon-history-item ${cssClass}">
        <span class="history-time">${time}</span>
        <span class="history-action">${action} ${format(entry.amount)}개</span>, 사유: ${reason}
      </li>
    `;
  }

  async function getHistory(limit = 50) {
    const supabase = getClient();
    const session = window.Auth?.getSession();
    if (!session || !supabase) {
      return { data: [], error: "로그인이 필요합니다." };
    }

    const { data, error } = await supabase
      .from("digimon_history")
      .select("created_at, amount, entry_type, reason")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (/relation.*does not exist|schema cache/i.test(error.message)) {
        return {
          data: [],
          error: "히스토리 테이블이 없습니다. Supabase SQL Editor에서 supabase/digimon_history.sql 을 실행해 주세요."
        };
      }
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
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
    const balance = balanceEl();
    const session = window.Auth?.getSession();

    if (!balance) {
      return;
    }

    if (!session) {
      balance.hidden = true;
      return;
    }

    balance.hidden = false;
    window.DmIcon?.setBalance(balance, format(await getBalance()));
    window.Games?.refreshGameAccess?.();
  }

  function hide() {
    const balance = balanceEl();
    if (balance) {
      balance.hidden = true;
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

    const { data, error } = await supabase.rpc("spend_digimon", {
      amount: cost,
      p_reason: opts.reason || opts.successNotice || "사용"
    });
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

  async function grant(amount, noticeMessage, reason) {
    const supabase = getClient();
    const session = window.Auth?.getSession();
    const dbReason = reason || noticeMessage || "충전";

    if (!session || !supabase || !amount || amount < 1) {
      return { ok: false, balance: await getBalance(), error: null };
    }

    const { data, error } = await supabase.rpc("grant_digimon", {
      amount,
      p_reason: dbReason
    });
    if (error) {
      let message = error.message;
      if (/could not find the function|schema cache/i.test(message)) {
        message =
          "Supabase에 게임용 Digi-Mon 함수가 없습니다. SQL Editor에서 supabase/digimon_setup_all.sql 을 실행해 주세요.";
      }
      return { ok: false, balance: await getBalance(), error: message };
    }

    await refresh();
    if (noticeMessage || reason) {
      showNotice(noticeMessage || reason, "success");
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

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getAccountEmail(session, profile) {
    return normalizeEmail(
      profile?.email ||
        session?.user?.email ||
        session?.user?.user_metadata?.email ||
        ""
    );
  }

  function isDmAdminEmail(email) {
    return normalizeEmail(email) === normalizeEmail(DM_ADMIN_EMAIL);
  }

  function canAdminGrantDm(session, profile) {
    return isDmAdminEmail(getAccountEmail(session, profile));
  }

  async function adminGrantDm() {
    const session = window.Auth?.getSession();
    const profileResult = await window.Auth?.getProfile?.();
    const profile = profileResult?.data || null;
    if (!canAdminGrantDm(session, profile)) {
      return { ok: false, balance: await getBalance(), error: "권한이 없습니다." };
    }

    return grant(
      DM_ADMIN_GRANT_AMOUNT,
      `+${DM_ADMIN_GRANT_AMOUNT} DM 추가`,
      "관리자 DM 추가"
    );
  }

  async function spendForStockPicks() {
    return spend(STOCK_PICKS_COST, {
      reason: "Stock Picks 입장",
      insufficientMessage:
        "Digi-Mon이 없어 Stock Picks를 볼 수 없습니다. 0개일 때는 다음날(한국 시간) 3개가 충전됩니다. 게임 TOP 10 보상으로도 획득할 수 있습니다.",
      loginMessage: "Stock Picks를 보려면 로그인이 필요합니다.",
      successNotice: `Stock Picks 열람 — Digi-Mon ${STOCK_PICKS_COST}개 사용`
    });
  }

  async function spendForStockPicksRefresh() {
    return spend(STOCK_PICKS_COST, {
      reason: "Stock Picks 새로고침",
      insufficientMessage:
        "Digi-Mon이 없어 새로고침할 수 없습니다. 0개일 때는 다음날(한국 시간) 3개가 충전됩니다.",
      loginMessage: "새로고침하려면 로그인이 필요합니다.",
      successNotice: `Stock Picks 새로고침 — Digi-Mon ${STOCK_PICKS_COST}개 사용`
    });
  }

  async function spendForStockNewsRefresh() {
    return spend(STOCK_PICKS_COST, {
      reason: "Stock News 새로고침",
      insufficientMessage:
        "Digi-Mon이 없어 새로고침할 수 없습니다. 0개일 때는 다음날(한국 시간) 3개가 충전됩니다.",
      loginMessage: "새로고침하려면 로그인이 필요합니다.",
      successNotice: `Stock News 새로고침 — Digi-Mon ${STOCK_PICKS_COST}개 사용`
    });
  }

  const CHART_DM_HINT =
    "0개일 때는 다음날(한국 시간) 3개가 충전됩니다. 게임 TOP 10 보상으로도 획득할 수 있습니다.";

  async function spendForChartApiMore() {
    return spend(CHART_BEYOND_TOP30_COST, {
      reason: "Chart 31위 이후 목록",
      insufficientMessage: `Digi-Mon이 없어 추가 목록을 불러올 수 없습니다. ${CHART_DM_HINT}`,
      loginMessage: "31위 이후 목록을 보려면 로그인이 필요합니다.",
      successNotice: `Chart 목록 추가 — Digi-Mon ${CHART_BEYOND_TOP30_COST}개 사용`
    });
  }

  async function spendForChartDetail() {
    return spend(CHART_BEYOND_TOP30_COST, {
      reason: "Chart 31위 이후 차트",
      insufficientMessage: `Digi-Mon이 없어 차트를 볼 수 없습니다. ${CHART_DM_HINT}`,
      loginMessage: "31위 이후 차트를 보려면 로그인이 필요합니다.",
      successNotice: `Chart 열람 — Digi-Mon ${CHART_BEYOND_TOP30_COST}개 사용`
    });
  }

  async function spendForStockStrategy(strategyKey, strategyLabel) {
    const label = strategyLabel || strategyKey || "Stock 전략";
    return spend(STOCK_PICKS_COST, {
      reason: `Stock 전략 ${label} 입장`,
      insufficientMessage: `Digi-Mon이 없어 ${label}을 볼 수 없습니다. ${CHART_DM_HINT}`,
      loginMessage: `${label}을 보려면 로그인이 필요합니다.`,
      successNotice: `${label} 열람 — Digi-Mon ${STOCK_PICKS_COST}개 사용`
    });
  }

  async function spendForStockStrategyRefresh(strategyKey, strategyLabel) {
    const label = strategyLabel || strategyKey || "Stock 전략";
    return spend(STOCK_PICKS_COST, {
      reason: `Stock 전략 ${label} 새로고침`,
      insufficientMessage: `Digi-Mon이 없어 새로고침할 수 없습니다. ${CHART_DM_HINT}`,
      loginMessage: "새로고침하려면 로그인이 필요합니다.",
      successNotice: `${label} 새로고침 — Digi-Mon ${STOCK_PICKS_COST}개 사용`
    });
  }

  window.Digimon = {
    STARTING_BALANCE,
    GAME_COST,
    STOCK_PICKS_COST,
    CHART_BEYOND_TOP30_COST,
    ZERO_REFILL_AMOUNT,
    REWARD_TOP10,
    REWARD_TOP3,
    format,
    formatHistoryEntry,
    getHistory,
    getBalance,
    refresh,
    hide,
    spend,
    grant,
    canPlay,
    canViewStockPicks,
    spendForStockPicks,
    spendForStockPicksRefresh,
    spendForStockNewsRefresh,
    spendForChartApiMore,
    spendForChartDetail,
    spendForStockStrategy,
    spendForStockStrategyRefresh,
    rewardForRank,
    isDmAdminEmail,
    canAdminGrantDm,
    adminGrantDm,
    DM_ADMIN_GRANT_AMOUNT,
    showNotice
  };
})();
