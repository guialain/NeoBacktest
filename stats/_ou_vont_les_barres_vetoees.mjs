// _ou_vont_les_barres_vetoees.mjs — OÙ VONT LES BARRES QUE LE RANG ① REFUSE ?
// ============================================================================================
// 🎯 LA QUESTION (owner, 20/08) : une barre vetoée par l'EXH tombe-t-elle au ②/③, ou meurt-elle ?
//   Le dépôt affirme « un refus `structure` ROUTE, un `timing` TUE » — jamais VÉRIFIÉ au tir près.
//
// ⭐ POPULATION : `ghostAllExh`, toutes les barres où la thèse de fade a un avis (`exh ≠ 0`).
//   Le fantôme porte desormais `selStrategy` (ce que la CASCADE a retenu) et `hasSide`, sans quoi
//   une barre où le ③ a tiré etait indiscernable d'une barre morte — `fired` ne parle que du ①.
// ⚠ Le veto n'est retenu QUE s'il touche le CÔTÉ ADMIS (`vetoedBySide`). Un veto du côté non
//   retenu n'a rien bloqué (piège du 20/08, il avait inversé tout un classement).
// ⚠⚠ CECI DECRIT UN ETAT, PAS UNE CAUSALITE : « la barre est vetoée ET le ③ a tiré » ne prouve pas
//   que le ③ a tiré PARCE QUE l'EXH a été refusé — le ③ aurait peut-être tiré de toute façon.
//   La causalité se lit sur un A/B (veto `off`), et on l'a : retirer un veto ① rend +346 tirs au ①
//   et **−1 au ③**. ⇒ le ① ne nourrit pas le ③.
// ⚙ Usage : `node stats/_ou_vont_les_barres_vetoees.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
const { MIN_EXH } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";

const E = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllExh: true, chargeSpread: true });
  for (const c of (p.ghosts ?? []).filter((x) => x.ghost === "exh-all")) E.push({ ...c, asset: f.replace(/\.csv$/i, "") });
}
const vetosDe = (x) => ((x.vetoedBySide ?? {})[x.side] ?? []);
const sortie = (x) => {
  if (x.selStrategy === "EXH") return "① EXH a tire";
  if (x.selStrategy === "PB") return "② PB a tire";
  if (x.selStrategy === "CONT") return "③ CONT a tire";
  if (x.selStrategy) return `autre (${x.selStrategy})`;
  return `WAIT ${x.waitNature ?? "(sans nature)"}`;
};
const pct = (n, d) => (d ? (100 * n / d).toFixed(1).padStart(5) : "  —  ");
const tableau = (nom, pop, ref) => {
  const m = new Map();
  for (const x of pop) m.set(sortie(x), (m.get(sortie(x)) ?? 0) + 1);
  console.log(`\n   ── ${nom} — ${pop.length} barres ${ref ? `(${pct(pop.length, ref)} % du total)` : ""} ──`);
  for (const [k, v] of [...m.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`      ${k.padEnd(34)}${String(v).padStart(6)}   ${pct(v, pop.length)} %`);
};

console.log(`\n══ OÙ VONT LES BARRES REFUSÉES PAR LE RANG ① ══`);
console.log(`   ${E.length} barres où la thèse de fade a un avis · MIN_EXH ${MIN_EXH} · NO_TRIGGER=1`);
const vetoees = E.filter((x) => vetosDe(x).length);
const libres = E.filter((x) => !vetosDe(x).length);
tableau("TOUTES", E);
tableau("VETOÉES sur le côté admis", vetoees, E.length);
tableau("NON vetoées", libres, E.length);

// ⭐ PAR VETO — un refus `structure` doit ROUTER, un `timing` doit TUER. Si tous rendent le même
//   profil de sortie, la distinction `structure`/`timing` ne se voit pas dans les faits.
console.log(`\n   ── PAR VETO : que devient la barre ? (part de ses barres, côté admis) ──`);
console.log(`   ${"veto".padEnd(36)}${"barres".padStart(7)}${"③ CONT".padStart(9)}${"② PB".padStart(8)}${"① EXH".padStart(8)}${"WAIT".padStart(8)}`);
const ids = new Map();
for (const x of vetoees) for (const id of new Set(vetosDe(x))) (ids.get(id) ?? ids.set(id, []).get(id)).push(x);
for (const [id, a] of [...ids.entries()].sort((x, y) => y[1].length - x[1].length)) {
  if (a.length < 20) continue;
  const c = (f) => pct(a.filter(f).length, a.length);
  console.log(`   ${id.padEnd(36)}${String(a.length).padStart(7)}${c((x) => x.selStrategy === "CONT").padStart(8)} %${c((x) => x.selStrategy === "PB").padStart(6)} %${c((x) => x.selStrategy === "EXH").padStart(6)} %${c((x) => !x.selStrategy).padStart(6)} %`);
}
// ⚠ UNE BARRE VETOÉE OÙ L'EXH A QUAND MÊME TIRÉ N'EST PAS UNE INCOHÉRENCE : le veto peut avoir
//   touché un côté et l'EXH avoir tiré de l'AUTRE. On le compte pour ne pas le lire comme un bug.
const paradoxe = vetoees.filter((x) => x.selStrategy === "EXH");
console.log(`\n   ⚠ ${paradoxe.length} barres vetoées où le ① a TOUT DE MÊME tiré — le veto touchait l'autre côté, ce n'est pas une incohérence.`);
console.log("");
