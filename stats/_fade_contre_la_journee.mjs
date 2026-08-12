// _fade_contre_la_journee.mjs — LE RANG ① PERD-IL QUAND IL FADE UNE JOURNEE QUI AVANCE ENCORE ?
// ============================================================================================
// 🎯 PREREQUIS NOMME (owner 12/08, sur `US_TECH100` le 04/08) : « il y a eu de fortes hausses sur la
//   periode, et le prix montait MEME QUAND LES INDICATEURS SATURAIENT ». Ce jour-la le moteur a pris
//   UN seul trade sur cet actif — un EXH SELL a 09:39 — sur une journee a **+2,59 %**, RSI H1 jamais
//   sous 68,3, `zscore_h1` entre +1,0 et +3,1. Il a perdu.
//   ⇒ La question : est-ce une anecdote, ou le rang ① perd-il SYSTEMATIQUEMENT quand la journee a
//   deja avance CONTRE le sens qu'il fade ?
//
// ⚠⚠ CAUSALITE — LE POINT LE PLUS IMPORTANT DE CETTE SONDE. On lit `intraday_change` **A LA BARRE
//   D'ENTREE**, c'est-a-dire le mouvement DEJA FAIT depuis l'open. ⛔ Utiliser le mouvement TOTAL de
//   la journee serait du LOOKAHEAD : on trierait les trades avec une information que le moteur n'a
//   pas au moment de decider, et toute regle qui en sortirait serait INAPPLICABLE.
//   ⭐ `intraday_change` n'a pas de `_s0` : c'est un % depuis l'open, donc intrinsequement LIVE.
//
// ⭐ ORIENTE CONTRE LE FADE : `icContre > 0` = la journee a deja avance DANS LE SENS QUE LE TRADE
//   CONTRARIE (un SELL sur une journee en hausse). C'est la grandeur qui a un sens, pas le % brut —
//   sinon les deux cotes se compensent et la courbe est plate par construction.
// ⚠ LE CONT SERT DE TEMOIN : lui va DANS le sens de la journee. Si l'EXH se degrade quand `icContre`
//   monte et que le CONT s'ameliore, l'effet est propre au FADE et non a la volatilite du jour.
//   Sans ce temoin on ne pourrait pas distinguer les deux.
// ⚠ WR PAR GRAPPE actif x jour · point mort 75,0 % (spread facture).
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv"), p = path.join(DIR, f);
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/); const h = L[0].split(";");
  const iT = h.indexOf("timestamp"), iIC = h.indexOf("intraday_change");
  const ic = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); ic.set(c[iT], c[iIC]); }
  for (const s of (runMatrixBacktest(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || [])) {
    if (typeof s.R !== "number") continue;
    const v = ic.get(s.tsMT);
    // ⚠ `""` exclu AVANT Number() : `Number("") = 0` tomberait dans la bande centrale et diluerait
    //   exactement la case qu'on veut lire. Piege repris le 09/08.
    if (v === "" || v == null || !Number.isFinite(Number(v))) continue;
    all.push({ ...s, asset: a, ic: Number(v) });
  }
}
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wr: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
// ⭐ POUR L'EXH le fade est CONTRE la journee ; pour le CONT il va AVEC. Meme formule, sens oppose.
const contre = (s) => (s.side === "SELL" ? s.ic : -s.ic);
const avec   = (s) => (s.side === "BUY" ? s.ic : -s.ic);

const BANDES = [[-99, -1], [-1, -0.5], [-0.5, -0.2], [-0.2, 0.2], [0.2, 0.5], [0.5, 1], [1, 99]];
const LBL = ["< -1,0 %", "[-1,0 · -0,5[", "[-0,5 · -0,2[", "[-0,2 · +0,2]", "]0,2 · 0,5]", "]0,5 · 1,0]", "> +1,0 %"];
const cel = (v) => v ? String(v.n).padStart(6) + String(v.gr).padStart(5) + v.wr.toFixed(1).padStart(7) + "%"
                       + ((v.R >= 0 ? "+" : "") + v.R.toFixed(1)).padStart(8) : "     —    —      —       —";

for (const [nom, rang, f, sens] of [
  ["① EXH — la journee a deja avance CONTRE le fade", "EXH", contre, "CONTRE le fade"],
  ["③ CONT — temoin : la journee va DANS son sens", "CONT", avec, "AVEC le trade"]]) {
  const T = all.filter((s) => s.strategy === rang && fini(s));
  console.log(`\n══ ${nom} ══   (${T.length} tirs · \`intraday_change\` A L'ENTREE, pas la journee finie)`);
  console.log(`   ${sens.padEnd(15)}   tirs grap     WR       R`);
  console.log(`   ` + "─".repeat(45));
  for (let i = 0; i < BANDES.length; i++) {
    const [lo, hi] = BANDES[i];
    console.log(`   ${LBL[i].padEnd(15)}` + cel(st(T.filter((s) => f(s) >= lo && f(s) < hi))));
  }
  console.log(`   ` + "─".repeat(45));
  console.log(`   ${"TOUS".padEnd(15)}` + cel(st(T)));
  const gros = st(T.filter((s) => f(s) > 1)), reste = st(T.filter((s) => f(s) <= 1));
  if (gros && reste) console.log(`   ⇒ au-dela de +1,0 % : ${gros.wr.toFixed(1)} % (${gros.gr} grap, R ${gros.R.toFixed(1)}) contre ${reste.wr.toFixed(1)} % ailleurs`);
}
console.log(`\n  ⚠ Point mort 75,0 %. ⭐ Si l'EXH CHUTE quand la journee a deja avance contre lui ET que`);
console.log(`     le CONT ne bouge pas, l'effet est propre au FADE — pas a la volatilite du jour.\n`);
