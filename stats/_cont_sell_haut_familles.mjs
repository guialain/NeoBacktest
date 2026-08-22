// _cont_sell_haut_familles.mjs — QUELLE FAMILLE POUSSE LE SCORE EN HAUT DU SELL ?
//
// 🎯 QUESTION OUVERTE DEPUIS LE MATIN, et elle a survecu a la refonte de `rsi` ET a l ajout du
//   modulateur : cote SELL le bareme se RETOURNE au-dela de 20 (82,5 % en [15·20[ puis 73,7 % en
//   [20·25[, R negatif), alors que le BUY monte proprement (86,0 → 89,5).
//
// ⭐⭐⭐ CE QUI ISOLE LE COUPABLE, ET IL FAUT LES DEUX COMPARAISONS :
//   ① SELL haut CONTRE SELL pic  — ce qui a CHANGE quand le score est monte trop haut ;
//   ② SELL haut CONTRE BUY haut  — la meme famille se comporte-t-elle AUTREMENT selon le cote ?
//   Une famille coupable doit bouger dans ① **et** differer dans ②. Si les cinq montent ensemble
//   en ①, aucune famille n est coupable et l information n est dans AUCUNE des cinq — c est ce
//   qu on avait trouve le 21/08, et c est le resultat qu il faut pouvoir re-obtenir.
//
// ⚠ On bande sur le score APRES modulateur (celui qui DECIDE), mais on imprime AUSSI le score AVANT
//   et le modulateur moyen : sans eux on ne saurait pas si une tranche est haute parce que les
//   familles poussent ou parce que le modulateur est genereux.
// ⚠ Les familles sont des moyennes ponderees internes, bornees [0 · 10]. Une famille MUETTE sort de
//   la somme — elle est comptee a part, jamais lue comme un `0`.
//   usage : node stats/_cont_sell_haut_familles.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { CONT_ECHELLE } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/contScoringV1.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s) && Number.isFinite(s.sc?.cont));
const NOMS = CONT_ECHELLE.familles;
const fam = (s, n) => s.sc?.boxes?.cont?.familles?.[n];
const wrg = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const p = [...g.values()].map((o) => o.w / o.n);
  return { gr: p.length, wr: 100 * p.reduce((a, b) => a + b, 0) / p.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const moy = (t, f) => { const v = t.map(f).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const TR = [[5,10],[10,15],[15,20],[20,25],[25,45]];

const HEAD = () => { console.log("  " + "tranche".padEnd(11) + "tirs".padStart(6) + "grap".padStart(5) + "WR/grap".padStart(9) + "R".padStart(8)
  + "  │" + NOMS.map((n) => n.padStart(8)).join("") + "  │" + "avant".padStart(8) + "mod".padStart(7));
  console.log("  " + "─".repeat(39) + "┼" + "─".repeat(8 * NOMS.length) + "─┼" + "─".repeat(15)); };
const L = (lbl, t) => { const s = wrg(t);
  console.log("  " + lbl.padEnd(11) + String(t.length).padStart(6) + String(s ? s.gr : 0).padStart(5)
    + (s ? s.wr.toFixed(1) + "%" : "—").padStart(9) + (s ? ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)) : "—").padStart(8)
    + "  │" + NOMS.map((n) => { const m = moy(t, (x) => fam(x, n)); return (m === null ? "—" : m.toFixed(2)).padStart(8); }).join("")
    + "  │" + (moy(t, (x) => x.sc.contPreMod) ?? 0).toFixed(1).padStart(8) + (moy(t, (x) => x.sc.msMod) ?? 0).toFixed(3).padStart(7)); };

console.log(`\n═══ QUELLE FAMILLE POUSSE LE HAUT DU SELL ? ═══  [MIN_CONT=${process.env.MIN_CONT ?? "defaut 5"}]`);
console.log(`  ${CONT.length} tirs · familles ${NOMS.join(" + ")} · echelle [${CONT_ECHELLE.min} · ${CONT_ECHELLE.max}]`);
for (const cote of ["SELL", "BUY"]) {
  const C = CONT.filter((s) => s.side === cote);
  const ref = wrg(C);
  console.log(`\n  ══ ${cote} ══  ${C.length} tirs · ${ref.gr} grappes · ${ref.wr.toFixed(1)} %`);
  HEAD();
  for (const [lo, hi] of TR) L(hi === 45 ? "≥ 25" : `${lo}-${hi}`, C.filter((s) => s.sc.cont >= lo && s.sc.cont < hi));
}

console.log(`\n  ══ ② LE MEME NIVEAU DE SCORE, LES DEUX COTES — la famille qui DIFFERE est la piste ══`);
for (const [lo, hi] of [[15, 20], [20, 45]]) {
  const b = CONT.filter((s) => s.side === "BUY"  && s.sc.cont >= lo && s.sc.cont < hi);
  const v = CONT.filter((s) => s.side === "SELL" && s.sc.cont >= lo && s.sc.cont < hi);
  console.log(`\n  ── score ${hi === 45 ? "≥ 20" : `[${lo} · ${hi}[`} ──`);
  HEAD(); L("BUY", b); L("SELL", v);
  console.log("  " + "ecart".padEnd(11) + "".padStart(28) + "  │"
    + NOMS.map((n) => { const mb = moy(b, (x) => fam(x, n)), mv = moy(v, (x) => fam(x, n));
        return (mb === null || mv === null ? "—" : ((mb - mv >= 0 ? "+" : "") + (mb - mv).toFixed(2))).padStart(8); }).join(""));
}
console.log(`\n  ⚠ Une moyenne de famille NE PROUVE RIEN seule : elle oriente. Une famille coupable doit`);
console.log(`     bouger dans ① ET differer dans ②. Si les cinq montent ensemble, aucune n est coupable.\n`);
