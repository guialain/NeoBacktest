// _bar_full.mjs — LA BARRE EN ENTIER : les 3 boites, leurs parts, et les entrees brutes du gap.
// ⚙ `ACTIF=SILVER TS="2026.07.14 13:24" node stats/_bar_full.mjs`
import fs from "fs";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { computeDeviation, gapInstalled } = await import(D);
const A = process.env.ACTIF ?? "SILVER", TS = process.env.TS ?? "";
const CSV = `C:/Users/Public/Neo-Backtest/data/matrix/${A}.csv`;
const S = (runMatrixBacktest(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || [])
  .filter((s) => String(s.tsMT || "").startsWith(TS));
const L = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/); const h = L[0].split(";");
const iT = h.indexOf("timestamp");
const row = L.slice(1).map((l) => l.split(";")).filter((c) => String(c[iT]).startsWith(TS))
  .map((c) => Object.fromEntries(h.map((k, i) => [k, c[i]])))[0];
const n = (k) => { const v = row?.[k]; return (v === "" || v == null || !Number.isFinite(Number(v))) ? null : Number(v); };

console.log(`\n══ ${A} · ${TS} ══`);
for (const s of S) {
  const b = s.sc?.boxes ?? {};
  console.log(`  TIR : ${s.strategy} ${s.side} · R ${s.R} · ${s.outcome} · regDir ${b.regDir}`);
  for (const [k, lbl] of [["exh", "① EXH "], ["pb", "② PB  "], ["cont", "③ CONT"]]) {
    const x = b[k]; if (!x) continue;
    console.log(`\n  ${lbl} cote ${x.side ?? "—"} · conviction ${x.conviction} · verdict ${x.verdict} · bloque ${x.blocked}`);
    if (x.vetoIds?.length) console.log(`         vetos : ${x.vetoIds.join(" + ")}`);
    if (x.familles) console.log(`         familles : ${Object.entries(x.familles).map(([a, v]) => a + " " + v).join("  ")}`);
    if (x.parts) console.log(`         parts    : ${Object.entries(x.parts).filter(([a]) => a !== "familles")
      .map(([a, v]) => a + " " + (v === null ? "muet" : typeof v === "number" ? v : v)).join("  ")}`);
    if (x.muets?.length) console.log(`         muets    : ${x.muets.join(", ")}`);
    if (x.refus?.length) console.log(`         refus    : ${x.refus.join(", ")}`);
  }
}
// ── LES ENTREES BRUTES DU GAP, aux DEUX instants (le rang ① lit LIVE, le ② la CLOTURE) ──
const d = computeDeviation(row, A, "h1");
console.log(`\n  ── \`computeDeviation(h1)\` ──`);
console.log(`     LIVE     gapAtr ${d?.gapAtr?.toFixed(3)}  level ${d?.level}  installed ${gapInstalled(d?.level, d?.gapAtr, d?.meanSlope)}`);
console.log(`     CLOTURE  gapAtr ${d?.gapAtrClose?.toFixed?.(3) ?? "—"}  level ${d?.levelClose}`);
console.log(`     meanSlope ${d?.meanSlope?.toFixed(4)}  bande ${d?.meanSlopeBand}`);
console.log(`\n  ── LE CONTEXTE BRUT ──`);
console.log(`     prix ${n("price")}  ·  zscore_h1 ${n("zscore_h1")} (cloture) / ${n("zscore_h1_s0")} (live)`);
console.log(`     bollinger h1 : middle ${n("middle_h1")}  sigma ${n("sigma_h1")}`);
// ⚠ NOMS EXACTS : l'ADX vit en `_cN` et le %K en `_sN` — la forme nue N'EXISTE PAS pour eux.
//   Le premier jet lisait `adx_h1` / `stoch_k_h1` et affichait `null` sur des colonnes PLEINES :
//   une sonde qui se trompe de nom ne leve rien, elle imprime « pas de donnee ».
const dump = (pre) => Object.keys(row ?? {}).filter((k) => k.startsWith(pre)).slice(0, 6)
  .map((k) => k + " " + (row[k] === "" ? "vide" : row[k])).join("  ");
console.log(`     ADX  : ${dump("adx_h1")}`);
console.log(`     DI+  : ${dump("plus_di_h1")}`);
console.log(`     DI-  : ${dump("minus_di_h1")}`);
console.log(`     %K   : ${dump("stoch_k_h1")}`);
console.log(`     %D   : ${dump("stoch_d_h1")}`);
console.log(`     RSI  h1 ${n("rsi_h1")}  ·  m15 ${n("rsi_m15")}`);
console.log("");
