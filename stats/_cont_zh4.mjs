// CONT à zscore H4 live extrême. (owner 2026-08-02)
// ⚠ CÔTÉS SÉPARÉS : à z H4 < −2,30 une CONT SELL poursuit la baisse, une CONT BUY achète le creux.
//   Ce ne sont pas la même thèse — les mélanger effacerait le sens.
// ⚠ MIROIR AFFICHÉ à côté, pas additionné : le zscore est SIGNÉ, l'asymétrie doit rester visible.
// ⚠ ÉPISODES (fenêtre 4 h, `openEp` en MINUTES). Plancher de lecture ≈ 20 épisodes.
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const cont = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) {
    if (s.type === "EXHAUSTION" || typeof s.R !== "number") continue;
    cont.push({ a, side: s.side, R: s.R, out: s.outcome, ep: Number(s.openEp) || 0,
                z: Number(s.zscoreH4S0), zc: Number(s.zscoreH4) });
  }
}
const wr = (t) => { const w = t.filter((x) => x.out === "WIN").length, l = t.filter((x) => x.out === "LOSS").length; return (w + l) ? w / (w + l) * 100 : NaN; };
const rt = (t) => t.reduce((a, b) => a + b.R, 0) / t.length;
const se = (t) => { const p = wr(t) / 100; return t.length ? Math.sqrt(p * (1 - p) / t.length) * 100 : NaN; };
const eps = (t) => { const par = {}; for (const x of t) (par[x.a] ??= []).push(x.ep);
  let n = 0; for (const v of Object.values(par)) { v.sort((p, q) => p - q); let last = -1e18;
    for (const e of v) { if (e - last > 240) n++; last = e; } } return n; };
const L = (lab, t) => { const E = eps(t);
  console.log(`${lab.padEnd(30)}${String(t.length).padStart(6)}${String(E).padStart(7)}`
  + (t.length ? `${wr(t).toFixed(2).padStart(9)}%${se(t).toFixed(2).padStart(7)}${(wr(t)-75).toFixed(2).padStart(8)}${rt(t).toFixed(4).padStart(9)}` : "        —")
  + (E && E < 20 ? "  ⚠<20 ép." : "")); };
const ok = cont.filter((x) => Number.isFinite(x.z));
console.log(`CONT avec z H4 s0 lisible : ${ok.length} / ${cont.length}\n`);
console.log(`${"".padEnd(30)}${"n".padStart(6)}${"épis.".padStart(7)}${"WR".padStart(10)}${"±ET".padStart(7)}${"marge".padStart(8)}${"R/tr".padStart(9)}`);
L("TOUTES LES CONT", ok);
console.log(`\n── z H4 s0 sous le seuil ──`);
for (const s of [-1.55, -2.15, -2.30, -2.60, -3.00]) {
  const t = ok.filter((x) => x.z < s); L(`< ${s.toFixed(2)}`, t);
  const b = t.filter((x) => x.side === "BUY"), v = t.filter((x) => x.side === "SELL");
  if (t.length) { L(`     └ BUY`, b); L(`     └ SELL`, v); }
}
console.log(`\n── miroir haut ──`);
for (const s of [1.55, 2.15, 2.30, 2.60, 3.00]) {
  const t = ok.filter((x) => x.z > s); L(`> ${s.toFixed(2)}`, t);
  if (t.length) { L(`     └ BUY`, t.filter((x) => x.side === "BUY")); L(`     └ SELL`, t.filter((x) => x.side === "SELL")); }
}
L("\nreste (|z| ≤ 2,30)", ok.filter((x) => Math.abs(x.z) <= 2.30));
