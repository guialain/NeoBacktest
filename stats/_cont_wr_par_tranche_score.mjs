// _cont_wr_par_tranche_score.mjs — WR ③ PAR TRANCHE DE SCORE (score APRES modulateur).
// ⚠ Le score lu est `sContB` MODULE : c'est LUI que `MIN_CONT` compare, donc lui qui selectionne.
// ⚠ WR par GRAPPE (actif|jour) + sigma sur les grappes — les tirs ne sont pas independants.
// ⚠ Point mort 75,0 %. Capacite SATUREE a seuil bas ⇒ les tranches basses sont des SURVIVANTES.
//   usage : node stats/_cont_wr_par_tranche_score.mjs   [MIN_CONT=5]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "5";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s) && Number.isFinite(s.sc?.cont));
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const p = [...g.values()].map((o) => o.w / o.n);
  const m = p.reduce((a, b) => a + b, 0) / p.length;
  const v = p.length > 1 ? p.reduce((a, b) => a + (b - m) ** 2, 0) / (p.length - 1) : null;
  return { n: t.length, gr: p.length, wrt: 100 * t.filter((x) => x.outcome === "WIN").length / t.length,
           wrg: 100 * m, sig: v === null ? null : 100 * Math.sqrt(v / p.length),
           R: t.reduce((a, b) => a + (b.R || 0), 0),
           buy: t.filter((x) => x.side === "BUY").length, sell: t.filter((x) => x.side === "SELL").length }; };
const T = st(CONT);
console.log(`\n═══ RANG ③ · WR PAR TRANCHE DE SCORE (apres modulateur) ═══  [MIN_CONT=${process.env.MIN_CONT}]`);
console.log(`  ${CONT.length} tirs · ${T.gr} grappes · WR/tir ${T.wrt.toFixed(1)} % · WR/grappe ${T.wrg.toFixed(1)} % ±${T.sig.toFixed(1)} · ${(T.R >= 0 ? "+" : "") + T.R.toFixed(1)} R`);
console.log(`  point mort 75,0 %\n`);
console.log("  " + "tranche".padEnd(12) + "tirs".padStart(7) + "grap".padStart(6) + "BUY".padStart(7) + "SELL".padStart(7)
  + "WR/tir".padStart(9) + "WR/grap".padStart(9) + "sigma".padStart(8) + "R".padStart(9));
console.log("  " + "─".repeat(74));
for (let lo = 0; lo < 45; lo += 5) {
  const t = CONT.filter((s) => s.sc.cont >= lo && s.sc.cont < lo + 5);
  const s = st(t);
  const lbl = lo === 40 ? ">40" : `${lo}-${lo + 5}`;
  if (!s) { console.log("  " + lbl.padEnd(12) + "      0     0      —      —        —        —       —        —"); continue; }
  console.log("  " + lbl.padEnd(12) + String(s.n).padStart(7) + String(s.gr).padStart(6)
    + String(s.buy).padStart(7) + String(s.sell).padStart(7)
    + (s.wrt.toFixed(1) + "%").padStart(9) + (s.wrg.toFixed(1) + "%").padStart(9)
    + (s.sig === null ? "—" : "±" + s.sig.toFixed(1)).padStart(8)
    + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9)
    + (s.gr < 20 ? "  ⚠ <20 grap" : (s.wrg < 75 ? "  🔴" : "")));
}
console.log("");
