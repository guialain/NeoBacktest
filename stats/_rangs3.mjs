// _rangs3.mjs — LES TROIS RANGS, PAR ÉPISODE, SPREAD FACTURÉ.
// ⚠ SPLIT SUR `strategy`, PAS SUR `type` : sinon le PULLBACK est compté dans la CONT — et c'est
//   justement le rang qui lit le MÊME scoreur que le fade, donc celui qui bouge avec sa table.
import { dedupeEpisodes } from "./_episodes.mjs";

const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2&chargeSpread=true`)).json();
  for (const s of (j.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const ep = dedupeEpisodes(all, (s) => s.asset);

const stat = (t) => {
  const w = t.filter((x) => x.outcome === "WIN").length;
  const l = t.filter((x) => x.outcome === "LOSS").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  return { n: t.length, wr: (w + l) ? 100 * w / (w + l) : NaN, R, rt: t.length ? R / t.length : NaN };
};
// maxDD sur la courbe d'équité — ⚠ TRIÉE SUR `exitTs`, PAS SUR `ep`.
// 🔴🔥 LA PREMIÈRE VERSION TRIAIT SUR `ep` (l'entrée) ET RENDAIT UN AUTRE CHIFFRE : 27,7 contre 31,9
//   pour la MÊME population, donc R/DD 3,29 contre 2,86. Un drawdown se subit quand les positions se
//   DÉNOUENT, pas quand elles s'ouvrent — deux trades ouverts dans l'ordre peuvent se fermer dans
//   l'autre. ⚠⚠ ET LE PIÈGE EST QUE LES DEUX CHIFFRES SONT PLAUSIBLES : rien ne signale l'erreur,
//   sauf de comparer à la référence. ⇒ MÊME FORMULE QUE `_ep_univ_0804.mjs`, sinon aucun R/DD
//   produit ici n'est comparable à la baseline — et un R/DD non comparable est pire qu'absent.
const maxDD = (t) => {
  const s = [...t].sort((a, b) =>
    String(a.exitTs || a.tsMT || "").localeCompare(String(b.exitTs || b.tsMT || "")));
  let cum = 0, peak = 0, dd = 0;
  for (const x of s) { cum += x.R || 0; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  return dd;
};

const keys = [...new Set(ep.map((s) => String(s.strategy ?? "?")))].sort();
console.log(`clés \`strategy\` présentes : ${keys.join(" · ")}\n`);

const T = stat(ep), DD = maxDD(ep);
console.log(`TOTAL      n=${String(T.n).padStart(5)} · WR ${T.wr.toFixed(2)} % · R ${T.R.toFixed(1)} ` +
            `· R/tr ${T.rt.toFixed(4)} · maxDD ${DD.toFixed(1)} · R/DD ${(T.R / DD).toFixed(2)}`);
for (const k of keys) {
  const v = stat(ep.filter((s) => String(s.strategy ?? "?") === k));
  console.log(`  ${k.padEnd(9)} n=${String(v.n).padStart(5)} · WR ${v.wr.toFixed(2)} % · R ${v.R.toFixed(1)} ` +
              `· R/tr ${v.rt.toFixed(4)} · maxDD ${maxDD(ep.filter((s) => String(s.strategy ?? "?") === k)).toFixed(1)}`);
}
const nExh = ep.filter((s) => s.type === "EXHAUSTION").length;
console.log(`\nratio EXH (type) = ${(100 * nExh / ep.length).toFixed(1)} %   (cible ~25 %)`);
