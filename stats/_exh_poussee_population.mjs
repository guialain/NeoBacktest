// _exh_poussee_population.mjs — LA POPULATION DE LA FIGURE `POUSSEE`, POUR POUVOIR DICTER SA TABLE.
// ============================================================================================
// 🎯 LA QUESTION : la porte de type du 20/08 separe `TENDANCE` (regime FORT, cote `−regDir`) de
//   `POUSSEE` (regime FAIBLE, cote = signe de `z H1` clot. confirme par le live). La table de
//   `POUSSEE` N'EXISTE PAS — elle pointe sur celle de `TENDANCE`. Avant de la dicter, il faut voir
//   ce que la figure vaut et SUR QUELS AXES elle se separe.
//
// ⚠⚠ ON MESURE LE FADE AU COTE QUE LA PORTE A CHOISI (`eSide`), pas les deux cotes. La question
//   n'est pas « quel cote prendre » — elle est tranchee — mais « ce cote-la vaut-il quelque chose,
//   et qu'est-ce qui le trie ».
// ⚠ NIVEAU **FIRE-CANDIDAT**, PAS CARNET : on lit ce que la barre AURAIT rendu si le rang ① l'avait
//   prise, a capacite infinie et sans spacing. Le spacing en jette ~69 % APRES. Ces WR CLASSENT,
//   ils ne chiffrent pas un gain recuperable. Lecon du jour, verifiee 4 fois.
// ⚙ Usage : `node stats/_exh_poussee_population.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
const { SEUIL_V1 } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/exhScoringV1.js");
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";

const T = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostBoxes: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "boxes")) {
    if (!x.eFigure || !x.eSide) continue;
    const r = p.walk({ ...x, side: x.eSide, strategy: "EXH", type: "EXHAUSTION" });
    if (!r || typeof r.R !== "number") continue;
    T.push({ ...x, asset, R: r.R });
  }
}
const BE = 75;
const wr = (a) => (a.length ? 100 * a.filter((t) => (t.R ?? 0) > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + (t.R ?? 0), 0);
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(30)}${String(a.length).padStart(7)}${wr(a).toFixed(2).padStart(9)} %${Rn(a).toFixed(1).padStart(9)}${(Rn(a)/a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(30)}      —`;
const HEAD = `   ${"".padEnd(30)}${"barres".padStart(7)}${"WR".padStart(10)}${"R net".padStart(9)}${"R/barre".padStart(9)}`;

const P = T.filter((x) => x.eFigure === "POUSSEE");
const D = T.filter((x) => x.eFigure === "TENDANCE");
console.log(`\n══ LA FIGURE \`POUSSEE\` — SA POPULATION ET SES AXES ══`);
console.log(`   ${T.length} barres evaluees au rang ① · point mort ${BE},00 % · SEUIL_V1 ${SEUIL_V1}`);
console.log(`\n   ── ① LES DEUX FIGURES, COTE A COTE ──`);
console.log(HEAD);
console.log(L("TENDANCE (regime FORT)", D));
console.log(L("POUSSEE  (regime FAIBLE)", P));
for (const [nom, a] of [["   dont SELL", P.filter((x)=>x.eSide==="SELL")], ["   dont BUY", P.filter((x)=>x.eSide==="BUY")]]) console.log(L(nom, a));

console.log(`\n   ── ② PAR |z H1| CLOTURE — l'axe qui a CHOISI le cote ──`);
console.log(HEAD);
const AZ = [[0,0.3],[0.3,1.05],[1.05,1.55],[1.55,2.15],[2.15,3],[3,Infinity]];
for (const [lo,hi] of AZ) {
  const a = P.filter((x) => Number.isFinite(x.zH1Closed) && Math.abs(x.zH1Closed) >= lo && Math.abs(x.zH1Closed) < hi);
  if (a.length >= 20) console.log(L(`|z| [${lo} · ${hi === Infinity ? "+inf" : hi}[`, a));
}
console.log(`\n   ── ③ PAR dRSI H1 ORIENTE (positif = l'elan va DANS le sens qu'on fade) ──`);
console.log(HEAD);
const o = (x) => (x.eSide === "SELL" ? 1 : -1) * (x.dRsiH1b ?? NaN);
const AR = [[-Infinity,-6],[-6,-3.09],[-3.09,-0.95],[-0.95,0.95],[0.95,3.09],[3.09,6],[6,Infinity]];
for (const [lo,hi] of AR) {
  const a = P.filter((x) => Number.isFinite(o(x)) && o(x) >= lo && o(x) < hi);
  if (a.length >= 20) console.log(L(`dRSI orient [${lo === -Infinity ? "-inf" : lo} · ${hi === Infinity ? "+inf" : hi}[`, a));
}
console.log(`\n   ── ④ PAR %K H1 CLOTURE ORIENTE (haut = extreme du cote fade) ──`);
console.log(HEAD);
const k = (x) => (x.eSide === "SELL" ? (x.kH1b ?? NaN) : 100 - (x.kH1b ?? NaN));
for (const [lo,hi] of [[0,25],[25,45],[45,55],[55,75],[75,85],[85,101]]) {
  const a = P.filter((x) => Number.isFinite(k(x)) && k(x) >= lo && k(x) < hi);
  if (a.length >= 20) console.log(L(`%K orient [${lo} · ${hi}[`, a));
}
console.log(`\n   ⚠ niveau FIRE-CANDIDAT : le spacing en jette ~69 % APRES. Ces WR CLASSENT.\n`);
