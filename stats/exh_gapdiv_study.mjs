// ============================================================================================
// exh_gapdiv_study.mjs — ÉTUDE : gap/div améliorent-ils la QUALITÉ des EXH ? (owner 2026-07-21)
// --------------------------------------------------------------------------------------------
// PAS « le signal prédit-il un cross » (résolu). MESURE : la PERFORMANCE du moteur EXH.
// Caractérise la population EXH EXISTANTE par gap/div/cross. Aucune modif de décision — gap/div
//   sont une PHOTO passive (fireSnapshot). Métriques complètes par bucket.
//
// Usage : node --max-old-space-size=12288 stats/exh_gapdiv_study.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";

const EXH = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || []))
    if (s.type === "EXHAUSTION" && typeof s.R === "number") EXH.push(s);

// ── métriques complètes ──
function metrics(arr) {
  const n = arr.length;
  const w = arr.filter((s) => s.outcome === "WIN"), l = arr.filter((s) => s.outcome === "LOSS");
  const R = arr.reduce((a, s) => a + s.R, 0);
  const grossW = w.reduce((a, s) => a + s.R, 0), grossL = Math.abs(l.reduce((a, s) => a + s.R, 0));
  const dec = w.length + l.length;
  return {
    n, wr: dec ? w.length / dec : 0, avgR: n ? R / n : 0, R,
    exp: n ? R / n : 0,                                   // expectancy = R moyen par trade
    pf: grossL ? grossW / grossL : Infinity,
  };
}
const fmt = (m) => `n=${String(m.n).padStart(4)}  WR ${(m.wr * 100).toFixed(0).padStart(3)}%  avgR ${(m.avgR >= 0 ? "+" : "") + m.avgR.toFixed(3)}  PF ${m.pf === Infinity ? "∞" : m.pf.toFixed(2)}  totalR ${(m.R >= 0 ? "+" : "") + m.R.toFixed(1)}`;

console.log(`POPULATION EXH ENTIÈRE : ${fmt(metrics(EXH))}\n`);

const group = (label, keyFn, order) => {
  console.log(`── par ${label} ──`);
  const g = {};
  for (const s of EXH) { const k = keyFn(s); (g[k] ??= []).push(s); }
  const keys = order ? order.filter((k) => g[k]) : Object.keys(g).sort();
  for (const k of keys) console.log(`   ${String(k).padEnd(16)} ${fmt(metrics(g[k]))}`);
  console.log();
};

group("crossMat (maturité)", (s) => s.crossMat ?? "(null)", ["FRESH", "CONFIRMED", "STALLED", "(null)"]);
group("crossAge", (s) => s.crossAge ?? "(null)", [0, 1, 2, "(null)"]);
group("signe de div0", (s) => s.div0 == null ? "(null)" : s.div0 < 0 ? "div0<0 converge" : s.div0 > 0 ? "div0>0 diverge" : "div0=0");
group("div0 & div1", (s) => (s.div0 == null || s.div1 == null) ? "(null)" : (s.div0 < 0 && s.div1 < 0) ? "converge régulier" : (s.div0 > 0 && s.div1 > 0) ? "diverge régulier" : "mixte");
group("gap0 (écartement au tir)", (s) => s.gap0 == null ? "(null)" : s.gap0 < 3.4 ? "gap0<3.4 (proche)" : s.gap0 < 10 ? "gap0 3.4–10" : "gap0≥10 (écarté)", ["gap0<3.4 (proche)", "gap0 3.4–10", "gap0≥10 (écarté)", "(null)"]);
