// _exh_gap_x_kd_pop.mjs — POPULATION DE `gap(BEHIND/AHEAD x niveau) x kd(3 etats)` AU RANG ①.
// ============================================================================================
// 🎯 PREREQUIS NOMME : l'owner remplace l'axe VITESSE (`gapDeltaCol`, 7 bandes) de l'entree ⑴ par le
//   K/D en 3 etats (`K-D > 2,1` / CONTACT / `K-D < -2,1`, seuil `STOCHDYN_CONTACT`). Motif dicte :
//   « la dynamique dz n'ajoute rien ».
// ⚠⚠ ON MESURE LA POPULATION **AVANT** DE DICTER, et deux fois deja ca a evite un piege : le 12/08
//   au matin (`ligneGap`, r = 0,62 avec `meanSlope` — cases FABRIQUEES) et le 12/08 au soir (l'axe
//   `z` a 79,6 % dans une bande — CONSTANTE). Une case sans population ne se dicte pas au chiffre,
//   elle se dicte au MECANISME, et il faut savoir laquelle.
// ⚠ ORTHOGONALITE : `gapAtr` = (prix - moyenne)/ATR ; `K-D` = ecart de deux stochastiques. Rien de
//   partage a priori — mais on le MESURE, parce que c'est exactement ce qu'on avait cru pour
//   `meanSlope x gapAtr` (r = 0,75 en brut).
// ⚠ Population = TOUTES les barres ou le rang ① est evalue (les 3 boites tournent en parallele).
// ⚠ `file:///C:/...` en dur : sur Windows un chemin absolu nu est refuse par le chargeur ESM.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const { prepareAsset } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const D = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { computeDeviation, gapInstalled, GAP_LEVELS } = await import(D);
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const SEUIL = 2.1;                       // `STOCHDYN_CONTACT`, importe par sa VALEUR dictee
const COLS = ["KD_POS", "CONTACT", "KD_NEG"];

const cel = new Map(); let n = 0, muet = 0;
const XY = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f), sym = path.basename(f, ".csv").toUpperCase();
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/); const h = L[0].split(";");
  const iT = h.indexOf("timestamp");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); rows.set(c[iT], c); }
  const num = (c, k) => { const v = c[h.indexOf(k)]; return (v === "" || v == null || !Number.isFinite(Number(v))) ? null : Number(v); };
  for (const x of (prepareAsset(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes") continue;
    const c = rows.get(x.tsMT); if (!c) continue;
    const row = Object.fromEntries(h.map((k, i) => [k, c[i]]));
    const d = computeDeviation(row, sym, "h1");
    const k = num(c, "stoch_k_h1_s0"), dd = num(c, "stoch_d_h1_s0");
    n++;
    if (!d?.level || d.gapAtr == null || k == null || dd == null) { muet++; continue; }
    const kd = k - dd;
    const col = kd > SEUIL ? "KD_POS" : kd < -SEUIL ? "KD_NEG" : "CONTACT";
    // ⭐ `installed` = de quel cote le prix est INSTALLE. La famille depend du COTE JOUE par le
    //   rang ① (`eSide`) : BEHIND = le prix est du cote d'OU ce fade revient.
    const inst = gapInstalled(d.level, d.gapAtr, d.meanSlope);
    if (!Number.isFinite(inst) || inst === 0) { muet++; continue; }
    const BUY = x.eSide === "BUY";
    const fam = (BUY ? inst < 0 : inst > 0) ? "BEHIND" : "AHEAD";
    const key = `${fam}_${d.level}|${col}`;
    cel.set(key, (cel.get(key) ?? 0) + 1);
    XY.push({ g: Math.abs(d.gapAtr), kd: Math.abs(kd) });
  }
  rows.clear();
}
const tot = [...cel.values()].reduce((a, b) => a + b, 0);
const pc = (v) => (tot ? (100 * v / tot).toFixed(2) : "0.00");
const ROWS = [...GAP_LEVELS].map((l) => "BEHIND_" + l).concat([...GAP_LEVELS].map((l) => "AHEAD_" + l));
// ── orthogonalite
const m = (f) => XY.reduce((a, b) => a + f(b), 0) / XY.length;
const mg = m((x) => x.g), mk = m((x) => x.kd);
const cov = m((x) => (x.g - mg) * (x.kd - mk)), sg = Math.sqrt(m((x) => (x.g - mg) ** 2)), sk = Math.sqrt(m((x) => (x.kd - mk) ** 2));
console.log(`\n══ RANG ① · \`gap x kd\` — population sur ${n} barres (${muet} muettes, ${(100 * muet / n).toFixed(1)} %) ══`);
console.log(`\n  ── ① INDEPENDANCE DES AXES ──`);
console.log(`     |gapAtr| <-> |K-D| H1 live   r = ${(cov / (sg * sk)).toFixed(3)}`);
console.log(`     ⚠ |r| < 0,20 ⇒ croisement legitime. Au-dessus, les cases sont FABRIQUEES.`);
console.log(`\n  ── ② POPULATION CROISEE (% du total) ──`);
console.log(`  ligne                 K-D > +2,1   CONTACT    K-D < -2,1     total`);
for (const r of ROWS) {
  const v = COLS.map((c) => cel.get(`${r}|${c}`) ?? 0);
  const t = v[0] + v[1] + v[2];
  console.log(`  ${r.padEnd(20)}` + v.map((x) => pc(x).padStart(9) + " %").join("") + pc(t).padStart(9) + " %");
}
const vides = ROWS.flatMap((r) => COLS.map((c) => (cel.get(`${r}|${c}`) ?? 0))).filter((v) => v === 0).length;
const sous = ROWS.flatMap((r) => COLS.map((c) => (cel.get(`${r}|${c}`) ?? 0))).filter((v) => v > 0 && 100 * v / tot < 0.5).length;
console.log(`\n  cases VIDES ${vides}/36 · sous 0,5 % ${sous}/36`);
for (const c of COLS) console.log(`  colonne ${c.padEnd(9)} ${pc(ROWS.reduce((a, r) => a + (cel.get(`${r}|${c}`) ?? 0), 0)).padStart(7)} %`);
console.log(`  ⚠ Les queues sont rares PAR CONSTRUCTION — aucune case n'est ecartee, le lecteur juge.\n`);
