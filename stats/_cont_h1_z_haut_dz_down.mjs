// _cont_h1_z_haut_dz_down.mjs — H1 : le prix est LOIN, le %K est HAUT, et le dz REVIENT.
// =============================================================================================
// LA FIGURE (owner 21/08) : « cont BUY quand H1 `z live > 2,15` ET `%K live > 60` ET
//   `dz h1 = down / fast down / explosive down`, et miroir ». Le BUY est le SENS BRUT.
//   => le prix est deja tres loin de sa moyenne H1, l'oscillateur est encore haut, MAIS la
//   distance a commence a se REFERMER. Poursuivre la, c'est acheter au moment ou le ressort
//   se detend.
//
// LES TROIS COLONNES DEMANDEES sont celles de `Z_DELTA_COLS` (zscoreExpert) :
//   `SOFT_DOWN` (= « down »), `FAST_DOWN`, `EXPLOSIVE_DOWN` — sur 7 colonnes au total.
//
// COMPOSITION CANONIQUE, RECOPIEE DE `zscoreExpertScore` ET NON REINVENTEE :
//   `col = zDeltaCol(dZ * side, zLevel(z))` — `zDeltaCol` attend un `d` DEJA ORIENTE, sa table
//   etant ecrite pour `z > 0`, et ses seuils sont des MULTIPLES d'une mediane PAR NIVEAU
//   (`Z_DELTA_MEDIAN`). Donc « fast down » ne veut PAS dire le meme nombre selon que le `z` est
//   `SLACK` ou `SNAPPED` : c'est une vitesse RELATIVE a la tension. On importe, on ne recopie pas.
//   /!\ Dans l'expert l'orientation est `signe(z)`. Ici elle est le COTE DU TRADE — les deux
//   COINCIDENT dans le domaine de la figure (BUY exige z > +2,15, SELL exige z < -2,15), et c'est
//   le cote qui porte le sens de « miroir ».
//
// /!\ LE `dz` EST CELUI DU **MOTEUR** (`zscoreH1S0 - zscoreH1`, INTRA-BARRE), PAS la colonne
//   `dz_h1` de l'EA (variation de barre a barre). Mesurees de SIGNES OPPOSES sur la meme barre,
//   d'accord seulement 38,7 % du temps. C'est le `dZ` du moteur que `zscoreExpert` consomme.
//
// POPULATION : les TIRS du carnet (rang 3), 100/100, spread facture — etat courant `b3e7838`.
// Usage : `node --max-old-space-size=12288 stats/_cont_h1_z_haut_dz_down.mjs`
//         surcharges : `Z=2.15 K=60`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { zDeltaCol, zLevel } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/experts/zscoreExpert.js");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const R = runMatrixPortfolio(fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv")).sort().map((f) => path.join(DIR, f)),
  { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const S = R.signals ?? [];
const ZB = Number(process.env.Z ?? 2.15), KB = Number(process.env.K ?? 60);
const DOWN = ["SOFT_DOWN", "FAST_DOWN", "EXPLOSIVE_DOWN"];

const SG = (t) => t.side === "BUY" ? 1 : -1;                 // le BUY est le sens brut
const lisible = (t) => Number.isFinite(t.zscoreH1S0) && Number.isFinite(t.zscoreH1) && Number.isFinite(t.kH1);
const zP = (t) => t.zscoreH1S0 * SG(t);
const kP = (t) => (SG(t) === 1 ? t.kH1 : 100 - t.kH1);
const dOr = (t) => (t.zscoreH1S0 - t.zscoreH1) * SG(t);      // dz du MOTEUR, oriente
const col = (t) => zDeltaCol(dOr(t), zLevel(zP(t)));
const a1 = (t) => zP(t) > ZB;
const a2 = (t) => kP(t) > KB;
const a3 = (t) => DOWN.includes(col(t));
const figure = (t) => a1(t) && a2(t) && a3(t);

const CONT = S.filter((t) => t.strategy === "CONT" && typeof t.R === "number");
const LIS = CONT.filter(lisible);
const P = LIS.filter(figure), REST = LIS.filter((t) => !figure(t));
const B = (a) => a.filter((t) => t.side === "BUY"), V = (a) => a.filter((t) => t.side === "SELL");

const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const jour = (t) => `${t.asset}|${String(t.tsMT ?? "").slice(0, 10)}`;
const grap = (a) => new Set(a.map(jour)).size;
const wrG = (a) => { const m = new Map(); for (const t of a) { const k = jour(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  let g = 0; for (const [, v] of m) if (Rn(v) > 0) g++; return m.size ? 100 * g / m.size : NaN; };
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(26)}${String(a.length).padStart(6)}${String(grap(a)).padStart(6)}${wr(a).toFixed(2).padStart(9)} %${wrG(a).toFixed(1).padStart(8)} %${Rn(a).toFixed(1).padStart(9)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(26)}     —`;
const HEAD = `   ${"".padEnd(26)}${"tirs".padStart(6)}${"grap".padStart(6)}${"WR".padStart(10)}${"WRgrap".padStart(9)}${"R".padStart(9)}${"R/tir".padStart(9)}`;

console.log(`\n== CONT · H1 — z live > ${ZB} ET %K live > ${KB} ET dz DOWN (BUY brut, SELL miroir) ==`);
console.log(`   carnet ${S.length} · rang 3 ${CONT.length} · lisibles ${LIS.length} (${CONT.length - LIS.length} muet)`);
console.log(`   REPERES  point mort 75,00 · carnet ${wr(S).toFixed(2)} · rang 3 ${wr(CONT).toFixed(2)} · 3 BUY ${wr(B(CONT)).toFixed(2)} · 3 SELL ${wr(V(CONT)).toFixed(2)}\n`);
console.log(HEAD);
console.log(L("LA CIBLE", P)); console.log(L("   BUY  (brut)", B(P))); console.log(L("   SELL (miroir)", V(P)));
console.log(L("RESTE DU RANG 3", REST)); console.log(L("   BUY", B(REST))); console.log(L("   SELL", V(REST)));

console.log(`\n   -- CHAQUE AXE SEUL --`); console.log(HEAD);
for (const [nm, f] of [[`z H1 live > ${ZB}`, a1], [`%K H1 live > ${KB}`, a2], ["dz DOWN (3 col.)", a3]]) {
  console.log(L(nm, LIS.filter(f)));
  console.log(L("     BUY", B(LIS.filter(f)))); console.log(L("     SELL", V(LIS.filter(f))));
}
console.log(`\n   -- CHAQUE AXE RETIRE --`); console.log(HEAD);
const AX = [["1", a1], ["2", a2], ["3", a3]];
for (const [nm, f] of AX) console.log(L("sans " + nm, LIS.filter((t) => AX.filter(([, g]) => g !== f).every(([, g]) => g(t)))));

console.log(`\n   -- LES 7 COLONNES de dz, a z > ${ZB} ET %K > ${KB} --`); console.log(HEAD);
for (const c of ["EXPLOSIVE_DOWN", "FAST_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"]) {
  const a = LIS.filter((t) => a1(t) && a2(t) && col(t) === c);
  console.log(L(c, a)); if (a.length) { console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a))); }
}
console.log(`\n   -- BALAYAGE MARGINAL du %K H1 (a z > ${ZB} et dz DOWN) --`); console.log(HEAD);
{
  const K = [0, 40, 50, 60, 70, 80, 90, 100.01];
  for (let i = 0; i < K.length - 1; i++)
    console.log(L(`%K [${K[i]} . ${K[i + 1] > 100 ? "100" : K[i + 1]}[`,
      LIS.filter((t) => a1(t) && a3(t) && kP(t) >= K[i] && kP(t) < K[i + 1])));
}
console.log("");

// -- BALAYAGE DEMANDE : %K a 80/75/70/65/60/55/50, CUMULATIF PUIS MARGINAL, PAR COTE --
// /!\ UN CUMULATIF NE PROUVE JAMAIS UNE BORNE — on lit le MARGINAL en dessous.
{
  const KS = [80, 75, 70, 65, 60, 55, 50];
  console.log(`   == BALAYAGE %K H1 (z live > ${ZB}, dz DOWN) — CUMULATIF ==`); console.log(HEAD);
  for (const k of KS) {
    const a = LIS.filter((t) => a1(t) && a3(t) && kP(t) > k);
    console.log(L(`%K > ${k}`, a)); console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a)));
  }
  console.log(`\n   == LE MEME, EN BANDES MARGINALES ==`); console.log(HEAD);
  const bornes = [50, 55, 60, 65, 70, 75, 80, 100.01];
  for (let i = bornes.length - 2; i >= 0; i--) {
    const lo = bornes[i], hi = bornes[i + 1];
    const a = LIS.filter((t) => a1(t) && a3(t) && kP(t) > lo && kP(t) <= (hi > 100 ? 100 : hi));
    console.log(L(`%K ]${lo} . ${hi > 100 ? "100" : hi}]`, a));
    if (a.length) { console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a))); }
  }
  console.log("");
}

// -- BALAYAGE DEMANDE : `z H1 live` a 2,00 -> 3,00 (a %K > KB, dz DOWN), PAR COTE --
{
  const ZS = [2.00, 2.15, 2.30, 2.45, 2.50, 2.55, 2.60, 2.75, 3.00];
  console.log(`   == BALAYAGE z H1 live (%K > ${KB}, dz DOWN) — CUMULATIF ==`); console.log(HEAD);
  for (const z of ZS) {
    const a = LIS.filter((t) => a2(t) && a3(t) && zP(t) > z);
    console.log(L(`z > ${z.toFixed(2)}`, a)); console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a)));
  }
  console.log(`\n   == LE MEME, EN BANDES MARGINALES ==`); console.log(HEAD);
  const bd = [...ZS, Infinity];
  for (let i = 0; i < bd.length - 1; i++) {
    const lo = bd[i], hi = bd[i + 1];
    const a = LIS.filter((t) => a2(t) && a3(t) && zP(t) > lo && zP(t) <= hi);
    console.log(L(`z ]${lo.toFixed(2)} . ${hi === Infinity ? "+inf" : hi.toFixed(2)}]`, a));
    if (a.length) { console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a))); }
  }
  console.log("");
}

// -- FIGURE A 4 AXES : + `K-D H1 < 0` ORIENTE, et `%K > 40` (owner 21/08) --
//   `K-D < 0` oriente = la ligne RAPIDE est repassee SOUS la lente DANS LE SENS DU PARI : le %K
//   a deja lache. Croise avec `dz DOWN` (la distance se referme) et `%K` encore au-dessus de 40,
//   la figure dit « le mouvement s'est retourne mais l'oscillateur n'est pas encore redescendu ».
{
  const K40 = Number(process.env.K40 ?? 40);
  const kdOr = (t) => t.kdGapH1 * SG(t);
  const lis4 = LIS.filter((t) => Number.isFinite(t.kdGapH1));
  const base = (t) => kdOr(t) < 0 && kP(t) > K40 && a3(t);
  console.log(`   == z H1 live x [K-D < 0] x [%K > ${K40}] x [dz DOWN] ==`);
  console.log(`   lisibles avec K-D : ${lis4.length} / ${LIS.length}`);
  console.log(HEAD);
  console.log(L(`base (sans le z)`, lis4.filter(base)));
  console.log(L("     BUY", B(lis4.filter(base)))); console.log(L("     SELL", V(lis4.filter(base))));
  console.log(`\n   -- CUMULATIF sur le z --`); console.log(HEAD);
  for (const z of [2.00, 2.15, 2.30]) {
    const a = lis4.filter((t) => base(t) && zP(t) > z);
    console.log(L(`z > ${z.toFixed(2)}`, a)); console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a)));
  }
  console.log(`\n   -- MARGINAL sur le z --`); console.log(HEAD);
  const bd = [2.00, 2.15, 2.30, Infinity];
  for (let i = 0; i < bd.length - 1; i++) {
    const a = lis4.filter((t) => base(t) && zP(t) > bd[i] && zP(t) <= bd[i + 1]);
    console.log(L(`z ]${bd[i].toFixed(2)} . ${bd[i + 1] === Infinity ? "+inf" : bd[i + 1].toFixed(2)}]`, a));
    if (a.length) { console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a))); }
  }
  console.log(`\n   -- CHAQUE AXE RETIRE, a z > 2,00 --`); console.log(HEAD);
  const AX4 = [["z > 2,00", (t) => zP(t) > 2.00], ["K-D < 0", (t) => kdOr(t) < 0],
               [`%K > ${K40}`, (t) => kP(t) > K40], ["dz DOWN", a3]];
  for (const [nm, f] of AX4)
    console.log(L("sans " + nm, lis4.filter((t) => AX4.filter(([, g]) => g !== f).every(([, g]) => g(t)))));
  console.log(`\n   -- LE RESTE DU RANG 3 (hors figure z>2,00) --`); console.log(HEAD);
  const cib = lis4.filter((t) => base(t) && zP(t) > 2.00), rst = lis4.filter((t) => !(base(t) && zP(t) > 2.00));
  console.log(L("RESTE", rst)); console.log(L("     BUY", B(rst))); console.log(L("     SELL", V(rst)));
  console.log("");
}

// -- FIGURE OWNER : `z H1 live > 2,15` + `%K H1 live > 60` + `delta%K H1 < -0,5` ORIENTE --
//   `dKH1` = `h1.dK` = `k0 - k1` (LIVE moins CLOTURE) : la VITESSE du %K dans la barre en cours.
//   /!\ C'est une DECOMPOSITION, pas une fraicheur : `kH1S1` est le niveau ETABLI, `dKH1` ce qui
//   se passe MAINTENANT. Oriente par le cote, `< -0,5` veut dire « le %K RECULE dans le sens du
//   pari » — l'oscillateur a commence a lacher alors qu'il est encore haut.
{
  const DK = Number(process.env.DK ?? -0.5);
  const dKor = (t) => t.dKH1 * SG(t);
  const lis = LIS.filter((t) => Number.isFinite(t.dKH1));
  const b1 = (t) => zP(t) > 2.15, b2 = (t) => kP(t) > 60, b3 = (t) => dKor(t) < DK;
  const cible = (t) => b1(t) && b2(t) && b3(t);
  const P2 = lis.filter(cible), R2 = lis.filter((t) => !cible(t));
  console.log(`   == CONT H1 — z live > 2,15 · %K live > 60 · delta%K < ${DK} (BUY brut, SELL miroir) ==`);
  console.log(`   lisibles avec delta%K : ${lis.length} / ${LIS.length}`);
  console.log(HEAD);
  console.log(L("LA CIBLE", P2)); console.log(L("   BUY  (brut)", B(P2))); console.log(L("   SELL (miroir)", V(P2)));
  console.log(L("RESTE DU RANG 3", R2)); console.log(L("   BUY", B(R2))); console.log(L("   SELL", V(R2)));
  console.log(`\n   -- CHAQUE AXE SEUL --`); console.log(HEAD);
  for (const [nm, f] of [["z H1 live > 2,15", b1], ["%K H1 live > 60", b2], [`delta%K < ${DK}`, b3]]) {
    const a = lis.filter(f); console.log(L(nm, a)); console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a)));
  }
  console.log(`\n   -- CHAQUE AXE RETIRE --`); console.log(HEAD);
  const AX = [["z", b1], ["%K", b2], ["delta%K", b3]];
  for (const [nm, f] of AX) console.log(L("sans " + nm, lis.filter((t) => AX.filter(([, g]) => g !== f).every(([, g]) => g(t)))));
  console.log(`\n   -- BALAYAGE MARGINAL de delta%K (a z > 2,15 et %K > 60) --`); console.log(HEAD);
  const bd = [-Infinity, -5, -3, -2, -1, -0.5, 0, 1, Infinity];
  for (let i = 0; i < bd.length - 1; i++) {
    const a = lis.filter((t) => b1(t) && b2(t) && dKor(t) > bd[i] && dKor(t) <= bd[i + 1]);
    console.log(L(`dK ]${bd[i] === -Infinity ? "-inf" : bd[i]} . ${bd[i + 1] === Infinity ? "+inf" : bd[i + 1]}]`, a));
  }
  console.log("");
}
