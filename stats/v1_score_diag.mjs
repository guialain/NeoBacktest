// v1_score_diag.mjs — POURQUOI LE SELL NE TRIE-T-IL PAS ? DIAGNOSTIC ENTRÉE PAR ENTRÉE.
// ============================================================================================
// ⭐⭐⭐ TROIS LECTURES, ET ELLES NE DISENT PAS LA MÊME CHOSE :
//   ① CHAQUE ENTRÉE SEULE — sa note contre le WR, BUY et SELL côte à côte. Dit QUELLE entrée se
//      comporte différemment d'un côté à l'autre.
//   ② LEAVE-ONE-OUT — on retire une entrée et on regarde si le SELL se met à trier. Dit laquelle
//      EMPÊCHE. ⭐ C'est le seul des trois qui teste une CAUSE et pas une corrélation.
//   ③ CHAQUE ENTRÉE COMME SCORE UNIQUE — dit laquelle POURRAIT trier toute seule.
//
// 🔴🔥 QUINTILES, PAS BANDES FIXES. Retirer une entrée change l'ÉCHELLE du total : des bandes fixes
//   (`≥30`…) compareraient des populations de tailles différentes et feraient passer un changement
//   d'échelle pour un changement de pouvoir de tri. Les quintiles sont invariants d'échelle — c'est
//   la seule façon de comparer 7 variantes du même score.
// ⚠ Les ex-æquo sont massifs (le score est une somme d'entiers) : les quintiles sont donc APPROXIMÉS
//   par découpage sur les valeurs triées, et leurs effectifs ne sont pas égaux. C'est écrit à côté.
//
// 🔴🔥 UNE VOIX PAR GRAPPE (actif×jour) pour tout σ. Par tir, σ serait gonflé ~×9.
//
// ⚠⚠ CE QUE CE DIAGNOSTIC NE PEUT PAS FAIRE, ET IL FAUT LE LIRE AVEC : le carnet est DÉJÀ
//   CONDITIONNÉ par le routeur. `%K H1` n'y prend que 3 valeurs par côté (troncature), et le `%K H4`
//   comme le `%K M15` ont vu une partie de leur population routée ailleurs. Une entrée qui « ne trie
//   pas » ici peut simplement avoir été privée de sa variance en amont. Le `gap`, l'`ADX`, le `DI` et
//   le `RSI M15`, eux, ne sont contraints par aucune règle de routage : ceux-là se lisent à plein.
import fs from "fs";
import { exhScoreV1 } from "../../Matrix-Revolution/src/components/robot/engines/scoring/exhScoringV1.js";

const API = "http://localhost:3001/api/matrix";
const RUN = "maxOpen=100000&cadenceMin=2&spacing=false&chargeSpread=true";
const CACHE = "analyse_out/v3/v1_inputs.jsonl";

let tirs = [];
if (fs.existsSync(CACHE) && !process.env.REFETCH) {
  tirs = fs.readFileSync(CACHE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  console.log(`(cache ${CACHE} — ${tirs.length} tirs)`);
} else {
  const assets = await (await fetch(`${API}/assets`)).json();
  for (const a of assets) {
    const j = await (await fetch(`${API}/run/${a}?${RUN}`)).json();
    if ((j.summary?.rejectedCap ?? 0) || (j.summary?.rejSpacingTotal ?? 0)) throw new Error(`${a}: capacité mord`);
    for (const s of j.signals || []) {
      if (s.strategy !== "EXH") continue;
      if (s.outcome !== "WIN" && s.outcome !== "LOSS") continue;
      tirs.push({ asset: a, side: s.side, jour: Math.floor(s.ep / 1440),
                  win: s.outcome === "WIN" ? 1 : 0, R: s.R,
                  gapLevelLive: s.gapLevelLive ?? null, diBandLive: s.diGapBandH1 ?? null,
                  adxLive: s.adxH1Live ?? null, kH1Live: s.kH1 ?? null,
                  kH4Live: s.kH4 ?? null, rsiM15Live: s.rsiM15Live ?? null });
    }
  }
  fs.writeFileSync(CACHE, tirs.map((t) => JSON.stringify(t)).join("\n"));
  console.log(`→ ${CACHE} (${tirs.length} tirs)`);
}

const ENTREES = ["gap", "di", "adx", "kH1", "kH4", "rsiM15"];
const scoreDe = (t) => exhScoreV1({ gapLevelLive: t.gapLevelLive, diBandLive: t.diBandLive, adxLive: t.adxLive,
                                    kH1Live: t.kH1Live, kH4Live: t.kH4Live, rsiM15Live: t.rsiM15Live, side: t.side });
for (const t of tirs) { const s = scoreDe(t); t.parts = s.parts; t.total = s.total; }
// ⭐ ORIENTÉ : « à quel point la cellule aime CE trade », croissant des deux côtés.
const or = (t, v) => v == null ? null : (t.side === "BUY" ? v : -v);

// ── outils ──────────────────────────────────────────────────────────────────────────────────
function bloc(rows) {
  const n = rows.length; if (!n) return { n: 0 };
  const g = new Map();
  for (const r of rows) { const k = `${r.asset}|${r.jour}`; (g.get(k) ?? g.set(k, []).get(k)).push(r.win); }
  const mg = [...g.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length);
  const mu = mg.reduce((a, b) => a + b, 0) / mg.length;
  const sd = mg.length > 1 ? Math.sqrt(mg.reduce((a, b) => a + (b - mu) ** 2, 0) / (mg.length - 1)) : NaN;
  return { n, grappes: g.size, wr: 100 * rows.reduce((a, r) => a + r.win, 0) / n,
           sigma: 100 * sd / Math.sqrt(g.size), R: rows.reduce((a, r) => a + r.R, 0) };
}
/** Quintiles APPROCHÉS (ex-æquo massifs) : on coupe sur les valeurs triées, pas sur des seuils ronds. */
function quintiles(rows, val) {
  const ok = rows.filter((r) => val(r) != null).sort((a, b) => val(a) - val(b));
  const out = [];
  for (let q = 0; q < 5; q++) out.push(ok.slice(Math.floor(q * ok.length / 5), Math.floor((q + 1) * ok.length / 5)));
  return out;
}
/** Pouvoir de tri = WR(Q5) − WR(Q1), en points, avec le σ de la différence (grappes indépendantes). */
function tri(rows, val) {
  const q = quintiles(rows, val);
  const a = bloc(q[0]), b = bloc(q[4]);
  if (!a.n || !b.n) return { d: NaN };
  return { d: b.wr - a.wr, s: Math.sqrt(a.sigma ** 2 + b.sigma ** 2), q1: a.wr, q5: b.wr, n: rows.length };
}

const BUY = tirs.filter((t) => t.side === "BUY"), SELL = tirs.filter((t) => t.side === "SELL");
console.log(`\ncarnet EXH ${tirs.length} tirs — BUY ${BUY.length} · SELL ${SELL.length} · spread FACTURÉ, point mort 75,0 %`);

// ── ① CHAQUE ENTRÉE SEULE : sa note contre le WR ─────────────────────────────────────────────
console.log(`\n══ ① CHAQUE ENTRÉE SEULE — WR par valeur de sa note (orientée)`);
for (const e of ENTREES) {
  const vals = [...new Set(tirs.map((t) => or(t, t.parts[e])).filter((v) => v != null))].sort((a, b) => a - b);
  console.log(`\n  ${e}`);
  console.log(`    note      BUY : tirs     WR   ±σ        R    │  SELL : tirs     WR   ±σ        R`);
  for (const v of vals) {
    const b = bloc(BUY.filter((t) => or(t, t.parts[e]) === v)), s = bloc(SELL.filter((t) => or(t, t.parts[e]) === v));
    const f = (x) => x.n ? `${String(x.n).padStart(6)}  ${x.wr.toFixed(1).padStart(5)} % ±${x.sigma.toFixed(1).padStart(4)} ${x.R.toFixed(1).padStart(8)}` : `${"—".padStart(6)}`;
    console.log(`    ${String(v).padStart(4)}         ${f(b)}    │         ${f(s)}`);
  }
  const tb = tri(BUY, (t) => or(t, t.parts[e])), ts = tri(SELL, (t) => or(t, t.parts[e]));
  console.log(`    pouvoir de tri (Q5−Q1) :  BUY ${tb.d.toFixed(1).padStart(6)} pts ±${tb.s.toFixed(1)}   │  SELL ${ts.d.toFixed(1).padStart(6)} pts ±${ts.s.toFixed(1)}`);
}

// ── ② LEAVE-ONE-OUT : laquelle EMPÊCHE le SELL de trier ? ────────────────────────────────────
console.log(`\n\n══ ② LEAVE-ONE-OUT — on RETIRE une entrée, le tri s'améliore-t-il ?`);
console.log(`   (pouvoir de tri = WR du quintile haut − WR du quintile bas, en points)`);
console.log(`\n   variante            BUY : Q1     Q5     tri   │  SELL : Q1     Q5     tri`);
const sans = (e) => (t) => { let s = 0, k = 0; for (const x of ENTREES) if (x !== e && t.parts[x] != null) { s += t.parts[x]; k++; } return k ? or(t, s) : null; };
const lignes = [["(complet)", null], ...ENTREES.map((e) => [`sans ${e}`, e])];
for (const [lbl, e] of lignes) {
  const v = e == null ? (t) => or(t, t.total) : sans(e);
  const b = tri(BUY, v), s = tri(SELL, v);
  console.log(`   ${lbl.padEnd(18)} ${b.q1.toFixed(1).padStart(6)} ${b.q5.toFixed(1).padStart(6)} ${b.d.toFixed(1).padStart(7)}   │  ${s.q1.toFixed(1).padStart(9)} ${s.q5.toFixed(1).padStart(6)} ${s.d.toFixed(1).padStart(7)} ±${s.s.toFixed(1)}`);
}

// ── ③ CHAQUE ENTRÉE COMME SCORE UNIQUE ───────────────────────────────────────────────────────
console.log(`\n\n══ ③ CHAQUE ENTRÉE COMME SCORE UNIQUE — pouvoir de tri, seule`);
console.log(`   entrée              BUY : Q1     Q5     tri   │  SELL : Q1     Q5     tri`);
for (const e of ENTREES) {
  const v = (t) => or(t, t.parts[e]);
  const b = tri(BUY, v), s = tri(SELL, v);
  console.log(`   ${e.padEnd(18)} ${b.q1.toFixed(1).padStart(6)} ${b.q5.toFixed(1).padStart(6)} ${b.d.toFixed(1).padStart(7)}   │  ${s.q1.toFixed(1).padStart(9)} ${s.q5.toFixed(1).padStart(6)} ${s.d.toFixed(1).padStart(7)} ±${s.s.toFixed(1)}`);
}

// ── ④ COMBINAISONS — la famille « oscillateur » est-elle le frein ? ──────────────────────────
// ⭐ ① et ② désignent le `%K H4` comme le plus inversé et l'`ADX` comme le seul trieur du SELL.
//   Reste à vérifier que c'est bien la FAMILLE (les capteurs bornés %K/RSI) et pas la seule case H4.
console.log(`\n\n══ ④ COMBINAISONS — pouvoir de tri (Q5−Q1, points)`);
console.log(`   sous-ensemble                      BUY      SELL`);
const combo = (ks) => (t) => { let s = 0, k = 0; for (const x of ks) if (t.parts[x] != null) { s += t.parts[x]; k++; } return k ? or(t, s) : null; };
for (const [lbl, ks] of [
  ["les 6 (complet)",            ENTREES],
  ["adx SEUL",                   ["adx"]],
  ["gap + di + adx",             ["gap", "di", "adx"]],
  ["gap + di (sans adx)",        ["gap", "di"]],
  ["kH1 + kH4 + rsiM15",         ["kH1", "kH4", "rsiM15"]],
  ["les 6 SANS kH4",             ENTREES.filter((e) => e !== "kH4")],
  ["les 6 SANS kH1/kH4/rsiM15",  ["gap", "di", "adx"]],
]) {
  const b = tri(BUY, combo(ks)), s = tri(SELL, combo(ks));
  console.log(`   ${lbl.padEnd(30)} ${b.d.toFixed(1).padStart(6)}    ${s.d.toFixed(1).padStart(6)} ±${s.s.toFixed(1)}`);
}
