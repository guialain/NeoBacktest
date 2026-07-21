// ============================================================================================
// kd_div_predictive.mjs — POUVOIR PRÉDICTIF de la convergence (spec KD §7-2).
// --------------------------------------------------------------------------------------------
// QUESTION : un état « div0<0 ET div1<0 [ET gap0 petit] » sur une CLÔTURE H1 précède-t-il un
//   CROSS (changement de signe de k−d) dans les 1..3 barres suivantes — mieux que le hasard ?
//
// MÉTHODE : série de clôtures H1 par actif (via s1 = close exact, indexé par heure snapshot).
//   Fenêtre de 4 barres CONSÉCUTIVES (diff = 1 h) → gap/div. Forward : signe de k−d s'inverse-t-il
//   dans i+1..i+H (barres consécutives) ? Baseline = taux de cross sur TOUTES les barres évaluables.
//   ⭐ Le seul denominateur honnête : les barres où on peut ET calculer le signal ET voir le futur.
//
// Usage : node --max-old-space-size=12288 stats/kd_div_predictive.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return (v === "" || v == null || !Number.isFinite(n)) ? null : n; };
const GAP_LOW = 3.4;   // candidat P25 (mesure §7-1)
const H = 3;

// série close H1 par actif : hourIdx → {k,d} (s1 = close de l'heure snapshot − 1)
const hourIdx = (ts) => { const s = String(ts).slice(0, 13).replace(/\./g, "-") + ":00:00"; const t = Date.parse(s); return Number.isFinite(t) ? Math.floor(t / 3600000) : null; };

const cats = {
  ALL: mk(), conv1: mk(), conv2: mk(), conv2_small: mk(), small_only: mk(),
};
function mk() { return { n: 0, x: [0, 0, 0] }; }   // x[h-1] = nb de cross dans H≤h

for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const L = fs.readFileSync(path.join(D, f), "utf8").trim().split(/\r?\n/);
  const Hh = L[0].split(";"); const ix = (n) => Hh.indexOf(n);
  const ik = ix("stoch_k_h1_s1"), id = ix("stoch_d_h1_s1"), iTs = ix("timestamp") >= 0 ? ix("timestamp") : 0;
  const series = new Map();   // hourIdx → g (signé)
  for (const line of L.slice(1)) {
    const r = line.split(";"); const k = num(r[ik]), d = num(r[id]); if (k == null || d == null) continue;
    const h = hourIdx(r[iTs]); if (h == null) continue;
    if (!series.has(h)) series.set(h, k - d);   // premier vu = ok, valeur close stable
  }
  const hrs = [...series.keys()].sort((a, b) => a - b);
  for (let p = 0; p < hrs.length; p++) {
    const h = hrs[p];
    // fenêtre 4 barres consécutives finissant à h
    const g = [0, 1, 2, 3].map((o) => series.get(h - o));
    if (g.some((x) => x === undefined)) continue;
    const gap = g.map(Math.abs);
    const div0 = gap[0] - gap[1], div1 = gap[1] - gap[2];
    const sgn = Math.sign(g[0]); if (sgn === 0) continue;
    // forward : cross dans h+1..h+H (consécutif)
    let crossedAt = null;
    for (let j = 1; j <= H; j++) { const gj = series.get(h + j); if (gj === undefined) break; if (Math.sign(gj) !== sgn) { crossedAt = j; break; } }
    // si on ne peut pas voir au moins h+1, on saute (pas de forward)
    if (series.get(h + 1) === undefined) continue;
    const bump = (c) => { c.n++; if (crossedAt) for (let j = crossedAt; j <= H; j++) c.x[j - 1]++; };
    bump(cats.ALL);
    if (div0 < 0) bump(cats.conv1);
    if (div0 < 0 && div1 < 0) bump(cats.conv2);
    if (div0 < 0 && div1 < 0 && gap[0] < GAP_LOW) bump(cats.conv2_small);
    if (gap[0] < GAP_LOW) bump(cats.small_only);
  }
}
console.log(`P(cross dans H≤n barres H1) — GAP_LOW=${GAP_LOW}\n`);
console.log("  état                          n      H≤1      H≤2      H≤3");
const pc = (c, h) => c.n ? (c.x[h] / c.n * 100).toFixed(0) + "%" : "—";
const lbl = { ALL: "BASELINE (toutes)", conv1: "div0<0 (1 barre)", conv2: "div0<0 & div1<0 (régulier)", conv2_small: "régulier & gap0<LOW", small_only: "gap0<LOW seul (proche)" };
for (const k of ["ALL", "conv1", "conv2", "small_only", "conv2_small"]) {
  const c = cats[k];
  console.log("  " + lbl[k].padEnd(28) + String(c.n).padStart(6) + "   " + pc(c, 0).padStart(6) + "   " + pc(c, 1).padStart(6) + "   " + pc(c, 2).padStart(6));
}
