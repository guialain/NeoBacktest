// _pb_adx_utile.mjs — L'ENTREE ③ `adxDominance` APPORTE-T-ELLE QUELQUE CHOSE AU PULLBACK ?
//
// ⭐⭐⭐ DEUX LECTURES, ET IL FAUT LES DEUX. « Trie-t-elle ? » et « le bareme perd-il si on la
//   retire ? » ne sont PAS la meme question : un capteur peut trier SEUL et ne rien ajouter (il
//   redit ce que les autres disent), ou etre nul SEUL et porter une part du tri en interaction.
// ⚠ AUCUN CONDITIONNEMENT SUR LE SEUIL (`MIN_PB` tres bas) : au-dessus d'un seuil les termes du
//   score sont anti-correles (collider), et une classe y paraitrait bonne parce qu'elle a ete
//   COMPENSEE par les autres. On lit la population ENTIERE de la boite.
// ⚠ Une voix par grappe actif x jour.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1"; process.env.PB_ISOLE = "1"; process.env.MIN_PB = "-31";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/";
const { pbScoreV1 } = await import(M + "pbScoringV1.js");
const { readVetoTfs } = await import(M + "vetoGate.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const tirs = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const actif = path.basename(f, ".csv"), CSV = path.join(DIR, f);
  const L = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/), head = L[0].split(";");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"), o = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = c[i]; rows.set(o.timestamp, o); }
  const r = runMatrixBacktest(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals ?? [])) {
    if (s.strategy !== "PB" || (s.outcome !== "WIN" && s.outcome !== "LOSS")) continue;
    const row = rows.get(s.tsMT); if (!row) continue;
    const v = readVetoTfs(row), zC = num(row.zscore_h1), zL = num(row.zscore_h1_s0);
    const res = pbScoreV1({ zH1Closed: zC, dZH1Live: (zC != null && zL != null) ? zL - zC : null,
      kH1Closed: v.h1?.kClosed ?? null, dKBandH1Live: v.h1?.dKBand ?? null,
      diGapBandH1Live: v.h1?.gapBand ?? null, highD1Live: num(row.high_d1_s0),
      lowD1Live: num(row.low_d1_s0), prixLive: num(row.price), side: s.side });
    tirs.push({ ...s, actif, p: res.parts, tot: res.total });
  }
}
const jour = (s) => String(s.tsMT).slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const w = t.filter((x) => x.outcome === "WIN").length, R = t.reduce((a, b) => a + (b.R || 0), 0);
  const g = new Map();
  for (const x of t) { const k = x.actif + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, wr: 100 * w / t.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           gr: v.length, R, rt: R / t.length }; };
const ligne = (lbl, t) => { const s = st(t); if (!s) { console.log("  " + lbl.padEnd(18) + "     —"); return; }
  console.log("  " + lbl.padEnd(18) + String(s.n).padStart(6) + s.wr.toFixed(1).padStart(8) + "%"
    + s.wrg.toFixed(1).padStart(9) + "%" + String(s.gr).padStart(6)
    + (s.R >= 0 ? "+" : "") + s.R.toFixed(1).padStart(8) + s.rt.toFixed(3).padStart(8)); };

console.log(`\n═══ PB · L'ENTREE ③ adxDominance ═══   ${tirs.length} tirs · point mort 75,0 %`);
console.log("\n  ① TRIE-T-ELLE SEULE ?  (population ENTIERE, aucun seuil)");
console.log("  classe                tirs   WR/tir  WR/grap  grap        R   R/tir");
for (const c of ["STRONG_PORTEUR", "SOLID_PORTEUR", "WEAK_PORTEUR", "BALANCED", "WEAK_CONTRE", "SOLID_CONTRE", "STRONG_CONTRE"])
  ligne(c, tirs.filter((x) => x.p.domi === c));
ligne("— muette —", tirs.filter((x) => x.p.domi == null));
console.log("\n  ② LE BAREME PERD-IL SI ON LA RETIRE ?  (score z+k seul, contre z+k+di)");
const courbe = (f, lbl) => {
  let best = null;
  for (let s = -25; s <= 26; s++) { const t = tirs.filter((x) => f(x) != null && f(x) >= s);
    const q = st(t); if (q && (!best || q.R > best.R)) best = { s, ...q }; }
  console.log("  " + lbl.padEnd(18) + String(best.n).padStart(6) + best.wr.toFixed(1).padStart(8) + "%"
    + best.wrg.toFixed(1).padStart(9) + "%" + String(best.gr).padStart(6)
    + (best.R >= 0 ? "+" : "") + best.R.toFixed(1).padStart(8) + best.rt.toFixed(3).padStart(8) + `   au seuil ≥${best.s}`); };
console.log("  version               tirs   WR/tir  WR/grap  grap        R   R/tir");
courbe((x) => x.tot, "z + k + di");
courbe((x) => (x.p.z ?? 0) + (x.p.k ?? 0), "z + k  (sans di)");
courbe((x) => x.p.di, "di SEULE");
// ⭐ LA VERSION QUI GARDE CE QUI MARCHE : la seule classe qui trie, en tout-ou-rien. On balaye son
//   amplitude — si le meilleur reglage est 0, l'entree ne merite meme pas sa forme binaire.
for (const amp of [10, 6, 3])
  courbe((x) => (x.p.z ?? 0) + (x.p.k ?? 0) + (x.p.domi === "STRONG_PORTEUR" ? amp : 0), `z + k + STRONG(+${amp})`);
console.log("  ⚠ « meilleur seuil » = argmax par version. Les comparaisons ci-dessus tombent TOUTES sur ≥3,");
console.log("     donc elles se lisent a seuil EGAL — c'est ce qui les rend solides, pas l'argmax.");
