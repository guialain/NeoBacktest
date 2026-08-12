// _jour_dump.mjs — TOUS LES TIRS D'UN ACTIF SUR UN JOUR, avec la decomposition du rang qui a tire.
// ⚙ `ACTIF=US_TECH100 JOUR=2026.08.04 node stats/_jour_dump.mjs`
import fs from "fs";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "-11";
const { runMatrixBacktest, prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");
const A = process.env.ACTIF ?? "US_TECH100", J = process.env.JOUR ?? "";
const CSV = `C:/Users/Public/Neo-Backtest/data/matrix/${A}.csv`;
const sig = (runMatrixBacktest(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || [])
  .filter((s) => String(s.tsMT || "").startsWith(J));
console.log(`\n══ ${A} · ${J} — ${sig.length} tir(s) ══`);
console.log(`   heure     rang  cote   conv   R      sortie   | familles du rang ③        | cases ⑷`);
for (const s of sig) {
  const b = s.sc?.boxes?.cont, f = b?.familles ?? {}, p = b?.parts ?? {};
  const fam = ["rsi", "di", "kH4", "gapSlope"].map((k) => k + " " + (f[k] ?? "—")).join(" ");
  console.log(`   ${String(s.tsMT).slice(11, 19)}  ${String(s.strategy).padEnd(5)} ${String(s.side).padEnd(5)} `
    + `${String(b?.conviction ?? "—").padStart(6)} ${String(s.R).padStart(6)}  ${String(s.outcome).padEnd(5)} `
    + `| ${fam.padEnd(26)} | ${p.gapNiveau ?? "—"} x ${p.gapPente ?? "—"} = ${p.gapSlope ?? "muet"}`);
}
// ⭐ Le CONTEXTE de la journee : ou en etaient les indicateurs, et ou allait le prix.
const P = prepareAsset(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true });
const L = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/); const h = L[0].split(";");
const iT = h.indexOf("timestamp"), col = (n) => h.indexOf(n);
const rows = L.slice(1).map((l) => l.split(";")).filter((c) => String(c[iT]).startsWith(J));
if (rows.length) {
  const num = (c, n) => { const v = c[col(n)]; return (v === "" || v == null || !Number.isFinite(Number(v))) ? null : Number(v); };
  const px = rows.map((c) => num(c, "price")).filter((v) => v != null);
  console.log(`\n   la JOURNEE : ${rows.length} barres · close ${px[0]} -> ${px[px.length - 1]}  (${(100 * (px[px.length - 1] / px[0] - 1)).toFixed(2)} %)`);
  const q = (n) => { const v = rows.map((c) => num(c, n)).filter((x) => x != null); return v.length ? `${Math.min(...v).toFixed(1)} … ${Math.max(...v).toFixed(1)}` : "—"; };
  console.log(`   RSI H1 ${q("rsi_h1")} · %K H1 ${q("stoch_k_h1")} · %K H4 ${q("stoch_k_h4")} · zscore H1 ${q("zscore_h1")}`);
}
console.log("");
