// _adx_m15_calib.mjs — RECALIBRAGE DES BORNES DE NIVEAU D'ADX, SUR LE CAPTEUR RÉELLEMENT LU (M15).
//
// Les bornes 40 / 50 ont été mesurées le 22/07 sur l'ADX H1. Le 27/07 la porte a basculé sur
// `dominance.perTf.m15.adx` (OpportunityDetector.js:1852) et les bornes n'ont pas bougé. On remesure.
//
// ⚠ À FAIRE TOURNER AVEC LE BLOC ADX NEUTRALISÉ dans SignalDecision.exhContextReason — sinon la
//   bande [40,50) n'a aucune observation (elle est refusée par construction) et la table ment.
//   Contrôle automatique ci-dessous : si la porte est encore active, on s'arrête.
//
// On juge sur la COHORTE EXH (exh_first_cont_own_session) : la question est « le fade tient-il à ce
// niveau d'ADX ? ». Point mort 75 % partout (tables TP/SL toutes à ratio 1:3), donc la marge
// `WR − 75` est comparable d'une case à l'autre.
// ÉPISODE = tirs contigus sur le même actif, fenêtre 4 h. On ne lit pas une case sous 20 épisodes.
const API = "http://localhost:3001/api/matrix";
const IN_END = "2026-07-24", OOS_START = "2026-07-27";
const GAP = 240, BE = 75, SEUIL_EP = 20;
const day = (ep) => new Date(ep * 60000).toISOString().slice(0, 10);
const extreme = (z) => z === "EXTREME_HAUTE" || z === "EXTREME_BASSE";

const assets = await (await fetch(`${API}/assets`)).json();
const exh = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const mine = (j.signals || [])
    .filter((s) => typeof s.R === "number" && s.type === "EXHAUSTION" && Number.isFinite(s.adxM15))
    .map((s) => ({ R: s.R, out: s.outcome, asset: a, side: s.side, adx: s.adxM15,
                   ext: extreme(s.zoneH1), ep: s.openEp ?? s.ep, d: day(s.openEp ?? s.ep) }))
    .sort((x, y) => x.ep - y.ep);
  let epi = 0, prev = -Infinity;
  for (const t of mine) { if (t.ep - prev > GAP) epi++; prev = t.ep; t.epi = `${a}|${epi}`; }
  exh.push(...mine);
}

// ── CONTRÔLE : la porte doit être NEUTRALISÉE, sinon rien n'est mesurable au-dessus de 40 ──
const haut = exh.filter((x) => x.adx >= 40).length;
console.log(`cohorte EXH ${exh.length} trades · dont ${haut} à adxM15 ≥ 40 (${(100 * haut / exh.length).toFixed(1)} %)`);
if (haut < 50) {
  console.log(`\n🔴 STOP — quasi aucun fade au-dessus de 40 : la porte est ENCORE ACTIVE.`);
  console.log(`   Neutraliser le bloc ADX de SignalDecision.exhContextReason puis relancer le serveur.`);
  process.exit(1);
}

const stat = (s) => {
  const w = s.filter((x) => x.out === "WIN").length, l = s.filter((x) => x.out === "LOSS").length;
  const R = s.reduce((a, b) => a + b.R, 0);
  return { n: s.length, ep: new Set(s.map((x) => x.epi)).size, wr: (w + l) ? w / (w + l) * 100 : 0,
           rtr: s.length ? R / s.length : 0 };
};
const row = (lbl, s) => {
  const t = stat(s), m = t.wr - BE;
  const flag = t.ep < SEUIL_EP ? "  ⚠illisible" : m < 0 ? "  🔴" : m > 5 ? "  ⭐" : "";
  console.log(`${lbl.padEnd(24)} ${String(t.ep).padStart(4)} ép ${String(t.n).padStart(5)} tr  `
    + `WR ${t.wr.toFixed(2).padStart(6)} %  marge ${((m >= 0 ? "+" : "") + m.toFixed(2)).padStart(6)}`
    + `  R/tr ${t.rtr.toFixed(4).padStart(7)}${flag}`);
};

// Bandes fines de 5 en 5 : c'est la résolution qui a servi à poser 40/50 sur le H1.
const BORNES = [0, 20, 25, 30, 35, 40, 45, 50, 55, 60, 999];
console.log(`\n=== LE FADE PAR NIVEAU D'adxM15 (porte neutralisée) · point mort ${BE} % ===`);
for (let i = 0; i < BORNES.length - 1; i++) {
  const [lo, hi] = [BORNES[i], BORNES[i + 1]];
  row(`adxM15 ${lo}–${hi === 999 ? "∞" : hi}`, exh.filter((x) => x.adx >= lo && x.adx < hi));
}

console.log(`\n=== × ZONE EXTRÊME (la règle du climax : fade autorisé si %K H1 au bord) ===`);
for (let i = 0; i < BORNES.length - 1; i++) {
  const [lo, hi] = [BORNES[i], BORNES[i + 1]];
  const s = exh.filter((x) => x.adx >= lo && x.adx < hi);
  if (stat(s).ep < SEUIL_EP) continue;
  console.log(`-- adxM15 ${lo}–${hi === 999 ? "∞" : hi} --`);
  row(`  EXTRÊME`, s.filter((x) => x.ext));
  row(`  non extrême`, s.filter((x) => !x.ext));
}

console.log(`\n=== STABILITÉ : chaque bande sur les DEUX fenêtres ===`);
for (let i = 0; i < BORNES.length - 1; i++) {
  const [lo, hi] = [BORNES[i], BORNES[i + 1]];
  const s = exh.filter((x) => x.adx >= lo && x.adx < hi);
  if (stat(s).ep < SEUIL_EP) continue;
  row(`adxM15 ${lo}–${hi === 999 ? "∞" : hi}`, s);
  row(`  calibrage`, s.filter((x) => x.d <= IN_END));
  row(`  vérif`, s.filter((x) => x.d >= OOS_START));
}

// La borne basse actuelle vaut-elle mieux qu'une autre ? On balaie le point de coupure et on
// regarde ce qu'on GARDE et ce qu'on RETIRE — juger un seuil sur les deux populations échangées,
// pas sur l'agrégat (zscore_slope_regime).
console.log(`\n=== BALAYAGE DE LA BORNE BASSE : « fade refusé au-dessus de X » ===`);
console.log(`${"X".padEnd(6)} ${"GARDÉ (adx < X)".padEnd(34)}   RETIRÉ (adx ≥ X)`);
for (const X of [30, 35, 40, 45, 50, 55, 60]) {
  const g = stat(exh.filter((x) => x.adx < X)), r = stat(exh.filter((x) => x.adx >= X));
  const f = (t) => `${String(t.ep).padStart(4)} ép ${String(t.n).padStart(5)} tr  marge `
    + `${((t.wr - BE >= 0 ? "+" : "") + (t.wr - BE).toFixed(2)).padStart(6)}  R/tr ${t.rtr.toFixed(4).padStart(7)}`;
  console.log(`${String(X).padEnd(6)} ${f(g)}   |   ${f(r)}${r.ep < SEUIL_EP ? "  ⚠" : ""}`);
}
