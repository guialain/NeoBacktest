// _fiche_tir.mjs — LA FICHE COMPLETE D'UN TIR, retrouve par ACTIF + HORODATAGE.
// ⚠ Le carnet depend du moteur COURANT : un tir present hier peut ne plus exister aujourd hui.
//   Si l horodatage exact ne rend rien, on montre les tirs VOISINS du meme actif ce jour-la —
//   sinon on conclurait « ce tir n existe pas » alors qu il a juste change de minute.
//   usage : node stats/_fiche_tir.mjs   ACTIF=GERMANY_40 TS="2026.07.29 09:27:12"
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const ACTIF = process.env.ACTIF ?? "GERMANY_40";
const TS = process.env.TS ?? "2026.07.29 09:27:12";
const JOUR = TS.slice(0, 10);
const f = path.join("C:/Users/Public/Neo-Backtest/data/matrix", ACTIF + ".csv");
if (!fs.existsSync(f)) { console.log("actif inconnu :", ACTIF); process.exit(1); }
const sig = (runMatrixBacktest(f, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || [])
  .filter((s) => typeof s.R === "number");
const exact = sig.filter((s) => String(s.tsMT ?? "") === TS);
const jour = sig.filter((s) => String(s.tsMT ?? "").startsWith(JOUR));
console.log(`\n═══ ${ACTIF} · ${TS} ═══   ${sig.length} tirs sur l'actif · ${jour.length} ce jour-la`);
const P = (s) => s.sc?.boxes?.cont?.parts ?? {};
const fiche = (s) => {
  console.log(`\n  ── ${s.tsMT} · ${s.side} · ${s.strategy} · ${s.outcome} · R ${(s.R>=0?"+":"")+Number(s.R).toFixed(2)} ──`);
  console.log(`     meanSlopeH1  ${s.sc?.meanSlopeH1 ?? "—"}`);
  console.log(`     percentile   brut ${s.sc?.msPct ?? "—"}   ORIENTE ${s.sc?.msPctOri ?? "—"}   bande ${s.sc?.msBande ?? "—"}`);
  console.log(`     modulateur   ${s.sc?.msMod ?? "—"}${s.sc?.msMuet ? "   (capteur MUET, fail-open a 1)" : ""}`);
  console.log(`     score CONT   AVANT ${s.sc?.contPreMod ?? "—"}  ->  APRES ${s.sc?.cont ?? "—"}`);
  const fam = s.sc?.boxes?.cont?.familles;
  if (fam) console.log(`     familles     ${Object.entries(fam).map(([k, v]) => k + " " + v).join(" · ")}`);
  const p = P(s);
  console.log(`     capteurs     %K H1 ${p.kH1Brut ?? "—"} · K−D H1 col ${p.kH1Col ?? "—"} · %K H4 brut(note) ${p.kH4Brut ?? "—"}`);
  console.log(`     vetos        ${(s.sc?.boxes?.cont?.vetoIds ?? []).join(", ") || "(aucun)"}`);
};
if (exact.length) exact.forEach(fiche);
else {
  console.log(`  ⚠ AUCUN tir a cet horodatage EXACT dans le moteur courant.`);
  if (!jour.length) console.log("  ⚠ et aucun tir ce jour-la non plus.");
  else { console.log(`  ⇒ les ${jour.length} tirs du ${JOUR}, pour situer :`); jour.forEach(fiche); }
}
console.log("");
