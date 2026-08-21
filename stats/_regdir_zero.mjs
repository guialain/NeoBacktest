// _regdir_zero.mjs — COMBIEN DE BARRES ONT `regDir === 0` (le DROP `no-regime`) ?
// ⚠ Question prealable a l'ouverture du `Flat` : si la reponse est ZERO, ouvrir le Flat ne cree
//   aucune population et le geste est vide. Le funnel du matin ne listait AUCUN `no-regime` sur
//   90 781 lignes — mais « absent d'une liste » n'est pas « mesure a zero ».
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const par = new Map(); let tot = 0;
const bump = (k) => par.set(k, (par.get(k) ?? 0) + 1);
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "all-rows")) {
    tot++;
    bump(x.regDir === null || x.regDir === undefined ? "regDir ABSENT (null)" : `regDir ${x.regDir}`);
    if (x.waitNature) bump(`  nature:${x.waitNature}`);
  }
}
console.log(`\n${tot} lignes vues par le collecteur`);
for (const [k, v] of [...par.entries()].sort((a,b)=>b[1]-a[1]))
  if (!k.startsWith("  nature:") || v > 0) console.log(`   ${k.padEnd(34)}${String(v).padStart(8)}  ${(100*v/tot).toFixed(2)} %`);
