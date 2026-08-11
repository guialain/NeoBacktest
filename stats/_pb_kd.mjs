// _pb_kd.mjs — `K − D` APPORTE-T-IL QUELQUE CHOSE AU PULLBACK ? On MESURE avant d'ecrire une note.
//
// ⭐⭐⭐ L'ORIENTATION, ECRITE AVANT DE REGARDER LES CHIFFRES (sinon on la choisit pour qu'ils
//   plaisent). `%D` RETARDE `%K` : `K − D > 0` veut dire « le mouvement de K est FRAIS ».
//     PB BUY   le pullback descend  → on le veut FINI → K repasse au-DESSUS de D → K−D > 0 = BON
//     PB SELL  le pullback monte    → on le veut FINI → K repasse au-DESSOUS de D → K−D < 0 = BON
//   Les deux se resument a `kdOr = (K − D) x sens`, MEME orientation que `u`. Positif = le
//   contre-mouvement TOURNE dans notre sens. Negatif = il pousse ENCORE contre nous.
// ⚠ Piege connu (09/08) : « pousse encore » dit le CONTRAIRE selon que le capteur MENE ou RETARDE.
//   Ici D retarde par construction — c'est ce qui rend le signe lisible.
// ⚠ Redondance a verifier : `kdOr` et la bande `ΔK` sont deux fonctions de `k_live`. On ventile donc
//   AUSSI kdOr DANS chaque famille ΔK — s'il ne trie qu'entre familles, il ne fait que les redire.
// ⚠ Bandes = QUANTILES de la population, pas des bornes inventees.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1"; process.env.PB_ISOLE = "1"; process.env.MIN_PB = "-31";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/";
const { pbScoreV1 } = await import(M + "pbScoringV1.js");
const { readTfs } = await import(M + "vetoGate.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const tirs = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const actif = path.basename(f, ".csv"), CSV = path.join(DIR, f);
  const L = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/), head = L[0].split(";");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"), o = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = c[i]; rows.set(o.timestamp, o); }
  for (const s of (runMatrixBacktest(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals ?? [])) {
    if (s.strategy !== "PB" || (s.outcome !== "WIN" && s.outcome !== "LOSS")) continue;
    const row = rows.get(s.tsMT); if (!row) continue;
    const v = readTfs(row), zC = num(row.zscore_h1), zL = num(row.zscore_h1_s0);
    const k0 = num(row.stoch_k_h1_s0), d0 = num(row.stoch_d_h1_s0);
    if (k0 == null || d0 == null) continue;
    const r = pbScoreV1({ zH1Closed: zC, dZH1Live: (zC != null && zL != null) ? zL - zC : null,
      kH1Closed: v.h1?.kClosed ?? null, dKBandH1Live: v.h1?.dKBand ?? null,
      diGapBandH1Live: v.h1?.gapBand ?? null, highD1Live: num(row.high_d1_s0),
      lowD1Live: num(row.low_d1_s0), prixLive: num(row.price), side: s.side });
    tirs.push({ ...s, actif, p: r.parts, kdOr: (k0 - d0) * (s.side === "BUY" ? 1 : -1) });
  }
}
const jour = (s) => String(s.tsMT).slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const R = t.reduce((a, b) => a + (b.R || 0), 0), g = new Map();
  for (const x of t) { const k = x.actif + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length, R }; };
const l = (lbl, t) => { const s = st(t); if (!s) { console.log("  " + lbl.padEnd(22) + "      —"); return; }
  console.log("  " + lbl.padEnd(22) + String(s.n).padStart(6) + s.wrg.toFixed(1).padStart(9) + "%" + String(s.gr).padStart(6)
    + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9) + (s.R / s.n).toFixed(3).padStart(8) + (s.gr < 40 ? "  ~" : "")); };
const vals = tirs.map((x) => x.kdOr).sort((a, b) => a - b);
const Q = (p) => vals[Math.floor(p * (vals.length - 1))];
const cuts = [Q(0.15), Q(0.35), Q(0.5), Q(0.65), Q(0.85)];
const bande = (v) => { for (let i = 0; i < cuts.length; i++) if (v < cuts[i]) return i; return cuts.length; };
const noms = [`< ${cuts[0].toFixed(1)}`, `${cuts[0].toFixed(1)} … ${cuts[1].toFixed(1)}`,
  `${cuts[1].toFixed(1)} … ${cuts[2].toFixed(1)}`, `${cuts[2].toFixed(1)} … ${cuts[3].toFixed(1)}`,
  `${cuts[3].toFixed(1)} … ${cuts[4].toFixed(1)}`, `> ${cuts[4].toFixed(1)}`];
console.log(`\n═══ PB · \`K − D\` ORIENTÉ ═══  ${tirs.length} tirs · point mort 75 % · ~ = <40 grappes`);
console.log(`  distribution : p15 ${Q(0.15).toFixed(1)} · médiane ${Q(0.5).toFixed(1)} · p85 ${Q(0.85).toFixed(1)}`);
console.log("\n  ① TRIE-T-IL SEUL ?   (négatif = le contre-mouvement pousse ENCORE contre nous)");
console.log("  bande kdOr              tirs  WR/grap  grap        R   R/tir");
for (let i = 0; i <= cuts.length; i++) l(noms[i], tirs.filter((x) => bande(x.kdOr) === i));
console.log("\n  ② OU NE FAIT-IL QUE REDIRE ΔK ?   (kdOr DANS chaque famille ΔK)");
for (const fam of ["DOWN", "FLAT", "UP"]) {
  const sub = tirs.filter((x) => x.p.colK === fam);
  if (!sub.length) continue;
  console.log(`  ── ΔK = ${fam}  (${sub.length} tirs)`);
  l("    kdOr < 0  (pousse)", sub.filter((x) => x.kdOr < 0));
  l("    kdOr ≥ 0  (tourne)", sub.filter((x) => x.kdOr >= 0));
}
