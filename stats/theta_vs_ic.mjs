// ============================================================================================
// theta_vs_ic.mjs — DÉFINIR LES RÉGIMES SUR `intraday_change` PLUTÔT QUE SUR `theta` ?
//   (question owner 2026-07-20)
// --------------------------------------------------------------------------------------------
// CE QUE THETA EST DÉJÀ : theta = arctan( (intraday_change / p50) / fraction_de_journée ).
//   L'IC est DÉJÀ DEDANS, au numérateur. Theta n'est pas une autre mesure : c'est l'IC
//   NORMALISÉ deux fois — par le p50 de l'actif (comparabilité cross-asset) et par l'heure.
//   « Revenir à l'IC » = RETIRER la normalisation par l'heure (et, si l'on retire aussi le p50,
//   perdre l'universalité — ce qui imposerait des seuils PAR ACTIF, exclus par principe).
//
// LE MOTIF HISTORIQUE (bascule du 15/07) : l'IC est un CUMUL depuis l'open ⇒ il RAMPE avec
//   l'heure. Une « force EXTREME » à 17h est triviale (le jour a eu le temps de dériver).
//
// ⭐ LA QUESTION HONNÊTE N'EST PAS « lequel est plus juste » MAIS « lequel SÉPARE MIEUX LES
//   RÉSULTATS ». On compare donc leur pouvoir DISCRIMINANT sur le R des CONT, à déciles égaux :
//     - theta brut (thetaDayDeg, ce que le moteur utilise)
//     - ic/p50    (IC normalisé actif, SANS l'heure — la proposition)
//     - ic brut   (témoin : doit être le PIRE si le biais horaire est réel)
//   Un bon axe de régime a un avgR MONOTONE et ÉTALÉ le long de ses déciles.
//
// 🔴🔴 CE SCRIPT NE PEUT PAS TRANCHER LA QUESTION — BIAIS DE SÉLECTION.
//   Il mesure le pouvoir discriminant SUR LES TRADES DÉJÀ TIRÉS. Or c'est THETA qui a servi à les
//   SÉLECTIONNER : tous ont |theta| ≥ 25° dans leur sens (Q1 commence à 25,00). Un axe qui a servi
//   de filtre paraît PLAT après filtrage — précisément PARCE QU'il a fait son travail. L'étalement
//   plus large de l'IC ne prouve donc RIEN contre theta.
//   ⇒ Pour trancher, il faudrait RE-DÉRIVER les bandes sur ic/p50 et rejouer le moteur entier.
//   Ce script sert à UNE chose : montrer qu'aucun des trois axes n'a de pouvoir RÉSIDUEL
//   exploitable dans la population déjà tirée (aucun n'est monotone).
//
// Usage : node --max-old-space-size=12288 stats/theta_vs_ic.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { INTRADAY_CONFIG } = await import("../../Matrix-Revolution/src/components/robot/engines/config/IntradayConfig.js");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const SIG = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p50 = INTRADAY_CONFIG?.[asset]?.p50 ?? INTRADAY_CONFIG?.default?.p50 ?? null;
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (typeof s.R !== "number" || s.type === "EXHAUSTION") continue;
    // ⚠️ `intradayChange` — nom EXACT du champ (matrixBacktest ligne 161). ⭐ PIÈGE ÉVITÉ : un
    //   `Number(x)` sur un champ ABSENT rend 0, pas null ⇒ tous les octiles s'écrasent à [0…0] et
    //   deux axes différents deviennent IDENTIQUES sans lever d'erreur. (Ça m'est arrivé ici même.)
    const ic = s.intradayChange;
    SIG.push({ ...s, asset, p50, ic: (ic === null || ic === undefined) ? null : (Number.isFinite(Number(ic)) ? Number(ic) : null) });
  }
}
console.log(`CONT retenus : ${SIG.length} · avec theta ${SIG.filter((s) => Number.isFinite(s.thetaDayDeg)).length} · avec ic ${SIG.filter((s) => s.ic != null).length}`);
const mk = () => ({ n: 0, w: 0, l: 0, R: 0 });
const bump = (o, s) => { o.n++; o.R += s.R; if (s.outcome === "WIN") o.w++; else if (s.outcome === "LOSS") o.l++; };
const f3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
// axe SIGNÉ DANS LE SENS DU TRADE : un régime « fort » doit vouloir dire « fort DANS MON SENS ».
function report(name, val) {
  const rows = SIG.map((s) => ({ v: val(s), s })).filter((x) => Number.isFinite(x.v));
  if (!rows.length) { console.log(`\n${name} : AUCUNE donnée`); return; }
  rows.sort((a, b) => a.v - b.v);
  const Q = 8, per = Math.floor(rows.length / Q);
  console.log(`\n${name} — ${rows.length} trades, ${Q} octiles`);
  const avgs = [];
  for (let q = 0; q < Q; q++) {
    const slice = rows.slice(q * per, q === Q - 1 ? rows.length : (q + 1) * per);
    const o = mk(); for (const x of slice) bump(o, x.s);
    const a = o.R / o.n; avgs.push(a);
    console.log(`   Q${q + 1}  [${slice[0].v.toFixed(2)} … ${slice[slice.length - 1].v.toFixed(2)}]`.padEnd(34) +
      `avgR ${f3(a)}  n=${String(o.n).padStart(4)}  WR ${((o.w / (o.w + o.l)) * 100).toFixed(0)}%`);
  }
  console.log(`   ⇒ ÉTALEMENT (max−min des octiles) = ${(Math.max(...avgs) - Math.min(...avgs)).toFixed(3)}`);
}
const sgn = (s) => (s.side === "BUY" ? 1 : -1);
report("A. THETA signé dans le sens du trade (ce que le moteur utilise)", (s) => Number(s.thetaDayDeg) * sgn(s));
report("B. IC / p50 signé (proposition : IC normalisé actif, SANS l'heure)", (s) => (s.ic != null && s.p50) ? (s.ic / s.p50) * sgn(s) : NaN);
report("C. IC BRUT signé (témoin — doit être le PIRE si le biais horaire est réel)", (s) => s.ic != null ? s.ic * sgn(s) : NaN);
