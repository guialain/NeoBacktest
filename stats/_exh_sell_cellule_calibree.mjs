// _exh_sell_cellule_calibree.mjs — LA MEME CELLULE, AVEC LES BANDES **CALIBREES DU MOTEUR**.
// ============================================================================================
// 🔴🔥 CE QUI CHANGE (owner, 20/08) : `flat` N'EST PAS `≥ 0`. C'est une BANDE A CHEVAL SUR ZERO,
//   et le depot en a des versions calibrees. Le 1er jet coupait donc la MOITIE NEGATIVE de `FLAT`
//   sur les deux capteurs a la fois.
//     `rsiDeltaCol`  RSI_DELTA_CUTS [0,95 · 3,09 · 6,00]  ⇒ FLAT = −0,95 < d < 0,95
//     `contDzCol`    CONT_DZ_SEUIL 0,20 (rang ③)          ⇒ DZ_FLAT = −0,20 < d < 0,20
//     `zDeltaCol`    calibre PAR NIVEAU de tension        ⇒ FLAT = |d| < 0,50 × mediane(niveau)
//                    mediane 0,180 (SLACK) → 0,707 (SNAPPED) : des coupures FIXES mentiraient.
// ⇒ « up/flat » = la colonne n'est PAS une colonne DOWN.
//
// ⚠ DEUX AMBIGUITES RESTENT, ET ON LES SORT TOUTES LES DEUX PLUTOT QUE D'EN CHOISIR UNE :
//   ① la SOURCE du dz : colonne EA `dz_h1` vs `z_s0 − z_close` du moteur (elles ne s'accordent en
//      signe que dans 38,7 % des cas — mesure du 20/08).
//   ② l'HORLOGE du dRSI : `drsi_h1` (cloture) vs `drsi_h1_s0` (live).
// ⚠ `zDeltaCol` attend un `d` ORIENTE (`Δz × signe(z)`) et le NIVEAU (`zLevel`). Cote SELL, z > 0
//   ⇒ orientation = identite. On passe le niveau du z LIVE.
// ⚙ Usage : `node stats/_exh_sell_cellule_calibree.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { rsiDeltaCol, RSI_DELTA_CUTS } = await import(`${M}/experts/rsiExpert.js`);
const { zDeltaCol, zLevel, Z_LEVEL_BANDS } = await import(`${M}/experts/zscoreExpert.js`);
const { contDzCol, CONT_DZ_SEUIL } = await import(`${M}/contScoringV1.js`);
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2,
  chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });

const SELL = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && t.side === "SELL" && typeof t.R === "number");
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const li = (lbl, a) => {
  if (!a.length) { console.log(`   ${lbl.padEnd(52)}     0 tir`); return; }
  const v = agg(a);
  console.log(`   ${lbl.padEnd(52)}${String(v.n).padStart(4)} tirs  ${(100 * v.g / v.n).toFixed(2).padStart(6)} %  ${v.R.toFixed(1).padStart(6)} R  ${(v.R / v.n).toFixed(4).padStart(8)}  ${v.g}G/${v.n - v.g}P`);
};
const PAS_DOWN = (c) => c !== null && !String(c).includes("DOWN");   // « up/flat » = pas une colonne DOWN

console.log(`\n══ RANG ① · SELL — CELLULE AVEC LES BANDES CALIBREES ══`);
console.log(`   RSI_DELTA_CUTS ${JSON.stringify(RSI_DELTA_CUTS)}  ⇒ dRSI FLAT = ]−0,95 · 0,95[`);
console.log(`   CONT_DZ_SEUIL ${CONT_DZ_SEUIL}                    ⇒ DZ_FLAT  = ]−0,20 · 0,20[`);
console.log(`   Z_LEVEL_BANDS ${JSON.stringify(Z_LEVEL_BANDS)}  ⇒ zDeltaCol calibre par niveau`);
console.log(`   tirs EXH SELL ${SELL.length}`);

// Les briques, chacune nommee — on ne fond jamais deux definitions dans une seule variable.
const kOK = (t) => Number.isFinite(t.kH1) && t.kH1 > 70;
const zOK = (t) => Number.isFinite(t.zscoreH1S0) && t.zscoreH1S0 < 2.2;
const h4OK = (t) => t.kdCycleH4 === "DIVERGING";
const dzMoteur = (t) => (Number.isFinite(t.zscoreH1S0) && Number.isFinite(t.zscoreH1) ? t.zscoreH1S0 - t.zscoreH1 : null);
const dRSI = { "cloture `drsi_h1`": (t) => t.dRsiH1, "live `drsi_h1_s0`": (t) => t.dRsiH1Live };
const DZ = { "colonne `dz_h1`": (t) => t.dzH1Col, "moteur `z_s0−z_close`": dzMoteur };
const CLASS_DZ = {
  "contDzCol (±0,20)": (d) => contDzCol(d),
  "zDeltaCol (par niveau)": (d, t) => zDeltaCol(d, zLevel(t.zscoreH1S0)),
};

console.log(`\n   ${"".padEnd(52)}${"tirs".padStart(4)}       WR        R      R/tir`);
console.log(`   ── REFERENCE ──`);
li(`TOUT LE RANG ① SELL`, SELL);
li(`ancienne lecture : dRSI ≥ 0 ET dz ≥ 0 (colonne, cloture)`,
  SELL.filter((t) => kOK(t) && zOK(t) && h4OK(t) && t.dRsiH1 >= 0 && t.dzH1Col >= 0));

console.log(`\n   ── AVEC LES BANDES CALIBREES : « up/flat » = la colonne n'est pas DOWN ──`);
for (const [nr, fr] of Object.entries(dRSI))
  for (const [nz, fz] of Object.entries(DZ))
    for (const [nc, fc] of Object.entries(CLASS_DZ)) {
      const cell = SELL.filter((t) => {
        if (!kOK(t) || !zOK(t) || !h4OK(t)) return false;
        const r = fr(t), d = fz(t);
        if (!Number.isFinite(r) || !Number.isFinite(d)) return false;
        return PAS_DOWN(rsiDeltaCol(r)) && PAS_DOWN(fc(d, t));
      });
      li(`dRSI ${nr}  ·  dz ${nz}  ·  ${nc}`, cell);
    }

// LES COLONNES ELLES-MEMES — combien de tirs dans chaque, pour que « up/flat » soit lisible.
console.log(`\n   ── DISTRIBUTION DES COLONNES SUR LE RANG ① SELL (avant tout filtre) ──`);
const dist = (nom, f) => {
  const m = new Map();
  for (const t of SELL) { const c = f(t) ?? "null"; m.set(c, (m.get(c) ?? 0) + 1); }
  console.log(`   ${nom.padEnd(34)}${[...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
};
dist("rsiDeltaCol(drsi_h1)", (t) => rsiDeltaCol(t.dRsiH1));
dist("rsiDeltaCol(drsi_h1_s0)", (t) => rsiDeltaCol(t.dRsiH1Live));
dist("contDzCol(dz_h1)", (t) => contDzCol(t.dzH1Col));
dist("contDzCol(z_s0−z_close)", (t) => contDzCol(dzMoteur(t)));
dist("zDeltaCol(dz_h1, niveau)", (t) => zDeltaCol(t.dzH1Col, zLevel(t.zscoreH1S0)));
dist("zDeltaCol(moteur, niveau)", (t) => zDeltaCol(dzMoteur(t), zLevel(t.zscoreH1S0)));
console.log("");
