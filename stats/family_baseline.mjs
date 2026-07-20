// ============================================================================================
// family_baseline.mjs — POIDS et QUALITÉ de chaque famille de signal (CONT · EXH).
// --------------------------------------------------------------------------------------------
// MÉTHODE owner 2026-07-20 : tout changement est MESURÉ dans le backtest AVANT le live. Ce script
//   est LE point de comparaison entre deux états du moteur.
//
// ⛔ EX-`transitioning_baseline.mjs`. La famille `transitioning` est SUPPRIMÉE du moteur (Matrix
//   `1f798c9`) : une fois le régime sorti de l'arbre elle tombait à avgR +0,000 sur 3 973 trades —
//   du volume SANS SIGNAL. Les sections « scores de transition » et « voie empruntée » sortent donc
//   VIDES. ⭐ Elles sont GARDÉES COMME VERROUS : si elles se repeuplent un jour, c'est que quelqu'un
//   a re-câblé une voie de tir sans le dire.
//
// CE QU'ON LIT :
//   1. POIDS    part de chaque famille dans le volume ET dans le R total.
//   2. QUALITÉ  WR / avgR / totalR. ⭐ Lire l'avgR, PAS le totalR : élargir une famille monte
//      TOUJOURS son totalR (plus de volume) tout en baissant sa qualité.
//   3. ⭐⭐ CONCLURE SUR LE TOTAL UNIVERS, jamais sur la seule famille touchée — les familles se
//      VOLENT du volume. Mesuré : ouvrir l'exh aux cross âgés lui fait gagner +5,7 R mais en
//      RETIRE 83 signaux et 10,3 R à CONT ⇒ univers NÉGATIF (−4,6 R). Cf. `fa86826`.
//
// 🎯 LIMITE CONNUE : `crossoverMaturity` n'est pas porté sur le signal ⇒ on ne peut PAS séparer
//    FRESH de CONFIRMED dans la cohorte EXH. Toute attribution se fait PAR DIFFÉRENCE DE RUNS.
//
// Usage : node --max-old-space-size=12288 stats/family_baseline.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const fam = {};        // famille → {n,w,l,R}
const byAsset = {};    // actif → famille → {n,R}
const scoreHist = {};  // score arrondi → {n,R,w,l}
const crossSplit = { avecCross: { n: 0, R: 0, w: 0, l: 0 }, sansCross: { n: 0, R: 0, w: 0, l: 0 } };

const bump = (o, s) => { o.n++; o.R += s.R; if (s.outcome === "WIN") o.w++; else if (s.outcome === "LOSS") o.l++; };
const mk = () => ({ n: 0, w: 0, l: 0, R: 0 });

for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  byAsset[asset] = byAsset[asset] || {};
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (typeof s.R !== "number") continue;
    // `type` distingue TRANS (profil « Transitioning ») de la famille EXH pure et de CONTINUATION
    const k = s.type === "TRANS" ? "transitioning" : s.type === "EXHAUSTION" ? "exh pur" : "continuation";
    fam[k] = fam[k] || mk(); bump(fam[k], s);
    byAsset[asset][k] = byAsset[asset][k] || mk(); bump(byAsset[asset][k], s);
    if (k !== "transitioning") continue;
    const sc = Number.isFinite(s.confidence) ? s.confidence.toFixed(3) : "n/a";
    scoreHist[sc] = scoreHist[sc] || mk(); bump(scoreHist[sc], s);
    const hc = s.trans && s.trans.hasCross;
    bump(hc ? crossSplit.avecCross : crossSplit.sansCross, s);
  }
}

const f3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
const f1 = (v) => (v >= 0 ? "+" : "") + v.toFixed(1);
const wr = (o) => (o.w + o.l) ? (o.w / (o.w + o.l) * 100).toFixed(1) + " %" : "—";
const TOTn = Object.values(fam).reduce((a, o) => a + o.n, 0);
const TOTR = Object.values(fam).reduce((a, o) => a + o.R, 0);

console.log(`BASELINE — ${TOTn} signaux · totalR ${f1(TOTR)}\n`);
console.log("famille          n      part      WR       avgR       totalR    part du R");
for (const [k, o] of Object.entries(fam).sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${k.padEnd(14)}${String(o.n).padStart(5)}  ${(o.n / TOTn * 100).toFixed(1).padStart(5)} %  ${wr(o).padStart(7)}  ${f3(o.R / o.n).padStart(8)}  ${f1(o.R).padStart(9)}  ${(o.R / TOTR * 100).toFixed(1).padStart(6)} %`);

console.log(`\n⭐ SCORES DE TRANSITION RÉELLEMENT ATTEINTS (seuil de tir = 0,70)`);
console.log("   score      n      WR       avgR      totalR");
for (const [sc, o] of Object.entries(scoreHist).sort((a, b) => Number(a[0]) - Number(b[0])))
  console.log(`   ${sc.padStart(6)}${String(o.n).padStart(7)}  ${wr(o).padStart(7)}  ${f3(o.R / o.n).padStart(8)}  ${f1(o.R).padStart(9)}`);

console.log(`\nvoie empruntée :`);
for (const [k, o] of Object.entries(crossSplit))
  console.log(`   ${k.padEnd(11)}${String(o.n).padStart(6)}  ${wr(o).padStart(7)}  avgR ${f3(o.n ? o.R / o.n : 0)}  totalR ${f1(o.R)}`);

console.log(`\ntransitioning par actif (n · totalR) :`);
for (const [a, o] of Object.entries(byAsset).sort((x, y) => (y[1].transitioning?.R ?? 0) - (x[1].transitioning?.R ?? 0))) {
  const t = o.transitioning; if (!t) continue;
  console.log(`   ${a.padEnd(12)}${String(t.n).padStart(5)}  ${wr(t).padStart(7)}  avgR ${f3(t.R / t.n)}  totalR ${f1(t.R).padStart(8)}`);
}
