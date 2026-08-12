// _bonus_debranche_effet.mjs — CE QUE LE DEBRANCHEMENT DES BONUS COUTE EN VOLUME.
// ⚠⚠ A/B PAR **RE-RUN**, UN PROCESS PAR ETAT (`BONUS=on` / defaut). Comparer deux tranches d'un
//   meme run serait faux : les tirs sont CONCURRENTS (`maxOpen 30`, `MAX_POSITIONS_PER_SYMBOL 8`)
//   et les slots ne se reallouent qu'au re-run. Une barre qui n'est plus prise LIBERE un slot.
// ⚠ `runMatrixPortfolio` et NON `runMatrixBacktest` par actif : la capacite est GLOBALE, la sommer
//   actif par actif donnerait un volume qui n'existe sur aucun compte.
// ⚠ `file:///C:/...` en dur : sur Windows un chemin absolu nu est refuse par le chargeur ESM.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { BONUS_APPLIQUE, MIN_CONT } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const r = runMatrixPortfolio(paths, { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
const sig = r.signals ?? [];
const par = {};
for (const t of sig) {
  const s = t.strategy ?? "?";
  par[s] = par[s] ?? { n: 0, R: 0, g: 0 };
  par[s].n++; par[s].R += t.R ?? 0; if ((t.R ?? 0) > 0) par[s].g++;
}
const N = sig.length, G = sig.filter((t) => (t.R ?? 0) > 0).length, R = sig.reduce((a, t) => a + (t.R ?? 0), 0);
console.log(`\n══ BONUS ${BONUS_APPLIQUE ? "APPLIQUES" : "DEBRANCHES"} · MIN_CONT ${MIN_CONT} — ${N} tirs ══`);
for (const [s, v] of Object.entries(par).sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${s.padEnd(6)} ${String(v.n).padStart(6)} tirs   WR ${(100 * v.g / v.n).toFixed(2).padStart(6)} %   R ${v.R.toFixed(1).padStart(8)}`);
console.log(`  ${"TOTAL".padEnd(6)} ${String(N).padStart(6)} tirs   WR ${(N ? 100 * G / N : 0).toFixed(2).padStart(6)} %   R ${R.toFixed(1).padStart(8)}`);
console.log(`  ⚠ point mort 75,0 % (spread facture). Un WR sous 75 % perd, quel que soit le R affiche.\n`);
