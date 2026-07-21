// ============================================================================================
// kd_div_cont_filter.mjs — EFFET du filtre CONT « convergence K/D » sur l'UNIVERS (spec KD §7-3).
// --------------------------------------------------------------------------------------------
// Ce qui TRANCHE : pas « la convergence prédit-elle un cross » (§7-2, oui) mais « stopper le CONT
//   dessus fait-il GAGNER de l'argent ». Un cross qui suit ne veut pas dire que le CONT perdait
//   (le TP a pu tomber avant). ⭐ Lire l'avgR À CÔTÉ du volume : un filtre qui coupe du volume sans
//   monter l'avgR ampute sans soigner.
//
// Filtre appliqué via opts.contGate (true = on JETTE ce fire CONT) — AUCUNE modif moteur.
//   Orienté par le sens du trade : L = sgn·(k−d), sgn=+1 BUY/−1 SELL. L>0 = le stoch CONFIRME.
//   Convergence = |gap| se referme (div<0). On teste closes-only vs live(s0), ± régularité, ± gap petit.
//
// Usage : node --max-old-space-size=12288 stats/kd_div_cont_filter.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return (v === "" || v == null || !Number.isFinite(n)) ? null : n; };
const GAP_LOW = 3.4;
const THK = 3.0;

// lit gap/div depuis une row ; renvoie null si données absentes
function kdOf(row) {
  const k = [0, 1, 2, 3].map((i) => num(row?.[`stoch_k_h1_s${i}`]));
  const d = [0, 1, 2, 3].map((i) => num(row?.[`stoch_d_h1_s${i}`]));
  if (k.some((x) => x == null) || d.some((x) => x == null)) return null;
  const g = k.map((kk, i) => kk - d[i]);          // signé
  return { g, gap: g.map(Math.abs), k };
}
// chaque variante : (row, sgn) => true = JETER
const V = {
  "closes: converge (divC0<0)": (o, s) => { const L1 = s * o.g[1]; const dC0 = o.gap[1] - o.gap[2]; return L1 > 0 && dC0 < 0; },
  "closes: converge régulier": (o, s) => { const L1 = s * o.g[1]; const dC0 = o.gap[1] - o.gap[2], dC1 = o.gap[2] - o.gap[3]; return L1 > 0 && dC0 < 0 && dC1 < 0; },
  "closes: converge & gap<LOW": (o, s) => { const L1 = s * o.g[1]; const dC0 = o.gap[1] - o.gap[2]; return L1 > 0 && dC0 < 0 && o.gap[1] < GAP_LOW; },
  "live s0 (Θk): converge": (o, s) => { const useS0 = Math.abs(o.k[0] - o.k[1]) >= THK; const L = s * o.g[useS0 ? 0 : 1]; const dv = useS0 ? o.gap[0] - o.gap[1] : o.gap[1] - o.gap[2]; return L > 0 && dv < 0; },
  "stoch DÉJÀ contre (L1≤0)": (o, s) => (s * o.g[1]) <= 0,
};
const gateFor = (fn) => (rows, i, sel) => { const o = kdOf(rows[i]); if (!o) return false; const sgn = sel.side === "BUY" ? 1 : -1; return fn(o, sgn); };

const mk = () => ({ n: 0, w: 0, l: 0, R: 0 });
const bump = (o, s) => { o.n++; o.R += s.R; if (s.outcome === "WIN") o.w++; else if (s.outcome === "LOSS") o.l++; };
function runUniverse(contGate) {
  const cont = mk(), exh = mk();
  for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
    for (const s of (runMatrixBacktest(path.join(D, f), contGate ? { contGate } : {}).signals || [])) {
      if (typeof s.R !== "number") continue;
      bump(s.type === "EXHAUSTION" ? exh : cont, s);
    }
  return { cont, exh };
}
const f3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
const f1 = (v) => (v >= 0 ? "+" : "") + v.toFixed(1);
const wr = (o) => (o.w + o.l) ? (o.w / (o.w + o.l) * 100).toFixed(0) + "%" : "—";
const line = (name, r) => {
  const tot = r.cont.n + r.exh.n, totR = r.cont.R + r.exh.R;
  console.log("  " + name.padEnd(30) + String(tot).padStart(6) + "  " + f1(totR).padStart(9) +
    "   | CONT " + String(r.cont.n).padStart(5) + " avgR " + f3(r.cont.R / r.cont.n) + " WR " + wr(r.cont) + "  " + f1(r.cont.R).padStart(8));
};
console.log(`EFFET UNIVERS — GAP_LOW=${GAP_LOW} Θk=${THK}\n`);
console.log("  variante                        signaux    totalR    | CONT");
const base = runUniverse(null); line("BASELINE (aucun filtre)", base);
for (const [name, fn] of Object.entries(V)) line(name, runUniverse(gateFor(fn)));
