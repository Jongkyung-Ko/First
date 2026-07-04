(function () {
  "use strict";

  let pageRoot = null;
  let detailOverlay = null;
  let detailKeyHandler = null;

  const state = {
    loading: false,
    error: "",
    edition: null,
    categories: [],
    selectedCategory: null,
    selectedIndex: -1
  };

  function getClient() {
    return window.Auth?.getClient?.();
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  function formatRefreshed(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    } catch (_) {
      return iso;
    }
  }

  function locationLine(place) {
    const parts = [
      place.continent_ko || place.continent,
      place.country_ko || place.country,
      place.city_ko || place.city
    ].filter(Boolean);
    return parts.join(" · ");
  }

  function sourceLabel(source) {
    const key = String(source || "").toLowerCase();
    if (key === "unsplash") return "Unsplash";
    if (key === "pexels") return "Pexels";
    if (key === "pixabay") return "Pixabay";
    return source || "Image";
  }

  function normalizeCategories(edition) {
    const raw = edition?.places;
    if (!Array.isArray(raw) || raw.length === 0) return [];

    if (raw[0]?.places && Array.isArray(raw[0].places)) {
      return raw.map((cat) => ({
        id: cat.id || "section",
        title: cat.title || "",
        title_ko: cat.title_ko || cat.title || "Tour",
        places: Array.isArray(cat.places) ? cat.places : []
      }));
    }

    if (raw[0]?.hero) {
      return [
        {
          id: "hot",
          title: "Trending / Hot Place",
          title_ko: "Hot Place",
          places: raw
        }
      ];
    }

    return [];
  }

  function findPlace(catId, index) {
    const cat = state.categories.find((c) => c.id === catId);
    if (!cat) return null;
    return cat.places[index] || null;
  }

  function renderCredit(image) {
    if (!image) return "";
    const label = sourceLabel(image.source);
    const name = image.photographer ? ` · ${escapeHtml(image.photographer)}` : "";
    const href = image.credit_url || "#";
    return `<p class="tour-image-credit">이미지: <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>${name}</p>`;
  }

  function renderHeroCard(place, catId, index, eager) {
    const hero = place.hero || {};
    const url = hero.url || hero.thumb_url || "";
    const loc = locationLine(place);
    return `
      <button type="button" class="tour-hero-card" data-tour-cat="${escapeHtml(catId)}" data-tour-index="${index}" aria-label="${escapeHtml(loc)} 상세 보기">
        <img class="tour-hero-img" src="${escapeHtml(url)}" alt="${escapeHtml(loc)}" loading="${eager ? "eager" : "lazy"}" decoding="async" />
        <span class="tour-hero-gradient" aria-hidden="true"></span>
        <span class="tour-hero-caption">
          <span class="tour-hero-location">${escapeHtml(loc)}</span>
        </span>
      </button>
    `;
  }

  function renderGalleryItem(image) {
    const url = image.url || image.thumb_url || "";
    return `
      <figure class="tour-gallery-item">
        <img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" />
        ${renderCredit(image)}
      </figure>
    `;
  }

  function renderCategorySection(cat, sectionIndex) {
    const label = cat.title_ko || cat.title || "Tour";
    const places = cat.places || [];
    return `
      <section class="tour-section" aria-labelledby="tour-section-${escapeHtml(cat.id)}">
        <h3 class="tour-section-title" id="tour-section-${escapeHtml(cat.id)}">${escapeHtml(label)}</h3>
        <div class="tour-hero-list">
          ${places.map((place, idx) => renderHeroCard(place, cat.id, idx, sectionIndex === 0 && idx < 2)).join("")}
        </div>
      </section>
    `;
  }

  function renderDetailOverlay(place, categoryLabel) {
    if (!place) return;
    const loc = locationLine(place);
    const gallery = Array.isArray(place.gallery) ? place.gallery : [];
    if (!detailOverlay) {
      detailOverlay = document.createElement("div");
      detailOverlay.id = "tour-detail-overlay";
      detailOverlay.className = "tour-detail-overlay";
      detailOverlay.hidden = true;
      detailOverlay.setAttribute("role", "dialog");
      detailOverlay.setAttribute("aria-modal", "true");
      document.body.appendChild(detailOverlay);
    }

    detailOverlay.innerHTML = `
      <div class="tour-detail-backdrop" data-tour-close></div>
      <div class="tour-detail-panel">
        <header class="tour-detail-header">
          <div>
            <p class="tour-detail-kicker">${escapeHtml(categoryLabel || "Tour")}</p>
            <h3 class="tour-detail-title">${escapeHtml(loc)}</h3>
          </div>
          <button type="button" class="tour-detail-close" data-tour-close aria-label="닫기">✕</button>
        </header>
        <div class="tour-detail-body">
          <p class="tour-detail-description">${escapeHtml(place.description || "")}</p>
          <div class="tour-detail-gallery">
            ${gallery.map(renderGalleryItem).join("")}
          </div>
          ${renderCredit(place.hero)}
        </div>
      </div>
    `;

    detailOverlay.hidden = false;
    detailOverlay.querySelectorAll("[data-tour-close]").forEach((el) => {
      el.addEventListener("click", closeDetail);
    });

    if (detailKeyHandler) {
      document.removeEventListener("keydown", detailKeyHandler);
    }
    detailKeyHandler = (event) => {
      if (event.key === "Escape") closeDetail();
    };
    document.addEventListener("keydown", detailKeyHandler);
    detailOverlay.querySelector(".tour-detail-close")?.focus();
  }

  function closeDetail() {
    if (!detailOverlay) return;
    detailOverlay.hidden = true;
    state.selectedCategory = null;
    state.selectedIndex = -1;
    if (detailKeyHandler) {
      document.removeEventListener("keydown", detailKeyHandler);
      detailKeyHandler = null;
    }
  }

  function bindEvents() {
    if (!pageRoot) return;
    pageRoot.querySelectorAll("[data-tour-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const catId = btn.dataset.tourCat;
        const index = Number(btn.dataset.tourIndex);
        const place = findPlace(catId, index);
        if (!place) return;
        const cat = state.categories.find((c) => c.id === catId);
        state.selectedCategory = catId;
        state.selectedIndex = index;
        renderDetailOverlay(place, cat?.title_ko || cat?.title);
      });
    });
  }

  function render() {
    if (!pageRoot) return;

    if (state.loading) {
      pageRoot.innerHTML = `
        <article class="content-panel tour-panel">
          <header class="tour-header">
            <h2>Tour</h2>
            <p class="tour-intro">세계 여행지 큐레이션</p>
          </header>
          <p class="tour-status">풍경을 불러오는 중…</p>
        </article>
      `;
      return;
    }

    if (state.error) {
      pageRoot.innerHTML = `
        <article class="content-panel tour-panel">
          <header class="tour-header">
            <h2>Tour</h2>
            <p class="tour-intro">세계 여행지 큐레이션</p>
          </header>
          <p class="tour-error" role="alert">${escapeHtml(state.error)}</p>
        </article>
      `;
      return;
    }

    const edition = state.edition;
    const categories = state.categories;
    const refreshed = formatRefreshed(edition?.refreshed_at);
    const dateLabel = edition?.edition_date || "";

    pageRoot.innerHTML = `
      <article class="content-panel tour-panel">
        <header class="tour-header">
          <h2>Tour</h2>
          <p class="tour-intro">Hot Place · 이색 · 휴양 · 역사 · 자연경관</p>
          <p class="tour-meta">에디션 ${escapeHtml(dateLabel)} · 마지막 갱신 ${escapeHtml(refreshed)}</p>
        </header>
        ${categories.map(renderCategorySection).join("")}
        <p class="tour-footnote">매일 오후 2시(KST) 갱신 · Unsplash · Pexels · Pixabay</p>
      </article>
    `;
    bindEvents();
  }

  async function loadEdition() {
    const supabase = getClient();
    if (!supabase) {
      state.error = "Supabase가 설정되지 않았습니다. js/config.js를 확인해 주세요.";
      state.loading = false;
      render();
      return;
    }

    state.loading = true;
    state.error = "";
    render();

    const { data, error } = await supabase
      .from("tour_editions")
      .select("edition_date, title, places, refreshed_at")
      .order("edition_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    state.loading = false;

    if (error) {
      if (/relation.*does not exist|schema cache/i.test(error.message)) {
        state.error =
          "tour_editions 테이블이 없습니다. Supabase SQL Editor에서 supabase/tour_editions.sql 을 실행해 주세요.";
      } else {
        state.error = error.message;
      }
      render();
      return;
    }

    const categories = normalizeCategories(data);
    const hasPlaces = categories.some((cat) => (cat.places || []).length > 0);

    if (!data || !hasPlaces) {
      state.error =
        "아직 Tour 데이터가 없습니다. GitHub Actions update-tour 워크플로를 force=1로 실행하거나 Render cron을 호출해 주세요.";
      render();
      return;
    }

    state.edition = data;
    state.categories = categories;
    render();
  }

  function renderPage(container) {
    pageRoot = container;
    closeDetail();
    void loadEdition();
  }

  function leavePage() {
    closeDetail();
    if (detailOverlay) {
      detailOverlay.remove();
      detailOverlay = null;
    }
    pageRoot = null;
    state.loading = false;
    state.error = "";
    state.edition = null;
    state.categories = [];
    state.selectedCategory = null;
    state.selectedIndex = -1;
  }

  window.Tour = {
    renderPage,
    leavePage
  };
})();
