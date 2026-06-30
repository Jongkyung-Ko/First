#!/usr/bin/env node
/** KOSPI TOP30 — 거래량 연속 상승 후 전일 지표 vs 당일 종가 일치율 분석 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "data", "kospi-top30-analysis.csv");
const VOL_THRESHOLD = 15;

const INDICATOR_COLS = [
  "SMA5_등락비율",
  "SMA20_등락비율",
  "SMA60_등락비율",
  "BB상_등락비율",
  "BB중_등락비율",
  "BB하_등락비율",
  "RSI_등락비율",
  "MACD_등락비율"
];

const SCENARIOS = [
  {
    id: "vol_1d_15",
    label: "전일 거래량 +15% (1일)",
    minIndex: 1,
    match: (rows, i) => {
      const v = parsePct(rows[i - 1].volPct);
      return v != null && v >= VOL_THRESHOLD;
    }
  },
  {
    id: "vol_2d_15",
    label: "연속 2일 거래량 +15%",
    minIndex: 2,
    match: (rows, i) => {
      const v1 = parsePct(rows[i - 2].volPct);
      const v2 = parsePct(rows[i - 1].volPct);
      return v1 != null && v2 != null && v1 >= VOL_THRESHOLD && v2 >= VOL_THRESHOLD;
    }
  },
  {
    id: "vol_3d_15",
    label: "연속 3일 거래량 +15%",
    minIndex: 3,
    match: (rows, i) => {
      const vals = [i - 3, i - 2, i - 1].map((j) => parsePct(rows[j].volPct));
      return vals.every((v) => v != null && v >= VOL_THRESHOLD);
    }
  }
];

const SUMMARY_HEADERS = [
  "분석유형",
  "종목코드",
  "종목명",
  "필터후_다음날수",
  "다음날_상승비율",
  "다음날_평균종가등락",
  ...INDICATOR_COLS.map((c) => `${c.replace("_등락비율", "")}_일치율`),
  "전체지표동시일치율",
  "비교가능일수"
];

function parsePct(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function directionSign(value) {
  const n = parsePct(value);
  if (n == null) return null;
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function loadGroups() {
  const text = fs.readFileSync(INPUT, "utf8").replace(/^\uFEFF/, "");
  const lines = text.trim().split(/\r?\n/);
  const hdr = lines[0].split(",");
  const idx = (name) => hdr.indexOf(name);
  const groups = new Map();

  for (let i = 1; i < lines.length; i += 1) {
    const p = lines[i].split(",");
    const row = {
      code: p[idx("종목코드")],
      name: p[idx("종목명")],
      date: p[idx("일자")],
      closePct: p[idx("종가_등락비율")],
      volPct: p[idx("거래량_등락비율")]
    };
    for (const col of INDICATOR_COLS) row[col] = p[idx(col)];
    if (!groups.has(row.code)) groups.set(row.code, []);
    groups.get(row.code).push(row);
  }

  for (const rows of groups.values()) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
  }
  return groups;
}

function analyzeStock(rows, scenario) {
  const indStat = Object.fromEntries(INDICATOR_COLS.map((c) => [c, { matched: 0, total: 0 }]));
  let filteredDays = 0;
  let up = 0;
  let down = 0;
  let sumClose = 0;
  let allMatch = 0;
  let allTotal = 0;

  for (let i = scenario.minIndex; i < rows.length; i += 1) {
    if (!scenario.match(rows, i)) continue;

    const closePct = parsePct(rows[i].closePct);
    if (closePct == null || closePct === 0) continue;

    filteredDays += 1;
    sumClose += closePct;
    if (closePct > 0) up += 1;
    else down += 1;

    const closeDir = directionSign(rows[i].closePct);
    let dayAll = true;
    let dayAny = false;

    for (const col of INDICATOR_COLS) {
      const prevDir = directionSign(rows[i - 1][col]);
      if (prevDir == null || prevDir === 0) continue;
      indStat[col].total += 1;
      dayAny = true;
      if (closeDir === prevDir) indStat[col].matched += 1;
      else dayAll = false;
    }

    if (dayAny) {
      allTotal += 1;
      if (dayAll) allMatch += 1;
    }
  }

  if (!filteredDays) return null;

  const item = {
    분석유형: scenario.label,
    종목코드: rows[0].code,
    종목명: rows[0].name,
    필터후_다음날수: String(filteredDays),
    다음날_상승비율: `${((up / (up + down)) * 100).toFixed(1)}%`,
    다음날_평균종가등락: `${(sumClose / filteredDays).toFixed(2)}%`
  };

  for (const col of INDICATOR_COLS) {
    const base = col.replace("_등락비율", "");
    const { matched, total } = indStat[col];
    item[`${base}_일치율`] = total ? `${((matched / total) * 100).toFixed(1)}%` : "";
  }

  item.전체지표동시일치율 = allTotal ? `${((allMatch / allTotal) * 100).toFixed(1)}%` : "";
  item.비교가능일수 = String(allTotal);
  return item;
}

function aggregateMarket(rows) {
  const item = {
    분석유형: rows[0].분석유형,
    종목코드: "TOP30_합산",
    종목명: "전체",
    필터후_다음날수: String(rows.reduce((s, r) => s + Number(r.필터후_다음날수), 0)),
    다음날_상승비율: "",
    다음날_평균종가등락: ""
  };

  let upWeighted = 0;
  let totalDays = 0;
  let sumCloseWeighted = 0;

  for (const row of rows) {
    const days = Number(row.필터후_다음날수);
    const upPct = parseFloat(row.다음날_상승비율);
    const avgClose = parseFloat(row.다음날_평균종가등락);
    totalDays += days;
    upWeighted += (upPct / 100) * days;
    sumCloseWeighted += avgClose * days;
  }

  if (totalDays) {
    item.다음날_상승비율 = `${((upWeighted / totalDays) * 100).toFixed(1)}%`;
    item.다음날_평균종가등락 = `${(sumCloseWeighted / totalDays).toFixed(2)}%`;
  }

  for (const col of INDICATOR_COLS) {
    const base = col.replace("_등락비율", "");
    let matched = 0;
    let total = 0;
    for (const row of rows) {
      const rate = row[`${base}_일치율`];
      const days = Number(row.비교가능일수);
      if (!rate || !days) continue;
      matched += (parseFloat(rate) / 100) * days;
      total += days;
    }
    item[`${base}_일치율`] = total ? `${((matched / total) * 100).toFixed(1)}%` : "";
  }

  let allMatch = 0;
  let allTotal = 0;
  for (const row of rows) {
    const rate = row.전체지표동시일치율;
    const days = Number(row.비교가능일수);
    if (!rate || !days) continue;
    allMatch += (parseFloat(rate) / 100) * days;
    allTotal += days;
  }
  item.전체지표동시일치율 = allTotal ? `${((allMatch / allTotal) * 100).toFixed(1)}%` : "";
  item.비교가능일수 = String(allTotal);
  return item;
}

function writeCsv(filePath, headers, rows) {
  const lines = ["\uFEFF" + headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

function main() {
  const groups = loadGroups();
  const allRows = [];

  for (const scenario of SCENARIOS) {
    const scenarioRows = [];
    for (const rows of groups.values()) {
      const item = analyzeStock(rows, scenario);
      if (item) scenarioRows.push(item);
    }
    scenarioRows.sort((a, b) => a.종목코드.localeCompare(b.종목코드));
    allRows.push(aggregateMarket(scenarioRows), ...scenarioRows);
  }

  const outPath = path.join(ROOT, "data", "kospi-top30-volume-streak-summary.csv");
  writeCsv(outPath, SUMMARY_HEADERS, allRows);
  process.stdout.write(`Wrote ${outPath} (${allRows.length} rows)\n`);
}

main();
