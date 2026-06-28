(function () {
  "use strict";

  let pageRoot = null;
  let abortCtrl = null;

  const TABS = [
    { id: "facts", label: "쓸모없는사실", hint: "Useless Facts API" },
    { id: "excuses", label: "변명제조기", hint: "Corporate BS Generator" },
    { id: "quotes", label: "무작위명언", hint: "Animechan" },
    { id: "jokes", label: "랜덤개그", hint: "JokeAPI · Programming" },
    { id: "fortune", label: "운세", hint: "오늘의 운세" },
    { id: "weather", label: "날씨", hint: "Open-Meteo" }
  ];

  const state = {
    tab: "facts",
    loading: false,
    error: "",
    payload: null,
    weatherCity: "Seoul"
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

  async function fetchJson(path) {
    abortCtrl?.abort();
    abortCtrl = new AbortController();
    const res = await fetch(`${apiBase()}${path}`, {
      signal: abortCtrl.signal,
      headers: { Accept: "application/json" }
    });
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

  function renderTabNav() {
    return `
      <nav class="joke-tab-nav" aria-label="JOKE 세부 메뉴">
        ${TABS.map(
          (tab) =>
            `<button type="button" class="joke-tab-btn${tab.id === state.tab ? " is-active" : ""}" data-joke-tab="${escapeHtml(tab.id)}" title="${escapeHtml(tab.hint)}">${escapeHtml(tab.label)}</button>`
        ).join("")}
      </nav>
    `;
  }

  function renderWeatherControls() {
    if (state.tab !== "weather") return "";
    return `
      <form class="joke-weather-form" id="joke-weather-form">
        <label class="joke-weather-label" for="joke-weather-city">도시</label>
        <input type="search" id="joke-weather-city" class="joke-weather-input" value="${escapeHtml(state.weatherCity)}" placeholder="예: Seoul, Busan, Tokyo" autocomplete="off">
        <button type="submit" class="joke-btn joke-btn-primary">날씨 조회</button>
      </form>
    `;
  }

  function renderCards() {
    if (state.loading) {
      return `<p class="joke-status joke-status-loading" role="status">불러오는 중…</p>`;
    }
    if (state.error) {
      return `<p class="joke-status joke-status-error" role="alert">${escapeHtml(state.error)}</p>`;
    }
    const payload = state.payload;
    if (!payload) {
      return `<p class="joke-status joke-status-info">항목을 선택하면 내용이 표시됩니다.</p>`;
    }

    if (state.tab === "weather") {
      return `
        <article class="joke-card joke-card-weather">
          <p class="joke-card-kicker">${escapeHtml(payload.city || state.weatherCity)}</p>
          <p class="joke-weather-summary">${escapeHtml(payload.summary || "날씨")}</p>
          <p class="joke-weather-temp">${payload.temperature_c != null ? `${payload.temperature_c}°C` : "—"}</p>
          <ul class="joke-weather-meta">
            <li>체감 ${payload.feels_like_c != null ? `${payload.feels_like_c}°C` : "—"}</li>
            <li>습도 ${payload.humidity_pct != null ? `${payload.humidity_pct}%` : "—"}</li>
            <li>풍속 ${payload.wind_kmh != null ? `${payload.wind_kmh} km/h` : "—"}</li>
          </ul>
          ${payload.updated_at ? `<p class="joke-card-foot">갱신 ${escapeHtml(payload.updated_at)}</p>` : ""}
        </article>
      `;
    }

    const items = payload.items || [];
    if (!items.length) {
      return `<p class="joke-status joke-status-info">표시할 내용이 없습니다.</p>`;
    }

    return `
      <div class="joke-card-grid">
        ${items
          .map((item, index) => {
            if (state.tab === "facts") {
              return `
                <article class="joke-card">
                  <p class="joke-card-index">${index + 1}</p>
                  <p class="joke-card-text">${escapeHtml(item.text)}</p>
                  ${item.source ? `<p class="joke-card-foot">출처 ${escapeHtml(item.source)}</p>` : ""}
                </article>`;
            }
            if (state.tab === "excuses") {
              return `
                <article class="joke-card">
                  <p class="joke-card-index">${index + 1}</p>
                  <p class="joke-card-text">${escapeHtml(item.phrase)}</p>
                </article>`;
            }
            if (state.tab === "quotes") {
              return `
                <article class="joke-card">
                  <p class="joke-card-index">${index + 1}</p>
                  <blockquote class="joke-card-quote">${escapeHtml(item.quote)}</blockquote>
                  <p class="joke-card-foot">${escapeHtml([item.character, item.anime].filter(Boolean).join(" · "))}</p>
                </article>`;
            }
            if (state.tab === "jokes") {
              return `
                <article class="joke-card">
                  <p class="joke-card-index">${index + 1}</p>
                  <p class="joke-card-text">${escapeHtml(item.joke)}</p>
                  ${item.category ? `<p class="joke-card-foot">${escapeHtml(item.category)}</p>` : ""}
                </article>`;
            }
            if (state.tab === "fortune") {
              return `
                <article class="joke-card joke-card-fortune">
                  <p class="joke-card-index">${index + 1}</p>
                  <p class="joke-card-text">${escapeHtml(item.text)}</p>
                  <p class="joke-card-foot">행운의 숫자 ${escapeHtml(String(item.lucky_number))} · ${escapeHtml(item.lucky_color)}</p>
                </article>`;
            }
            return "";
          })
          .join("")}
      </div>
    `;
  }

  function renderBody() {
    if (!pageRoot) return;
    pageRoot.innerHTML = `
      <article class="content-panel joke-panel">
        <header class="joke-header">
          <h2>JOKE</h2>
          <p class="joke-intro">가볍게 웃고 쉬어 가세요. 세부 메뉴를 누르면 새 내용을 불러옵니다.</p>
        </header>
        ${renderTabNav()}
        ${renderWeatherControls()}
        <div class="joke-toolbar">
          <button type="button" class="joke-btn joke-btn-primary" id="joke-refresh">다시 불러오기</button>
        </div>
        <section class="joke-body" id="joke-body" aria-live="polite">
          ${renderCards()}
        </section>
        <p class="joke-footnote">
          API:
          <a href="https://uselessfacts.jsph.pl/" target="_blank" rel="noopener noreferrer">Useless Facts</a>
          ·
          <a href="https://corporatebs-generator.sameerkumar.website/" target="_blank" rel="noopener noreferrer">Corporate BS</a>
          ·
          <a href="https://animechan.xyz/" target="_blank" rel="noopener noreferrer">Animechan</a>
          ·
          <a href="https://v2.jokeapi.dev/" target="_blank" rel="noopener noreferrer">JokeAPI</a>
          ·
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
        </p>
      </article>
    `;
    bindEvents();
  }

  function updateBodyOnly() {
    const body = pageRoot?.querySelector("#joke-body");
    if (body) body.innerHTML = renderCards();
    const form = pageRoot?.querySelector("#joke-weather-form");
    if (state.tab === "weather" && !form) {
      const nav = pageRoot?.querySelector(".joke-tab-nav");
      nav?.insertAdjacentHTML("afterend", renderWeatherControls());
      bindWeatherForm();
    } else if (state.tab !== "weather" && form) {
      form.remove();
    }
  }

  async function loadTab(tabId) {
    state.tab = tabId;
    state.loading = true;
    state.error = "";
    state.payload = null;
    pageRoot?.querySelectorAll(".joke-tab-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.jokeTab === tabId);
    });
    updateBodyOnly();

    try {
      let path = `/api/joke/${encodeURIComponent(tabId)}?count=3`;
      if (tabId === "weather") {
        path = `/api/joke/weather?city=${encodeURIComponent(state.weatherCity || "Seoul")}`;
      }
      state.payload = await fetchJson(path);
    } catch (err) {
      if (err.name === "AbortError") return;
      state.error = err.message || "불러오지 못했습니다.";
      state.payload = null;
    } finally {
      state.loading = false;
      updateBodyOnly();
    }
  }

  function bindWeatherForm() {
    const form = pageRoot?.querySelector("#joke-weather-form");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = pageRoot?.querySelector("#joke-weather-city");
      state.weatherCity = String(input?.value || "Seoul").trim() || "Seoul";
      void loadTab("weather");
    });
  }

  function bindEvents() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll("[data-joke-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabId = btn.dataset.jokeTab;
        if (!tabId) return;
        void loadTab(tabId);
      });
    });
    pageRoot.querySelector("#joke-refresh")?.addEventListener("click", () => {
      void loadTab(state.tab);
    });
    bindWeatherForm();
  }

  function renderPage(container) {
    pageRoot = container;
    state.tab = "facts";
    state.loading = false;
    state.error = "";
    state.payload = null;
    state.weatherCity = "Seoul";
    renderBody();
    void loadTab("facts");
  }

  function destroy() {
    abortCtrl?.abort();
    abortCtrl = null;
    pageRoot = null;
  }

  window.Joke = {
    renderPage,
    destroy,
    leavePage: destroy
  };
})();
