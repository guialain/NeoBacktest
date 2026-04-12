// diag_gen_intradayconfig.mjs — recalibre IntradayConfig.js depuis context CSVs H1
// Percentiles sur intraday_change : P1/P5/P20/P30 | P70/P80/P95/P99
// Usage: npx vite-node diag_gen_intradayconfig.mjs

import fs from "fs";
import path from "path";

const CTX_DIR = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/backtest/intraday contexte";

function parseCSV(f) {
  const lines = fs.readFileSync(f, "utf-8").trim().split("\n");
  const headers = lines[0].split(";").map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(";");
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i]?.trim());
    return obj;
  });
}

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const r2  = v => Math.round(v * 100) / 100;

function pct(sorted, p) {
  const idx = Math.min(Math.floor(sorted.length * p / 100), sorted.length - 1);
  return sorted[idx];
}

const files = fs.readdirSync(CTX_DIR)
  .filter(f => f.endsWith("_H1_context.csv"))
  .sort();

const GROUPS = {
  "FX":     ["EURUSD","GBPUSD","USDJPY","USDCHF","USDCAD","AUDUSD","NZDUSD","EURJPY","GBPJPY","EURCHF"],
  "INDEX":  ["UK_100","GERMANY_40","FRANCE_40","US_30","US_500","US_TECH100","JAPAN_225"],
  "CRYPTO": ["BTCUSD","BTCEUR","BTCJPY","ETHUSD"],
  "METAL":  ["GOLD","SILVER"],
  "ENERGY": ["CrudeOIL","BRENT_OIL","GASOLINE"],
  "AGRI":   ["WHEAT"],
};

// ── Résumé stderr ────────────────────────────────────────────────────────────
process.stderr.write(`\n${"ASSET".padEnd(14)} ${"N".padStart(6)}  ${"P1".padStart(7)} ${"P5".padStart(7)} ${"P20".padStart(7)} ${"P30".padStart(7)} ${"P70".padStart(7)} ${"P80".padStart(7)} ${"P95".padStart(7)} ${"P99".padStart(7)}\n`);
process.stderr.write("─".repeat(82) + "\n");

const results = {};

for (const file of files) {
  const sym = file.replace(/_H1_context\.csv$/, "");
  const rows = parseCSV(path.join(CTX_DIR, file));
  const vals = rows.map(r => num(r.intraday_change)).filter(v => v !== null).sort((a,b) => a-b);
  if (!vals.length) continue;

  const cfg = {
    n:            vals.length,
    spikeDown:    r2(pct(vals,  1)),
    explosiveDown:r2(pct(vals,  5)),
    strongDown:   r2(pct(vals, 20)),
    softUp:       r2(Math.max(Math.abs(pct(vals, 30)), pct(vals, 70))),
    softDown:     r2(-Math.max(Math.abs(pct(vals, 30)), pct(vals, 70))),
    strongUp:     r2(pct(vals, 80)),
    explosiveUp:  r2(pct(vals, 95)),
    spikeUp:      r2(pct(vals, 99)),
  };
  results[sym] = cfg;

  process.stderr.write(
    `${sym.padEnd(14)} ${String(cfg.n).padStart(6)}  ` +
    `${String(cfg.spikeDown).padStart(7)} ${String(cfg.explosiveDown).padStart(7)} ` +
    `${String(cfg.strongDown).padStart(7)} ${String(cfg.softDown).padStart(7)} ` +
    `${String(cfg.softUp).padStart(7)} ${String(cfg.strongUp).padStart(7)} ` +
    `${String(cfg.explosiveUp).padStart(7)} ${String(cfg.spikeUp).padStart(7)}\n`
  );
}

// ── Generate IntradayConfig.js ───────────────────────────────────────────────
const lines = [];
lines.push("// ============================================================================");
lines.push("// IntradayConfig.js — 9 régimes intraday, calibrés sur context CSVs H1");
lines.push("//");
lines.push("//  Régime            Percentile    Borne basse (cfg)");
lines.push("//  ────────────────────────────────────────────────");
lines.push("//  ⚡ SPIKE_DOWN      < P1          spikeDown");
lines.push("//  🟥 EXPLOSIVE_DOWN  P1  – P5      explosiveDown");
lines.push("//  🔻 STRONG_DOWN     P5  – P20     strongDown");
lines.push("//  ⬇️  SOFT_DOWN      P20 – P30     softDown");
lines.push("//  ➖ NEUTRE          P30 – P70     (entre softDown et softUp)");
lines.push("//  ↗️  SOFT_UP        P70 – P80     softUp");
lines.push("//  ⬆️  STRONG_UP      P80 – P95     strongUp");
lines.push("//  🟩 EXPLOSIVE_UP   P95 – P99     explosiveUp");
lines.push("//  ⚡ SPIKE_UP        > P99         spikeUp");
lines.push("//");
lines.push("// Sources : context CSVs (intraday contexte/) — données H1 longues");
lines.push("// ============================================================================");
lines.push("");
lines.push("export const INTRADAY_CONFIG = {");
lines.push("");

const printed = new Set();

for (const [grp, syms] of Object.entries(GROUPS)) {
  const available = syms.filter(s => results[s]);
  if (!available.length) continue;
  lines.push(`  // ── ${grp} ${"─".repeat(73 - grp.length)}`);
  for (const sym of available) {
    const c = results[sym];
    lines.push(`  ${sym}: { // ${c.n} bars [ctx]`);
    lines.push(`    spikeDown: ${c.spikeDown}, explosiveDown: ${c.explosiveDown}, strongDown: ${c.strongDown}, softDown: ${c.softDown},`);
    lines.push(`    softUp: ${c.softUp}, strongUp: ${c.strongUp}, explosiveUp: ${c.explosiveUp}, spikeUp: ${c.spikeUp},`);
    lines.push(`  },`);
    printed.add(sym);
  }
  lines.push("");
}

// Reste non classé
const rest = Object.keys(results).filter(s => !printed.has(s));
if (rest.length) {
  lines.push("  // ── Autres ─────────────────────────────────────────────────────────────");
  for (const sym of rest) {
    const c = results[sym];
    lines.push(`  ${sym}: { // ${c.n} bars [ctx]`);
    lines.push(`    spikeDown: ${c.spikeDown}, explosiveDown: ${c.explosiveDown}, strongDown: ${c.strongDown}, softDown: ${c.softDown},`);
    lines.push(`    softUp: ${c.softUp}, strongUp: ${c.strongUp}, explosiveUp: ${c.explosiveUp}, spikeUp: ${c.spikeUp},`);
    lines.push(`  },`);
  }
  lines.push("");
}

lines.push("  // ── Default — actifs sans context CSV ─────────────────────────────────────");
lines.push("  default: {");
lines.push("    spikeDown: -2.00, explosiveDown: -1.00, strongDown: -0.50, softDown: -0.25,");
lines.push("    softUp: 0.25, strongUp: 0.50, explosiveUp: 1.00, spikeUp: 2.00,");
lines.push("  },");
lines.push("};");
lines.push("");

console.log(lines.join("\n"));
process.stderr.write(`\nAssets calibrés: ${Object.keys(results).length}\n`);
