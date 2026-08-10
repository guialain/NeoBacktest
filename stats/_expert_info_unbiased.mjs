// _expert_info_unbiased.mjs — LES EXPERTS EXH SUR UNE POPULATION **NON SÉLECTIONNÉE**.
//   Usage: npx vite-node stats/_expert_info_unbiased.mjs
//
// ⭐⭐⭐ CE QUE CETTE SONDE FAIT ET QU'AUCUNE AUTRE NE PEUT FAIRE. Toutes les mesures précédentes
//   portaient sur les barres qui ONT TIRÉ, donc sur `|somme pondérée| ≥ MIN_EXH`. Conditionner
//   sur une SOMME anti-corrèle ses termes (COLLIDER) : une barre retenue avec un expert fort a les
//   autres plus faibles, sinon elle serait passée de toute façon. Mesuré sur les tirs, les HUIT
//   experts ont une corrélation négative avec la somme des autres (slope −0,44 · rsi −0,25 · …).
//   ⇒ Conséquence : au-dessus du seuil, un score élevé signale un terme qui a COMPENSÉ, pas une
//   meilleure barre. **Un score peut informer et ne pas trier dans la population qu'il a
//   lui-même sélectionnée** — c'est l'explication de l'anomalie « le score EXH ne trie pas ».
//   Ici on prend TOUTES les barres où l'EXH a un avis, tirées ou non. Le collider disparaît.
//
// ⚠ DÉDUPLICATION AVANT LE WALK, et ce n'est pas une optimisation : sans elle on marcherait
//   ~150 000 barres dont 5 sur 6 sont des clones du même épisode. On dédupliue d'abord
//   (`_episodes.mjs`), on ne simule que le premier tir de chaque épisode.
// ⚠ CE QUE CETTE POPULATION N'EST PAS : ce n'est PAS ce que le moteur ferait s'il tirait partout.
//   Les fantômes ne prennent aucune place au carnet et ne paient pas l'espacement. On mesure si un
//   expert PORTE DE L'INFORMATION, pas ce que rapporterait de tout prendre.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes, cohortStats } from "./_episodes.mjs";
import { MIN_EXH } from "../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js";

const W = { k: 0.1, di: 0.1, zscore: 0.2, kd: 0.2, energy: 0.1, range: 0.1, rsi: 0.2, slope: 0.1 };
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";

let nCand = 0;
const E = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllExh: true, chargeSpread: true });
  const g = (p.ghosts ?? []).filter((c) => c.ghost === "exh-all");
  nCand += g.length;
  for (const c of dedupeEpisodes(g.map((c) => ({ ...c, asset })))) {
    const r = p.walk(c);
    if (r && typeof r.R === "number") E.push({ ...c, R: r.R, outcome: r.outcome, reason: r.reason });
  }
}
console.log(`\n${nCand} barres EXH scorées → ${E.length} ÉPISODES simulés (clonage ×${(nCand / Math.max(1, E.length)).toFixed(1)})`);
const fired = E.filter((x) => x.fired).length;
console.log(`dont ${fired} ont réellement tiré (${(100 * fired / E.length).toFixed(1)} %) — le reste est invisible à toute mesure sur les trades\n`);

const sgn = (x) => (x.side === "BUY" ? 1 : -1);
const contrib = (x, k) => (Number.isFinite(x.exp?.[k]) ? W[k] * x.exp[k] * sgn(x) : null);
const others = (x, k) => Object.keys(W).filter((j) => j !== k)
  .reduce((a, j) => { const v = contrib(x, j); return v == null ? a : a + v; }, 0);
const corr = (a, b) => {
  const n = a.length; if (n < 3) return NaN;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
  return (sa > 0 && sb > 0) ? sab / Math.sqrt(sa * sb) : NaN;
};
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(p * a.length)]; };

// ── 1 · LE COLLIDER A-T-IL DISPARU ? C'est le contrôle qui valide toute la suite. ──
// 🔴🔥 PRÉDICTION FAUSSE, NOTÉE ICI. J'attendais que ces corrélations REMONTENT VERS 0 une fois la
//   sélection levée — c'était toute ma thèse du collider. Elles ont EMPIRÉ : rsi −0,25 → −0,54,
//   slope −0,44 → −0,55, energy −0,20 → −0,41, range −0,14 → −0,44.
// ⭐⭐ DONC L'ANTI-CORRÉLATION N'EST PAS UN ARTEFACT DE SÉLECTION, ELLE EST INTRINSÈQUE : les experts
//   se CONTREDISENT structurellement. `rsi` et `slope` lisent la même série sous-jacente et sont les
//   deux plus anti-corrélés — la redondance que la note du 02/08 disait « pas encore mesurée ».
//   ⇒ La vraie raison pour laquelle le total ne trie pas n'est pas le seuil : c'est qu'une somme de
//   termes qui s'annulent ne peut rien ordonner. Le seuil n'aggravait qu'à la marge.
console.log("1 · CONTRÔLE — corrélation expert × somme des autres, SANS sélection");
console.log("   (attendu : retour vers 0. RÉSULTAT : elles EMPIRENT ⇒ l'anti-corrélation est INTRINSÈQUE)");
for (const k of Object.keys(W)) {
  const pop = E.filter((x) => contrib(x, k) != null);
  if (pop.length < 100) { console.log(`   ${k.padEnd(8)} effectif insuffisant`); continue; }
  const c = corr(pop.map((x) => contrib(x, k)), pop.map((x) => others(x, k)));
  console.log(`   ${k.padEnd(8)} r = ${c.toFixed(3).padStart(6)}   (n=${pop.length})`);
}

// ── 2 · LE SCORE TRIE-T-IL, UNE FOIS LA SÉLECTION LEVÉE ? ──
console.log("\n2 · LE SCORE EXH TRIE-T-IL SUR LA POPULATION ENTIÈRE ? (quintiles de |score| bonifié)");
const srt = [...E].filter((x) => Number.isFinite(x.exhScore)).sort((a, b) => Math.abs(a.exhScore) - Math.abs(b.exhScore));
const cuts = [1, 2, 3, 4].map((i) => Math.abs(srt[Math.floor(i * srt.length / 5)].exhScore));
const qs = [];
for (let i = 0; i < 5; i++) {
  const lo = i === 0 ? -Infinity : cuts[i - 1], hi = i === 4 ? Infinity : cuts[i];
  const band = srt.filter((x) => Math.abs(x.exhScore) >= lo && Math.abs(x.exhScore) < hi);
  const s = cohortStats(band); qs.push(s);
  console.log(`   Q${i + 1} ${(hi === Infinity ? `≥ ${lo.toFixed(2)}` : `< ${hi.toFixed(2)}`).padEnd(12)} ${String(s.n).padStart(5)} ép · WR ${s.wr.toFixed(2).padStart(6)} · marge ${s.marge.toFixed(2).padStart(6)} · ${((s.sig >= 0 ? "+" : "") + s.sig.toFixed(1)).padStart(5)} σ`);
}
{
  const se = Math.sqrt(qs[0].se ** 2 + qs[4].se ** 2), d = qs[4].wr - qs[0].wr;
  const mono = qs.every((r, i) => i === 0 || r.wr >= qs[i - 1].wr - 1e-9);
  console.log(`   ⇒ Q5 − Q1 = ${d.toFixed(2)} pt · ${(d / se).toFixed(1)} σ · ${Math.abs(d / se) < 2 ? "NE TRIE PAS" : d > 0 ? "TRIE" : "TRIE À L'ENVERS"}${mono ? " · monotone" : " · NON monotone"}`);
  console.log(`   ⚠ Le seuil moteur est à ${MIN_EXH} — comparer les quintiles À CE REPÈRE, pas entre eux seulement.`);
}

// ── 3 · CHAQUE EXPERT, SANS STRATIFICATION (elle n'est plus nécessaire) ──
console.log("\n3 · CHAQUE EXPERT PORTE-T-IL DE L'INFO ? (terciles de sa contribution orientée)");
console.log(`   ${"expert".padEnd(9)} ${"n".padStart(6)} ${"BAS".padStart(8)} ${"MOYEN".padStart(8)} ${"HAUT".padStart(8)} ${"HAUT−BAS".padStart(10)} ${"σ".padStart(6)}   verdict`);
for (const k of Object.keys(W)) {
  const pop = E.filter((x) => contrib(x, k) != null);
  if (pop.length < 300) { console.log(`   ${k.padEnd(9)} effectif insuffisant (${pop.length})`); continue; }
  const v = pop.map((x) => contrib(x, k));
  const t1 = q(v, 1 / 3), t2 = q(v, 2 / 3);
  const a = cohortStats(pop.filter((x) => contrib(x, k) < t1));
  const m = cohortStats(pop.filter((x) => contrib(x, k) >= t1 && contrib(x, k) < t2));
  const c = cohortStats(pop.filter((x) => contrib(x, k) >= t2));
  const se = Math.sqrt(a.se ** 2 + c.se ** 2), d = c.wr - a.wr, sig = se > 0 ? d / se : NaN;
  const verdict = Math.abs(sig) < 2 ? "n'informe pas" : sig > 0 ? "INFORME" : "INFORME À L'ENVERS";
  console.log(`   ${k.padEnd(9)} ${String(pop.length).padStart(6)} ${a.wr.toFixed(2).padStart(8)} ${m.wr.toFixed(2).padStart(8)} ${c.wr.toFixed(2).padStart(8)} ${d.toFixed(2).padStart(10)} ${((sig >= 0 ? "+" : "") + sig.toFixed(1)).padStart(6)}   ${verdict}`);
}
console.log("\n  ⚠ 8 experts testés : on attend ~0,4 faux positif à 2 σ. Lire la CONCORDANCE avec la mesure");
console.log("    stratifiée (`_expert_info.mjs`), pas une case isolée.");
