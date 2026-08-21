import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const rows = [];
for (const f of fs.readdirSync(D).filter(x => x.toLowerCase().endsWith(".csv")).sort()) {
  const a = f.replace(/\.csv$/i, "");
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) if (typeof s.R === "number") { s._asset = a; rows.push(s); }
}
const strong = rows.filter(s => s.profile === "Strong Bull" || s.profile === "Strong Bear");
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const agg = r => { const w = r.filter(s => s.outcome === "WIN").length, l = r.filter(s => s.outcome === "LOSS").length, R = r.reduce((x, s) => x + s.R, 0); return { n: r.length, wr: (w + l) ? w / (w + l) * 100 : 0, R, avg: r.length ? R / r.length : 0 }; };
const fmt = a => `n ${String(a.n).padStart(4)} · WR ${a.wr.toFixed(1).padStart(5)}% · avgR ${(a.avg>=0?"+":"")+a.avg.toFixed(3)} · R ${(a.R>=0?"+":"")+a.R.toFixed(1)}`;
const P = (label, r) => r.length ? console.log(`  ${label.padEnd(22)} ${fmt(agg(r))}`) : null;
const H = t => console.log(`\n### ${t}`);
const by = (fn, order) => { const g = {}; for (const s of strong) { const k = fn(s); if (k == null) continue; (g[k] ??= []).push(s); } const keys = order || Object.keys(g).sort(); for (const k of keys) if (g[k]) P(String(k), g[k]); };

console.log(`==== DISTRIBUTION DES STRONG (Strong Bull + Strong Bear) · n=${strong.length} · ${fmt(agg(strong))} ====`);
H("par profil"); by(s => s.profile);
H("par side"); by(s => s.side);
H("par type (CONT/EXH)"); by(s => s.type);
H("ADX H1 (bandes)"); by(s => { const a = num(s.adx); if (a == null) return null; return a < 25 ? "1·<25" : a < 34 ? "2·25-34" : a < 45 ? "3·34-45" : "4·≥45"; });
H("dominanceTurn"); by(s => s.dominanceTurn);
H("adxRegime"); by(s => s.adxRegime);
H("dAdx (accélère/ralentit)"); by(s => { const d = num(s.dAdx); if (d == null) return null; return d > 0.5 ? "monte" : d < -0.5 ? "descend" : "plat"; });
H("stage"); by(s => s.obs?.stage);
H("energyState"); by(s => s.obs?.energyState);
H("intensity"); by(s => s.obs?.intensity);
H("zone H1"); by(s => s.obs?.zone);
H("contact"); by(s => s.obs?.contact);
H("thetaDay"); by(s => s.obs?.thetaDay);
H("dailyForce"); by(s => s.obs?.dailyForce);
H("continuationDelta"); by(s => s.obs?.continuationDelta);
H("crossMat (maturité cross H1)"); by(s => s.crossMat);
H("crossState"); by(s => s.crossState);
H("score (bandes)"); by(s => { const a = num(s.score); if (a == null) return null; return a < 50 ? "1·<50" : a < 60 ? "2·50-60" : a < 70 ? "3·60-70" : "4·≥70"; });
