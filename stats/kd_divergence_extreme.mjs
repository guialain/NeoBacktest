// ============================================================================================
// kd_divergence_extreme.mjs — HYPOTHÈSE OWNER (2026-07-20) : « il manque l'état K/D DIVERGENT À
//   L'EXTRÊME — c'est lui qui permet de détecter les cross À VENIR ».
// --------------------------------------------------------------------------------------------
// LE MANQUE : `crossoverState` ne voit qu'un cross DÉJÀ ARRIVÉ. Cas COCOA 07/07 12:14 — %K 10,74,
//   %D 31,66 (écart 20,9), zone EXTREME_BASSE, ADX EXTREME qui tourne : tout dit « le bas est
//   étiré, ça va recroiser », et le moteur vend en CONTINUATION parce qu'aucun cross n'a eu lieu.
//
// DEUX QUESTIONS SÉPARÉES — ne pas les confondre :
//   A. PRÉDICTION  un |K−D| large À L'EXTRÊME annonce-t-il un cross dans les barres qui suivent ?
//      (si non, l'état ne « détecte pas les cross futurs », il décrit juste un étirement)
//   B. RENDEMENT   ce même état dégrade-t-il le CONT pris dans le sens de l'étirement ?
//      (c'est ça qui justifierait une PORTE, indépendamment de A)
//
// ⚠️ SIGNE : on mesure `stretch` = (K − D) ORIENTÉ vers l'extrême où l'on est. En zone BASSE, K
//   sous D (K−D < 0) = étirement baissier. Miroir en zone HAUTE. Un |K−D| non signé mélangerait
//   « étiré vers le bas » et « rebond déjà entamé » — deux états opposés.
//
// Usage : node --max-old-space-size=12288 stats/kd_divergence_extreme.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const mk = () => ({ n: 0, w: 0, l: 0, R: 0 });
const bump = (o, s) => { o.n++; o.R += s.R; if (s.outcome === "WIN") o.w++; else if (s.outcome === "LOSS") o.l++; };
const f3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
const wr = (o) => (o.w + o.l) ? (o.w / (o.w + o.l) * 100).toFixed(0) + "%" : "—";

// ── A. POUVOIR PRÉDICTIF, sur les barres H1 CLOSES (une par heure, dédupliquée) ────────────────
const HOR = 3;                       // horizon : un cross dans les 3 barres H1 suivantes ?
const EDG = [0, 5, 10, 15, 20, 30, 999];
const lab = (v) => { for (let i = 0; i < EDG.length - 1; i++) if (v < EDG[i + 1]) return `${EDG[i]}–${EDG[i + 1]}`; return "30+"; };
const pred = {};                     // `${bucket}|${zone}` → {n, crossed}
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const L = fs.readFileSync(path.join(D, f), "utf8").trim().split(/\r?\n/);
  const H = L[0].split(";"); const ix = (n) => H.indexOf(n);
  const seen = new Set(); const bars = [];
  for (const line of L.slice(1)) {
    const r = line.split(";");
    const ts = String(r[ix("timestamp")] ?? r[0]); const hk = ts.slice(0, 13);
    if (seen.has(hk)) continue; seen.add(hk);
    const k = num(r[ix("stoch_k_h1_s0")]), d = num(r[ix("stoch_d_h1_s0")]);
    if (k === null || d === null) continue;
    bars.push({ k, d, gap: k - d });
  }
  for (let i = 0; i < bars.length - HOR; i++) {
    const b = bars[i];
    // extrême + étirement DANS le sens de l'extrême
    let zone = null;
    if (b.k < 20 && b.gap < 0) zone = "BAS étiré";
    else if (b.k > 80 && b.gap > 0) zone = "HAUT étiré";
    if (!zone) continue;
    const key = `${lab(Math.abs(b.gap))}|${zone}`;
    pred[key] = pred[key] || { n: 0, crossed: 0 };
    pred[key].n++;
    // un cross = le signe de (k−d) s'inverse dans les HOR barres suivantes
    for (let j = i + 1; j <= i + HOR; j++) if (Math.sign(bars[j].gap) !== Math.sign(b.gap)) { pred[key].crossed++; break; }
  }
}
console.log(`A. UN |K−D| LARGE À L'EXTRÊME ANNONCE-T-IL UN CROSS DANS LES ${HOR} BARRES H1 SUIVANTES ?\n`);
console.log("   |K−D|      BAS étiré (K<20, K<D)      HAUT étiré (K>80, K>D)");
for (let i = 0; i < EDG.length - 1; i++) {
  const L2 = `${EDG[i]}–${EDG[i + 1]}`;
  const a = pred[`${L2}|BAS étiré`], b = pred[`${L2}|HAUT étiré`];
  if (!a && !b) continue;
  const c = (o) => o ? `${(o.crossed / o.n * 100).toFixed(0)}% de cross / n=${String(o.n).padStart(4)}` : "—".padStart(24);
  console.log(`   ${L2.padEnd(8)}  ${c(a).padEnd(28)} ${c(b)}`);
}

// ── B. RENDEMENT du CONT pris DANS le sens de l'étirement ──────────────────────────────────────
const G = {};
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (typeof s.R !== "number" || s.type === "EXHAUSTION") continue;
    const k = s.kH1, gap = s.kdH1;
    if (k == null || gap == null) continue;
    let zone = null;
    if (k < 20 && gap < 0 && s.side === "SELL") zone = "SELL dans un BAS étiré";
    else if (k > 80 && gap > 0 && s.side === "BUY") zone = "BUY dans un HAUT étiré";
    if (!zone) continue;
    const key = `${lab(Math.abs(gap))}|${zone}`;
    G[key] = G[key] || mk(); bump(G[key], s);
  }
console.log(`\n\nB. LE CONT PRIS DANS LE SENS DE L'ÉTIREMENT — avgR / n / WR\n`);
console.log("   |K−D|      SELL dans un BAS étiré        BUY dans un HAUT étiré");
let tot = mk();
for (let i = 0; i < EDG.length - 1; i++) {
  const L2 = `${EDG[i]}–${EDG[i + 1]}`;
  const a = G[`${L2}|SELL dans un BAS étiré`], b = G[`${L2}|BUY dans un HAUT étiré`];
  if (!a && !b) continue;
  const c = (o) => o ? `${f3(o.R / o.n)} / ${String(o.n).padStart(4)} / ${wr(o).padStart(3)}` : "—".padStart(20);
  console.log(`   ${L2.padEnd(8)}  ${c(a).padEnd(30)} ${c(b)}`);
  for (const o of [a, b]) if (o) { tot.n += o.n; tot.R += o.R; tot.w += o.w; tot.l += o.l; }
}
console.log(`\n   TOTAL de ces CONT : n=${tot.n} · WR ${wr(tot)} · avgR ${f3(tot.R / tot.n)} · totalR ${tot.R.toFixed(1)}`);
