// diag_reversal_gate.mjs — Breakdown détaillé du structureFiltered reversal
// Pour chaque signal détecté (detectBuy/detectSell passe), identifie quelle
// sous-condition de passesStructureGate bloque exactement le trade.
//
// Run: npx vite-node diag_reversal_gate.mjs

import { readFileSync, readdirSync } from "fs";

const MT5_DIR =
  "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/backtest";

// ── Import config + détection ──────────────────────────────────────────────
const { getSignalConfig } = await import("./src/components/config/MultipliersConfig.js");

// ── CSV loader ─────────────────────────────────────────────────────────────
function loadCSV(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map(h => h.trim());
  return lines.slice(1).map((line, i) => {
    const vals = line.split(";");
    const row = { index: i + 1 };
    headers.forEach((h, j) => { row[h] = vals[j]?.trim() ?? ""; });
    return row;
  });
}

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ── Réplique exacte de getMinMaxRSI_H1 ────────────────────────────────────
function getMinMaxRSI_H1(rows, i, bars = 5) {
  let count = 0, min = Infinity, max = -Infinity, current = null, lastHour = null;
  for (let k = i; k >= 0; k--) {
    const hour = rows[k]?.timestamp?.slice(0, 13);
    if (!hour || hour === lastHour) continue;
    lastHour = hour;
    const rsi = num(rows[k]?.rsi_h1);
    if (rsi === null) return null;
    if (current === null) current = rsi;
    if (rsi < min) min = rsi;
    if (rsi > max) max = rsi;
    if (++count >= bars) break;
  }
  return count < bars ? null : { minRSI: min, maxRSI: max, currentRSI: current };
}

// ── Réplique exacte des détecteurs (RSI path) ──────────────────────────────
function detectBuy(rsiStats, dyn, cfg) {
  if (rsiStats.minRSI > cfg.rsiBuyMax) return null;
  if (dyn.dbbz < cfg.dbbzBuyMin) return null;
  return "BUY";
}

function detectSell(rsiStats, dyn, cfg) {
  if (rsiStats.maxRSI < cfg.rsiSellMin) return null;
  if (dyn.dbbz > cfg.dbbzSellMax) return null;
  return "SELL";
}

// ── Gate instrumentée — retourne la raison du rejet ───────────────────────
function whyBlocked(side, rsi, slope, dslope, cfg) {
  const slopeMin  = cfg.slopeH1Min         ?? 1.25;
  const dslopeMin = cfg.dslopeH1ReversalMin ?? 0.5;

  if (side === "BUY") {
    const deep = cfg.rsiBuyMax  ?? 30;
    const semi = cfg.rsiBuySemi ?? 35;

    if (rsi < deep) {
      if (slope < -slopeMin) return `BUY_DEEP: slope<-${slopeMin} (${slope.toFixed(2)})`;
      if (dslope <= dslopeMin) return `BUY_DEEP: dslope<=${dslopeMin} (${dslope.toFixed(2)})`;
      return null; // passe
    }
    if (rsi < semi) {
      if (slope < slopeMin)  return `BUY_SEMI: slope<${slopeMin} (${slope.toFixed(2)})`;
      if (dslope <= dslopeMin) return `BUY_SEMI: dslope<=${dslopeMin} (${dslope.toFixed(2)})`;
      return null; // passe
    }
    return `BUY_HORS_ZONE: rsi=${rsi.toFixed(1)} >= ${semi}`;
  }

  if (side === "SELL") {
    const deep = cfg.rsiSellMin  ?? 70;
    const semi = cfg.rsiSellSemi ?? 65;

    if (rsi > deep) {
      if (slope > slopeMin)   return `SELL_DEEP: slope>${slopeMin} (${slope.toFixed(2)})`;
      if (dslope >= -dslopeMin) return `SELL_DEEP: dslope>=-${dslopeMin} (${dslope.toFixed(2)})`;
      return null; // passe
    }
    if (rsi > semi) {
      if (slope > -slopeMin)   return `SELL_SEMI: slope>-${slopeMin} (${slope.toFixed(2)})`;
      if (dslope >= -dslopeMin) return `SELL_SEMI: dslope>=-${dslopeMin} (${dslope.toFixed(2)})`;
      return null; // passe
    }
    return `SELL_HORS_ZONE: rsi=${rsi.toFixed(1)} <= ${semi}`;
  }

  return "SIDE_UNKNOWN";
}

// ── Main ───────────────────────────────────────────────────────────────────
let csvFiles = [];
try {
  csvFiles = readdirSync(MT5_DIR).filter(f => f.endsWith(".csv"));
} catch (e) {
  console.error("Cannot read MT5 dir:", e.message);
  process.exit(1);
}

console.log(`\nFiles: ${csvFiles.join(", ")}\n`);

// Compteurs globaux
const reasons    = {};   // raison → count
const rsiDeepBuy  = [];  // distribution rsi pour BUY_DEEP
const rsiSemiBuy  = [];
const slopeDeepBuy   = [];
const dslopeDeepBuy  = [];
const slopeSemiBuy   = [];
const dslopeSemiBuy  = [];
const rsiDeepSell = [];
const rsiSemiSell = [];
const slopeDeepSell  = [];
const dslopeDeepSell = [];

let totalDetected    = 0;
let totalBlocked     = 0;
let totalPassed      = 0;

for (const f of csvFiles) {
  const rows = loadCSV(`${MT5_DIR}/${f}`);
  if (!rows.length) continue;

  const symbol = rows[0]?.symbol ?? f.replace(".csv", "");
  const cfg    = getSignalConfig(symbol)?.h1Reversal;
  if (!cfg) { console.warn(`No config for ${symbol}`); continue; }

  console.log(`  ${f} (${symbol}): ${rows.length} bars`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rsiStats = getMinMaxRSI_H1(rows, i, cfg.rsiWindowH1);
    if (!rsiStats) continue;

    const slope  = num(row?.slope_h1);
    const dslope = num(row?.dslope_h1);
    const dbbz   = num(row?.dz_h1);
    if (slope === null || dslope === null || dbbz === null) continue;

    const dyn = { slope, dslope, dbbz };

    const signalType =
      detectBuy(rsiStats, dyn, cfg)
      ?? detectSell(rsiStats, dyn, cfg);

    if (!signalType) continue;

    totalDetected++;
    const side = signalType.startsWith("BUY") ? "BUY" : "SELL";
    const rsi  = rsiStats.currentRSI;

    const reason = whyBlocked(side, rsi, slope, dslope, cfg);

    if (reason === null) {
      totalPassed++;
      continue;
    }

    totalBlocked++;
    reasons[reason] = (reasons[reason] ?? 0) + 1;

    // Collecte distributions pour analyse
    const deep = side === "BUY" ? (cfg.rsiBuyMax ?? 30) : (cfg.rsiSellMin ?? 70);
    const semi = side === "BUY" ? (cfg.rsiBuySemi ?? 35) : (cfg.rsiSellSemi ?? 65);

    if (side === "BUY") {
      if (rsi < deep)  { rsiDeepBuy.push(rsi); slopeDeepBuy.push(slope); dslopeDeepBuy.push(dslope); }
      else if (rsi < semi) { rsiSemiBuy.push(rsi); slopeSemiBuy.push(slope); dslopeSemiBuy.push(dslope); }
    } else {
      if (rsi > deep)  { rsiDeepSell.push(rsi); slopeDeepSell.push(slope); dslopeDeepSell.push(dslope); }
      else if (rsi > semi) { rsiSemiSell.push(rsi); }
    }
  }
}

// ── Affichage ──────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(65)}`);
console.log(`  REVERSAL structureFiltered — Breakdown`);
console.log(`${"═".repeat(65)}`);
console.log(`  Total signaux détectés : ${totalDetected}`);
console.log(`  Bloqués structure gate : ${totalBlocked}`);
console.log(`  Passent la gate        : ${totalPassed}`);
console.log();

// Trier par count décroissant
const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
console.log("  Raisons (décroissant) :");
for (const [reason, count] of sorted) {
  const pct = ((count / totalBlocked) * 100).toFixed(1);
  const bar = "█".repeat(Math.round(count / totalBlocked * 30));
  console.log(`    ${count.toString().padStart(5)} (${pct.padStart(5)}%)  ${bar}  ${reason}`);
}

// ── Distributions des valeurs bloquées ────────────────────────────────────
function pcts(arr, label) {
  if (!arr.length) return;
  const s = [...arr].sort((a, b) => a - b);
  const p = ps => ps.map(p => {
    const v = s[Math.floor(p / 100 * (s.length - 1))];
    return `p${p}=${v.toFixed(2)}`;
  }).join("  ");
  console.log(`    ${label.padEnd(22)} n=${arr.length}  ${p([0, 10, 25, 50, 75, 90, 100])}`);
}

console.log(`\n  Distributions des valeurs bloquées :`);
pcts(rsiDeepBuy,    "BUY deep — rsi");
pcts(slopeDeepBuy,  "BUY deep — slope_h1");
pcts(dslopeDeepBuy, "BUY deep — dslope_h1");
pcts(rsiSemiBuy,    "BUY semi — rsi");
pcts(slopeSemiBuy,  "BUY semi — slope_h1");
pcts(dslopeSemiBuy, "BUY semi — dslope_h1");
pcts(rsiDeepSell,   "SELL deep — rsi");
pcts(slopeDeepSell, "SELL deep — slope_h1");
pcts(dslopeDeepSell,"SELL deep — dslope_h1");
pcts(rsiSemiSell,   "SELL semi — rsi");

console.log(`\n${"─".repeat(65)}`);
