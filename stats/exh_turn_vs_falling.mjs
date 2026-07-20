// ============================================================================================
// exh_turn_vs_falling.mjs — LA DÉRIVÉE SECONDE DE L'ADX PORTE-T-ELLE DE L'INFORMATION DANS L'EXH ?
// --------------------------------------------------------------------------------------------
// LE PROBLÈME : la table de score met TURN_DOWN et FALLING à la MÊME valeur (TRES_ATTENDU). Or
//   distinguer « l'ADX vient de se retourner » de « il s'érode depuis 2 h » est la RAISON MÊME
//   d'avoir calculé une dérivée seconde. Si les deux paient pareil, la dérivée seconde ne sert à
//   rien ici et il faut lire Δ₁ seul (plus simple, un capteur de moins à entretenir).
//
// ⭐ RAPPEL D'ARITHMÉTIQUE : le gate exige Δ₁ ≤ −1,8 et la bande morte vaut 1,0 ⇒ RISING et TURN_UP
//   sont INATTEIGNABLES après le gate. On n'attend donc QUE {TURN_DOWN, FALLING, FLAT} — et FLAT ne
//   peut pas franchir 0,70. Si ce script sort du RISING, l'arithmétique est fausse quelque part.
//
// Usage : node --max-old-space-size=12288 stats/exh_turn_vs_falling.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const mk = () => ({ n: 0, w: 0, l: 0, R: 0 });
const bump = (o, s) => { o.n++; o.R += s.R; if (s.outcome === "WIN") o.w++; else if (s.outcome === "LOSS") o.l++; };
const exh = {}, cont = {};
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (typeof s.R !== "number") continue;
    const t = s.dominanceTurn ?? "(null)";
    const tgt = s.type === "EXHAUSTION" ? exh : cont;
    tgt[t] = tgt[t] || mk(); bump(tgt[t], s);
  }
const f3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3), f1 = (v) => (v >= 0 ? "+" : "") + v.toFixed(1);
const wr = (o) => (o.w + o.l) ? (o.w / (o.w + o.l) * 100).toFixed(1) + " %" : "—";
const show = (title, m) => {
  const tot = Object.values(m).reduce((a, o) => a + o.n, 0);
  console.log(`\n${title} (n=${tot})`);
  console.log("  dominanceTurn      n    part      WR       avgR      totalR");
  for (const [k, o] of Object.entries(m).sort((a, b) => b[1].n - a[1].n))
    console.log(`  ${k.padEnd(14)}${String(o.n).padStart(5)}  ${(o.n / tot * 100).toFixed(1).padStart(5)} %  ${wr(o).padStart(7)}  ${f3(o.R / o.n).padStart(8)}  ${f1(o.R).padStart(9)}`);
};
show("EXH — la question posée", exh);
show("CONT — témoin (le gate ΔADX ne s'y applique PAS ⇒ les 5 valeurs doivent apparaître)", cont);
