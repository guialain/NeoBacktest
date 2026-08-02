// _morning_hollow.mjs — À QUI PROFITERAIT UN REFUS DE FADE DANS LE CREUX 10:00–12:29 ?
//
// Le fade y est négatif (5 tranches sur 6, 22-24 journées). Mais un refus d'EXH ne supprime pas la
// barre : la CONT en hérite. Avant d'écrire la règle il faut savoir ce que la CONT fait DÉJÀ là —
// et si elle fait aussi mal, le refus doit SUSPENDRE la barre plutôt que la transmettre.
//
// ⚠ Composition : lu sur les 11 actifs ouverts 24h ET sur l'univers complet. Le creux a été
//   identifié sur le sous-ensemble à composition constante, il doit survivre aux deux lectures.
// ⚠ Effectif réel = JOURNÉES. Le créneau ne pèse que ~24 journées quoi qu'il arrive.
const API = "http://localhost:3001/api/matrix";
const IN_END = "2026-07-24", OOS_START = "2026-07-27";
const GAP = 240, BE = 75;
const H24 = new Set(["AUDUSD", "EURUSD", "GBPUSD", "USDCAD", "USDCHF", "USDJPY",
                     "BTCUSD", "ETHUSD", "BRENT_OIL", "CrudeOIL", "GASOLINE"]);
const iso = (ep) => new Date(ep * 60000).toISOString();
// Le creux, en minutes depuis minuit UTC : [600, 750) = 10:00 → 12:29 inclus.
const minOfDay = (ep) => Number(iso(ep).slice(11, 13)) * 60 + Number(iso(ep).slice(14, 16));
const dansCreux = (ep) => { const m = minOfDay(ep); return m >= 600 && m < 750; };

const assets = await (await fetch(`${API}/assets`)).json();
const all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const mine = (j.signals || []).filter((s) => typeof s.R === "number")
    .map((s) => ({ R: s.R, out: s.outcome, asset: a, side: s.side, exh: s.type === "EXHAUSTION",
                   by: s.exhRef?.by ?? "(aucun)", ep: s.openEp ?? s.ep,
                   d: iso(s.openEp ?? s.ep).slice(0, 10), creux: dansCreux(s.openEp ?? s.ep) }))
    .sort((x, y) => x.ep - y.ep);
  let epi = 0, prev = -Infinity;
  for (const t of mine) { if (t.ep - prev > GAP) epi++; prev = t.ep; t.epi = `${a}|${epi}`; }
  all.push(...mine);
}

const stat = (s) => {
  const w = s.filter((x) => x.out === "WIN").length, l = s.filter((x) => x.out === "LOSS").length;
  const R = s.reduce((a, b) => a + b.R, 0);
  return { n: s.length, ep: new Set(s.map((x) => x.epi)).size, j: new Set(s.map((x) => x.d)).size,
           wr: (w + l) ? w / (w + l) * 100 : 0, rtr: s.length ? R / s.length : 0 };
};
const row = (lbl, s) => {
  const t = stat(s);
  if (!t.n) { console.log(`${lbl.padEnd(30)}        —`); return; }
  const m = t.wr - BE;
  console.log(`${lbl.padEnd(30)} ${String(t.j).padStart(2)}j ${String(t.ep).padStart(4)}ép ${String(t.n).padStart(5)}tr`
    + `  marge ${((m >= 0 ? "+" : "") + m.toFixed(2)).padStart(6)}  R/tr ${t.rtr.toFixed(4).padStart(7)}`
    + `${t.j < 8 ? "  ⚠" : m < 0 ? "  🔴" : ""}`);
};

for (const [titre, U] of [["11 ACTIFS OUVERTS 24h (composition constante)", all.filter((x) => H24.has(x.asset))],
                          ["UNIVERS COMPLET (19 actifs)", all]]) {
  console.log(`\n${"=".repeat(76)}\n=== ${titre} · point mort ${BE} %\n${"=".repeat(76)}`);
  const dans = U.filter((x) => x.creux), hors = U.filter((x) => !x.creux);
  console.log(`-- DANS le creux 10:00–12:29 --`);
  row("  EXH", dans.filter((x) => x.exh));
  row("  CONT", dans.filter((x) => !x.exh));
  console.log(`-- HORS creux (référence) --`);
  row("  EXH", hors.filter((x) => x.exh));
  row("  CONT", hors.filter((x) => !x.exh));
}

const U = all.filter((x) => H24.has(x.asset));
const dans = U.filter((x) => x.creux);

console.log(`\n=== LE CREUX, DÉCOMPOSÉ (11 actifs 24h) ===`);
console.log(`-- par CÔTÉ (ne jamais décomposer sans séparer les côtés) --`);
for (const c of ["BUY", "SELL"]) {
  row(`EXH ${c}`, dans.filter((x) => x.exh && x.side === c));
  row(`CONT ${c}`, dans.filter((x) => !x.exh && x.side === c));
}
console.log(`-- stabilité sur les deux fenêtres --`);
row("EXH  calibrage", dans.filter((x) => x.exh && x.d <= IN_END));
row("EXH  vérif", dans.filter((x) => x.exh && x.d >= OOS_START));
row("CONT calibrage", dans.filter((x) => !x.exh && x.d <= IN_END));
row("CONT vérif", dans.filter((x) => !x.exh && x.d >= OOS_START));

console.log(`\n-- la CONT du creux, par motif de refus hérité --`);
const parMotif = {};
for (const t of dans.filter((x) => !x.exh)) (parMotif[t.by] ??= []).push(t);
for (const [k, v] of Object.entries(parMotif).sort((a, b) => b[1].length - a[1].length)) row(`  ${k}`, v);

console.log(`\n-- par actif, ≥ 8 journées seulement --`);
for (const a of [...H24].sort()) {
  const s = dans.filter((x) => x.asset === a);
  if (stat(s).j >= 8) { row(`${a} EXH`, s.filter((x) => x.exh)); row(`${a} CONT`, s.filter((x) => !x.exh)); }
}
