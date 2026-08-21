// WR par PROFIL via le SERVEUR (jamais standalone : UTC vs local = 2× d'écart). Isolation Strong Bull/Bear.
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const acc = {};   // profile → {win,loss,be,R}
const add = (k, s) => { const a = acc[k] ??= { win: 0, loss: 0, be: 0, R: 0, n: 0 };
  a.n++; a.R += s.R; if (s.outcome === "WIN") a.win++; else if (s.outcome === "LOSS") a.loss++; else a.be++; };

for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) {
    if (typeof s.R !== "number") continue;
    add(s.profile || "?", s);
    add(`${s.profile || "?"} · ${s.side}`, s);   // détail par côté
  }
}

const line = (k, a) => {
  const wl = a.win + a.loss, wr = wl ? (100 * a.win / wl) : 0, avg = a.n ? a.R / a.n : 0;
  return `${k.padEnd(26)} WR ${wr.toFixed(1).padStart(5)}%  n ${String(a.n).padStart(4)}  (W${a.win}/L${a.loss}/BE${a.be})  R ${(a.R >= 0 ? "+" : "") + a.R.toFixed(1)}  avgR ${avg.toFixed(3)}`;
};
console.log("─── WR par PROFIL (serveur, 19 actifs, isolation Strong Bull/Bear) ───");
for (const k of ["Strong Bull", "Strong Bear", "Exhaustion"]) if (acc[k]) console.log(line(k, acc[k]));
console.log("");
for (const k of Object.keys(acc).filter(k => k.includes(" · ")).sort()) console.log(line(k, acc[k]));
