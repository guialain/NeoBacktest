// _pb_k_brut.mjs — LA POPULATION PB PAR CÔTÉ × ZONE DE `%K` **BRUT** (pas orienté).
//
// ⭐⭐⭐ POURQUOI EN BRUT ALORS QUE LE BARÈME NOTE EN ORIENTÉ. Owner : « pullback sell + extrême
//   low, c'est à oublier ». Dit en `kOr`, ce cas s'appelle `kOr XHIGH` — l'orientation retourne
//   l'échelle (`kOr = 100 − k` au SELL). Une fiche en `kOr` oblige donc l'opérateur à retourner
//   chaque lecture dans sa tête, et c'est exactement comme ça qu'on finit par désigner la mauvaise
//   colonne en pensant la bonne. ⇒ **On mesure dans le repère où la règle est ÉNONCÉE.**
// ⚠ Le barème, lui, garde `kOr` : c'est ce qui évite une seconde table miroir. Les deux repères
//   coexistent — ce qui doit être explicite, c'est LEQUEL est affiché.
//
// ⚠ Une voix par grappe actif×jour. `~` = moins de 40 grappes, on n'y écrit rien.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1"; process.env.PB_ISOLE = "1"; process.env.MIN_PB = "-31";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/";
const { readVetoTfs } = await import(M + "vetoGate.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const T = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const actif = path.basename(f, ".csv"), CSV = path.join(DIR, f);
  const L = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/), head = L[0].split(";");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"), o = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = c[i]; rows.set(o.timestamp, o); }
  for (const s of (runMatrixBacktest(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals ?? [])) {
    if (s.strategy !== "PB" || (s.outcome !== "WIN" && s.outcome !== "LOSS")) continue;
    const row = rows.get(s.tsMT); if (!row) continue;
    const v = readVetoTfs(row);
    const kBrut = v.h1?.kClosed ?? null;          // %K H1 À LA CLÔTURE, NON orienté
    if (kBrut == null) continue;
    T.push({ ...s, actif, kBrut, cur: v.h1?.kdCur ?? null, prev: v.h1?.kdPrev ?? null });
  }
}
// Coupes PARTAGÉES de `stochZone` (12 / 38 / 62 / 88) — aucune frontière neuve.
const ZONES = [[0, 12, "EXTREME_LOW"], [12, 38, "LOW"], [38, 62, "MID"],
               [62, 88, "HIGH"], [88, 101, "EXTREME_HIGH"]];
const jour = (s) => String(s.tsMT).slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const R = t.reduce((a, b) => a + (b.R || 0), 0), g = new Map();
  for (const x of t) { const k = x.actif + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length, R }; };
const ligne = (lbl, t) => { const q = st(t);
  if (!q) { console.log("  " + lbl.padEnd(30) + "       0"); return; }
  console.log("  " + lbl.padEnd(30) + String(q.n).padStart(6) + String(q.gr).padStart(7)
    + q.wrg.toFixed(1).padStart(9) + "%" + ((q.R >= 0 ? "+" : "") + q.R.toFixed(1)).padStart(9)
    + (q.R / q.n).toFixed(3).padStart(8) + (q.gr < 40 ? "  ~" : "")); };

console.log(`\n═══ PB · CÔTÉ × ZONE DE %K BRUT (clôture H1) ═══  ${T.length} tirs · point mort 75,0 %`);
for (const side of ["SELL", "BUY"]) {
  const S = T.filter((x) => x.side === side);
  console.log(`\n  ── PB ${side}   (${S.length} tirs)              tirs   grap  WR/grap        R   R/tir`);
  for (const [lo, hi, nom] of ZONES) ligne("     %K " + nom, S.filter((x) => x.kBrut >= lo && x.kBrut < hi));
}
// ⭐ LE CAS DE L'OWNER, ISOLÉ — et son MIROIR, parce que la charge de la preuve est sur l'asymétrie.
console.log("\n  ── LE CAS NOMMÉ, ET SON MIROIR ────────────────────────────────────────────────");
ligne("PB SELL × %K EXTREME_LOW", T.filter((x) => x.side === "SELL" && x.kBrut < 12));
ligne("PB BUY  × %K EXTREME_HIGH", T.filter((x) => x.side === "BUY" && x.kBrut >= 88));
console.log("  ── témoins ──");
ligne("PB SELL × tout le reste", T.filter((x) => x.side === "SELL" && x.kBrut >= 12));
ligne("PB BUY  × tout le reste", T.filter((x) => x.side === "BUY" && x.kBrut < 88));
ligne("TOUS", T);
