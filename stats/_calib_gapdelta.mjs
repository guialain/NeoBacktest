// _calib_gapdelta.mjs — LA MÉDIANE DE |ΔGAP| PAR NIVEAU, POUR REMPLACER `Z_DELTA_MEDIAN`.
//
// 🔴 C'EST ICI QU'EST LE DÉFAUT DIAGNOSTIQUÉ. `Δz = (ΔP − ΔM)/σ − z·(Δσ/σ)` : le second terme est
//   proportionnel à z, donc la contamination croît avec le niveau — 77 % → 100 % de barres `FLAT`
//   où le prix va CONTRE le fade, de SLACK à SNAPPED. `ΔGAP` divise par un ATR médian FIXE : le
//   terme disparaît, il ne s'atténue pas.
//
// ⭐ ON REPRODUIT LA GRAMMAIRE DE `zDeltaCol`, PAS UN SCHÉMA NEUF :
//     coupures = Z_DELTA_MULT × médiane(|Δ| de la ligne)      avec Z_DELTA_MULT = ±0,50 / ±1,70 / ±3,64
//   Donc 7 colonnes signées identiques, même logique « vite POUR CE NIVEAU ». Seule la QUANTITÉ
//   mesurée change. Un schéma p30/p70/p90 aurait changé la définition des colonnes EN PLUS de la
//   quantité — deux changements au lieu d'un, et plus rien d'attribuable.
//
// ⚠⚠ LA FENÊTRE. `Δz` va de la CLÔTURE au LIVE (durée variable, 1 à 60 min). On calibre `ΔGAP` sur
//   EXACTEMENT la même fenêtre — sinon la substitution changerait la métrique ET l'horizon.
//   ⇒ ΔGAP = (gap_live − gap_clôture) / ATR_P50.
//   ⚠ Ma table `dGap` de ce matin était calibrée CLÔTURE À CLÔTURE : elle ne convient pas ici, et
//     `computeDeviation.gapSlope` la lisait alors qu'il calcule du live-moins-clôture. Deux fenêtres
//     sous un même nom — le défaut corrigé par ce script.
//   ⚠ La durée variable est un défaut RÉEL de l'axe actuel (un Δ mesuré sur 2 min et un mesuré sur
//     55 min ne sont pas comparables). On ne le corrige PAS ici : le corriger en même temps que la
//     contamination rendrait la mesure inattribuable. C'est l'étape d'après.
//
// ⚠ PARTITION : la médiane est prise PAR NIVEAU DE GAP (pas de z), puisque c'est ce niveau qui
//   choisira la ligne. Universelle entre actifs comme `Z_DELTA_MEDIAN` — le gap est déjà normalisé
//   par actif via ATR_P50, donc la dispersion inter-actifs est contrôlée. Vérifiée ci-dessous.
import fs from "fs";
import { getATRConfig } from "../../Matrix-Revolution/src/components/robot/engines/config/ATRConfig.js";
import { GAP_LEVELS, gapLevel } from "../../Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";

const DIR = "data/matrix";
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const parNiveau = Object.fromEntries(GAP_LEVELS.map((l) => [l, []]));
const parNiveauActif = {};                       // pour le contrôle d'universalité
let n = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const sym = f.replace(/\.csv$/i, "");
  const p50 = getATRConfig(sym, "H1")?.p50; if (!p50) continue;
  const L = fs.readFileSync(`${DIR}/${f}`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  if (I.middle_h1_s1 == null) continue;
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const d = new Date(c[I.ts_utc]); const js = d.getUTCDay(); if (js === 0 || js === 6) continue;
    const z0 = num(c[I.zscore_h1_s0]), s0 = num(c[I.sigma_h1]), p = num(c[I.price]);
    const mP = num(c[I.middle_h1_s1]), pP = num(c[I.close_h1_s1]);
    if ([z0, s0, p, mP, pP].some((v) => v === null) || !(s0 > 0) || !(p > 0) || !(mP > 0) || !(pP > 0)) continue;
    const atrNow = p50 / 100000 * p, atrPrev = p50 / 100000 * pP;
    const gapNow = z0 * s0, gapPrev = pP - mP;
    const lvl = gapLevel(gapPrev / atrPrev, sym);           // ⬅ le niveau vient de la CLÔTURE
    if (!lvl) continue;
    // ⭐ ORIENTÉ par le signe du gap de clôture, comme `zDeltaCol` l'est par signe(z) : `_DOWN` =
    //   l'écart se REFERME, `_UP` = il s'ouvre davantage. Le sens de la colonne ne change pas.
    const dGap = ((gapNow - gapPrev) / atrNow) * Math.sign(gapPrev);
    parNiveau[lvl].push(Math.abs(dGap));
    ((parNiveauActif[sym] ??= {})[lvl] ??= []).push(Math.abs(dGap));
    n++;
  }
}

console.log(`${n} observations · fenêtre = clôture → live (identique à Δz)\n`);
console.log(`${"niveau".padEnd(12)}${"n".padStart(9)}${"médiane |ΔGAP|".padStart(16)}${"  vs Z_DELTA_MEDIAN".padStart(22)}`);
const Z_MED = { NO_TENSION: 0.195, SLACK: 0.180, TENSE: 0.181, TENSE_HIGH: 0.265, EXTREME: 0.443, SNAPPED: 0.707 };
const out = {};
for (const l of GAP_LEVELS) {
  const m = med(parNiveau[l]); out[l] = m == null ? null : Math.round(m * 1000) / 1000;
  console.log(`${l.padEnd(12)}${String(parNiveau[l].length).padStart(9)}${String(out[l]).padStart(16)}${String(Z_MED[l]).padStart(22)}`);
}

// ⚠ CONTRÔLE D'UNIVERSALITÉ — une médiane universelle n'est légitime que si les actifs sont proches.
//   Si le rapport max/min explose, il faudra une table par actif comme pour les barreaux du gap.
console.log(`\n=== universalité : dispersion de la médiane ENTRE ACTIFS ===`);
for (const l of GAP_LEVELS) {
  const v = Object.values(parNiveauActif).map((o) => med(o[l] ?? [])).filter((x) => x != null && x > 0);
  if (v.length < 10) { console.log(`${l.padEnd(12)} (trop peu d'actifs)`); continue; }
  console.log(`${l.padEnd(12)} min ${Math.min(...v).toFixed(3)} → max ${Math.max(...v).toFixed(3)}   ratio ${(Math.max(...v) / Math.min(...v)).toFixed(2)}`
    + ((Math.max(...v) / Math.min(...v)) > 1.6 ? "   ⚠ dispersion forte — envisager par actif" : "   ✅"));
}

// -- table PAR ACTIF, imposee par le controle ci-dessus --------------------------------------
// ATTENTION : Z_DELTA_MEDIAN est UNIVERSELLE parce que dz est en sigma (auto-normalise par actif).
//   dGAP est en ATR_P50, donc le rapport sigma/ATR de chaque actif transparait : ratio 2,6 a 3,6
//   entre actifs a tous les niveaux. Une mediane universelle donnerait des colonnes de
//   selectivites tres differentes selon l'actif.
const NL = String.fromCharCode(10);
const bloc = [
  "// GENERE -- Neo-Backtest/stats/_calib_gapdelta.mjs. Mediane de |dGAP| PAR ACTIF x PAR NIVEAU.",
  "// Fenetre = cloture -> live, IDENTIQUE a celle de dz (duree variable 1-60 min) : la substitution",
  "//   ne change que la QUANTITE mesuree, pas l horizon. Coupures = Z_DELTA_MULT x cette mediane,",
  "//   donc les 7 colonnes signees et toute leur grammaire restent INCHANGEES.",
  "// REJOUER AU REBUILD. Ordre des niveaux : " + GAP_LEVELS.join(" | "),
  "export const GAP_DELTA_MEDIAN = {",
  ...Object.keys(parNiveauActif).sort().map((sym) => {
    const v = GAP_LEVELS.map((l) => { const m = med(parNiveauActif[sym][l] ?? []); return m == null ? "null" : (Math.round(m*1000)/1000).toFixed(3); });
    return "  " + (sym + ":").padEnd(12) + "[" + v.map(x => String(x).padStart(6)).join(", ") + "],";
  }),
  "};",
].join(NL);
fs.writeFileSync("stats/gap_delta_median.generated.js", bloc + NL, "utf8");
console.log("Ecrit : stats/gap_delta_median.generated.js");
