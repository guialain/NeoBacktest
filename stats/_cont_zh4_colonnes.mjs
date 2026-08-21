// _cont_zh4_colonnes.mjs — LE `z H4` PAR COLONNE DE `dz`, RANG 3, PAR COTE.
// =============================================================================================
// LA DEMANDE (owner 21/08) : « mesure wr cont sell, z H4 softup / fastup / exploup ».
//
// /!\ CE QUE « UP » VEUT DIRE, ET CE N'EST PAS LE COTE DU TRADE : `zDeltaCol` oriente par
//   **`signe(z)`**, pas par le side. `SOFT_UP` / `FAST_UP` / `EXPLOSIVE_UP` disent
//   « L'ETIREMENT GRANDIT » — le prix s'eloigne encore de sa moyenne H4, dans le sens ou il est
//   deja tendu. Ce sens peut etre le MEME que le pari ou son CONTRAIRE ; la colonne ne le dit pas.
//   => on croise donc la colonne avec le SIGNE DU z, sinon on melange deux figures opposees.
//
// /!\ DEUX CALIBRATIONS COEXISTENT depuis le 21/08 (`Z_DELTA_MEDIAN_SRC`) :
//   v1 = les constantes historiques (**celles de la PROD `9f53e44`**), v2 = re-mesurees.
//   La sonde tourne sur la calibration CHARGEE et rend AUSSI la lecture v2 sur la meme population,
//   pour dire combien de tirs changent de colonne.
//
// POPULATION : les TIRS du carnet (rang 3), 100/100, spread facture.
// Usage : `Z_DELTA_MEDIAN_SRC=v1 node --max-old-space-size=12288 stats/_cont_zh4_colonnes.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const Z = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/experts/zscoreExpert.js");
const { zDeltaCol, zLevel, Z_DELTA_MEDIAN, Z_DELTA_MEDIAN_V1, Z_DELTA_MEDIAN_V2, Z_DELTA_MULT, Z_DELTA_COLS } = Z;

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const R = runMatrixPortfolio(fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv")).sort().map((f) => path.join(DIR, f)),
  { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const S = R.signals ?? [];
const CALIB = Z_DELTA_MEDIAN === Z_DELTA_MEDIAN_V1 ? "v1 (PROD)" : "v2 (re-calibre)";

const lisible = (t) => Number.isFinite(t.zscoreH4) && Number.isFinite(t.zscoreH4S0);
const dz = (t) => t.zscoreH4S0 - t.zscoreH4;
const sgnZ = (t) => Math.sign(t.zscoreH4 || 0) || 1;
const colAvec = (t, MED) => {                       // reimplementation EXACTE de `zDeltaCol`
  const m = MED[zLevel(t.zscoreH4)];
  const d = dz(t) * sgnZ(t);
  if (!m || !Number.isFinite(d)) return null;
  for (let i = 0; i < Z_DELTA_MULT.length; i++) if (d < Z_DELTA_MULT[i] * m) return Z_DELTA_COLS[i];
  return Z_DELTA_COLS[6];
};
const col = (t) => zDeltaCol(dz(t) * sgnZ(t), zLevel(t.zscoreH4));   // la calibration CHARGEE
const UPS = ["SOFT_ECARTE", "FAST_ECARTE", "EXPLO_ECARTE"];  // ex SOFT/FAST/EXPLOSIVE_UP

const CONT = S.filter((t) => t.strategy === "CONT" && typeof t.R === "number" && lisible(t));
const V = CONT.filter((t) => t.side === "SELL"), B = CONT.filter((t) => t.side === "BUY");

const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const jour = (t) => `${t.asset}|${String(t.tsMT ?? "").slice(0, 10)}`;
const grap = (a) => new Set(a.map(jour)).size;
const wrG = (a) => { const m = new Map(); for (const t of a) { const k = jour(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  let g = 0; for (const [, v] of m) if (Rn(v) > 0) g++; return m.size ? 100 * g / m.size : NaN; };
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(30)}${String(a.length).padStart(6)}${String(grap(a)).padStart(6)}${wr(a).toFixed(2).padStart(9)} %${wrG(a).toFixed(1).padStart(8)} %${Rn(a).toFixed(1).padStart(9)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(30)}     —`;
const HEAD = `   ${"".padEnd(30)}${"tirs".padStart(6)}${"grap".padStart(6)}${"WR".padStart(10)}${"WRgrap".padStart(9)}${"R".padStart(9)}${"R/tir".padStart(9)}`;

console.log(`\n== RANG 3 · COLONNES \`dz\` DU \`z H4\` — calibration CHARGEE : ${CALIB} ==`);
console.log(`   carnet ${S.length} · rang 3 ${CONT.length} (SELL ${V.length} / BUY ${B.length})`);
console.log(`   REPERES  point mort 75,00 · rang 3 ${wr(CONT).toFixed(2)} · 3 SELL ${wr(V).toFixed(2)} · 3 BUY ${wr(B).toFixed(2)}`);
console.log(`   /!\\ « UP » = l'ETIREMENT GRANDIT (oriente par signe(z)), PAS « le z monte », PAS le cote du trade.\n`);

console.log(`   ##### CE QUI EST DEMANDE : CONT **SELL**, colonnes UP #####`); console.log(HEAD);
console.log(L("SELL · les 3 UP", V.filter((t) => UPS.includes(col(t)))));
for (const c of UPS) console.log(L("   " + c, V.filter((t) => col(t) === c)));
console.log(L("SELL · le RESTE", V.filter((t) => !UPS.includes(col(t)))));

console.log(`\n   -- le miroir : CONT BUY, memes colonnes --`); console.log(HEAD);
console.log(L("BUY · les 3 UP", B.filter((t) => UPS.includes(col(t)))));
for (const c of UPS) console.log(L("   " + c, B.filter((t) => col(t) === c)));
console.log(L("BUY · le RESTE", B.filter((t) => !UPS.includes(col(t)))));

console.log(`\n   -- LES 7 COLONNES, PAR COTE --`); console.log(HEAD);
for (const c of Z_DELTA_COLS) {
  const a = CONT.filter((t) => col(t) === c);
  console.log(L(c, a));
  if (a.length) { console.log(L("     SELL", a.filter((t) => t.side === "SELL"))); console.log(L("     BUY", a.filter((t) => t.side === "BUY"))); }
}

console.log(`\n   -- LES 3 UP CROISEES AVEC LE SIGNE DU z H4 (deux figures opposees) --`); console.log(HEAD);
for (const [nm, f] of [["SELL · UP & z H4 > 0", (t) => t.side === "SELL" && UPS.includes(col(t)) && t.zscoreH4 > 0],
                       ["SELL · UP & z H4 < 0", (t) => t.side === "SELL" && UPS.includes(col(t)) && t.zscoreH4 < 0],
                       ["BUY  · UP & z H4 > 0", (t) => t.side === "BUY" && UPS.includes(col(t)) && t.zscoreH4 > 0],
                       ["BUY  · UP & z H4 < 0", (t) => t.side === "BUY" && UPS.includes(col(t)) && t.zscoreH4 < 0]])
  console.log(L(nm, CONT.filter(f)));

console.log(`\n   -- CE QUE L'AUTRE CALIBRATION CHANGERAIT SUR CES MEMES TIRS --`);
const autre = CALIB.startsWith("v1") ? Z_DELTA_MEDIAN_V2 : Z_DELTA_MEDIAN_V1;
const nm2 = CALIB.startsWith("v1") ? "v2" : "v1";
let chg = 0; for (const t of CONT) if (col(t) !== colAvec(t, autre)) chg++;
console.log(`   ${chg} tirs sur ${CONT.length} changent de colonne (${(100 * chg / CONT.length).toFixed(2)} %)`);
console.log(HEAD);
console.log(L(`SELL · 3 UP (calib ${nm2})`, V.filter((t) => UPS.includes(colAvec(t, autre)))));
console.log(L(`BUY  · 3 UP (calib ${nm2})`, B.filter((t) => UPS.includes(colAvec(t, autre)))));
console.log("");
