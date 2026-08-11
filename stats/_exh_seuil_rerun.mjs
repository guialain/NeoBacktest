// _exh_seuil_rerun.mjs — LE BALAYAGE DE `MIN_EXH`, UN RUN COMPLET PAR SEUIL.
//
// ⭐⭐⭐ POURQUOI UN PROCESS PAR SEUIL, ET PAS UNE TRANCHE (owner 11/08, deux fois dans la journee) :
//   **NE PAS PRENDRE UN TIR LIBERE UN CRENEAU POUR UN MEILLEUR.** Les tirs sont CONCURRENTS, pas
//   additifs — `maxOpen 30`, 8 par actif, plus l'espacement prix. Decouper un carnet DEJA PRODUIT
//   applique la capacite a l'allocation D'ORIGINE : les places rendues par les barres coupees ne
//   sont rendues a personne. Seul un RE-RUN les reattribue.
// ⚠⚠ ET `MIN_EXH` EST LU A L'IMPORT (`_envNum`) : on ne peut PAS le changer en cours de process.
//   D'ou un process par seuil — c'est la contrainte qui a impose la meme forme a `_seuil_v1_balayage`.
// ⚠ L'allocation est `best-score-first` : dans un run ou tout tire, les scores hauts prennent les
//   creneaux en priorite et les bas n'entrent que dans les creux. C'est exactement ce biais que le
//   re-run supprime — a seuil haut, les bas n'existent plus du tout, donc plus de file d'attente.
//
//   usage : MIN_EXH=<n> node stats/_exh_seuil_rerun.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const SEUIL = process.env.MIN_EXH ?? "(defaut)";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (s.strategy === "EXH" && (s.outcome === "WIN" || s.outcome === "LOSS"))
    all.push({ a, w: s.outcome === "WIN", R: s.R, j: String(s.tsMT).slice(0, 10).replace(/\./g, "-"), side: s.side });
}
// ⭐ WR par GRAPPE actif×jour — les tirs ne sont pas independants (sigma gonfle x9).
const wrg = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.a + "|" + x.j; if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.w) o.w++; }
  const v = [...g.values()];
  return { gr: v.length, wr: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length }; };
// ⚠ maxDD sur la serie triee par DATE — un DD calcule dans l'ordre d'apparition des actifs ne veut rien dire.
const dd = (t) => { const s = [...t].sort((a, b) => a.j.localeCompare(b.j));
  let eq = 0, pk = 0, m = 0; for (const x of s) { eq += x.R; pk = Math.max(pk, eq); m = Math.max(m, pk - eq); } return m; };
const ligne = (lbl, t) => {
  if (!t.length) return `${lbl.padEnd(6)}${"0".padStart(6)}` + "        —".repeat(5);
  const g = wrg(t), R = t.reduce((a, b) => a + b.R, 0), D = dd(t);
  return lbl.padEnd(6) + String(t.length).padStart(6) + String(g.gr).padStart(6)
    + g.wr.toFixed(1).padStart(8) + "%" + R.toFixed(1).padStart(9)
    + (R / t.length).toFixed(3).padStart(8) + D.toFixed(1).padStart(8)
    + (R / Math.max(D, 0.01)).toFixed(2).padStart(7);
};
console.log(`SEUIL ${String(SEUIL).padStart(4)} | ` + ligne("tout", all)
  + "  ║ " + ligne("BUY", all.filter((x) => x.side === "BUY"))
  + "  ║ " + ligne("SELL", all.filter((x) => x.side === "SELL")));
