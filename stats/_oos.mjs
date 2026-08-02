// _oos.mjs — partition de l'univers en deux fenêtres : CALIBRAGE vs VÉRIFICATION.
// Le moteur n'a pas de filtre de dates : on joue le walk continu une seule fois (identique à
// _univ2) puis on étiquette chaque trade par sa date d'OUVERTURE (openEp, dérivé de ts_utc —
// `tsMT` est l'heure broker, décalée). Découper à l'entrée et non à la sortie : un trade
// appartient à la fenêtre où la décision a été prise.
const API = "http://localhost:3001/api/matrix";
const IN_END = "2026-07-24";     // fin de la fenêtre de calibrage (incluse)
const OOS_START = "2026-07-27";  // début de la fenêtre de vérification

const day = (ep) => new Date(ep * 60000).toISOString().slice(0, 10);

const assets = await (await fetch(`${API}/assets`)).json();
const all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of j.signals || []) {
    if (typeof s.R !== "number") continue;
    all.push({ R: s.R, out: s.outcome, type: s.type, asset: a, d: day(s.openEp ?? s.ep) });
  }
}

const stat = (s) => {
  const w = s.filter((x) => x.out === "WIN").length;
  const l = s.filter((x) => x.out === "LOSS").length;
  const R = s.reduce((a, b) => a + b.R, 0);
  const exh = s.filter((x) => x.type === "EXHAUSTION").length;
  return { n: s.length, wr: (w + l) ? w / (w + l) * 100 : 0, R, rtr: s.length ? R / s.length : 0, exh,
           ratio: s.length ? exh / s.length : 0 };
};
const line = (name, s) => {
  const t = stat(s);
  console.log(`${name.padEnd(14)} ${String(t.n).padStart(6)} tr  WR ${t.wr.toFixed(2).padStart(6)} %  `
    + `R/tr ${t.rtr.toFixed(4).padStart(7)}  R ${t.R.toFixed(1).padStart(7)}  ratioEXH ${t.ratio.toFixed(3)}`);
};

const IN = all.filter((x) => x.d <= IN_END);
const OOS = all.filter((x) => x.d >= OOS_START);
const HOLE = all.filter((x) => x.d > IN_END && x.d < OOS_START);

console.log(`\n=== UNIVERS ${assets.length} actifs · ${all.length} trades ===`);
line("TOTAL", all);
line("CALIBRAGE", IN);
line("VÉRIF", OOS);
if (HOLE.length) line("(entre-deux)", HOLE);

for (const [nom, set] of [["CALIBRAGE", IN], ["VÉRIF", OOS]]) {
  console.log(`\n-- ${nom} : par thèse --`);
  line("  CONT", set.filter((x) => x.type !== "EXHAUSTION"));
  line("  EXH", set.filter((x) => x.type === "EXHAUSTION"));
}

console.log(`\n-- par jour --`);
for (const d of [...new Set(all.map((x) => x.d))].sort()) {
  const s = all.filter((x) => x.d === d);
  const t = stat(s);
  const tag = d <= IN_END ? " " : d >= OOS_START ? "*" : "?";
  console.log(`${tag} ${d}  ${String(t.n).padStart(4)} tr  WR ${t.wr.toFixed(1).padStart(5)} %  R/tr ${t.rtr.toFixed(4).padStart(7)}  R ${t.R.toFixed(1).padStart(6)}`);
}

console.log(`\n-- par actif : R sur chaque fenêtre (négatifs = 🔴) --`);
for (const a of assets) {
  const i = stat(IN.filter((x) => x.asset === a));
  const o = stat(OOS.filter((x) => x.asset === a));
  console.log(`${a.padEnd(12)} calib ${String(i.n).padStart(4)} tr ${i.wr.toFixed(1).padStart(5)}% R ${i.R.toFixed(1).padStart(6)}`
    + `   |   vérif ${String(o.n).padStart(3)} tr ${o.wr.toFixed(1).padStart(5)}% R ${o.R.toFixed(1).padStart(6)}`
    + `${o.R < 0 ? "  🔴" : ""}`);
}
