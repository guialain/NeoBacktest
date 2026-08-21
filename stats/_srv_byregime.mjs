// _srv_byregime.mjs — WR/R VENTILÉS PAR RÉGIME c2, via le SERVEUR (jamais le script standalone :
//   UTC vs local donne des chiffres faux). Univers complet.
//
// ⭐ POURQUOI CETTE VUE EXISTE MAINTENANT : depuis la nouvelle couche 3, le moteur NE REGARDE PLUS
//   les régimes — il décide par les deux thèses (continuation / exhaustion). La couche 2 tourne
//   encore et classe toujours, mais son verdict n'entre nulle part.
//   ⇒ Lire les tirs PAR RÉGIME dit dans quels contextes le nouveau moteur tire alors qu'il les ignore.
//   Un régime qui concentre les pertes est une information qu'aucun des quatre experts ne porte.
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();

const st = (s) => {
  const w = s.filter((x) => x.outcome === "WIN").length;
  const l = s.filter((x) => x.outcome === "LOSS").length;
  const R = s.reduce((a, b) => a + b.R, 0);
  return { n: s.length, wr: (w + l) ? (w / (w + l)) * 100 : 0, R };
};

const all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) if (typeof s.R === "number") all.push(s);
}

const regimes = [...new Set(all.map((s) => s.regime ?? "(sans régime)"))];
const fmt = (x) => `${x.wr.toFixed(0)}%`.padStart(5) + String(x.n).padStart(7) + ((x.R >= 0 ? "+" : "") + x.R.toFixed(0)).padStart(7);

console.log(`n = ${all.length} trades · ${assets.length} actifs\n`);
console.log("régime c2".padEnd(16) + "TOUT WR/n/R".padStart(19) + "CONT".padStart(19) + "EXH".padStart(19));
console.log("─".repeat(73));
const rows = regimes.map((r) => {
  const sel = all.filter((s) => (s.regime ?? "(sans régime)") === r);
  return { r, t: st(sel), c: st(sel.filter((s) => s.type === "CONTINUATION")), e: st(sel.filter((s) => s.type === "EXHAUSTION")) };
}).sort((x, y) => y.t.R - x.t.R);
for (const x of rows) console.log(x.r.padEnd(16) + fmt(x.t) + fmt(x.c) + fmt(x.e));
console.log("─".repeat(73));
console.log("TOTAL".padEnd(16) + fmt(st(all)) + fmt(st(all.filter((s) => s.type === "CONTINUATION"))) + fmt(st(all.filter((s) => s.type === "EXHAUSTION"))));

// ⭐ LA VENTILATION CROISÉE — c'est elle qui dit si le régime et la thèse s'accordent. Un CONT tiré en
//   régime baissier n'est pas forcément faux (le nouveau moteur ne lit pas le régime), mais c'est la
//   cohorte à regarder en premier si le R est mauvais.
console.log("\nRÉGIME × CÔTÉ — le moteur tire-t-il DANS le sens du régime ?");
console.log("régime".padEnd(16) + "BUY WR/n/R".padStart(19) + "SELL WR/n/R".padStart(19));
for (const x of rows) {
  const sel = all.filter((s) => (s.regime ?? "(sans régime)") === x.r);
  console.log(x.r.padEnd(16) + fmt(st(sel.filter((s) => s.side === "BUY"))) + fmt(st(sel.filter((s) => s.side === "SELL"))));
}
