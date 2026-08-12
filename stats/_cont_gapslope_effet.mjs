// _cont_gapslope_effet.mjs — CE QUE L'ENTREE ⑷ DIT VRAIMENT SUR LA POPULATION QU'ELLE VA NOTER.
// ============================================================================================
// ⚠⚠ CE N'EST **PAS** UNE MESURE DE PERFORMANCE. Elle ne lit AUCUN resultat de trade : elle relit la
//   grille sur le residu du rang ③ et repond a trois questions qu'une table dictee ne peut pas
//   repondre seule, et qui ont chacune deja fait tomber une entree de ce depot :
//     ① combien de barres l'entree fait-elle TAIRE (condition `z > −0,3`) — un muet a 40 % ne serait
//       plus une entree, ce serait une porte d'appartenance deguisee ;
//     ② la note est-elle une CONSTANTE ? c'est le defaut qui a tue le `RSI` au rang ③ (94 % des
//       barres BUY recevaient la meme moitie de table, WR plat a 69 %) ;
//     ③ le MIROIR tient-il ? les deux cotes doivent recevoir la meme distribution de notes — sinon
//       l'orientation de la colonne est fausse, et rien d'autre ne le signalerait.
// 🎯 La 4ᵉ question — corrolee ou ANTI-corrolee a la qualite, comme l'etait `di` a −0,834 — demande
//   les resultats et donc `_cont_di_grille`. Elle reste OUVERTE, et c'est le prochain poste.
// ⚠ `file:///C:/...` en dur : sur Windows un chemin absolu nu est refuse par le chargeur ESM.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { prepareAsset } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const D = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const C = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/contScoringV1.js";
const { computeDeviation, GAP_LEVELS, DELTA_COLS } = await import(D);
const { contNoteGapSlope, CONT_Z_MIN } = await import(C);
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

const S = {};
for (const s of ["BUY", "SELL"]) S[s] = { n: 0, muetZ: 0, muetData: 0, notes: new Map(), cases: new Map() };

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f);
  const sym = path.basename(f, ".csv").toUpperCase();
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); rows.set(c[h.indexOf("timestamp")], c); }
  const asObj = (c) => Object.fromEntries(h.map((k, i) => [k, c[i]]));
  for (const x of (prepareAsset(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes" || !x.rangCont) continue;
    const c = rows.get(x.tsMT); if (!c) continue;
    const row = asObj(c);
    const d = computeDeviation(row, sym, "h1");
    // ⚠ `""` exclu AVANT Number() — `Number("") = 0` passerait au-dessus de −0,3 et l'entree
    //   parlerait sur une donnee absente, du BON cote. Piege repris le 09/08.
    const zRaw = row.zscore_h1;
    const z = (zRaw === "" || zRaw == null || !Number.isFinite(Number(zRaw))) ? null : Number(zRaw);
    const A = S[x.side]; A.n++;
    if (d?.level == null || d?.meanSlopeBand == null) { A.muetData++; continue; }
    const note = contNoteGapSlope(d.level, d.meanSlopeBand, z, x.side);
    if (note == null) { A.muetZ++; continue; }
    A.notes.set(note, (A.notes.get(note) ?? 0) + 1);
    const zOr = x.side === "BUY" ? z : -z;
    const k = d.level + "|" + (x.side === "BUY" ? d.meanSlopeBand : { EXPLOSIVE_DOWN: "EXPLOSIVE_UP", FAST_DOWN: "FAST_UP", SOFT_DOWN: "SOFT_UP", FLAT: "FLAT", SOFT_UP: "SOFT_DOWN", FAST_UP: "FAST_DOWN", EXPLOSIVE_UP: "EXPLOSIVE_DOWN" }[d.meanSlopeBand]);
    A.cases.set(k, (A.cases.get(k) ?? 0) + 1);
    void zOr;
  }
  rows.clear();
}

const pc = (n, t) => (t ? (100 * n / t).toFixed(2) : "0.00") + " %";
console.log(`\n══ RANG ③ · ENTREE ⑷ \`gapLevel x meanSlope\` · effet sur le residu ══`);
console.log(`   condition owner : \`z (cloture, oriente) > ${CONT_Z_MIN}\``);

for (const s of ["BUY", "SELL"]) {
  const A = S[s], parlant = [...A.notes.values()].reduce((a, b) => a + b, 0);
  console.log(`\n  ── ${s} — ${A.n} barres du residu ──`);
  console.log(`     MUET \`z\`      ${String(A.muetZ).padStart(6)}  ${pc(A.muetZ, A.n)}`);
  console.log(`     MUET donnee   ${String(A.muetData).padStart(6)}  ${pc(A.muetData, A.n)}`);
  console.log(`     PARLANT       ${String(parlant).padStart(6)}  ${pc(parlant, A.n)}`);
  console.log(`\n     distribution de la NOTE (sur les barres parlantes) :`);
  let cum = 0;
  for (const v of [...A.notes.keys()].sort((a, b) => a - b)) {
    const n = A.notes.get(v); cum += n;
    console.log(`       ${String(v).padStart(4)}  ${String(n).padStart(6)}  ${pc(n, parlant).padStart(8)}   cum ${pc(cum, parlant)}`);
  }
  const top = [...A.notes.entries()].sort((a, b) => b[1] - a[1])[0];
  const pos = [...A.notes.entries()].filter(([v]) => v > 0).reduce((a, [, n]) => a + n, 0);
  console.log(`     ⇒ note la plus frequente ${top?.[0]} a ${pc(top?.[1] ?? 0, parlant)} · positives ${pc(pos, parlant)}`);
  const cases = [...A.cases.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`     ⇒ ${cases.length}/42 cases lues · la plus peuplee ${cases[0]?.[0]} a ${pc(cases[0]?.[1] ?? 0, parlant)}`);
}
console.log(`\n  ⚠ LE MIROIR : les deux distributions de notes doivent se RESSEMBLER. Un ecart net`);
console.log(`     signale que l'orientation de la colonne est fausse d'un cote — et RIEN d'autre`);
console.log(`     ne le signalerait, la grille etant unique et complete des deux cotes.`);
console.log(`  🎯 NON MESURE ICI : la correlation note ↔ WR/grappe. C'est le prochain poste.\n`);
void GAP_LEVELS; void DELTA_COLS;
