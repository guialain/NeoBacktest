// _gen_meanslope_config.mjs — GENERE `MeanSlopeConfig.js` : l'echelle de percentiles par actif.
//
// 🎯 DICTEE owner 22/08 : le modulateur ③ lit le **PERCENTILE REEL `p`** de `meanSlopeH1`, pas une
//   interpolation sur la valeur brute. Les 6 bornes de bandes (P5/P25/P45/P55/P75/P95) ne suffisent
//   donc PAS : entre deux bornes il faut savoir OU l'on est en percentile, et dans la queue
//   (`> P95`) la formule `0.25 * (100 - p) / 5` n'a aucune borne superieure contre quoi interpoler.
//   ⇒ on stocke une ECHELLE COMPLETE au pas de 0,5 percentile (201 ancres par actif). `p` s'obtient
//     alors par interpolation ENTRE ANCRES DE PERCENTILE — ce qui EST le percentile reel, a 0,5 pres.
//   📐 Resolution du modulateur qui en decoule : 0,019 en WEAK/STRONG, 0,025 en EXTREME.
//
// ⭐ POPULATION : `meanSlope` **LIVE** (barre H1 en formation, rejouee minute par minute depuis le
//   M1), 12 mois, **24h/24**. L'ecart 24h contre 06-20 UTC a ete mesure a **2,4 % en moyenne sur
//   P75** — negligeable, donc on garde 24h : plus de donnees, bandes plus stables.
// ⭐ Identite utilisee, VERIFIEE a 3,11e-10 : `middle_s0 - middle_s1 = (prix - cloture[i-19]) / 20`.
// ⚠ AUCUN filtre de contiguite : `iBands` n'en fait aucun en prod. Calibrer sur une sous-population
//   que le moteur ne rencontre jamais rendrait un percentile qui ne veut rien dire.
// ⚠ ATR p50 **GELE** sur `ATRConfig` — `meanSlope` est normalise par lui.
//   usage : node --max-old-space-size=8192 stats/_gen_meanslope_config.mjs
import fs from "fs"; import path from "path";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/";
const { getATRConfig } = await import(R + "ATRConfig.js");
const DIR = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/MeanSlopeRaw";
const OUT = "C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/MeanSlopeConfig.js";
const H = 3600000, PAS = 0.5;

const lireH1 = (f) => {
  const L = fs.readFileSync(f, "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";"); const iT = h.indexOf("time_utc"), iC = h.indexOf("close");
  const out = [];
  for (const l of L.slice(1)) { const c = l.split(";");
    const t = Date.parse(c[iT].replace(" ", "T") + "Z"), v = Number(c[iC]);
    if (Number.isFinite(t) && Number.isFinite(v) && v > 0) out.push({ t, v }); }
  return out;
};
const q = (a, p) => { const i = Math.min(a.length - 1, Math.max(0, Math.round(p / 100 * (a.length - 1)))); return a[i]; };

const actifs = [...new Set(fs.readdirSync(DIR).map((f) => f.replace(/_(H1|M1)\.csv$/, "")))].sort();
const table = {}, meta = {};

for (const a of actifs) {
  const h1 = lireH1(path.join(DIR, a + "_H1.csv"));
  const idx = new Map(); for (let i = 0; i < h1.length; i++) idx.set(h1[i].t, i);
  const p50 = getATRConfig(a, "H1")?.p50;
  if (!(p50 > 0)) { console.log(`  🔴 ${a} : pas de p50 ATR — ACTIF IGNORE`); continue; }

  const txt = fs.readFileSync(path.join(DIR, a + "_M1.csv"), "utf8");
  const vals = [];
  let i0 = txt.indexOf("\n") + 1;
  while (i0 > 0 && i0 < txt.length) {
    const j = txt.indexOf("\n", i0);
    const ligne = txt.slice(i0, j < 0 ? txt.length : j);
    i0 = j < 0 ? -1 : j + 1;
    const c1 = ligne.indexOf(";"); if (c1 < 0) continue;
    const c2 = ligne.indexOf(";", c1 + 1); if (c2 < 0) continue;
    const c3 = ligne.indexOf(";", c2 + 1); if (c3 < 0) continue;
    const t = Date.parse(ligne.slice(c1 + 1, c2).replace(" ", "T") + "Z");
    const prix = Number(ligne.slice(c3 + 1));
    if (!Number.isFinite(t) || !Number.isFinite(prix) || prix <= 0) continue;
    const i = idx.get(Math.floor(t / H) * H - H);
    if (i === undefined || i < 19) continue;
    const atr = p50 / 100000 * prix; if (!(atr > 0)) continue;
    vals.push(((prix - h1[i - 19].v) / 20) / atr);
  }
  if (vals.length < 10000) { console.log(`  🔴 ${a} : ${vals.length} valeurs seulement — ACTIF IGNORE`); continue; }
  vals.sort((x, y) => x - y);
  const ech = [];
  for (let p = 0; p <= 100 + 1e-9; p += PAS) ech.push(+q(vals, p).toFixed(6));
  table[a] = ech;
  meta[a] = { n: vals.length, pz: +(100 * vals.filter((v) => v < 0).length / vals.length).toFixed(1) };
  console.log(`  ${a.padEnd(12)} ${String(vals.length).padStart(8)} valeurs · P(v<0) ${meta[a].pz} %`);
}

// ⚠ L'ECHELLE DOIT ETRE MONOTONE NON DECROISSANTE — sinon l'inversion de percentile est fausse.
//   Controle AVANT ecriture : un fichier genere qui n'est pas verifie est un fichier suppose.
let bad = 0;
for (const [a, e] of Object.entries(table))
  for (let i = 1; i < e.length; i++) if (e[i] < e[i - 1]) { bad++; console.log(`  🔴 ${a} : echelle NON monotone en ${i * PAS}`); }

const ligne = (a) => `  ${(a + ":").padEnd(13)} [${table[a].map((v) => v.toFixed(6)).join(", ")}],`;
const src = `/**
 * MeanSlopeConfig.js — L'ECHELLE DE PERCENTILES DE \`meanSlopeH1\`, PAR ACTIF.
 *
 * 🤖 FICHIER GENERE — \`Neo-Backtest/stats/_gen_meanslope_config.mjs\`. Ne pas editer a la main :
 *    la prochaine regeneration ecraserait la retouche, et personne ne saurait laquelle etait juste.
 *
 * 📐 SOURCE : 12 mois de clotures MT5 brutes (2025-08-27 -> 2026-08-21), **24h/24**, ~6,5 M de
 *    minutes rejouees. \`meanSlope\` **LIVE** (barre H1 EN FORMATION), pas cloture a cloture.
 *
 * ⭐⭐⭐ CE QUE MESURE \`meanSlopeH1\`, ET CE N'EST PAS CE QUE SON NOM DIT. Par l'algebre de la
 *    SMA(20), verifiee a 3,11e-10 contre le calcul direct des deux moyennes :
 *
 *        middle_s0 - middle_s1  =  ( prix_courant - cloture_H1[i-19] ) / 20
 *
 *    ⇒ **\`meanSlopeH1\` est le DEPLACEMENT DU PRIX SUR 20 HEURES, divise par 20.** Ce n'est PAS
 *    une pente locale, et c'est pour ca qu'il "respire" la ou les capteurs de POSITION du rang ③
 *    sont deja epuises par la cascade : c'est un MOMENTUM long.
 *    ⛔ Ne jamais le decrire comme "la pente de la moyenne" dans une dictee : la table serait
 *    lue avec le mauvais modele mental.
 *
 * ⚠ NORMALISE PAR L'ATR p50 (\`ATRConfig\`), GELE. Recalibrer l'ATR re-scalerait TOUTES les valeurs
 *   et perimerait cette echelle d'un coup — les deux tables ne sont pas independantes.
 *   Cf. le motif \`SLOPE_DELTA_MEDIAN se regenere AVEC sa table\`.
 *
 * ⚠ AUCUN filtre de contiguite : \`iBands\` n'en fait aucun en prod. Les barres qui suivent une
 *   coupure (week-end, seance) sont DANS la population, comme en live. Elles tombent naturellement
 *   dans la queue \`> P95\`, ou le modulateur les eteint.
 *
 * 📐 PAS DE ${PAS} PERCENTILE, 201 ancres par actif. \`p\` s'obtient par interpolation ENTRE ANCRES
 *    DE PERCENTILE (c'est le percentile REEL a ${PAS} pres), jamais par interpolation sur la valeur.
 *    Resolution du modulateur : 0,019 en WEAK/STRONG, 0,025 en EXTREME.
 */

/** Pas de l'echelle, en points de percentile. \`ECHELLE[k]\` est le percentile \`k * PAS_PCT\`. */
export const PAS_PCT = ${PAS};

/** actif -> 201 valeurs de \`meanSlopeH1\`, du P0 au P100, par pas de ${PAS} percentile. */
export const MEANSLOPE_ECHELLE = {
${actifs.filter((a) => table[a]).map(ligne).join("\n")}
};

/** Population ayant servi au calibrage, et ou tombe zero dans l'echelle. ⚠ \`pz\` hors de
 *  [45 · 55] veut dire que la bande \`FLAT\` ne contient PAS zero sur cet actif — mesure et
 *  ASSUME (owner 22/08), pas un defaut a corriger. */
export const MEANSLOPE_META = {
${actifs.filter((a) => table[a]).map((a) => `  ${(a + ":").padEnd(13)} { n: ${meta[a].n}, pz: ${meta[a].pz} },`).join("\n")}
};
`;
fs.writeFileSync(OUT, src);
console.log(`\n  ${Object.keys(table).length}/${actifs.length} actifs ecrits · ${bad} defaut(s) de monotonie`);
console.log(`  -> ${OUT}  (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)\n`);
