// _exh_queue_negative.mjs — LA QUEUE NEGATIVE DU BAREME EXH : QUE VAUT-ELLE, ET QUI LA FABRIQUE ?
//
// ⭐⭐⭐ LA QUESTION (owner 11/08). `conviction < −20` veut dire que le bareme AFFIRME, avec force,
//   que la barre n'est PAS un fade de ce cote. Or ces barres gagnent — autour ou au-dessus du point
//   mort, cote BUY comme cote SELL. **Un score qui se trompe au milieu est mal regle ; un score qui
//   se trompe A SON EXTREME dit qu'il mesure autre chose que ce qu'il croit.**
// ⚠ En prod ces barres ne tirent PAS (`MIN_EXH = 10`). La question n'est donc pas « faut-il les
//   prendre » mais « pourquoi le bareme les condamne-t-il ? » — c'est un diagnostic de SIGNE, pas un
//   gisement de R. Cf. le point C du 10/08 : la famille AHEAD etait ANTI-CORRELEE a la qualite.
//
// ⚠⚠ ON NE FILTRE AUCUNE BANDE PAR EFFECTIF : les bandes les plus profondes sont peu peuplees PAR
//   CONSTRUCTION (il faut que huit entrees s'accordent dans le meme sens). Les ecarter retirerait
//   exactement ce qu'on veut regarder. Les `grap` sont AFFICHES, et l'ecart BUY/SELL n'est commente
//   que si les deux cotes ont >= 20 grappes.
// ⚠ Une voix par grappe actif×jour · spread facture · capacite active (`maxOpen 30`).
// ⚠ `MIN_EXH` tres bas ⇒ toute la queue tire ; `MIN_PB`/`MIN_CONT` a 1000 ⇒ SEUL l'EXH tire.
//   usage : node stats/_exh_queue_negative.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_EXH = process.env.MIN_EXH ?? "-91";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const conv = (s) => s.sc?.boxes?.exh?.conviction;
const EXH = all.filter((s) => s.strategy === "EXH" && fini(s) && Number.isFinite(conv(s)));
const BUY = EXH.filter((s) => s.side === "BUY"), SELL = EXH.filter((s) => s.side === "SELL");
const BE = 75;

const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           bas: v.filter((o) => o.w / o.n < BE / 100).length }; };
const cell = (s) => s ? String(s.gr).padStart(5) + s.wrg.toFixed(1).padStart(8) + "%" + String(s.bas).padStart(5)
                      : "    —        —    —";

console.log(`\n═══ EXH · LA QUEUE NEGATIVE (score < −20) ═══  [MIN_EXH=${process.env.MIN_EXH} · spread FACTURE]`);
console.log(`  point mort 75,0 %  ·  \`grap\` = grappes actif×jour  ·  \`<BE\` = grappes sous le point mort\n`);
console.log("  " + " ".repeat(14) + "     B U Y          │      S E L L        │ ecart");
console.log("  " + "bande".padEnd(14) + " grap  WR/grap  <BE │ grap  WR/grap  <BE │ WR pts");
console.log("  " + "─".repeat(14) + "─".repeat(21) + "┼" + "─".repeat(21) + "┼" + "─".repeat(7));
const ligne = (lbl, f) => {
  const b = st(BUY.filter(f)), s = st(SELL.filter(f));
  const ec = (b && s && b.gr >= 20 && s.gr >= 20)
    ? ((b.wrg - s.wrg >= 0 ? "+" : "") + (b.wrg - s.wrg).toFixed(1)).padStart(6) : "     ·";
  console.log("  " + lbl.padEnd(14) + cell(b) + " │" + cell(s) + " │" + ec);
};
for (let lo = -55; lo < -20; lo += 5) ligne(`[${lo} · ${lo + 5}[`, (s) => conv(s) >= lo && conv(s) < lo + 5);
console.log("  " + "─".repeat(14) + "─".repeat(21) + "┼" + "─".repeat(21) + "┼" + "─".repeat(7));
ligne("TOUTE < −20", (s) => conv(s) < -20);
ligne("reference ≥ 0", (s) => conv(s) >= 0);

// ⭐⭐⭐ QUI FABRIQUE LA QUEUE ? La moyenne de CHAQUE entree sur la population `< −20`, comparee a la
//   population `≥ 0`. Une entree qui ne bouge pas entre les deux ne CONTRIBUE PAS a la condamnation.
console.log("\n  ── QUI CONDAMNE CES BARRES ? moyenne de chaque entree, en repere ORIENTE ──");
console.log("  ⚠ Les parts sont SIGNEES (`+` = BUY) : on les oriente par le cote pour les rendre");
console.log("     comparables entre BUY et SELL — sinon les moyennes s'annuleraient.\n");
const ENTREES = ["gap", "adx", "di", "kH1", "kH4", "rsiM15", "dRsi", "kdH1"];
const moy = (t, k) => { const v = t.map((s) => { const p = s.sc?.boxes?.exh?.parts?.[k];
    return Number.isFinite(p) ? (s.side === "BUY" ? p : -p) : null; }).filter((x) => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const queue = EXH.filter((s) => conv(s) < -20), haut = EXH.filter((s) => conv(s) >= 0);
console.log("  " + "entree".padEnd(10) + "  < −20".padStart(9) + "   ≥ 0".padStart(9) + "   ecart".padStart(9));
for (const k of ENTREES) {
  const a = moy(queue, k), b = moy(haut, k);
  const f = (x) => x == null ? "     —" : ((x >= 0 ? "+" : "") + x.toFixed(2)).padStart(9);
  console.log("  " + k.padEnd(10) + f(a) + f(b) + f(a != null && b != null ? a - b : null));
}
console.log(`\n  populations : < −20 = ${queue.length} tirs · ≥ 0 = ${haut.length} tirs\n`);
