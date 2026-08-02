// _hour_of_day.mjs — L'HEURE, À ELLE SEULE, TRIE-T-ELLE LE FADE ?
//
// C'est l'hypothèse CONCURRENTE de la couche macro, et la moins chère : si « ne pas fader entre 13h
// et 15h » suffit, une couche cross-actifs devra prouver qu'elle apporte AU-DELÀ de l'heure.
// À mesurer AVANT de construire quoi que ce soit. Cf. docs/coherence_de_marche.md.
//
// ⚠ PIÈGE DE COMPOSITION — le seul qui puisse ruiner cette table en silence : les actifs n'ont pas
//   les mêmes heures d'ouverture (INDEX 7,5-21 · GOLD/SILVER 0-21 · COCOA 5,75-14,48 · UK_100 &
//   GERMANY_40 7,5-17 · FX/CRYPTO/ENERGY 0-24). À 22h il ne reste que FX+crypto+énergie. Un écart
//   entre deux heures peut donc n'être qu'un écart entre deux MÉLANGES D'ACTIFS.
//   ⇒ tout est produit DEUX FOIS : univers complet, puis les 11 actifs ouverts 24h seulement.
//
// ⚠ EFFECTIF RÉEL = le nombre de JOURNÉES, pas de trades : dans une tranche donnée d'un jour donné,
//   les actifs sont corrélés. La colonne `j` est la seule qui compte pour juger de la solidité.
const API = "http://localhost:3001/api/matrix";
const IN_END = "2026-07-24", OOS_START = "2026-07-27";
const GAP = 240, BE = 75;
const H24 = new Set(["AUDUSD", "EURUSD", "GBPUSD", "USDCAD", "USDCHF", "USDJPY",   // FX
                     "BTCUSD", "ETHUSD",                                          // CRYPTO
                     "BRENT_OIL", "CrudeOIL", "GASOLINE"]);                        // ENERGY
const iso = (ep) => new Date(ep * 60000).toISOString();
const day = (ep) => iso(ep).slice(0, 10);
const slot = (ep) => { const s = iso(ep); return `${s.slice(11, 13)}:${Number(s.slice(14, 16)) < 30 ? "00" : "30"}`; };

const assets = await (await fetch(`${API}/assets`)).json();
const all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const mine = (j.signals || []).filter((s) => typeof s.R === "number")
    .map((s) => ({ R: s.R, out: s.outcome, asset: a, exh: s.type === "EXHAUSTION",
                   ep: s.openEp ?? s.ep, d: day(s.openEp ?? s.ep), sl: slot(s.openEp ?? s.ep) }))
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
const cell = (s) => {
  const t = stat(s);
  if (!t.n) return "        —                    ";
  const m = t.wr - BE;
  return `${String(t.j).padStart(2)}j ${String(t.n).padStart(4)}tr ${((m >= 0 ? "+" : "") + m.toFixed(1)).padStart(6)}`
    + `${t.j < 8 ? " ⚠" : m < 0 ? " 🔴" : "  "}`;
};

for (const [titre, univ] of [["UNIVERS COMPLET (19 actifs)", all],
                             ["OUVERTS 24h SEULEMENT (11 actifs) — composition constante",
                              all.filter((x) => H24.has(x.asset))]]) {
  console.log(`\n${"=".repeat(78)}\n=== ${titre} · marge = WR − ${BE} · j = JOURNÉES (l'effectif réel)\n${"=".repeat(78)}`);
  console.log(`tranche      EXH                      CONT`);
  const slots = [...new Set(univ.map((x) => x.sl))].sort();
  for (const s of slots) {
    const g = univ.filter((x) => x.sl === s);
    console.log(`${s}    ${cell(g.filter((x) => x.exh))}    ${cell(g.filter((x) => !x.exh))}`);
  }
  console.log(`TOTAL      ${cell(univ.filter((x) => x.exh))}    ${cell(univ.filter((x) => !x.exh))}`);
}

// Regroupement par SÉANCE — les frontières sont des événements, pas des multiples de 30 min.
const SEANCES = [["Asie          00:00-06:59", 0, 7], ["pré-Londres   07:00-07:59", 7, 8],
                 ["Londres       08:00-12:59", 8, 13], ["NY overlap    13:00-15:59", 13, 16],
                 ["après-midi US 16:00-20:59", 16, 21], ["nuit          21:00-23:59", 21, 24]];
for (const [titre, univ] of [["UNIVERS COMPLET", all], ["OUVERTS 24h", all.filter((x) => H24.has(x.asset))]]) {
  console.log(`\n=== PAR SÉANCE — ${titre} ===`);
  console.log(`séance                          EXH                      CONT`);
  for (const [lbl, lo, hi] of SEANCES) {
    const g = univ.filter((x) => { const h = Number(x.sl.slice(0, 2)); return h >= lo && h < hi; });
    console.log(`${lbl.padEnd(28)} ${cell(g.filter((x) => x.exh))}    ${cell(g.filter((x) => !x.exh))}`);
  }
}

// Stabilité : une séance qui trie doit trier sur les DEUX fenêtres.
console.log(`\n=== STABILITÉ PAR SÉANCE (EXH, univers complet) ===`);
for (const [lbl, lo, hi] of SEANCES) {
  const g = all.filter((x) => x.exh && (() => { const h = Number(x.sl.slice(0, 2)); return h >= lo && h < hi; })());
  console.log(`${lbl.padEnd(28)} tout ${cell(g)}  calib ${cell(g.filter((x) => x.d <= IN_END))}`
    + `  vérif ${cell(g.filter((x) => x.d >= OOS_START))}`);
}
