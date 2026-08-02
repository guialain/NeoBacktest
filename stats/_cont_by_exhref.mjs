// _cont_by_exhref.mjs — la CONT trie-t-elle par MOTIF DE REFUS de l'EXH ?
// Thèse à tester : « on n'envoie à la CONT que ce qui ne vérifie pas les critères d'un
// renversement, donc la sélection est déjà faite en amont ». Si c'est vrai, le motif de refus
// porte de l'information et les cellules s'étagent. Si toutes les raisons rendent le même WR,
// le refus n'a rien sélectionné : la CONT trade un résidu indifférencié.
// ⚠ Comptage en TRADES, pas en épisodes dédupliqués (cf. method_episodes_over_wr) — lire les
//   petites cellules avec ça en tête.
const API = "http://localhost:3001/api/matrix";
const IN_END = "2026-07-24", OOS_START = "2026-07-27";
const day = (ep) => new Date(ep * 60000).toISOString().slice(0, 10);

const assets = await (await fetch(`${API}/assets`)).json();
const cont = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of j.signals || []) {
    if (typeof s.R !== "number" || s.type === "EXHAUSTION") continue;
    cont.push({ R: s.R, out: s.outcome, asset: a, d: day(s.openEp ?? s.ep),
                kind: s.exhRef?.kind ?? "(aucun)", by: s.exhRef?.by ?? "(aucun)" });
  }
}

const stat = (s) => {
  const w = s.filter((x) => x.out === "WIN").length, l = s.filter((x) => x.out === "LOSS").length;
  const R = s.reduce((a, b) => a + b.R, 0);
  return { n: s.length, wr: (w + l) ? w / (w + l) * 100 : 0, rtr: s.length ? R / s.length : 0 };
};
// Point mort 75 % partout : toutes les tables TP/SL sont à ratio 1:3. La marge est comparable.
const BE = 75;
const fmt = (t) => `${String(t.n).padStart(5)} tr  WR ${t.wr.toFixed(2).padStart(6)} %  `
  + `marge ${(t.wr - BE >= 0 ? "+" : "") + (t.wr - BE).toFixed(2)}`.padEnd(14)
  + `  R/tr ${t.rtr.toFixed(4).padStart(7)}`;

const IN = cont.filter((x) => x.d <= IN_END), OOS = cont.filter((x) => x.d >= OOS_START);
console.log(`\n=== CONT ${cont.length} trades · point mort ${BE} % ===`);
console.log(`ENSEMBLE     ${fmt(stat(cont))}`);
console.log(`  calibrage  ${fmt(stat(IN))}`);
console.log(`  vérif      ${fmt(stat(OOS))}`);

for (const champ of ["kind", "by"]) {
  console.log(`\n-- par exhRef.${champ} (trié par volume) --`);
  const cles = [...new Set(cont.map((x) => x[champ]))]
    .sort((a, b) => cont.filter((x) => x[champ] === b).length - cont.filter((x) => x[champ] === a).length);
  for (const k of cles) {
    const tous = cont.filter((x) => x[champ] === k);
    const i = stat(tous.filter((x) => x.d <= IN_END)), o = stat(tous.filter((x) => x.d >= OOS_START));
    const part = (tous.length / cont.length * 100).toFixed(1);
    console.log(`${String(k).padEnd(34)} ${String(part).padStart(5)} %  ${fmt(stat(tous))}`);
    console.log(`${" ".repeat(34)}   calib ${i.wr.toFixed(2).padStart(6)} % ${i.rtr.toFixed(4).padStart(7)}`
      + `  |  vérif ${o.wr.toFixed(2).padStart(6)} % ${o.rtr.toFixed(4).padStart(7)} (${o.n} tr)`);
  }
}
