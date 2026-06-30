#!/usr/bin/env node
/**
 * KOSPI TOP50 — 바닥매집 SMA5 패턴 비교 (6개월)
 *
 * 공통: T-2·T-1 거래량 전일 대비 +10%~+30% 연속 2일
 * T일 = 신호일, T일 종가 등락률 측정
 *
 * 패턴A — SMA5_연속2일하락: T-2·T-1 모두 SMA5 등락비율 < 0
 * 패턴B — SMA5_하락후반등: T-2 SMA5 < 0, T-1 SMA5 > 0
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const API_BASE = (process.env.STOCK_API_URL || "https://first-stock-api.onrender.com").replace(/\/$/, "");
const OUTPUT_MONTHS = 6;
const CUTOFF = new Date();
CUTOFF.setUTCDate(CUTOFF.getUTCDate() - OUTPUT_MONTHS * 31);
CUTOFF.setUTCHours(0, 0, 0, 0);

const VOL_MIN = 10;
const VOL_MAX = 30;

const KOSPI_TOP_50 = [
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
  ["000810.KS", "삼성화재"],
  ["011070.KS", "LG이노텍"],
  ["006800.KS", "미래에셋증권"],
  ["010130.KS", "고려아연"],
  ["000150.KS", "두산"],
  ["015760.KS", "한국전력"],
  ["051910.KS", "LG화학"],
  ["010140.KS", "삼성중공업"],
  ["064350.KS", "현대로템"],
  ["316140.KS", "우리금융지주"],
  ["017670.KS", "SK텔레콤"],
  ["079550.KS", "LIG넥스원"],
  ["011200.KS", "HMM"],
  ["267250.KS", "HD현대"],
  ["272210.KS", "한화시스템"],
  ["033780.KS", "KT&G"],
  ["138040.KS", "메리츠금융지주"],
  ["307950.KS", "현대오토에버"],
  ["003670.KS", "포스코퓨처엠"],
  ["047810.KS", "한국항공우주"],
  ["010950.KS", "S-Oil"]
];

const SIGNAL_HEADERS = [
  "패턴",
  "종목코드",
  "종목명",
  "신호일",
  "T-2일",
  "T-1일",
  "T-2_거래량등락",
  "T-1_거래량등락",
  "T-2_SMA5등락",
  "T-1_SMA5등락",
  "신호일_종가등락비율",
  "신호일_상승여부"
];

const COMPARE_HEADERS = [
  "패턴",
  "설명",
  "신호건수",
  "상승건수",
  "하락건수",
  "상승비율",
  "평균종가등락",
  "상승일평균",
  "하락일평균"
];

function pctChange(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr / prev) - 1) * 100;
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

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, headers, rows) {
  const lines = ["\uFEFF" + headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

async function fetchCandles(ticker) {
  const url = `${API_BASE}/api/chart?ticker=${encodeURIComponent(ticker)}&period=6mo&interval=1d`;
  const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`${ticker} HTTP ${res.status}`);
  const data = await res.json();
  return data.candles || [];
}

function buildDailySeries(candles) {
  const series = [];
  for (let i = 0; i < candles.length; i += 1) {
    const date = new Date(`${candles[i].time}T00:00:00Z`);
    if (date < CUTOFF) continue;
    series.push({
      date: candles[i].time,
      index: i
    });
  }

  const allCloses = candles.map((c) => c.close);
  const allVolumes = candles.map((c) => (c.volume != null ? Number(c.volume) : null));
  const sma5All = sma(allCloses, 5);

  for (const row of series) {
    const i = row.index;
    const prev = i - 1;
    row.volPct = pctChange(allVolumes[i], prev >= 0 ? allVolumes[prev] : null);
    row.sma5Pct = pctChange(sma5All[i], prev >= 0 ? sma5All[prev] : null);
    row.closePct = prev >= 0 ? pctChange(allCloses[i], allCloses[prev]) : null;
  }
  return series;
}

function volInBand(day) {
  return day.volPct != null && day.volPct >= VOL_MIN && day.volPct < VOL_MAX;
}

function detectPatterns(series) {
  const patternA = [];
  const patternB = [];

  for (let i = 2; i < series.length; i += 1) {
    const d2 = series[i - 2];
    const d1 = series[i - 1];
    const dt = series[i];

    if (!volInBand(d2) || !volInBand(d1)) continue;
    if (dt.closePct == null || dt.closePct === 0) continue;
    if (d2.sma5Pct == null || d1.sma5Pct == null) continue;

    const base = {
      signalDate: dt.date,
      day2: d2.date,
      day1: d1.date,
      vol2: d2.volPct,
      vol1: d1.volPct,
      sma5_2: d2.sma5Pct,
      sma5_1: d1.sma5Pct,
      closePct: dt.closePct,
      up: dt.closePct > 0
    };

    if (d2.sma5Pct < 0 && d1.sma5Pct < 0) {
      patternA.push(base);
    } else if (d2.sma5Pct < 0 && d1.sma5Pct > 0) {
      patternB.push(base);
    }
  }

  return { patternA, patternB };
}

function toRow(pattern, ticker, name, s) {
  return {
    패턴: pattern,
    종목코드: ticker,
    종목명: name,
    신호일: s.signalDate,
    "T-2일": s.day2,
    "T-1일": s.day1,
    "T-2_거래량등락": s.vol2.toFixed(4),
    "T-1_거래량등락": s.vol1.toFixed(4),
    "T-2_SMA5등락": s.sma5_2.toFixed(4),
    "T-1_SMA5등락": s.sma5_1.toFixed(4),
    신호일_종가등락비율: s.closePct.toFixed(4),
    신호일_상승여부: s.up ? "상승" : "하락"
  };
}

function summarize(pattern, desc, signals) {
  const n = signals.length;
  const up = signals.filter((s) => s.up).length;
  const down = n - up;
  const sum = signals.reduce((a, s) => a + s.closePct, 0);
  const upSum = signals.filter((s) => s.up).reduce((a, s) => a + s.closePct, 0);
  const downSum = signals.filter((s) => !s.up).reduce((a, s) => a + s.closePct, 0);
  return {
    패턴: pattern,
    설명: desc,
    신호건수: String(n),
    상승건수: String(up),
    하락건수: String(down),
    상승비율: n ? `${((up / n) * 100).toFixed(1)}%` : "",
    평균종가등락: n ? `${(sum / n).toFixed(2)}%` : "",
    상승일평균: up ? `${(upSum / up).toFixed(2)}%` : "",
    하락일평균: down ? `${(downSum / down).toFixed(2)}%` : ""
  };
}

async function main() {
  const allA = [];
  const allB = [];
  const rawA = [];
  const rawB = [];

  for (const [ticker, name] of KOSPI_TOP_50) {
    process.stdout.write(`Fetching ${ticker} ${name}...\n`);
    const candles = await fetchCandles(ticker);
    const series = buildDailySeries(candles);
    const { patternA, patternB } = detectPatterns(series);
    process.stdout.write(`  -> A:${patternA.length} B:${patternB.length}\n`);

    for (const s of patternA) {
      rawA.push(s);
      allA.push(toRow("A_SMA5연속2일하락", ticker, name, s));
    }
    for (const s of patternB) {
      rawB.push(s);
      allB.push(toRow("B_SMA5하락후반등", ticker, name, s));
    }
  }

  const compare = [
    summarize(
      "A",
      "거래량+10~30% 2일 + SMA5 T-2·T-1 모두 하락 → T일",
      rawA
    ),
    summarize(
      "B",
      "거래량+10~30% 2일 + SMA5 T-2 하락·T-1 상승전환 → T일",
      rawB
    )
  ];

  const signals = [...allA, ...allB].sort((a, b) =>
    a.신호일 === b.신호일 ? a.종목코드.localeCompare(b.종목코드) : a.신호일.localeCompare(b.신호일)
  );

  const outDir = path.join(ROOT, "data");
  fs.mkdirSync(outDir, { recursive: true });
  writeCsv(path.join(outDir, "kospi-top50-sma5-pattern-signals.csv"), SIGNAL_HEADERS, signals);
  writeCsv(path.join(outDir, "kospi-top50-sma5-pattern-compare.csv"), COMPARE_HEADERS, compare);

  process.stdout.write("\n=== 비교 요약 ===\n");
  for (const row of compare) {
    process.stdout.write(
      `${row.패턴} ${row.설명}\n  ${row.신호건수}건 | 상승 ${row.상승비율} | 평균 ${row.평균종가등락}\n`
    );
  }
  process.stdout.write("Wrote data/kospi-top50-sma5-pattern-*.csv\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
