// _calib_deviation.mjs — CALIBRAGE DES DEUX OBSERVABLES QUI DÉCONSTRUISENT LE ZSCORE.
//
// 🔴 POURQUOI ILS EXISTENT. `z = (P − M)/σ` projette TROIS grandeurs sur un nombre, et normalise par
//   celle qui bouge le plus. `Δz = (ΔP − ΔM)/σ − z·(Δσ/σ)` : le second terme est proportionnel à z,
//   donc la contamination CROÎT avec le niveau — mesuré, 77 % → 100 % de barres `FLAT` où le prix va
//   contre le fade, de SLACK à SNAPPED. On déconstruit en deux objets qui disent chacun une chose :
//
//     GAP        = (P − M) / ATR_P50      où en est le prix par rapport à sa moyenne
//     MEANSLOPE  = ΔM      / ATR_P50      où va la moyenne elle-même
//
//   ⭐ M ne demande aucune donnée neuve : `M = P − z_s0 × σ` par définition de z. Validé — le M
//     dérivé bouge 0,68/min contre 8,02 pour le prix et fait un PAS NET à chaque clôture H1,
//     comportement exact d'une MM20 qui roule. La bande du milieu de Bollinger, littéralement
//     (BBWConfig : BB(20, 2.0), milieu = SMA20).
//
// ⚠ ÉCHELLE : `ATRConfig` est en `ATR_PCT_X1000 = (atr/close)×100000`, PAS en prix.
//     ATR_P50_prix = p50 / 100000 × price      ← oublier ça fausse d'un facteur 10⁵.
//   Diviser par cet étalon tue l'échelle de prix ET fige le dénominateur : c'est tout l'objet.
//
// ⚠ HORLOGE : M est une fonction EN ESCALIER à la résolution H1 (elle ne bouge presque pas dans
//   l'heure puis saute à la clôture). Les deux DELTAS se mesurent donc de clôture H1 à clôture H1 —
//   les mesurer en intra-barre donnerait ~0 pour ΔM par construction. Le GAP, lui, vit en continu.
//   ⭐ Effet de bord bienvenu : des deltas ancrés sur les clôtures échappent au défaut d'ANCRE MOBILE
//   qui atteint `Δz` dans 22 % des heures (`zscore_h1` change en cours d'heure).
//
// ⚠ PROXY DE CLÔTURE : σ à la clôture H1 n'est pas une colonne. On prend la DERNIÈRE ligne de chaque
//   heure (HH:59) comme instant de clôture — ses `price` / `zscore_h1_s0` / `sigma_h1` sont live à
//   cet instant, donc corrects. Assumé et signalé.
import fs from "fs";
import { getATRConfig } from "../../Matrix-Revolution/src/components/robot/engines/config/ATRConfig.js";

const DIR = "data/matrix";
const Z_BANDS = [0.30, 1.05, 1.55, 2.15, 2.60];      // barreaux de |z| en vigueur
const q = (t, p) => t.length ? t[Math.min(t.length - 1, Math.floor(t.length * p))] : null;
const r2 = (v) => v == null ? null : Math.round(v * 100) / 100;

const assets = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"))
  .map((f) => f.replace(/\.csv$/i, "")).sort();

const res = {}; let jours = new Set();
for (const sym of assets) {
  const p50 = getATRConfig(sym, "H1")?.p50; if (!p50) { console.log(`${sym}: pas d'ATRConfig H1`); continue; }
  const L = fs.readFileSync(`${DIR}/${sym}.csv`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  // ── série intra-barre (pour le NIVEAU du gap) + dernière ligne de chaque heure (pour les deltas)
  const gapAbs = [], zAbs = [], parHeure = new Map();
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const d = new Date(c[I.ts_utc]); if (Number.isNaN(d.getTime())) continue;
    const js = d.getUTCDay(); if (js === 0 || js === 6) continue;
    const z = +c[I.zscore_h1_s0], s = +c[I.sigma_h1], p = +c[I.price];
    if (![z, s, p].every(Number.isFinite) || !(s > 0) || !(p > 0)) continue;
    jours.add(c[I.ts_utc].slice(0, 10));
    const atrP = p50 / 100000 * p;
    const gap = z * s;                                  // ≡ P − M
    gapAbs.push(Math.abs(gap / atrP)); zAbs.push(Math.abs(z));
    parHeure.set(c[I.ts_utc].slice(0, 13), { t: d.getTime(), p, z, s, M: p - z * s, atrP });
  }
  // ── deltas de clôture à clôture, uniquement sur des heures CONSÉCUTIVES
  const cl = [...parHeure.entries()].sort((a, b) => a[1].t - b[1].t).map((e) => e[1]);
  const dM = [], dG = [];
  for (let i = 1; i < cl.length; i++) {
    if (cl[i].t - cl[i - 1].t !== 3600000) continue;    // saut d'heure ⇒ pas un delta d'une barre
    // ⚠ FLUX GELÉ : marché fermé ⇒ prix ET moyenne rigoureusement identiques. Ce n'est pas une
    //   observation « la moyenne n'a pas bougé », c'est une absence de marché. Sans ce filtre COCOA
    //   sort p30 = 0,00 (fermé 14:48→05:45) et sa bande FLAT devient INATTEIGNABLE — exactement la
    //   dégénérescence de sa bande tickflow LOW.
    if (cl[i].p === cl[i - 1].p && cl[i].M === cl[i - 1].M) continue;
    dM.push(Math.abs((cl[i].M - cl[i - 1].M) / cl[i].atrP));
    dG.push(Math.abs(((cl[i].p - cl[i].M) - (cl[i - 1].p - cl[i - 1].M)) / cl[i].atrP));
  }
  gapAbs.sort((a, b) => a - b); zAbs.sort((a, b) => a - b); dM.sort((a, b) => a - b); dG.sort((a, b) => a - b);
  // barreaux du GAP : ceux qui REPRODUISENT la population de chaque barreau de |z| aujourd'hui.
  //   Migration à population constante — on change de métrique, pas de sélectivité.
  const gapCuts = Z_BANDS.map((b) => r2(q(gapAbs, zAbs.filter((v) => v < b).length / zAbs.length)));
  res[sym] = { n: gapAbs.length, nD: dM.length, gapCuts,
    mCuts: [0.30, 0.70, 0.90].map((p) => r2(q(dM, p))),
    gCuts: [0.30, 0.70, 0.90].map((p) => r2(q(dG, p))) };
}

const lj = [...jours].sort();
console.log(`Fenêtre : ${lj[0]} → ${lj[lj.length - 1]} · ${lj.length} jours ouvrés\n`);
console.log(`${"actif".padEnd(12)}${"n".padStart(8)}${"nΔ".padStart(6)}   ${"GAP  (populations de |z|)".padStart(34)}   `
  + `${"|ΔM|  p30/p70/p90".padStart(22)}   ${"|ΔGAP|  p30/p70/p90".padStart(22)}`);
for (const s of assets) {
  const r = res[s]; if (!r) continue;
  console.log(`${s.padEnd(12)}${String(r.n).padStart(8)}${String(r.nD).padStart(6)}   `
    + `${r.gapCuts.map((v) => v.toFixed(2)).join(" ").padStart(34)}   `
    + `${r.mCuts.map((v) => v.toFixed(2)).join(" / ").padStart(22)}   ${r.gCuts.map((v) => v.toFixed(2)).join(" / ").padStart(22)}`);
}

// ── bloc de config prêt à coller ──────────────────────────────────────────────────────────────
const bloc = [
  `// ⚠ GÉNÉRÉ — ne pas éditer à la main. Script : Neo-Backtest/stats/_calib_deviation.mjs`,
  `// Calibré le 2026-08-02 sur data/matrix : ${lj.length} jours ouvrés (${lj[0]} → ${lj[lj.length - 1]}),`,
  `// week-ends exclus, ~${Math.round(assets.reduce((a, s) => a + (res[s]?.n ?? 0), 0) / assets.length / 100) * 100} barres/actif`,
  `// et ~${Math.round(assets.reduce((a, s) => a + (res[s]?.nD ?? 0), 0) / assets.length)} deltas de clôture/actif.`,
  `// 🎯 REJOUER À CHAQUE REBUILD DE DATASET — c'est un CALIBRAGE D'ÉCHELLE par actif, il se périme`,
  `//    avec les données (trois précédents le 2026-08-02 : baselines tickflow, bornes ADX, ATRConfig).`,
  `//   gap  : cinq coupures reproduisant EXACTEMENT la population des barreaux |z| 0,30/1,05/1,55/2,15/2,60`,
  `//          ⇒ on change de métrique SANS changer la sélectivité. Comparaison possible à populations égales.`,
  `//   dMean / dGap : |Δ| par barre H1, coupures p30 / p70 / p90 ⇒ FLAT · SOFT · FAST · EXPLOSIVE (signées).`,
  `export const DEVIATION_BANDS = {`,
  ...assets.filter((s) => res[s]).map((s) => {
    const r = res[s];
    return `  ${(s + ":").padEnd(12)}{ gap: [${r.gapCuts.map((v) => v.toFixed(2).padStart(5)).join(", ")}],`
      + ` dMean: [${r.mCuts.map((v) => v.toFixed(2).padStart(5)).join(", ")}],`
      + ` dGap: [${r.gCuts.map((v) => v.toFixed(2).padStart(5)).join(", ")}] },`;
  }),
  `};`,
].join("\n");
fs.writeFileSync("stats/deviation_bands.generated.js", bloc + "\n", "utf8");
console.log(`\nÉcrit : stats/deviation_bands.generated.js`);
