#!/usr/bin/env node
/** KOSPI TOP 30 — 최근 2개월 지표 등락비율(A안) + 전일 지표 vs 당일 종가 일치율 */

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

const KOSPI_TOP_30 = [
  ["005930.KS", "삼성전자"],
  ["000660.KS", "SK하이닉스"],
  ["402340.KS", "SK스퀘어"],
  ["009150.KS", "삼성전기"],
  ["005380.KS", "현대차"],
  ["373220.KS", "LG에너지솔루션"],
  ["032830.KS", "삼성생명"],
  ["028260.KS", "삼성물산"],
  ["329180.KS", "HD현대중공업"],
  ["034020.KS", "두산에너빌리티"],
  ["000270.KS", "기아"],
  ["207940.KS", "삼성바이오로직스"],
  ["012450.KS", "한화에어로스페이스"],
  ["105560.KS", "KB금융"],
  ["012330.KS", "현대모비스"],
  ["034730.KS", "SK"],
  ["055550.KS", "신한지주"],
  ["006400.KS", "삼성SDI"],
  ["042660.KS", "한화오션"],
  ["267260.KS", "HD현대일렉트릭"],
  ["068270.KS", "셀트리온"],
  ["010120.KS", "LS ELECTRIC"],
  ["035420.KS", "NAVER"],
  ["066570.KS", "LG전자"],
  ["298040.KS", "효성중공업"],
  ["086790.KS", "하나금융지주"],
  ["009540.KS", "HD한국조선해양"],
  ["005490.KS", "POSCO홀딩스"],
  ["042700.KS", "한미반도체"],
  ["000810.KS", "삼성화재"]
];

const INDICATOR_COLS = [
  "SMA5_등락비율",
  "SMA20_등락비율",
  "SMA60_등락비율",
  "BB상_등락비율",
  "BB중_등락비율",
  "BB하_등락비율",
  "RSI_등락비율",
  "MACD_등락비율",
  "거래량_등락비율"
];

const HEADERS = [
  "종목코드",
  "종목명",
  "일자",
  "종가",
  "종가_등락비율",
  "종가_방향",
  ...INDICATOR_COLS,
  ...INDICATOR_COLS.flatMap((col) => {
    const base = col.replace("_등락비율", "");
    return [`${base}_전일방향`, `${base}_종가일치`];
  })
];

const SUMMARY_HEADERS = [
  "종목코드",
  "종목명",
  ...INDICATOR_COLS.map((col) => `${col.replace("_등락비율", "")}_일치율`),
  "전체지표동시일치율",
  "비교가능일수"
];

function pctChange(curr, prev) {
  if (curr == null || prev == null || prev === 0) return "";
  return (((curr / prev) - 1) * 100).toFixed(4);
}

function parsePct(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function directionLabel(value) {
  const n = parsePct(value);
  if (n == null) return "";
  if (n > 0) return "상승";
  if (n < 0) return "하락";
  return "보합";
}

function directionSign(value) {
  const n = parsePct(value);
  if (n == null) return null;
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
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
  const volumes = candles.map((c) => (c.volume != null ? Number(c.volume) : null));
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
    const row = {
      종목코드: ticker,
      종목명: name,
      일자: candles[i].time,
      종가: closes[i].toFixed(4),
      종가_등락비율: pctChange(closes[i], prev >= 0 ? closes[prev] : null),
      종가_방향: "",
      SMA5_등락비율: pctChange(sma5[i], prev >= 0 ? sma5[prev] : null),
      SMA20_등락비율: pctChange(sma20[i], prev >= 0 ? sma20[prev] : null),
      SMA60_등락비율: pctChange(sma60[i], prev >= 0 ? sma60[prev] : null),
      BB상_등락비율: pctChange(bb.upper[i], prev >= 0 ? bb.upper[prev] : null),
      BB중_등락비율: pctChange(bb.middle[i], prev >= 0 ? bb.middle[prev] : null),
      BB하_등락비율: pctChange(bb.lower[i], prev >= 0 ? bb.lower[prev] : null),
      RSI_등락비율: pctChange(rsiVals[i], prev >= 0 ? rsiVals[prev] : null),
      MACD_등락비율: pctChange(macdVals[i], prev >= 0 ? macdVals[prev] : null),
      거래량_등락비율: pctChange(volumes[i], prev >= 0 ? volumes[prev] : null)
    };
    row.종가_방향 = directionLabel(row.종가_등락비율);
    rows.push(row);
  }
  return rows;
}

function enrichMatchColumns(rows) {
  for (let i = 1; i < rows.length; i += 1) {
    const prevRow = rows[i - 1];
    const closeDir = directionSign(rows[i].종가_등락비율);
    for (const col of INDICATOR_COLS) {
      const base = col.replace("_등락비율", "");
      const prevDirCol = `${base}_전일방향`;
      const matchCol = `${base}_종가일치`;
      const prevSign = directionSign(prevRow[col]);
      rows[i][prevDirCol] = directionLabel(prevRow[col]);
      if (closeDir == null || closeDir === 0 || prevSign == null || prevSign === 0) {
        rows[i][matchCol] = "";
      } else {
        rows[i][matchCol] = closeDir === prevSign ? "1" : "0";
      }
    }
  }
  for (const col of INDICATOR_COLS) {
    const base = col.replace("_등락비율", "");
    rows[0][`${base}_전일방향`] = "";
    rows[0][`${base}_종가일치`] = "";
  }
}

function buildSummary(rowsByCode) {
  const summary = [];
  for (const [code, rows] of rowsByCode) {
    const item = { 종목코드: code, 종목명: rows[0].종목명 };
    let allMatch = 0;
    let allTotal = 0;

    for (const col of INDICATOR_COLS) {
      const base = col.replace("_등락비율", "");
      const matchCol = `${base}_종가일치`;
      let matched = 0;
      let total = 0;
      for (const row of rows) {
        if (row[matchCol] === "1") {
          matched += 1;
          total += 1;
        } else if (row[matchCol] === "0") {
          total += 1;
        }
      }
      item[`${base}_일치율`] = total ? `${((matched / total) * 100).toFixed(1)}%` : "";
    }

    for (const row of rows) {
      const flags = INDICATOR_COLS.map((col) => row[`${col.replace("_등락비율", "")}_종가일치`]);
      const comparable = flags.filter((f) => f === "1" || f === "0");
      if (!comparable.length) continue;
      allTotal += 1;
      if (comparable.every((f) => f === "1")) allMatch += 1;
    }

    item.전체지표동시일치율 = allTotal ? `${((allMatch / allTotal) * 100).toFixed(1)}%` : "";
    item.비교가능일수 = String(allTotal);
    summary.push(item);
  }
  summary.sort((a, b) => a.종목코드.localeCompare(b.종목코드));
  return summary;
}

function writeCsv(filePath, headers, rows) {
  const lines = ["\uFEFF" + headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

async function main() {
  const allRows = [];
  const rowsByCode = new Map();

  for (const [ticker, name] of KOSPI_TOP_30) {
    process.stdout.write(`Fetching ${ticker} ${name}...\n`);
    const candles = await fetchCandles(ticker);
    const rows = buildRows(ticker, name, candles);
    enrichMatchColumns(rows);
    process.stdout.write(`  -> ${rows.length} rows\n`);
    allRows.push(...rows);
    rowsByCode.set(ticker, rows);
  }

  allRows.sort((a, b) => (a.종목코드 === b.종목코드 ? a.일자.localeCompare(b.일자) : a.종목코드.localeCompare(b.종목코드)));

  const outDir = path.join(ROOT, "data");
  fs.mkdirSync(outDir, { recursive: true });
  const analysisPath = path.join(outDir, "kospi-top30-analysis.csv");
  const summaryPath = path.join(outDir, "kospi-top30-match-summary.csv");
  const summary = buildSummary(rowsByCode);

  writeCsv(analysisPath, HEADERS, allRows);
  writeCsv(summaryPath, SUMMARY_HEADERS, summary);

  process.stdout.write(`Wrote ${analysisPath} (${allRows.length} rows)\n`);
  process.stdout.write(`Wrote ${summaryPath} (${summary.length} stocks)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
