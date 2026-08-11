// _pb_wr_par_score_par_cote.mjs — LE SCORE PB TRIE-T-IL AUSSI BIEN DES DEUX COTES ?
//
// ⭐⭐⭐ LA QUESTION EST UN TEST DE MIROIR, PAS UNE VENTILATION. `conviction` est ORIENTEE
//   (`orient(v, side)` rend `−v` pour un SELL) : « +10 » veut dire « bon PB de SON cote » des DEUX
//   cotes. Une note donnee doit donc valoir LA MEME CHOSE en BUY et en SELL — c'est tout le contrat
//   du bareme. Si les deux colonnes divergent, ce n'est pas « le SELL paie moins » : c'est que la
//   note ne mesure pas la meme chose selon le cote, et le miroir est ROMPU.
// ⚠ CHARGE DE LA PREUVE SUR L'ASYMETRIE (regle du depot) : on ne conclut a un ecart que s'il tient
//   sur des effectifs qui portent. D'ou les colonnes `grap` AFFICHEES partout.
// ⭐⭐ ET ON NE FILTRE AUCUNE CASE PAR EFFECTIF (owner 11/08) : ecarter les cases peu peuplees retire
//   les QUEUES, rares PAR CONSTRUCTION — selection CORRELEE a la variable testee. On REGROUPE en
//   bandes (table ②) et on laisse la table ① montrer ses effectifs bruts, y compris minuscules.
// ⚠ Une voix par grappe actif×jour — les tirs ne sont pas independants (sigma gonfle x9).
// ⚠ `PB_ISOLE=1` ⇒ `exh-present-empeche` est INERTE (la regle porte `&& !_PB_ISOLE`). Voulu : on
//   mesure le BAREME seul, pas le routage.
// ⚠ Point mort 75,0 % (spread facture) — sous cette barre c'est une PERTE, pas une petite marge.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.PB_ISOLE = "1";
process.env.MIN_PB = process.env.MIN_PB ?? "-21";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = s => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = s => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const conv = s => s.sc?.boxes?.pb?.conviction;
const PB = all.filter(s => s.strategy === "PB" && fini(s) && Number.isFinite(conv(s)));
const BUY = PB.filter(s => s.side === "BUY"), SELL = PB.filter(s => s.side === "SELL");
const BE = 75;

const st = t => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()], R = t.reduce((a, b) => a + (b.R || 0), 0);
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length, R }; };

// ⭐ Une cellule par cote, cote a cote : l'ecart se lit SUR LA LIGNE, pas entre deux tableaux.
const cell = s => s ? String(s.n).padStart(5) + String(s.gr).padStart(5) + s.wrg.toFixed(1).padStart(8) + "%"
                      + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8) : "    —    —        —       —";
const ligne = (lbl, fb, fs_) => {
  const b = st(BUY.filter(fb)), s = st(SELL.filter(fs_));
  // ⚠ ECART affiche SEULEMENT si les deux cotes ont >= 20 grappes : en dessous il decrirait du bruit.
  //   On n'ECARTE PAS la ligne pour autant (elle reste lisible) — on refuse juste de la commenter.
  const ec = (b && s && b.gr >= 20 && s.gr >= 20) ? ((b.wrg - s.wrg >= 0 ? "+" : "") + (b.wrg - s.wrg).toFixed(1)).padStart(7) : "      ·";
  console.log("  " + lbl.padEnd(13) + cell(b) + " │" + cell(s) + " │" + ec);
};
const HEAD = () => {
  console.log("  " + " ".repeat(13) + "        B U Y          │        S E L L        │  ecart");
  console.log("  " + "note".padEnd(13) + " tirs grap  WR/grap       R │ tirs grap  WR/grap       R │ WR pts");
  console.log("  " + "─".repeat(13) + "─".repeat(27) + "┼" + "─".repeat(27) + "┼" + "─".repeat(8));
};

console.log(`\n═══ PB · WR PAR SCORE, PAR COTE ═══  [PB_ISOLE=1 · MIN_PB=${process.env.MIN_PB} · spread FACTURE]`);
const sb = st(BUY), ss = st(SELL);
console.log(`  ${PB.length} tirs · BUY ${sb.n} (${sb.gr} grap) · SELL ${ss.n} (${ss.gr} grap) · point mort 75,0 %`);
console.log(`  ⭐ `+"`conviction` est ORIENTEE : une meme note doit valoir LA MEME CHOSE des deux cotes.\n");

console.log("  ── ① PAR VALEUR EXACTE (aucune case ecartee — les effectifs sont AFFICHES) ──");
HEAD();
const vals = [...new Set(PB.map(conv))].sort((a, b) => a - b);
for (const v of vals) ligne(String(v), s => conv(s) === v, s => conv(s) === v);

console.log("\n  ── ② PAR BANDE (regroupe, pas filtre) ──");
HEAD();
const B = [["<= −14", v => v <= -14], ["−13..−8", v => v <= -8 && v > -14], ["−7..+2", v => v >= -7 && v <= 2],
           ["+3..+10", v => v >= 3 && v <= 10], [">= +11", v => v >= 11]];
for (const [l, f] of B) ligne(l, s => f(conv(s)), s => f(conv(s)));

console.log("\n  ── ③ CUMULATIF (score >= v) — c'est CETTE table qui parle de `MIN_PB` ──");
HEAD();
for (const v of vals) ligne("≥ " + v, s => conv(s) >= v, s => conv(s) >= v);
console.log("\n  ⚠ Un `MIN_PB` unique se lit sur les DEUX colonnes a la fois : le depot exige de");
console.log("     CREDITER UNE REGLE DE SON COTE LE PLUS FAIBLE, pas de la moyenne des deux.\n");
