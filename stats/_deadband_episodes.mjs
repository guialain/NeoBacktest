// _deadband_episodes.mjs — la cohorte CONT héritée de `adx-deadband` (ADX ∈ [40,50)), décomposée
// par ÉPISODES, par ACTIF et par CÔTÉ avant toute lecture de WR.
//
// Question : faut-il cesser de router la zone morte de l'ADX vers la continuation ? L'agrégat dit
// +1,42 de marge (donc positif) mais 73,24 % hors-échantillon (donc sous le point mort). Un agrégat
// qui hésite se décompose — cf. method_episodes_over_wr : trois mirages en une journée.
//
// ÉPISODE = tirs contigus sur le MÊME actif, fenêtre 4 h (240 min sur openEp). Le WR ne compte que
// des barres ; une cellule à 100 % sur 16 trades peut n'être que 4 séquences. On compte les épisodes
// AVANT de lire le WR, et on écarte ce qui est sous ~20 épisodes.
// ⚠ Corollaire du 01/08 : ne pas décomposer sans SÉPARER LES CÔTÉS — une case qui mêle BUY et SELL
//   peut voir une CONT SELL à 42 % inverser à elle seule la lecture.
const API = "http://localhost:3001/api/matrix";
const IN_END = "2026-07-24", OOS_START = "2026-07-27";
const GAP = 240;   // minutes — au-delà, nouvel épisode
const BE = 75;     // point mort : toutes les tables TP/SL sont à ratio 1:3
const MOTIF = "adx-deadband";
const day = (ep) => new Date(ep * 60000).toISOString().slice(0, 10);

const assets = await (await fetch(`${API}/assets`)).json();
const cont = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const mine = (j.signals || [])
    .filter((s) => typeof s.R === "number" && s.type !== "EXHAUSTION")
    .map((s) => ({ R: s.R, out: s.outcome, asset: a, side: s.side, ep: s.openEp ?? s.ep,
                   d: day(s.openEp ?? s.ep), by: s.exhRef?.by ?? "(aucun)" }));
  // épisodes : par actif ET par motif — deux motifs différents sur la même heure sont deux
  // cohortes distinctes, les fusionner mélangerait ce qu'on cherche justement à séparer.
  for (const by of new Set(mine.map((x) => x.by))) {
    const seq = mine.filter((x) => x.by === by).sort((x, y) => x.ep - y.ep);
    let epi = 0, prev = -Infinity;
    for (const t of seq) { if (t.ep - prev > GAP) epi++; prev = t.ep; t.epi = `${a}|${by}|${epi}`; }
  }
  cont.push(...mine);
}

const stat = (s) => {
  const w = s.filter((x) => x.out === "WIN").length, l = s.filter((x) => x.out === "LOSS").length;
  const R = s.reduce((a, b) => a + b.R, 0);
  return { n: s.length, ep: new Set(s.map((x) => x.epi)).size, wr: (w + l) ? w / (w + l) * 100 : 0,
           rtr: s.length ? R / s.length : 0 };
};
const row = (lbl, s, seuil = 20) => {
  const t = stat(s);
  const marge = t.wr - BE;
  const flou = t.ep < seuil ? "  ⚠illisible" : marge < 0 ? "  🔴" : "";
  console.log(`${lbl.padEnd(22)} ${String(t.ep).padStart(4)} ép ${String(t.n).padStart(5)} tr  `
    + `WR ${t.wr.toFixed(2).padStart(6)} %  marge ${((marge >= 0 ? "+" : "") + marge.toFixed(2)).padStart(6)}`
    + `  R/tr ${t.rtr.toFixed(4).padStart(7)}${flou}`);
};

const db = cont.filter((x) => x.by === MOTIF);
const autres = cont.filter((x) => x.by !== MOTIF);

console.log(`\n=== CONT héritée de "${MOTIF}" — épisode = 4 h, même actif · point mort ${BE} % ===`);
row("TOUT LE MOTIF", db);
row("  calibrage", db.filter((x) => x.d <= IN_END));
row("  vérif", db.filter((x) => x.d >= OOS_START));
console.log(`\n-- référence : le RESTE de la CONT --`);
row("autres motifs", autres);
row("  calibrage", autres.filter((x) => x.d <= IN_END));
row("  vérif", autres.filter((x) => x.d >= OOS_START));
const tr = db.length / cont.length * 100, ep = stat(db).ep / stat(cont).ep * 100;
console.log(`\npoids du motif : ${tr.toFixed(1)} % des trades CONT · ${ep.toFixed(1)} % des épisodes CONT`);

console.log(`\n-- par CÔTÉ --`);
for (const c of ["BUY", "SELL"]) {
  row(c, db.filter((x) => x.side === c));
  row(`  calib`, db.filter((x) => x.side === c && x.d <= IN_END));
  row(`  vérif`, db.filter((x) => x.side === c && x.d >= OOS_START));
}

console.log(`\n-- par ACTIF (trié par épisodes) --`);
const parEp = [...assets].sort((a, b) => stat(db.filter((x) => x.asset === b)).ep
                                       - stat(db.filter((x) => x.asset === a)).ep);
for (const a of parEp) {
  const s = db.filter((x) => x.asset === a);
  if (!s.length) { console.log(`${a.padEnd(22)}    0 ép — jamais en zone morte`); continue; }
  row(a, s);
}

console.log(`\n-- par ACTIF × CÔTÉ, cellules à ≥ 20 épisodes seulement --`);
for (const a of parEp) for (const c of ["BUY", "SELL"]) {
  const s = db.filter((x) => x.asset === a && x.side === c);
  if (stat(s).ep >= 20) row(`${a} ${c}`, s);
}
