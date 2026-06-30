#!/usr/bin/env node
/**
 * KOSPI TOP50 — 바닥매집 신호 분석 (6개월)
 *
 * 신호 조건 (T일 = 매집 신호일 / 분석 대상일):
 *   - T-2, T-1 … 연속 N일 (N≥2): 거래량 전일 대비 +15%~+30%, SMA5 등락비율 < 0
 *   - T-1 시점에서 위 연속 구간 길이 ≥ 2 (2일 이상)
 *   - T일 종가 등락률로 신호 후 수익 측정
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

const VOL_MIN = 15;
const VOL_MAX = 30;
const MIN_STREAK = 2;

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
  "종목코드",
  "종목명",
  "매집신호일",
  "연속일수",
  "구간시작일",
  "구간종료일",
  "신호일_종가등락비율",
  "신호일_상승여부",
  "구간1일차_거래량등락",
  "구간2일차_거래량등락",
  "구간종료_거래량등락",
  "구간종료_SMA5등락"
];

const SUMMARY_HEADERS = [
  "종목코드",
  "종목명",
  "분석거래일수",
  "매집신호횟수",
  "신호후_상승비율",
  "신호후_평균종가등락",
  "신호후_상승일평균",
  "신호후_하락일평균",
  "연속2일만",
  "연속3일이상"
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
      close: candles[i].close,
      volume: candles[i].volume != null ? Number(candles[i].volume) : null,
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
    row.closePct =
      prev >= 0 ? pctChange(allCloses[i], allCloses[prev]) : null;
  }
  return series;
}

function qualifies(day) {
  if (day.volPct == null || day.sma5Pct == null) return false;
  return day.volPct >= VOL_MIN && day.volPct < VOL_MAX && day.sma5Pct < 0;
}

function streakLen(series, endIdx) {
  let len = 0;
  for (let j = endIdx; j >= 0; j -= 1) {
    if (!qualifies(series[j])) break;
    len += 1;
  }
  return len;
}

/** T일 신호: T-1까지 연속 구간 ≥ MIN_STREAK, 첫 신호만(구간 길이 정확히 2로 막 시작) 옵션은 dedupeFirst */
function detectSignals(series, dedupeFirst = false) {
  const signals = [];
  for (let i = MIN_STREAK; i < series.length; i += 1) {
    const streak = streakLen(series, i - 1);
    if (streak < MIN_STREAK) continue;
    if (dedupeFirst && streakLen(series, i - 2) >= MIN_STREAK) continue;

    const closePct = series[i].closePct;
    if (closePct == null || closePct === 0) continue;

    const startIdx = i - streak;
    signals.push({
      signalDate: series[i].date,
      streakDays: streak,
      rangeStart: series[startIdx].date,
      rangeEnd: series[i - 1].date,
      closePct,
      up: closePct > 0,
      vol1: series[startIdx].volPct,
      vol2: streak >= 2 ? series[startIdx + 1].volPct : null,
      volEnd: series[i - 1].volPct,
      sma5End: series[i - 1].sma5Pct
    });
  }
  return signals;
}

function summarizeStock(ticker, name, series, signals) {
  const up = signals.filter((s) => s.up).length;
  const n = signals.length;
  const sum = signals.reduce((a, s) => a + s.closePct, 0);
  const upSum = signals.filter((s) => s.up).reduce((a, s) => a + s.closePct, 0);
  const downSum = signals.filter((s) => !s.up).reduce((a, s) => a + s.closePct, 0);
  const downN = n - up;
  return {
    종목코드: ticker,
    종목명: name,
    분석거래일수: String(series.length),
    매집신호횟수: String(n),
    신호후_상승비율: n ? `${((up / n) * 100).toFixed(1)}%` : "",
    신호후_평균종가등락: n ? `${(sum / n).toFixed(2)}%` : "",
    신호후_상승일평균: up ? `${(upSum / up).toFixed(2)}%` : "",
    신호후_하락일평균: downN ? `${(downSum / downN).toFixed(2)}%` : "",
    연속2일만: String(signals.filter((s) => s.streakDays === 2).length),
    연속3일이상: String(signals.filter((s) => s.streakDays >= 3).length)
  };
}

async function main() {
  const allSignals = [];
  const summaries = [];
  let totalSignals = 0;
  let totalUp = 0;
  let totalSum = 0;
  let dedupedCount = 0;
  let dedupedUp = 0;
  let dedupedSum = 0;

  for (const [ticker, name] of KOSPI_TOP_50) {
    process.stdout.write(`Fetching ${ticker} ${name}...\n`);
    const candles = await fetchCandles(ticker);
    const series = buildDailySeries(candles);
    const signals = detectSignals(series, false);
    const signalsDedup = detectSignals(series, true);
    process.stdout.write(`  -> ${series.length} days, ${signals.length} signals\n`);

    for (const s of signalsDedup) {
      dedupedCount += 1;
      dedupedSum += s.closePct;
      if (s.up) dedupedUp += 1;
    }

    for (const s of signals) {
      allSignals.push({
        종목코드: ticker,
        종목명: name,
        매집신호일: s.signalDate,
        연속일수: String(s.streakDays),
        구간시작일: s.rangeStart,
        구간종료일: s.rangeEnd,
        신호일_종가등락비율: s.closePct.toFixed(4),
        신호일_상승여부: s.up ? "상승" : "하락",
        구간1일차_거래량등락: s.vol1?.toFixed(4) ?? "",
        구간2일차_거래량등락: s.vol2?.toFixed(4) ?? "",
        구간종료_거래량등락: s.volEnd?.toFixed(4) ?? "",
        구간종료_SMA5등락: s.sma5End?.toFixed(4) ?? ""
      });
      totalSignals += 1;
      if (s.up) totalUp += 1;
      totalSum += s.closePct;
    }

    summaries.push(summarizeStock(ticker, name, series, signals));
  }

  const deduped = dedupedCount;

  summaries.sort((a, b) => a.종목코드.localeCompare(b.종목코드));
  allSignals.sort((a, b) =>
    a.매집신호일 === b.매집신호일
      ? a.종목코드.localeCompare(b.종목코드)
      : a.매집신호일.localeCompare(b.매집신호일)
  );

  const aggregate = {
    종목코드: "TOP50_합산",
    종목명: "전체",
    분석거래일수: String(summaries.reduce((s, r) => s + Number(r.분석거래일수), 0)),
    매집신호횟수: String(totalSignals),
    신호후_상승비율: totalSignals ? `${((totalUp / totalSignals) * 100).toFixed(1)}%` : "",
    신호후_평균종가등락: totalSignals ? `${(totalSum / totalSignals).toFixed(2)}%` : "",
    신호후_상승일평균: "",
    신호후_하락일평균: "",
    연속2일만: String(allSignals.filter((r) => r.연속일수 === "2").length),
    연속3일이상: String(allSignals.filter((r) => Number(r.연속일수) >= 3).length)
  };

  const outDir = path.join(ROOT, "data");
  fs.mkdirSync(outDir, { recursive: true });
  writeCsv(path.join(outDir, "kospi-top50-bottom-accumulation-signals.csv"), SIGNAL_HEADERS, allSignals);
  writeCsv(
    path.join(outDir, "kospi-top50-bottom-accumulation-summary.csv"),
    SUMMARY_HEADERS,
    [aggregate, ...summaries]
  );

  process.stdout.write(`중복제거(구간 첫 2일만): ${deduped}건 | 상승 ${deduped ? ((dedupedUp / deduped) * 100).toFixed(1) : 0}% | 평균 ${deduped ? (dedupedSum / deduped).toFixed(2) : 0}%\n`);
  process.stdout.write(`Wrote data/kospi-top50-bottom-accumulation-*.csv\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
