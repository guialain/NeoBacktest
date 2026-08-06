// _drsi_h4_identite.mjs — `drsi_h4_s0` EST-IL LA MEME SERIE QUE `rsi_h4_s0 − rsi_h4` ?
// 🔴🔥 POURQUOI CETTE VERIFICATION AVANT D'APPLIQUER `rsiDeltaCol` : ce depot a deja paye pour
//   `dslope_h1_s0`, un ALIAS TROMPEUR — 0 coincidence sur 371 697 lignes avec la derivee qu'il
//   pretendait nommer. `RSI_DELTA_CUTS = [0,95 · 3,09 · 6,00]` est calibre sur le dRsi CALCULE
//   (`rsi_s0 − rsi_cloture`). Le plaquer sur une colonne du scan qui ne serait pas la meme serie,
//   c'est « un seuil se perime avec son CAPTEUR », en pire : le seuil n'aurait jamais ete valide.
import fs from "fs";
const DIR = "data/matrix";
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const q = (t, p) => t.length ? t[Math.min(t.length - 1, Math.floor(t.length * p))] : null;

const assets = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"))
  .map((f) => f.replace(/\.csv$/i, "")).sort();

let n = 0, idem = 0, cols = null;
const ecarts = [], colScan = [], calcul = [];
for (const sym of assets) {
  const L = fs.readFileSync(`${DIR}/${sym}.csv`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  if (cols === null) cols = ["drsi_h4_s0", "rsi_h4_s0", "rsi_h4", "drsi_h4"]
    .map((c) => `${c}:${I[c] == null ? "ABSENTE" : "ok"}`).join("  ");
  if (I["drsi_h4_s0"] == null || I["rsi_h4_s0"] == null || I["rsi_h4"] == null) continue;
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const dScan = num(c[I["drsi_h4_s0"]]);
    const s0 = num(c[I["rsi_h4_s0"]]), cl = num(c[I["rsi_h4"]]);
    if (dScan === null || s0 === null || cl === null) continue;
    const dCalc = +(s0 - cl).toFixed(4);
    n++; colScan.push(dScan); calcul.push(dCalc);
    const e = Math.abs(dScan - dCalc);
    ecarts.push(e);
    if (e < 0.005) idem++;
  }
}
console.log("colonnes :", cols);
console.log(`\nlignes comparables : ${n}`);
console.log(`identiques (|écart| < 0,005) : ${idem}  =  ${(100 * idem / n).toFixed(2)} %`);
const E = ecarts.sort((a, b) => a - b);
console.log(`|écart|  p50 ${q(E, .5).toFixed(3)}  p90 ${q(E, .9).toFixed(3)}  p99 ${q(E, .99).toFixed(3)}  max ${E[E.length - 1].toFixed(3)}`);

const A = colScan.map(Math.abs).sort((a, b) => a - b);
const B = calcul.map(Math.abs).sort((a, b) => a - b);
console.log(`\nÉCHELLE — c'est ce qui décide si RSI_DELTA_CUTS [0,95 · 3,09 · 6,00] s'applique :`);
console.log(`  |drsi_h4_s0|   (colonne scan) p50 ${q(A, .5).toFixed(2)}  p75 ${q(A, .75).toFixed(2)}  p90 ${q(A, .90).toFixed(2)}  p99 ${q(A, .99).toFixed(2)}`);
console.log(`  |rsi_h4_s0−rsi_h4| (calculé)  p50 ${q(B, .5).toFixed(2)}  p75 ${q(B, .75).toFixed(2)}  p90 ${q(B, .90).toFixed(2)}  p99 ${q(B, .99).toFixed(2)}`);
