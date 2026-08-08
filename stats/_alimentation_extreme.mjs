// _alimentation_extreme.mjs — « ON NE FADE PAS UN EXTREME ENCORE ALIMENTE » (owner 2026-08-08).
//   These ecrite AVANT les chiffres : tant que (a) le prix chevauche sa bande ET (b) les bandes
//   s'ouvrent, la tendance se nourrit — peu importe depuis 20 minutes ou 6 heures.
//
//   ALIMENTE (oriente cote fade, MIROIR) :
//     (a) zB >= 2        le prix chevauche la bande      zB = zscore_h1_s0 projete (SELL +z, BUY -z)
//     (b) dBBW > 0       les bandes s'ouvrent            bbw = 4σ/M×100  vs  bbw_h1_s15min
//
// ⭐ POURQUOI ZERO COLONNE A AJOUTER : `zscore_h1_s0 = (price - middle_h1)/sigma_h1` a 100 %
//   (verifie n=22 876, ecart median 0,0000) et `bbw = 4σ/M` ⇒ bandes a ±2σ ⇒ **`%B >= 1` s'ecrit
//   exactement `z >= 2`**. Ne PAS recalculer %B a la main, ce serait un 2e site pour la meme chose.
// ⛔ PAS DE BBW H4 dans le dataset : `(b)` n'existe qu'en H1. `middle_h4`/`sigma_h4` sont la, a 77,6 %.
//
// 🔴🔥 VERDICT MESURE (08/08) : l'alimente SEUL ne trie pas — il retire une population MEILLEURE que
//   la moyenne par grappe (82,7 % contre 80,9 %). Ni (a) ni (b) seuls ne trient non plus. C'est la
//   CONJONCTION avec la duree (`_persistance_extreme.mjs`) qui trie : 48,7 % contre 79,1 % / 74,9 %
//   pris separement ⇒ **la duree n'etait PAS qu'un proxy, les deux axes portent de l'info distincte.**
//
//   usage : node stats/_alimentation_extreme.mjs
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(import.meta.dirname, "../data/matrix");
const T_DUREE = Number(process.env.T_DUREE ?? 120);       // le seuil de duree du tete-a-tete
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const F = []; const BARRES = { vus: 0, extr: 0, alim: 0, alimExtr: 0, sansBbw: 0 };
for (const a of readdirSync(DIR).filter((f) => f.endsWith(".csv")).map((f) => f.slice(0, -4))) {
  const lines = readFileSync(`${DIR}/${a}.csv`, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 5);
  const H = lines[0].split(";").map((s) => s.trim());
  const ci = Object.fromEntries(H.map((h, i) => [h, i]));
  const N = lines.length - 1;
  const ts = new Array(N), kh4 = new Array(N), row = new Array(N), z = new Array(N), dbbw = new Array(N);
  for (let i = 0; i < N; i++) {
    const c = lines[i + 1].split(";"); row[i] = c; ts[i] = Date.parse(c[ci.ts_utc]);
    kh4[i] = num(c[ci.stoch_k_h4_s0]); z[i] = num(c[ci.zscore_h1_s0]);
    const sg = num(c[ci.sigma_h1]), md = num(c[ci.middle_h1]);
    const bn = (sg !== null && md !== null && md !== 0) ? 4 * sg / md * 100 : null;
    // ⚠ REPLI s15 -> s10 -> s5 : sans lui 2,5 % des barres n'auraient pas de dynamique et le veto
    //   y serait FAIL-OPEN en silence. Avec le repli : 0 barre sans dBBW (mesure).
    const br = num(c[ci.bbw_h1_s15min]) ?? num(c[ci.bbw_h1_s10min]) ?? num(c[ci.bbw_h1_s5min]);
    dbbw[i] = (bn !== null && br !== null) ? bn - br : null;
  }
  const per = (ok) => { const P = new Array(N).fill(-1); let deb = null;
    for (let i = 0; i < N; i++) { const v = kh4[i];
      if (v !== null && ok(v)) { if (deb === null) deb = ts[i]; P[i] = (ts[i] - deb) / 60000; } else deb = null; }
    return P; };
  const PH = per((v) => v >= 90), PL = per((v) => v <= 10);

  // taux d'occupation sur TOUTES les barres — une regle dont on ignore la portee ne se calibre pas
  for (let i = 0; i < N; i++) {
    BARRES.vus++;
    const sens = kh4[i] === null ? null : kh4[i] >= 90 ? "HAUT" : kh4[i] <= 10 ? "BAS" : null;
    if (dbbw[i] === null) BARRES.sansBbw++;
    const zB = z[i] === null ? null : (sens === "BAS" ? -z[i] : z[i]);
    const al = (zB !== null && dbbw[i] !== null && zB >= 2 && dbbw[i] > 0);
    if (al) BARRES.alim++;
    if (sens) { BARRES.extr++; if (al) BARRES.alimExtr++; }
  }
  const idx = new Map(); for (let i = 0; i < N; i++) idx.set(row[i][ci.timestamp], i);
  let r; try { r = runMatrixBacktest(`${DIR}/${a}.csv`, { chargeSpread: true, spacing: false, maxOpen: 100000 }); } catch { continue; }
  for (const s of r.signals ?? []) {
    if (s.strategy !== "EXH" || typeof s.R !== "number") continue;
    const i = idx.get(s.tsMT); if (i === undefined) continue;
    const zB = z[i] === null ? null : (s.side === "SELL" ? z[i] : -z[i]);
    F.push({ a, d: String(s.tsMT).slice(0, 10), side: s.side, win: s.R > 0, R: s.R,
      pH4: s.side === "SELL" ? PH[i] : PL[i], zB, dbbw: dbbw[i],
      bande: zB !== null && zB >= 2, ouvre: dbbw[i] !== null && dbbw[i] > 0,
      alim: (zB !== null && dbbw[i] !== null && zB >= 2 && dbbw[i] > 0) });
  }
}

const key = (x) => `${x.a}|${x.d}`;
const st = (rs) => { const n = rs.length; if (!n) return null;
  const G = {}; for (const x of rs) { (G[key(x)] ??= { n: 0, w: 0 }); G[key(x)].n++; G[key(x)].w += x.win ? 1 : 0; }
  const gs = Object.values(G);
  return { n, wr: 100 * rs.filter((x) => x.win).length / n, R: rs.reduce((a, x) => a + x.R, 0), g: gs.length,
    wrg: 100 * gs.reduce((a, o) => a + o.w / o.n, 0) / gs.length, gBas: gs.filter((o) => o.w / o.n < 0.75).length }; };
const L = (l, o) => o
  ? `${l.padEnd(30)} ${String(o.n).padStart(5)} ${o.wr.toFixed(1).padStart(6)}%  ${o.wrg.toFixed(1).padStart(6)}%  ${String(o.g).padStart(4)} ${String(o.gBas).padStart(5)}`
  : `${l.padEnd(30)}     0`;
const HDR = `${"".padEnd(30)}  tirs   WR/tir  WR/grap  grap  <75%`;
const T = (x) => x.pH4 >= T_DUREE;

console.log("=== TAUX D'OCCUPATION (toutes barres) ===");
console.log(`  barres ${BARRES.vus} · sans dBBW ${BARRES.sansBbw} · ALIMENTE ${BARRES.alim} (${(100 * BARRES.alim / BARRES.vus).toFixed(1)} %)`);
console.log(`  barres EXTREMES %K H4 ${BARRES.extr} (${(100 * BARRES.extr / BARRES.vus).toFixed(1)} %) dont alimentees ${(100 * BARRES.alimExtr / BARRES.extr).toFixed(1)} %`);

console.log(`\n=== DECOMPOSITION (${F.length} tirs EXH, population non contrainte) ===`);
console.log(HDR);
for (const side of ["SELL", "BUY"]) {
  const S = F.filter((x) => x.side === side);
  console.log(L(`${side} TOUT`, st(S)));
  console.log(L("  (a) prix hors bande zB>=2", st(S.filter((x) => x.bande))));
  console.log(L("  (b) bandes s'ouvrent", st(S.filter((x) => x.ouvre))));
  console.log(L("  ALIMENTE (a ET b)", st(S.filter((x) => x.alim))));
  console.log(L(`  duree >= ${T_DUREE} min`, st(S.filter(T))));
  console.log(L("  CONJONCTION (duree ET alim)", st(S.filter((x) => T(x) && x.alim))));
  console.log("");
}

// ⭐⭐⭐ LA TABLE QUI TRANCHE : les DESACCORDS. Un veto ne se juge pas sur ce qu'il retire en bloc
//   mais sur ce qu'il retire QUE L'AUTRE LAISSE — c'est la seule lecture qui a une taille d'effet.
console.log("=== LES DESACCORDS ===");
console.log(HDR);
for (const side of ["SELL", "BUY"]) {
  const S = F.filter((x) => x.side === side);
  console.log(`--- ${side} ---`);
  console.log(L("  les DEUX bloquent", st(S.filter((x) => x.alim && T(x)))));
  console.log(L("  ALIM seul bloque", st(S.filter((x) => x.alim && !T(x)))));
  console.log(L("  duree seule bloque", st(S.filter((x) => !x.alim && T(x)))));
  console.log(L("  aucun ne bloque", st(S.filter((x) => !x.alim && !T(x)))));
  console.log("");
}

console.log("=== ROBUSTESSE, MEMES DECOUPES (Δ WR) ===");
console.log("  decoupe              cote |  avant  | CONJONCTION | ALIMENTE  | DUREE");
for (const side of ["SELL", "BUY"]) {
  for (const [lbl, ex] of [["tel quel", () => false], ["sans le 04/08", (x) => x.d === "2026.08.04"],
    ["sans indices US", (x) => ["US_30", "US_500", "US_TECH100"].includes(x.a)],
    ["juillet seul", (x) => x.d >= "2026.08.01"], ["aout seul", (x) => x.d < "2026.08.01"]]) {
    const P = F.filter((x) => x.side === side && !ex(x)); const av = st(P);
    const f = (keep) => { const o = st(P.filter(keep)); return `${(o.wr - av.wr >= 0 ? "+" : "")}${(o.wr - av.wr).toFixed(1)} pt`.padStart(8); };
    console.log(`  ${lbl.padEnd(18)} ${side.padEnd(5)} | ${av.wr.toFixed(1).padStart(5)}% | ${f((x) => !(T(x) && x.alim))} | ${f((x) => !x.alim)} | ${f((x) => !T(x))}`);
  }
}

// ⭐ VERIF DE COHERENCE DE LA THESE : si l'alimentation EST le phenomene, elle doit culminer dans le
//   creux de la courbe en U de la duree, et retomber au-dela de 8 h. (Elle le fait — mais elle
//   n'explique PAS tout le U : `2-4 h` et `> 8 h` ont le meme taux pour 27 points de WR d'ecart.)
console.log("\n=== COHERENCE : taux d'alimentation par bande de persistance ===");
const BD = [["pas a l'extreme", (v) => v < 0], ["< 30 min", (v) => v >= 0 && v < 30], ["30-60 min", (v) => v >= 30 && v < 60],
  ["1-2 h", (v) => v >= 60 && v < 120], ["2-4 h", (v) => v >= 120 && v < 240], ["4-8 h", (v) => v >= 240 && v < 480], ["> 8 h", (v) => v >= 480]];
for (const side of ["SELL", "BUY"]) {
  console.log(`--- ${side} ---   ${"".padEnd(8)}tirs   WR/tir   %ALIMENTE`);
  for (const [l, f] of BD) {
    const S = F.filter((x) => x.side === side && f(x.pH4));
    if (!S.length) { console.log(`  ${l.padEnd(20)}     0`); continue; }
    console.log(`  ${l.padEnd(20)} ${String(S.length).padStart(5)} ${(100 * S.filter((x) => x.win).length / S.length).toFixed(1).padStart(6)}%   ${(100 * S.filter((x) => x.alim).length / S.length).toFixed(1).padStart(6)} %`);
  }
}
