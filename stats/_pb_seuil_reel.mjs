// _pb_seuil_reel.mjs — LES DEUX COTES TIRENT-ILS A UN SEUIL REEL ?
// 🔴🔥⭐⭐⭐ Les sondes tournent a `MIN_PB=-31`, ou TOUT tire quel que soit le signe. Un defaut de
//   SIGNE y est donc STRICTEMENT INVISIBLE. Toute modif touchant le signe se verifie ICI.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1"; process.env.PB_ISOLE = "1";
process.env.MIN_PB = process.env.MIN_PB ?? "3";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let pb = [], exh = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")))
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals ?? [])) {
    if (s.outcome !== "WIN" && s.outcome !== "LOSS") continue;
    (s.strategy === "PB" ? pb : s.strategy === "EXH" ? exh : []).push?.(s);
  }
const c = (t, side) => t.filter((x) => x.side === side);
const R = (t) => t.reduce((a, b) => a + (b.R || 0), 0);
const l = (n, t) => console.log("  " + n.padEnd(12) + String(t.length).padStart(6) + " tirs   R " + (R(t) >= 0 ? "+" : "") + R(t).toFixed(1).padStart(7)
  + "   BUY " + String(c(t, "BUY").length).padStart(5) + " / SELL " + String(c(t, "SELL").length).padStart(5));
console.log(`\n  MIN_PB = ${process.env.MIN_PB}   (seuil REEL, pas le point de fonctionnement des sondes)`);
l("PB", pb); l("EXH", exh);
console.log("  " + (c(pb, "BUY").length > 0 && c(pb, "SELL").length > 0
  ? "✅ LES DEUX CÔTÉS TIRENT" : "🔴 UN CÔTÉ EST MORT — défaut de signe"));
