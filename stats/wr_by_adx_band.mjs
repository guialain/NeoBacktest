// ============================================================================================
// wr_by_adx_band.mjs — RÉSULTAT (R) par niveau d'ADX à l'entrée, par stratégie. (owner 2026-07-20)
// --------------------------------------------------------------------------------------------
// QUESTION OWNER : « low ne marche pas bien pour CONT » — on tranche sur des OUTCOMES.
//
// POURQUOI ICI ET PAS SUR LE LIVE : l'ADX n'existe dans les archives live QUE depuis le 18/07
//   (EA v8.36, déployé le 17). Sur 599 trades clos, 6 seulement tombaient dans l'ère ADX.
//   `data/matrix` porte 6 mois d'historique AVEC l'ADX injecté (stats/add_adx.mjs) → seul jeu utile.
//
// ⚠ CE QUI EST MESURÉ : le moteur COURANT (matrixBacktest importe Matrix-Revolution, pas une copie),
//   donc DealTrigger M1 + porte « TURN de l'ADX » comprises. R = triple-barrière du simulateur.
//
// ⚠ BIAIS À GARDER EN TÊTE : les bandes 21/26,5/34 sont UNIVERSELLES alors que la médiane d'ADX va
//   de ~15 (GOLD) à ~47 (BRENT). « LOW » désigne donc en partie CERTAINS ACTIFS. La ventilation par
//   actif est imprimée pour que ce biais soit visible et non subi.
//
// Usage : node stats/wr_by_adx_band.mjs
// ============================================================================================
import fs from "fs";
import path from "path";

const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const BANDS = ["LOW", "MEDIUM", "HIGH", "EXTREME"];
const band = (a) => !Number.isFinite(a) ? null : a >= 34 ? "EXTREME" : a >= 26.5 ? "HIGH" : a >= 21 ? "MEDIUM" : "LOW";

// index timestamp → adx14_h1_c1, par fichier
function adxIndex(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const H = lines[0].split(";");
  const iTs = H.indexOf("timestamp"), iAdx = H.indexOf("adx14_h1_c1");
  const m = new Map();
  if (iTs < 0 || iAdx < 0) return m;
  for (let k = 1; k < lines.length; k++) {
    const F = lines[k].split(";");
    const a = Number(F[iAdx]);
    if (Number.isFinite(a)) m.set(F[iTs], a);
  }
  return m;
}

const agg = {};            // strategy → band → {n,w,l,R}
const bySymBand = {};      // symbole → band → n
const add = (st, b, s) => {
  agg[st] = agg[st] || {}; agg[st][b] = agg[st][b] || { n: 0, w: 0, l: 0, R: 0 };
  const c = agg[st][b]; c.n++; c.R += s.R; if (s.outcome === "WIN") c.w++; else if (s.outcome === "LOSS") c.l++;
};

let tot = 0, noAdx = 0;
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const file = path.join(D, f);
  const sym = f.replace(/\.csv$/i, "");
  const idx = adxIndex(file);
  for (const s of (runMatrixBacktest(file).signals || [])) {
    if (typeof s.R !== "number") continue;
    tot++;
    const a = idx.get(s.tsMT);
    const b = band(a);
    if (!b) { noAdx++; continue; }
    const st = s.strategy || "?";
    add(st, b, s);
    bySymBand[sym] = bySymBand[sym] || {}; bySymBand[sym][b] = (bySymBand[sym][b] || 0) + 1;
  }
}

const f3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
const f1 = (v) => (v >= 0 ? "+" : "") + v.toFixed(1);
console.log(`signaux ${tot} · sans ADX joignable ${noAdx}\n`);
for (const st of Object.keys(agg).sort()) {
  const T = BANDS.reduce((s, b) => s + (agg[st][b]?.n ?? 0), 0);
  console.log(`══ ${st}   (n = ${T})`);
  console.log(`   bande        n      WR        avgR       totalR`);
  for (const b of BANDS) {
    const c = agg[st][b]; if (!c) { console.log(`   ${b.padEnd(10)}   —`); continue; }
    const wr = (c.w + c.l) ? (c.w / (c.w + c.l) * 100).toFixed(1) + " %" : "—";
    console.log(`   ${b.padEnd(10)}${String(c.n).padStart(5)}  ${wr.padStart(7)}  ${f3(c.R / c.n).padStart(8)}  ${f1(c.R).padStart(9)}`);
  }
  console.log();
}
console.log("répartition des signaux par actif et bande (le biais « LOW = certains actifs ») :");
for (const [s, o] of Object.entries(bySymBand).sort())
  console.log(`  ${s.padEnd(12)}` + BANDS.map((b) => `${b[0]}${String(o[b] ?? 0).padStart(4)}`).join("  "));
