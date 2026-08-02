// Balayage de SCORE_MIN_EXH sur la population des 17 tradables. (owner 2026-08-02)
// ⚠ Le serveur doit être REDÉMARRÉ entre deux valeurs — la constante est lue à l'import.
//   Ce script ne fait QUE mesurer ; l'orchestration est dans le shell.
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) if (typeof s.R === "number") all.push({ R: s.R, out: s.outcome, type: s.type, exit: s.exitTs || s.tsMT || "" });
}
const wr = (t) => { const w = t.filter((x) => x.out === "WIN").length, l = t.filter((x) => x.out === "LOSS").length; return (w + l) ? w / (w + l) * 100 : NaN; };
const R = (t) => t.reduce((a, b) => a + b.R, 0);
const mdd = (t) => { const o = [...t].sort((a, b) => a.exit.localeCompare(b.exit)); let e = 0, p = 0, d = 0; for (const x of o) { e += x.R; p = Math.max(p, e); d = Math.max(d, p - e); } return d; };
const exh = all.filter((s) => s.type === "EXHAUSTION"), cont = all.filter((s) => s.type !== "EXHAUSTION");
console.log(JSON.stringify({ n: all.length, wr: +wr(all).toFixed(2), rt: +(R(all) / all.length).toFixed(4), R: +R(all).toFixed(1),
  dd: +mdd(all).toFixed(1), exhN: exh.length, exhWr: +wr(exh).toFixed(2), contN: cont.length, contWr: +wr(cont).toFixed(2),
  ratio: +(exh.length / all.length * 100).toFixed(1) }));
