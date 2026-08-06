// _calib_slopedelta.mjs — MÉDIANE DE |Δpente LIVE| PAR ACTIF × PAR NIVEAU. (owner 2026-08-02)
//
// ⭐ MÊME GRAMMAIRE QUE `GAP_DELTA_MEDIAN`, PAS UN SCHÉMA NEUF : coupures = `Z_DELTA_MULT` × médiane
//   de la ligne, multiplicateurs IMPORTÉS et non recopiés. Donc 7 colonnes signées identiques et la
//   même logique « vite POUR CE NIVEAU ». Seule la quantité mesurée change.
//
// 🔴 PAR NIVEAU, ET C'EST MESURÉ : la médiane de |Δ| est multipliée par 2,3 à 3,8 de `flat` à
//   `extreme` sur 18 actifs sur 19. Des coupures uniques diraient « explosif » pour un niveau et
//   « mou » pour un autre sur la même valeur absolue.
// 🔴 PAR ACTIF, ET C'EST MESURÉ AUSSI : dispersion inter-actifs de 1,40 (strong) à 2,95 (extreme).
//
// ⚠ ORIENTATION : d = (slope_h1_s0 − slope_h1) × signe(slope_h1_s0). `_UP` = la pente s'accentue
//   DANS SON SENS, `_DOWN` = elle s'aplatit. Le côté vient du LIVE, comme pour le ZScore depuis ce
//   matin — à `flat` le signe de la clôture est du bruit.
// ⚠ NIVEAU depuis la CLÔTURE (`slope_h1`), vitesse depuis le LIVE : la ligne est stable dans l'heure,
//   la colonne bouge. C'est la forme demandée par l'owner et celle de `GAP_EXH_TABLE`.
// ⚠ FENÊTRE de durée variable (1 à 60 min) — défaut RÉEL et connu, identique à celui de `gapSlope`.
//   Non corrigé ici : le corriger en même temps rendrait la mesure inattribuable.
// 🎯 REJOUER À CHAQUE REBUILD.
import fs from "fs";
import { getSlopeClass } from "../../Matrix-Revolution/src/components/robot/engines/config/SlopeConfig.js";
const DIR = "data/matrix";
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const NIV = ["flat", "weak", "strong", "extreme"];
const niv = (c) => c === "flat" ? "flat" : (c.endsWith("_weak") ? "weak" : c.endsWith("_strong") ? "strong" : c.endsWith("_extreme") ? "extreme" : null);

const parA = {}; const jours = new Set();
for (const f of fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const sym = f.replace(/\.csv$/i, "");
  const L = fs.readFileSync(`${DIR}/${f}`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const o = parA[sym] = Object.fromEntries(NIV.map((n) => [n, []]));
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const d = new Date(c[I.ts_utc]); const js = d.getUTCDay(); if (js === 0 || js === 6) continue;
    const s0 = num(c[I.slope_h1_s0]), s1 = num(c[I.slope_h1]);
    if (s0 === null || s1 === null || s0 === 0) continue;
    const n = niv(getSlopeClass(s1, sym)); if (!n) continue;
    o[n].push(Math.abs((s0 - s1) * Math.sign(s0)));
    jours.add(c[I.ts_utc].slice(0, 10));
  }
}
const syms = Object.keys(parA).sort();
const mauvais = [], noter = [];
console.log(`${"actif".padEnd(12)}${NIV.map((n) => n.padStart(10)).join("")}${"n min".padStart(9)}`);
for (const s of syms) {
  const m = NIV.map((n) => med(parA[s][n])), nmin = Math.min(...NIV.map((n) => parA[s][n].length));
  m.forEach((x, i) => { if (x == null || !(x > 0)) mauvais.push(`${s}/${NIV[i]}: médiane nulle ou absente`); });
  if (nmin < 300) mauvais.push(`${s}: n=${nmin} sur le niveau le plus creux`);
  // ⚠ non bloquant : une médiane qui DÉCROÎT avec le niveau contredit le gradient général.
  for (let i = 1; i < m.length; i++) if (m[i] != null && m[i-1] != null && m[i] < m[i-1])
    noter.push(`${s}: ${NIV[i]} (${m[i].toFixed(3)}) < ${NIV[i-1]} (${m[i-1].toFixed(3)})`);
  console.log(`${s.padEnd(12)}${m.map((x) => (x == null ? "—" : x.toFixed(3)).padStart(10)).join("")}${String(nmin).padStart(9)}`);
}
if (noter.length) { console.log(`\n⚠ GRADIENT NON MONOTONE (signalé, pas bloquant) :`); noter.forEach((x) => console.log("   " + x)); }
if (mauvais.length) { console.log(`\n🔴 rien écrit :`); mauvais.forEach((m) => console.log("   " + m)); process.exit(1); }

const lj = [...jours].sort();
const NL = String.fromCharCode(10);
const out = [
  `// GENERE -- ne pas editer a la main. Script : Neo-Backtest/stats/_calib_slopedelta.mjs`,
  `// Calibre le 2026-08-02, ${lj.length} jours ouvres (${lj[0]} -> ${lj[lj.length-1]}), week-ends exclus.`,
  `// Mediane de |(slope_h1_s0 - slope_h1) x signe(slope_h1_s0)| PAR ACTIF x PAR NIVEAU de pente.`,
  `// Coupures = Z_DELTA_MULT x cette mediane -- memes 7 colonnes signees que le ZScore, importees.`,
  `// PAR NIVEAU, MESURE : la mediane est x2,3 a x3,8 de flat a extreme sur 18 actifs sur 19.`,
  `// PAR ACTIF, MESURE : dispersion inter-actifs de 1,40 (strong) a 2,95 (extreme).`,
  `// Ordre des niveaux : ` + NIV.join(" | "),
  `export const SLOPE_DELTA_MEDIAN = {`,
  ...syms.map((s) => "  " + (s + ":").padEnd(13) + "[" + NIV.map((n) => (Math.round(med(parA[s][n])*1000)/1000).toFixed(3).padStart(6)).join(", ") + "],"),
  `};`,
].join(NL);
fs.writeFileSync("stats/slope_delta_median.generated.js", out + NL, "utf8");
console.log(`${NL}Ecrit : stats/slope_delta_median.generated.js`);
