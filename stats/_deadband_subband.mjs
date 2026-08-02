// _deadband_subband.mjs — la zone morte [40,50) est-elle homogène ?
// Le motif voisin `adx-climax-hors-extreme` (ADX ≥ 50) rend +11,23 de marge quand la zone morte
// rend +1,42. Si la qualité de la CONT monte AVEC l'ADX, la frontière à 40 est peut-être posée au
// mauvais endroit et il n'y a pas un motif à couper mais une borne à déplacer.
// Contrôle de cohérence inclus : tous les trades du motif doivent bien avoir adx ∈ [40,50).
const API = "http://localhost:3001/api/matrix";
const IN_END = "2026-07-24", OOS_START = "2026-07-27";
const GAP = 240, BE = 75;
const day = (ep) => new Date(ep * 60000).toISOString().slice(0, 10);

const assets = await (await fetch(`${API}/assets`)).json();
const db = [];
const hors = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const mine = (j.signals || [])
    .filter((s) => typeof s.R === "number" && s.type !== "EXHAUSTION" && s.exhRef?.by === "adx-deadband")
    .map((s) => ({ R: s.R, out: s.outcome, asset: a, side: s.side, adx: s.adx,
                   ep: s.openEp ?? s.ep, d: day(s.openEp ?? s.ep) }))
    .sort((x, y) => x.ep - y.ep);
  let epi = 0, prev = -Infinity;
  for (const t of mine) { if (t.ep - prev > GAP) epi++; prev = t.ep; t.epi = `${a}|${epi}`; }
  for (const t of mine) (t.adx >= 40 && t.adx < 50 ? db : hors).push(t);
}

console.log(`\nContrôle : ${db.length} trades avec adx ∈ [40,50) · ${hors.length} HORS bande`);
if (hors.length) {
  const v = hors.map((x) => x.adx).filter(Number.isFinite);
  console.log(`  ⚠ hors bande : adx de ${Math.min(...v).toFixed(1)} à ${Math.max(...v).toFixed(1)}`
    + ` — le champ \`adx\` du signal n'est pas celui que lit la porte, lecture à revoir`);
}

const stat = (s) => {
  const w = s.filter((x) => x.out === "WIN").length, l = s.filter((x) => x.out === "LOSS").length;
  const R = s.reduce((a, b) => a + b.R, 0);
  return { n: s.length, ep: new Set(s.map((x) => x.epi)).size, wr: (w + l) ? w / (w + l) * 100 : 0,
           rtr: s.length ? R / s.length : 0 };
};
const row = (lbl, s) => {
  const t = stat(s), m = t.wr - BE;
  console.log(`${lbl.padEnd(20)} ${String(t.ep).padStart(4)} ép ${String(t.n).padStart(5)} tr  `
    + `WR ${t.wr.toFixed(2).padStart(6)} %  marge ${((m >= 0 ? "+" : "") + m.toFixed(2)).padStart(6)}`
    + `  R/tr ${t.rtr.toFixed(4).padStart(7)}${t.ep < 20 ? "  ⚠illisible" : m < 0 ? "  🔴" : ""}`);
};

console.log(`\n=== zone morte par sous-bande d'ADX · point mort ${BE} % ===`);
for (const [lo, hi] of [[40, 42.5], [42.5, 45], [45, 47.5], [47.5, 50]]) {
  row(`ADX ${lo}–${hi}`, db.filter((x) => x.adx >= lo && x.adx < hi));
}
console.log(`\n-- en deux moitiés, avec le split de fenêtres --`);
for (const [lo, hi] of [[40, 45], [45, 50]]) {
  const s = db.filter((x) => x.adx >= lo && x.adx < hi);
  row(`ADX ${lo}–${hi}`, s);
  row(`  calibrage`, s.filter((x) => x.d <= IN_END));
  row(`  vérif`, s.filter((x) => x.d >= OOS_START));
  for (const c of ["BUY", "SELL"]) row(`  ${c}`, s.filter((x) => x.side === c));
}
