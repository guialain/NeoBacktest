// _cont_meanslope_x_gap.mjs — LE CROISEMENT `meanSlope x gapLevel` EST-IL LEGITIME, ET RESPIRE-T-IL ?
//
// 🎯 DEUX QUESTIONS, DANS CET ORDRE, ET LA PREMIERE PEUT TUER LA SECONDE :
//   ① LES DEUX AXES SONT-ILS INDEPENDANTS ? Ils partagent un terme PAR CONSTRUCTION :
//        gapAtr    = (prix − moyenne) / ATR
//        meanSlope = (moyenne − moyennePrev) / ATR
//      ==> `gapAtr + meanSlope = (prix − prixPrev)/ATR`, le deplacement du prix. La moyenne est dans
//      les deux, avec des signes OPPOSES. Un croisement dont les axes se recouvrent FABRIQUE des
//      cases : la case « prix loin ET moyenne qui suit » se remplit en partie toute seule. C'est
//      exactement ce qui est arrive deux fois le 12/08 (zone live x rang au rang ③, ecart-vs-moy3 au ②).
//   ② SI OUI — la population se repartit-elle, ou tient-elle dans une case ?
//
// ⚠⚠ ON MESURE LA CORRELATION EN BRUT **ET** EN ORIENTE. Deux grandeurs peuvent etre decorrelees en
//   brut et correlees une fois orientees par le meme `sens` : l'orientation introduit une variable
//   commune (`regDir`). Ne verifier que le brut, c'est passer a cote du seul cas qui compte, puisque
//   c'est l'ORIENTE que le bareme lira.
// ⚠ `gapLevel` est une MAGNITUDE (`|gapAtr|`, six barreaux) — elle n'a pas de cote et ne s'oriente
//   pas. Seul `meanSlope` s'oriente. La correlation orientee compare donc `meanSlope*sens` a
//   `gapAtr*sens` (la forme SIGNEE du gap), pas au barreau.
// ⚠ Population : le RESIDU du rang ③ (`rangCont`), les deux cotes. ⛔ PAS sur les tirs.
//   usage : node stats/_cont_meanslope_x_gap.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const D = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { computeDeviation, GAP_LEVELS, DELTA_COLS, DELTA_COL_MIRROR } = await import(D);
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

const T = [];
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
    const d = computeDeviation(row, sym, "h1");
    if (!d || d.meanSlope == null || d.meanSlopeBand == null || d.level == null) continue;
    T.push({ m: d.meanSlope, g: d.gapAtr, lvl: d.level, band: d.meanSlopeBand, sens: x.side === "BUY" ? 1 : -1 });
  }
  rows.clear();
}
if (!T.length) { console.log("🔴 RIEN"); process.exit(0); }

const corr = (fa, fb) => { const n = T.length;
  let ma = 0, mb = 0; for (const x of T) { ma += fa(x); mb += fb(x); } ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (const x of T) { const a = fa(x) - ma, b = fb(x) - mb; sab += a * b; saa += a * a; sbb += b * b; }
  return sab / Math.sqrt(saa * sbb); };
const f3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);

console.log(`\n══ RANG ③ · \`meanSlope\` x \`gapLevel\` · residu ${T.length} barres ══`);
console.log(`\n  ── ① INDEPENDANCE DES DEUX AXES ──`);
console.log(`     meanSlope ↔ gapAtr        BRUT     ${f3(corr((x) => x.m, (x) => x.g))}`);
console.log(`     meanSlope ↔ gapAtr        ORIENTE  ${f3(corr((x) => x.m * x.sens, (x) => x.g * x.sens))}`);
console.log(`     meanSlope ↔ |gapAtr|      (magnitude, ce que lit gapLevel)  ${f3(corr((x) => x.m, (x) => Math.abs(x.g)))}`);
console.log(`     ⚠ |r| < 0,20 ⇒ croisement legitime. Une correlation qui MONTE a l'orientation`);
console.log(`        signale une variable commune (\`regDir\`), pas une independance.`);

console.log(`\n  ── ② POPULATION CROISEE  (% du total, bande meanSlope ORIENTEE) ──`);
const O = (x) => (x.sens === 1 ? x.band : DELTA_COL_MIRROR[x.band]);
const g = {}; for (const l of GAP_LEVELS) { g[l] = {}; for (const c of DELTA_COLS) g[l][c] = 0; }
for (const x of T) g[x.lvl][O(x)]++;
const pc = (n) => (100 * n / T.length).toFixed(2);
const COURT = DELTA_COLS.map((c) => c.replace("EXPLOSIVE", "EXPL").replace("_DOWN", "↓").replace("_UP", "↑"));
console.log("  niveau        " + COURT.map((c) => c.padStart(8)).join("") + "     total");
let vides = 0, sous = 0;
for (const l of GAP_LEVELS) {
  const t = DELTA_COLS.reduce((a, c) => a + g[l][c], 0);
  console.log("  " + l.padEnd(13) + DELTA_COLS.map((c) => { const v = g[l][c];
    if (!v) vides++; else if (100 * v / T.length < 0.5) sous++;
    return pc(v).padStart(8); }).join("") + pc(t).padStart(10) + " %");
}
console.log(`\n  cases VIDES ${vides}/${GAP_LEVELS.length * DELTA_COLS.length} · sous 0,5 % ${sous}/${GAP_LEVELS.length * DELTA_COLS.length}`);
const parLvl = GAP_LEVELS.map((l) => DELTA_COLS.reduce((a, c) => a + g[l][c], 0));
const parCol = DELTA_COLS.map((c) => GAP_LEVELS.reduce((a, l) => a + g[l][c], 0));
console.log(`  ligne la plus peuplee ${pc(Math.max(...parLvl))} % · colonne la plus peuplee ${pc(Math.max(...parCol))} %`);
console.log(`  ⚠ Les queues sont rares PAR CONSTRUCTION — aucune case n'est ecartee, le lecteur juge.\n`);
