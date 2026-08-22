// _cont_rsi_pos_effet.mjs — LA FAMILLE `rsi` DU ③ EST-ELLE ENCORE UNE CONSTANTE ?
// 🎯 Avant (table croisee, RSI CLOTURE) : `rsi` = 8,0 sur **14/14** des tirs de la bande haute.
//    3 notes couvraient 99,9 % du volume. La famille TRANSLATAIT, elle ne TRIAIT pas.
// ⚠ On mesure la DISPERSION de la note, pas sa performance : une famille qui ne varie pas ne peut
//   rien trier, quel que soit son WR. C'est le prealable, la perf vient apres.
//   usage : node stats/_cont_rsi_pos_effet.mjs   [MIN_CONT=3]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "3";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s));
const note = (s) => s.sc?.boxes?.cont?.familles?.rsi;
const v = CONT.map(note).filter(Number.isFinite).sort((a, b) => a - b);
console.log(`\n═══ FAMILLE \`rsi\` DU ③ — DISPERSION DE LA NOTE ═══  [MIN_CONT=${process.env.MIN_CONT}]`);
console.log(`  ${CONT.length} tirs CONT · ${v.length} avec une note \`rsi\` · ${CONT.length - v.length} muets`);
if (!v.length) { console.log("  🔴 AUCUNE NOTE — la famille est morte."); process.exit(1); }
const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
console.log(`  min ${v[0].toFixed(2)} · p25 ${q(.25).toFixed(2)} · median ${q(.5).toFixed(2)} · p75 ${q(.75).toFixed(2)} · max ${v[v.length - 1].toFixed(2)}`);
const u = new Set(v.map((x) => x.toFixed(2)));
console.log(`  valeurs DISTINCTES : ${u.size}   (avant le 22/08 : 3 notes couvraient 99,9 % du volume)`);
console.log(`\n  ── repartition par palier de 1 ──`);
for (let lo = 0; lo < 10; lo++) {
  const n = v.filter((x) => x >= lo && x < lo + 1).length;
  if (!n) continue;
  console.log("  " + `[${lo} · ${lo + 1}[`.padEnd(10) + String(n).padStart(7) + ("  " + (100 * n / v.length).toFixed(1) + " %").padStart(10)
    + "  " + "█".repeat(Math.round(50 * n / v.length)));
}
const n10 = v.filter((x) => x >= 10).length;
if (n10) console.log("  " + "10".padEnd(10) + String(n10).padStart(7) + ("  " + (100 * n10 / v.length).toFixed(1) + " %").padStart(10) + "  " + "█".repeat(Math.round(50 * n10 / v.length)));
console.log("");
