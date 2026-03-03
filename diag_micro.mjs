// diag_micro.mjs — Breakdown of WAIT_MICRO sub-conditions on reversal signals
// Run: npx vite-node diag_micro.mjs

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MT5_DIR =
  "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files";

function loadCSV(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map(h => h.trim());
  return lines.slice(1).map((line, i) => {
    const vals = line.split(";");
    const row = { index: i + 1 };
    headers.forEach((h, j) => {
      const v = vals[j]?.trim();
      const n = Number(v);
      row[h] = Number.isFinite(n) ? n : v;
    });
    return row;
  });
}

const { default: TopOpportunities } = await import("./src/components/robots/TopOpportunities.js");
const { TIMING_CONFIG }             = await import("./src/components/config/TimingConfig.js");

const csvFiles = readdirSync(MT5_DIR).filter(f => f.endsWith(".csv")).slice(0, 3);

const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

// Sub-condition counters per side
const counters = {
  BUY:  { total: 0, rsiHigh: 0, slopeVeto: 0, dCombo: 0, drsiVeto: 0, passed: 0 },
  SELL: { total: 0, rsiLow: 0,  slopeVeto: 0, dCombo: 0, drsiVeto: 0, passed: 0 },
};

// Distribution of drsi_m5 at reversal signal bars
const drsiDist = { BUY: [], SELL: [] };

for (const file of csvFiles) {
  const marketData = loadCSV(join(MT5_DIR, file));
  marketData.forEach((row, i) => { row.index = i; });

  const signals = TopOpportunities.evaluate(marketData);
  const reversals = signals.filter(s => s.type !== "continuation");

  const c = TIMING_CONFIG.M5.contrary;

  for (const opp of reversals) {
    const side   = opp.side;
    const slope  = num(opp.slope_m5);
    const dslope = num(opp.dslope_m5);
    const drsi   = num(opp.drsi_m5);
    const rsi    = num(opp.rsi_m5);

    if (slope == null || dslope == null || drsi == null || rsi == null) continue;

    if (side === "BUY") {
      const ct = counters.BUY;
      ct.total++;
      drsiDist.BUY.push(drsi);

      if (rsi > c.rsiBuyMax)                              { ct.rsiHigh++;  continue; }
      if (slope < c.slopeVetoBuy)                          { ct.slopeVeto++; continue; }
      if (dslope < c.dslopeBuyMin && drsi < c.drsiBuyMin) { ct.dCombo++;   continue; }
      if (drsi < c.drsiVetoBuy)                            { ct.drsiVeto++; continue; }
      ct.passed++;
    }

    if (side === "SELL") {
      const ct = counters.SELL;
      ct.total++;
      drsiDist.SELL.push(drsi);

      if (rsi < c.rsiSellMin)                               { ct.rsiLow++;   continue; }
      if (slope > c.slopeVetoSell)                           { ct.slopeVeto++; continue; }
      if (dslope > c.dslopeSellMax && drsi > c.drsiSellMax) { ct.dCombo++;   continue; }
      if (drsi > c.drsiVetoSell)                             { ct.drsiVeto++; continue; }
      ct.passed++;
    }
  }
}

// ── Print results ─────────────────────────────────────────────────────────────
function pct(n, total) {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—";
}

console.log("\n════════ WAIT_MICRO SUB-CONDITIONS — BUY ════════");
const b = counters.BUY;
console.log(`Total reversal BUY signals:  ${b.total}`);
console.log(`  rsi_m5 > ${TIMING_CONFIG.M5.contrary.rsiBuyMax} (rsiHigh):      ${b.rsiHigh.toString().padStart(4)}  ${pct(b.rsiHigh, b.total)}`);
console.log(`  slope_m5 < ${TIMING_CONFIG.M5.contrary.slopeVetoBuy} (slopeVeto):  ${b.slopeVeto.toString().padStart(4)}  ${pct(b.slopeVeto, b.total)}`);
console.log(`  dslope<${TIMING_CONFIG.M5.contrary.dslopeBuyMin} AND drsi<${TIMING_CONFIG.M5.contrary.drsiBuyMin} (dCombo): ${b.dCombo.toString().padStart(4)}  ${pct(b.dCombo, b.total)}`);
console.log(`  drsi_m5 < ${TIMING_CONFIG.M5.contrary.drsiVetoBuy} (drsiVeto):   ${b.drsiVeto.toString().padStart(4)}  ${pct(b.drsiVeto, b.total)}`);
console.log(`  PASSED:                     ${b.passed.toString().padStart(4)}  ${pct(b.passed, b.total)}`);

console.log("\n════════ WAIT_MICRO SUB-CONDITIONS — SELL ════════");
const s = counters.SELL;
console.log(`Total reversal SELL signals: ${s.total}`);
console.log(`  rsi_m5 < ${TIMING_CONFIG.M5.contrary.rsiSellMin} (rsiLow):     ${s.rsiLow.toString().padStart(4)}  ${pct(s.rsiLow, s.total)}`);
console.log(`  slope_m5 > ${TIMING_CONFIG.M5.contrary.slopeVetoSell} (slopeVeto):   ${s.slopeVeto.toString().padStart(4)}  ${pct(s.slopeVeto, s.total)}`);
console.log(`  dslope>${TIMING_CONFIG.M5.contrary.dslopeSellMax} AND drsi>${TIMING_CONFIG.M5.contrary.drsiSellMax} (dCombo):  ${s.dCombo.toString().padStart(4)}  ${pct(s.dCombo, s.total)}`);
console.log(`  drsi_m5 > ${TIMING_CONFIG.M5.contrary.drsiVetoSell} (drsiVeto):    ${s.drsiVeto.toString().padStart(4)}  ${pct(s.drsiVeto, s.total)}`);
console.log(`  PASSED:                     ${s.passed.toString().padStart(4)}  ${pct(s.passed, s.total)}`);

// ── drsi_m5 percentiles ────────────────────────────────────────────────────────
function percentiles(arr, label) {
  if (!arr.length) return;
  arr.sort((a, b) => a - b);
  const p = q => arr[Math.floor(q * (arr.length - 1))];
  console.log(`\n── drsi_m5 distribution at ${label} reversal entries ──`);
  console.log(`  p5=${p(0.05).toFixed(3)}  p10=${p(0.10).toFixed(3)}  p25=${p(0.25).toFixed(3)}  p50=${p(0.50).toFixed(3)}`);
  console.log(`  p75=${p(0.75).toFixed(3)} p90=${p(0.90).toFixed(3)} p95=${p(0.95).toFixed(3)} p99=${p(0.99).toFixed(3)}`);
  const below = t => arr.filter(v => v < t).length;
  const above = t => arr.filter(v => v > t).length;
  if (label === "BUY") {
    console.log(`  drsi < -1.0: ${below(-1.0)} (${pct(below(-1.0), arr.length)}) — current drsiVetoBuy`);
    console.log(`  drsi < -1.5: ${below(-1.5)} (${pct(below(-1.5), arr.length)})`);
    console.log(`  drsi < -2.0: ${below(-2.0)} (${pct(below(-2.0), arr.length)})`);
    console.log(`  drsi < -0.5: ${below(-0.5)} (${pct(below(-0.5), arr.length)})`);
  } else {
    console.log(`  drsi > 1.0:  ${above(1.0)} (${pct(above(1.0), arr.length)}) — current drsiVetoSell`);
    console.log(`  drsi > 1.5:  ${above(1.5)} (${pct(above(1.5), arr.length)})`);
    console.log(`  drsi > 2.0:  ${above(2.0)} (${pct(above(2.0), arr.length)})`);
    console.log(`  drsi > 0.5:  ${above(0.5)} (${pct(above(0.5), arr.length)})`);
  }
}

percentiles(drsiDist.BUY,  "BUY");
percentiles(drsiDist.SELL, "SELL");

console.log("\n── Current TIMING_CONFIG.M5.contrary ──");
console.log(TIMING_CONFIG.M5.contrary);
