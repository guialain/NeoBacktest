// EXH × TREND RSI H1 sur 4 bougies (owner 2026-07-21) — pas le delta 1-barre (bruit), la PENTE.
//   Série RSI reconstruite par heure ; net = rsi[H] − rsi[H−3], orienté par le fade.
//   SELL EXH (fade top) : bon si RSI DESCEND sur 4 barres (net<0) · BUY miroir.
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return (v === "" || v == null || !Number.isFinite(n)) ? null : n; };
const hourIdx = (ts) => { const t = Date.parse(String(ts).slice(0, 13).replace(/\./g, "-") + ":00:00"); return Number.isFinite(t) ? Math.floor(t / 3600000) : null; };
const EXH = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const a = f.replace(/\.csv$/i, "");
  const L = fs.readFileSync(path.join(D, f), "utf8").trim().split(/\r?\n/);
  const H = L[0].split(";"); const ix = (n) => H.indexOf(n); const iR = ix("rsi_h1_s0"), iTs = ix("timestamp") >= 0 ? ix("timestamp") : 0;
  const rsiByHour = new Map();   // dernier rsi_h1_s0 vu dans l'heure ≈ close
  for (const line of L.slice(1)) { const r = line.split(";"); const rv = num(r[iR]); if (rv == null) continue; const h = hourIdx(r[iTs]); if (h != null) rsiByHour.set(h, rv); }
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (s.type !== "EXHAUSTION" || typeof s.R !== "number") continue;
    const h = hourIdx(s.tsMT); const seq = [0, 1, 2, 3].map((o) => rsiByHour.get(h - o));
    if (seq.some((x) => x === undefined)) continue;
    const net = seq[0] - seq[3];                                   // trend 4 barres
    const steps = [seq[0] - seq[1], seq[1] - seq[2], seq[2] - seq[3]];
    const mono = steps.every((d) => d > 0) ? 1 : steps.every((d) => d < 0) ? -1 : 0;
    s._rsiNet = s.side === "SELL" ? -net : net;                    // orienté fade : >0 = RSI va DANS le sens du fade
    s._rsiMono = s.side === "SELL" ? -mono : mono;                 // +1 = descend proprement (bon pour SELL)
    EXH.push(s);
  }
}
function met(a) { if (!a.length) return "n=0"; const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0), gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0)); return `n=${String(a.length).padStart(4)}  WR ${((w / (w + l)) * 100 || 0).toFixed(0).padStart(3)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  PF ${gL ? (gW / gL).toFixed(2) : "∞"}  R ${(R >= 0 ? "+" : "") + R.toFixed(1)}`; }
console.log(`EXH (avec série RSI reconstruite) : ${met(EXH)}\n`);
console.log("── TREND RSI 4 barres orienté fade (>0 = le RSI CONFIRME le retournement sur la fenêtre) ──");
for (const [lbl, p] of [["confirme fort (>+5)", (v) => v > 5], ["confirme (0..5)", (v) => v > 0 && v <= 5], ["CONTRE (−5..0)", (v) => v > -5 && v <= 0], ["CONTRE fort (≤−5)", (v) => v <= -5]])
  console.log("  " + lbl.padEnd(20) + met(EXH.filter((s) => p(s._rsiNet))));
console.log("\n── MONOTONIE RSI 4 barres orientée fade ──");
console.log("  confirme MONOTONE (+1)  " + met(EXH.filter((s) => s._rsiMono === 1)));
console.log("  mixte (0)               " + met(EXH.filter((s) => s._rsiMono === 0)));
console.log("  CONTRE monotone (−1)    " + met(EXH.filter((s) => s._rsiMono === -1)));
