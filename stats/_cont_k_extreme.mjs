// CONT à %K live très haut (et son miroir bas). (owner 2026-08-02)
// ⚠ TF non précisé par l'owner ⇒ les TROIS sont affichés. H1 est le TF principal du moteur.
// ⚠ CÔTÉS SÉPARÉS : à %K > 92 une CONT BUY poursuit un mouvement suracheté, une CONT SELL fait
//   autre chose. Les mélanger masquerait le sens.
// ⚠ ÉCHELLE affichée : on montre l'escalier 85→95 pour voir OÙ ça mord, pas seulement le point 92.
// ⚠ ÉPISODES : fenêtre 4 h (`openEp` en MINUTES). Plancher de lecture ≈ 20 épisodes.
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const cont = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) {
    if (s.type === "EXHAUSTION" || typeof s.R !== "number") continue;
    cont.push({ a, side: s.side, R: s.R, out: s.outcome, ep: Number(s.openEp) || 0,
                m15: s.kM15, h1: s.kH1, h4: s.kH4 });
  }
}
const wr = (t) => { const w = t.filter((x) => x.out === "WIN").length, l = t.filter((x) => x.out === "LOSS").length; return (w + l) ? w / (w + l) * 100 : NaN; };
const rt = (t) => t.reduce((a, b) => a + b.R, 0) / t.length;
const se = (t) => { const p = wr(t) / 100; return t.length ? Math.sqrt(p * (1 - p) / t.length) * 100 : NaN; };
const eps = (t) => { const par = {}; for (const x of t) (par[x.a] ??= []).push(x.ep);
  let n = 0; for (const v of Object.values(par)) { v.sort((p, q) => p - q); let last = -1e18;
    for (const e of v) { if (e - last > 240) n++; last = e; } } return n; };
const L = (lab, t) => { const E = eps(t);
  console.log(`${lab.padEnd(34)}${String(t.length).padStart(6)}${String(E).padStart(7)}`
  + (t.length ? `${wr(t).toFixed(2).padStart(9)}%${se(t).toFixed(2).padStart(7)}${(wr(t) - 75).toFixed(2).padStart(8)}${rt(t).toFixed(4).padStart(9)}` : "        —")
  + (E && E < 20 ? "   ⚠ <20 épis." : "")); };

console.log(`${"".padEnd(34)}${"n".padStart(6)}${"épis.".padStart(7)}${"WR".padStart(10)}${"±ET".padStart(7)}${"marge".padStart(8)}${"R/tr".padStart(9)}`);
L("TOUTES LES CONT", cont);
for (const tf of ["h1", "m15", "h4"]) {
  console.log(`\n════ %K ${tf.toUpperCase()} (live) ════`);
  for (const s of [85, 88, 90, 92, 95]) {
    const t = cont.filter((x) => Number.isFinite(x[tf]) && x[tf] > s);
    L(`> ${s}`, t);
    const b = t.filter((x) => x.side === "BUY"), v = t.filter((x) => x.side === "SELL");
    if (b.length && v.length) { L(`     └ BUY`, b); L(`     └ SELL`, v); }
    else if (t.length) console.log(`     └ ${b.length ? "BUY" : "SELL"} uniquement`);
  }
  console.log(`  ── miroir ──`);
  for (const s of [16, 14, 12, 11, 10, 9, 8]) L(`< ${s}`, cont.filter((x) => Number.isFinite(x[tf]) && x[tf] < s));
  const mid = cont.filter((x) => Number.isFinite(x[tf]) && x[tf] >= 8 && x[tf] <= 92);
  L("  reste (8 ≤ %K ≤ 92)", mid);
}
