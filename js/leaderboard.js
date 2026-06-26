(function () {
  const SORT_MAX = 1000000000;

  const CONFIG = {
    minesweeper: { title: "지뢰찾기", higherBetter: false, format: (s) => `${s}초` },
    tictactoe: { title: "틱택토", higherBetter: false, format: (s) => `${s}수` },
    game2048: { title: "2048", higherBetter: true, format: (s) => `${s}점` },
    snake: { title: "스네이크", higherBetter: true, format: (s) => `${s}점` },
    guess: { title: "숫자 맞추기", higherBetter: false, format: (s) => `${s}회` },
    reaction: { title: "반응속도", higherBetter: false, format: (s) => `${s}ms` },
    rps: { title: "가위바위보", higherBetter: true, format: (s) => `${s}승` },
    memory: { title: "메모리", higherBetter: false, format: (s) => `${s}초` },
    tetris: { title: "테트리스", higherBetter: true, format: (s) => `${s}점` },
    pong: { title: "퐁", higherBetter: true, format: (s) => `${s}점` },
    breakout: { title: "벽돌깨기", higherBetter: true, format: (s) => `${s}점` },
    wordle: { title: "Wordle", higherBetter: false, format: (s) => `${s}번` },
    sudoku: { title: "스도쿠", higherBetter: false, format: (s) => `${s}초` },
    connect4: { title: "커넥트4", higherBetter: false, format: (s) => `${s}수` },
    match3: { title: "매치-3", higherBetter: true, format: (s) => `${s}점` },
    flappy: { title: "플래피", higherBetter: true, format: (s) => `${s}점` },
    runner: { title: "러너", higherBetter: true, format: (s) => `${s}점` },
    cave: { title: "동굴 탐험", higherBetter: true, format: (s) => `${s}점` },
    freecell: { title: "프리셀", higherBetter: false, format: (s) => `${Math.floor(s / 1000)}초 ${s % 1000}수` },
    blackjack: { title: "블랙잭", higherBetter: true, format: (s) => `${s}칩` }
  };

  const panelRoots = new Map();
  let modalEl = null;

  function getClient() {
    return window.Auth?.getClient?.();
  }

  function toSortKey(score, higherBetter) {
    const n = Math.max(0, Math.floor(score));
    return higherBetter ? n : SORT_MAX - n;
  }

  function defaultName() {
    const session = window.Auth?.getSession?.();
    if (session?.user?.email) return session.user.email.split("@")[0].slice(0, 24);
    const name = session?.user?.user_metadata?.full_name;
    if (name) return String(name).slice(0, 24);
    return "";
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  async function fetchTop(gameId, limit = 10) {
    const supabase = getClient();
    if (!supabase) {
      return { data: [], error: { message: "Supabase is not configured." } };
    }

    return supabase
      .from("game_scores")
      .select("player_name, score, created_at")
      .eq("game_id", gameId)
      .order("sort_key", { ascending: false })
      .limit(limit);
  }

  async function qualifies(gameId, score) {
    const cfg = CONFIG[gameId];
    if (!cfg) return false;

    const sortKey = toSortKey(score, cfg.higherBetter);
    const { data, error } = await fetchTop(gameId, 10);
    if (error) return false;
    if (!data || data.length < 10) return true;

    const supabase = getClient();
    const { data: tenth } = await supabase
      .from("game_scores")
      .select("sort_key")
      .eq("game_id", gameId)
      .order("sort_key", { ascending: false })
      .range(9, 9)
      .maybeSingle();

    return sortKey > (tenth?.sort_key ?? 0);
  }

  async function submit(gameId, playerName, score) {
    const cfg = CONFIG[gameId];
    if (!cfg) return { error: { message: "Unknown game." } };

    const supabase = getClient();
    if (!supabase) {
      return { error: { message: "Supabase is not configured." } };
    }

    const name = String(playerName || "").trim().slice(0, 24);
    if (!name) return { error: { message: "이름을 입력하세요." } };

    return supabase.from("game_scores").insert({
      game_id: gameId,
      player_name: name,
      score: Math.max(0, Math.floor(score)),
      sort_key: toSortKey(score, cfg.higherBetter),
      higher_is_better: cfg.higherBetter
    });
  }

  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement("div");
    modalEl.className = "leaderboard-modal";
    modalEl.hidden = true;
    modalEl.innerHTML = `
      <div class="leaderboard-modal-backdrop" id="lb-modal-backdrop"></div>
      <div class="leaderboard-modal-card" role="dialog" aria-labelledby="lb-modal-title">
        <h3 id="lb-modal-title">랭킹 등록</h3>
        <p id="lb-modal-desc" class="leaderboard-modal-desc"></p>
        <div class="form-group">
          <label for="lb-modal-name">이름</label>
          <input id="lb-modal-name" type="text" maxlength="24" placeholder="이름 입력">
        </div>
        <div class="leaderboard-modal-actions">
          <button type="button" class="action-btn" id="lb-modal-save">등록</button>
          <button type="button" class="secondary-btn" id="lb-modal-cancel">취소</button>
        </div>
        <p id="lb-modal-error" class="auth-message error" hidden></p>
      </div>
    `;
    document.body.appendChild(modalEl);
    return modalEl;
  }

  function showNameModal(gameId, score) {
    return new Promise((resolve) => {
      const cfg = CONFIG[gameId];
      const modal = ensureModal();
      const desc = document.getElementById("lb-modal-desc");
      const input = document.getElementById("lb-modal-name");
      const errorEl = document.getElementById("lb-modal-error");
      const saveBtn = document.getElementById("lb-modal-save");
      const cancelBtn = document.getElementById("lb-modal-cancel");
      const backdrop = document.getElementById("lb-modal-backdrop");

      desc.textContent = `${cfg.title} — 기록: ${cfg.format(score)} (TOP 10 진입!)`;
      input.value = defaultName();
      errorEl.hidden = true;
      modal.hidden = false;
      input.focus();
      input.select();

      function close(result) {
        modal.hidden = true;
        saveBtn.onclick = null;
        cancelBtn.onclick = null;
        backdrop.onclick = null;
        resolve(result);
      }

      async function save() {
        errorEl.hidden = true;
        saveBtn.disabled = true;
        const { error } = await submit(gameId, input.value, score);
        saveBtn.disabled = false;
        if (error) {
          errorEl.textContent = error.message;
          errorEl.hidden = false;
          return;
        }
        await refresh(gameId);
        close(true);
      }

      saveBtn.onclick = save;
      cancelBtn.onclick = () => close(false);
      backdrop.onclick = () => close(false);
      input.onkeydown = (e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") close(false);
      };
    });
  }

  async function refresh(gameId) {
    const cfg = CONFIG[gameId];
    const root = panelRoots.get(gameId);
    if (!root || !cfg) return;

    const body = root.querySelector(".leaderboard-body");
    if (!body) return;

    body.innerHTML = `<p class="board-loading">순위 불러오는 중...</p>`;

    const { data, error } = await fetchTop(gameId, 10);
    if (error) {
      body.innerHTML = `<p class="auth-message error">순위를 불러올 수 없습니다. Supabase에서 game_scores.sql을 실행했는지 확인하세요.</p>`;
      return;
    }

    if (!data?.length) {
      body.innerHTML = `<p class="board-empty">아직 기록이 없습니다.</p>`;
      return;
    }

    body.innerHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr><th>#</th><th>이름</th><th>기록</th><th>날짜</th></tr>
        </thead>
        <tbody>
          ${data
            .map(
              (row, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(row.player_name)}</td>
              <td>${escapeHtml(cfg.format(row.score))}</td>
              <td>${row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function mount(parentEl, gameId) {
    if (!CONFIG[gameId] || !parentEl) return;

    let root = parentEl.querySelector(`.leaderboard-panel[data-game-id="${gameId}"]`);
    if (!root) {
      root = document.createElement("div");
      root.className = "leaderboard-panel";
      root.dataset.gameId = gameId;
      root.innerHTML = `
        <h4 class="leaderboard-title">🏆 TOP 10 — ${escapeHtml(CONFIG[gameId].title)}</h4>
        <div class="leaderboard-body"></div>
      `;
      parentEl.appendChild(root);
    }

    panelRoots.set(gameId, root);
    refresh(gameId);
  }

  async function tryRecord(gameId, score) {
    if (!CONFIG[gameId] || score == null || !Number.isFinite(score)) return;
    if (!window.Auth?.isConfigured?.()) return;

    const ok = await qualifies(gameId, score);
    if (!ok) {
      await refresh(gameId);
      return;
    }

    await showNameModal(gameId, score);
    await refresh(gameId);
  }

  window.Leaderboard = {
    CONFIG,
    mount,
    refresh,
    tryRecord,
    fetchTop
  };
})();
