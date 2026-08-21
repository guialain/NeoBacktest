// _wr_asset_0804.mjs — LE WR PAR ACTIF, PAR ÉPISODE, ET SÉPARÉ PAR THÈSE.
// ⚠ PAR ACTIF ET PAS EN AGRÉGAT : un agrégat cache une population qui perd derrière une moyenne qui
//   gagne. Le dépôt a déjà payé trois « mirages d'agrégat » en une journée (01/08) — la règle qui en
//   sort est de COMPTER LES ACTIFS, pas de lire une moyenne.
// ⚠ Par ÉPISODE : compter par tir est biaisé, le nombre de clones dépend de l'issue.
import { dedupeEpisodes } from "./_episodes.mjs";

const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2&chargeSpread=true`)).json();
  for (const s of (j.signals || [])) all.push({ ...s, asset: a });
}
const ep = dedupeEpisodes(all, (s) => s.asset);

const wr  = (v) => { const w = v.filter((x) => x.outcome === "WIN").length, l = v.filter((x) => x.outcome === "LOSS").length; return (w + l) ? (w / (w + l)) * 100 : NaN; };
const sum = (v) => v.reduce((a, x) => a + (Number.isFinite(x.R) ? x.R : 0), 0);

const G = wr(ep), P = G / 100;
console.log(`TOTAL ${ep.length} ép · WR ${G.toFixed(2)} % · R ${sum(ep).toFixed(1)}\n`);
console.log("actif           n     WR      σ vs global    R      |   EXH n   WR      R    |  CONT n   WR      R");
const rows = [];
for (const a of assets) {
  const v = ep.filter((s) => s.asset === a); if (!v.length) continue;
  const e = v.filter((s) => s.type === "EXHAUSTION"), c = v.filter((s) => s.type !== "EXHAUSTION");
  // σ de l'écart au WR global, sous l'hypothèse « cet actif se comporte comme le reste ».
  const sd = Math.sqrt((P * (1 - P)) / v.length) * 100;
  rows.push({ a, n: v.length, wr: wr(v), sig: (wr(v) - G) / sd, R: sum(v),
              en: e.length, ewr: wr(e), eR: sum(e), cn: c.length, cwr: wr(c), cR: sum(c) });
}
rows.sort((x, y) => x.wr - y.wr);
for (const r of rows) {
  const star = Math.abs(r.sig) >= 2 ? "  ⭐" : "";
  console.log(
    r.a.padEnd(13) + String(r.n).padStart(4) + wr(ep.filter((s) => s.asset === r.a)).toFixed(1).padStart(7) + " %" +
    r.sig.toFixed(1).padStart(9) + r.R.toFixed(1).padStart(9) + "   | " +
    String(r.en).padStart(5) + (Number.isFinite(r.ewr) ? r.ewr.toFixed(1) : "  — ").padStart(7) + " %" + r.eR.toFixed(1).padStart(7) + "  | " +
    String(r.cn).padStart(5) + (Number.isFinite(r.cwr) ? r.cwr.toFixed(1) : "  — ").padStart(7) + " %" + r.cR.toFixed(1).padStart(7) + star);
}
const neg = rows.filter((r) => r.R < 0);
console.log(`\nactifs à R NÉGATIF : ${neg.length}/${rows.length}` + (neg.length ? ` — ${neg.map((r) => r.a).join(" · ")}` : ""));
const below = rows.filter((r) => r.sig <= -2);
console.log(`actifs à −2 σ ou pire : ${below.length}` + (below.length ? ` — ${below.map((r) => r.a).join(" · ")}` : ""));
