// _exh_gap_signe_x_kd.mjs — POPULATION `cote REEL du prix x niveau x kd`, pour la table SIGNEE.
// ⚠⚠ CORRIGE UNE ERREUR DE LA SONDE PRECEDENTE. `_exh_gap_x_kd_pop` classait en `BEHIND`/`AHEAD`,
//   qui dependent du COTE JOUE : `BEHIND` = prix HAUT sur une barre SELL, mais prix BAS sur une barre
//   BUY. Les deux se melangeaient dans la meme ligne. Pour une table SIGNEE et side-INDEPENDANTE
//   (celle que l'owner a dictee), la ligne est le COTE REEL DU PRIX — `sign(gapAtr)` — et rien d'autre.
//   ⭐ C'est exactement le motif que ce depot documente : **un axe deja oriente par le routeur melange
//   deux populations**, et la table lit une moyenne de deux choses opposees.
// ⚠ `NO_TENSION` reste SCINDE haut/bas : a |gap| < 0,2 ATR le niveau ne dit rien, mais le SIGNE si.
// ⚠ `file:///C:/...` en dur : sur Windows un chemin absolu nu est refuse par le chargeur ESM.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const { prepareAsset } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const D = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { computeDeviation, GAP_LEVELS } = await import(D);
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const SEUIL = 2.1, COLS = ["KD_POS", "CONTACT", "KD_NEG"];
const cel = new Map(); let n = 0, muet = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f), sym = path.basename(f, ".csv").toUpperCase();
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/); const h = L[0].split(";");
  const iT = h.indexOf("timestamp"), iK = h.indexOf("stoch_k_h1_s0"), iD = h.indexOf("stoch_d_h1_s0");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); rows.set(c[iT], c); }
  for (const x of (prepareAsset(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes") continue;
    const c = rows.get(x.tsMT); if (!c) continue;
    const d = computeDeviation(Object.fromEntries(h.map((k, i) => [k, c[i]])), sym, "h1");
    const kv = c[iK], dv = c[iD];
    n++;
    if (!d?.level || d.gapAtr == null || kv === "" || dv === "" || !Number.isFinite(+kv) || !Number.isFinite(+dv)) { muet++; continue; }
    const kd = +kv - +dv;
    const col = kd > SEUIL ? "KD_POS" : kd < -SEUIL ? "KD_NEG" : "CONTACT";
    // ⭐ LA LIGNE = LE COTE REEL DU PRIX. Aucun cote joue n'entre ici.
    const cote = d.gapAtr >= 0 ? "HAUT" : "BAS";
    cel.set(`${cote}_${d.level}|${col}`, (cel.get(`${cote}_${d.level}|${col}`) ?? 0) + 1);
  }
  rows.clear();
}
const tot = [...cel.values()].reduce((a, b) => a + b, 0);
const pc = (v) => (tot ? (100 * v / tot).toFixed(2) : "0.00");
const ROWS = ["HAUT_SNAPPED", "HAUT_EXTREME", "HAUT_TENSE_HIGH", "HAUT_TENSE", "HAUT_SLACK", "HAUT_NO_TENSION",
              "BAS_NO_TENSION", "BAS_SLACK", "BAS_TENSE", "BAS_TENSE_HIGH", "BAS_EXTREME", "BAS_SNAPPED"];
console.log(`\n══ RANG ① · population par COTE REEL DU PRIX (${n} barres · ${(100 * muet / n).toFixed(1)} % muettes) ══`);
console.log(`  ligne                 K-D > +2,1   CONTACT    K-D < -2,1     total`);
for (const r of ROWS) {
  const v = COLS.map((c) => cel.get(`${r}|${c}`) ?? 0);
  console.log(`  ${r.padEnd(20)}` + v.map((x) => pc(x).padStart(9) + " %").join("") + pc(v[0] + v[1] + v[2]).padStart(9) + " %");
}
const moit = (p) => pc(ROWS.filter((r) => r.startsWith(p)).reduce((a, r) => a + COLS.reduce((s, c) => s + (cel.get(`${r}|${c}`) ?? 0), 0), 0));
console.log(`\n  moitie HAUT ${moit("HAUT")} %  ·  moitie BAS ${moit("BAS")} %`);
console.log(`  colonnes : ` + COLS.map((c) => c + " " + pc(ROWS.reduce((a, r) => a + (cel.get(`${r}|${c}`) ?? 0), 0)) + " %").join("  ·  "));
const pl = ROWS.flatMap((r) => COLS.map((c) => cel.get(`${r}|${c}`) ?? 0));
console.log(`  cases VIDES ${pl.filter((v) => v === 0).length}/36 · sous 0,5 % ${pl.filter((v) => v > 0 && 100 * v / tot < 0.5).length}/36\n`);
