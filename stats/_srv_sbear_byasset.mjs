// Strong Bear (SELL CONT, LATE_BUY) DÉTAIL PAR ACTIF — via serveur (jamais standalone).
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const rows = [];
let W = 0, L = 0, R = 0, N = 0;
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const s = (j.signals || []).filter(x => x.profile === "Strong Bear" && typeof x.R === "number");
  if (!s.length) continue;
  const w = s.filter(x => x.outcome === "WIN").length, l = s.filter(x => x.outcome === "LOSS").length;
  const r = s.reduce((acc, x) => acc + x.R, 0);
  rows.push({ a, n: s.length, w, l, wr: (w + l) ? 100 * w / (w + l) : 0, R: r, avg: r / s.length,
    trades: s.map(x => `${x.tsMT.slice(5, 16)} ${x.outcome[0]} ${(x.R >= 0 ? "+" : "") + x.R.toFixed(2)}`) });
  W += w; L += l; R += r; N += s.length;
}
rows.sort((x, y) => x.R - y.R);
console.log("─── Strong Bear (SELL, LATE_BUY) par actif ───");
for (const r of rows)
  console.log(`${r.a.padEnd(12)} WR ${r.wr.toFixed(0).padStart(3)}%  n ${String(r.n).padStart(2)}  W${r.w}/L${r.l}  R ${((r.R >= 0 ? "+" : "") + r.R.toFixed(1)).padStart(6)}  avgR ${r.avg.toFixed(3)}`);
console.log("─".repeat(60));
console.log(`TOTAL  WR ${(100 * W / (W + L)).toFixed(1)}%  n ${N}  W${W}/L${L}  R ${(R >= 0 ? "+" : "") + R.toFixed(1)}  avgR ${(R / N).toFixed(3)}`);
console.log("\n─── trades détaillés (perdants d'abord) ───");
for (const r of rows.filter(x => x.R < 0)) console.log(`${r.a}: ${r.trades.join(" | ")}`);
for (const r of rows.filter(x => x.R >= 0)) console.log(`${r.a}: ${r.trades.join(" | ")}`);
