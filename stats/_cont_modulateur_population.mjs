// _cont_modulateur_population.mjs — LA POPULATION DES 7 BANDES `meanSlopeH1` DANS LE CARNET
//
// 🎯 SORTIE EXIGEE PAR L'OWNER (22/08), et dans CET ordre :
//     ① le moteur compile/tourne ;
//     ② les 7 bandes sont ATTEIGNABLES ;
//     ③ nombre de tirs par bande ;
//     ④ BUY / SELL par bande ;
//     ⑤ score CONT AVANT / APRES modulateur.
//   ⛔ **NE PAS CONCLURE SUR LA PERFORMANCE** avant d'avoir affiche la population. Cette sonde
//   n'imprime donc AUCUN WR et AUCUN R : c'est deliberе. Un WR affiche a cote d'une population
//   serait lu comme un verdict, et la dictee dit l'inverse.
//
// ⚠ ETAT DU MOTEUR TESTE : `cont-mean-flat` RETIRE · modulateur `meanSlopeH1` ACTIF sur `sContB`
//   (APRES le bonus) · **`MIN_CONT` NON re-dicte** (dictee owner). Le modulateur re-scale donc
//   l'echelle jusqu'a x4 vers le bas contre un seuil calibre sur l'echelle NON modulee ⇒ il agit
//   AUSSI comme un veto silencieux. C'est ce moteur-la qu'on mesure, pas la tente seule.
//
// ⚠⚠ CE QUE CETTE SONDE NE PEUT PAS MONTRER : les bandes `MS_*_DOWN` (pour un BUY) et `MS_FLAT`
//   rendent un modulateur `0`, donc un `sContB` de `0`, donc un DROP `no-score`. **Elles ne peuvent
//   PAS apparaitre dans le carnet** — c'est le comportement voulu, pas une bande morte. « Bande
//   atteignable » se lit donc sur le percentile ORIENTE, pas sur le compte de tirs.
//   usage : node stats/_cont_modulateur_population.mjs   [MIN_CONT=<n>]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
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

console.log(`\n═══ ① LE MOTEUR TOURNE ═══`);
console.log(`  ${all.length} signaux · ${CONT.length} tirs CONT termines`);
if (!CONT.length) { console.log("  🔴 AUCUN TIR CONT — le rang ③ est MORT, la sonde ne mesure rien."); process.exit(1); }
const trace = CONT.filter((s) => s.sc?.msMod != null);
console.log(`  ${trace.length}/${CONT.length} tirs portent la trace du modulateur`
  + (trace.length === CONT.length ? "   ✅" : "   🔴 LA WHITELIST NE RECOPIE PAS TOUT"));
const muets = CONT.filter((s) => s.sc?.msMuet === true).length;
console.log(`  ${muets} tirs a capteur MUET (modulateur force a 1, fail-open)`);

console.log(`\n═══ ② LES 7 BANDES SONT-ELLES ATTEIGNABLES ? ═══`);
console.log(`  ⚠ Lu sur le percentile ORIENTE, pas sur le carnet : les bandes CONTRE et FLAT rendent`);
console.log(`     un modulateur 0, donc un DROP. Leur absence du carnet est le comportement VOULU.`);
// ⭐ On rejoue la tente sur toute l'echelle pour prouver que chaque bande a un domaine NON VIDE
//   et un modulateur du signe attendu. C'est un controle de la GRAMMAIRE, independant du marche.
const { contMeanSlopeMod } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/contMeanSlopeMod.js");
const { MEANSLOPE_ECHELLE, PAS_PCT } = await import("../../Matrix-Revolution/src/components/robot/engines/config/MeanSlopeConfig.js");
const ech = MEANSLOPE_ECHELLE.EURUSD;
const vue = new Map();
for (let k = 0; k < ech.length; k++) {
  const r = contMeanSlopeMod("EURUSD", ech[k], "BUY");
  if (!vue.has(r.bande)) vue.set(r.bande, { n: 0, min: r.mod, max: r.mod, p0: r.p, p1: r.p });
  const o = vue.get(r.bande); o.n++; o.min = Math.min(o.min, r.mod); o.max = Math.max(o.max, r.mod); o.p1 = r.p;
}
console.log("  " + "bande".padEnd(18) + "ancres".padStart(8) + "percentile".padStart(16) + "modulateur BUY".padStart(20));
console.log("  " + "─".repeat(64));
for (const b of MS_BANDES) { const o = vue.get(b);
  console.log("  " + b.padEnd(18) + (o ? String(o.n) : "0").padStart(8)
    + (o ? `${o.p0.toFixed(1)} → ${o.p1.toFixed(1)}` : "—").padStart(16)
    + (o ? `${o.min.toFixed(3)} → ${o.max.toFixed(3)}` : "—").padStart(20)
    + (o ? "   ✅" : "   🔴 BANDE VIDE")); }
console.log(`  ⭐ controle du miroir : un SELL a p=20 doit valoir un BUY a p=80.`);
const mB = contMeanSlopeMod("EURUSD", ech[Math.round(80 / PAS_PCT)], "BUY").mod;
const mS = contMeanSlopeMod("EURUSD", ech[Math.round(20 / PAS_PCT)], "SELL").mod;
console.log(`     BUY p80 = ${mB.toFixed(4)} · SELL p20 = ${mS.toFixed(4)}   ${Math.abs(mB - mS) < 1e-6 ? "✅ MIROIR EXACT" : "🔴 MIROIR ROMPU"}`);

console.log(`\n═══ ③④ TIRS PAR BANDE, ET PAR COTE ═══`);
console.log("  " + "bande".padEnd(18) + "tirs".padStart(8) + "part".padStart(9)
  + "BUY".padStart(8) + "SELL".padStart(8) + "   modulateur (min · moy · max)");
console.log("  " + "─".repeat(76));
const N = CONT.length;
for (const b of MS_BANDES) {
  const t = CONT.filter((s) => s.sc?.msBande === b);
  const m = t.map((s) => s.sc.msMod).filter(Number.isFinite);
  console.log("  " + b.padEnd(18) + String(t.length).padStart(8)
    + ((100 * t.length / N).toFixed(1) + " %").padStart(9)
    + String(t.filter((s) => s.side === "BUY").length).padStart(8)
    + String(t.filter((s) => s.side === "SELL").length).padStart(8)
    + (m.length ? `   ${Math.min(...m).toFixed(3)} · ${(m.reduce((a, b2) => a + b2, 0) / m.length).toFixed(3)} · ${Math.max(...m).toFixed(3)}` : "   —"));
}
const sansB = CONT.filter((s) => !s.sc?.msBande).length;
console.log("  " + "(sans bande)".padEnd(18) + String(sansB).padStart(8) + "   ⚠ capteur muet ou actif non calibre");

console.log(`\n═══ ⑤ SCORE CONT AVANT / APRES MODULATEUR ═══`);
const av = CONT.map((s) => s.sc?.contPreMod).filter(Number.isFinite);
const ap = CONT.map((s) => s.sc?.cont).filter(Number.isFinite);
const st = (v) => v.length ? { n: v.length, min: Math.min(...v), moy: v.reduce((a, b) => a + b, 0) / v.length,
                               max: Math.max(...v), med: [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] } : null;
const A = st(av), B = st(ap);
console.log("  " + "".padEnd(12) + "n".padStart(8) + "min".padStart(9) + "median".padStart(9) + "moyenne".padStart(10) + "max".padStart(9));
console.log("  " + "─".repeat(58));
for (const [lbl, x] of [["AVANT", A], ["APRES", B]])
  console.log("  " + lbl.padEnd(12) + String(x.n).padStart(8) + x.min.toFixed(2).padStart(9)
    + x.med.toFixed(2).padStart(9) + x.moy.toFixed(2).padStart(10) + x.max.toFixed(2).padStart(9));
console.log(`\n  ── distribution du modulateur sur les tirs RETENUS ──`);
const mods = CONT.map((s) => s.sc?.msMod).filter(Number.isFinite).sort((a, b) => a - b);
const qq = (p) => mods[Math.min(mods.length - 1, Math.floor(p * mods.length))];
console.log(`     min ${mods[0]?.toFixed(3)} · p25 ${qq(0.25)?.toFixed(3)} · median ${qq(0.5)?.toFixed(3)} · p75 ${qq(0.75)?.toFixed(3)} · max ${mods[mods.length - 1]?.toFixed(3)}`);
console.log(`\n  ⛔ AUCUN WR NI R N'EST IMPRIME ICI, ET C'EST VOULU : la dictee dit de ne pas conclure`);
console.log(`     sur la performance avant d'avoir vu la population. La voila.\n`);
