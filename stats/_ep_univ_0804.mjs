// _ep_univ_0804.mjs — l'univers PAR ÉPISODE, pour juger la table d'admission du 04/08.
// ⚠ Par ÉPISODE et non par TIR : compter par tir est BIAISÉ (le nombre de clones dépend de l'issue).
import { dedupeEpisodes } from "./_episodes.mjs";

const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const ep = dedupeEpisodes(all, (s) => s.asset);
const wr = (s) => { const w = s.filter(x => x.outcome === "WIN").length, l = s.filter(x => x.outcome === "LOSS").length; return (w + l) ? w / (w + l) * 100 : 0; };
const sum = (s) => s.reduce((x, y) => x + y.R, 0);
const mdd = (s) => { const o = [...s].sort((a, b) => String(a.exitTs || a.tsMT || "").localeCompare(String(b.exitTs || b.tsMT || ""))); let eq = 0, pk = 0, dd = 0; for (const t of o) { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); } return dd; };
const show = (n, s) => console.log(`${n.padEnd(9)} n=${String(s.length).padStart(5)} · WR ${wr(s).toFixed(2)}% · R ${sum(s).toFixed(1)} · R/tr ${(sum(s) / s.length).toFixed(4)} · maxDD ${mdd(s).toFixed(1)}`);

const exh = ep.filter(s => s.type === "EXHAUSTION"), cont = ep.filter(s => s.type !== "EXHAUSTION");
console.log("=== PAR ÉPISODE (15 min · actif|côté|thèse) ===");
show("TOTAL", ep); show("  EXH", exh); show("  CONT", cont);
console.log(`ratio EXH = ${(exh.length / ep.length * 100).toFixed(1)} %  (cible ~25 %)`);
console.log(`R/DD     = ${(sum(ep) / mdd(ep)).toFixed(2)}`);
console.log(`\n(tirs bruts : n=${all.length})`);
