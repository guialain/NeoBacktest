// _exh_poussee_croise.mjs — `|z H1|` x `%K H1 ORIENTE` SUR LA FIGURE `POUSSEE`.
// ============================================================================================
// 🎯 LA QUESTION : les deux axes trient SEULS et de facon monotone. Disent-ils la MEME chose ?
//   Tous deux mesurent une POSITION — si oui, un seul entre dans la table, sinon on compte deux
//   fois le meme avis (« additionner des avis d'accord AMPLIFIE, ca ne trie pas »).
// ⭐ Et si non, c'est le CROISEMENT qui donne les cases : « seul un croisement ou un produit
//   separe, une combinaison lineaire ne discrimine pas ».
// ⚠ NIVEAU FIRE-CANDIDAT, pas carnet. Ces WR CLASSENT.
// ⚙ Usage : `node stats/_exh_poussee_croise.mjs`  ·  `NMIN=150`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const NMIN = Number(process.env.NMIN ?? 150);

const T = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const p = prepareAsset(path.join(MATRIX, f), { ghostBoxes: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "boxes")) {
    if (x.eFigure !== "POUSSEE" || !x.eSide) continue;
    if (!Number.isFinite(x.zH1Closed) || !Number.isFinite(x.kH1b)) continue;
    const r = p.walk({ ...x, side: x.eSide, strategy: "EXH", type: "EXHAUSTION" });
    if (r && typeof r.R === "number") T.push({ ...x, R: r.R });
  }
}
const ZB = [[0,1.05],[1.05,1.55],[1.55,2.15],[2.15,Infinity]];
const KB = [[0,45],[45,65],[65,80],[80,101]];
const zi = (x) => ZB.findIndex(([a,b]) => Math.abs(x.zH1Closed) >= a && Math.abs(x.zH1Closed) < b);
const ko = (x) => (x.eSide === "SELL" ? x.kH1b : 100 - x.kH1b);
const ki = (x) => KB.findIndex(([a,b]) => ko(x) >= a && ko(x) < b);
const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const lab = ([a,b]) => `[${a}·${b === Infinity ? "+inf" : b}[`;

console.log(`\n══ FIGURE \`POUSSEE\` — |z H1| x %K H1 ORIENTE ══   ${T.length} barres · point mort 75,00 %`);
console.log(`   (n < ${NMIN} : case affichee mais marquee \`.\`)\n`);
console.log("   " + "|z| \ %K".padEnd(16) + KB.map((b) => lab(b).padStart(16)).join("") + "     LIGNE");
for (let i = 0; i < ZB.length; i++) {
  let ligne = "   " + lab(ZB[i]).padEnd(16);
  const tousZ = T.filter((x) => zi(x) === i);
  for (let j = 0; j < KB.length; j++) {
    const a = tousZ.filter((x) => ki(x) === j);
    const m = a.length < NMIN ? "." : " ";
    ligne += a.length ? `${wr(a).toFixed(1)}%${m}${String(a.length).padStart(6)}`.padStart(16) : "—".padStart(16);
  }
  ligne += `   ${wr(tousZ).toFixed(1)}% ${String(tousZ.length).padStart(6)}`;
  console.log(ligne);
}
let col = "   " + "COLONNE".padEnd(16);
for (let j = 0; j < KB.length; j++) {
  const a = T.filter((x) => ki(x) === j);
  col += `${wr(a).toFixed(1)}% ${String(a.length).padStart(6)}`.padStart(16);
}
console.log(col + `   ${wr(T).toFixed(1)}% ${String(T.length).padStart(6)}`);
console.log(`\n   ⚠ FIRE-CANDIDAT : le spacing en jette ~69 % APRES. Ces WR CLASSENT.\n`);
