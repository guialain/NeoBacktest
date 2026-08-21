// _exh_wr_par_cote_0804.mjs — LE WR DE L'EXH PAR CÔTÉ ET PAR TRANCHE DE CONVICTION.
// ⚠ La CONVICTION est le score ORIENTÉ par le côté admis (`sc.exhConviction`) : positif = « ce
//   côté-là est soutenu ». Un BUY et un SELL sont donc directement comparables sur la même échelle.
// ⚠ Par ÉPISODE, spread FACTURÉ.
import { dedupeEpisodes } from "./_episodes.mjs";

const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2&chargeSpread=true`)).json();
  for (const s of (j.signals || [])) all.push({ ...s, asset: a });
}
const ep = dedupeEpisodes(all, (s) => s.asset).filter((s) => s.type === "EXHAUSTION");
const conv = (s) => { const c = s?.sc?.exhConviction; return Number.isFinite(c) ? c : (Number.isFinite(s?.score) ? Math.abs(s.score) / 10 : null); };

const wr  = (v) => { const w = v.filter((x) => x.outcome === "WIN").length, l = v.filter((x) => x.outcome === "LOSS").length; return (w + l) ? (w / (w + l)) * 100 : NaN; };
const sum = (v) => v.reduce((a, x) => a + (Number.isFinite(x.R) ? x.R : 0), 0);

// Tranches FIXES et identiques des deux côtés — un découpage en percentiles donnerait des bornes
//   différentes par côté et rendrait la comparaison impossible.
const CUTS = [2.2, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 8.0, Infinity];
const lbl = (i) => (i === 0 ? `[2,20 · ${CUTS[0].toFixed(2)}[` : `[${CUTS[i - 1].toFixed(2)} · ${CUTS[i] === Infinity ? "∞" : CUTS[i].toFixed(2)}[`);

for (const side of ["BUY", "SELL"]) {
  const v = ep.filter((s) => s.side === side).map((s) => ({ ...s, c: conv(s) })).filter((s) => Number.isFinite(s.c));
  const G = wr(v), P = G / 100;
  console.log(`\n══ EXH ${side} ══  ${v.length} ép · WR ${G.toFixed(2)} % · R ${sum(v).toFixed(1)} · conviction ${Math.min(...v.map(x => x.c)).toFixed(2)} → ${Math.max(...v.map(x => x.c)).toFixed(2)}`);
  console.log("tranche              n     WR       R      σ vs son côté");
  let prev = 2.2;
  for (let i = 0; i < CUTS.length; i++) {
    const hi = CUTS[i];
    const b = v.filter((s) => s.c >= prev && s.c < hi);
    prev = hi;
    if (!b.length) continue;
    const sd = Math.sqrt((P * (1 - P)) / b.length) * 100;
    const d = wr(b) - G;
    console.log(`[${(CUTS[i - 1] ?? 2.2).toFixed(2)} · ${hi === Infinity ? "  ∞" : hi.toFixed(2)}[`.padEnd(18) +
      String(b.length).padStart(5) + wr(b).toFixed(1).padStart(7) + " %" + sum(b).toFixed(1).padStart(8) +
      (d / sd).toFixed(1).padStart(9) + (Math.abs(d / sd) >= 2 ? "  ⭐" : ""));
  }
}

// L'ÉCART ENTRE LES DEUX CÔTÉS, tranche à tranche — c'est ça la question.
console.log("\n══ BUY − SELL, tranche à tranche ══");
console.log("tranche             n BUY   WR BUY    n SELL  WR SELL     écart      σ");
let prev = 2.2;
for (let i = 0; i < CUTS.length; i++) {
  const hi = CUTS[i];
  const b = ep.filter((s) => s.side === "BUY"  && conv(s) >= prev && conv(s) < hi);
  const t = ep.filter((s) => s.side === "SELL" && conv(s) >= prev && conv(s) < hi);
  prev = hi;
  if (!b.length || !t.length) continue;
  const wb = wr(b), wt = wr(t), d = wb - wt;
  // σ de la DIFFÉRENCE de deux proportions indépendantes.
  const pooled = (b.filter((x) => x.outcome === "WIN").length + t.filter((x) => x.outcome === "WIN").length) / (b.length + t.length);
  const sd = Math.sqrt(pooled * (1 - pooled) * (1 / b.length + 1 / t.length)) * 100;
  console.log(`[${(CUTS[i - 1] ?? 2.2).toFixed(2)} · ${hi === Infinity ? "  ∞" : hi.toFixed(2)}[`.padEnd(18) +
    String(b.length).padStart(5) + wb.toFixed(1).padStart(8) + " %" + String(t.length).padStart(8) + wt.toFixed(1).padStart(8) + " %" +
    ((d >= 0 ? "+" : "") + d.toFixed(1)).padStart(9) + (d / sd).toFixed(1).padStart(7) + (Math.abs(d / sd) >= 2 ? "  ⭐" : ""));
}
