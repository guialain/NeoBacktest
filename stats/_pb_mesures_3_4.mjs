// _pb_mesures_3_4.mjs — CE QUE LE DROP TERMINAL COÛTE AU PLB, ET CE QUE LE ROBINET LUI RENDRAIT.
//
// MESURE 3 — L'INTERACTION DROP-CROISÉ. Le `Drop "en préparation"` est un veto de ROW (Q2 tranchée) :
//   il tue la barre même si l'autre boîte aurait validé. Ce que ça coûte est INOBSERVABLE dans le
//   carnet — le trade n'existe pas, par construction. ⇒ on simule l'issue CONTREFACTUELLE avec le
//   `walk()` de l'actif, celui-là même qui produit les R du carnet.
// MESURE 4 — LE ROBINET `ScoreMinDrop_EXH`. Il vaut 0 aujourd'hui (`MIN_PRES`), donc la bande Drop
//   est `] 0 · 10 ]` et la région « cède » se réduit à `score ≤ 0`. Le remonter à X fait passer les
//   barres de `] 0 · X ]` de **Drop terminal** à **cède**, donc jusqu'au PLB.
//
// ⚠⚠ CORRECTION D'UN PREMIER JET : compter « `eConv ≤ X` » MÉLANGEAIT les barres VETOTÉES, qui ne
//   cèdent pas au même titre (leur boîte rend `veto`, pas `cede`). On compte donc le MOUVEMENT
//   Drop→cède, seul geste que le robinet produit réellement.
// ⚠ `prepareAsset` EN DIRECT et non `runMatrixBacktest` : c'est lui qui expose `walk`, et il évite
//   de reconstruire un carnet dont on n'a pas besoin.
// ⚠ Une voix par grappe actif×jour — les tirs ne sont pas indépendants (σ gonflé ×9).
// ⚠ `tsMT` s'écrit `2026.08.05 …` : on NORMALISE avant toute découpe de date (piège vécu ce matin).
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const OPTS = { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true };
const SEUIL_PB = Number(process.env.SEUIL_PB ?? 10);   // seuil PB candidat (MIN_PB vaut 1000)

const G = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const p = prepareAsset(path.join(DIR, f), OPTS);
  if (!p) continue;
  for (const g of (p.ghosts || [])) if (g.ghost === "boxes") G.push({ ...g, asset: a, _walk: p.walk });
}
const jour = (x) => String(x.tsMT || "").slice(0, 10).replace(/\./g, "-");
const jours = [...new Set(G.map(jour))].sort();
if (!jours.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))) { console.log(`🔴 format de date : ${jours.slice(0, 3)}`); process.exit(1); }

console.log(`\n═══ MESURES 3 & 4 ═══  [NO_TRIGGER · spread FACTURÉ · seuil PB candidat = ${SEUIL_PB}]`);
console.log(`  ${G.length} barres avec verdict de boîte · fenêtre ${jours[0]} → ${jours[jours.length - 1]}`);

// ── SIMULATION CONTREFACTUELLE ────────────────────────────────────────────────────────────────
// ⭐ On dédoublonne AVANT de marcher : une figure persiste plusieurs barres, et walker les clones
//   gonflerait n et fabriquerait une fausse significativité. Une voix par actif×15 min.
const dedupe = (pop) => {
  const vus = new Map(), out = [];
  for (const g of pop.slice().sort((a, b) => a.ep - b.ep)) {
    const k = `${g.asset}|${g.side}|${Math.floor(g.ep / 15)}`;
    if (vus.has(k)) continue;
    vus.set(k, 1); out.push(g);
  }
  return out;
};
const simuler = (pop) => dedupe(pop).map((g) => {
  const r = g._walk(g);
  return r ? { ...g, R: r.R, outcome: r.outcome } : null;
}).filter((x) => x && (x.outcome === "WIN" || x.outcome === "LOSS"));

const BE = 75;
const stats = (t) => {
  if (!t.length) return null;
  const w = t.filter((x) => x.outcome === "WIN").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const g = new Map();
  for (const x of t) { const k = `${x.asset}|${jour(x)}`; if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, wr: 100 * w / t.length, R,
           gr: v.length, wrg: 100 * v.reduce((a, o) => a + o.w / o.n, 0) / v.length,
           bas: v.filter((o) => o.w / o.n < BE / 100).length };
};
const ligne = (lbl, t) => {
  const s = stats(t);
  if (!s) { console.log(`    ${lbl.padEnd(30)}       —`); return; }
  console.log(`    ${lbl.padEnd(30)} ${String(s.n).padStart(5)} ${s.wr.toFixed(1).padStart(7)}%` +
    ` ${s.wrg.toFixed(1).padStart(8)}% ${String(s.gr).padStart(5)} ${String(s.bas).padStart(5)}` +
    ` ${((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8)} ${(s.R / s.n).toFixed(3).padStart(7)}`);
};
const ENTETE = `    ${"".padEnd(30)}  tirs  WR/tir WR/grap  grap  <BE        R   R/tir`;

// ══ MESURE 3 ══════════════════════════════════════════════════════════════════════════════════
// La population : la boîte EXH rend `drop` (donc conviction dans `] 0 · 10 ]`, NON vetotée — un
//   blocage rendrait `veto`, pas `drop`) ET la boîte PB aurait validé.
const tues = G.filter((g) => g.eVerd === "drop" && Number.isFinite(g.pConv) && g.pConv > SEUIL_PB);
console.log(`\n── MESURE 3 · LES DEALS PB TUÉS PAR UN DROP EXH « EN PRÉPARATION » ──`);
console.log(`  ${tues.length} barres concernées (${(100 * tues.length / G.length).toFixed(2)} % du total)`);
const simTues = simuler(tues);
console.log(`  ${simTues.length} après dédoublonnage 15 min et simulation\n`);
console.log(ENTETE);
ligne("TOUS", simTues);
ligne("  juillet", simTues.filter((x) => jour(x) < "2026-08-01"));
ligne("  août", simTues.filter((x) => jour(x) >= "2026-08-01"));
// ⭐ LE PARTAGE QUI COMPTE POUR LE POINT C : ces PB auraient-ils survécu à la table de vetos héritée ?
ligne("dont PB NON vetoté", simTues.filter((x) => x.pBlk !== true));
ligne("dont PB vetoté (hérité)", simTues.filter((x) => x.pBlk === true));

// ══ MESURE 4 ══════════════════════════════════════════════════════════════════════════════════
console.log(`\n── MESURE 4 · LE ROBINET \`ScoreMinDrop_EXH\` (aujourd'hui 0) ──`);
console.log(`  Remonter à X fait passer les barres de \`] 0 · X ]\` de DROP TERMINAL à CÈDE.`);
console.log(`  ⚠ les barres VETOTÉES ne sont pas comptées : leur boîte rend \`veto\`, pas \`drop\`.\n`);
console.log(`  X    Drop→cède   dont PB > ${SEUIL_PB}   ce que ces PB rapporteraient (simulé)`);
for (const X of [2, 4, 6, 8, 10]) {
  const bouge = G.filter((g) => g.eVerd === "drop" && Number.isFinite(g.eConv) && g.eConv <= X);
  const utiles = bouge.filter((g) => Number.isFinite(g.pConv) && g.pConv > SEUIL_PB);
  const s = stats(simuler(utiles));
  console.log(`  ${String(X).padEnd(4)} ${String(bouge.length).padStart(9)} ${String(utiles.length).padStart(12)}   ` +
    (s ? `n=${String(s.n).padStart(4)} · ${s.wrg.toFixed(1)} %/grappe · R ${(s.R >= 0 ? "+" : "") + s.R.toFixed(1)}` : "—"));
}
console.log(`\n  ⚠ CE QUE CES CHIFFRES NE DISENT PAS : la capacité (\`maxOpen\`, spacing) RÉALLOUE.`);
console.log(`     Un contrefactuel simulé barre à barre est un MAJORANT — il ne concourt contre personne.`);
