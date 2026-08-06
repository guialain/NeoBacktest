// _calib_deviation.mjs — CALIBRAGE DES DEUX OBSERVABLES QUI DÉCONSTRUISENT LE ZSCORE.
//
// 🔴 POURQUOI ILS EXISTENT. `z = (P − M)/σ` projette TROIS grandeurs sur un nombre et normalise par
//   celle qui bouge le plus. `Δz = (ΔP − ΔM)/σ − z·(Δσ/σ)` : le second terme est proportionnel à z,
//   donc la contamination CROÎT avec le niveau — mesuré, 77 % → 100 % de barres `FLAT` où le prix va
//   contre le fade, de SLACK à SNAPPED. On déconstruit en deux objets qui disent chacun une chose :
//
//     GAP        = (Prix − Moyenne) / ATR_P50      où en est le prix par rapport à sa moyenne
//     MEANSLOPE  =  ΔMoyenne        / ATR_P50      où va la moyenne elle-même
//
// ⚠ ÉCHELLE : `ATRConfig` est en `ATR_PCT_X1000 = (atr/close)×100000`, PAS en prix.
//     ATR_P50_prix = p50 / 100000 × price      ← oublier ça fausse d'un facteur 10⁵.
//
// ══ CALIBRÉ À LA CLÔTURE (correction du 02/08, second temps) ═════════════════════════════════════
// 🔴 LA PREMIÈRE VERSION CALIBRAIT SUR LE GAP **LIVE**, alignée sur la population de `|z_s0|`. Or
//   l'axe qu'il s'agit de remplacer — `gapExhScore` — lit son niveau à la **CLÔTURE** (`zClosed`),
//   depuis la refonte du 29/07 qui a justement séparé le niveau de la vitesse. Substituer un niveau
//   LIVE à un niveau CLÔTURE aurait changé la métrique ET l'instant d'un seul coup : plus aucun A/B
//   attribuable. La promesse « mêmes populations » portait sur la mauvaise paire.
//   ⇒ Référence = `|zscore_h1|` (nue = clôture) · gap = `close_h1_s1 − middle_h1_s1`.
//
// ⭐ ET LES DELTAS N'ONT PLUS DE PROXY. La v1 prenait la DERNIÈRE LIGNE DE CHAQUE HEURE comme
//   instant de clôture, faute de σ à la clôture. Depuis le scan v8.40, `middle_h1_s1` EST la moyenne
//   à la clôture : `ΔM` entre deux barres H1 consécutives est désormais EXACT, pas approché.
//
// ⚠ Échantillonnage PAR LIGNE et pas par heure, pour les deux séries : c'est la population que le
//   moteur voit réellement (il évalue toutes les 2 min), et c'est aussi celle sur laquelle les
//   barreaux de `|z|` s'appliquent aujourd'hui. Comparer autrement fausserait l'appariement.
import fs from "fs";
import { getATRConfig } from "../../Matrix-Revolution/src/components/robot/engines/config/ATRConfig.js";

const DIR = "data/matrix";
const Z_BANDS = [0.30, 1.05, 1.55, 2.15, 2.60];      // barreaux de |z| en vigueur (sur zClosed)
const q = (t, p) => t.length ? t[Math.min(t.length - 1, Math.floor(t.length * p))] : null;
const r2 = (v) => v == null ? null : Math.round(v * 100) / 100;
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);

const assets = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"))
  .map((f) => f.replace(/\.csv$/i, "")).sort();

const res = {}; let jours = new Set();
for (const sym of assets) {
  const p50 = getATRConfig(sym, "H1")?.p50; if (!p50) { console.log(`${sym}: pas d'ATRConfig H1`); continue; }
  const L = fs.readFileSync(`${DIR}/${sym}.csv`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  if (I.middle_h1_s1 == null) { console.log(`${sym}: colonne middle_h1_s1 absente — lancer prep/mergeSigmaH1.mjs`); continue; }

  const gapAbs = [], zAbs = [], parHeure = new Map();
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const d = new Date(c[I.ts_utc]); if (Number.isNaN(d.getTime())) continue;
    const js = d.getUTCDay(); if (js === 0 || js === 6) continue;
    const zC = num(c[I.zscore_h1]), mP = num(c[I.middle_h1_s1]), pP = num(c[I.close_h1_s1]);
    // ⚠ `> 0` et pas seulement non-null : une cellule vide devient 0 chez `num()` en amont.
    if (zC === null || mP === null || pP === null || !(mP > 0) || !(pP > 0)) continue;
    jours.add(c[I.ts_utc].slice(0, 10));
    // ⭐ Le gap et son étalon sont pris AU MÊME INSTANT — le prix de clôture, pas le prix courant.
    const atrP = p50 / 100000 * pP;
    gapAbs.push(Math.abs((pP - mP) / atrP)); zAbs.push(Math.abs(zC));
    parHeure.set(c[I.ts_utc].slice(0, 13), { t: d.getTime(), mP, pP, atrP });
  }

  // ── deltas : d'une barre H1 CLÔTURÉE à la suivante, valeurs EXACTES (plus de proxy) ──
  //   À l'heure H, `middle_h1_s1` porte la moyenne de la barre H−1. Deux heures consécutives
  //   donnent donc deux barres consécutives.
  const cl = [...parHeure.entries()].sort((a, b) => a[1].t - b[1].t).map((e) => e[1]);
  const dM = [], dG = [];
  for (let i = 1; i < cl.length; i++) {
    if (cl[i].t - cl[i - 1].t !== 3600000) continue;
    // ⚠ FLUX GELÉ : marché fermé ⇒ valeurs rigoureusement identiques. Ce n'est pas « la moyenne n'a
    //   pas bougé », c'est une absence de marché. Sans ce filtre COCOA sortait p30 = 0,00 et sa
    //   bande FLAT devenait INATTEIGNABLE — la dégénérescence de sa bande tickflow LOW.
    if (cl[i].mP === cl[i - 1].mP && cl[i].pP === cl[i - 1].pP) continue;
    dM.push(Math.abs((cl[i].mP - cl[i - 1].mP) / cl[i].atrP));
    dG.push(Math.abs(((cl[i].pP - cl[i].mP) - (cl[i - 1].pP - cl[i - 1].mP)) / cl[i].atrP));
  }
  gapAbs.sort((a, b) => a - b); zAbs.sort((a, b) => a - b); dM.sort((a, b) => a - b); dG.sort((a, b) => a - b);
  const gapCuts = Z_BANDS.map((b) => r2(q(gapAbs, zAbs.filter((v) => v < b).length / zAbs.length)));
  res[sym] = { n: gapAbs.length, nD: dM.length, gapCuts,
    mCuts: [0.30, 0.70, 0.90].map((p) => r2(q(dM, p))),
    gCuts: [0.30, 0.70, 0.90].map((p) => r2(q(dG, p))) };
}

const lj = [...jours].sort();
console.log(`Fenêtre : ${lj[0]} → ${lj[lj.length - 1]} · ${lj.length} jours ouvrés · référence = |zscore_h1| (CLÔTURE)\n`);
console.log(`${"actif".padEnd(12)}${"n".padStart(8)}${"nΔ".padStart(6)}   ${"GAP clôture (populations de |zClosed|)".padStart(38)}   `
  + `${"|ΔM|  p30/p70/p90".padStart(22)}   ${"|ΔGAP|  p30/p70/p90".padStart(22)}`);
for (const s of assets) {
  const r = res[s]; if (!r) continue;
  console.log(`${s.padEnd(12)}${String(r.n).padStart(8)}${String(r.nD).padStart(6)}   `
    + `${r.gapCuts.map((v) => v.toFixed(2)).join(" ").padStart(38)}   `
    + `${r.mCuts.map((v) => v.toFixed(2)).join(" / ").padStart(22)}   ${r.gCuts.map((v) => v.toFixed(2)).join(" / ").padStart(22)}`);
}

const bloc = [
  `// ⚠ GÉNÉRÉ — ne pas éditer à la main. Script : Neo-Backtest/stats/_calib_deviation.mjs`,
  `// Calibré le 2026-08-02 sur data/matrix : ${lj.length} jours ouvrés (${lj[0]} → ${lj[lj.length - 1]}),`,
  `// week-ends exclus, ~${Math.round(assets.reduce((a, s) => a + (res[s]?.n ?? 0), 0) / assets.length / 100) * 100} barres/actif`,
  `// et ~${Math.round(assets.reduce((a, s) => a + (res[s]?.nD ?? 0), 0) / assets.length)} deltas de barre H1/actif.`,
  `// ⭐ RÉFÉRENCE = LA CLÔTURE. gap = (close_h1_s1 − middle_h1_s1) / ATR_P50, et les coupures`,
  `//    reproduisent la population des barreaux de |zscore_h1| (NUE = clôture), pas de |z_s0|.`,
  `//    C'est l'instant que lit \`gapExhScore\` depuis le 29/07 — substituer un niveau LIVE à un`,
  `//    niveau CLÔTURE changerait la métrique ET l'instant, et rendrait tout A/B inattribuable.`,
  `// ⭐ Les deltas sont EXACTS depuis le scan v8.40 (middle_h1_s1) — la v1 approximait la clôture`,
  `//    par la dernière ligne de chaque heure, faute de σ à la clôture.`,
  `// 🎯 REJOUER À CHAQUE REBUILD — calibrage d'ÉCHELLE par actif, il se périme avec les données.`,
  `//   dMean / dGap : |Δ| par barre H1, coupures p30 / p70 / p90 ⇒ FLAT · SOFT · FAST · EXPLOSIVE.`,
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
