// _exh_kdh1_sous_pression.mjs — `kdH1` TRIE-T-IL ENCORE QUAND LA PRESSION EST FORTE ?
// ============================================================================================
// 🎯 DICTEE OWNER (12/08) : « il faut diminuer le poids du kdH1 ou meme le supprimer, il pese trop
//   et ne donne plus d'info en cas de FORTE PRESSION ». C'est un enonce TESTABLE, et c'est ce qui
//   le distingue d'une preference : on peut le refuter.
// ⭐ CE QU'ON MESURE : le pouvoir DISCRIMINANT de `kdH1`, separement selon la pression. Si sa note
//   trie a pression faible et devient plate a pression forte, l'owner a raison et le poids doit
//   suivre la population, pas la moyenne.
// ⚠ « PRESSION » = la pente de la MOYENNE orientee CONTRE le fade — le capteur mesure aujourd'hui
//   comme le plus fort du rang ① (73,0 % a `FLAT` -> 83,7 % a `EXPLOSIVE_UP`). C'est la meilleure
//   definition operationnelle qu'on ait de « l'extreme est encore alimente ».
// ⚠⚠ ON NE COMPARE PAS DES WR ENTRE REGIMES, ON COMPARE DES **ECARTS INTERNES**. Le regime « forte
//   pression » gagne plus en moyenne : lire ses WR bruts ferait croire que `kdH1` y marche mieux.
//   Ce qui compte est l'ECART entre ses notes A L'INTERIEUR de chaque regime.
// ⚠ WR PAR GRAPPE actif x jour · point mort 75,0 %.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixBacktest } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const D = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { computeDeviation, DELTA_COL_MIRROR } = await import(D);
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const FORT = new Set(["FAST_UP", "EXPLOSIVE_UP"]);
const T = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f), sym = path.basename(f, ".csv");
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/); const h = L[0].split(";");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); rows.set(c[h.indexOf("timestamp")], c); }
  for (const s of (runMatrixBacktest(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || [])) {
    if (s.strategy !== "EXH" || typeof s.R !== "number") continue;
    const note = s.sc?.boxes?.exh?.parts?.kdH1;
    if (!Number.isFinite(note)) continue;
    const c = rows.get(s.tsMT); if (!c) continue;
    const d = computeDeviation(Object.fromEntries(h.map((k, i) => [k, c[i]])), sym.toUpperCase(), "h1");
    if (!d?.meanSlopeBand) continue;
    const contre = s.side === "SELL" ? d.meanSlopeBand : DELTA_COL_MIRROR[d.meanSlopeBand];
    // ⭐ NOTE ORIENTEE : `kdH1` est SIGNEE (+ = BUY). On la remet en QUALITE pour que « fort » veuille
    //   dire la meme chose des deux cotes — sinon les deux moities se compensent et la courbe est plate.
    T.push({ ...s, asset: sym, q: s.side === "SELL" ? -note : note, pression: FORT.has(contre) ? "FORTE" : "faible" });
  }
  rows.clear();
}
const jour = (s) => String(s.tsMT || "").slice(0, 10);
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wr: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const cel = (v) => v ? String(v.n).padStart(6) + String(v.gr).padStart(5) + v.wr.toFixed(1).padStart(7) + "%" + ((v.R >= 0 ? "+" : "") + v.R.toFixed(1)).padStart(8) : "     —    —      —       —";
const NOTES = [...new Set(T.map((x) => x.q))].sort((a, b) => a - b);
console.log(`\n══ RANG ① · le pouvoir discriminant de \`kdH1\` selon la PRESSION (${T.length} tirs) ══`);
console.log(`   note ORIENTEE en qualite (+ = soutient le fade) · point mort 75,0 %\n`);
for (const reg of ["faible", "FORTE"]) {
  const S = T.filter((x) => x.pression === reg);
  console.log(`  ── pression ${reg} — ${S.length} tirs (${(100 * S.length / T.length).toFixed(1)} % du volume) ──`);
  console.log(`     note kdH1      tirs grap     WR       R`);
  const vus = [];
  for (const n of NOTES) {
    const a = st(S.filter((x) => x.q === n));
    if (a) { console.log(`     ${String(n).padStart(6)}      ` + cel(a)); vus.push(a); }
  }
  const bons = st(S.filter((x) => x.q >= 8)), mauvais = st(S.filter((x) => x.q <= -5));
  if (bons && mauvais) console.log(`     ⇒ ECART haut(>=+8) vs bas(<=-5) : ${(bons.wr - mauvais.wr >= 0 ? "+" : "") + (bons.wr - mauvais.wr).toFixed(1)} pts  (${bons.gr} vs ${mauvais.gr} grappes)`);
  console.log("");
}
console.log(`  ⭐ SI l'ecart s'effondre a pression FORTE, l'owner a raison : le capteur y est INERTE.\n`);
