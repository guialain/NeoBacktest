// _expert_info.mjs — CHAQUE EXPERT APPORTE-T-IL DE L'INFO ? On fige les autres, on fait varier un.
//   Usage: npx vite-node stats/_expert_info.mjs [expert|all]     (défaut : all)
//
// LA QUESTION OWNER : le score EXH global ne trie pas — ce n'est pas normal. Alors on descend d'un
//   cran : expert par expert, en STRATIFIANT sur les autres (« figer les autres, varier celui-là »).
//
// ⚠⚠ MAIS IL Y A UNE RAISON MÉCANIQUE POUR QU'UN SCORE NE TRIE PAS, ET IL FAUT LA TESTER D'ABORD.
//   On ne voit que les barres qui ONT TIRÉ, c'est-à-dire celles où `|somme pondérée| ≥ SCORE_MIN_EXH`.
//   Conditionner sur une SOMME crée une ANTI-CORRÉLATION entre ses termes : si le total doit dépasser
//   un seuil, une barre retenue avec un RSI fort a, en moyenne, les autres experts plus FAIBLES —
//   sinon elle aurait été retenue de toute façon. C'est un collider : la sélection fabrique une
//   corrélation négative qui n'existe pas dans la population entière.
//   ⇒ CONSÉQUENCE : au-dessus du seuil, un score total ÉLEVÉ ne signale plus une meilleure barre, il
//   signale surtout un terme qui a compensé les autres. Un score peut donc parfaitement INFORMER et
//   ne PAS trier dans la population qu'il a lui-même sélectionnée.
//   ⇒ SIGNATURE À VÉRIFIER : corrélation NÉGATIVE entre un expert et la somme des autres, DANS les
//   tirs. Si on l'observe, l'anomalie est expliquée et la mesure doit se faire AVANT le seuil.
//
// ⚠ Stratification par TERCILES de « la somme des autres », pas par des bornes posées à la main.
// ⚠ Tout en ÉPISODES (`_episodes.mjs`). Le verdict vient de σ, jamais de la marge.
import fs from "fs";
import path from "path";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes, cohortStats } from "./_episodes.mjs";

// ⭐ `all` par defaut : la COLLECTE est le cout (un run d'univers), l'analyse est gratuite.
//   Mesurer un expert a la fois aurait relance le moteur huit fois pour les memes donnees.
const ARG = (process.argv[2] || "all").toLowerCase();
// Poids EXH du moteur — la contribution d'un expert au total est `poids × global`.
const W = { k: 0.1, di: 0.1, zscore: 0.2, kd: 0.2, energy: 0.1, range: 0.1, rsi: 0.2, slope: 0.1 };
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";

const all = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const r = runMatrixBacktest(path.join(MATRIX, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) {
    if (typeof s.R !== "number" || s.type !== "EXHAUSTION") continue;
    all.push({ R: s.R, outcome: s.outcome, reason: s.reason, side: s.side, type: s.type,
               ep: s.ep, asset: r.asset, exp: s.sc?.exp ?? {}, exhRaw: s.sc?.exhRaw });
  }
}
const E = dedupeEpisodes(all);
console.log(`\n${E.length} épisodes EXH · experts étudiés : ${ARG}\n`);

// ── 1 · QUI PARLE ? Un expert muet sur 90 % des barres ne peut pas trier, quoi qu'il dise. ──
console.log("1 · PARTICIPATION — un expert muet ne peut pas informer, quelle que soit sa table");
for (const k of Object.keys(W)) {
  const n = E.filter((x) => Number.isFinite(x.exp?.[k])).length;
  const nz = E.filter((x) => Number.isFinite(x.exp?.[k]) && x.exp[k] !== 0).length;
  console.log(`   ${k.padEnd(8)} non-null ${(100 * n / E.length).toFixed(1).padStart(5)} %  ·  non-NUL ${(100 * nz / E.length).toFixed(1).padStart(5)} %`);
}

// ── 2 · LA SIGNATURE DU COLLIDER ──
// ⭐ `contribution orientée` : on projette dans le sens du côté pris, sinon un BUY et un SELL de même
//   qualité se compenseraient dans la corrélation et on ne mesurerait rien.
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
console.log("\n2 · SIGNATURE DU COLLIDER — corrélation entre un expert et LA SOMME DES AUTRES, dans les tirs");
console.log("   (négative = la sélection par le seuil fabrique la compensation ⇒ le total ne PEUT pas trier)");
for (const k of Object.keys(W)) {
  const pop = E.filter((x) => contrib(x, k) != null);
  if (pop.length < 50) { console.log(`   ${k.padEnd(8)} effectif insuffisant`); continue; }
  const c = corr(pop.map((x) => contrib(x, k)), pop.map((x) => others(x, k)));
  console.log(`   ${k.padEnd(8)} r = ${c.toFixed(3).padStart(6)}   (n=${pop.length})${c < -0.15 ? "   ⬅ COMPENSATION" : ""}`);
}

// ── 3 · LA MESURE DEMANDÉE : on fige les autres (terciles), on fait varier l'expert cible ──
const P = (lab, t) => {
  const s = cohortStats(t);
  if (!s.n) { console.log(`   ${lab.padEnd(34)}    — `); return; }
  console.log(`   ${lab.padEnd(34)} ${String(s.n).padStart(4)} ép · WR ${s.wr.toFixed(2).padStart(6)} · marge ${s.marge.toFixed(2).padStart(6)} · ${((s.sig >= 0 ? "+" : "") + s.sig.toFixed(1)).padStart(5)} σ`);
  return s;
};
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(p * a.length)]; };
const TARGETS = ARG === "all" ? Object.keys(W) : [ARG];
console.log("");
console.log("3 . ON FIGE LES AUTRES, ON FAIT VARIER X - ecart HAUT-BAS de X, par tercile des AUTRES");
console.log("   (le verdict d'un expert n'est pas une case : c'est la CONCORDANCE entre les trois strates)");
console.log(`   ${"expert".padEnd(9)} ${"autres FAIBLES".padStart(15)} ${"autres MOYENS".padStart(15)} ${"autres FORTS".padStart(15)}   verdict`);
for (const TARGET of TARGETS) {
  const pop = E.filter((x) => contrib(x, TARGET) != null);
  if (pop.length < 150) { console.log(`   ${TARGET.padEnd(9)} effectif insuffisant (${pop.length})`); continue; }
  const oth = pop.map((x) => others(x, TARGET));
  const o1 = q(oth, 1 / 3), o2 = q(oth, 2 / 3);
  const cells = [];
  for (const sel of [(x) => others(x, TARGET) < o1,
                     (x) => others(x, TARGET) >= o1 && others(x, TARGET) < o2,
                     (x) => others(x, TARGET) >= o2]) {
    const band = pop.filter(sel);
    const tv = band.map((x) => contrib(x, TARGET));
    const t1 = q(tv, 1 / 3), t2 = q(tv, 2 / 3);
    const a = cohortStats(band.filter((x) => contrib(x, TARGET) < t1));
    const c = cohortStats(band.filter((x) => contrib(x, TARGET) >= t2));
    const se = Math.sqrt(a.se ** 2 + c.se ** 2), d = c.wr - a.wr;
    cells.push({ d, sig: se > 0 ? d / se : NaN });
  }
  // Le verdict exige DEUX strates concordantes : une case isolee a 2 sigma sur neuf comparaisons
  //   n'est pas un resultat, c'est la dispersion attendue.
  const pos = cells.filter((c) => c.sig >= 2).length, neg = cells.filter((c) => c.sig <= -2).length;
  const verdict = pos >= 2 ? "INFORME (2+ strates concordantes)"
                : neg >= 2 ? "INFORME A L'ENVERS"
                : pos + neg === 0 ? "n'informe pas"
                : "une seule strate - indecis";
  console.log(`   ${TARGET.padEnd(9)} ` + cells.map((c) => `${c.d.toFixed(1).padStart(6)}pt ${((c.sig >= 0 ? "+" : "") + c.sig.toFixed(1)).padStart(5)}s`).join(" ") + `   ${verdict}`);
}
console.log("\n  ⚠ Population CENSURÉE : ces barres ont toutes franchi le seuil. Si la corrélation du §2");
console.log("    est négative, cette stratification est un PIS-ALLER — la vraie mesure se fait AVANT le");
console.log("    seuil, sur les barres scorées qui n'ont pas tiré (mécanique des fantômes).");
