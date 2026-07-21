// Trou noir ADX [15,18) — qu'est-ce qui sépare gagnants/perdants ? (owner : raffiner, pas bloquer)
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const DB = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || []))
    if (s.type === "EXHAUSTION" && typeof s.R === "number" && s.adx != null && s.adx >= 15 && s.adx < 18) DB.push(s);
function met(a) { if (!a.length) return "—"; const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0), gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0)); return `n=${String(a.length).padStart(3)}  WR ${((w / (w + l)) * 100 || 0).toFixed(0).padStart(3)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  PF ${gL ? (gW / gL).toFixed(2) : "∞"}  R ${(R >= 0 ? "+" : "") + R.toFixed(1)}`; }
console.log(`TROU NOIR ADX [15,18) : ${met(DB)}\n`);
const split = (lbl, keyFn, order) => { console.log(`── ${lbl} ──`); const g = {}; for (const s of DB) { const k = keyFn(s); (g[k] ??= []).push(s); } const keys = order ? order.filter((k) => g[k]) : Object.keys(g).sort(); for (const k of keys) console.log(`   ${String(k).padEnd(20)} ${met(g[k])}`); console.log(); };
split("signe de div0", (s) => s.div0 == null ? "(null)" : s.div0 < 0 ? "div0<0 converge" : "div0≥0 diverge");
split("gap0", (s) => s.gap0 == null ? "(null)" : s.gap0 < 5 ? "gap0<5 (frôle)" : s.gap0 < 10 ? "gap0 5–10" : "gap0≥10", ["gap0<5 (frôle)", "gap0 5–10", "gap0≥10"]);
split("zone", (s) => s.obs?.zone ?? s.zoneH1 ?? "?");
split("maturité", (s) => s.crossMat ?? "?", ["FRESH", "CONFIRMED"]);
split("crossAge", (s) => s.crossAge ?? "?", [0, 2]);
split("côté", (s) => s.side);
split("intraday régime", (s) => s.forceRegime ?? "?");
