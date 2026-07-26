#!/usr/bin/env node
/**
 * Build candle-support snapshot (TOP 100 × 4 markets) via Yahoo Finance chart API.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "stock-strategy-candle-support.json");

const SUPPORT_TOLERANCE_PCT = 2.0;
const ROLLING_LOW_DAYS = 20;
const RECENT_DAYS = 14;
const UNIVERSE_LIMIT = 100;

function parseUniverse(pyFile, varName) {
  const text = fs.readFileSync(pyFile, "utf8");
  const start = text.indexOf(`${varName}:`);
  if (start < 0) throw new Error(`Missing ${varName} in ${pyFile}`);
  const slice = text.slice(start);
  const end = slice.indexOf("\n\n");
  const block = end > 0 ? slice.slice(0, end) : slice;
  const re = /\("([^"]+)",\s*"([^"]*)"\)/g;
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push([m[1], m[2]]);
  return out.slice(0, UNIVERSE_LIMIT);
}

function sma(values, period) {
  const out = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const w = values.slice(i - period + 1, i + 1);
    if (w.some((v) => v == null)) continue;
    out[i] = w.reduce((a, b) => a + b, 0) / period;
  }
  return out;
}

function pctChange(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr / prev) - 1) * 100;
}

function candleParts(c) {
  const o = c.open,
    h = c.high,
    l = c.low,
    cl = c.close;
  if ([o, h, l, cl].some((v) => v == null)) return null;
  const range = h - l;
  if (range <= 0) return null;
  const body = Math.abs(cl - o);
  if (body <= 0) return null;
  return {
    open: o,
    high: h,
    low: l,
    close: cl,
    body,
    lowerShadow: Math.min(o, cl) - l,
    upperShadow: h - Math.max(o, cl),
    bullish: cl > o,
    bearish: cl < o
  };
}

function nearSupport(low, ref, tol = SUPPORT_TOLERANCE_PCT) {
  if (ref <= 0) return false;
  const band = ref * (tol / 100);
  return low >= ref - band && low <= ref + band;
}

function rollingLow(candles, end, days) {
  const start = Math.max(0, end - days + 1);
  const lows = candles.slice(start, end + 1).map((c) => c.low).filter((v) => v != null);
  return lows.length ? Math.min(...lows) : null;
}

function resolveSupport(candles, i, sma20, sma60) {
  const low = candles[i].low;
  if (low == null) return null;
  const roll = rollingLow(candles, i, ROLLING_LOW_DAYS);
  if (roll != null && nearSupport(low, roll)) return "20일저점";
  if (sma20[i] != null && nearSupport(low, sma20[i])) return "SMA20";
  if (sma60[i] != null && nearSupport(low, sma60[i])) return "SMA60";
  return null;
}

function isHammer(c) {
  const p = candleParts(c);
  if (!p) return false;
  return p.lowerShadow >= p.body * 2 && p.upperShadow <= p.body * 0.5 && p.lowerShadow >= p.upperShadow;
}

function isBullishEngulfing(prev, curr) {
  const p = candleParts(prev);
  const c = candleParts(curr);
  if (!p || !c || !p.bearish || !c.bullish) return false;
  return c.open <= p.close && c.close >= p.open;
}

function isMorningStar(d0, d1, d2) {
  const p0 = candleParts(d0);
  const p1 = candleParts(d1);
  const p2 = candleParts(d2);
  if (!p0 || !p1 || !p2 || !p0.bearish || !p2.bullish) return false;
  if (p1.body > p0.body * 0.55) return false;
  const mid = (p0.open + p0.close) / 2;
  return p2.close > mid;
}

const PATTERN_LABELS = {
  hammer: "망치형",
  morning_star: "샛별형",
  bullish_engulfing: "상승 장악형"
};

function attachFollowUp(sig, candles, i) {
  if (i + 1 >= candles.length) return;
  const c0 = candles[i].close;
  const c1 = candles[i + 1].close;
  if (c0 == null || c1 == null || c0 === 0) return;
  const ret = ((c1 / c0) - 1) * 100;
  sig.nextDate = candles[i + 1].time;
  sig.nextClose = c1;
  sig.dayReturnPct = Math.round(ret * 10000) / 10000;
  sig.directionMatch = ret > 0 ? "일치" : "불일치";
}

function detectSignals(ticker, name, candles, market, currency) {
  if (candles.length < 62) return [];
  const closes = candles.map((c) => c.close);
  const sma20 = sma(closes, 20);
  const sma60 = sma(closes, 60);
  const signals = [];

  for (let i = 60; i < candles.length; i++) {
    const support = resolveSupport(candles, i, sma20, sma60);
    if (!support) continue;
    const patterns = [];
    if (isHammer(candles[i])) patterns.push("hammer");
    if (i >= 1 && isBullishEngulfing(candles[i - 1], candles[i])) patterns.push("bullish_engulfing");
    if (i >= 2 && isMorningStar(candles[i - 2], candles[i - 1], candles[i])) patterns.push("morning_star");
    for (const pattern of patterns) {
      const closePct = pctChange(candles[i].close, candles[i - 1].close);
      if (closePct == null || closePct === 0) continue;
      const sig = {
        market,
        currency,
        pattern,
        patternLabel: PATTERN_LABELS[pattern],
        supportType: support,
        ticker,
        name,
        signalDate: candles[i].time,
        close: candles[i].close,
        closePct: Math.round(closePct * 10000) / 10000,
        up: closePct > 0
      };
      if (sma20[i] != null) sig.sma20 = Math.round(sma20[i] * 10000) / 10000;
      if (sma60[i] != null) sig.sma60 = Math.round(sma60[i] * 10000) / 10000;
      attachFollowUp(sig, candles, i);
      signals.push(sig);
    }
  }
  return signals;
}

async function fetchCandles(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=6mo`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DigitalWorld/1.0)" }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const q = result?.indicators?.quote?.[0] || {};
  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = q.close?.[i];
    if (close == null) continue;
    const d = new Date(timestamps[i] * 1000);
    candles.push({
      time: d.toISOString().slice(0, 10),
      open: q.open?.[i] ?? close,
      high: q.high?.[i] ?? close,
      low: q.low?.[i] ?? close,
      close,
      volume: q.volume?.[i] ?? 0
    });
  }
  return candles;
}

function computeMatchStats(signals) {
  let match = 0,
    mismatch = 0,
    pending = 0;
  for (const s of signals) {
    if (s.directionMatch === "일치") match++;
    else if (s.directionMatch === "불일치") mismatch++;
    else pending++;
  }
  const evaluated = match + mismatch;
  const ratePct = evaluated > 0 ? (match / evaluated) * 100 : null;
  return { match, mismatch, pending, total: signals.length, evaluated, ratePct };
}

async function poolMap(items, limit, fn) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function scanMarket(universe, marketId, currency) {
  const allSignals = [];
  const errors = [];
  const candleEnds = [];

  await poolMap(universe, 6, async ([ticker, name]) => {
    try {
      const candles = await fetchCandles(ticker);
      if (candles.length) candleEnds.push(candles[candles.length - 1].time);
      allSignals.push(...detectSignals(ticker, name, candles, marketId, currency));
    } catch (e) {
      errors.push(`${ticker}: ${e.message}`);
    }
  });

  allSignals.sort((a, b) => `${a.signalDate}${a.ticker}`.localeCompare(`${b.signalDate}${b.ticker}`));
  const analysisDate = candleEnds.length ? candleEnds.sort().at(-1) : null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const activeSignals = allSignals.filter((s) => s.signalDate === analysisDate);
  const recentSignals = allSignals.filter((s) => s.signalDate >= cutoffStr);

  return {
    id: marketId,
    title: `${marketId.toUpperCase()} TOP ${UNIVERSE_LIMIT}`,
    analysisDate,
    latestSignalDate: analysisDate,
    activeSignals,
    activeDisplayDate: analysisDate,
    activeIsFallback: false,
    recentSignals,
    matchStats: computeMatchStats(recentSignals),
    activeCount: activeSignals.length,
    recentCount: recentSignals.length,
    recentDays: RECENT_DAYS,
    scanErrors: errors.slice(0, 5),
    universeSize: universe.length,
    currency
  };
}

async function main() {
  const kospi = parseUniverse(path.join(ROOT, "backend", "kr_market_universes.py"), "KOSPI_TOP_100");
  const kosdaq = parseUniverse(path.join(ROOT, "backend", "kr_market_universes.py"), "KOSDAQ_TOP_100");
  const nasdaq = parseUniverse(path.join(ROOT, "backend", "us_market_universes.py"), "NASDAQ_TOP_100");
  const nyse = parseUniverse(path.join(ROOT, "backend", "us_market_universes.py"), "NYSE_TOP_100");

  console.log("Scanning candle-support markets...");
  const markets = {
    kospi: await scanMarket(kospi, "kospi", "KRW"),
    kosdaq: await scanMarket(kosdaq, "kosdaq", "KRW"),
    nasdaq: await scanMarket(nasdaq, "nasdaq", "USD"),
    nyse: await scanMarket(nyse, "nyse", "USD")
  };

  const now = new Date();
  const payload = {
    version: 1,
    strategyId: "candle-support",
    source: "snapshot",
    savedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    updatedAtNy: now.toISOString(),
    displayTimezone: "America/New_York",
    updateSchedule:
      "KOSPI·KOSDAQ 18:00 KST · NASDAQ·NYSE 18:00 뉴욕(ET) · 갱신 시각은 뉴욕 기준 표시",
    universe: `KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP ${UNIVERSE_LIMIT}`,
    strategy: {
      id: "candle-support",
      title: "지지+반전캔들",
      universe: `KOSPI·KOSDAQ·NASDAQ·NYSE 각 TOP ${UNIVERSE_LIMIT}`
    },
    recentDays: RECENT_DAYS,
    markets,
    activeSignals: [...markets.kospi.activeSignals, ...markets.kosdaq.activeSignals, ...markets.nasdaq.activeSignals, ...markets.nyse.activeSignals],
    activeCount:
      markets.kospi.activeCount +
      markets.kosdaq.activeCount +
      markets.nasdaq.activeCount +
      markets.nyse.activeCount,
    analysisDate: markets.kospi.analysisDate
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log("\n=== 최근 2주 일치율 ===");
  for (const key of ["kospi", "kosdaq", "nasdaq", "nyse"]) {
    const st = markets[key].matchStats;
    const rate = st.ratePct != null ? `${st.ratePct.toFixed(1)}%` : "—";
    console.log(
      `${key.toUpperCase()}: 일치 ${st.match} · 불일치 ${st.mismatch} · 일치율 ${rate} · 신호 ${st.total}건 (판정대기 ${st.pending})`
    );
  }
  console.log(`\nWrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
