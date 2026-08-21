// WR / avgR / totalR / DD par ACTIF sur le moteur actuel (5d91b17) — comparaison inter-actifs.
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const rows = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const a = f.replace(/\.csv$/i, "");
  const sig = (runMatrixBacktest(path.join(D, f)).signals || []).filter((s) => typeof s.R === "number");
  const cont = sig.filter((s) => s.type !== "EXHAUSTION"), exh = sig.filter((s) => s.type === "EXHAUSTION");
  const w = sig.filter((s) => s.outcome === "WIN").length, l = sig.filter((s) => s.outcome === "LOSS").length;
  const R = sig.reduce((x, s) => x + s.R, 0), gW = sig.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(sig.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0));
  const sorted = sig.slice().sort((x, y) => String(x.tsMT).localeCompare(String(y.tsMT))); let c = 0, p = 0, dd = 0; for (const s of sorted) { c += s.R; p = Math.max(p, c); dd = Math.max(dd, p - c); }
  rows.push({ a, n: sig.length, wr: w / (w + l) * 100, avgR: R / sig.length, R, pf: gL ? gW / gL : Infinity, dd, contWr: cont.length ? cont.filter((s) => s.outcome === "WIN").length / (cont.filter((s) => s.outcome === "WIN").length + cont.filter((s) => s.outcome === "LOSS").length) * 100 : 0, exhWr: exh.length ? exh.filter((s) => s.outcome === "WIN").length / (exh.filter((s) => s.outcome === "WIN").length + exh.filter((s) => s.outcome === "LOSS").length) * 100 : 0, exhN: exh.length });
}
rows.sort((x, y) => y.R - x.R);
const f1 = (v) => (v >= 0 ? "+" : "") + v.toFixed(1);
console.log("actif          n     WR     avgR    PF    totalR   maxDD  | WR-cont WR-exh (nEXH)");
let TR = 0, TN = 0;
for (const r of rows) { TR += r.R; TN += r.n;
  console.log(`${r.a.padEnd(12)}${String(r.n).padStart(5)}  ${r.wr.toFixed(1).padStart(5)}%  ${f1(r.avgR*1000)/1000>=0?"+":""}${r.avgR.toFixed(3)}  ${(r.pf===Infinity?"∞":r.pf.toFixed(2)).padStart(4)}  ${f1(r.R).padStart(7)}  ${r.dd.toFixed(1).padStart(5)}  |  ${r.contWr.toFixed(1).padStart(5)}%  ${r.exhWr.toFixed(0).padStart(3)}% (${r.exhN})`); }
console.log(`\nUNIVERS : n=${TN} · totalR ${f1(TR)} · WR moyen pondéré = voir family_baseline`);
