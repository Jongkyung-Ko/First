(function () {
  "use strict";

  let pageRoot = null;
  let abortCtrl = null;
  const concurrentControllers = new Set();
  let loadingTimer = null;
  let loadingDotCount = 1;

  const CONTENT_TABS = ["facts", "illusions", "quotes", "jokes"];
  const prefetchPromises = {};
  const weatherFetchPromises = {};

  const WEATHER_STORAGE_KEY = "digital-world-joke-weather-places";

  const TABS = [
    { id: "facts", label: "쓸모없는사실", hint: "Useless Facts API" },
    { id: "illusions", label: "착시", hint: "Wikimedia Commons · optical illusion" },
    { id: "quotes", label: "무작위명언", hint: "Animechan" },
    { id: "jokes", label: "랜덤개그", hint: "JokeAPI · Programming" },
    { id: "lotto", label: "로또", hint: "동행복권 · 번호 생성 · QR 당첨" },
    { id: "fortune", label: "운세", hint: "Aztro · FreeAstroAPI" },
    { id: "weather", label: "날씨", hint: "Open-Meteo" }
  ];

  const FORTUNE_MODES = [
    { id: "zodiac", label: "별자리 운세" },
    { id: "personal", label: "오늘의 운세" }
  ];

  const DEFAULT_WEATHER_PLACE = {
    id: "37.5665:126.9780",
    label: "서울, South Korea",
    lat: 37.5665,
    lng: 126.978
  };

  const DEFAULT_LOCATION = {
    lat: 37.5665,
    lng: 126.978,
    timezone: "Asia/Seoul",
    label: "서울 (기본)",
    fromDevice: false
  };

  const ZODIAC_VISUAL = {
    aries: { symbol: "♈", emoji: "🐏", accent: "#ef4444", name_en: "Aries" },
    taurus: { symbol: "♉", emoji: "🐂", accent: "#84cc16", name_en: "Taurus" },
    gemini: { symbol: "♊", emoji: "👯", accent: "#eab308", name_en: "Gemini" },
    cancer: { symbol: "♋", emoji: "🦀", accent: "#94a3b8", name_en: "Cancer" },
    leo: { symbol: "♌", emoji: "🦁", accent: "#f97316", name_en: "Leo" },
    virgo: { symbol: "♍", emoji: "🌾", accent: "#65a30d", name_en: "Virgo" },
    libra: { symbol: "♎", emoji: "⚖️", accent: "#ec4899", name_en: "Libra" },
    scorpio: { symbol: "♏", emoji: "🦂", accent: "#7c3aed", name_en: "Scorpio" },
    sagittarius: { symbol: "♐", emoji: "🏹", accent: "#a855f7", name_en: "Sagittarius" },
    capricorn: { symbol: "♑", emoji: "🐐", accent: "#64748b", name_en: "Capricorn" },
    aquarius: { symbol: "♒", emoji: "🏺", accent: "#06b6d4", name_en: "Aquarius" },
    pisces: { symbol: "♓", emoji: "🐟", accent: "#3b82f6", name_en: "Pisces" }
  };

  function zodiacVisual(item) {
    const fallback = ZODIAC_VISUAL[item.sign] || {};
    return {
      symbol: item.symbol || fallback.symbol || "★",
      emoji: item.emoji || fallback.emoji || "✨",
      accent: item.accent || fallback.accent || "#6366f1",
      name_en: item.name_en || fallback.name_en || ""
    };
  }

  const state = {
    tab: "facts",
    fortuneMode: "zodiac",
    loading: false,
    error: "",
    payload: null,
    birth: { year: 1990, month: 1, day: 1, hour: 12, minute: 0 },
    location: null,
    locationStatus: "",
    weatherQuery: "",
    weatherSearching: false,
    weatherSearchError: "",
    weatherResults: [],
    weatherPlaces: [],
    cache: {}
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

  function renderLoadingHtml(baseText) {
    const base = baseText || "불러오는 중";
    const dots = ".".repeat(loadingDotCount);
    return `<p class="joke-status joke-status-loading" data-joke-loading data-loading-base="${escapeHtml(base)}" role="status">${escapeHtml(base + dots)}</p>`;
  }

  function refreshLoadingDots() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll("[data-joke-loading]").forEach((el) => {
      const base = el.dataset.loadingBase || "불러오는 중";
      el.textContent = base + ".".repeat(loadingDotCount);
    });
  }

  function isLoadingVisible() {
    if (state.loading) return true;
    if (state.weatherSearching) return true;
    if (state.tab === "weather" && state.weatherPlaces.some((place) => place.loading)) return true;
    return Boolean(pageRoot?.querySelector("[data-joke-loading]"));
  }

  function startLoadingAnimation() {
    if (loadingTimer) return;
    loadingDotCount = 1;
    refreshLoadingDots();
    loadingTimer = setInterval(() => {
      loadingDotCount = loadingDotCount >= 4 ? 1 : loadingDotCount + 1;
      refreshLoadingDots();
    }, 450);
  }

  function stopLoadingAnimation() {
    if (loadingTimer) {
      clearInterval(loadingTimer);
      loadingTimer = null;
    }
    loadingDotCount = 1;
  }

  function syncLoadingAnimation() {
    if (isLoadingVisible()) startLoadingAnimation();
    else stopLoadingAnimation();
  }

  function placeIdFromCoords(lat, lng) {
    return `${Number(lat).toFixed(4)}:${Number(lng).toFixed(4)}`;
  }

  function getBilingual(item, field) {
    const en = String(item[`${field}_en`] || item[field] || "").trim();
    const ko = String(item[`${field}_ko`] || en).trim();
    return { ko, en };
  }

  function renderBilingualBlock(ko, en, tagClass) {
    const cls = tagClass || "joke-card-text";
    const showEn = en && ko !== en;
    return `
      <p class="${cls} joke-bilingual-ko">${escapeHtml(ko)}</p>
      ${showEn ? `<p class="joke-card-text-en">${escapeHtml(en)}</p>` : ""}
    `;
  }

  function renderBilingualQuote(ko, en) {
    const showEn = en && ko !== en;
    return `
      <blockquote class="joke-card-quote joke-bilingual-ko">${escapeHtml(ko)}</blockquote>
      ${showEn ? `<p class="joke-card-text-en">${escapeHtml(en)}</p>` : ""}
    `;
  }

  function loadWeatherPlacesFromStorage() {
    try {
      const raw = localStorage.getItem(WEATHER_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed) || !parsed.length) {
        state.weatherPlaces = [{ ...DEFAULT_WEATHER_PLACE, weather: null, loading: false, error: "" }];
        return;
      }
      state.weatherPlaces = parsed.map((row) => ({
        id: String(row.id || placeIdFromCoords(row.lat, row.lng)),
        label: String(row.label || "지역"),
        lat: Number(row.lat),
        lng: Number(row.lng),
        weather: null,
        loading: false,
        error: ""
      }));
    } catch (_) {
      state.weatherPlaces = [{ ...DEFAULT_WEATHER_PLACE, weather: null, loading: false, error: "" }];
    }
  }

  function saveWeatherPlacesToStorage() {
    const rows = state.weatherPlaces.map(({ id, label, lat, lng }) => ({ id, label, lat, lng }));
    try {
      localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(rows));
    } catch (_) {
      /* ignore quota errors */
    }
  }

  function isWeatherPlaceAdded(place) {
    const id = place.id || placeIdFromCoords(place.lat, place.lng);
    return state.weatherPlaces.some((row) => row.id === id);
  }

  async function fetchJson(path, options = {}) {
    const concurrent = Boolean(options.concurrent);
    const ctrl = new AbortController();
    if (concurrent) {
      concurrentControllers.add(ctrl);
    } else {
      abortCtrl?.abort();
      abortCtrl = ctrl;
    }
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    const init = {
      signal: ctrl.signal,
      method: options.method || "GET",
      headers
    };
    if (options.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    try {
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
    } finally {
      if (concurrent) concurrentControllers.delete(ctrl);
    }
  }

  function getTimezoneGuess() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
    } catch (_) {
      return "Asia/Seoul";
    }
  }

  function requestDeviceLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("이 브라우저는 위치 정보를 지원하지 않습니다."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timezone: getTimezoneGuess(),
            label: "현재 위치",
            fromDevice: true
          });
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
      );
    });
  }

  async function resolveLocation(forcePrompt) {
    if (!forcePrompt && state.location?.fromDevice) return state.location;
    state.locationStatus = "위치 확인 중…";
    updateFortuneLocationNote();
    try {
      state.location = await requestDeviceLocation();
      state.locationStatus = "기기 위치를 사용합니다.";
    } catch (_) {
      state.location = { ...DEFAULT_LOCATION };
      state.locationStatus = "위치 정보를 사용할 수 없어 서울 좌표를 사용합니다.";
    }
    updateFortuneLocationNote();
    return state.location;
  }

  function updateFortuneLocationNote() {
    const note = pageRoot?.querySelector("#joke-location-note");
    if (note) note.textContent = state.locationStatus || "";
  }

  function renderTabNav() {
    return `
      <nav class="joke-tab-nav" aria-label="Fun 세부 메뉴">
        ${TABS.map(
          (tab) =>
            `<button type="button" class="joke-tab-btn${tab.id === state.tab ? " is-active" : ""}" data-joke-tab="${escapeHtml(tab.id)}" title="${escapeHtml(tab.hint)}">${escapeHtml(tab.label)}</button>`
        ).join("")}
      </nav>
    `;
  }

  function renderFortuneSubNav() {
    if (state.tab !== "fortune") return "";
    return `
      <nav class="joke-sub-nav" aria-label="운세 세부 메뉴">
        ${FORTUNE_MODES.map(
          (mode) =>
            `<button type="button" class="joke-sub-btn${mode.id === state.fortuneMode ? " is-active" : ""}" data-joke-fortune-mode="${escapeHtml(mode.id)}">${escapeHtml(mode.label)}</button>`
        ).join("")}
      </nav>
    `;
  }

  function renderFortunePersonalForm() {
    if (state.tab !== "fortune" || state.fortuneMode !== "personal") return "";
    const b = state.birth;
    return `
      <form class="joke-fortune-form" id="joke-fortune-form">
        <p class="joke-form-intro">태어난 날짜·시간과 현재 위치(위도/경도/타임존)로 오늘의 개인 운세를 계산합니다.</p>
        <div class="joke-form-grid">
          <label class="joke-form-field"><span>년</span><input type="number" name="year" min="1900" max="2100" value="${escapeHtml(String(b.year))}" required></label>
          <label class="joke-form-field"><span>월</span><input type="number" name="month" min="1" max="12" value="${escapeHtml(String(b.month))}" required></label>
          <label class="joke-form-field"><span>일</span><input type="number" name="day" min="1" max="31" value="${escapeHtml(String(b.day))}" required></label>
          <label class="joke-form-field"><span>시</span><input type="number" name="hour" min="0" max="23" value="${escapeHtml(String(b.hour))}" required></label>
          <label class="joke-form-field"><span>분</span><input type="number" name="minute" min="0" max="59" value="${escapeHtml(String(b.minute))}" required></label>
        </div>
        <div class="joke-form-actions">
          <button type="button" class="joke-btn" id="joke-location-btn">위치 다시 확인</button>
          <button type="submit" class="joke-btn joke-btn-primary">오늘의 운세 보기</button>
        </div>
        <p class="joke-location-note" id="joke-location-note">${escapeHtml(state.locationStatus)}</p>
      </form>
    `;
  }

  function renderWeatherChromeInner() {
    return `
      <div class="joke-weather-chrome">
        <form class="joke-weather-form" id="joke-weather-search-form">
          <label class="joke-weather-label" for="joke-weather-query">지역 검색 (도시·주소·지역명)</label>
          <input
            class="joke-weather-input"
            id="joke-weather-query"
            type="search"
            placeholder="예: 서울, 부산, Tokyo, New York"
            value="${escapeHtml(state.weatherQuery)}"
            autocomplete="off"
          >
          <div class="joke-weather-actions">
            <button type="submit" class="joke-btn joke-btn-primary">검색</button>
            <button type="button" class="joke-btn" id="joke-weather-current">현재 위치</button>
          </div>
        </form>
        <div class="joke-weather-results" id="joke-weather-results">
          ${renderWeatherSearchResults()}
        </div>
      </div>
    `;
  }

  function renderWeatherSearchResults() {
    if (state.weatherSearching) {
      return renderLoadingHtml("지역 검색 중");
    }
    if (state.weatherSearchError) {
      return `<p class="joke-status joke-status-error" role="alert">${escapeHtml(state.weatherSearchError)}</p>`;
    }
    if (!state.weatherResults.length) {
      if (state.weatherQuery.trim()) {
        return `<p class="joke-status joke-status-info">검색 결과가 없습니다.</p>`;
      }
      return "";
    }
    return state.weatherResults
      .map((place) => {
        const added = isWeatherPlaceAdded(place);
        const payload = escapeHtml(JSON.stringify(place));
        return `
          <div class="joke-weather-result">
            <button
              type="button"
              class="joke-card-action joke-card-action-add"
              data-weather-add="${payload}"
              aria-label="날씨 추가"
              title="추가"
              ${added ? "disabled" : ""}
            >+</button>
            <p class="joke-weather-result-label">${escapeHtml(place.label)}</p>
          </div>`;
      })
      .join("");
  }

  function renderWeatherCard(place) {
    if (place.loading) {
      return `
        <article class="joke-card joke-card-weather" data-weather-id="${escapeHtml(place.id)}">
          <button type="button" class="joke-card-action joke-card-action-remove" data-weather-remove="${escapeHtml(place.id)}" aria-label="삭제" title="삭제">×</button>
          <p class="joke-card-kicker">${escapeHtml(place.label)}</p>
          ${renderLoadingHtml("날씨 불러오는 중")}
        </article>`;
    }
    if (place.error) {
      return `
        <article class="joke-card joke-card-weather" data-weather-id="${escapeHtml(place.id)}">
          <button type="button" class="joke-card-action joke-card-action-remove" data-weather-remove="${escapeHtml(place.id)}" aria-label="삭제" title="삭제">×</button>
          <p class="joke-card-kicker">${escapeHtml(place.label)}</p>
          <p class="joke-status joke-status-error" role="alert">${escapeHtml(place.error)}</p>
        </article>`;
    }
    const w = place.weather || {};
    const title = w.city || place.label;
    return `
      <article class="joke-card joke-card-weather" data-weather-id="${escapeHtml(place.id)}">
        <button type="button" class="joke-card-action joke-card-action-remove" data-weather-remove="${escapeHtml(place.id)}" aria-label="삭제" title="삭제">×</button>
        <p class="joke-card-kicker">${escapeHtml(title)}</p>
        <p class="joke-weather-summary">${escapeHtml(w.summary || "날씨")}</p>
        <p class="joke-weather-temp">${w.temperature_c != null ? `${w.temperature_c}°C` : "—"}</p>
        <ul class="joke-weather-meta">
          <li>체감 ${w.feels_like_c != null ? `${w.feels_like_c}°C` : "—"}</li>
          <li>습도 ${w.humidity_pct != null ? `${w.humidity_pct}%` : "—"}</li>
          <li>풍속 ${w.wind_kmh != null ? `${w.wind_kmh} km/h` : "—"}</li>
          ${w.timezone ? `<li>타임존 ${escapeHtml(w.timezone)}</li>` : ""}
        </ul>
        ${w.updated_at ? `<p class="joke-card-foot">갱신 ${escapeHtml(w.updated_at)}</p>` : ""}
      </article>`;
  }

  function renderWeatherCards() {
    if (!state.weatherPlaces.length) {
      return `<p class="joke-status joke-status-info">지역을 검색하거나 현재 위치를 추가해 주세요.</p>`;
    }
    return `
      <div class="joke-weather-cards">
        ${state.weatherPlaces.map((place) => renderWeatherCard(place)).join("")}
      </div>
    `;
  }

  function renderIllusionCards(items, dateKst) {
    return `
      <p class="joke-date-banner">${escapeHtml(dateKst || "")} · 오늘의 착시 ${items.length}선 · Wikimedia Commons</p>
      <div class="joke-illusion-grid">
        ${items
          .map(
            (item, index) => `
          <article class="joke-card joke-card-illusion">
            <p class="joke-card-index">${index + 1}</p>
            <a
              class="joke-illusion-link"
              href="${escapeHtml(item.page_url || "#")}"
              target="_blank"
              rel="noopener noreferrer"
              title="Wikimedia Commons에서 보기"
            >
              <img
                class="joke-illusion-img"
                src="${escapeHtml(item.image_url || "")}"
                alt="${escapeHtml(item.title || "착시 이미지")}"
                loading="lazy"
                decoding="async"
              >
            </a>
            <h3 class="joke-illusion-title">${escapeHtml(item.title || "착시")}</h3>
            ${item.description ? `<p class="joke-illusion-desc">${escapeHtml(item.description)}</p>` : ""}
            <p class="joke-card-foot">${escapeHtml([item.author, item.license].filter(Boolean).join(" · "))}</p>
          </article>`
          )
          .join("")}
      </div>
    `;
  }

  function renderZodiacBadge(icon, labelKo, valueKo, valueEn) {
    const showEn = valueEn && valueKo !== valueEn;
    return `
      <span class="joke-zodiac-badge" title="${escapeHtml(labelKo)}">
        <span class="joke-zodiac-badge-icon" aria-hidden="true">${icon}</span>
        <span class="joke-zodiac-badge-label">${escapeHtml(labelKo)}</span>
        <span class="joke-zodiac-badge-value">${escapeHtml(valueKo || "—")}</span>
        ${showEn ? `<span class="joke-zodiac-badge-en">${escapeHtml(valueEn)}</span>` : ""}
      </span>`;
  }

  function luckyColorCss(name) {
    const key = String(name || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    const map = {
      red: "#ef4444",
      blue: "#3b82f6",
      green: "#22c55e",
      yellow: "#eab308",
      orange: "#f97316",
      purple: "#a855f7",
      pink: "#ec4899",
      white: "#f8fafc",
      black: "#1e293b",
      gold: "#fbbf24",
      silver: "#cbd5e1",
      brown: "#92400e",
      gray: "#94a3b8",
      grey: "#94a3b8",
      cyan: "#06b6d4",
      teal: "#14b8a6"
    };
    return map[key] || "#94a3b8";
  }

  function renderZodiacCards(items) {
    return `
      <div class="joke-zodiac-grid">
        ${items
          .map((item) => {
            const desc = getBilingual(item, "description");
            const mood = getBilingual(item, "mood");
            const color = getBilingual(item, "color");
            const compat = getBilingual(item, "compatibility");
            const visual = zodiacVisual(item);
            const accent = visual.accent;
            const emoji = visual.emoji;
            const symbol = visual.symbol;
            const luckyNum = item.lucky_number ? String(item.lucky_number) : "—";
            const luckyTime = item.lucky_time ? String(item.lucky_time) : "—";
            const colorChip = luckyColorCss(color.en || color.ko || item.color);
            const showDescEn = desc.en && desc.ko !== desc.en;
            return `
          <article
            class="joke-card joke-card-zodiac"
            data-zodiac-sign="${escapeHtml(item.sign || "")}"
            style="--zodiac-accent: ${escapeHtml(accent)}"
          >
            <div class="joke-zodiac-hero">
              <span class="joke-zodiac-emoji" aria-hidden="true">${emoji}</span>
              <div class="joke-zodiac-hero-text">
                <span class="joke-zodiac-symbol" aria-hidden="true">${escapeHtml(symbol)}</span>
                <h3 class="joke-zodiac-title">${escapeHtml(item.label || "")}</h3>
                <p class="joke-zodiac-range">${escapeHtml(item.range || "")}${visual.name_en ? ` · ${escapeHtml(visual.name_en)}` : ""}</p>
              </div>
            </div>
            <p class="joke-card-text joke-bilingual-ko joke-zodiac-desc">${escapeHtml(desc.ko)}</p>
            ${showDescEn ? `<p class="joke-card-text-en joke-zodiac-desc-en">${escapeHtml(desc.en)}</p>` : ""}
            <div class="joke-zodiac-badges">
              ${renderZodiacBadge("😊", "기분", mood.ko, mood.en)}
              <span class="joke-zodiac-badge joke-zodiac-badge-color">
                <span class="joke-zodiac-badge-icon" aria-hidden="true">🎨</span>
                <span class="joke-zodiac-badge-label">행운색</span>
                <span class="joke-zodiac-lucky-chip" style="background:${escapeHtml(colorChip)}" title="${escapeHtml(color.ko)}"></span>
                <span class="joke-zodiac-badge-value">${escapeHtml(color.ko || "—")}</span>
                ${color.en && color.ko !== color.en ? `<span class="joke-zodiac-badge-en">${escapeHtml(color.en)}</span>` : ""}
              </span>
              ${renderZodiacBadge("🔢", "행운 번호", luckyNum, "")}
              ${luckyTime !== "—" ? renderZodiacBadge("⏰", "행운 시간", luckyTime, "") : ""}
              ${renderZodiacBadge("💕", "궁합", compat.ko, compat.en)}
            </div>
          </article>`;
          })
          .join("")}
      </div>
    `;
  }

  function renderPersonalFortune(payload) {
    const highlights = payload.highlights || [];
    const loc = payload.location || {};
    const birth = payload.birth || {};
    return `
      <article class="joke-card joke-card-personal">
        <p class="joke-card-kicker">${escapeHtml(payload.date_kst || "")}</p>
        <p class="joke-card-foot">출생 ${escapeHtml(`${birth.year}-${birth.month}-${birth.day} ${birth.hour}:${String(birth.minute).padStart(2, "0")}`)} · ${escapeHtml(loc.label || "위치")} · ${escapeHtml(loc.timezone || "")}</p>
        ${
          highlights.length
            ? `<ul class="joke-personal-list">${highlights.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
            : `<p class="joke-status joke-status-info">해석 문구를 찾지 못했습니다. 아래 원본 데이터를 참고하세요.</p>`
        }
        <details class="joke-raw-details">
          <summary>원본 API 응답</summary>
          <pre class="joke-raw-json">${escapeHtml(JSON.stringify(payload.raw || {}, null, 2))}</pre>
        </details>
      </article>
    `;
  }

  function renderCards() {
    if (state.tab === "weather") {
      return renderWeatherCards();
    }

    if (state.loading) {
      return renderLoadingHtml("불러오는 중");
    }
    if (state.error) {
      return `<p class="joke-status joke-status-error" role="alert">${escapeHtml(state.error)}</p>`;
    }
    const payload = state.payload;
    if (!payload) {
      if (state.tab === "fortune" && state.fortuneMode === "personal") {
        return `<p class="joke-status joke-status-info">생년월일·시간을 입력하고 「오늘의 운세 보기」를 눌러주세요.</p>`;
      }
      return `<p class="joke-status joke-status-info">항목을 선택하면 내용이 표시됩니다.</p>`;
    }

    if (state.tab === "fortune" && state.fortuneMode === "zodiac") {
      const items = payload.items || [];
      if (!items.length) return `<p class="joke-status joke-status-info">별자리 운세를 불러오지 못했습니다.</p>`;
      return `
        <p class="joke-date-banner">${escapeHtml(payload.date_kst || "")} · Vedika / Aztro API</p>
        ${renderZodiacCards(items)}
      `;
    }

    if (state.tab === "fortune" && state.fortuneMode === "personal") {
      return renderPersonalFortune(payload);
    }

    if (state.tab === "illusions") {
      const illusionItems = payload.items || [];
      if (!illusionItems.length) {
        return `<p class="joke-status joke-status-info">착시 이미지를 불러오지 못했습니다.</p>`;
      }
      return renderIllusionCards(illusionItems, payload.date_kst);
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
              const { ko, en } = getBilingual(item, "text");
              return `
                <article class="joke-card">
                  <p class="joke-card-index">${index + 1}</p>
                  ${renderBilingualBlock(ko, en)}
                  ${item.source ? `<p class="joke-card-foot">출처 ${escapeHtml(item.source)}</p>` : ""}
                </article>`;
            }
            if (state.tab === "quotes") {
              const { ko, en } = getBilingual(item, "quote");
              return `
                <article class="joke-card">
                  <p class="joke-card-index">${index + 1}</p>
                  ${renderBilingualQuote(ko, en)}
                  <p class="joke-card-foot">${escapeHtml([item.character, item.anime].filter(Boolean).join(" · "))}</p>
                </article>`;
            }
            if (state.tab === "jokes") {
              const { ko, en } = getBilingual(item, "joke");
              return `
                <article class="joke-card">
                  <p class="joke-card-index">${index + 1}</p>
                  ${renderBilingualBlock(ko, en)}
                  ${item.category ? `<p class="joke-card-foot">${escapeHtml(item.category)}</p>` : ""}
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
          <h2>Fun</h2>
          <p class="joke-intro">가볍게 웃고 쉬어 가세요. 세부 메뉴를 누르면 새 내용을 불러옵니다.</p>
        </header>
        ${renderTabNav()}
        ${renderFortuneSubNav()}
        ${renderFortunePersonalForm()}
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
          <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
          ·
          <a href="https://animechan.xyz/" target="_blank" rel="noopener noreferrer">Animechan</a>
          ·
          <a href="https://v2.jokeapi.dev/" target="_blank" rel="noopener noreferrer">JokeAPI</a>
          ·
          <a href="https://aztro.sameerkumar.website/" target="_blank" rel="noopener noreferrer">Aztro</a>
          ·
          <a href="https://www.freeastroapi.com/" target="_blank" rel="noopener noreferrer">FreeAstroAPI</a>
          ·
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
          ·
          <a href="https://www.dhlottery.co.kr/" target="_blank" rel="noopener noreferrer">동행복권</a>
        </p>
      </article>
    `;
    bindEvents();
  }

  function syncFortuneChrome() {
    const subNav = pageRoot?.querySelector(".joke-sub-nav");
    const form = pageRoot?.querySelector("#joke-fortune-form");
    if (state.tab === "fortune") {
      if (!subNav) {
        pageRoot?.querySelector(".joke-tab-nav")?.insertAdjacentHTML("afterend", renderFortuneSubNav());
        bindFortuneSubNav();
      } else {
        subNav.querySelectorAll("[data-joke-fortune-mode]").forEach((btn) => {
          btn.classList.toggle("is-active", btn.dataset.jokeFortuneMode === state.fortuneMode);
        });
      }
      if (state.fortuneMode === "personal" && !form) {
        pageRoot?.querySelector(".joke-sub-nav")?.insertAdjacentHTML("afterend", renderFortunePersonalForm());
        bindFortuneForm();
      } else if (state.fortuneMode !== "personal" && form) {
        form.remove();
      }
    } else {
      subNav?.remove();
      form?.remove();
    }
  }

  function syncToolbar() {
    const toolbar = pageRoot?.querySelector(".joke-toolbar");
    if (toolbar) toolbar.hidden = state.tab === "lotto";
  }

  function syncWeatherChrome() {
    const refreshBtn = pageRoot?.querySelector("#joke-refresh");
    let chrome = pageRoot?.querySelector("#joke-weather-chrome");
    if (state.tab === "weather") {
      if (!chrome) {
        const anchor =
          pageRoot?.querySelector("#joke-fortune-form") ||
          pageRoot?.querySelector(".joke-sub-nav") ||
          pageRoot?.querySelector(".joke-tab-nav");
        anchor?.insertAdjacentHTML("afterend", `<div id="joke-weather-chrome"></div>`);
        chrome = pageRoot?.querySelector("#joke-weather-chrome");
        if (chrome) {
          chrome.innerHTML = renderWeatherChromeInner();
          bindWeatherForm();
        }
      }
      if (refreshBtn) refreshBtn.textContent = "전체 새로고침";
    } else {
      chrome?.remove();
      if (refreshBtn) refreshBtn.textContent = "다시 불러오기";
    }
  }

  function updateWeatherResultsOnly() {
    const results = pageRoot?.querySelector("#joke-weather-results");
    if (results) results.innerHTML = renderWeatherSearchResults();
    syncLoadingAnimation();
  }

  function updateBodyOnly() {
    syncFortuneChrome();
    syncWeatherChrome();
    syncToolbar();
    const body = pageRoot?.querySelector("#joke-body");
    if (state.tab === "lotto") {
      if (body && !body.querySelector(".lotto-embedded")) {
        window.LottoPanel?.mount(body);
      }
    } else {
      window.LottoPanel?.unmount();
      if (body) body.innerHTML = renderCards();
    }
    if (state.tab === "weather") updateWeatherResultsOnly();
    updateFortuneLocationNote();
    syncLoadingAnimation();
  }

  function applyCacheToActiveTab(cacheKey) {
    const cached = state.cache[cacheKey];
    if (!cached) return false;
    state.payload = cached.payload;
    state.error = cached.error || "";
    state.loading = false;
    return true;
  }

  function storeCache(cacheKey, payload, error) {
    state.cache[cacheKey] = { payload, error: error || "" };
  }

  async function prefetchContentTab(tabId) {
    if (prefetchPromises[tabId]) return prefetchPromises[tabId];
    prefetchPromises[tabId] = (async () => {
      try {
        const data = await fetchJson(`/api/joke/${encodeURIComponent(tabId)}?count=3`, { concurrent: true });
        storeCache(tabId, data, "");
        if (state.tab === tabId) {
          applyCacheToActiveTab(tabId);
          updateBodyOnly();
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        storeCache(tabId, null, err.message || "불러오지 못했습니다.");
        if (state.tab === tabId) {
          applyCacheToActiveTab(tabId);
          updateBodyOnly();
        }
      } finally {
        delete prefetchPromises[tabId];
      }
    })();
    return prefetchPromises[tabId];
  }

  async function prefetchZodiacFortune() {
    const key = "fortune_zodiac";
    if (prefetchPromises[key]) return prefetchPromises[key];
    prefetchPromises[key] = (async () => {
      try {
        const data = await fetchJson("/api/joke/fortune/zodiac", { concurrent: true });
        storeCache(key, data, "");
        if (state.tab === "fortune" && state.fortuneMode === "zodiac") {
          applyCacheToActiveTab(key);
          updateBodyOnly();
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        storeCache(key, null, err.message || "별자리 운세를 불러오지 못했습니다.");
        if (state.tab === "fortune" && state.fortuneMode === "zodiac") {
          applyCacheToActiveTab(key);
          updateBodyOnly();
        }
      } finally {
        delete prefetchPromises[key];
      }
    })();
    return prefetchPromises[key];
  }

  async function prefetchPersonalFortune() {
    const key = "fortune_personal";
    if (prefetchPromises[key]) return prefetchPromises[key];
    prefetchPromises[key] = (async () => {
      const loc = state.location || DEFAULT_LOCATION;
      try {
        const data = await fetchJson("/api/joke/fortune/personal", {
          concurrent: true,
          method: "POST",
          body: {
            ...state.birth,
            lat: loc.lat,
            lng: loc.lng,
            timezone: loc.timezone,
            location_label: loc.label
          }
        });
        storeCache(key, data, "");
        if (state.tab === "fortune" && state.fortuneMode === "personal") {
          applyCacheToActiveTab(key);
          updateBodyOnly();
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        storeCache(key, null, err.message || "오늘의 운세를 불러오지 못했습니다.");
        if (state.tab === "fortune" && state.fortuneMode === "personal") {
          applyCacheToActiveTab(key);
          updateBodyOnly();
        }
      } finally {
        delete prefetchPromises[key];
      }
    })();
    return prefetchPromises[key];
  }

  async function prefetchAllWeather() {
    loadWeatherPlacesFromStorage();
    await Promise.allSettled(
      state.weatherPlaces.map((place) => fetchWeatherForPlace(place.id, { quiet: true }))
    );
    if (state.tab === "weather") updateBodyOnly();
  }

  function prefetchAllApis() {
    CONTENT_TABS.forEach((tabId) => void prefetchContentTab(tabId));
    void prefetchZodiacFortune();
    void prefetchPersonalFortune();
    void prefetchAllWeather();
    void resolveLocation(false).then(() => {
      delete prefetchPromises.fortune_personal;
      void prefetchPersonalFortune();
    });
  }

  async function fetchWeatherForPlace(placeId, options = {}) {
    const quiet = Boolean(options.quiet);
    const place = state.weatherPlaces.find((row) => row.id === placeId);
    if (!place) return;

    if (weatherFetchPromises[placeId]) {
      if (!quiet) {
        place.loading = true;
        updateBodyOnly();
      }
      try {
        await weatherFetchPromises[placeId];
      } finally {
        if (!quiet) {
          place.loading = false;
          updateBodyOnly();
        }
      }
      return;
    }

    place.loading = !quiet;
    place.error = "";
    if (!quiet) updateBodyOnly();

    weatherFetchPromises[placeId] = (async () => {
      try {
        const data = await fetchJson(
          `/api/joke/weather?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lng)}`,
          { concurrent: true }
        );
        place.weather = data;
        if (data.city) place.label = data.city;
      } catch (err) {
        if (err.name === "AbortError") return;
        place.error = err.message || "날씨를 불러오지 못했습니다.";
      } finally {
        place.loading = false;
        saveWeatherPlacesToStorage();
        delete weatherFetchPromises[placeId];
        if (!quiet || state.tab === "weather") updateBodyOnly();
      }
    })();

    await weatherFetchPromises[placeId];
  }

  async function refreshAllWeather() {
    await Promise.all(state.weatherPlaces.map((place) => fetchWeatherForPlace(place.id)));
  }

  function addWeatherPlace(rawPlace) {
    const lat = Number(rawPlace.lat);
    const lng = Number(rawPlace.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const id = String(rawPlace.id || placeIdFromCoords(lat, lng));
    if (state.weatherPlaces.some((row) => row.id === id)) {
      updateWeatherResultsOnly();
      return;
    }
    state.weatherPlaces.push({
      id,
      label: String(rawPlace.label || "지역"),
      lat,
      lng,
      weather: null,
      loading: false,
      error: ""
    });
    saveWeatherPlacesToStorage();
    updateBodyOnly();
    void fetchWeatherForPlace(id);
  }

  function removeWeatherPlace(placeId) {
    state.weatherPlaces = state.weatherPlaces.filter((row) => row.id !== placeId);
    saveWeatherPlacesToStorage();
    updateBodyOnly();
  }

  async function searchWeatherPlaces(query) {
    const q = String(query || "").trim();
    state.weatherQuery = q;
    state.weatherSearchError = "";
    state.weatherResults = [];
    if (!q) {
      updateWeatherResultsOnly();
      return;
    }
    state.weatherSearching = true;
    updateWeatherResultsOnly();
    try {
      const data = await fetchJson(`/api/joke/weather/search?q=${encodeURIComponent(q)}`, { concurrent: true });
      state.weatherResults = data.items || [];
    } catch (err) {
      if (err.name === "AbortError") return;
      state.weatherSearchError = err.message || "지역 검색에 실패했습니다.";
      state.weatherResults = [];
    } finally {
      state.weatherSearching = false;
      updateWeatherResultsOnly();
    }
  }

  async function addCurrentLocationWeather() {
    try {
      const loc = await requestDeviceLocation();
      addWeatherPlace({
        id: placeIdFromCoords(loc.lat, loc.lng),
        label: loc.label,
        lat: loc.lat,
        lng: loc.lng
      });
    } catch (err) {
      state.weatherSearchError = err.message || "현재 위치를 가져오지 못했습니다.";
      updateWeatherResultsOnly();
    }
  }

  async function loadZodiacFortune() {
    const key = "fortune_zodiac";
    if (applyCacheToActiveTab(key)) {
      updateBodyOnly();
      return;
    }
    state.loading = true;
    state.error = "";
    state.payload = null;
    updateBodyOnly();
    await prefetchZodiacFortune();
  }

  async function loadPersonalFortune(forceRefresh) {
    const key = "fortune_personal";
    if (!forceRefresh && applyCacheToActiveTab(key)) {
      updateBodyOnly();
      return;
    }
    const loc = await resolveLocation(false);
    state.loading = true;
    state.error = "";
    state.payload = null;
    updateBodyOnly();
    try {
      const data = await fetchJson("/api/joke/fortune/personal", {
        method: "POST",
        body: {
          ...state.birth,
          lat: loc.lat,
          lng: loc.lng,
          timezone: loc.timezone,
          location_label: loc.label
        }
      });
      storeCache(key, data, "");
      state.payload = data;
    } catch (err) {
      if (err.name === "AbortError") return;
      state.error = err.message || "오늘의 운세를 불러오지 못했습니다.";
      storeCache(key, null, state.error);
    } finally {
      state.loading = false;
      updateBodyOnly();
    }
  }

  async function loadWeatherTab() {
    state.error = "";
    state.payload = null;
    loadWeatherPlacesFromStorage();
    updateBodyOnly();
    const pending = state.weatherPlaces.filter((place) => !place.weather && !place.loading);
    if (pending.length) {
      await Promise.all(pending.map((place) => fetchWeatherForPlace(place.id)));
    }
  }

  async function loadContentTab(tabId, forceRefresh) {
    if (!forceRefresh && applyCacheToActiveTab(tabId)) {
      updateBodyOnly();
      return;
    }
    state.loading = true;
    state.error = "";
    state.payload = null;
    updateBodyOnly();
    delete prefetchPromises[tabId];
    await prefetchContentTab(tabId);
  }

  async function loadTab(tabId) {
    state.tab = tabId;
    state.error = "";
    state.payload = null;
    pageRoot?.querySelectorAll(".joke-tab-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.jokeTab === tabId);
    });
    syncFortuneChrome();
    syncWeatherChrome();

    if (tabId === "fortune") {
      if (state.fortuneMode === "zodiac") {
        await loadZodiacFortune();
      } else if (applyCacheToActiveTab("fortune_personal")) {
        updateBodyOnly();
      } else {
        state.loading = false;
        updateBodyOnly();
      }
      return;
    }
    if (tabId === "weather") {
      await loadWeatherTab();
      return;
    }
    if (tabId === "lotto") {
      state.loading = false;
      updateBodyOnly();
      return;
    }
    if (CONTENT_TABS.includes(tabId)) {
      await loadContentTab(tabId, false);
    }
  }

  async function refreshCurrent() {
    if (state.tab === "lotto") return;
    if (state.tab === "fortune") {
      if (state.fortuneMode === "zodiac") {
        delete state.cache.fortune_zodiac;
        delete prefetchPromises.fortune_zodiac;
        state.loading = true;
        state.payload = null;
        updateBodyOnly();
        await prefetchZodiacFortune();
      } else {
        delete state.cache.fortune_personal;
        await loadPersonalFortune(true);
      }
      return;
    }
    if (state.tab === "weather") {
      await refreshAllWeather();
      return;
    }
    if (CONTENT_TABS.includes(state.tab)) {
      delete state.cache[state.tab];
      await loadContentTab(state.tab, true);
    }
  }

  function bindFortuneSubNav() {
    pageRoot?.querySelectorAll("[data-joke-fortune-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.jokeFortuneMode;
        if (!mode || mode === state.fortuneMode) return;
        state.fortuneMode = mode;
        state.payload = null;
        state.error = "";
        if (mode === "zodiac") void loadZodiacFortune();
        else {
          state.loading = false;
          updateBodyOnly();
          void resolveLocation(true);
        }
      });
    });
  }

  function bindFortuneForm() {
    const form = pageRoot?.querySelector("#joke-fortune-form");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      state.birth = {
        year: Number(fd.get("year")),
        month: Number(fd.get("month")),
        day: Number(fd.get("day")),
        hour: Number(fd.get("hour")),
        minute: Number(fd.get("minute"))
      };
      void loadPersonalFortune(true);
    });
    pageRoot?.querySelector("#joke-location-btn")?.addEventListener("click", () => {
      void resolveLocation(true);
    });
  }

  function bindWeatherForm() {
    const form = pageRoot?.querySelector("#joke-weather-search-form");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = pageRoot?.querySelector("#joke-weather-query");
      void searchWeatherPlaces(input?.value || "");
    });
    pageRoot?.querySelector("#joke-weather-current")?.addEventListener("click", () => {
      void addCurrentLocationWeather();
    });
  }

  function bindEvents() {
    if (!pageRoot || pageRoot.dataset.jokeBound) return;
    pageRoot.dataset.jokeBound = "1";

    pageRoot.addEventListener("click", (event) => {
      const removeBtn = event.target.closest("[data-weather-remove]");
      if (removeBtn) {
        const placeId = removeBtn.getAttribute("data-weather-remove");
        if (placeId) removeWeatherPlace(placeId);
        return;
      }
      const addBtn = event.target.closest("[data-weather-add]");
      if (addBtn && !addBtn.disabled) {
        try {
          const place = JSON.parse(addBtn.getAttribute("data-weather-add") || "{}");
          addWeatherPlace(place);
        } catch (_) {
          /* ignore malformed payload */
        }
      }
    });

    pageRoot.querySelectorAll("[data-joke-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabId = btn.dataset.jokeTab;
        if (!tabId) return;
        void loadTab(tabId);
      });
    });
    pageRoot.querySelector("#joke-refresh")?.addEventListener("click", () => {
      void refreshCurrent();
    });
    bindFortuneSubNav();
    bindFortuneForm();
    bindWeatherForm();
  }

  function renderPage(container) {
    pageRoot = container;
    state.tab = "facts";
    state.fortuneMode = "zodiac";
    state.loading = false;
    state.error = "";
    state.payload = null;
    state.birth = { year: 1990, month: 1, day: 1, hour: 12, minute: 0 };
    state.location = null;
    state.locationStatus = "";
    state.weatherQuery = "";
    state.weatherSearching = false;
    state.weatherSearchError = "";
    state.weatherResults = [];
    state.weatherPlaces = [];
    state.cache = {};
    renderBody();
    state.loading = true;
    updateBodyOnly();
    prefetchAllApis();
    void loadTab("facts");
  }

  function destroy() {
    stopLoadingAnimation();
    window.LottoPanel?.unmount();
    abortCtrl?.abort();
    abortCtrl = null;
    concurrentControllers.forEach((ctrl) => ctrl.abort());
    concurrentControllers.clear();
    if (pageRoot) delete pageRoot.dataset.jokeBound;
    pageRoot = null;
  }

  window.Joke = {
    renderPage,
    destroy,
    leavePage: destroy
  };
})();
