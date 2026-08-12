// _ab_moteur.mjs — A/B MOTEUR COMPLET, PAR RANG **ET PAR COTE**. Un process par etat.
// ============================================================================================
// ⚠⚠ POURQUOI UN RE-RUN ET PAS UNE TRANCHE : les tirs sont CONCURRENTS (`maxOpen 30`,
//   `MAX_POSITIONS_PER_SYMBOL 8`, `PositionSpacing`). Une barre qui n'est plus prise LIBERE un slot
//   qu'une autre occupe. Filtrer un carnet a posteriori repond a « qui aurait ete pris », jamais a
//   « ce que le moteur aurait fait » — et l'ecart entre les deux est tout le sujet.
// ⚠⚠ ET UN VETO NE SE JUGE **PAS** SUR LE WR DE SA POCHE. Sa poche est ce qu'il bloque ; ce qui
//   compte est ce que le moteur RAMENE avec et sans lui, une fois la capacite reallouee. Un veto
//   dont la poche perd peut coûter cher s'il libere des slots pour PIRE que ce qu'il bloquait.
// ⭐ PAR COTE, TOUJOURS : le depot a mesure 4 fois des regles dont les deux cotes concluent
//   l'INVERSE. Un total qui s'ameliore peut cacher un cote qui s'effondre.
// ⚠ `runMatrixPortfolio` : la capacite est GLOBALE. La sommer actif par actif donnerait un volume
//   qui n'existe sur aucun compte.
// ⚙ Usage : `LABEL="veto off" VETO_K_PLACE_DEVANT=off node stats/_ab_moteur.mjs`
// ⚠ `file:///C:/...` en dur : sur Windows un chemin absolu nu est refuse par le chargeur ESM.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { BONUS_APPLIQUE, MIN_CONT, MIN_PB, MIN_EXH } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const LABEL = process.env.LABEL ?? "(sans label)";

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
const sig = RUN.signals ?? [];
// ⭐⭐⭐ LE FUNNEL EST INDISPENSABLE ICI : deux runs peuvent rendre le MEME carnet pour deux raisons
//   opposees — la regle ne change rien, OU elle change quelque chose que la CAPACITE ravale
//   ensuite. `fires` (ce que le moteur voulait) contre `opened` (ce qu'il a pu prendre) separe
//   les deux. Sans cette ligne on conclurait « neutre » dans les deux cas.
const SUM = RUN.summary ?? {};

const cel = new Map();
const add = (k, t) => {
  const v = cel.get(k) ?? { n: 0, g: 0, R: 0 };
  v.n++; v.R += t.R ?? 0; if ((t.R ?? 0) > 0) v.g++;
  cel.set(k, v);
};
for (const t of sig) { add(`${t.strategy ?? "?"}|${t.side ?? "?"}`, t); add(`${t.strategy ?? "?"}|TOUS`, t); add(`TOTAL|${t.side ?? "?"}`, t); add("TOTAL|TOUS", t); }

console.log(`\n══ A/B MOTEUR — ${LABEL} ══`);
console.log(`   bonus ${BONUS_APPLIQUE ? "APPLIQUES" : "DEBRANCHES"} · MIN_EXH ${MIN_EXH} · MIN_PB ${MIN_PB} · MIN_CONT ${MIN_CONT}`);
console.log(`   VETO_K_PLACE_DEVANT = ${process.env.VETO_K_PLACE_DEVANT ?? "on (defaut)"}`);
console.log(`\n   rang    cote      tirs      WR         R      R/tir`);
for (const r of ["EXH", "PB", "CONT", "TOTAL"])
  for (const c of ["BUY", "SELL", "TOUS"]) {
    const v = cel.get(`${r}|${c}`); if (!v) continue;
    const mark = c === "TOUS" ? " <" : "  ";
    console.log(`   ${r.padEnd(6)} ${c.padEnd(5)} ${String(v.n).padStart(7)}  ${(100 * v.g / v.n).toFixed(2).padStart(6)} %  ${v.R.toFixed(1).padStart(8)}  ${(v.R / v.n).toFixed(4).padStart(8)}${mark}`);
  }
console.log(`
   FUNNEL  evals ${SUM.evals}  -> fires ${SUM.fires}  -> opened ${SUM.opened}`);
console.log(`           refuses par CAPACITE ${SUM.rejectedCap} - par SPACING ${SUM.rejSpacingTotal}`);
console.log(`\n   ⚠ point mort 75,0 % (spread facture) — un WR sous 75 % perd quel que soit le R.\n`);
