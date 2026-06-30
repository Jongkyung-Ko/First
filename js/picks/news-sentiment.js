/**
 * Stock Picks — 뉴스 감성 전략 (시가총액 상위 10 · 최근 7일 호재·악재)
 */
(function () {
  const S = window.DwStockPicksShared;
  const R = window.DwStockPicksRenderer;
  if (!S || !R) return;

  const PICK_MARKETS = [
    { id: "kr_kospi", label: "KOSPI TOP 10" },
    { id: "kr_kosdaq", label: "KOSDAQ TOP 10" },
    { id: "us", label: "미국 TOP 10" }
  ];

  const PICK_UNIVERSE = {
    kr_kospi: [
      ["005930.KS", "삼성전자"],
      ["000660.KS", "SK하이닉스"],
      ["373220.KS", "LG에너지솔루션"],
      ["207940.KS", "삼성바이오로직스"],
      ["005380.KS", "현대차"],
      ["329180.KS", "HD현대중공업"],
      ["000270.KS", "기아"],
      ["105560.KS", "KB금융"],
      ["035420.KS", "NAVER"],
      ["055550.KS", "신한지주"]
    ],
    kr_kosdaq: [
      ["247540.KQ", "에코프로비엠"],
      ["196170.KQ", "알테오젠"],
      ["277810.KQ", "레인보우로보틱스"],
      ["086520.KQ", "에코프로"],
      ["403870.KQ", "HPSP"],
      ["141080.KQ", "레고켐바이오"],
      ["028300.KQ", "HLB"],
      ["145020.KQ", "휴젤"],
      ["214450.KQ", "파마리서치"],
      ["310210.KQ", "보로노이"]
    ],
    us: [
      ["AAPL", "Apple"],
      ["MSFT", "Microsoft"],
      ["NVDA", "NVIDIA"],
      ["GOOGL", "Alphabet"],
      ["AMZN", "Amazon"],
      ["META", "Meta"],
      ["TSLA", "Tesla"],
      ["AVGO", "Broadcom"],
      ["BRK-B", "Berkshire Hathaway"],
      ["LLY", "Eli Lilly"]
    ]
  };

  const PICKS_STORAGE_KEY = "dw_stock_picks_bundle_v2";
  const PICK_MARKET_IDS = PICK_MARKETS.map((m) => m.id);

  let picksBundleMemory = null;
  let picksAbortController = null;
  let picksSessionAutoLiveDone = false;
  let lastPicksUpdatedAt = null;

  function usesPicksApi() {
    return !!window.STOCK_PICKS_USE_API;
  }

  function usesLiveRefresh() {
    return window.STOCK_PICKS_LIVE_REFRESH !== false;
  }

  function getStaticPicksUrl(bust) {
    const path = window.STOCK_PICKS_JSON_URL || "data/stock-picks.json";
    const url = new URL(path, window.location.href);
    if (bust) url.searchParams.set("t", String(Date.now()));
    return url.href;
  }

  function readPicksCache() {
    try {
      const raw = localStorage.getItem(PICKS_STORAGE_KEY);
      if (!raw) return null;
      const bundle = JSON.parse(raw);
      if (!bundle?.markets || bundle.version < 2) return null;
      const sample = bundle.markets.kr_kospi?.items?.[0];
      if (sample && sample.newsWindowDays == null && !sample.bullishArticles?.length) {
        return null;
      }
      return bundle;
    } catch (_) {
      return null;
    }
  }

  function writePicksCache(bundle) {
    try {
      localStorage.setItem(PICKS_STORAGE_KEY, JSON.stringify(bundle));
    } catch (_) {
      /* storage full or disabled */
    }
  }

  function marketPayloadFromBundle(bundle, market) {
    return bundle?.markets?.[market] || null;
  }

  function showPicksResult(root, listEl, statusEl, data, bundle, sourceLabel, marketId) {
    const market = marketId;
    R.renderItems(listEl, data.items, market);
    if (typeof R.refreshAccuracySummary === "function") {
      void R.refreshAccuracySummary(listEl, data.items, market);
    }
    const updatedIso = bundle?.updatedAt;
    if (updatedIso) {
      lastPicksUpdatedAt = new Date(updatedIso);
      const updatedEl = root.querySelector("#stock-picks-last-updated");
      if (updatedEl) {
        updatedEl.textContent = `마지막 업데이트: ${S.formatLastUpdated(lastPicksUpdatedAt)}`;
        updatedEl.hidden = false;
      }
    }
    const title = data.segmentTitle ? `${data.segmentTitle} — ` : "";
    const recommendCount = (data.items || []).filter((i) => i.recommended).length;
    const schedule = bundle?.updateSchedule ? ` · ${bundle.updateSchedule}` : "";
    const windowLabel = data.newsWindowLabel || bundle?.newsWindowLabel || "최근 7일 뉴스 기준";
    S.setStatus(
      statusEl,
      `${title}${data.count}개 종목 (추천 ${recommendCount}개) · ${windowLabel} · ${sourceLabel}${schedule}`,
      "info"
    );
  }

  async function fetchStaticPicksBundle(bust) {
    const res = await fetch(getStaticPicksUrl(bust), { cache: bust ? "no-store" : "default" });
    if (!res.ok) {
      throw new Error(`스냅샷을 불러오지 못했습니다 (HTTP ${res.status})`);
    }
    const bundle = await res.json();
    picksBundleMemory = bundle;
    writePicksCache(bundle);
    return bundle;
  }

  async function fetchLivePicksBundle() {
    const base = S.getApiBase();
    if (!base) {
      throw new Error(
        "STOCK_API_URL이 설정되지 않았습니다. js/config.js에 Render 배포 URL을 넣거나 로컬 API(localhost:8000)를 사용하세요."
      );
    }

    if (picksAbortController) picksAbortController.abort();
    picksAbortController = new AbortController();
    const signal = picksAbortController.signal;

    await S.warmApi(base);

    const bundleUrl = `${base}/api/recommendations/bundle?limit=10&lang=ko`;
    try {
      const bundle = await S.fetchJsonWithRetry(bundleUrl, signal, { retries: 1, timeoutMs: 240000 });
      picksBundleMemory = bundle;
      writePicksCache(bundle);
      return bundle;
    } catch (err) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return fetchLivePicksBundleFallback(signal, err);
    }
  }

  async function fetchLivePicksBundleFallback(signal, bundleError) {
    const markets = {};
    let successCount = 0;
    let lastError = bundleError;

    for (const marketId of PICK_MARKET_IDS) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        markets[marketId] = await fetchLiveRecommendations(marketId, signal);
        successCount += 1;
      } catch (err) {
        lastError = err;
      }
    }

    if (!successCount) {
      throw lastError || bundleError || new Error("Failed to fetch recommendations");
    }

    const bundle = {
      version: 2,
      updatedAt: new Date().toISOString(),
      trigger: "live",
      updateSchedule: "방문·새로고침 시 실시간 분석",
      newsWindowDays: 7,
      newsWindowLabel: "최근 7일 뉴스 기준",
      markets
    };
    picksBundleMemory = bundle;
    writePicksCache(bundle);
    return bundle;
  }

  function mergeLiveMarketIntoBundle(market, data) {
    const bundle = {
      version: 2,
      updatedAt: new Date().toISOString(),
      trigger: "live",
      updateSchedule: "방문·새로고침 시 실시간 분석",
      newsWindowDays: data.newsWindowDays ?? picksBundleMemory?.newsWindowDays ?? 7,
      newsWindowLabel: data.newsWindowLabel ?? picksBundleMemory?.newsWindowLabel ?? "최근 7일 뉴스 기준",
      markets: {
        ...(picksBundleMemory?.markets || {}),
        [market]: data
      }
    };
    picksBundleMemory = bundle;
    writePicksCache(bundle);
    return bundle;
  }

  function showStaleFromBundle(root, listEl, statusEl, bundle, market, label) {
    const data = marketPayloadFromBundle(bundle, market);
    if (!data?.items?.length) {
      return false;
    }
    picksBundleMemory = bundle;
    showPicksResult(root, listEl, statusEl, data, bundle, label, market);
    return true;
  }

  async function fetchLiveRecommendations(market, externalSignal) {
    const base = S.getApiBase();
    if (!base) {
      throw new Error(
        "STOCK_API_URL이 설정되지 않았습니다. js/config.js에 Render 배포 URL을 넣거나 로컬 API(localhost:8000)를 사용하세요."
      );
    }

    let signal = externalSignal;
    if (!signal) {
      if (picksAbortController) picksAbortController.abort();
      picksAbortController = new AbortController();
      signal = picksAbortController.signal;
    }

    const url = `${base}/api/recommendations?market=${encodeURIComponent(market)}&limit=10&lang=ko`;
    if (!externalSignal) {
      await S.warmApi(base);
    }
    return S.fetchJsonWithRetry(url, signal, { retries: 2, timeoutMs: 180000 });
  }

  async function refreshPicksLive(root, listEl, statusEl, market) {
    const hadCards = !!listEl?.querySelector(".stock-pick-card");

    S.setUpdating(root, true, {
      message: hadCards
        ? "실시간 분석 중… 기존 목록은 그대로 보입니다. 잠시만 기다려 주세요. (최대 약 1분)"
        : "추천 종목을 불러오는 중… 잠시만 기다려 주세요. (최대 약 1분)"
    });
    if (!hadCards) {
      listEl.innerHTML = `<p class="stock-loading">실시간 분석 중…<br><span class="stock-loading-hint">Render 무료 서버 첫 요청은 최대 1분 걸릴 수 있습니다.</span></p>`;
      S.setStatus(statusEl, "", "");
    } else {
      S.setStatus(statusEl, "실시간 분석 중… (기존 데이터 유지)", "info");
    }

    try {
      const data = await fetchLiveRecommendations(market);
      if (data?.items?.length) {
        const bundle = mergeLiveMarketIntoBundle(market, data);
        showPicksResult(root, listEl, statusEl, data, bundle, "실시간 분석 완료", market);
      } else if (hadCards) {
        S.setStatus(
          statusEl,
          data?.error
            ? `실시간 분석 실패 — ${data.error} (기존 데이터 유지)`
            : "실시간 분석 결과가 비어 있습니다. 잠시 후 다시 시도해 주세요.",
          "error"
        );
      } else {
        listEl.innerHTML = `<p class="stock-empty">추천할 종목을 찾지 못했습니다. 잠시 후 새로고침해 보세요.</p>`;
        S.setStatus(statusEl, data?.error || "실시간 분석 결과가 비어 있습니다.", "error");
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      if (!hadCards) {
        listEl.innerHTML = "";
      }
      const message = hadCards
        ? `${S.formatFetchError(err, S.getApiBase())} (기존 데이터는 유지됩니다)`
        : S.formatFetchError(err, S.getApiBase());
      S.setStatus(statusEl, message, "error");
    } finally {
      S.setUpdating(root, false);
    }
  }

  async function load(ctx) {
    const { root, listEl, statusEl, market, forceRefresh, fromTab } = ctx;

    if (fromTab && picksBundleMemory) {
      const tabData = marketPayloadFromBundle(picksBundleMemory, market);
      if (tabData?.items?.length) {
        const label = picksBundleMemory.trigger === "live" ? "실시간 데이터" : "저장된 스냅샷";
        showPicksResult(root, listEl, statusEl, tabData, picksBundleMemory, label, market);
        return;
      }
    }

    if (forceRefresh) {
      if (S.isGuestMode()) {
        S.setStatus(statusEl, S.GUEST_REFRESH_MSG, "info");
        return;
      }
      await refreshPicksLive(root, listEl, statusEl, market);
      return;
    }

    let showedStale = false;
    const cachedBundle = picksBundleMemory || readPicksCache();
    if (cachedBundle) {
      const label = cachedBundle.trigger === "live" ? "저장된 데이터" : "이전 스냅샷";
      showedStale = showStaleFromBundle(root, listEl, statusEl, cachedBundle, market, label);
    }

    if (!showedStale) {
      S.setUpdating(root, true, {
        message: "스냅샷 데이터를 불러오는 중… 잠시만 기다려 주세요."
      });
      listEl.innerHTML = `<p class="stock-loading">추천 종목을 불러오는 중…</p>`;
      S.setStatus(statusEl, "", "");
      try {
        const staticBundle = await fetchStaticPicksBundle(false);
        showedStale = showStaleFromBundle(root, listEl, statusEl, staticBundle, market, "GitHub 스냅샷");
      } catch (_) {
        /* static snapshot optional */
      } finally {
        S.setUpdating(root, false);
      }
    }

    if (S.isGuestMode()) return;

    if (usesLiveRefresh()) {
      if (!picksSessionAutoLiveDone || !showedStale) {
        picksSessionAutoLiveDone = true;
        await refreshPicksLive(root, listEl, statusEl, market);
      }
    } else if (!showedStale && usesPicksApi()) {
      await refreshPicksLive(root, listEl, statusEl, market);
    }
  }

  function destroy() {
    if (picksAbortController) {
      picksAbortController.abort();
      picksAbortController = null;
    }
  }

  function onActivate() {
    picksSessionAutoLiveDone = false;
  }

  const strategy = {
    id: "news-sentiment",
    label: "뉴스 감성",
    description: "시가총액 상위 10종목 · 최근 7일 호재·악재 뉴스 분석",
    markets: PICK_MARKETS,
    defaultMarket: "kr_kospi",
    supportsLiveRefresh: true,
    load,
    destroy,
    onActivate
  };

  window.DwPickStrategies = window.DwPickStrategies || [];
  window.DwPickStrategies.push(strategy);
})();
