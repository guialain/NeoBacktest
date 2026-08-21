// _force_d1_periode.mjs — LA FIGURE COURANTE VENTILEE PAR **AMPLITUDE DU D1** ET PAR SOUS-PERIODE.
//   usage : node stats/_force_d1_periode.mjs         (PERIODES=2 par defaut)
//
// ⭐⭐⭐ POURQUOI `forceScore` ET PAS LE REGIME c2. Mesure du 07/08 : sur cette population la
//   correspondance est EXACTE — `LOW`/`MEDIUM` ⇒ « Soft Bull/Bear », `HIGH`/`EXTREME` ⇒ « Strong
//   Bull/Bear », sans une seule exception. Le regime n'apporte donc AUCUNE information de plus : il
//   RE-ETIQUETTE `dailyForce`, qui est l'un de ses deux `REGIME_DEFINERS`. Entre les deux on garde
//   la MESURE et pas le LABEL — un label est un argmax sur 12 observables, il peut changer de
//   vainqueur pour une raison sans rapport avec ce qu'on croit lire.
// ⭐ ET IL EST NON SIGNE : `forceScore` est l'AMPLITUDE du deplacement du jour (D1 LIVE seul). Une
//   magnitude n'a pas de cote, donc la coupe est miroir PAR CONSTRUCTION — rien a symetriser.
//   ⚠ C'est l'inverse du regime, dont le SIGNE donne `regDir` donc le cote du fade : ventiler par
//   profil nu, c'est lire un tableau regime × cote sans le dire, chaque case sur un demi-echantillon.
//
// ⚠ BANDES = `FORCE_BANDS = [25, 50, 75]` de `classifyMarketProfile.js`, recopiees et pas
//   re-decoupees : refabriquer des percentiles ici donnerait un SECOND vocabulaire pour la meme
//   grandeur. ⚠ `forceScore` est QUANTIFIE (0 · 25 · 50 · 75 observes) — des bandes de percentiles
//   dessus coupent AU MILIEU d'une valeur et melangent deux niveaux dans la meme case.
// ⚠ FRONTIERES DE PERIODE RECOPIEES DE `_pop.mjs` (bornes du DATASET, pas de la population) : deux
//   conditions differentes produisent ainsi les MEMES fenetres, donc des colonnes comparables.
// ⚠ LIRE LE SENS, PAS LE CHIFFRE : ~20 a 30 episodes par case, σ ≈ 8 pt.
import { dedupeEpisodes } from "./_episodes.mjs";

const API = "http://localhost:3001/api/matrix";
const NP = Number(process.env.PERIODES ?? 2);
const D0 = Math.floor(Date.UTC(2026, 5, 29) / 60000);     // 1er jour du dataset
const D1 = Math.floor(Date.UTC(2026, 7, 6) / 60000);      // lendemain du dernier
const pas = (D1 - D0) / NP;
const jour = (e) => new Date(e * 60000).toISOString().slice(5, 10);

const FORCE_BANDS = [25, 50, 75];
const NIVEAUX = ["LOW", "MEDIUM", "HIGH", "EXTREME"];
const bande = (f) => f == null ? "?"
  : f < FORCE_BANDS[0] ? "LOW" : f < FORCE_BANDS[1] ? "MEDIUM" : f < FORCE_BANDS[2] ? "HIGH" : "EXTREME";

const BE = 75;
const st = (t) => {
  const w = t.filter((x) => x.outcome === "WIN").length, n = t.length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  return { n, w, wr: n ? 100 * w / n : NaN, R, sig: (100 * w / n - BE) / (Math.sqrt(0.75 * 0.25 / n) * 100) };
};
const cell = (t) => {
  if (!t.length) return "        —        ";
  const s = st(t);
  return `${String(s.n).padStart(3)} ${s.wr.toFixed(1).padStart(5)}% ${((s.sig >= 0 ? "+" : "") + s.sig.toFixed(2)).padStart(6)}σ`;
};
const ligne = (lbl, t, fen) =>
  console.log(lbl.padEnd(18) + [t, ...fen.map((f) => t.filter(f.dans))].map(cell).join(" |") +
    `   R ${((st(t).R >= 0 ? "+" : "") + st(t).R.toFixed(1)).padStart(6)}`);

const assets = await (await fetch(`${API}/assets`)).json();

for (const SP of [true, false]) {
  let all = [];
  for (const a of assets) {
    const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2&chargeSpread=${SP}`)).json();
    for (const s of (j.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
  }
  const ep = dedupeEpisodes(all, (s) => s.asset).filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

  const fen = [];
  for (let k = 0; k < NP; k++) {
    const a = D0 + k * pas, b = k === NP - 1 ? D1 : D0 + (k + 1) * pas;
    fen.push({ lbl: `P${k + 1} ${jour(a)}→${jour(b - 1)}`, dans: (s) => Number.isFinite(s.ep) && s.ep >= a && s.ep < b });
  }

  console.log(`\n══ [${SP ? "spread FACTURÉ" : "HORS SPREAD"}]  ${ep.length} épisodes  ·  σ contre le point mort 75 % ══`);
  console.log("".padEnd(18) + ["TOTAL", ...fen.map((f) => f.lbl)].map((x) => x.padStart(17)).join(" |"));
  ligne("POPULATION", ep, fen);
  for (const b of NIVEAUX) {
    const t = ep.filter((s) => bande(s.forceScore) === b);
    if (t.length) ligne(`  ${b}`, t, fen);
  }
  const absent = ep.filter((s) => bande(s.forceScore) === "?");
  if (absent.length) ligne("  ⚠ forceScore null", absent, fen);
  // La coupe candidate : « on ne fade pas un jour sans amplitude ». Les deux cotes affiches —
  //   une coupe vraie d'un seul cote serait une asymetrie sans motif, pas un gain.
  console.log("");
  const garde = ep.filter((s) => bande(s.forceScore) !== "LOW" && bande(s.forceScore) !== "?");
  ligne("≥ MEDIUM", garde, fen);
  for (const side of ["BUY", "SELL"]) ligne(`    ${side}`, garde.filter((s) => s.side === side), fen);
}
