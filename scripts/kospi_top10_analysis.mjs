#!/usr/bin/env node
/** KOSPI TOP 10 — 최근 2개월 지표 전일 대비 등락비율(A안) CSV */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const API_BASE = (process.env.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
const OUTPUT_MONTHS = 2;
const CUTOFF = new Date();
CUTOFF.setUTCDate(CUTOFF.getUTCDate() - OUTPUT_MONTHS * 31);
CUTOFF.setUTCHours(0, 0, 0, 0);

const KOSPI_TOP_10 = [
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
];

const HEADERS = [
  "종목코드",
  "종목명",
  "일자",
  "종가",
  "SMA5_등락비율",
  "SMA20_등락비율",
  "SMA60_등락비율",
  "BB상_등락비율",
  "BB중_등락비율",
  "BB하_등락비율",
  "RSI_등락비율",
  "MACD_등락비율"
];

function pctChange(curr, prev) {
  if (curr == null || prev == null || prev === 0) return "";
  return (((curr / prev) - 1) * 100).toFixed(4);
}

function sma(closes, period) {
  const out = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i += 1) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j += 1) sum += closes[j];
    out[i] = sum / period;
  }
  return out;
}

function bollinger(closes, period = 20, mult = 2) {
  const upper = new Array(closes.length).fill(null);
  const middle = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i += 1) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j += 1) sum += closes[j];
    const mean = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j += 1) variance += (closes[j] - mean) ** 2;
    const std = Math.sqrt(variance / period);
    middle[i] = mean;
    upper[i] = mean + mult * std;
    lower[i] = mean - mult * std;
  }
  return { upper, middle, lower };
}

function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  out[period] = 100 - 100 / (1 + rs);
  for (let i = period + 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

function emaArray(data, period) {
  const arr = new Array(data.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < data.length; i += 1) {
    if (i < period - 1) continue;
    if (prev == null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j += 1) sum += data[j];
      prev = sum / period;
    } else {
      prev = data[i] * k + prev * (1 - k);
    }
    arr[i] = prev;
  }
  return arr;
}

function macdLine(closes) {
  const out = new Array(closes.length).fill(null);
  const fast = emaArray(closes, 12);
  const slow = emaArray(closes, 26);
  const macdIdx = [];
  const macdVals = [];
  for (let i = 0; i < closes.length; i += 1) {
    if (fast[i] != null && slow[i] != null) {
      macdIdx.push(i);
      macdVals.push(fast[i] - slow[i]);
    }
  }
  const signalPeriod = 9;
  const k = 2 / (signalPeriod + 1);
  let sigPrev = null;
  for (let j = 0; j < macdVals.length; j += 1) {
    if (j < signalPeriod - 1) continue;
    const val = macdVals[j];
    if (sigPrev == null) {
      let sum = 0;
      for (let x = j - signalPeriod + 1; x <= j; x += 1) sum += macdVals[x];
      sigPrev = sum / signalPeriod;
    } else {
      sigPrev = val * k + sigPrev * (1 - k);
    }
    out[macdIdx[j]] = val;
  }
  return out;
}

async function fetchCandles(ticker) {
  const url = `${API_BASE}/api/chart?ticker=${encodeURIComponent(ticker)}&period=3mo&interval=1d`;
  const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`${ticker} HTTP ${res.status}`);
  const data = await res.json();
  return data.candles || [];
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildRows(ticker, name, candles) {
  const dates = candles.map((c) => new Date(`${c.time}T00:00:00Z`));
  const closes = candles.map((c) => c.close);
  const sma5 = sma(closes, 5);
  const sma20 = sma(closes, 20);
  const sma60 = sma(closes, 60);
  const bb = bollinger(closes, 20, 2);
  const rsiVals = rsi(closes, 14);
  const macdVals = macdLine(closes);
  const rows = [];

  for (let i = 0; i < dates.length; i += 1) {
    if (dates[i] < CUTOFF) continue;
    const prev = i - 1;
    rows.push({
      종목코드: ticker,
      종목명: name,
      일자: candles[i].time,
      종가: closes[i].toFixed(4),
      SMA5_등락비율: pctChange(sma5[i], prev >= 0 ? sma5[prev] : null),
      SMA20_등락비율: pctChange(sma20[i], prev >= 0 ? sma20[prev] : null),
      SMA60_등락비율: pctChange(sma60[i], prev >= 0 ? sma60[prev] : null),
      BB상_등락비율: pctChange(bb.upper[i], prev >= 0 ? bb.upper[prev] : null),
      BB중_등락비율: pctChange(bb.middle[i], prev >= 0 ? bb.middle[prev] : null),
      BB하_등락비율: pctChange(bb.lower[i], prev >= 0 ? bb.lower[prev] : null),
      RSI_등락비율: pctChange(rsiVals[i], prev >= 0 ? rsiVals[prev] : null),
      MACD_등락비율: pctChange(macdVals[i], prev >= 0 ? macdVals[prev] : null)
    });
  }
  return rows;
}

async function main() {
  const allRows = [];
  for (const [ticker, name] of KOSPI_TOP_10) {
    process.stdout.write(`Fetching ${ticker} ${name}...\n`);
    const candles = await fetchCandles(ticker);
    const rows = buildRows(ticker, name, candles);
    process.stdout.write(`  -> ${rows.length} rows\n`);
    allRows.push(...rows);
  }

  allRows.sort((a, b) => (a.종목코드 === b.종목코드 ? a.일자.localeCompare(b.일자) : a.종목코드.localeCompare(b.종목코드)));

  const lines = ["\uFEFF" + HEADERS.map(csvEscape).join(",")];
  for (const row of allRows) {
    lines.push(HEADERS.map((h) => csvEscape(row[h])).join(","));
  }

  const outDir = path.join(ROOT, "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "kospi-top10-analysis.csv");
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  process.stdout.write(`Wrote ${outPath} (${allRows.length} rows, since ${CUTOFF.toISOString().slice(0, 10)})\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
