// _veto_hits_live.mjs — COMBIEN DE FOIS CHAQUE VETO SE DÉCLENCHE-T-IL DANS LE MOTEUR D'AUJOURD'HUI ?
//
// 🔴🔥🔥 POURQUOI CE SCRIPT EXISTE. Le 10/08, `VETO_GAP_AHEAD=off` a rendu un carnet RIGOUREUSEMENT
//   identique à la référence (752 tirs, R +133,5, au dixième) alors que ce veto comptait 109 007
//   hits le 07/08 — et qu'en plus, à `off`, il devait rendre l'expert gap MUET donc amplificateur.
//   « Aucun effet » a DEUX causes possibles qui se lisent pareil :
//     (a) le veto TIRE, mais ses barres sont déjà écartées en amont (routeur, seuil) ⇒ redondant ;
//     (b) le veto NE TIRE PLUS — ses entrées ont disparu ou changé de nom ⇒ il est MORT, et le
//         garder donne l'illusion d'une protection qui n'existe pas.
//   ⭐⭐⭐ La distinction ne se lit PAS dans le carnet. Elle se lit en comptant les déclenchements.
//
// ⚠ ON NE COMPTE PAS DANS `reasons` : un veto qui bloque empêche le tir d'exister, sa trace n'est
//   dans AUCUNE fiche. Un compteur écrit là rendrait `0` pour tout le monde et se lirait « aucun
//   veto ne mord ». ⇒ On enveloppe `when` À LA SOURCE, avant que le moteur ne soit importé.
//
// ⭐ L'ORDRE DES IMPORTS EST LA MÉCANIQUE MÊME DU SCRIPT : `vetoGate` d'abord (on instrumente les
//   objets de `VETOES`), `matrixBacktest` ENSUITE (il itérera les mêmes objets, donc nos wrappers).
//   Inverser les deux lignes ne casserait rien — ça rendrait juste des compteurs à zéro.
//
//   usage : node stats/_veto_hits_live.mjs
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";

const VG = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/vetoGate.js";
const { VETOES } = await import(VG);

const HITS = new Map();   // id -> { on: n, essais: n, buy: n, sell: n }
for (const v of VETOES) {
  HITS.set(v.id, { on: 0, essais: 0, buy: 0, sell: 0, strat: v.strategy ?? "?", tf: v.tf ?? "?" });
  const brut = v.when;
  v.when = function (...args) {
    const c = HITS.get(v.id);
    c.essais++;
    const r = brut.apply(this, args);
    if (r) { c.on++; if (args[1] === "BUY") c.buy++; else if (args[1] === "SELL") c.sell++; }
    return r;
  };
}

const { runMatrixBacktest } = await import(
  "file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let tirs = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number" && s.strategy === "EXH") tirs++;
}

const lignes = [...HITS.entries()].sort((a, b) => b[1].on - a[1].on);
console.log(`\n═══ DÉCLENCHEMENTS RÉELS DES ${VETOES.length} VETOS · moteur du 10/08 · ${tirs} tirs EXH au carnet ═══`);
console.log(`  ⚠ « essais » = appels du \`when\`. Un veto peut n'être ESSAYÉ que sur une population déjà triée.\n`);
console.log(`  ${"veto".padEnd(36)} ${"strat".padEnd(6)} ${"tf".padEnd(5)} ${"ON".padStart(9)} ${"essais".padStart(10)}  ${"%".padStart(6)}   BUY / SELL`);
for (const [id, c] of lignes) {
  const pct = c.essais ? (100 * c.on / c.essais) : 0;
  const mort = c.on === 0 && c.essais > 0;
  console.log(`  ${(mort ? "🔴 " : "   ") + id.padEnd(33)} ${String(c.strat).padEnd(6)} ${String(c.tf).padEnd(5)} ` +
    `${String(c.on).padStart(9)} ${String(c.essais).padStart(10)}  ${pct.toFixed(1).padStart(5)} %   ${c.buy} / ${c.sell}`);
}
const morts = lignes.filter(([, c]) => c.on === 0 && c.essais > 0).map(([id]) => id);
const jamais = lignes.filter(([, c]) => c.essais === 0).map(([id]) => id);
console.log(`\n  🔴 JAMAIS DÉCLENCHÉS (mais essayés) : ${morts.length ? morts.join(", ") : "aucun"}`);
console.log(`  ⚫ JAMAIS ESSAYÉS (le \`when\` n'est pas appelé) : ${jamais.length ? jamais.join(", ") : "aucun"}`);
