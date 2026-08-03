// _leads_recheck.mjs — LES DEUX PISTES JAMAIS CÂBLÉES, REMESURÉES SUR LE MOTEUR D'AUJOURD'HUI.
//   Usage: npx vite-node stats/_leads_recheck.mjs
//
// ⚠⚠ POURQUOI CE SCRIPT EXISTE : les deux chiffres de la liste (`%K M15 > 85 · SELL` à 90,63 % et le
//   « gap K/D en U ») ont été mesurés HORS SPREAD et SANS le cap d'admission. Le moteur est passé de
//   9 058 à 5 667 trades dans la journée. « Source changée ⇒ tout ce qui a été calibré dessus est à
//   REMESURER » — on ne câble pas un chiffre d'avant-hier sur un moteur d'aujourd'hui.
//
// ⚠⚠ DÉDUPLICATION PAR ÉPISODE OBLIGATOIRE. La même configuration H1 tire à chaque évaluation ; les
//   cohortes brutes ont été mesurées gonflées ×17,8 aujourd'hui même. Un WR par TIR ne veut rien dire.
//   ⇒ Tout est compté en ÉPISODES — convention dans `_episodes.mjs` (actif | côté | THÈSE, > 15 min).
//
// ⚠ Le repère n'est PAS zéro, c'est le POINT MORT du couple de l'actif (`be = sl/(sl+tp)`), et il
//   diffère d'un actif à l'autre. On compare donc chaque cohorte à la population dont elle sort.
import fs from "fs";
import path from "path";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";
// ⭐ Convention d'épisode et stats de cohorte : UN SEUL endroit (cf. `_episodes.mjs`).
import { dedupeEpisodes, cohortStats } from "./_episodes.mjs";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv")).sort();

const all = [];
for (const f of files) {
  const r = runMatrixBacktest(path.join(MATRIX, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) {
    if (typeof s.R !== "number") continue;
    all.push({
      R: s.R, outcome: s.outcome, reason: s.reason, side: s.side, type: s.type, ep: s.ep, asset: r.asset,
      sep: s.separation, contact: s.obs?.contact, kM15: s.kM15,
    });
  }
}
const st = cohortStats;
const P = (label, t, ref) => {
  const s = st(t);
  // ⚠ LE VERDICT VIENT DE SIGMA, PAS DE LA MARGE. Sous 2 σ on ne conclut pas, quelle que soit
  //   l'ampleur apparente de l'écart.
  const v = !Number.isFinite(s.sig) ? "" : Math.abs(s.sig) < 2 ? "   bruit (<2σ)"
          : s.sig > 0 ? "   ⬅ SOLIDE" : "   ⚠ SOUS LE POINT MORT";
  console.log(`  ${label.padEnd(30)} ${String(s.n).padStart(4)} ép · WR ${Number.isFinite(s.wr) ? s.wr.toFixed(2).padStart(6) : "     —"} % · MARGE ${Number.isFinite(s.marge) ? s.marge.toFixed(2).padStart(6) : "     —"} · ${Number.isFinite(s.sig) ? (s.sig >= 0 ? "+" : "") + s.sig.toFixed(1).padStart(5) : "    —"} σ · R/tr ${Number.isFinite(s.rt) ? s.rt.toFixed(4).padStart(8) : "       —"}${v}`);
  return s;
};

const E = dedupeEpisodes(all);
const cont = E.filter((x) => x.type === "CONTINUATION");
console.log(`\nMoteur courant (spread facturé + cap P50) : ${E.length} épisodes · dont ${cont.length} CONT\n`);

// ══ PISTE 8 — `%K M15 > 85` côté SELL. Annoncé : 32 tr / 24 ép / 90,63 % / R/tr 0,2080 ══
console.log("PISTE 8 — %K M15 élevé, côté SELL   (annoncé 24 ép · 90,63 % · R/tr 0,2080, HORS spread)");
const refAll = P("  [référence] tout", E);
const sell = E.filter((x) => x.side === "SELL" && Number.isFinite(x.kM15));
P("  [référence] tous les SELL", sell, refAll);
for (const th of [80, 85, 90]) P(`  SELL · kM15 > ${th}`, sell.filter((x) => x.kM15 > th), refAll);
// ⭐ MIROIR — la règle doit être symétrique sauf motif déclaré. Si le bas ne réplique pas, c'est une
//   information sur la règle, pas une raison de la garder unilatérale sans le dire.
const buy = E.filter((x) => x.side === "BUY" && Number.isFinite(x.kM15));
for (const th of [20, 15, 10]) P(`  BUY · kM15 < ${th}   (miroir)`, buy.filter((x) => x.kM15 < th), refAll);

// ══ PISTE 9 — le gap K/D « en U » sur la CONT ══
// ⚠ `CONTACT/LOW/MEDIUM/HIGH` n'est PAS un champ du moteur : c'est un bandage de `separation`
//   (|K−D| H1) appliqué dans la sonde. `CONTACT` est l'état booléen `obs.contact`, les trois autres
//   sont les TERCILES du reste — donc des effectifs comparables par construction, pas des bornes
//   posées à la main. (Découper avant d'avoir vu la distribution, c'est décider où on ne verra rien.)
console.log("\nPISTE 9 — gap K/D « en U » sur la CONT   (annoncé CONTACT 85,07 % · HIGH 85,00 % contre LOW/MEDIUM 77-78 %)");
const refCont = P("  [référence] toute la CONT", cont);
const inContact = cont.filter((x) => x.contact === "CONTACT");
const sepd = cont.filter((x) => x.contact !== "CONTACT" && Number.isFinite(x.sep));
const q = [...sepd.map((x) => x.sep)].sort((a, b) => a - b);
const t1 = q[Math.floor(q.length / 3)], t2 = q[Math.floor(2 * q.length / 3)];
P("  CONTACT", inContact, refCont);
P(`  LOW    (sep < ${t1?.toFixed(2)})`, sepd.filter((x) => x.sep < t1), refCont);
P(`  MEDIUM (${t1?.toFixed(2)}–${t2?.toFixed(2)})`, sepd.filter((x) => x.sep >= t1 && x.sep < t2), refCont);
P(`  HIGH   (sep ≥ ${t2?.toFixed(2)})`, sepd.filter((x) => x.sep >= t2), refCont);
console.log(`\n  poids LOW+MEDIUM : ${(100 * sepd.filter((x) => x.sep < t2).length / cont.length).toFixed(1)} % de la CONT (annoncé 67 %)`);
console.log("\n  ⚠ La forme en U ne vaut que si les DEUX extrêmes battent le milieu ET que les effectifs tiennent.");
console.log("  ⚠ Un écart de marge sous ~1,5 pt sur ces effectifs n'est pas distinguable du bruit.");
