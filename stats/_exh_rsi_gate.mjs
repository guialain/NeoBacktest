import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return (v === "" || v == null || !Number.isFinite(n)) ? null : n; };
const hourIdx = (ts) => { const t = Date.parse(String(ts).slice(0, 13).replace(/\./g, "-") + ":00:00"); return Number.isFinite(t) ? Math.floor(t / 3600000) : null; };
function collect(useGate, THR) {
  const byM = {}, all = [];
  for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
    const L = fs.readFileSync(path.join(D, f), "utf8").trim().split(/\r?\n/);
    const Hh = L[0].split(";"); const ix = (n) => Hh.indexOf(n); const iR = ix("rsi_h1_s0"), iTs = ix("timestamp") >= 0 ? ix("timestamp") : 0;
    const rsiByHour = new Map();
    for (const line of L.slice(1)) { const r = line.split(";"); const rv = num(r[iR]); if (rv == null) continue; const h = hourIdx(r[iTs]); if (h != null) rsiByHour.set(h, rv); }
    // exhGate spécifique au fichier : WAIT si trend RSI 4 barres CONTRE le fade ≤ THR
    const gate = useGate ? (rows, i, sel) => {
      const h = hourIdx(rows[i]?.[Hh[iTs]] ?? rows[i]?.timestamp); if (h == null) return false;
      const s0 = rsiByHour.get(h), s3 = rsiByHour.get(h - 3); if (s0 == null || s3 == null) return false;
      const net = sel.side === "SELL" ? -(s0 - s3) : (s0 - s3);
      return net <= THR;
    } : null;
    for (const s of (runMatrixBacktest(path.join(D, f), gate ? { exhGate: gate } : {}).signals || [])) {
      if (typeof s.R !== "number") continue; all.push(s); const mo = String(s.tsMT).slice(0, 7); byM[mo] = (byM[mo] || 0) + s.R;
    }
  }
  const R = all.reduce((x, s) => x + s.R, 0), w = all.filter((s) => s.outcome === "WIN").length, l = all.filter((s) => s.outcome === "LOSS").length;
  const sorted = all.sort((a, b) => String(a.tsMT).localeCompare(String(b.tsMT))); let c = 0, p = 0, dd = 0; for (const s of sorted) { c += s.R; p = Math.max(p, c); dd = Math.max(dd, p - c); }
  return { R, dd, n: all.length, wr: w / (w + l), byM };
}
const b = collect(false);
console.log(`BASELINE : n=${b.n} totalR ${(b.R>=0?"+":"")+b.R.toFixed(1)} WR ${(b.wr*100).toFixed(1)}% maxDD ${b.dd.toFixed(1)} R/DD ${(b.R/b.dd).toFixed(1)}`);
for (const THR of [-5, -3]) {
  const g = collect(true, THR);
  const dm = Object.keys(b.byM).sort().map((m) => m + " " + ((g.byM[m]||0)-b.byM[m]>=0?"+":"") + ((g.byM[m]||0)-b.byM[m]).toFixed(1)).join(" · ");
  console.log(`WAIT si trend RSI ≤ ${THR} : n=${g.n} totalR ${(g.R>=0?"+":"")+g.R.toFixed(1)} (ΔR ${(g.R-b.R>=0?"+":"")+(g.R-b.R).toFixed(1)}) WR ${(g.wr*100).toFixed(1)}% maxDD ${g.dd.toFixed(1)} R/DD ${(g.R/g.dd).toFixed(1)} · ΔR/mois ${dm}`);
}
