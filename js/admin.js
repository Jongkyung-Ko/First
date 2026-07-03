(function () {
  "use strict";

  const PAGE_SIZE = 25;
  const API_BASE = () => window.STOCK_API_URL || "";
  const UNLOCK_KEY = "dw-admin-gate";
  const UNLOCK_TTL_MS = 4 * 60 * 60 * 1000;

  const _pinBytes = [0x2f, 0x2e, 0x2e, 0x31];
  const _pinMask = 0x1c;

  function expectedPin() {
    return _pinBytes.map((b) => String.fromCharCode(b ^ _pinMask)).join("");
  }

  function isUnlocked() {
    try {
      const raw = sessionStorage.getItem(UNLOCK_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return data?.v === 1 && Date.now() - Number(data.t || 0) < UNLOCK_TTL_MS;
    } catch {
      return false;
    }
  }

  function setUnlocked() {
    sessionStorage.setItem(UNLOCK_KEY, JSON.stringify({ v: 1, t: Date.now() }));
  }

  function clearUnlock() {
    sessionStorage.removeItem(UNLOCK_KEY);
  }

  function verifyPin(value) {
    return String(value || "") === expectedPin();
  }

  const PAGE_LABELS = {
    welcome: "Welcome",
    stock: "Stock News",
    "stock-picks-formulas": "Stock Picks",
    chart: "Chart",
    games: "Games",
    sound: "Sound",
    books: "Books",
    joke: "Fun",
    music: "Music",
    art: "ART",
    space: "우주",
    board: "Read Post",
    recommend2: "Stock Picks · Re",
    "stock-picks": "Stock Picks (legacy)"
  };

  let pageRoot = null;
  let activeTab = "users";
  let usersState = {
    page: 1,
    search: "",
    loading: false,
    data: null,
    error: ""
  };
  let menuState = {
    days: 30,
    loading: false,
    data: null,
    error: ""
  };
  let expandedUserId = null;
  let expandedHistory = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(value) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString("ko-KR", { hour12: false });
    } catch {
      return String(value);
    }
  }

  function formatDateShort(value) {
    if (!value) return "—";
    try {
      const d = new Date(value);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}.${m}.${day}`;
    } catch {
      return "—";
    }
  }

  function shortEmail(email) {
    const e = String(email || "").trim();
    if (!e) return "—";
    const at = e.indexOf("@");
    if (at > 0) {
      const local = e.slice(0, at);
      const domain = e.slice(at + 1);
      const shortLocal = local.length > 8 ? `${local.slice(0, 7)}…` : local;
      const shortDomain = domain.length > 10 ? `${domain.slice(0, 9)}…` : domain;
      return `${shortLocal}@${shortDomain}`;
    }
    return e.length > 18 ? `${e.slice(0, 17)}…` : e;
  }

  function renderUserCard(u) {
    const expanded = expandedUserId === u.id;
    const email = u.email || u.id || "—";
    return `
      <article class="admin-user-card${expanded ? " is-expanded" : ""}" data-user-id="${escapeHtml(u.id)}">
        <div class="admin-user-card-head">
          <div class="admin-user-card-id">
            <span class="admin-user-email-short" title="${escapeHtml(email)}">${escapeHtml(shortEmail(email))}</span>
          </div>
          <button type="button" class="admin-detail-btn" data-user-detail="${escapeHtml(u.id)}">${expanded ? "접기" : "내역"}</button>
        </div>
        <dl class="admin-user-card-dates">
          <div><dt>가입</dt><dd>${formatDateShort(u.created_at)}</dd></div>
          <div><dt>접속</dt><dd>${formatDateShort(u.last_connected_at)}</dd></div>
        </dl>
        <div class="admin-user-card-stats">
          <div class="admin-user-stat"><span class="admin-user-stat-label">잔고</span><span class="admin-user-stat-val">${escapeHtml(u.digimon ?? "—")}</span></div>
          <div class="admin-user-stat"><span class="admin-user-stat-label">사용</span><span class="admin-user-stat-val">${u.dm_spent}</span></div>
          <div class="admin-user-stat"><span class="admin-user-stat-label">충전</span><span class="admin-user-stat-val">${u.dm_granted}</span></div>
          <div class="admin-user-stat"><span class="admin-user-stat-label">Chart</span><span class="admin-user-stat-val">${u.chart_dm_spent}</span></div>
        </div>
        ${expanded ? `<div class="admin-user-card-detail">${renderUserHistory(u.id)}</div>` : ""}
      </article>
    `;
  }

  function pageLabel(key) {
    return PAGE_LABELS[key] || key;
  }

  async function getAccessToken() {
    const session = window.Auth?.getSession?.();
    return session?.access_token || null;
  }

  async function adminFetch(path, params) {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("로그인이 필요합니다.");
    }
    const url = new URL(`${API_BASE().replace(/\/$/, "")}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
      });
    }
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.detail || body.message || `HTTP ${res.status}`);
    }
    return body;
  }

  function renderGate(container) {
    container.innerHTML = `
      <article class="content-panel admin-panel admin-gate-panel">
        <header class="admin-head">
          <h2 class="admin-title">Admin</h2>
          <button type="button" class="secondary-btn admin-close-btn" id="admin-gate-close">닫기</button>
        </header>
        <form class="admin-gate-form" id="admin-gate-form" autocomplete="off">
          <p class="admin-gate-lead">관리자 비밀번호를 입력하세요.</p>
          <label class="admin-gate-label" for="admin-gate-pin">비밀번호</label>
          <input type="password" class="admin-gate-input" id="admin-gate-pin" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" required>
          <p class="admin-gate-error" id="admin-gate-error" hidden role="alert"></p>
          <button type="submit" class="action-btn admin-gate-submit">확인</button>
        </form>
      </article>
    `;
    container.querySelector("#admin-gate-close")?.addEventListener("click", () => close());
    container.querySelector("#admin-gate-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = container.querySelector("#admin-gate-pin");
      const errEl = container.querySelector("#admin-gate-error");
      const pin = input?.value || "";
      if (!verifyPin(pin)) {
        if (errEl) {
          errEl.textContent = "비밀번호가 올바르지 않습니다.";
          errEl.hidden = false;
        }
        if (input) {
          input.value = "";
          input.focus();
        }
        return;
      }
      setUnlocked();
      open(container, { skipGate: true });
    });
    container.querySelector("#admin-gate-pin")?.focus();
  }

  function renderShell() {
    if (!pageRoot) return;
    pageRoot.innerHTML = `
      <article class="content-panel admin-panel">
        <header class="admin-head">
          <h2 class="admin-title">Admin</h2>
          <button type="button" class="secondary-btn admin-close-btn" id="admin-close-btn">닫기</button>
        </header>
        <nav class="admin-tabs" role="tablist" aria-label="Admin sections">
          <button type="button" class="admin-tab${activeTab === "users" ? " is-active" : ""}" data-admin-tab="users" role="tab">가입자 현황</button>
          <button type="button" class="admin-tab${activeTab === "menus" ? " is-active" : ""}" data-admin-tab="menus" role="tab">메뉴 접속</button>
          <button type="button" class="admin-tab${activeTab === "misc" ? " is-active" : ""}" data-admin-tab="misc" role="tab">기타</button>
        </nav>
        <div id="admin-tab-body" class="admin-tab-body"></div>
      </article>
    `;
    pageRoot.querySelector("#admin-close-btn")?.addEventListener("click", () => {
      window.Admin?.close?.();
    });
    pageRoot.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.adminTab;
        if (!tab || tab === activeTab) return;
        activeTab = tab;
        expandedUserId = null;
        expandedHistory = null;
        renderShell();
        void refreshActiveTab();
      });
    });
    renderTabBody();
  }

  function renderTabBody() {
    const body = pageRoot?.querySelector("#admin-tab-body");
    if (!body) return;
    if (activeTab === "users") body.innerHTML = renderUsersTab();
    else if (activeTab === "menus") body.innerHTML = renderMenusTab();
    else body.innerHTML = renderMiscTab();
    bindTabEvents();
  }

  function renderUsersTab() {
    const d = usersState.data;
    const rows = (d?.users || [])
      .map((u) => {
        const expanded = expandedUserId === u.id;
        return `
          <tr class="admin-user-row${expanded ? " is-expanded" : ""}" data-user-id="${escapeHtml(u.id)}">
            <td class="admin-col-email">${escapeHtml(u.email || u.id)}</td>
            <td>${formatDate(u.created_at)}</td>
            <td>${formatDate(u.last_connected_at)}</td>
            <td class="admin-col-num">${escapeHtml(u.digimon ?? "—")}</td>
            <td class="admin-col-num">${u.dm_spent}</td>
            <td class="admin-col-num">${u.dm_granted}</td>
            <td class="admin-col-num">${u.chart_dm_spent}</td>
            <td><button type="button" class="admin-detail-btn" data-user-detail="${escapeHtml(u.id)}">${expanded ? "접기" : "내역"}</button></td>
          </tr>
          ${
            expanded
              ? `<tr class="admin-user-detail-row"><td colspan="8">${renderUserHistory(u.id)}</td></tr>`
              : ""
          }
        `;
      })
      .join("");

    return `
      <div class="admin-toolbar">
        <label class="admin-search-wrap">
          <span class="admin-search-label">검색</span>
          <input type="search" class="admin-search-input" id="admin-user-search" placeholder="이메일·이름" value="${escapeHtml(usersState.search)}" autocomplete="off">
        </label>
        <button type="button" class="action-btn admin-refresh-btn" id="admin-users-refresh">새로고침</button>
      </div>
      ${usersState.loading ? `<p class="admin-status">불러오는 중…</p>` : ""}
      ${usersState.error ? `<p class="admin-status admin-status-error" role="alert">${escapeHtml(usersState.error)}</p>` : ""}
      ${
        d
          ? `<p class="admin-meta">총 ${d.total}명 · ${d.page}/${d.total_pages}페이지 (${PAGE_SIZE}명/페이지)</p>`
          : ""
      }
      <div class="admin-table-wrap admin-users-desktop">
        <table class="master-table admin-table">
          <thead>
            <tr>
              <th>ID (이메일)</th>
              <th>가입일</th>
              <th>최근 접속</th>
              <th>DM 잔고</th>
              <th>DM 사용</th>
              <th>DM 충전</th>
              <th>Chart DM</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="8" class="admin-empty">데이터 없음</td></tr>`}</tbody>
        </table>
      </div>
      <div class="admin-users-mobile" aria-label="가입자 목록">
        ${(d?.users || []).length ? (d.users || []).map((u) => renderUserCard(u)).join("") : `<p class="admin-empty">데이터 없음</p>`}
      </div>
      ${renderUsersPager()}
    `;
  }

  function renderUsersPager() {
    const d = usersState.data;
    if (!d || d.total_pages <= 1) return "";
    const prev = Math.max(1, d.page - 1);
    const next = Math.min(d.total_pages, d.page + 1);
    return `
      <div class="admin-pager">
        <button type="button" class="secondary-btn" data-admin-page="${prev}" ${d.page <= 1 ? "disabled" : ""}>이전</button>
        <span class="admin-pager-label">${d.page} / ${d.total_pages}</span>
        <button type="button" class="secondary-btn" data-admin-page="${next}" ${d.page >= d.total_pages ? "disabled" : ""}>다음</button>
      </div>
    `;
  }

  function renderUserHistory(userId) {
    if (!expandedHistory || expandedHistory.userId !== userId) {
      return `<p class="admin-status">내역 불러오는 중…</p>`;
    }
    if (expandedHistory.error) {
      return `<p class="admin-status admin-status-error">${escapeHtml(expandedHistory.error)}</p>`;
    }
    const items = expandedHistory.items || [];
    if (!items.length) {
      return `<p class="admin-empty-inline">DM 거래 내역 없음</p>`;
    }
    return `
      <ul class="admin-history-list">
        ${items
          .map(
            (it) =>
              `<li><span class="admin-history-type admin-history-type--${escapeHtml(it.entry_type)}">${escapeHtml(it.entry_type)}</span> <strong>${it.entry_type === "spend" ? "-" : "+"}${it.amount}</strong> · ${escapeHtml(it.reason || "")} · <time>${formatDate(it.created_at)}</time></li>`
          )
          .join("")}
      </ul>
    `;
  }

  function renderMenusTab() {
    const d = menuState.data;
    const rows = (d?.pages || [])
      .map(
        (p) => `
        <tr>
          <td>${escapeHtml(pageLabel(p.page_key))}</td>
          <td><code>${escapeHtml(p.page_key)}</code></td>
          <td class="admin-col-num">${p.clicks}</td>
          <td class="admin-col-num">${p.unique_users}</td>
          <td class="admin-col-num">${p.guest_clicks}</td>
          <td>${formatDate(p.last_click_at)}</td>
        </tr>
      `
      )
      .join("");

    return `
      <div class="admin-toolbar">
        <label class="admin-days-wrap">
          <span>기간</span>
          <select id="admin-menu-days" class="admin-days-select">
            ${[7, 14, 30, 90]
              .map(
                (n) =>
                  `<option value="${n}"${menuState.days === n ? " selected" : ""}>최근 ${n}일</option>`
              )
              .join("")}
          </select>
        </label>
        <button type="button" class="action-btn admin-refresh-btn" id="admin-menus-refresh">새로고침</button>
      </div>
      ${menuState.loading ? `<p class="admin-status">불러오는 중…</p>` : ""}
      ${menuState.error ? `<p class="admin-status admin-status-error" role="alert">${escapeHtml(menuState.error)}</p>` : ""}
      ${d ? `<p class="admin-meta">이벤트 ${d.total_events}건 · ${menuState.days}일 집계</p>` : ""}
      <div class="admin-table-wrap">
        <table class="master-table admin-table">
          <thead>
            <tr>
              <th>메뉴</th>
              <th>키</th>
              <th>클릭</th>
              <th>회원(고유)</th>
              <th>Guest</th>
              <th>마지막</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="6" class="admin-empty">데이터 없음</td></tr>`}</tbody>
        </table>
      </div>
    `;
  }

  function renderMiscTab() {
    return `
      <section class="admin-misc">
        <p class="admin-misc-lead">추가 예정 기능</p>
        <ul class="admin-misc-list">
          <li>DM 30개 주기 지급 · 광고 클릭 DM 충전</li>
          <li>주식 차트 구독 상세 (종목·기간별)</li>
          <li>일별 메뉴 롤업 차트 · CSV보내기</li>
        </ul>
      </section>
    `;
  }

  function bindTabEvents() {
    if (activeTab === "users") {
      const searchInput = pageRoot?.querySelector("#admin-user-search");
      let searchTimer = null;
      searchInput?.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          usersState.search = searchInput.value.trim();
          usersState.page = 1;
          void loadUsers();
        }, 350);
      });
      pageRoot?.querySelector("#admin-users-refresh")?.addEventListener("click", () => void loadUsers());
      pageRoot?.querySelectorAll("[data-admin-page]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const p = Number(btn.dataset.adminPage);
          if (!Number.isFinite(p)) return;
          usersState.page = p;
          void loadUsers();
        });
      });
      pageRoot?.querySelectorAll("[data-user-detail]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const uid = btn.dataset.userDetail;
          if (!uid) return;
          if (expandedUserId === uid) {
            expandedUserId = null;
            expandedHistory = null;
          } else {
            expandedUserId = uid;
            expandedHistory = { userId: uid, items: null, error: "" };
            void loadUserHistory(uid);
          }
          renderTabBody();
        });
      });
    }

    if (activeTab === "menus") {
      pageRoot?.querySelector("#admin-menu-days")?.addEventListener("change", (e) => {
        menuState.days = Number(e.target.value) || 30;
        void loadMenuStats();
      });
      pageRoot?.querySelector("#admin-menus-refresh")?.addEventListener("click", () => void loadMenuStats());
    }
  }

  async function loadUsers() {
    usersState.loading = true;
    usersState.error = "";
    renderTabBody();
    try {
      usersState.data = await adminFetch("/api/admin/users", {
        page: usersState.page,
        limit: PAGE_SIZE,
        search: usersState.search
      });
    } catch (err) {
      usersState.error = err.message || String(err);
      usersState.data = null;
    } finally {
      usersState.loading = false;
      renderTabBody();
    }
  }

  async function loadUserHistory(userId) {
    try {
      const data = await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/dm-history`, {
        limit: 40,
        offset: 0
      });
      expandedHistory = { userId, items: data.items || [], error: "" };
    } catch (err) {
      expandedHistory = { userId, items: [], error: err.message || String(err) };
    }
    renderTabBody();
  }

  async function loadMenuStats() {
    menuState.loading = true;
    menuState.error = "";
    renderTabBody();
    try {
      menuState.data = await adminFetch("/api/admin/menu-stats", { days: menuState.days });
    } catch (err) {
      menuState.error = err.message || String(err);
      menuState.data = null;
    } finally {
      menuState.loading = false;
      renderTabBody();
    }
  }

  async function refreshActiveTab() {
    if (activeTab === "users") await loadUsers();
    else if (activeTab === "menus") await loadMenuStats();
  }

  function canOpen() {
    return window.Auth?.isAdmin?.(window.Auth.getSession());
  }

  function open(container, opts) {
    if (!canOpen()) return false;
    pageRoot = container;
    if (!opts?.skipGate && !isUnlocked()) {
      renderGate(container);
      return true;
    }
    activeTab = "users";
    usersState = { page: 1, search: "", loading: false, data: null, error: "" };
    menuState = { days: 30, loading: false, data: null, error: "" };
    expandedUserId = null;
    expandedHistory = null;
    renderShell();
    void refreshActiveTab();
    return true;
  }

  function close() {
    pageRoot = null;
    window.AppNavigation?.navigate?.({ page: "welcome" }, { replace: true });
  }

  function leavePage() {
    pageRoot = null;
  }

  window.Admin = {
    open,
    close,
    leavePage,
    canOpen,
    clearUnlock
  };
})();
