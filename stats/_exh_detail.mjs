// _exh_detail.mjs — LA DECOMPOSITION COMPLETE DU RANG ① SUR UNE BARRE : entree, MESURE, CASE, note.
// ⚠⚠ LES CASES SONT RECONSTRUITES AVEC LES CLASSIFIEURS DU MOTEUR (`readTfs`, `computeDeviation`),
//   JAMAIS RE-DERIVEES A LA MAIN. Une sonde qui reclasse elle-meme finit par diverger du moteur et
//   affiche une case qui n'a pas ete lue — c'est le motif `derived_dataset_computed_3x`.
// ⚙ `ACTIF=AUDUSD TS="2026.07.02 16:03" node stats/_exh_detail.mjs`
import fs from "fs";
process.env.NO_TRIGGER = "1";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/";
const { runMatrixBacktest } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { readTfs } = await import(M + "scoringInputs.js");
const { computeDeviation } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js");
const { STOCHDYN_CONTACT } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js");
const { rsiZone, rsiRang3 } = await import(M + "experts/rsiExpert.js");
const A = process.env.ACTIF ?? "AUDUSD", TS = process.env.TS ?? "";
const CSV = `C:/Users/Public/Neo-Backtest/data/matrix/${A}.csv`;
const sig = (runMatrixBacktest(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || [])
  .filter((s) => String(s.tsMT || "").startsWith(TS))[0];
if (!sig) { console.log("\n  aucun tir sur cette barre\n"); process.exit(0); }
const L = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/); const h = L[0].split(";");
const row = L.slice(1).map((l) => l.split(";")).filter((c) => String(c[h.indexOf("timestamp")]).startsWith(TS))
  .map((c) => Object.fromEntries(h.map((k, i) => [k, c[i]])))[0];
const n = (k) => { const v = row?.[k]; return (v === "" || v == null || !Number.isFinite(Number(v))) ? null : Number(v); };
const tfs = readTfs(row);
const d = computeDeviation(row, A.toUpperCase(), "h1");
const P = sig.sc?.boxes?.exh?.parts ?? {}, F = sig.sc?.boxes?.exh?.familles ?? {};
const side = sig.sc?.boxes?.exh?.side, SELL = side === "SELL";
const kd = (tfs.h1?.kLive != null && n("stoch_d_h1_s0") != null) ? +(tfs.h1.kLive - n("stoch_d_h1_s0")).toFixed(2) : null;
const colKD = kd == null ? "—" : kd > STOCHDYN_CONTACT ? "KD_POS" : kd < -STOCHDYN_CONTACT ? "KD_NEG" : "CONTACT";
const cote = (d?.gapAtr ?? 0) >= 0 ? "HAUT" : "BAS";
const campFade = SELL ? tfs.h1?.diPlusLevel : tfs.h1?.diMinusLevel;
const zM15 = tfs.m15?.zoneK ?? tfs.m15?.zone;

const LIG = [
  ["⑴ gap · côté prix × niveau × K−D", `gapAtr ${d?.gapAtr?.toFixed(3)} · K−D ${kd}`, `${cote}_${d?.level} × ${colKD}`, P.gap],
  ["⑵ ADX × dyn. DI",                  `ADX ${tfs.h1?.adx ?? "—"} · dyn ${tfs.h1?.gapDyn ?? "—"}`, `${tfs.h1?.adxBand ?? "—"} × ${tfs.h1?.gapDyn ?? "—"}`, P.adx],
  ["⑶ DI camp FADÉ × dyn.",            `DI${SELL ? "+" : "−"} ${SELL ? n("plus_di_h1_s0") : n("minus_di_h1_s0")} · dyn ${tfs.h1?.gapDyn ?? "—"}`, `${campFade ?? "—"} × ${tfs.h1?.gapDyn ?? "—"}`, P.di],
  ["⑷ %K H4 × ΔK",                     `%K H4 ${tfs.h4?.kLive ?? "—"} · Δ ${tfs.h4?.dKBand ?? "—"}`, `${tfs.h4?.kLive ?? "—"} × ${tfs.h4?.dKBand ?? "—"}`, P.kH4],
  ["⑸ RSI M15 · zone × rang/3",        `RSI ${n("rsi_m15")} (clôt) / ${n("rsi_m15_s0")} (live)`, `${rsiZone(n("rsi_m15")) ?? "—"} × ${rsiRang3(n("rsi_m15_s0"), n("rsi_m15_previouslow3"), n("rsi_m15_previoushigh3")) ?? "—"}`, P.rsiM15],
  ["⑹ RSI H1 · zone × rang/3",         `RSI ${n("rsi_h1")} (clôt) / ${n("rsi_h1_s0")} (live)`, `${rsiZone(n("rsi_h1")) ?? "—"} × ${rsiRang3(n("rsi_h1_s0"), n("rsi_h1_previouslow3"), n("rsi_h1_previoushigh3")) ?? "—"}`, P.rsiTrendH1],
  ["⑺ K/D H1 · zone M15 × cycle × sens", `zone M15 ${zM15 ?? "—"} · K−D ${tfs.h1?.kdGap ?? "—"}`, `${zM15 ?? "—"} × ${tfs.h1?.kdCur ?? "—"} × ${(tfs.h1?.kdGap ?? 0) < 0 ? (SELL ? "POUR" : "CONTRE") : (SELL ? "CONTRE" : "POUR")}`, P.kdH1],
];
const f = (v) => v == null || !Number.isFinite(v) ? "  muet" : ((v > 0 ? "+" : "") + v).padStart(6);
console.log(`\n══ ${A} · ${sig.tsMT} · ① EXH ${side} · ${sig.outcome} R ${sig.R} ══`);
console.log(`   les notes sont SIGNÉES : négatif = pousse au SELL, positif = pousse au BUY\n`);
console.log(`   entrée                                mesure                             case lue                          note`);
console.log("   " + "─".repeat(116));
for (const [t, m, c, v] of LIG) console.log(`   ${t.padEnd(38)}${String(m).padEnd(35)}${String(c).padEnd(34)}${f(v)}`);
console.log("   " + "─".repeat(116));
for (const [k, v] of Object.entries(F)) console.log(`   ${("famille · " + k).padEnd(107)}${f(v)}`);
const S = Object.values(F).reduce((a, v) => a + v, 0);
console.log("   " + "─".repeat(116));
console.log(`   ${"Σ des FAMILLES (signée)".padEnd(107)}${f(S)}`);
console.log(`   ${`→ orientée pour un ${side}`.padEnd(107)}${f(SELL ? -S : S)}   = conviction ${sig.sc?.boxes?.exh?.conviction}`);
console.log(`\n   seuil du rang ① : MIN_EXH ${sig.sc?.min ?? "—"} · échelle [−46,5 · +46,5]`);
console.log(`   ⇒ ${f(SELL ? -S : S).trim()} ≥ ${sig.sc?.min} : le rang ① TIRE.\n`);
