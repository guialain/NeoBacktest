// EXH par BANDE d'ADX fine (owner 2026-07-21) — l'ADX TRÈS BAS a-t-il une signature propre ?
//   Range (ADX bas) = mean-reversion (fade marche) OU hachures (crosses = bruit) ? La mesure tranche.
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const EXH = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || []))
    if (s.type === "EXHAUSTION" && typeof s.R === "number" && s.adx != null) EXH.push(s);
const EDG = [0, 10, 12, 15, 18, 21, 25, 30, 35, 40, 999];
const lab = (a) => { for (let i = 0; i < EDG.length - 1; i++) if (a < EDG[i + 1]) return `${EDG[i]}–${EDG[i + 1]}`; return "40+"; };
const B = {};
for (const s of EXH) { const k = lab(s.adx); (B[k] ??= []).push(s); }
function met(a) {
  const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0);
  const gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0));
  return `n=${String(a.length).padStart(4)}  WR ${((w / (w + l)) * 100 || 0).toFixed(1).padStart(4)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  PF ${gL ? (gW / gL).toFixed(2) : "∞"}  totalR ${(R >= 0 ? "+" : "") + R.toFixed(1)}`;
}
console.log(`EXH par bande d'ADX H1 (n=${EXH.length}, moteur 218025c seuil 40)\n`);
for (let i = 0; i < EDG.length - 1; i++) { const k = `${EDG[i]}–${EDG[i + 1]}`; if (!B[k]) continue; console.log(`  ADX ${k.padEnd(8)} ${met(B[k])}`); }
if (B["40+"]) console.log(`  ADX ${"40+".padEnd(8)} ${met(B["40+"])}   (régime forte tendance : cross + confirmation)`);
