// _pb_pourquoi_muet.mjs — POURQUOI LE RANG ② N'A-T-IL PAS NOTE CETTE BARRE ?
// ============================================================================================
// ⚠⚠ « le ② n'a pas note » a DEUX causes OPPOSEES et il faut les distinguer :
//   · `refus` non vide  => un critere d'APPARTENANCE a refuse : le bareme n'a JAMAIS ETE CONSULTE.
//     La barre « n'est pas de cette figure ». `conviction` est `null`.
//   · `conviction` finie mais < MIN_PB => le bareme A JUGE et le score n'a pas suffi.
//   Les confondre fait mesurer un seuil sur une population qui ne l'a jamais rencontre.
// ⚙ Usage : `TS="2026.07.29 19:35" ASSET=AUDUSD node stats/_pb_pourquoi_muet.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
const { MIN_PB, MIN_PRES, MIN_EXH, MIN_CONT } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const TS = process.env.TS ?? "2026.07.29 19:35";
const ASSET = process.env.ASSET ?? "AUDUSD";
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const f = fs.readdirSync(MATRIX).find((x) => x.toLowerCase().startsWith(ASSET.toLowerCase()));
if (!f) { console.log("actif introuvable :", ASSET); process.exit(1); }
const p = prepareAsset(path.join(MATRIX, f), { ghostBoxes: true, chargeSpread: true });
const g = (p.ghosts ?? []).filter((c) => c.ghost === "boxes" && String(c.tsMT ?? "").startsWith(TS));
console.log(`\n== ${ASSET} ${TS} == ${g.length} ligne(s) · MIN_EXH ${MIN_EXH} · MIN_PB ${MIN_PB} · MIN_PRES ${MIN_PRES} · MIN_CONT ${MIN_CONT}`);
for (const x of g) {
  console.log(`\n  tsMT ${x.tsMT}  ·  cote des SUIVEURS (bx.pb.side) : ${x.side}  ·  regDir ${x.regDir}`);
  console.log(`  -- BOITE (1) EXH --   side ${x.eSide}  conviction ${x.eConv}  verdict ${x.eVerd}  bloque ${x.eBlk}`);
  console.log(`                        vetos : ${(x.eVetos ?? []).join(" + ") || "(aucun)"}`);
  console.log(`  -- BOITE (2) PB  --   conviction ${x.pConv}  verdict ${x.pVerd}  bloque ${x.pBlk}`);
  console.log(`                        vetos : ${(x.pVetos ?? []).join(" + ") || "(aucun)"}`);
  console.log(`                        familles notees : ${x.pFam ?? "null"}`);
  console.log(`                        REFUS d'appartenance : ${(x.pRefus ?? []).join(" + ") || "(aucun — le bareme A tourne)"}`);
  console.log(`                        entrees MUETTES      : ${(x.pMuets ?? []).join(" + ") || "(aucune)"}`);
  console.log(`  -- BOITE (3) CONT --  conviction ${x.cConv}  (brut ${x.cRaw} + bonus ${x.cBonus})  verdict ${x.cVerd}  familles ${x.cFam}`);
  console.log(`                        familles : ${JSON.stringify(x.cFamV)}`);
  console.log(`  -- CASCADE --         rang (3) atteint : ${x.rangCont}   ·   a TIRE : ${x.firedStrategy ?? "(rien)"}`);
}
