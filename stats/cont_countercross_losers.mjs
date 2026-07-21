// CONT à cross CONTRAIRE : où PERDENT-ils ? (owner : les loss qu'on aurait dû éviter par le cross)
//   Population entière = gagnante ; on cherche la CELLULE perdante répétitive DEDANS.
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const CC = [];   // CONT à cross H1 contraire
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (s.type === "EXHAUSTION" || typeof s.R !== "number") continue;
    const cc = (s.side === "BUY" && s.crossState === "CROSS_DOWN") || (s.side === "SELL" && s.crossState === "CROSS_UP");
    if (cc) CC.push(s);
  }
function met(a) { if (!a.length) return "n=0"; const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0); return `n=${String(a.length).padStart(4)}  WR ${((w / (w + l)) * 100 || 0).toFixed(0).padStart(3)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  totalR ${(R >= 0 ? "+" : "") + R.toFixed(1)}`; }
const split = (lbl, keyFn, order) => { console.log(`── ${lbl} ──`); const g = {}; for (const s of CC) (g[keyFn(s)] ??= []).push(s); for (const k of (order || Object.keys(g).sort()).filter((x) => g[x])) console.log(`   ${String(k).padEnd(18)} ${met(g[k])}`); console.log(); };
console.log(`CONT à CROSS H1 CONTRAIRE : ${met(CC)}\n`);
split("crossAge (fraîcheur du cross)", (s) => s.crossAge ?? "(null)", [0, 1, 2, "(null)"]);
split("maturité", (s) => s.crossMat ?? "(null)", ["FRESH", "CONFIRMED", "STALLED", "(null)"]);
split("profil", (s) => s.profile ?? "?");
split("zone H1", (s) => s.obs?.zone ?? s.zoneH1 ?? "?");
split("bande ADX", (s) => { const a = s.adx; return a == null ? "?" : a < 18 ? "<18" : a < 25 ? "18-25" : a < 35 ? "25-35" : "≥35"; }, ["<18", "18-25", "25-35", "≥35"]);
split("séparation (frôlement ?)", (s) => s.gap0 == null ? "?" : s.gap0 < 5 ? "gap0<5 frôle" : s.gap0 < 12 ? "gap0 5-12" : "gap0≥12", ["gap0<5 frôle", "gap0 5-12", "gap0≥12"]);
// croisement le plus prometteur : crossAge FRESH × zone extrême
console.log("── crossAge 0 (FRESH) × zone ──");
for (const z of ["EXTREME_BASSE", "BASSE", "MID", "HAUTE", "EXTREME_HAUTE"]) { const a = CC.filter((s) => s.crossAge === 0 && (s.obs?.zone ?? s.zoneH1) === z); if (a.length) console.log(`   FRESH ${z.padEnd(14)} ${met(a)}`); }
