// ============================================================================================
// cont_by_dominance.mjs — LE CONT DOIT-IL S'ABSTENIR QUAND LA DOMINANCE (ADX) EST FAIBLE ?
// --------------------------------------------------------------------------------------------
// INTUITION OWNER, répétée sur 2 cas : GERMANY_40 (ADX ~11) puis BTCUSD 26/06 13:19 (ADX 20,2,
//   dominance LOW, turn FLAT) — « pas de CONT quand aucune direction ne contrôle ».
//
// ⚠️ POURQUOI ON REMESURE : la grille dominance × dominanceTurn mesurée LE MATIN MÊME donnait
//   toutes les cases LOW POSITIVES. Elle est PÉRIMÉE — depuis, le régime est passé sur l'ic
//   (`734b029`) et les 2 gates thetaDay ont sauté (`5f8fb9f`, +1 896 trades). ⭐ Quand une source
//   change, ce qui a été calibré ou mesuré dessus est à REFAIRE, pas à citer.
//
// Usage : node --max-old-space-size=12288 stats/cont_by_dominance.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const mk = () => ({ n: 0, w: 0, l: 0, R: 0 });
const bump = (o, s) => { o.n++; o.R += s.R; if (s.outcome === "WIN") o.w++; else if (s.outcome === "LOSS") o.l++; };
const f3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
const wr = (o) => (o.w + o.l) ? (o.w / (o.w + o.l) * 100).toFixed(0) + "%" : "—";
const LVL = ["LOW", "MEDIUM", "HIGH", "EXTREME"], TRN = ["TURN_DOWN", "FALLING", "FLAT", "RISING", "TURN_UP"];
const G = {}, byLvl = {}, byAdx = {};
const EDG = [0, 15, 18, 20, 22, 25, 30, 35, 999];
const lab = (a) => { for (let i = 0; i < EDG.length - 1; i++) if (a < EDG[i + 1]) return `${EDG[i]}–${EDG[i + 1]}`; return "35+"; };
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (typeof s.R !== "number" || s.type === "EXHAUSTION") continue;
    const L = s.dominance ?? "?", T = s.dominanceTurn ?? "(null)";
    G[`${L}|${T}`] = G[`${L}|${T}`] || mk(); bump(G[`${L}|${T}`], s);
    byLvl[L] = byLvl[L] || mk(); bump(byLvl[L], s);
    if (Number.isFinite(s.adx)) { const k = lab(s.adx); byAdx[k] = byAdx[k] || mk(); bump(byAdx[k], s); }
  }
const tot = Object.values(byLvl).reduce((a, o) => a + o.n, 0);
console.log(`CONT par NIVEAU de dominance (n=${tot})\n`);
for (const L of LVL) { const o = byLvl[L]; if (!o) continue;
  console.log(`   ${L.padEnd(9)}${String(o.n).padStart(5)}  ${(o.n / tot * 100).toFixed(1).padStart(5)} %  WR ${wr(o).padStart(4)}  avgR ${f3(o.R / o.n)}  totalR ${(o.R >= 0 ? "+" : "") + o.R.toFixed(1)}`); }
console.log(`\nCONT par ADX H1 BRUT (les bandes masquent-elles un seuil ?)\n`);
for (let i = 0; i < EDG.length - 1; i++) { const k = `${EDG[i]}–${EDG[i + 1]}`; const o = byAdx[k]; if (!o) continue;
  console.log(`   ADX ${k.padEnd(8)}${String(o.n).padStart(5)}  WR ${wr(o).padStart(4)}  avgR ${f3(o.R / o.n)}  totalR ${(o.R >= 0 ? "+" : "") + o.R.toFixed(1)}`); }
console.log(`\nGRILLE dominance × dominanceTurn — avgR / n\n`);
console.log("   niveau ↓" + TRN.map((t) => t.padStart(14)).join(""));
for (const L of LVL) { let line = `   ${L.padEnd(9)}`;
  for (const T of TRN) { const o = G[`${L}|${T}`]; line += (o ? `${f3(o.R / o.n)}/${o.n}` : "—").padStart(14); }
  console.log(line); }
