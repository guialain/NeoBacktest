// _delta_di_calib.mjs — LE PAS DE Δ DI N'EST PAS ADDITIF (08/08).
//
// 🔴🔥⭐⭐⭐ CE QUE CE SCRIPT EMPECHE D'ECRIRE : un veto de la forme « DI bas ET Δ DI < 0 ».
//   Le second terme est INERTE — il est IMPLIQUE par le premier :
//       diPour < 5  ->  BUY 122 tirs · SELL 138        (diPour = le DI qui pousse POUR le trade)
//       … ET Δ < 0  ->  BUY 122      · SELL 138
//       … ET Δ >= 0 ->  BUY   0      · SELL   0        cette population N'EXISTE PAS
//   Parce que `Δ DI / DI_precedent` vaut **−0,1333 a TOUS les niveaux** (p10 = p25 = p50, n=839 300)
//   et que **56,7 % des barres sont EXACTEMENT dessus** : c'est la decroissance de l'EMA Wilder
//   quand aucun mouvement directionnel n'entre. `Δ < 0` ne dit pas « moins d'acheteurs », il dit
//   « l'horloge a tourne ».
//
// ⇒ UN PAS ABSOLU N'A AUCUN SENS, la decroissance est proportionnelle :
//   DI 1-5 → −0,42 · 5-10 → −0,87 · 10-15 → −1,48 · 15-20 → −2,10 · 30-40 → −4,04 · 40+ → −5,35.
//   Une bande morte a ±1,5 declare « plat » tout ce qui est sous DI 11 et ne mord jamais au-dessus
//   de DI 20.
//
// ✅ LA CONSTANTE EST DEJA CELLE DU MOTEUR : `ADX_EMA_ALPHA = 2/15` (OpportunityDetector.js), et
//   `diDeltaLive` / `diGapDeltaLive` la soustraient (owner 26/07). Cette mesure independante tombe
//   dessus au centieme. ⚠ MAIS `diDeltaLive` (le DI PAR CAMP) n'a AUCUN appelant dans le scoring —
//   seul l'ECART est corrige.
//
// ⚠⚠ ET LA LECTURE LIVE `s0 − c1` EST BIAISEE SUR N'IMPORTE QUELLE BARRE (voir sortie) :
//   +DI 70,9 % de negatifs · −DI 72,0 % · ADX 48,8 % (lui n'a pas le biais) · close a close 56,0 %.
//   🔴 **Tout resultat obtenu sur `s0 − c1` nu est a refaire close a close.** Vecu le 08/08 : « les
//   4 % de tirs SELL ou le −DI remonte portent 100 % du R » — refait proprement, l'effet s'inverse.
//
//   usage : node stats/_delta_di_calib.mjs
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(import.meta.dirname, "../data/matrix");
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p / 100 * a.length))]; };

const rows = [];                     // close a close, les deux DI confondus
const biais = { p: [0, 0], m: [0, 0], adx: [0, 0], cc: [0, 0] };
for (const a of readdirSync(DIR).filter((f) => f.endsWith(".csv")).map((f) => f.slice(0, -4))) {
  const lines = readFileSync(`${DIR}/${a}.csv`, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 5);
  const H = lines[0].split(";").map((s) => s.trim());
  const ci = Object.fromEntries(H.map((h, i) => [h, i]));
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(";"); const g = (n) => num(c[ci[n]]);
    for (const s of ["plus", "minus"]) {
      const v1 = g(`${s}_di_h1_c1`), v2 = g(`${s}_di_h1_c2`);
      if (v1 === null || v2 === null || v2 < 1) continue;
      rows.push({ prev: v2, d: v1 - v2, rel: (v1 - v2) / v2 });
    }
    const paires = [["plus_di_h1_s0", "plus_di_h1_c1", "p"], ["minus_di_h1_s0", "minus_di_h1_c1", "m"],
                    ["adx14_h1_s0", "adx14_h1_c1", "adx"], ["plus_di_h1_c1", "plus_di_h1_c3", "cc"]];
    for (const [x, y, k] of paires) { const A = g(x), B = g(y);
      if (A !== null && B !== null) { biais[k][1]++; if (A - B < 0) biais[k][0]++; } }
  }
}

console.log(`n = ${rows.length} (close a close, +DI et −DI confondus)\n`);
console.log("=== Δ ABSOLU par NIVEAU — si le pas etait additif, les lignes seraient identiques ===");
console.log("  niveau DI      n       p10     p25   MEDIANE     p75     p90");
for (const [lo, hi] of [[1, 5], [5, 10], [10, 15], [15, 20], [20, 25], [25, 30], [30, 40], [40, 99]]) {
  const S = rows.filter((x) => x.prev >= lo && x.prev < hi).map((x) => x.d);
  if (S.length < 200) continue;
  console.log(`  ${String(lo).padStart(2)}-${String(hi).padStart(2)}    ${String(S.length).padStart(7)} ${q(S, 10).toFixed(2).padStart(8)} ${q(S, 25).toFixed(2).padStart(7)} ${q(S, 50).toFixed(2).padStart(8)} ${q(S, 75).toFixed(2).padStart(7)} ${q(S, 90).toFixed(2).padStart(7)}`);
}
console.log("\n=== Δ RELATIF (Δ / DI precedent) — la, elles LE SONT ===");
console.log("  niveau DI      n       p10     p25   MEDIANE     p75     p90");
for (const [lo, hi] of [[1, 5], [5, 10], [10, 15], [15, 20], [20, 25], [25, 30], [30, 40], [40, 99]]) {
  const S = rows.filter((x) => x.prev >= lo && x.prev < hi).map((x) => x.rel);
  if (S.length < 200) continue;
  console.log(`  ${String(lo).padStart(2)}-${String(hi).padStart(2)}    ${String(S.length).padStart(7)} ${q(S, 10).toFixed(3).padStart(8)} ${q(S, 25).toFixed(3).padStart(7)} ${q(S, 50).toFixed(3).padStart(8)} ${q(S, 75).toFixed(3).padStart(7)} ${q(S, 90).toFixed(3).padStart(7)}`);
}

const rel = rows.map((x) => x.rel);
const K = -q(rel.filter((v) => v < 0), 50);
console.log(`\n=== LA CONSTANTE ===  decroissance mesuree ${(100 * K).toFixed(2)} %   (moteur : ADX_EMA_ALPHA = 2/15 = 13,33 %)`);
console.log(`  part EXACTEMENT sur la decroissance (|rel + K| < 0,002) : ${(100 * rel.filter((v) => Math.abs(v + K) < 0.002).length / rel.length).toFixed(1)} %`);
console.log(`  part SOUS                                              : ${(100 * rel.filter((v) => v < -K - 0.002).length / rel.length).toFixed(1)} %`);
console.log(`  part AU-DESSUS (du mouvement a ete INJECTE)            : ${(100 * rel.filter((v) => v > -K + 0.002).length / rel.length).toFixed(1)} %`);

// ⭐ L'ECHELLE PROPRE : un INTERRUPTEUR, pas une pente. Rien entre 0 et ~0,43 ; puis une bosse large.
const e = rows.map((x) => x.d + K * x.prev);
const enz = e.filter((v) => Math.abs(v) > 0.02);
console.log(`\n=== EXCES  e = Δ + ${(100 * K).toFixed(2)} % × DI_prec  (mouvement REELLEMENT injecte) ===`);
console.log(`  e = 0 : ${(100 * (1 - enz.length / e.length)).toFixed(1)} % du monde · coupes sur le NON NUL (5/10/20/30/20/10/5) :`);
console.log("   " + [5, 15, 35, 65, 85, 95].map((p) => `p${p}=${q(enz, p).toFixed(2)}`).join(" · "));

console.log(`\n=== LE BIAIS DE LA LECTURE LIVE (part de Δ < 0, TOUTES barres, aucune selection) ===`);
console.log(`  +DI  s0−c1 : ${(100 * biais.p[0] / biais.p[1]).toFixed(1)} %   −DI  s0−c1 : ${(100 * biais.m[0] / biais.m[1]).toFixed(1)} %`);
console.log(`  ADX  s0−c1 : ${(100 * biais.adx[0] / biais.adx[1]).toFixed(1)} %   (pas de biais)   +DI c1−c3 : ${(100 * biais.cc[0] / biais.cc[1]).toFixed(1)} %`);
