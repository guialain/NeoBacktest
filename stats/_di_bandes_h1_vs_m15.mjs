// _di_bandes_h1_vs_m15.mjs — `DI_LEVEL_BANDS` EST-IL VRAIMENT TF-AGNOSTIQUE ?
//
// 🎯 LE CODE L'AFFIRME, SUR UN SEUL DES QUATRE SEUILS : « TF-AGNOSTIQUE : p35 14,64/14,60
//   (DI+ H1/M15) · 14,70/14,30 (DI−). Ecart max 0,4. » Or `DI_LEVEL_BANDS = [7 · 14,5 · 20,5 · 32]`
//   compte QUATRE coupes. Le p35 ne concerne que la 2e. **Les trois autres n'ont jamais ete
//   comparees entre TF** — et le commentaire les couvre quand meme par son titre.
//   ⚠ C'est le motif « un commentaire ASSERTIF vieillit comme un chiffre en dur » : la phrase est
//   VRAIE sur ce qu'elle a mesure, et FAUSSE sur ce qu'elle laisse croire.
//
// 🔴 ET IL Y A UN INDICE MESURE QUI LA CONTREDIT : en basculant la famille `di` du ③ sur M15, la
//   population par bande a fortement bouge — `LOW` passe de 147 a 374 tirs (9,8 % -> 23,9 %),
//   `EXTREME_HIGH` de 19 a 41. Si les bandes etaient equivalentes, la repartition ne bougerait pas
//   autant.
//
// ⚠ Population = TOUTES les barres du dataset, lecture LIVE (`_s0`) — c'est l'instant pour lequel
//   les bornes ont ete calibrees (« CES BORNES SONT POUR LA LECTURE LIVE »).
// ⚠ Lignes MORTES exclues (>= 5 lignes au meme timestamp = panne broker).
//   usage : node stats/_di_bandes_h1_vs_m15.mjs
import fs from "fs"; import path from "path";
const { DI_LEVEL_BANDS, diLevelBand } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const COLS = ["timestamp", "plus_di_h1_s0", "minus_di_h1_s0", "plus_di_m15_s0", "minus_di_m15_s0"];
const acc = { "DI+ H1": [], "DI+ M15": [], "DI− H1": [], "DI− M15": [] };
const MORT = 5;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";"); const ix = {}; for (const c of COLS) ix[c] = h.indexOf(c);
  if (COLS.some((c) => ix[c] < 0)) continue;
  const nPar = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); nPar.set(c[ix.timestamp], (nPar.get(c[ix.timestamp]) ?? 0) + 1); }
  const gele = new Set([...nPar].filter(([, n]) => n >= MORT).map(([t]) => t));
  for (const l of L.slice(1)) {
    const c = l.split(";"); if (gele.has(c[ix.timestamp])) continue;
    const push = (k, v) => { const n = Number(v); if (v !== "" && Number.isFinite(n) && n > 0) acc[k].push(n); };
    push("DI+ H1", c[ix.plus_di_h1_s0]);   push("DI+ M15", c[ix.plus_di_m15_s0]);
    push("DI− H1", c[ix.minus_di_h1_s0]);  push("DI− M15", c[ix.minus_di_m15_s0]);
  }
}
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
console.log(`\n═══ \`DI_LEVEL_BANDS\` = [${DI_LEVEL_BANDS.join(" · ")}] — H1 CONTRE M15 ═══`);
console.log(`\n  ── ① LES QUANTILES AUX QUATRE COUPES ──`);
console.log("  " + "serie".padEnd(10) + "n".padStart(9) + "p05".padStart(9) + "p35".padStart(9) + "p50".padStart(9) + "p65".padStart(9) + "p95".padStart(9) + "  moyenne");
console.log("  " + "─".repeat(74));
for (const k of Object.keys(acc)) { const a = acc[k].sort((x, y) => x - y);
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  console.log("  " + k.padEnd(10) + String(a.length).padStart(9) + q(a,.05).toFixed(2).padStart(9) + q(a,.35).toFixed(2).padStart(9)
    + q(a,.50).toFixed(2).padStart(9) + q(a,.65).toFixed(2).padStart(9) + q(a,.95).toFixed(2).padStart(9) + m.toFixed(2).padStart(10)); }

console.log(`\n  ── ② LA REPARTITION PAR BANDE — c'est ELLE qui dit si les bornes sont equivalentes ──`);
const NIV = ["EXTREME_LOW", "LOW", "MEDIUM", "HIGH", "EXTREME_HIGH"];
console.log("  " + "serie".padEnd(10) + NIV.map((n) => n.padStart(14)).join(""));
console.log("  " + "─".repeat(10 + 14 * NIV.length));
const part = {};
for (const k of Object.keys(acc)) { const a = acc[k];
  const c = {}; for (const n of NIV) c[n] = 0;
  for (const v of a) { const b = diLevelBand(v); if (b) c[b]++; }
  part[k] = c;
  console.log("  " + k.padEnd(10) + NIV.map((n) => ((100 * c[n] / a.length).toFixed(1) + " %").padStart(14)).join("")); }
console.log("  " + "─".repeat(10 + 14 * NIV.length));
console.log("  " + "ecart H1/M15".padEnd(10) + NIV.map((n) => {
  const d = 100 * part["DI+ M15"][n] / acc["DI+ M15"].length - 100 * part["DI+ H1"][n] / acc["DI+ H1"].length;
  return (((d >= 0 ? "+" : "") + d.toFixed(1)) + " pt").padStart(14); }).join("") + "   (DI+)");
console.log(`\n  ⚠ Une borne « TF-agnostique » doit rendre la MEME REPARTITION sur les deux horloges.`);
console.log(`     Un ecart de quelques points sur une bande signifie que la meme note designe deux`);
console.log(`     populations differentes selon le TF — et qu'aucune mesure faite sur l'une ne vaut`);
console.log(`     pour l'autre.\n`);
