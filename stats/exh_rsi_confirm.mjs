// EXH × RSI H1 (owner 2026-07-21) : le RSI confirme-t-il le fade ? momentum (ΔRSI) ET niveau.
//   SELL EXH (fade top) : bon si RSI HAUT et/ou ΔRSI<0 (momentum cède). BUY EXH miroir.
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const EXH = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || []))
    if (s.type === "EXHAUSTION" && typeof s.R === "number" && s.rsiH1 != null && s.dRsiH1 != null) EXH.push(s);
function met(a) { if (!a.length) return "n=0"; const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0), gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0)); return `n=${String(a.length).padStart(4)}  WR ${((w / (w + l)) * 100 || 0).toFixed(0).padStart(3)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  PF ${gL ? (gW / gL).toFixed(2) : "∞"}  R ${(R >= 0 ? "+" : "") + R.toFixed(1)}`; }
console.log("EXH total :", met(EXH), "\n");
// ΔRSI orienté fade : SELL veut RSI qui BAISSE (dRsi<0) · BUY veut RSI qui MONTE (dRsi>0)
const drsiConfirm = (s) => (s.side === "SELL" ? -s.dRsiH1 : s.dRsiH1);   // >0 = confirme le fade
console.log("── ΔRSI orienté fade (>0 = le momentum RSI CONFIRME le retournement) ──");
for (const [lbl, pred] of [["confirme fort (>+2)", (v) => v > 2], ["confirme (0..2)", (v) => v > 0 && v <= 2], ["CONTRE (−2..0)", (v) => v > -2 && v <= 0], ["CONTRE fort (≤−2)", (v) => v <= -2]])
  console.log("  " + lbl.padEnd(20) + met(EXH.filter((s) => pred(drsiConfirm(s)))));
// niveau RSI orienté fade : SELL veut RSI HAUT (vrai surachat) · BUY veut RSI BAS (vrai survente)
const rsiExtreme = (s) => (s.side === "SELL" ? s.rsiH1 : 100 - s.rsiH1);   // haut = fade à un vrai extrême
console.log("\n── NIVEAU RSI orienté fade (haut = on fade un VRAI extrême RSI) ──");
for (const [lbl, pred] of [["RSI extrême (≥65)", (v) => v >= 65], ["RSI fort (55-65)", (v) => v >= 55 && v < 65], ["RSI mou (45-55)", (v) => v >= 45 && v < 55], ["RSI PAS extrême (<45)", (v) => v < 45]])
  console.log("  " + lbl.padEnd(22) + met(EXH.filter((s) => pred(rsiExtreme(s)))));
