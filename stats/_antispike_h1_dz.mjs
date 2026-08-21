// _antispike_h1_dz.mjs — UN ANTI-SPIKE H1 SUR `dz_h1` : CE QU'IL BLOQUERAIT, ET CE QUE CA VAUT.
// ============================================================================================
// 🎯 LA REGLE TESTEE (polarite de `SpikeGuard`, transposee a l'horloge H1) : une poussee H1 de
//   magnitude `|dz_h1| >= K` interdit le trade PRIS A CONTRE-SENS. Poussee HAUSSIERE => pas de SELL,
//   poussee BAISSIERE => pas de BUY. Le cote DANS le sens de la poussee reste OUVERT.
// ⭐ POURQUOI CETTE POLARITE ET PAS L'INVERSE : elle est MESUREE, pas supposee. `SpikeGuard.js` :
//   « l'hypothese de depart etait spike UP => ne pas ACHETER. Mesure : -44 a -61 R, et les trades
//   coupes avaient un avgR de +0,24 => acheter un spike est un des MEILLEURS trades du moteur.
//   C'est le FADE qui se paie. » ⛔ Ne pas retourner ce sens sans re-mesurer.
//
// ⚠⚠ `dz_h1` EST LA COLONNE CSV (barre a barre), PAS le `dZ` du moteur (intra-barre, `zscore_h1_s0
//   - zscore_h1`). Les deux ne s'accordent en SIGNE que 38,7 % du temps — ce sont DEUX grandeurs.
//   Ici on veut le DEPLACEMENT CUMULE, donc la colonne. C'est la dictee owner.
//
// ⭐ POURQUOI SUR LES TIRS ET PAS SUR LES BARRES : un veto se chiffre a ce qu'il RETIRE du carnet.
//   Les barres surestiment jusqu'a x7 (lecon du 20/08, verifiee 4 fois).
// ⚙ Usage : `node stats/_antispike_h1_dz.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const R = runMatrixPortfolio(fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv")).sort().map((f) => path.join(DIR, f)),
  { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const T = (R.signals ?? []).filter((t) => Number.isFinite(t.dzH1Col) && typeof t.R === "number");

const BE = 75;
const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(34)}${String(a.length).padStart(6)}${wr(a).toFixed(2).padStart(9)} %${Rn(a).toFixed(1).padStart(9)}${(Rn(a)/a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(34)}     —`;
const HEAD = `   ${"".padEnd(34)}${"tirs".padStart(6)}${"WR".padStart(10)}${"R net".padStart(9)}${"R/tir".padStart(9)}`;

// « A CONTRE-SENS » : le trade va contre le deplacement H1.
const contre = (t) => (t.side === "SELL" && t.dzH1Col > 0) || (t.side === "BUY" && t.dzH1Col < 0);
const mag = (t) => Math.abs(t.dzH1Col);

console.log(`\n══ ANTI-SPIKE H1 SUR \`dz_h1\` — CE QU'IL BLOQUERAIT ══`);
console.log(`   carnet ${T.length} tirs lisibles sur ${(R.signals ?? []).length} · point mort ${BE},00 %`);
console.log(`\n   ── ① LE CARNET, SELON QU'IL VA AVEC OU CONTRE LA POUSSEE H1 ──`);
console.log(HEAD);
console.log(L("AVEC la poussee (dz meme sens)", T.filter((t) => !contre(t))));
console.log(L("CONTRE la poussee", T.filter(contre)));

console.log(`\n   ── ② LES TIRS A CONTRE-SENS, PAR MAGNITUDE |dz_h1| ──`);
console.log(HEAD);
for (const [lo, hi] of [[0,0.5],[0.5,1],[1,1.5],[1.5,2],[2,2.5],[2.5,3],[3,4],[4,Infinity]]) {
  const a = T.filter((t) => contre(t) && mag(t) >= lo && mag(t) < hi);
  if (a.length) console.log(L(`|dz| [${lo} · ${hi === Infinity ? "+inf" : hi}[`, a));
}

console.log(`\n   ── ③ CE QUE LE VETO RETIRERAIT, PAR SEUIL K ──`);
console.log(`   ${"".padEnd(12)}${"retires".padStart(8)}${"WR retires".padStart(12)}${"R retire".padStart(10)}   ${"carnet restant".padStart(30)}`);
for (const K of [1.0, 1.5, 2.0, 2.5, 3.0, 3.5]) {
  const bloq = T.filter((t) => contre(t) && mag(t) >= K);
  const reste = T.filter((t) => !(contre(t) && mag(t) >= K));
  console.log(`   K = ${String(K).padEnd(7)}${String(bloq.length).padStart(8)}${(bloq.length?wr(bloq).toFixed(2):"—").padStart(11)} %${Rn(bloq).toFixed(1).padStart(10)}   ${`${reste.length} tirs · ${wr(reste).toFixed(2)} % · ${Rn(reste).toFixed(1)} R`.padStart(30)}`);
}
console.log(`
   -- (4) LES DEUX POLITIQUES, MEMES DONNEES --`);
console.log(`   ${"".padEnd(10)}${"A CONTRE-SENS seulement".padStart(32)}   ${"LES DEUX COTES (dictee owner)".padStart(32)}`);
for (const K of [1.0, 1.5, 2.0, 2.5, 3.0, 3.5]) {
  const rContre = T.filter((t) => !(contre(t) && mag(t) >= K));
  const rTous   = T.filter((t) => !(mag(t) >= K));
  const f = (a) => `${String(a.length).padStart(5)} tirs / ${wr(a).toFixed(2)} % / ${Rn(a).toFixed(1)} R`;
  console.log(`   K = ${String(K).padEnd(5)}${f(rContre).padStart(32)}   ${f(rTous).padStart(32)}`);
}
console.log(`
   -- (5) CE QUE << NE RIEN FAIRE >> RETIRE EN PLUS : le cote AVEC la poussee --`);
console.log(HEAD);
for (const K of [1.5, 2.0, 2.5, 3.0]) {
  const a = T.filter((t) => !contre(t) && mag(t) >= K);
  if (a.length) console.log(L(`AVEC la poussee | |dz| >= ${K}`, a));
}
console.log(`\n   ⚠ « R retire » POSITIF = le veto couperait du GAGNANT. Le carnet de reference : ${T.length} tirs · ${wr(T).toFixed(2)} % · ${Rn(T).toFixed(1)} R`);
console.log(`   ⚠ Ce tableau est une SIMULATION SUR LE CARNET EXISTANT : il ne rejoue pas la cascade.`);
console.log(`     Retirer un tir en LIBERE d'autres (spacing, capacite) — seul un RE-RUN chiffre vraiment.\n`);
