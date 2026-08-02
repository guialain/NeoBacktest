// Seuil sur %K H4 ou sur %D H4 ? (owner 2026-08-02, cas US_TECH100 21/07 16:27)
// 🔴 LE PROBLÈME : `%K H4 live` oscille de ±1,5 en quelques minutes. Sur le cas signalé il est
//   au-dessus de 92 pendant toute la demi-heure SAUF à la minute du signal (91,93) — le veto le rate
//   de 0,07. `%D` est le lissage du même signal : il bouge de 0,1 sur la même fenêtre.
//   ⭐ UN SEUIL SUR UNE LIGNE BRUYANTE ÉCHANTILLONNE LE BRUIT, PAS L'ÉTAT.
// ⚠ On compare à population ÉGALE : pour chaque candidat on montre n, épisodes, WR et R/trade, plus
//   ce que la règle RETIRE (c'est le seul critère qui décide, cf. la note de `SCORE_MIN_EXH`).
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const cont = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) {
    if (s.type === "EXHAUSTION" || typeof s.R !== "number") continue;
    cont.push({ a, side: s.side, R: s.R, out: s.outcome, ep: Number(s.openEp) || 0, k: s.kH4, d: s.dH4 });
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
  + (t.length ? `${wr(t).toFixed(2).padStart(9)}%${se(t).toFixed(2).padStart(7)}${(wr(t)-75).toFixed(2).padStart(8)}${rt(t).toFixed(4).padStart(9)}` : "")
  + (E && E < 20 ? "  ⚠<20 ép." : "")); };
console.log(`${"".padEnd(30)}${"n".padStart(6)}${"épis.".padStart(7)}${"WR".padStart(10)}${"±ET".padStart(7)}${"marge".padStart(8)}${"R/tr".padStart(9)}`);
L("TOUTES LES CONT", cont);
console.log(`\n── %K H4 live (bruyant) ──`);
for (const s of [88, 90, 91, 92, 93]) L(`> ${s}`, cont.filter((x) => x.k > s));
console.log(`\n── %D H4 live (lissé) ──`);
for (const s of [82, 84, 86, 87, 88, 89, 90]) L(`> ${s}`, cont.filter((x) => x.d > s));
console.log(`\n── bandes de %D, pour voir où ça casse ──`);
const B = [0, 80, 84, 86, 88, 90, 101];
for (let i = 0; i < B.length - 1; i++) L(`[${B[i]} · ${B[i+1]})`, cont.filter((x) => x.d >= B[i] && x.d < B[i+1]));
