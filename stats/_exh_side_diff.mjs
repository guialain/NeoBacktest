// _exh_side_diff.mjs — COMBIEN DE BARRES CHANGENT DE COTE AU RANG ① ?
// ============================================================================================
// ⚠⚠ ON NE RE-DERIVE PAS LA REGLE DANS LA SONDE. Recopier `SIDE_EXH` ici la ferait diverger du
//   moteur a la premiere retouche — c'est le motif `derived_dataset_computed_3x`. On DEMANDE au
//   moteur, une fois par bras, et on DIFFE.
// ⚙ Usage : `node stats/_exh_side_diff.mjs > a.txt` puis `EXH_SIDE_SRC=regime ... > b.txt`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostBoxes: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "boxes"))
    console.log(`${asset}|${x.tsMT}|${x.eSide}|${x.regDir}|${x.eConv}|${x.eBlk ? 1 : 0}`);
}
