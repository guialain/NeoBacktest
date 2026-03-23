import { readFileSync } from "fs";

const MT5_DIR = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/backtest";
const FILE    = "EURUSD_5min.csv";

const { default: TopOpportunities } = await import("./src/components/robots/TopOpportunities.js");
const { default: SignalFilters }     = await import("./src/components/robots/SignalFilters.js");

// ── Load CSV ────────────────────────────────────────────────────────────────
const lines   = readFileSync(`${MT5_DIR}/${FILE}`, "utf8").split(/\r?\n/).filter(l => l.trim());
const headers = lines[0].split(";").map(h => h.trim());
const rows    = lines.slice(1).map((l, i) => {
  const r = { index: i };
  l.split(";").forEach((v, j) => {
    const n = Number(v.trim());
    r[headers[j]] = Number.isFinite(n) ? n : v.trim();
  });
  return r;
});

console.log(`File: ${FILE}  (${rows.length} bars)\n`);

// ── Generate + filter ───────────────────────────────────────────────────────
const raw = TopOpportunities.evaluate(rows, { debug: false });
const { validOpportunities, waitOpportunities } = SignalFilters.evaluate({ opportunities: raw });

const rev  = s => String(s.type ?? "").toUpperCase() !== "CONTINUATION";
const cont = s => String(s.type ?? "").toUpperCase() === "CONTINUATION";

// ── Funnel ──────────────────────────────────────────────────────────────────
console.log("════════════ FUNNEL ════════════");
console.log(`Raw signals : ${raw.length}  (reversal=${raw.filter(rev).length}  continuation=${raw.filter(cont).length})`);
console.log(`Valid       : ${validOpportunities.length}  (reversal=${validOpportunities.filter(rev).length}  continuation=${validOpportunities.filter(cont).length})`);
console.log(`Pass rate   : ${(validOpportunities.length / raw.length * 100).toFixed(1)}%\n`);

// ── Wait states ─────────────────────────────────────────────────────────────
const waitCounts = {};
for (const s of waitOpportunities) {
  const k = s.state ?? "UNKNOWN";
  waitCounts[k] = (waitCounts[k] ?? 0) + 1;
}
console.log("── WAIT states ──");
Object.entries(waitCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k.padEnd(30)} ${String(v).padStart(5)}  (${(v / raw.length * 100).toFixed(1)}%)`));

// ── Side breakdown ──────────────────────────────────────────────────────────
console.log("\n── Valid breakdown ──");
const sides = { BUY: 0, SELL: 0 };
const phases = {};
for (const s of validOpportunities) {
  sides[s.side] = (sides[s.side] ?? 0) + 1;
  if (s.signalPhase) phases[s.signalPhase] = (phases[s.signalPhase] ?? 0) + 1;
  else if (s.signalType) phases[s.signalType] = (phases[s.signalType] ?? 0) + 1;
}
console.log(`  BUY=${sides.BUY}  SELL=${sides.SELL}`);
console.log("  Phases/types :");
Object.entries(phases).sort((a,b) => b[1]-a[1])
  .forEach(([k, v]) => console.log(`    ${k.padEnd(28)} ${v}`));

// ── Vol regimes ─────────────────────────────────────────────────────────────
const volRegimes = {};
for (const s of validOpportunities) {
  const r = s.volatilityRegime ?? "?";
  volRegimes[r] = (volRegimes[r] ?? 0) + 1;
}
console.log("\n── Vol regimes (valid) ──");
Object.entries(volRegimes).sort((a,b) => b[1]-a[1])
  .forEach(([k, v]) => console.log(`  ${k.padEnd(10)} ${v}`));
