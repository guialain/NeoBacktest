// diag_overextended.mjs — WAIT_M5_OVEREXTENDED sub-condition breakdown
// Run: npx vite-node diag_overextended.mjs

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

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
const { default: SignalFilters }    = await import("./src/components/robots/SignalFilters.js");

const csvFiles = readdirSync(MT5_DIR).filter(f => f.endsWith(".csv")).slice(0, 3);
const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

// Collect all signals that reach M5_OVEREXTENDED check
// (i.e. passed weekend, vol, and for reversal: passed WAIT_MICRO)
const oe = TIMING_CONFIG.M5.overextended;

const counters = {
  reversal:     { total: 0, blockedSlope: 0, blockedDslope: 0, blockedDrsi: 0, passed: 0 },
  continuation: { total: 0, blockedSlope: 0, blockedDslope: 0, blockedDrsi: 0, passed: 0 },
};

// Store values at overextended check for distribution
const vals = {
  slope_buy: [], slope_sell: [],
  dslope_buy: [], dslope_sell: [],
  drsi_buy: [], drsi_sell: [],
};

function pct(n, t) { return t > 0 ? `${((n/t)*100).toFixed(1)}%` : "—"; }

for (const file of csvFiles) {
  const marketData = loadCSV(join(MT5_DIR, file));
  marketData.forEach((row, i) => { row.index = i; });

  const signals = TopOpportunities.evaluate(marketData);

  // Re-run filters up to the point where M5_OE is checked
  // We need to pass: weekend, vol, micro (reversal only), then check M5_OE
  const { validOpportunities, waitOpportunities } = SignalFilters.evaluate({
    opportunities: signals,
  });

  // Signals that hit M5_OE would appear in waitOpportunities as WAIT_M5_OVEREXTENDED
  const oeBlocked = waitOpportunities.filter(s => s.state === "WAIT_M5_OVEREXTENDED");

  // Also get the signals that passed M5_OE (in validOpportunities, or later wait states)
  // We can infer what passed M5_OE by checking signals that are valid or in later wait states
  // For simplicity: check the raw overextension values at oeBlocked signals

  for (const opp of oeBlocked) {
    const side   = opp.side;
    const slope  = num(opp.slope_m5);
    const dslope = num(opp.dslope_m5);
    const drsi   = num(opp.drsi_m5);
    const type   = opp.type === "continuation" ? "continuation" : "reversal";

    if (slope === null || dslope === null || drsi === null) continue;

    const ct = counters[type];
    ct.total++;

    const slopeKey  = side === "BUY" ? "slope_buy"  : "slope_sell";
    const dslopeKey = side === "BUY" ? "dslope_buy" : "dslope_sell";
    const drsiKey   = side === "BUY" ? "drsi_buy"   : "drsi_sell";

    vals[slopeKey].push(Math.abs(slope));
    vals[dslopeKey].push(Math.abs(dslope));
    vals[drsiKey].push(Math.abs(drsi));

    // Which sub-condition triggered (first match)
    if (side === "SELL" && (slope < -oe.slopeAbs || dslope < -oe.dslopeAbs || drsi < -oe.drsiAbs)) {
      if (slope < -oe.slopeAbs) ct.blockedSlope++;
      else if (dslope < -oe.dslopeAbs) ct.blockedDslope++;
      else ct.blockedDrsi++;
    } else if (side === "BUY" && (slope > oe.slopeAbs || dslope > oe.dslopeAbs || drsi > oe.drsiAbs)) {
      if (slope > oe.slopeAbs) ct.blockedSlope++;
      else if (dslope > oe.dslopeAbs) ct.blockedDslope++;
      else ct.blockedDrsi++;
    }

    ct.passed++; // This is actually blocked (we're iterating oeBlocked) - fix below
  }
}

// Fix: ct.passed is wrong — let me recount properly
// Reset and redo correctly
const c2 = {
  reversal:     { total: 0, bySlope: 0, byDslope: 0, byDrsi: 0 },
  continuation: { total: 0, bySlope: 0, byDslope: 0, byDrsi: 0 },
};
const allVals = { slope: [], dslope: [], drsi: [], side: [] };

for (const file of csvFiles) {
  const marketData = loadCSV(join(MT5_DIR, file));
  marketData.forEach((row, i) => { row.index = i; });

  const signals = TopOpportunities.evaluate(marketData);
  const { waitOpportunities } = SignalFilters.evaluate({ opportunities: signals });
  const oeBlocked = waitOpportunities.filter(s => s.state === "WAIT_M5_OVEREXTENDED");

  for (const opp of oeBlocked) {
    const side   = opp.side;
    const slope  = num(opp.slope_m5);
    const dslope = num(opp.dslope_m5);
    const drsi   = num(opp.drsi_m5);
    const type   = opp.type === "continuation" ? "continuation" : "reversal";

    if (slope === null || dslope === null || drsi === null) continue;

    const ct = c2[type];
    ct.total++;

    // Record magnitudes
    allVals.slope.push(Math.abs(slope));
    allVals.dslope.push(Math.abs(dslope));
    allVals.drsi.push(Math.abs(drsi));
    allVals.side.push(side);

    // First triggering condition
    if (side === "SELL") {
      if (slope  < -oe.slopeAbs)  { ct.bySlope++;  continue; }
      if (dslope < -oe.dslopeAbs) { ct.byDslope++; continue; }
      if (drsi   < -oe.drsiAbs)   { ct.byDrsi++;   continue; }
    } else {
      if (slope  >  oe.slopeAbs)  { ct.bySlope++;  continue; }
      if (dslope >  oe.dslopeAbs) { ct.byDslope++; continue; }
      if (drsi   >  oe.drsiAbs)   { ct.byDrsi++;   continue; }
    }
  }
}

// ── Print ─────────────────────────────────────────────────────────────────────
for (const type of ["reversal", "continuation"]) {
  const ct = c2[type];
  if (ct.total === 0) continue;
  console.log(`\n════════ WAIT_M5_OVEREXTENDED — ${type.toUpperCase()} (${ct.total} signals) ════════`);
  console.log(`  |slope_m5| > ${oe.slopeAbs}  (bySlope):   ${ct.bySlope} ${pct(ct.bySlope, ct.total)}`);
  console.log(`  |dslope_m5| > ${oe.dslopeAbs} (byDslope): ${ct.byDslope} ${pct(ct.byDslope, ct.total)}`);
  console.log(`  |drsi_m5| > ${oe.drsiAbs}   (byDrsi):   ${ct.byDrsi} ${pct(ct.byDrsi, ct.total)}`);
}

// Distribution of the triggering values
function ptiles(arr, label) {
  if (!arr.length) return;
  arr.sort((a, b) => a - b);
  const p = q => arr[Math.floor(q * (arr.length - 1))].toFixed(2);
  console.log(`\n── |${label}| at WAIT_M5_OE blocks (${arr.length} obs) ──`);
  console.log(`  p50=${p(0.5)}  p75=${p(0.75)}  p90=${p(0.9)}  p95=${p(0.95)}  p99=${p(0.99)}  max=${p(1.0)}`);
}
ptiles(allVals.slope,  "slope_m5");
ptiles(allVals.dslope, "dslope_m5");
ptiles(allVals.drsi,   "drsi_m5");

console.log("\n── Current overextended thresholds ──");
console.log(`  slopeAbs=${oe.slopeAbs}  dslopeAbs=${oe.dslopeAbs}  drsiAbs=${oe.drsiAbs}`);
