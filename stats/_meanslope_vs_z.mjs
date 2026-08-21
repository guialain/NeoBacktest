// _meanslope_vs_z.mjs — `meanSlope` ET `z` SONT-ILS VRAIMENT DEUX HORLOGES ORTHOGONALES ?
//
// 🎯 PREREQUIS NOMME : l'argument qui justifie d'ajouter `meanSlope` au barema ③ est qu'il lit le
//   TREND LENT la ou `z` lit le PRIX RAPIDE — donc qu'il apporte une information que le barema n'a
//   pas deja. Un chiffre de `−0,15` circule pour l'etayer ; **il n'est ecrit dans AUCUN fichier du
//   depot**. Un argument porte par un nombre non source est un argument qu'on ne peut pas rejouer.
//   ⇒ on le mesure.
//
// ⭐⭐ CE QUI EST COMPARE, ET POURQUOI CES PAIRES-LA :
//     `meanSlope`      = (moyenne LIVE − `middle_h1_s1`) / ATR_P50 — le deplacement du CENTRE.
//     `zscore_h1`      = le prix a la CLOTURE, en sigmas — la position, horloge lente.
//     `zscore_h1_s0`   = le prix LIVE — la position, horloge rapide.
//   Les deux formes de `z` sont mesurees separement : elles ne decrivent pas le meme instant, et
//   c'est precisement l'objet du test. ⚠ Ne PAS conclure de l'une a l'autre.
//
// ⚠⚠ ON MESURE AUSSI LES VERSIONS **ORIENTEES** (`x * sens`). Deux grandeurs peuvent etre
//   decorrelees en brut et fortement correlees une fois orientees par le meme `regDir` — l'orientation
//   introduit une variable commune. C'est exactement le piege du TERME PARTAGE deja rencontre deux
//   fois aujourd'hui (`ecart = dRsiLive + …` au rang ②, zone live x rang au rang ③). Ne pas le
//   verifier ici serait ne pas avoir appris.
//
// ⚠ Population : le RESIDU du rang ③ (`rangCont`), cote par cote — c'est la ou l'entree vivrait.
//   ⛔ PAS sur les tirs : on decrit une population, pas une selection.
//   usage : node stats/_meanslope_vs_z.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const D = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { computeDeviation } = await import(D);
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

const S = { BUY: [], SELL: [] };
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f), sym = path.basename(f, ".csv");
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); const o = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = c[i]; rows.set(o.timestamp, o); }
  for (const x of (prepareAsset(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes" || !x.rangCont) continue;
    const row = rows.get(x.tsMT); if (!row) continue;
    const dev = computeDeviation(row, sym, "h1");
    if (!dev || dev.meanSlope == null) continue;
    const zc = Number(row.zscore_h1), zl = Number(row.zscore_h1_s0);
    if (!Number.isFinite(zc) || !Number.isFinite(zl)) continue;
    S[x.side]?.push({ m: dev.meanSlope, zc, zl, sens: x.side === "BUY" ? 1 : -1 });
  }
  rows.clear();
}

const corr = (t, fa, fb) => { const n = t.length; if (n < 3) return NaN;
  let ma = 0, mb = 0; for (const x of t) { ma += fa(x); mb += fb(x); } ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (const x of t) { const a = fa(x) - ma, b = fb(x) - mb; sab += a * b; saa += a * a; sbb += b * b; }
  return sab / Math.sqrt(saa * sbb); };
const f3 = (v) => (Number.isFinite(v) ? (v >= 0 ? "+" : "") + v.toFixed(3) : "   —");

console.log(`\n══ \`meanSlope\` vs \`z\` — DEUX HORLOGES OU UNE ? · residu du rang ③ ══`);
const TOUT = [...S.BUY, ...S.SELL];
console.log(`  BUY ${S.BUY.length} · SELL ${S.SELL.length} · total ${TOUT.length}\n`);
console.log("  population        meanSlope↔z(clôture)   meanSlope↔z(live)");
for (const [nom, t] of [["BUY", S.BUY], ["SELL", S.SELL], ["les deux (brut)", TOUT]])
  console.log("  " + nom.padEnd(18) + f3(corr(t, (x) => x.m, (x) => x.zc)).padStart(14)
    + f3(corr(t, (x) => x.m, (x) => x.zl)).padStart(20));
// 🔴 LE TEST QUI COMPTE : une fois les DEUX grandeurs orientees par le MEME `sens`, la correlation
//   peut MONTER — l'orientation introduit une variable commune (`regDir`). Si elle monte beaucoup,
//   l'orthogonalite brute etait un artefact et les deux entrees se recouvriraient dans le bareme.
console.log("  " + "les deux (ORIENTÉ)".padEnd(18)
  + f3(corr(TOUT, (x) => x.m * x.sens, (x) => x.zc * x.sens)).padStart(14)
  + f3(corr(TOUT, (x) => x.m * x.sens, (x) => x.zl * x.sens)).padStart(20));
console.log(`\n  ⚠ |r| < 0,20 = les deux axes disent des choses différentes ⇒ croisement légitime.`);
console.log(`  ⚠ Une corrélation qui MONTE à l'orientation signale une variable commune (\`regDir\`),`);
console.log(`     pas une vraie indépendance — le piège du TERME PARTAGÉ, déjà rencontré 2× aujourd'hui.\n`);
