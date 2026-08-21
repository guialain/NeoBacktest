// _cont_m15_bas_contact.mjs — M15 : le %K est EN BAS et les lignes K/D se TOUCHENT.
// =============================================================================================
// LA DEMANDE (owner 21/08) : « wr cont sell, k m15 live < 20, kd = contact ».
//   BUY = miroir derive (`%K M15 live > 80`, meme lecture du contact).
//
// /!\ « kd = CONTACT » N'A PAS UN SEUL SENS DANS CE DEPOT, ET LE PIEGE A DEJA MORDU :
//   (a) l'ETAT de la roue `kdCycleState` — MAIS il n'existe PAS en M15 sur le record de signal
//       (seuls `kdCycleH1` et `kdCycleH4` y sont), et en H4 il a ete mesure INATTEIGNABLE le 21/08
//       (51/51 sortent en `CROSS`, car `kd0*kd1 < 0` est teste AVANT la bande morte).
//   (b) la BANDE DE DISTANCE `kdDistanceBand(|K-D|)` — son 1er barreau s'appelle `CONTACT`.
//   (c) la MAGNITUDE NUE `|K-D| <= STOCHDYN_CONTACT (2,1)`.
//   => (b) et (c) sont mesurees TOUTES LES DEUX ici, et on dit laquelle porte la population.
//      Ecrire l'une en croyant l'autre donnerait une regle qui n'est pas celle qu'on croit.
//
// /!\ `kM15` vient de `perTf.m15.k` = `stoch_k_m15_s0`, donc le LIVE (verifie dans le detecteur).
// POPULATION : les TIRS du carnet (rang 3), 100/100, spread facture.
// Usage : `Z_DELTA_MEDIAN_SRC=v1 node --max-old-space-size=12288 stats/_cont_m15_bas_contact.mjs`
//         surcharges : `K=20`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { STOCHDYN_CONTACT } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const R = runMatrixPortfolio(fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv")).sort().map((f) => path.join(DIR, f)),
  { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const S = R.signals ?? [];
const KB = Number(process.env.K ?? 20);

// ⭐ ORIENTATION : le SELL est le sens brut ici (`%K` BAS pour une vente). `kP` = le %K du cote du
//   pari, donc `< KB` des deux cotes sans ecrire un seul nombre par cote.
const SG = (t) => t.side === "SELL" ? 1 : -1;
const kP = (t) => (SG(t) === 1 ? t.kM15 : 100 - t.kM15);
const lisible = (t) => Number.isFinite(t.kM15);
const bas = (t) => kP(t) < KB;
const contactBande = (t) => t.kdDistM15 === "CONTACT";
const contactMagn = (t) => Number.isFinite(t.kdM15) && Math.abs(t.kdM15) <= STOCHDYN_CONTACT;

const CONT = S.filter((t) => t.strategy === "CONT" && typeof t.R === "number" && lisible(t));
const V = CONT.filter((t) => t.side === "SELL"), B = CONT.filter((t) => t.side === "BUY");

const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const jour = (t) => `${t.asset}|${String(t.tsMT ?? "").slice(0, 10)}`;
const grap = (a) => new Set(a.map(jour)).size;
const wrG = (a) => { const m = new Map(); for (const t of a) { const k = jour(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  let g = 0; for (const [, v] of m) if (Rn(v) > 0) g++; return m.size ? 100 * g / m.size : NaN; };
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(32)}${String(a.length).padStart(6)}${String(grap(a)).padStart(6)}${wr(a).toFixed(2).padStart(9)} %${wrG(a).toFixed(1).padStart(8)} %${Rn(a).toFixed(1).padStart(9)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(32)}     —`;
const HEAD = `   ${"".padEnd(32)}${"tirs".padStart(6)}${"grap".padStart(6)}${"WR".padStart(10)}${"WRgrap".padStart(9)}${"R".padStart(9)}${"R/tir".padStart(9)}`;

console.log(`\n== CONT — %K M15 live < ${KB} (cote du pari) ET K/D M15 en CONTACT ==`);
console.log(`   SELL = sens brut (%K < ${KB}) · BUY = miroir (%K > ${100 - KB})`);
console.log(`   carnet ${S.length} · rang 3 ${CONT.length} (SELL ${V.length} / BUY ${B.length}) · lisibles ${CONT.length}`);
console.log(`   REPERES  point mort 75,00 · rang 3 ${wr(CONT).toFixed(2)} · 3 SELL ${wr(V).toFixed(2)} · 3 BUY ${wr(B).toFixed(2)}\n`);

console.log(`   ##### LECTURE (b) : BANDE DE DISTANCE \`kdDistM15 === "CONTACT"\` #####`); console.log(HEAD);
console.log(L("SELL · %K bas + CONTACT", V.filter((t) => bas(t) && contactBande(t))));
console.log(L("BUY  · miroir", B.filter((t) => bas(t) && contactBande(t))));
console.log(L("SELL · le RESTE du cote", V.filter((t) => !(bas(t) && contactBande(t)))));
console.log(L("BUY  · le RESTE du cote", B.filter((t) => !(bas(t) && contactBande(t)))));

console.log(`\n   ##### LECTURE (c) : MAGNITUDE \`|K-D| <= ${STOCHDYN_CONTACT}\` #####`); console.log(HEAD);
console.log(L("SELL · %K bas + |K-D| <= 2,1", V.filter((t) => bas(t) && contactMagn(t))));
console.log(L("BUY  · miroir", B.filter((t) => bas(t) && contactMagn(t))));

console.log(`\n   -- LES DEUX AXES SEULS --`); console.log(HEAD);
for (const [nm, f] of [[`%K M15 < ${KB} (oriente)`, bas], ["kdDistM15 = CONTACT", contactBande], [`|K-D M15| <= ${STOCHDYN_CONTACT}`, contactMagn]]) {
  const a = CONT.filter(f); console.log(L(nm, a));
  console.log(L("     SELL", a.filter((t) => t.side === "SELL"))); console.log(L("     BUY", a.filter((t) => t.side === "BUY")));
}

console.log(`\n   -- LES 5 BANDES DE \`kdDistM15\`, A %K BAS, PAR COTE --`); console.log(HEAD);
for (const bd of ["CONTACT", "LOW", "MEDIUM", "HIGH", "EXTREME"]) {
  const a = CONT.filter((t) => bas(t) && t.kdDistM15 === bd);
  console.log(L(bd, a));
  if (a.length) { console.log(L("     SELL", a.filter((t) => t.side === "SELL"))); console.log(L("     BUY", a.filter((t) => t.side === "BUY"))); }
}

console.log(`\n   -- BALAYAGE MARGINAL du %K M15 (a CONTACT), PAR COTE --`); console.log(HEAD);
{
  const bd = [0, 10, 20, 30, 40, 50, 100.01];
  for (let i = 0; i < bd.length - 1; i++) {
    const a = CONT.filter((t) => contactBande(t) && kP(t) >= bd[i] && kP(t) < bd[i + 1]);
    console.log(L(`%K [${bd[i]} . ${bd[i + 1] > 100 ? "100" : bd[i + 1]}[`, a));
    if (a.length) { console.log(L("     SELL", a.filter((t) => t.side === "SELL"))); console.log(L("     BUY", a.filter((t) => t.side === "BUY"))); }
  }
}
console.log(`\n   -- LA CIBLE SELL (lecture b), TIR PAR TIR --`);
for (const t of V.filter((x) => bas(x) && contactBande(x)).sort((x, y) => String(x.tsMT).localeCompare(String(y.tsMT))))
  console.log(`   ${String(t.asset).padEnd(12)}${String(t.tsMT).padEnd(22)}%K ${t.kM15.toFixed(1).padStart(5)}  K-D ${String(t.kdM15 ?? "-").padStart(7)}  dist ${String(t.kdDistM15 ?? "-").padEnd(9)}  R ${(t.R ?? 0).toFixed(2).padStart(6)}`);
console.log("");
