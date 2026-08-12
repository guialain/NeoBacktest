// _tir_dump.mjs — TOUT CE QUE LA CASCADE A VU SUR UNE BARRE. `ACTIF=... TS=...`
// ⚠ On lit le fantome `boxes` (les TROIS boites evaluees en parallele) + le tir reel s'il existe.
//   ⭐ Les trois boites disent « ce que chaque rang PENSERAIT », `firedStrategy` dit ce que la
//   cascade a FAIT. L'ecart entre les deux est toute la question quand on demande « qui a envoye
//   cette barre au rang ③ ».
// ⚠ `file:///C:/...` en dur : sur Windows un chemin absolu nu est refuse par le chargeur ESM.
import fs from "fs";
process.env.NO_TRIGGER = "1";
const { prepareAsset, runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { MIN_EXH, MIN_PB, MIN_CONT, MIN_PRES } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const ACTIF = process.env.ACTIF ?? "US_30";
const TS = process.env.TS ?? "";
const CSV = `C:/Users/Public/Neo-Backtest/data/matrix/${ACTIF}.csv`;

const P = prepareAsset(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true });
const g = (P.ghosts ?? []).filter((x) => x.ghost === "boxes" && String(x.tsMT ?? "").startsWith(TS));
console.log(`\n══ ${ACTIF} ${TS} — ${g.length} barre(s) fantome ══`);
console.log(`   seuils : MIN_EXH ${MIN_EXH} · MIN_PRES ${MIN_PRES} · MIN_PB ${MIN_PB} · MIN_CONT ${MIN_CONT}\n`);
for (const x of g) {
  console.log(`  ts ${x.tsMT} · cote joue ${x.side} · regDir ${x.regDir} · a TIRE : ${x.firedStrategy ?? "rien"}`);
  console.log(`    ① EXH   cote ${x.eSide}  conviction ${x.eConv}  verdict ${x.eVerd}  bloque ${x.eBlk}`);
  console.log(`             vetos : ${(x.eVetos ?? []).join(" + ") || "aucun"}`);
  console.log(`    ② PB    conviction ${x.pConv}  verdict ${x.pVerd}  bloque ${x.pBlk}  entrees presentes ${x.pFam ?? "n/a (appartenance refusee)"}`);
  console.log(`             vetos : ${(x.pVetos ?? []).join(" + ") || "aucun"}`);
  console.log(`    ③ CONT  conviction ${x.cConv}  verdict ${x.cVerd}  familles ${x.cFam}  atteint par la cascade : ${x.rangCont}`);
  console.log(`             bareme SEUL ${x.cRaw}  ·  bonus ${x.cBonus} (applique : ${x.cBonus != null ? "voir BONUS_APPLIQUE" : "n/a"})`);
  // ⭐⭐⭐ LA QUESTION QUI COMPTE : le veto a-t-il CAUSE le routage, ou le SCORE l'avait-il deja fait ?
  const vetoCible = (x.eVetos ?? []).includes("h1-k-falling-with-room-left");
  if (vetoCible) {
    const auraitFranchi = Number.isFinite(x.eConv) && x.eConv >= MIN_EXH;
    console.log(`\n    \u2b50\u2b50\u2b50 \`h1-k-falling-with-room-left\` MORD sur cette barre.`);
    console.log(`        conviction ① = ${x.eConv} · seuil = ${MIN_EXH}`);
    console.log(`        \u21d2 ${auraitFranchi
      ? "SANS le veto, le rang ① AURAIT FRANCHI le seuil : le veto est bien la CAUSE du routage."
      : "SANS le veto, le rang ① N'AURAIT PAS franchi le seuil non plus \u2014 la barre partait en ②/③ DE TOUTE FACON."}`);
  } else {
    console.log(`\n    \u26a0 \`h1-k-falling-with-room-left\` NE MORD PAS sur cette barre.`);
  }
}
// Le tir reel, avec son resultat.
const R = runMatrixPortfolio([CSV], { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
for (const t of (R.signals ?? []).filter((s) => String(s.tsMT ?? "").startsWith(TS)))
  console.log(`\n  TIR REEL : ${t.strategy} ${t.side} · R ${t.R} · sortie ${t.exitReason ?? "?"} · score ${t.score ?? "?"}`);
console.log("");
