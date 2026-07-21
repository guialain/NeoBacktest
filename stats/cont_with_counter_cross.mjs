// PRÉMISSE OWNER : des EXH bloqués (ΔADX trop exigeant) restent CONT et échouent.
// Test sans modif moteur : parmi les CONT, ceux qui portent un CROSS CONTRAIRE (retournement
//   ignoré) échouent-ils plus ? et est-ce l'ADX qui a bloqué l'exh ?
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const CONT = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || []))
    if (s.type !== "EXHAUSTION" && typeof s.R === "number") CONT.push(s);
function met(a) {
  const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0);
  const gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0));
  return `n=${String(a.length).padStart(4)}  WR ${((w / (w + l)) * 100 || 0).toFixed(1)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  PF ${gL ? (gW / gL).toFixed(2) : "∞"}  totalR ${(R >= 0 ? "+" : "") + R.toFixed(1)}`;
}
// cross CONTRAIRE au trade = un retournement que le CONT ignore
const counter = (s) => (s.side === "SELL" && s.crossState === "CROSS_UP") || (s.side === "BUY" && s.crossState === "CROSS_DOWN");
// l'arbre exh aurait produit un événement (cross + maturité + age≠1)
const exhEvent = (s) => counter(s) && (s.crossMat === "FRESH" || s.crossMat === "CONFIRMED") && s.crossAge !== 1;
console.log("CONT ENTIER :", met(CONT), "\n");
console.log("── par présence d'un cross CONTRAIRE ──");
console.log("  aucun cross contraire :", met(CONT.filter((s) => !counter(s))));
console.log("  cross contraire       :", met(CONT.filter((s) => counter(s))));
console.log("\n── CONT à cross contraire = ÉVÉNEMENT exh (age≠1) — split par ΔADX ──");
const ev = CONT.filter(exhEvent);
console.log("  ÉVÉNEMENT exh total   :", met(ev));
console.log("    ΔADX ≤ −1.8 (exh aurait pu tirer, bloqué par score/zone) :", met(ev.filter((s) => s.dAdx != null && s.dAdx <= -1.8)));
console.log("    ΔADX > −1.8 (exh BLOQUÉ par la porte ADX) :", met(ev.filter((s) => s.dAdx != null && s.dAdx > -1.8)));
console.log("\n── ces CONT bloqués-par-ADX, par NIVEAU d'ADX (l'hypothèse : bas = ADX inutile) ──");
const blocked = ev.filter((s) => s.dAdx != null && s.dAdx > -1.8);
for (const [lbl, pred] of [["ADX < 25", (s) => s.adx < 25], ["ADX 25–35", (s) => s.adx >= 25 && s.adx < 35], ["ADX ≥ 35", (s) => s.adx >= 35]])
  console.log("  " + lbl.padEnd(10) + ":", met(blocked.filter((s) => s.adx != null && pred(s))));
