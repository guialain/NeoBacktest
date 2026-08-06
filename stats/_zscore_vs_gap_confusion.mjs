// _zscore_vs_gap_confusion.mjs — LES DEUX AXES DU « ZSCORE » EXH PORTENT-ILS LE MÊME NOM ?
//
// 🔴 LA QUESTION (owner 2026-08-06) : l'expert s'appelle `zscore`, mais depuis le 02/08 son NIVEAU
//   vient du GAP en ATR (`gapLevel(gapAtrClose)`) et sa COLONNE de la pente du gap. Le zscore n'y
//   entre plus que par deux portes (`z === 0` ⇒ muet) et par un REPLI. Or les deux échelles
//   partagent les SIX MÊMES NOMS de barreau (`NO_TENSION`…`SNAPPED`) :
//
//     zLevel(z)          |P − M| / σ           bornes GLOBALES  [0,30 · 1,05 · 1,55 · 2,15 · 2,60]
//     gapLevel(gapAtr)   |P − M| / ATR_p50     bornes PAR ACTIF (`DEVIATION_BANDS.gap`)
//
//   Même numérateur, DEUX dénominateurs. Si les deux classent différemment, alors le repli applique
//   la table du fade à une métrique qui n'est pas celle sur laquelle elle a été calibrée — sans
//   erreur, sous le même vocabulaire.
//
// ⚠ MESURÉ À LA CLÔTURE des deux côtés, comme le fait `gapExhScore` : `zscore_h1` (nue = clôture)
//   contre `(close_h1_s1 − middle_h1_s1) / ATR_p50`. Mélanger un live et un close ici fabriquerait
//   un désaccord qui n'existe pas.
import fs from "fs";
import { getATRConfig } from "../../Matrix-Revolution/src/components/robot/engines/config/ATRConfig.js";
import { zLevel } from "../../Matrix-Revolution/src/components/robot/engines/scoring/experts/zscoreExpert.js";
import { gapLevel } from "../../Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";

const DIR = "data/matrix";
const LEVELS = ["NO_TENSION", "SLACK", "TENSE", "TENSE_HIGH", "EXTREME", "SNAPPED"];
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);

const assets = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"))
  .map((f) => f.replace(/\.csv$/i, "")).sort();

let nTot = 0, nBoth = 0, nAgree = 0, nGapNull = 0, nZNull = 0;
const conf = {};                                   // zLevel → gapLevel → n
const byAsset = {};
for (const sym of assets) {
  const p50 = getATRConfig(sym, "H1")?.p50; if (!p50) continue;
  const L = fs.readFileSync(`${DIR}/${sym}.csv`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const a = (byAsset[sym] ??= { n: 0, both: 0, agree: 0, gapNull: 0 });
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const z = num(c[I["zscore_h1"]]);
    const close1 = num(c[I["close_h1_s1"]]), mid1 = num(c[I["middle_h1_s1"]]);
    const price = num(c[I["price"]]);
    nTot++; a.n++;
    // ⚠ MÊME FORMULE QUE `atrP50Price` : `ATR_PCT_X1000` ⇒ /100000 × prix. L'oublier fausse de 10⁵.
    const atr = (price != null && price > 0) ? (p50 / 100000) * price : null;
    const gapAtr = (close1 != null && mid1 != null && atr) ? (close1 - mid1) / atr : null;
    const zl = zLevel(z), gl = gapLevel(gapAtr, sym);
    if (z == null) nZNull++;
    if (gapAtr == null) { nGapNull++; a.gapNull++; }
    if (!zl || !gl) continue;
    nBoth++; a.both++;
    ((conf[zl] ??= {})[gl] ??= 0); conf[zl][gl]++;
    if (zl === gl) { nAgree++; a.agree++; }
  }
}

console.log(`lignes ${nTot} · z absent ${nZNull} · gap NON CALCULABLE ${nGapNull} ` +
            `(${(100 * nGapNull / nTot).toFixed(2)} %) · comparables ${nBoth}`);
console.log(`ACCORD zLevel === gapLevel : ${nAgree} / ${nBoth} = ${(100 * nAgree / nBoth).toFixed(2)} %\n`);

console.log("MATRICE  ligne = zLevel(zClosed)  ·  colonne = gapLevel(gapAtrClose)  ·  % de la ligne");
console.log("".padEnd(13) + LEVELS.map((l) => l.slice(0, 9).padStart(10)).join("") + "     n");
for (const zl of LEVELS) {
  const row = conf[zl] ?? {}; const tot = Object.values(row).reduce((a, b) => a + b, 0);
  if (!tot) continue;
  console.log(zl.padEnd(13) +
    LEVELS.map((gl) => {
      const v = row[gl] ?? 0, pct = (100 * v) / tot;
      return (pct === 0 ? "·" : pct.toFixed(1)).padStart(10);
    }).join("") + String(tot).padStart(8));
}

console.log("\nPAR ACTIF — accord et part de gap non calculable");
console.log("actif           n        accord   gap absent");
for (const [s, v] of Object.entries(byAsset).sort((a, b) => a[1].agree / a[1].both - b[1].agree / b[1].both)) {
  if (!v.both) continue;
  console.log(s.padEnd(14) + String(v.n).padStart(7) + "  " +
    ((100 * v.agree / v.both).toFixed(1) + " %").padStart(8) + "  " +
    ((100 * v.gapNull / v.n).toFixed(1) + " %").padStart(8));
}
