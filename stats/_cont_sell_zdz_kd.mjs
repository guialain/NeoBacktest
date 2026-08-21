// _cont_sell_zdz_kd.mjs — VETO CONT **SELL SEUL**, 4 AXES, EN SENS BRUT (dictee owner 21/08).
// =============================================================================================
// LA FIGURE : on refuse une CONTINUATION VENDEUSE quand le H4 est deja du cote HAUSSIER et qu'il
//   s'y enfonce (`z H4 cloture > +0,30` ET `dz H4 live > +0,20`), pendant que le H1 pousse aussi
//   vers le haut (`K-D H1 > +2,1`) sans avoir consomme sa bande (`%K H1 live < 70`).
//   => la poussee haussiere est INSTALLEE, FRAICHE, et il lui reste de la course. On ne vend pas la.
//
// ATTENTION — REGLE PAR COTE, PAS DE MIROIR. Le depot dit « une fenetre = une SAISON » et
//   « un miroir sur un cote JAMAIS MESURE = la ou le degat arrive ». La sonde mesure donc AUSSI ce
//   que le miroir BUY aurait valu, pour que le choix de ne pas le poser soit un choix EXPLICITE.
//
// LES BORNES SONT DES CONSTANTES DU DEPOT : `0,20` = `CONT_DZ_SEUIL` · `2,1` = `STOCHDYN_CONTACT`
//   · `0,30` = frontiere `Z_MID -> Z_P_030` de `CONT_ZDZ_BANDES` et defaut `CONT_ZH4_PUSH_BORNE`.
//
// RECOUVREMENTS NOMMES (la poche est MARGINALE, mesuree sur ce qui SURVIT deja) :
//   `cont-deux-horloges-contre` (H1 pousse contre) · `cont-h4-push-contre` (meme plancher 0,30,
//   mais sur le `dz` H1 et avec un PLAFOND a 1,05 que cette figure n'a pas).
//
// LA BARRE : le `WR` DEJA ACQUIS du **cote SELL du rang 3**, pas le point mort.
// Usage : `node --max-old-space-size=12288 stats/_cont_sell_zdz_kd.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { CONT_DZ_SEUIL } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/contScoringV1.js");
const { STOCHDYN_CONTACT } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const R = runMatrixPortfolio(fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv")).sort().map((f) => path.join(DIR, f)),
  { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const S = R.signals ?? [];
const ZB = Number(process.env.ZB ?? 0.30), K1 = Number(process.env.K1 ?? 70);
const LO = CONT_DZ_SEUIL, KD = STOCHDYN_CONTACT;

const dzH4 = (t) => (Number.isFinite(t.zscoreH4S0) && Number.isFinite(t.zscoreH4)) ? t.zscoreH4S0 - t.zscoreH4 : null;
const lisible = (t) => Number.isFinite(t.kH1) && Number.isFinite(t.kdGapH1) && Number.isFinite(t.zscoreH4) && dzH4(t) !== null;
// SENS BRUT pour le SELL ; le bras BUY applique le MIROIR (signes retournes), pour comparaison seule.
const SG = (t) => t.side === "SELL" ? 1 : -1;
const b1 = (t) => t.zscoreH4 * SG(t) > ZB;      // z H4 CLOTURE du cote haussier (pour un SELL)
const b2 = (t) => dzH4(t) * SG(t) > LO;         // dz H4 LIVE s'y enfonce encore
const b3 = (t) => (SG(t) === 1 ? t.kH1 : 100 - t.kH1) < K1;   // %K H1 LIVE n'a pas consomme
const b4 = (t) => t.kdGapH1 * SG(t) > KD;       // K-D H1 LIVE separe vers le haut
const AXES = [[`1 z H4 close > ${ZB}`, b1], [`2 dz H4 live > ${LO}`, b2], [`3 %K H1 live < ${K1}`, b3], [`4 K-D H1 > ${KD}`, b4]];
const figure = (t) => AXES.every(([, f]) => f(t));

const CONT = S.filter((t) => t.strategy === "CONT" && typeof t.R === "number" && lisible(t));
const SELL = CONT.filter((t) => t.side === "SELL"), BUY = CONT.filter((t) => t.side === "BUY");
const P = SELL.filter(figure), REST = SELL.filter((t) => !figure(t));
const Pb = BUY.filter(figure), RESTb = BUY.filter((t) => !figure(t));

const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const jour = (t) => `${t.asset}|${String(t.tsMT ?? "").slice(0, 10)}`;
const grap = (a) => new Set(a.map(jour)).size;
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(32)}${String(a.length).padStart(6)}${String(grap(a)).padStart(7)}${wr(a).toFixed(2).padStart(9)} %${Rn(a).toFixed(1).padStart(9)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(32)}     —`;
const HEAD = `   ${"".padEnd(32)}${"tirs".padStart(6)}${"grap".padStart(7)}${"WR".padStart(10)}${"R net".padStart(9)}${"R/tir".padStart(9)}`;

console.log(`\n== VETO CONT **SELL** — z H4 > ${ZB} + dz H4 > ${LO} + %K H1 < ${K1} + K-D H1 > ${KD} ==`);
console.log(`   carnet ${S.length} · rang 3 ${CONT.length} (SELL ${SELL.length} / BUY ${BUY.length})`);
console.log(`   REPERES : point mort 75,00 · carnet ${wr(S).toFixed(2)} · rang 3 ${wr(CONT).toFixed(2)} · **rang 3 SELL ${wr(SELL).toFixed(2)}**\n`);
console.log(HEAD);
console.log(L("LA CIBLE (SELL)", P));
console.log(L("RESTE DU RANG 3 SELL", REST));
console.log(L("-- le miroir BUY, NON POSE --", Pb));
console.log(L("RESTE DU RANG 3 BUY", RESTb));

console.log(`\n   -- CHAQUE AXE SEUL, SUR LE SELL --`); console.log(HEAD);
for (const [nm, f] of AXES) console.log(L(nm, SELL.filter(f)));
console.log(`\n   -- CHAQUE AXE RETIRE (necessaire ?) --`); console.log(HEAD);
for (const [nm, f] of AXES) console.log(L("sans " + nm.slice(0, 1), SELL.filter((t) => AXES.filter(([, g]) => g !== f).every(([, g]) => g(t)))));
console.log(`\n   -- LES PAIRES --`); console.log(HEAD);
for (let i = 0; i < AXES.length; i++) for (let j = i + 1; j < AXES.length; j++)
  console.log(L(`${AXES[i][0].slice(0, 1)}+${AXES[j][0].slice(0, 1)} : ${AXES[i][0].slice(2)} & ${AXES[j][0].slice(2)}`.slice(0, 32),
    SELL.filter((t) => AXES[i][1](t) && AXES[j][1](t))));

console.log(`\n   -- LES TROIS RETRAITS SUR LA CIBLE --`); console.log(HEAD);
const pire = (a, cle) => { const m = new Map(); for (const t of a) m.set(cle(t), (m.get(cle(t)) ?? 0) + t.R);
  let bk = null, bv = Infinity; for (const [k, v] of m) if (v < bv) { bv = v; bk = k; } return [bk, bv]; };
for (const [nm, cle] of [["grappe", jour], ["jour", (t) => String(t.tsMT ?? "").slice(0, 10)], ["actif", (t) => t.asset]]) {
  const [k, v] = pire(P, cle);
  console.log(L(`sans la pire ${nm}`, P.filter((t) => cle(t) !== k)) + `   <- ${k} (${(v ?? 0).toFixed(1)} R)`);
}

console.log(`\n   -- BALAYAGE z H4 (3 autres axes tenus), SELL — MARGINAL --`); console.log(HEAD);
{
  const base = (t) => b2(t) && b3(t) && b4(t);
  const Z = [-Infinity, -0.30, 0.00, 0.30, 0.60, 1.05, 1.55, Infinity];
  for (let i = 0; i < Z.length - 1; i++)
    console.log(L(`z [${Z[i] === -Infinity ? "-inf" : Z[i].toFixed(2)} . ${Z[i + 1] === Infinity ? "+inf" : Z[i + 1].toFixed(2)}[`,
      SELL.filter((t) => base(t) && t.zscoreH4 >= Z[i] && t.zscoreH4 < Z[i + 1])));
}
console.log(`\n   -- LA CIBLE, TIR PAR TIR --`);
for (const t of P.sort((x, y) => String(x.tsMT).localeCompare(String(y.tsMT))))
  console.log(`   ${String(t.asset).padEnd(12)}${String(t.tsMT).padEnd(22)}z ${t.zscoreH4.toFixed(2).padStart(6)}  dz ${dzH4(t).toFixed(2).padStart(6)}  %K1 ${t.kH1.toFixed(1).padStart(5)}  K-D ${t.kdGapH1.toFixed(2).padStart(6)}  R ${(t.R ?? 0).toFixed(2).padStart(6)}`);
console.log("");
