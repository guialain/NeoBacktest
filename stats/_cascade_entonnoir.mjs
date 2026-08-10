// _cascade_entonnoir.mjs — OÙ VONT LES ROWS, POUR DE VRAI.
//
// 🔴🔥⭐⭐⭐ CE QUE CETTE SONDE RÉPARE : toutes les autres tournent avec des INSTRUMENTS
//   (`PB_ISOLE=1` fait CÉDER le rang ①, `MIN_PB=-31` fait tirer le rang ② sur tout). Elles
//   décrivent donc l'instrument autant que le moteur. Le 10/08, j'ai lu « 88 170 barres admises en
//   pullback » sur une trace obtenue sous `PB_ISOLE` — c'était en réalité le nombre TOTAL de
//   décisions du moteur, toutes boîtes confondues. Le dénominateur du moteur lu comme la population
//   d'une boîte. ⇒ ICI, AUCUN INSTRUMENT. C'est la seule fiche qui décrit la cascade telle qu'elle est.
//
// ⚠ `dec` du summary est un OBJET (décisions par étiquette), pas un compteur — le sommer donne
//   `[object Object]`. Et les `drops` sont PLAFONNÉS (`dropCap`), donc les compter dans `r.drops`
//   tronque : c'est `dec` qui porte les totaux, pas la liste.
// ⚠ `NO_TRIGGER=1` reste : c'est le moteur PUR (sans DealTrigger), ce qui rend les changements de
//   scoring attribuables. Ce n'est pas un voile sur la cascade.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let rows = 0, evals = 0, adm = 0, fires = 0, opened = 0;
const dec = {}, admDetail = {};
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const s = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).summary || {};
  rows += s.rows || 0; evals += s.evals || 0; adm += s.admBlocked || 0;
  fires += s.fires || 0; opened += s.opened || 0;
  for (const [k, v] of Object.entries(s.dec || {})) dec[k] = (dec[k] || 0) + v;
  for (const [k, v] of Object.entries(s.adm || {})) admDetail[k] = (admDetail[k] || 0) + v;
}
const T = Object.values(dec).reduce((a, b) => a + b, 0);
const pc = (a, b) => ((100 * a / b).toFixed(1) + "%").padStart(8);
console.log("\n  ══ ENTONNOIR RÉEL DE LA CASCADE ══   aucun instrument · MIN_PB = MIN_CONT = 1000");
console.log(`  lignes du dataset              ${String(rows).padStart(8)}`);
console.log(`  bloquées par l'ADMISSION       ${String(adm).padStart(8)} ${pc(adm, rows)}   ${Object.entries(admDetail).map(([k, v]) => k + " " + v).join(" · ")}`);
console.log(`  ÉVALUÉES par le moteur         ${String(evals).padStart(8)} ${pc(evals, rows)}`);
console.log(`  décisions rendues              ${String(T).padStart(8)} ${pc(T, evals)}  des évaluées`);
console.log("\n  ce que la cascade en fait :");
for (const [k, v] of Object.entries(dec).sort((a, b) => b[1] - a[1]))
  console.log("    " + k.padEnd(30) + String(v).padStart(8) + pc(v, T));
console.log(`\n  FIRES ${fires} · réellement ouverts ${opened}  (capacité, spacing, dédup)`);
// ⚠ TROU NON EXPLIQUÉ, ÉCRIT PLUTÔT QU'HABILLÉ : admission + évaluées ≠ lignes.
const trou = rows - adm - evals;
if (trou > 0) console.log(`\n  ⚠ ${trou} lignes (${(100 * trou / rows).toFixed(1)} %) ne sont NI bloquées par l'admission NI évaluées.\n     Ces compteurs ne disent pas où elles passent. À élucider — ne pas leur inventer un chemin.`);
