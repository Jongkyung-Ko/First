(function () {
  "use strict";

  let pageRoot = null;
  let qrScanner = null;
  let qrScanning = false;
  let html5QrcodeLoader = null;

  const state = {
    tab: "generator",
    generated: [],
    gameCount: 1,
    latestDraw: null,
    checkLoading: false,
    checkError: "",
    checkResult: null,
    qrStatus: "",
    manualRound: "",
    manualLine: ""
  };

  function apiBase() {
    return (window.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return `${n.toLocaleString("ko-KR")}원`;
  }

  function ballClass(num) {
    const n = Number(num);
    if (n <= 10) return "lotto-ball-yellow";
    if (n <= 20) return "lotto-ball-blue";
    if (n <= 30) return "lotto-ball-red";
    if (n <= 40) return "lotto-ball-gray";
    return "lotto-ball-green";
  }

  function renderBalls(numbers, options = {}) {
    const nums = numbers || [];
    const bonus = options.bonus;
    const showPlus = options.showPlus && bonus != null;
    return `
      <div class="lotto-balls" role="list" aria-label="로또 번호">
        ${nums
          .map(
            (n) =>
              `<span class="lotto-ball ${ballClass(n)}" role="listitem">${escapeHtml(String(n).padStart(2, "0"))}</span>`
          )
          .join("")}
        ${
          showPlus
            ? `<span class="lotto-ball-plus" aria-hidden="true">+</span><span class="lotto-ball lotto-ball-bonus ${ballClass(bonus)}" role="listitem">${escapeHtml(String(bonus).padStart(2, "0"))}</span>`
            : ""
        }
      </div>`;
  }

  function generateLine() {
    const picked = new Set();
    while (picked.size < 6) {
      picked.add(Math.floor(Math.random() * 45) + 1);
    }
    return Array.from(picked).sort((a, b) => a - b);
  }

  function generateLines(count) {
    const lines = [];
    const seen = new Set();
    let guard = 0;
    while (lines.length < count && guard < count * 40) {
      guard += 1;
      const line = generateLine();
      const key = line.join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(line);
    }
    return lines;
  }

  async function fetchJson(path, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    const init = { method: options.method || "GET", headers };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    const res = await fetch(`${apiBase()}${path}`, init);
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const err = await res.json();
        detail = err.detail || err.message || detail;
      } catch (_) {
        /* ignore */
      }
      throw new Error(typeof detail === "string" ? detail : "요청에 실패했습니다.");
    }
    return res.json();
  }

  function loadHtml5QrcodeLib() {
    if (window.Html5Qrcode) return Promise.resolve(window.Html5Qrcode);
    if (html5QrcodeLoader) return html5QrcodeLoader;
    html5QrcodeLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
      script.async = true;
      script.onload = () => resolve(window.Html5Qrcode);
      script.onerror = () => reject(new Error("QR 스캔 라이브러리를 불러오지 못했습니다."));
      document.head.appendChild(script);
    });
    return html5QrcodeLoader;
  }

  function setQrStatus(message) {
    state.qrStatus = message || "";
    const el = pageRoot?.querySelector("#lotto-qr-status");
    if (el) {
      el.textContent = state.qrStatus;
      el.hidden = !state.qrStatus;
    }
  }

  async function stopQrScanner() {
    if (!qrScanner || !qrScanning) return;
    try {
      await qrScanner.stop();
    } catch (_) {
      /* ignore */
    }
    qrScanning = false;
    setQrStatus("카메라를 중지했습니다.");
  }

  async function startQrScanner() {
    if (state.tab !== "check") return;
    const mount = pageRoot?.querySelector("#lotto-qr-reader");
    if (!mount) return;
    try {
      const Html5Qrcode = await loadHtml5QrcodeLib();
      if (qrScanning) return;
      if (qrScanner) {
        try {
          await qrScanner.stop();
        } catch (_) {
          /* ignore */
        }
        qrScanning = false;
      }
      qrScanner = new Html5Qrcode("lotto-qr-reader");
      setQrStatus("카메라를 여는 중…");
      await qrScanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          void handleQrPayload(decoded);
        },
        () => {}
      );
      qrScanning = true;
      setQrStatus("QR 코드를 화면 중앙에 맞춰 주세요.");
    } catch (err) {
      qrScanning = false;
      setQrStatus(err.message || "카메라를 시작하지 못했습니다. 권한을 확인해 주세요.");
    }
  }

  async function handleQrPayload(raw) {
    if (state.checkLoading) return;
    await stopQrScanner();
    state.checkLoading = true;
    state.checkError = "";
    state.checkResult = null;
    state.qrStatus = "당첨 확인 중…";
    setQrStatus(state.qrStatus);
    updateBody();
    try {
      state.checkResult = await fetchJson("/api/lotto/check-qr", {
        method: "POST",
        body: { raw }
      });
      state.qrStatus = "QR 인식 완료";
    } catch (err) {
      state.checkError = err.message || "당첨 확인에 실패했습니다.";
      state.qrStatus = "";
    } finally {
      state.checkLoading = false;
      updateBody();
    }
  }

  async function loadLatestDraw() {
    try {
      state.latestDraw = await fetchJson("/api/lotto/draw/latest");
    } catch (_) {
      state.latestDraw = null;
    }
  }

  function parseManualLine(text) {
    const nums = String(text || "")
      .split(/[\s,]+/)
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n));
    if (nums.length !== 6) {
      throw new Error("수동 입력은 1~45 숫자 6개를 공백 또는 쉼표로 구분해 입력해 주세요.");
    }
    return nums.sort((a, b) => a - b);
  }

  async function checkManual() {
    const round = Number(state.manualRound);
    if (!Number.isFinite(round) || round < 1) {
      state.checkError = "회차 번호를 입력해 주세요.";
      updateBody();
      return;
    }
    state.checkLoading = true;
    state.checkError = "";
    state.checkResult = null;
    updateBody();
    try {
      const line = parseManualLine(state.manualLine);
      state.checkResult = await fetchJson("/api/lotto/check", {
        method: "POST",
        body: { round, lines: [line] }
      });
    } catch (err) {
      state.checkError = err.message || "당첨 확인에 실패했습니다.";
    } finally {
      state.checkLoading = false;
      updateBody();
    }
  }

  async function checkQrText(raw) {
    const text = String(raw || "").trim();
    if (!text) {
      state.checkError = "QR URL 또는 v= 값을 입력해 주세요.";
      updateBody();
      return;
    }
    await handleQrPayload(text);
  }

  async function scanQrFile(file) {
    if (!file) return;
    try {
      const Html5Qrcode = await loadHtml5QrcodeLib();
      const scanner = new Html5Qrcode("lotto-qr-file-reader");
      const result = await scanner.scanFile(file, true);
      await handleQrPayload(result);
    } catch (err) {
      state.checkError = err.message || "이미지에서 QR을 찾지 못했습니다.";
      updateBody();
    }
  }

  function renderTabNav() {
    return `
      <nav class="lotto-tab-nav" aria-label="로또 메뉴">
        <button type="button" class="lotto-tab-btn${state.tab === "generator" ? " is-active" : ""}" data-lotto-tab="generator">번호 생성</button>
        <button type="button" class="lotto-tab-btn${state.tab === "check" ? " is-active" : ""}" data-lotto-tab="check">당첨 조회</button>
      </nav>`;
  }

  function renderGeneratorPanel() {
    return `
      <section class="lotto-panel">
        <p class="lotto-intro">1~45 중 중복 없이 6개 번호를 무작위로 생성합니다. (로또 6/45)</p>
        <div class="lotto-toolbar">
          <label class="lotto-count-label">
            <span>게임 수</span>
            <select id="lotto-game-count" class="lotto-select">
              ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${state.gameCount === n ? " selected" : ""}>${n}게임</option>`).join("")}
            </select>
          </label>
          <button type="button" class="lotto-btn lotto-btn-primary" id="lotto-generate">번호 생성</button>
        </div>
        <div class="lotto-generated-list">
          ${
            state.generated.length
              ? state.generated
                  .map(
                    (line, index) => `
              <article class="lotto-line-card">
                <p class="lotto-line-label">${index + 1}게임</p>
                ${renderBalls(line)}
              </article>`
                  )
                  .join("")
              : `<p class="lotto-status lotto-status-info">「번호 생성」을 눌러 보세요.</p>`
          }
        </div>
      </section>`;
  }

  function renderCheckResults() {
    if (state.checkLoading) {
      return `<p class="lotto-status lotto-status-loading" role="status">당첨 확인 중…</p>`;
    }
    if (state.checkError) {
      return `<p class="lotto-status lotto-status-error" role="alert">${escapeHtml(state.checkError)}</p>`;
    }
    const result = state.checkResult;
    if (!result) return "";

    const draw = result.draw || {};
    return `
      <section class="lotto-result-block">
        <header class="lotto-draw-head">
          <h3 class="lotto-draw-title">${escapeHtml(String(result.round))}회 당첨번호</h3>
          <p class="lotto-draw-meta">${escapeHtml(draw.date || "")} · 1등 ${formatMoney(draw.first_prize)} (${escapeHtml(String(draw.first_winners || 0))}명)</p>
          ${renderBalls(draw.numbers || [], { bonus: draw.bonus, showPlus: true })}
        </header>
        <div class="lotto-result-lines">
          ${(result.results || [])
            .map((row) => {
              const rankClass = row.rank ? `lotto-rank-${row.rank}` : "lotto-rank-0";
              return `
            <article class="lotto-result-card ${rankClass}">
              <div class="lotto-result-head">
                <span class="lotto-result-game">${escapeHtml(String(row.line))}번째 줄</span>
                <strong class="lotto-result-rank">${escapeHtml(row.rank_label || "낙첨")}</strong>
              </div>
              ${renderBalls(row.numbers || [])}
              <p class="lotto-result-meta">일치 ${escapeHtml(String(row.match_count || 0))}개${row.bonus_hit ? " · 보너스 포함" : ""}</p>
            </article>`;
            })
            .join("")}
        </div>
      </section>`;
  }

  function renderCheckPanel() {
    const latest = state.latestDraw;
    return `
      <section class="lotto-panel">
        <p class="lotto-intro">복권 QR을 스캔하거나 v= 값을 붙여 넣으면 당첨 여부를 확인합니다.</p>
        ${
          latest
            ? `<div class="lotto-latest-banner">
            <p class="lotto-latest-kicker">최근 ${escapeHtml(String(latest.round))}회 (${escapeHtml(latest.date || "")})</p>
            ${renderBalls(latest.numbers || [], { bonus: latest.bonus, showPlus: true })}
          </div>`
            : ""
        }
        <div class="lotto-check-grid">
          <article class="lotto-check-card">
            <h3 class="lotto-check-title">📷 QR 코드 스캔</h3>
            <div id="lotto-qr-reader" class="lotto-qr-reader"></div>
            <div id="lotto-qr-file-reader" class="lotto-qr-file-reader" hidden></div>
            <div class="lotto-check-actions">
              <button type="button" class="lotto-btn lotto-btn-primary" id="lotto-qr-start">카메라 시작</button>
              <button type="button" class="lotto-btn" id="lotto-qr-stop">카메라 중지</button>
              <label class="lotto-btn lotto-file-btn">
                QR 사진 선택
                <input type="file" id="lotto-qr-file" accept="image/*" hidden>
              </label>
            </div>
            ${state.qrStatus ? `<p id="lotto-qr-status" class="lotto-status lotto-status-info">${escapeHtml(state.qrStatus)}</p>` : `<p id="lotto-qr-status" class="lotto-status lotto-status-info" hidden></p>`}
          </article>
          <article class="lotto-check-card">
            <h3 class="lotto-check-title">🔗 QR 문자 붙여넣기</h3>
            <textarea id="lotto-qr-text" class="lotto-textarea" rows="3" placeholder="예: http://m.dhlottery.co.kr/?v=1230m010203..."></textarea>
            <button type="button" class="lotto-btn lotto-btn-primary" id="lotto-qr-submit">QR로 확인</button>
          </article>
          <article class="lotto-check-card">
            <h3 class="lotto-check-title">✏️ 수동 입력</h3>
            <label class="lotto-field">
              <span>회차</span>
              <input type="number" id="lotto-manual-round" class="lotto-input" min="1" max="9999" placeholder="1230" value="${escapeHtml(state.manualRound)}">
            </label>
            <label class="lotto-field">
              <span>번호 6개</span>
              <input type="text" id="lotto-manual-line" class="lotto-input" placeholder="3 11 25 30 41 45" value="${escapeHtml(state.manualLine)}">
            </label>
            <button type="button" class="lotto-btn lotto-btn-primary" id="lotto-manual-check">수동 확인</button>
          </article>
        </div>
        ${renderCheckResults()}
        <p class="lotto-disclaimer">참고용이며, 실제 지급·당첨 확인은 동행복권 공식 채널과 실물 복권을 기준으로 해 주세요.</p>
      </section>`;
  }

  function updateBody() {
    const body = pageRoot?.querySelector("#lotto-body");
    if (body) {
      body.innerHTML = state.tab === "generator" ? renderGeneratorPanel() : renderCheckPanel();
      bindPanelEvents();
    }
  }

  function bindPanelEvents() {
    if (!pageRoot) return;

    pageRoot.querySelector("#lotto-generate")?.addEventListener("click", () => {
      state.generated = generateLines(state.gameCount);
      updateBody();
    });

    pageRoot.querySelector("#lotto-game-count")?.addEventListener("change", (event) => {
      state.gameCount = Number(event.target.value) || 1;
    });

    pageRoot.querySelector("#lotto-qr-start")?.addEventListener("click", () => {
      void startQrScanner();
    });

    pageRoot.querySelector("#lotto-qr-stop")?.addEventListener("click", () => {
      void stopQrScanner();
    });

    pageRoot.querySelector("#lotto-qr-submit")?.addEventListener("click", () => {
      const text = pageRoot.querySelector("#lotto-qr-text")?.value || "";
      void checkQrText(text);
    });

    pageRoot.querySelector("#lotto-qr-file")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      void scanQrFile(file);
      event.target.value = "";
    });

    pageRoot.querySelector("#lotto-manual-check")?.addEventListener("click", () => {
      state.manualRound = pageRoot.querySelector("#lotto-manual-round")?.value || "";
      state.manualLine = pageRoot.querySelector("#lotto-manual-line")?.value || "";
      void checkManual();
    });
  }

  function bindEvents() {
    if (!pageRoot || pageRoot.dataset.lottoBound) return;
    pageRoot.dataset.lottoBound = "1";

    pageRoot.addEventListener("click", (event) => {
      const tabBtn = event.target.closest("[data-lotto-tab]");
      if (!tabBtn) return;
      const tab = tabBtn.dataset.lottoTab;
      if (!tab || tab === state.tab) return;
      void switchTab(tab);
    });

    bindPanelEvents();
  }

  async function switchTab(tab) {
    if (tab === "check" && state.tab !== "check") {
      state.tab = tab;
      pageRoot?.querySelectorAll(".lotto-tab-btn").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.lottoTab === tab);
      });
      updateBody();
      await loadLatestDraw();
      updateBody();
      return;
    }
    if (state.tab === "check" && tab !== "check") {
      await stopQrScanner();
    }
    state.tab = tab;
    pageRoot?.querySelectorAll(".lotto-tab-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.lottoTab === tab);
    });
    updateBody();
  }

  function renderEmbeddedHtml() {
    return `
      <div class="lotto-embedded">
        ${renderTabNav()}
        <div id="lotto-body">${state.tab === "generator" ? renderGeneratorPanel() : renderCheckPanel()}</div>
        <p class="lotto-footnote">
          데이터:
          <a href="https://www.dhlottery.co.kr/" target="_blank" rel="noopener noreferrer">동행복권</a>
        </p>
      </div>`;
  }

  function resetState() {
    state.tab = "generator";
    state.generated = [];
    state.gameCount = 1;
    state.latestDraw = null;
    state.checkLoading = false;
    state.checkError = "";
    state.checkResult = null;
    state.qrStatus = "";
    state.manualRound = "";
    state.manualLine = "";
  }

  function mount(container) {
    if (!container) return;
    void stopQrScanner();
    if (pageRoot && pageRoot !== container) {
      delete pageRoot.dataset.lottoBound;
    }
    pageRoot = container;
    resetState();
    pageRoot.innerHTML = renderEmbeddedHtml();
    bindEvents();
  }

  async function unmount() {
    await stopQrScanner();
    qrScanner = null;
    if (pageRoot) {
      delete pageRoot.dataset.lottoBound;
      pageRoot.innerHTML = "";
    }
    pageRoot = null;
  }

  function renderPage(container) {
    mount(container);
  }

  async function destroy() {
    await unmount();
  }

  window.LottoPanel = {
    mount,
    unmount
  };

  window.Lotto = {
    renderPage,
    destroy,
    leavePage: destroy
  };
})();
