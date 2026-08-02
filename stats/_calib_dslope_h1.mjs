// _calib_dslope_h1.mjs — `dslope_h1` (CLÔTURE → CLÔTURE) PAR ACTIF. (owner 2026-08-02)
//
// ⭐ ON NE CHANGE QU'UNE CHOSE : l'échelle passe d'UNE table asset-agnostique (calibrée sur
//   US_TECH100 seul) à DIX-NEUF. Même structure — trois magnitudes symétriques soft/acc/explo,
//   sept classes — et mêmes PERCENTILES IMPLICITES que la table en place, relevés ci-dessous sur
//   la population poolée. Changer le découpage en plus rendrait tout écart inattribuable.
// ⚠ OBJET : `dslope_h1`, la variation de la pente d'une clôture H1 à la suivante. PAS
//   `slope_h1_s0 − slope_h1` (live − clôture) : mesuré, les deux ne coïncident sur AUCUNE des
//   371 697 lignes, et leurs p97 diffèrent de 27 %.
// ⚠ POPULATION = PAR LIGNE (≈ 2 min), celle que le moteur voit réellement — c'est la leçon du jour
//   (ADX calibré H1 lu M15, tickflow, slope_h1). Contrôlé : les percentiles par ligne et par barre
//   H1 tombent à 2 % l'un de l'autre, la pondération par le nombre de lignes ne biaise pas.
// 🔴 EFFECTIF UTILE — À LIRE AVANT D'UTILISER LES QUEUES. 19 563 lignes/actif ne sont que ~300
//   VALEURS DISTINCTES (une par barre H1 sur 24 jours ouvrés), chacune répétée ~65 fois. Répéter
//   n'informe pas : le p95 de chaque actif repose sur ~15 barres. Les coupures `soft` et `acc` sont
//   solides, `explo` est FRAGILE et le sera tant que la fenêtre fera 24 jours.
import fs from "fs";
const DIR = "data/matrix";
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null;
const r2 = (v) => Math.round(v * 100) / 100;

const parActif = {}, pool = []; const jours = new Set();
for (const f of fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const sym = f.replace(/\.csv$/i, "");
  const L = fs.readFileSync(`${DIR}/${f}`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const v = [], vus = new Set();
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const d = new Date(c[I.ts_utc]); const js = d.getUTCDay(); if (js === 0 || js === 6) continue;
    const x = num(c[I.dslope_h1]); if (x === null) continue;
    v.push(Math.abs(x)); pool.push(Math.abs(x)); vus.add(x); jours.add(c[I.ts_utc].slice(0, 10));
  }
  v.sort((a, b) => a - b); parActif[sym] = { abs: v, distincts: vus.size };
}
pool.sort((a, b) => a - b);

// ⭐ LES PERCENTILES IMPLICITES DE LA TABLE EN PLACE — relevés, pas choisis.
const ACT = { soft: 0.5, acc: 1.5, explo: 4.7 };
const pct = (a, x) => a.filter((v) => v <= x).length / a.length;
const P = { soft: pct(pool, ACT.soft), acc: pct(pool, ACT.acc), explo: pct(pool, ACT.explo) };
const lj = [...jours].sort();
console.log(`Fenêtre ${lj[0]} → ${lj[lj.length-1]} · ${lj.length} jours ouvrés · ${pool.length} lignes\n`);
console.log(`Percentiles de |dslope_h1| que reproduisent les seuils actuels (poolé) :`);
console.log(`   soft  0,50 → p${(P.soft*100).toFixed(0)}    acc  1,50 → p${(P.acc*100).toFixed(0)}    explo 4,70 → p${(P.explo*100).toFixed(0)}\n`);

const cuts = (a) => ({ soft: r2(q(a, P.soft)), acc: r2(q(a, P.acc)), explo: r2(q(a, P.explo)) });
const syms = Object.keys(parActif).sort();
console.log(`${"actif".padEnd(12)}${"distincts".padStart(11)}${"soft".padStart(8)}${"acc".padStart(8)}${"explo".padStart(8)}   vs table actuelle`);
const mauvais = [];
for (const s of syms) {
  const c = cuts(parActif[s].abs), d = parActif[s].distincts;
  if (!(c.soft > 0 && c.acc > c.soft && c.explo > c.acc)) mauvais.push(`${s}: coupures non croissantes (${c.soft} / ${c.acc} / ${c.explo})`);
  if (d < 150) mauvais.push(`${s}: seulement ${d} valeurs distinctes`);
  console.log(`${s.padEnd(12)}${String(d).padStart(11)}${c.soft.toFixed(2).padStart(8)}${c.acc.toFixed(2).padStart(8)}${c.explo.toFixed(2).padStart(8)}`
    + `   ×${(c.explo/ACT.explo).toFixed(2)} sur explo`);
}
const cd = cuts(pool);
console.log(`${"default".padEnd(12)}${"—".padStart(11)}${cd.soft.toFixed(2).padStart(8)}${cd.acc.toFixed(2).padStart(8)}${cd.explo.toFixed(2).padStart(8)}`);
if (mauvais.length) { console.log(`\n🔴 rien écrit :`); mauvais.forEach((m) => console.log("   " + m)); process.exit(1); }

const ligne = (s, c) => `  ${(s + ":").padEnd(13)}{ soft: ${c.soft.toFixed(2).padStart(5)}, acc: ${c.acc.toFixed(2).padStart(5)}, explo: ${c.explo.toFixed(2).padStart(5)} },`;
const out = [
  `// ⚠ GÉNÉRÉ — ne pas éditer à la main. Script : Neo-Backtest/stats/_calib_dslope_h1.mjs`,
  `// Calibré le 2026-08-02 sur \`dslope_h1\` (CLÔTURE → CLÔTURE), ${lj.length} jours ouvrés`,
  `// (${lj[0]} → ${lj[lj.length-1]}), week-ends exclus, ${pool.length} lignes, ${syms.length} actifs.`,
  `// Coupures = percentiles de |dslope_h1| REPRODUISANT la table asset-agnostique en place :`,
  `//   soft = p${(P.soft*100).toFixed(0)} · acc = p${(P.acc*100).toFixed(0)} · explo = p${(P.explo*100).toFixed(0)}. Seule l'ÉCHELLE devient par actif.`,
  `// 🔴 \`explo\` EST FRAGILE : ~300 valeurs distinctes par actif (une par barre H1 sur 24 jours),`,
  `//    donc ce p${(P.explo*100).toFixed(0)} repose sur une quinzaine de barres. \`soft\` et \`acc\` sont solides.`,
  `// 🎯 REJOUER À CHAQUE REBUILD.`,
  `export const DSLOPE_H1_CONFIG = {`,
  ...syms.map((s) => ligne(s, cuts(parActif[s].abs))),
  ligne("default", cd),
  `};`,
].join("\n");
fs.writeFileSync("stats/dslope_h1_config.generated.js", out + "\n", "utf8");
console.log(`\nÉcrit : stats/dslope_h1_config.generated.js`);
