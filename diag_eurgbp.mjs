// ============================================================================
// diag_eurgbp.mjs — Diagnostic complet des filtres zscore pour EURGBP
// Usage: node diag_eurgbp.mjs
// ============================================================================

import { readFileSync } from "fs";

const CSV_PATH =
  "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/backtest/EURGBP_5min.csv";

// ── Params actuels (post-recalibration zscore /2) ──────────────────────────
const CFG_CONTINUATION = {
  slopeH1Min:      0.2,
  rsiBuyMin:       43,   rsiBuyMax:  68,
  rsiSellMin:      32,   rsiSellMax: 57,
  dslopeH1MaxAbs:  6.0,
  dslopeH1DirMin: -0.5,  dslopeH1DirMax:  0.5,
  dslopeH1BuyMin:  0.15,
  zscoreH1BuyMin:  0.0,  zscoreH1BuyMax:  1.0,
  zscoreH1SellMax: 0.0,  zscoreH1SellMin: -1.0,
  dzH1BuyMax:      0.4,  dzH1SellMin:    -0.4,
  dzH1RepliMin:    0.01,
};
const CFG_REVERSAL = {
  rsiWindowH1:   5,
  rsiBuyMax:     27,  rsiSellMin: 73,
  dbbzBuyMin:    0.10, dbbzSellMax: -0.10,
  flipSlopeMin:  1.0,  flipDslopeMin: 1.0,
  slopeH1MaxAbs: 6.0,
  slopeH1BuyMin: 0.5,  slopeH1SellMax: -0.5,
  rsiStalenessMargin: 16,
  dslopeH1OverextendedAbs: 5.0,
  dslopeH1AgainstAbs: 0.5,
  earlyScoreBonus: 20,
};
const TIMING_M5 = { rsiBuyMax: 60, rsiSellMin: 40, slopeMin: 0.05, dslopeMin: 0.05 };
const TIMING_M1 = { rsiBuyMax: 70, rsiSellMin: 30 };

// ── Parse ──────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(";").map(s => s.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      const raw = (cols[j] ?? "").trim();
      const n = Number(raw);
      obj[header[j]] = raw === "" ? null : (Number.isFinite(n) ? n : raw);
    }
    rows.push(obj);
  }
  return rows;
}

const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

// ── Percentiles ────────────────────────────────────────────────────────────
function pct(arr, p) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return NaN;
  const idx = Math.min(Math.floor(p / 100 * n), n - 1);
  return sorted[idx];
}

function percentileOf(arr, value) {
  const sorted = arr.slice().sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) if (v <= value) count++;
  return (count / sorted.length * 100).toFixed(1);
}

function stats(arr, label) {
  const valid = arr.filter(v => v !== null && Number.isFinite(v));
  if (valid.length === 0) { console.log(`  ${label}: NO DATA`); return; }
  console.log(`  ${label} (n=${valid.length}):`);
  console.log(`    min=${pct(valid,0).toFixed(4)}  p1=${pct(valid,1).toFixed(4)}  p5=${pct(valid,5).toFixed(4)}  p10=${pct(valid,10).toFixed(4)}`);
  console.log(`    p25=${pct(valid,25).toFixed(4)}  p50=${pct(valid,50).toFixed(4)}  p75=${pct(valid,75).toFixed(4)}  p90=${pct(valid,90).toFixed(4)}`);
  console.log(`    p95=${pct(valid,95).toFixed(4)}  p99=${pct(valid,99).toFixed(4)}  max=${pct(valid,100).toFixed(4)}`);
}

// ── H1 window RSI stats (same logic as reversal.js) ───────────────────────
function getMinMaxRSI_H1(rows, currentIdx, barsH1 = 5) {
  let count = 0, minRSI = Infinity, maxRSI = -Infinity, currentRSI = null, lastHour = null;
  for (let k = currentIdx; k >= 0; k--) {
    const ts = rows[k]?.timestamp;
    const hour = ts?.slice(0, 13);
    if (!hour) continue;
    if (hour === lastHour) continue;
    lastHour = hour;
    const rsi = num(rows[k]?.rsi_h1);
    if (rsi === null) return null;
    if (currentRSI === null) currentRSI = rsi;
    if (rsi < minRSI) minRSI = rsi;
    if (rsi > maxRSI) maxRSI = rsi;
    count++;
    if (count >= barsH1) break;
  }
  if (count < barsH1) return null;
  return { minRSI, maxRSI, currentRSI };
}

// ============================================================================
// MAIN
// ============================================================================
const text = readFileSync(CSV_PATH, "utf8");
const rows = parseCSV(text);
console.log(`\n${"=".repeat(72)}`);
console.log(`DIAGNOSTIC EURGBP — ${rows.length} barres`);
console.log("=".repeat(72));

// ── 1. DISTRIBUTIONS ───────────────────────────────────────────────────────
console.log("\n── 1. DISTRIBUTIONS ZSCORE / DZ ──────────────────────────────────────");
const zscore_h1_all  = rows.map(r => num(r.zscore_h1)).filter(v => v !== null && Math.abs(v) < 100);
const zscore_m5_all  = rows.map(r => num(r.zscore_m5)).filter(v => v !== null && Math.abs(v) < 100);
const zscore_m15_all = rows.map(r => num(r.zscore_m15)).filter(v => v !== null && Math.abs(v) < 100);
const dz_h1_all      = rows.map(r => num(r.dz_h1)).filter(v => v !== null && Math.abs(v) < 100);
stats(zscore_h1_all,  "zscore_h1");
stats(zscore_m5_all,  "zscore_m5");
stats(zscore_m15_all, "zscore_m15");
stats(dz_h1_all,      "dz_h1");

// ── 2. OÙ SE SITUENT LES SEUILS ACTUELS ────────────────────────────────────
console.log("\n── 2. PERCENTILE DES SEUILS ACTUELS ──────────────────────────────────");
const pos_z = zscore_h1_all.filter(v => v > 0);
const neg_z = zscore_h1_all.filter(v => v < 0).map(v => -v);
console.log(`  zscore_h1 > 0 (BUY zone): n=${pos_z.length}`);
console.log(`    seuil BuyMax=1.0 → p${percentileOf(pos_z, 1.0)}% des z>0 sont ≤1.0  (reste ${(100-parseFloat(percentileOf(pos_z,1.0))).toFixed(1)}% au-delà)`);
console.log(`    seuil BuyMax=1.5 → p${percentileOf(pos_z, 1.5)}% des z>0 sont ≤1.5`);
console.log(`    seuil BuyMax=2.0 → p${percentileOf(pos_z, 2.0)}% des z>0 sont ≤2.0`);
console.log(`  zscore_h1 < 0 (SELL zone): n=${neg_z.length}`);
console.log(`    seuil |SellMin|=1.0 → p${percentileOf(neg_z, 1.0)}% des |z<0| sont ≤1.0`);
console.log(`    seuil |SellMin|=1.5 → p${percentileOf(neg_z, 1.5)}% des |z<0| sont ≤1.5`);
console.log(`    seuil |SellMin|=2.0 → p${percentileOf(neg_z, 2.0)}% des |z<0| sont ≤2.0`);
const pos_dz = dz_h1_all.filter(v => v > 0);
const neg_dz = dz_h1_all.filter(v => v < 0).map(v => -v);
console.log(`  dz_h1>0: seuil 0.4→p${percentileOf(pos_dz, 0.4)}%  0.6→p${percentileOf(pos_dz, 0.6)}%  0.8→p${percentileOf(pos_dz, 0.8)}%  1.0→p${percentileOf(pos_dz, 1.0)}%`);
console.log(`  dz_h1<0: seuil 0.4→p${percentileOf(neg_dz, 0.4)}%  0.6→p${percentileOf(neg_dz, 0.6)}%  0.8→p${percentileOf(neg_dz, 0.8)}%  1.0→p${percentileOf(neg_dz, 1.0)}%`);

// ── 3. CONTINUATION — compte des rejets BUY séquentiels ────────────────────
console.log("\n── 3. CONTINUATION BUY — entonnoir filtre par filtre ─────────────────");
{
  const c = CFG_CONTINUATION;
  const tm5 = TIMING_M5;
  const tm1 = TIMING_M1;

  let remaining = 0;
  const steps = [];

  for (const row of rows) {
    if (!row.timestamp) continue;
    const slope_h1  = num(row.slope_h1);
    const dslope_h1 = num(row.dslope_h1);
    const rsi_h1    = num(row.rsi_h1);
    const rsi_m5    = num(row.rsi_m5);
    const rsi_m1    = num(row.rsi_m1);
    const slope_m5  = num(row.slope_m5);
    const dslope_m5 = num(row.dslope_m5);
    const zscore_h1 = num(row.zscore_h1);
    const dz_h1     = num(row.dz_h1);
    if (slope_h1 === null || dslope_h1 === null || rsi_h1 === null ||
        rsi_m5 === null || slope_m5 === null || dslope_m5 === null) continue;
    if (slope_h1 <= 0) continue;
    remaining++;
  }

  const filters = [
    ["slopeH1≥0.2",        r => { const s=num(r.slope_h1); return s!==null && s>=CFG_CONTINUATION.slopeH1Min; }],
    ["rsiH1∈[43-68]",      r => { const v=num(r.rsi_h1); return v!==null && v>=c.rsiBuyMin && v<=c.rsiBuyMax; }],
    ["rsiM5≤60",           r => { const v=num(r.rsi_m5); return v!==null && v<=tm5.rsiBuyMax; }],
    ["rsiM1≤70",           r => { const v=num(r.rsi_m1); return v===null || v<=tm1.rsiBuyMax; }],
    ["dslH1≥-0.5",         r => { const v=num(r.dslope_h1); return v!==null && v>=c.dslopeH1DirMin; }],
    ["|dslH1|≤6.0",        r => { const v=num(r.dslope_h1); return v!==null && Math.abs(v)<=c.dslopeH1MaxAbs; }],
    ["dslH1≥0.15",         r => { const v=num(r.dslope_h1); return v!==null && v>=c.dslopeH1BuyMin; }],
    ["slopeM5>0.05",       r => { const v=num(r.slope_m5); return v!==null && v>tm5.slopeMin; }],
    ["dslopeM5>0.05",      r => { const v=num(r.dslope_m5); return v!==null && v>tm5.dslopeMin; }],
    ["zscore≥0 (midline)", r => { const v=num(r.zscore_h1); return v===null || v>=c.zscoreH1BuyMin; }],
    ["zscore≤1.0 (BB)",    r => { const v=num(r.zscore_h1); return v===null || v<=c.zscoreH1BuyMax; }],
    ["dz≤0.4",             r => { const v=num(r.dz_h1); return v===null || v<=c.dzH1BuyMax; }],
    ["dzRepli≥0.01",       r => {
      const z=num(r.zscore_h1), d=num(r.dz_h1);
      return !(z!==null && d!==null && z<c.zscoreH1BuyMax && d<c.dzH1RepliMin);
    }],
  ];

  // Filtrage séquentiel sur les barres H1 haussières
  let pool = rows.filter(r => {
    if (!r.timestamp) return false;
    const s=num(r.slope_h1), ds=num(r.dslope_h1), rh=num(r.rsi_h1),
          rm=num(r.rsi_m5), sm=num(r.slope_m5), dm=num(r.dslope_m5);
    if (s===null||ds===null||rh===null||rm===null||sm===null||dm===null) return false;
    return s > 0;
  });
  console.log(`  Base: barres H1 haussières (slope_h1>0): ${pool.length}`);
  for (const [label, fn] of filters) {
    const before = pool.length;
    pool = pool.filter(fn);
    console.log(`  Après ${label.padEnd(22)}: ${pool.length.toString().padStart(5)} restantes  [-${(before-pool.length).toString().padStart(4)}]`);
  }
  console.log(`  ══► SIGNAUX BUY: ${pool.length}`);
}

console.log("\n── 4. CONTINUATION SELL — entonnoir filtre par filtre ────────────────");
{
  const c = CFG_CONTINUATION;
  const tm5 = TIMING_M5;
  const tm1 = TIMING_M1;

  const filters = [
    ["slopeH1≤-0.2",       r => { const s=num(r.slope_h1); return s!==null && s<=-c.slopeH1Min; }],
    ["rsiH1∈[32-57]",      r => { const v=num(r.rsi_h1); return v!==null && v>=c.rsiSellMin && v<=c.rsiSellMax; }],
    ["rsiM5≥40",           r => { const v=num(r.rsi_m5); return v!==null && v>=tm5.rsiSellMin; }],
    ["rsiM1≥30",           r => { const v=num(r.rsi_m1); return v===null || v>=tm1.rsiSellMin; }],
    ["dslH1≤0.5",          r => { const v=num(r.dslope_h1); return v!==null && v<=c.dslopeH1DirMax; }],
    ["|dslH1|≤6.0",        r => { const v=num(r.dslope_h1); return v!==null && Math.abs(v)<=c.dslopeH1MaxAbs; }],
    ["dslH1≤-0.15",        r => { const v=num(r.dslope_h1); return v!==null && v<=-c.dslopeH1BuyMin; }],
    ["slopeM5<-0.05",      r => { const v=num(r.slope_m5); return v!==null && v<-tm5.slopeMin; }],
    ["dslopeM5<-0.05",     r => { const v=num(r.dslope_m5); return v!==null && v<-tm5.dslopeMin; }],
    ["zscore≤0 (midline)", r => { const v=num(r.zscore_h1); return v===null || v<=c.zscoreH1SellMax; }],
    ["zscore≥-1.0 (BB)",   r => { const v=num(r.zscore_h1); return v===null || v>=c.zscoreH1SellMin; }],
    ["dz≥-0.4",            r => { const v=num(r.dz_h1); return v===null || v>=c.dzH1SellMin; }],
    ["dzRepli≥0.01",       r => {
      const z=num(r.zscore_h1), d=num(r.dz_h1);
      return !(z!==null && d!==null && z>c.zscoreH1SellMin && d>-c.dzH1RepliMin);
    }],
  ];

  let pool = rows.filter(r => {
    if (!r.timestamp) return false;
    const s=num(r.slope_h1), ds=num(r.dslope_h1), rh=num(r.rsi_h1),
          rm=num(r.rsi_m5), sm=num(r.slope_m5), dm=num(r.dslope_m5);
    if (s===null||ds===null||rh===null||rm===null||sm===null||dm===null) return false;
    return s < 0;
  });
  console.log(`  Base: barres H1 baissières (slope_h1<0): ${pool.length}`);
  for (const [label, fn] of filters) {
    const before = pool.length;
    pool = pool.filter(fn);
    console.log(`  Après ${label.padEnd(22)}: ${pool.length.toString().padStart(5)} restantes  [-${(before-pool.length).toString().padStart(4)}]`);
  }
  console.log(`  ══► SIGNAUX SELL: ${pool.length}`);
}

// ── 5. REVERSAL — entonnoir + distribution dbbz ────────────────────────────
console.log("\n── 5. REVERSAL — entonnoir + distribution dbbz quand RSI extrême ──────");
{
  const c = CFG_REVERSAL;
  const dbbzWhenBuy  = [];
  const dbbzWhenSell = [];
  let withRsiWin = 0, buyRsiOk = 0, sellRsiOk = 0, buySignal = 0, sellSignal = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.timestamp) continue;
    const rsiStats = getMinMaxRSI_H1(rows, i, c.rsiWindowH1);
    if (!rsiStats) continue;
    withRsiWin++;
    const dbbz = num(row.dz_h1);
    if (dbbz === null) continue;
    if (rsiStats.minRSI <= c.rsiBuyMax) {
      buyRsiOk++;
      dbbzWhenBuy.push(dbbz);
      if (dbbz >= c.dbbzBuyMin) buySignal++;
    }
    if (rsiStats.maxRSI >= c.rsiSellMin) {
      sellRsiOk++;
      dbbzWhenSell.push(dbbz);
      if (dbbz <= c.dbbzSellMax) sellSignal++;
    }
  }
  console.log(`  Barres avec fenêtre RSI H1 complète: ${withRsiWin}`);
  console.log(`  BUY — minRSI_h1≤${c.rsiBuyMax}: ${buyRsiOk} barres`);
  console.log(`    dz_h1 distrib: p10=${pct(dbbzWhenBuy,10).toFixed(4)} p25=${pct(dbbzWhenBuy,25).toFixed(4)} p50=${pct(dbbzWhenBuy,50).toFixed(4)} p75=${pct(dbbzWhenBuy,75).toFixed(4)} p90=${pct(dbbzWhenBuy,90).toFixed(4)}`);
  console.log(`    % avec dbbz>0.10: ${(dbbzWhenBuy.filter(v=>v>0.10).length/dbbzWhenBuy.length*100).toFixed(1)}%`);
  console.log(`    % avec dbbz>0.05: ${(dbbzWhenBuy.filter(v=>v>0.05).length/dbbzWhenBuy.length*100).toFixed(1)}%`);
  console.log(`    % avec dbbz>0.03: ${(dbbzWhenBuy.filter(v=>v>0.03).length/dbbzWhenBuy.length*100).toFixed(1)}%`);
  console.log(`    % avec dbbz>0.00: ${(dbbzWhenBuy.filter(v=>v>0.00).length/dbbzWhenBuy.length*100).toFixed(1)}%`);
  console.log(`    → signaux BUY actuel (dbbz≥0.10): ${buySignal}`);
  console.log(`  SELL — maxRSI_h1≥${c.rsiSellMin}: ${sellRsiOk} barres`);
  console.log(`    dz_h1 distrib: p10=${pct(dbbzWhenSell,10).toFixed(4)} p25=${pct(dbbzWhenSell,25).toFixed(4)} p50=${pct(dbbzWhenSell,50).toFixed(4)} p75=${pct(dbbzWhenSell,75).toFixed(4)} p90=${pct(dbbzWhenSell,90).toFixed(4)}`);
  console.log(`    % avec dbbz<-0.10: ${(dbbzWhenSell.filter(v=>v<-0.10).length/dbbzWhenSell.length*100).toFixed(1)}%`);
  console.log(`    % avec dbbz<-0.05: ${(dbbzWhenSell.filter(v=>v<-0.05).length/dbbzWhenSell.length*100).toFixed(1)}%`);
  console.log(`    % avec dbbz<-0.03: ${(dbbzWhenSell.filter(v=>v<-0.03).length/dbbzWhenSell.length*100).toFixed(1)}%`);
  console.log(`    % avec dbbz<0.00:  ${(dbbzWhenSell.filter(v=>v<0.00).length/dbbzWhenSell.length*100).toFixed(1)}%`);
  console.log(`    → signaux SELL actuel (dbbz≤-0.10): ${sellSignal}`);
}

// ── 6. SIMULATION AVEC SEUILS ALTERNATIFS ──────────────────────────────────
console.log("\n── 6. CONTINUATION — simulation seuils (BUY+SELL) ───────────────────");

function simContinuation(rows, cfg, tm5, tm1, label) {
  let buy = 0, sell = 0;
  for (const row of rows) {
    if (!row.timestamp) continue;
    const slope_h1  = num(row.slope_h1);
    const dslope_h1 = num(row.dslope_h1);
    const rsi_h1    = num(row.rsi_h1);
    const rsi_m5    = num(row.rsi_m5);
    const rsi_m1    = num(row.rsi_m1);
    const slope_m5  = num(row.slope_m5);
    const dslope_m5 = num(row.dslope_m5);
    const zscore_h1 = num(row.zscore_h1);
    const dz_h1     = num(row.dz_h1);
    if (slope_h1===null||dslope_h1===null||rsi_h1===null||
        rsi_m5===null||slope_m5===null||dslope_m5===null) continue;

    if (slope_h1 >= cfg.slopeH1Min &&
        rsi_h1 >= cfg.rsiBuyMin && rsi_h1 <= cfg.rsiBuyMax &&
        rsi_m5 <= tm5.rsiBuyMax &&
        (rsi_m1===null||rsi_m1<=tm1.rsiBuyMax) &&
        dslope_h1 >= cfg.dslopeH1DirMin &&
        Math.abs(dslope_h1) <= cfg.dslopeH1MaxAbs &&
        dslope_h1 >= cfg.dslopeH1BuyMin &&
        slope_m5 > tm5.slopeMin && dslope_m5 > tm5.dslopeMin &&
        (zscore_h1===null||zscore_h1>=cfg.zscoreH1BuyMin) &&
        (zscore_h1===null||zscore_h1<=cfg.zscoreH1BuyMax) &&
        (dz_h1===null||dz_h1<=cfg.dzH1BuyMax) &&
        !(zscore_h1!==null&&dz_h1!==null&&zscore_h1<cfg.zscoreH1BuyMax&&dz_h1<cfg.dzH1RepliMin)
    ) buy++;

    if (slope_h1 <= -cfg.slopeH1Min &&
        rsi_h1 >= cfg.rsiSellMin && rsi_h1 <= cfg.rsiSellMax &&
        rsi_m5 >= tm5.rsiSellMin &&
        (rsi_m1===null||rsi_m1>=tm1.rsiSellMin) &&
        dslope_h1 <= cfg.dslopeH1DirMax &&
        Math.abs(dslope_h1) <= cfg.dslopeH1MaxAbs &&
        dslope_h1 <= -cfg.dslopeH1BuyMin &&
        slope_m5 < -tm5.slopeMin && dslope_m5 < -tm5.dslopeMin &&
        (zscore_h1===null||zscore_h1<=cfg.zscoreH1SellMax) &&
        (zscore_h1===null||zscore_h1>=cfg.zscoreH1SellMin) &&
        (dz_h1===null||dz_h1>=cfg.dzH1SellMin) &&
        !(zscore_h1!==null&&dz_h1!==null&&zscore_h1>cfg.zscoreH1SellMin&&dz_h1>-cfg.dzH1RepliMin)
    ) sell++;
  }
  const tot = buy + sell;
  const x = tot > 0 ? (tot / (simContinuation._base||tot) * 1).toFixed(1) : "-";
  console.log(`  ${label.padEnd(32)}: BUY=${String(buy).padStart(4)}  SELL=${String(sell).padStart(4)}  TOTAL=${String(tot).padStart(5)}`);
  return tot;
}

const t0 = simContinuation(rows, CFG_CONTINUATION, TIMING_M5, TIMING_M1, "ACTUEL (zs≤1.0, dz≤0.4)");
simContinuation._base = t0;
simContinuation(rows, { ...CFG_CONTINUATION, zscoreH1BuyMax: 1.5, zscoreH1SellMin: -1.5 },                               TIMING_M5, TIMING_M1, "zscore±1.5, dz≤0.4");
simContinuation(rows, { ...CFG_CONTINUATION, zscoreH1BuyMax: 2.0, zscoreH1SellMin: -2.0 },                               TIMING_M5, TIMING_M1, "zscore±2.0, dz≤0.4");
simContinuation(rows, { ...CFG_CONTINUATION, dzH1BuyMax: 0.6, dzH1SellMin: -0.6 },                                        TIMING_M5, TIMING_M1, "zscore±1.0, dz≤0.6");
simContinuation(rows, { ...CFG_CONTINUATION, dzH1BuyMax: 0.8, dzH1SellMin: -0.8 },                                        TIMING_M5, TIMING_M1, "zscore±1.0, dz≤0.8");
simContinuation(rows, { ...CFG_CONTINUATION, zscoreH1BuyMax: 1.5, zscoreH1SellMin: -1.5, dzH1BuyMax: 0.6, dzH1SellMin: -0.6 }, TIMING_M5, TIMING_M1, "zscore±1.5, dz≤0.6");
simContinuation(rows, { ...CFG_CONTINUATION, zscoreH1BuyMax: 1.5, zscoreH1SellMin: -1.5, dzH1BuyMax: 0.8, dzH1SellMin: -0.8 }, TIMING_M5, TIMING_M1, "zscore±1.5, dz≤0.8");
simContinuation(rows, { ...CFG_CONTINUATION, zscoreH1BuyMax: 2.0, zscoreH1SellMin: -2.0, dzH1BuyMax: 0.6, dzH1SellMin: -0.6 }, TIMING_M5, TIMING_M1, "zscore±2.0, dz≤0.6");
simContinuation(rows, { ...CFG_CONTINUATION, zscoreH1BuyMax: 2.0, zscoreH1SellMin: -2.0, dzH1BuyMax: 0.8, dzH1SellMin: -0.8 }, TIMING_M5, TIMING_M1, "zscore±2.0, dz≤0.8");
simContinuation(rows, { ...CFG_CONTINUATION, zscoreH1BuyMax: 99, zscoreH1SellMin: -99, dzH1BuyMax: 99, dzH1SellMin: -99 }, TIMING_M5, TIMING_M1,  "zscore DÉSACTIVÉ");

console.log("\n── 7. REVERSAL — simulation seuils alternatifs dbbz ─────────────────");
function simReversal(rows, c, label) {
  let buy = 0, sell = 0;
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].timestamp) continue;
    const rsiStats = getMinMaxRSI_H1(rows, i, c.rsiWindowH1);
    if (!rsiStats) continue;
    const dbbz = num(rows[i].dz_h1);
    if (dbbz === null) continue;
    if (rsiStats.minRSI <= c.rsiBuyMax  && dbbz >= c.dbbzBuyMin)  buy++;
    if (rsiStats.maxRSI >= c.rsiSellMin && dbbz <= c.dbbzSellMax) sell++;
  }
  console.log(`  ${label.padEnd(32)}: BUY=${String(buy).padStart(4)}  SELL=${String(sell).padStart(4)}  TOTAL=${String(buy+sell).padStart(5)}`);
}
simReversal(rows, CFG_REVERSAL,                                                        "ACTUEL dbbz=±0.10");
simReversal(rows, { ...CFG_REVERSAL, dbbzBuyMin: 0.05, dbbzSellMax: -0.05 },           "dbbz=±0.05");
simReversal(rows, { ...CFG_REVERSAL, dbbzBuyMin: 0.03, dbbzSellMax: -0.03 },           "dbbz=±0.03");
simReversal(rows, { ...CFG_REVERSAL, dbbzBuyMin: 0.00, dbbzSellMax:  0.00 },           "dbbz=±0.00 (désactivé)");

console.log("\n" + "=".repeat(72) + "\n");
