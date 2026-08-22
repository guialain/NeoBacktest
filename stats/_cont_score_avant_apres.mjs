// _cont_score_avant_apres.mjs — LA DISTRIBUTION DU SCORE ③ AVANT ET APRES LE MODULATEUR
//
// 🎯 DEMANDE owner 22/08 : `MIN_CONT = 1` et la table des tranches de 5, AVANT vs APRES.
//
// ⭐⭐⭐ POURQUOI `MIN_CONT = 1` CHANGE LA NATURE DE LA MESURE, ET PAS SEULEMENT SON VOLUME.
//   A `MIN_CONT = 12`, la bande `MS_EXTREME` etait MATHEMATIQUEMENT inatteignable : son
//   modulateur plafonne a 0,225 et le meilleur score ③ observe vaut 37 ⇒ 37 x 0,225 = 8,33 < 12.
//   A `MIN_CONT = 1` il faut un modulateur >= 1/37 = 0,027 ⇒ **les epaules de la tente
//   redeviennent atteignables**, et `EXTREME` peut enfin exister dans le carnet.
//   ⇒ Cette table N'EST PAS la meme mesure qu'a 12. Elle montre l'ECHELLE COMPLETE, pas le carnet.
//
// ⚠⚠ LES DEUX COLONNES `N` NE DECRIVENT PAS LES MEMES TIRS DANS UNE MEME LIGNE. `N avant` compte
//   les tirs dont le score AVANT tombe dans la tranche ; `N apres` ceux dont le score APRES y
//   tombe. Ce sont DEUX ventilations de la MEME population, pas un flux d'une colonne a l'autre.
//   Lire « la tranche 20-25 a perdu 40 tirs » serait une faute : ils n'ont pas disparu, ils ont
//   CHANGE DE TRANCHE. C'est le motif « une soustraction sur la liste des trades n'est pas un A/B »
//   applique a un histogramme.
//
// ⚠ La capacite SATURE a `MIN_CONT` bas (maxOpen 30, 8/symbole, spacing) ⇒ les tranches basses
//   sont des SURVIVANTES, pas une cohorte. La table dit ce que le modulateur DEPLACE, elle ne dit
//   pas ce qu'une tranche RAPPORTERAIT.
// ⛔ AUCUN WR NI R : la dictee du jour tient toujours — population d'abord.
//   usage : node stats/_cont_score_avant_apres.mjs   [MIN_CONT=1]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { MS_BANDES } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/contMeanSlopeMod.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s));

console.log(`\n═══ RANG ③ · SCORE AVANT / APRES MODULATEUR ═══  [MIN_CONT=${process.env.MIN_CONT} · spread FACTURE]`);
if (!CONT.length) { console.log("  🔴 AUCUN TIR CONT."); process.exit(1); }
const av = CONT.map((s) => s.sc?.contPreMod).filter(Number.isFinite);
const ap = CONT.map((s) => s.sc?.cont).filter(Number.isFinite);
console.log(`  ${CONT.length} tirs CONT · ${av.length} avec score AVANT · ${ap.length} avec score APRES`);

// Tranches de 5, plus une derniere ouverte. ⚠ Bornes fermees a gauche : `[lo · lo+5[`.
const TR = [[0, 5], [5, 10], [10, 15], [15, 20], [20, 25], [25, 30], [30, 35], [35, 40], [40, Infinity]];
const dans = (v, [lo, hi]) => v >= lo && v < hi;
const moy = (v) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;

console.log(`\n  ${"Tranche".padEnd(10)}${"N avant".padStart(10)}${"N apres".padStart(10)}${"Score avant".padStart(14)}${"Score apres".padStart(14)}`);
console.log("  " + "─".repeat(58));
for (const t of TR) {
  const a = av.filter((v) => dans(v, t)), b = ap.filter((v) => dans(v, t));
  const lbl = t[1] === Infinity ? ">40" : `${t[0]}-${t[1]}`;
  console.log("  " + lbl.padEnd(10) + String(a.length).padStart(10) + String(b.length).padStart(10)
    + (a.length ? moy(a).toFixed(2) : "—").padStart(14) + (b.length ? moy(b).toFixed(2) : "—").padStart(14));
}
console.log("  " + "─".repeat(58));
console.log("  " + "TOTAL".padEnd(10) + String(av.length).padStart(10) + String(ap.length).padStart(10)
  + moy(av).toFixed(2).padStart(14) + moy(ap).toFixed(2).padStart(14));
const md = CONT.map((s) => s.sc?.msMod).filter(Number.isFinite).sort((x, y) => x - y);
const qq = (p) => md[Math.min(md.length - 1, Math.floor(p * md.length))];
console.log(`\n  modulateur : min ${md[0]?.toFixed(3)} · p25 ${qq(0.25)?.toFixed(3)} · median ${qq(0.5)?.toFixed(3)} · p75 ${qq(0.75)?.toFixed(3)} · max ${md[md.length - 1]?.toFixed(3)}`);

console.log(`\n  ── LES 7 BANDES A CE SEUIL (c'est ici qu'on voit si \`EXTREME\` est enfin atteinte) ──`);
console.log("  " + "bande".padEnd(18) + "tirs".padStart(8) + "part".padStart(9) + "BUY".padStart(8) + "SELL".padStart(8)
  + "   modulateur (min · moy · max)");
console.log("  " + "─".repeat(78));
for (const b of MS_BANDES) {
  const t = CONT.filter((s) => s.sc?.msBande === b);
  const m = t.map((s) => s.sc.msMod).filter(Number.isFinite);
  console.log("  " + b.padEnd(18) + String(t.length).padStart(8)
    + ((100 * t.length / CONT.length).toFixed(1) + " %").padStart(9)
    + String(t.filter((s) => s.side === "BUY").length).padStart(8)
    + String(t.filter((s) => s.side === "SELL").length).padStart(8)
    + (m.length ? `   ${Math.min(...m).toFixed(3)} · ${moy(m).toFixed(3)} · ${Math.max(...m).toFixed(3)}` : "   —"));
}
console.log(`\n  ⚠ \`N avant\` et \`N apres\` sont DEUX ventilations de la MEME population, pas un flux :`);
console.log(`     un tir qui quitte une tranche n'a pas disparu, il a CHANGE DE TRANCHE.\n`);
