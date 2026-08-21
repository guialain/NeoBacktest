// _boxes_check.mjs — LE CÂBLAGE `boxes` EST-IL NEUTRE, ET ARRIVE-T-IL VRAIMENT SUR LA FICHE ?
//
// Deux questions, et il faut les deux :
//   ① NEUTRALITÉ — le carnet doit rendre EXACTEMENT 926 tirs / R +168,6 (état `827c01e`). Un
//      câblage de trace qui déplace un chiffre n'est pas une trace, c'est une modification.
//   ② ADRESSE — `scoringPayload` est une WHITELIST. Si la ligne `boxes:` manquait, le moteur
//      produirait le champ et la fiche ne le porterait pas ; toute sonde en aval rendrait `null`
//      partout et se lirait « aucune row n'a de verdict » au lieu de « le champ n'est pas recopié ».
//      ⇒ On exige une couverture de 100 %, pas « la plupart ».
//
// ⭐ ET ON EN PROFITE POUR LA MESURE 2 (exclusivité), qui est faisable SUR LES SIGNAUX SEULS : une
//   row où le score EXH dépasse son Valid A TIRÉ (au timing M5 près), elle est donc dans le carnet.
//   Les mesures 3 et 4 portent sur des rows qui n'ont PAS tiré — elles demandent un dump au niveau
//   row, qui n'existe pas encore. Ne pas les improviser ici.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const EXH = all.filter((s) => s.strategy === "EXH");
const tirs = EXH.filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");
const R = tirs.reduce((a, b) => a + (b.R || 0), 0);

console.log(`\n═══ ① NEUTRALITÉ ═══`);
console.log(`  ${tirs.length} tirs EXH · R ${(R >= 0 ? "+" : "") + R.toFixed(1)}` +
  `   ${tirs.length === 926 && Math.abs(R - 168.6) < 0.05 ? "✅ identique à 827c01e" : "🔴 LE CÂBLAGE A DÉPLACÉ UN CHIFFRE"}`);

console.log(`\n═══ ② ADRESSE — \`boxes\` arrive-t-il sur la fiche ? ═══`);
const avec = tirs.filter((s) => s.sc?.boxes != null);
console.log(`  ${avec.length}/${tirs.length} (${(100 * avec.length / (tirs.length || 1)).toFixed(1)} %)` +
  `   ${avec.length === tirs.length ? "✅" : "🔴 WHITELIST — le champ n'est pas recopié partout"}`);
if (!avec.length) { console.log("  ⇒ STOP : rien à lire plus bas."); process.exit(1); }
console.log(`  exemple : ${JSON.stringify(avec[0].sc.boxes)}`);

// ⚠ Contrôle de COHÉRENCE cascade ↔ lecture parallèle. Sur un tir EXH, la boîte ① doit dire "deal" :
//   si elle disait autre chose, les deux lectures ne parleraient pas de la même row.
const incoherent = avec.filter((s) => s.sc.boxes.exh?.verdict !== "deal");
console.log(`  cohérence (tir EXH ⇒ boxes.exh = "deal") : ` +
  (incoherent.length ? `🔴 ${incoherent.length} écarts — ex. ${incoherent[0].sc.boxes.exh?.verdict}` : "✅"));

console.log(`\n═══ MESURE 2 — EXCLUSIVITÉ ═══`);
console.log(`  « une seule chose s'épuise à la fois » : propriété MESURÉE, pas garantie.`);
console.log(`  ⚠ MAJORANT : le timing M5 n'est pas inclus dans le verdict de boîte.\n`);
// ⭐ `MIN_PB = 1000` ⇒ `pb.verdict` vaut toujours "cede". On applique donc des seuils CANDIDATS sur
//   la conviction en clair, ce qui est exactement pourquoi elle est tracée à côté du verdict.
const conv = (s) => s.sc.boxes.pb?.conviction;
const bloque = (s) => s.sc.boxes.pb?.blocked === true;
console.log(`  ${"seuil PB".padEnd(10)} ${"n both-deal".padStart(12)} ${"% des tirs EXH".padStart(15)}   dont PB non vetoté`);
for (const seuil of [0, 5, 10, 15, 20, 25]) {
  const both = avec.filter((s) => Number.isFinite(conv(s)) && conv(s) > seuil);
  const libres = both.filter((s) => !bloque(s));
  console.log(`  ${String(seuil).padEnd(10)} ${String(both.length).padStart(12)} ` +
    `${(100 * both.length / avec.length).toFixed(1).padStart(14)} % ${String(libres.length).padStart(19)}`);
}
const muet = avec.filter((s) => !Number.isFinite(conv(s))).length;
console.log(`\n  PB MUET (conviction null) sur ${muet}/${avec.length} tirs EXH ` +
  `(${(100 * muet / avec.length).toFixed(1)} %)` +
  `   ⭐ c'est la vraie source d'exclusivité si elle est élevée`);
const negs = avec.filter((s) => Number.isFinite(conv(s)) && conv(s) <= 0).length;
console.log(`  PB à conviction ≤ 0 (contredit son propre côté) : ${negs} ` +
  `(${(100 * negs / avec.length).toFixed(1)} %)`);
