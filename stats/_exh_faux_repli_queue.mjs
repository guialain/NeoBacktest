// _exh_faux_repli_queue.mjs — LA FIGURE JUGEE SUR SA **QUEUE**, PAS SUR SA MOYENNE.
// ============================================================================================
// 🔴🔥⭐⭐⭐ LE CHANGEMENT DE CRITERE, ET IL EST DOCTRINAL (owner, 20/08) :
//   « UN σ FAIBLE NE DISQUALIFIE PAS UNE REGLE DE PROTECTION — un fait rare est DILUE PAR
//     CONSTRUCTION. Le juge d'un veto : le maxDD et la QUEUE. »
//   Les figures que les traders reconnaissent sont RECURRENTES sans etre ABONDANTES. Les juger au
//   WR moyen et au σ, c'est le critere des ENTREES DE BAREME — et il est faux ici : une poche de
//   3 % du carnet qui porte 20 % des pertes ne bougera JAMAIS une moyenne, et elle vide le compte.
//   ⇒ ON MESURE : quelle PART DE LA PERTE vit dans la poche, sous quelle FORME (isolee ou en
//     SERIE), et ce que la queue devient sans elle.
// ⚠ CE FICHIER NE DECIDE PAS. Il decrit la queue a capacite 100/100, donc SANS substitution : le
//   verdict d'un veto se lit sur un carnet RE-COURU a `30/8`, ou les slots liberes sont reoccupes.
// ⚙ Usage : `node stats/_exh_faux_repli_queue.mjs`  ·  `Z_LOIN=1.5 K_HAUT=70 ADX_MIN=25 DI_RATIO=2`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

const envNum = (k, def) => {
  const raw = process.env[k];
  if (raw === undefined || raw === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
};
// ⚠⚠ `K_HAUT = 0` ⇒ AUCUN SEUIL DE NIVEAU. « Plafonner » veut dire CESSER DE PROGRESSER, pas
//   « etre au-dessus de X » — un oscillateur plafonne a 80 comme a 98. Les seuils 70 puis 90 puis
//   « 97-99 » etaient des choix de la SONDE, pas de l'owner, et le troisieme etait lu sur la courbe.
//   Le defaut est donc SANS niveau : la figure est la DIVERGENCE seule.
const K_HAUT = envNum("K_HAUT", 0), Z_LOIN = envNum("Z_LOIN", 1.5);
const ADX_MIN = envNum("ADX_MIN", 25), DI_RATIO = envNum("DI_RATIO", 2.0);
const MAXOPEN = envNum("MAXOPEN", 100), MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL,
  cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const EXH = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && typeof t.R === "number")
  .sort((a, b) => (a.ep ?? 0) - (b.ep ?? 0));

const S = (x) => (x.side === "SELL" ? 1 : -1);
const zOr = (x) => (Number.isFinite(x.zscoreH1) ? S(x) * x.zscoreH1 : null);
const dzOr = (x) => (Number.isFinite(x.dzH1Col) ? S(x) * x.dzH1Col : null);
const kOr = (x) => (Number.isFinite(x.kH1) ? (x.side === "SELL" ? x.kH1 : 100 - x.kH1) : null);
const dkOr = (x) => (Number.isFinite(x.kH1) && Number.isFinite(x.kH1S1) ? S(x) * (x.kH1 - x.kH1S1) : null);
const diContre = (x) => (x.side === "SELL" ? x.plusDi : x.minusDi);
const diPour = (x) => (x.side === "SELL" ? x.minusDi : x.plusDi);
const FIG = (x) => Number.isFinite(kOr(x)) && Number.isFinite(dkOr(x)) && Number.isFinite(zOr(x)) && Number.isFinite(dzOr(x))
  && (K_HAUT <= 0 ? true : kOr(x) > K_HAUT) && dkOr(x) <= 0
  && zOr(x) >= Z_LOIN && dzOr(x) >= 0
  && Number.isFinite(x.adxH1Live) && x.adxH1Live >= ADX_MIN
  && Number.isFinite(diContre(x)) && Number.isFinite(diPour(x)) && diPour(x) > 0 && (diContre(x) / diPour(x)) >= DI_RATIO;

const poche = EXH.filter(FIG), hors = EXH.filter((x) => !FIG(x));
const perte = (a) => a.filter((x) => (x.R ?? 0) <= 0);
const sumR = (a) => a.reduce((s, x) => s + (x.R ?? 0), 0);
const jour = (x) => `${x.asset ?? x.symbol}|${String(x.tsMT ?? "").slice(0, 10)}`;

console.log(`\n══ LA FIGURE JUGEE SUR SA QUEUE ══`);
console.log(`   %K ${K_HAUT > 0 ? `oriente > ${K_HAUT} et` : "(AUCUN seuil de niveau)"} ne progresse plus (dk ≤ 0) · z ≥ ${Z_LOIN} et dz ≥ 0 · ADX ≥ ${ADX_MIN} · DI ≥ ${DI_RATIO}:1`);
console.log(`   rang ① : ${EXH.length} tirs · ${perte(EXH).length} pertes · ${sumR(EXH).toFixed(1)} R`);
console.log(`\n   ── ① LA PART DE LA PERTE, PAS LA MOYENNE ──`);
console.log(`   poche : ${poche.length} tirs = ${(100 * poche.length / EXH.length).toFixed(1)} % du rang`);
console.log(`   pertes dans la poche : ${perte(poche).length} = ${(100 * perte(poche).length / perte(EXH).length).toFixed(1)} % DE TOUTES LES PERTES DU RANG`);
console.log(`   ⇒ CONCENTRATION : ${(perte(poche).length / perte(EXH).length / (poche.length / EXH.length)).toFixed(2)}×  (1,00 = la poche perd comme le reste)`);
console.log(`   R de la poche ${sumR(poche).toFixed(1)} · R hors poche ${sumR(hors).toFixed(1)}`);
console.log(`   R BRUT PERDU dans la poche : ${sumR(perte(poche)).toFixed(1)} R  sur ${sumR(perte(EXH)).toFixed(1)} R perdus au rang (${(100 * sumR(perte(poche)) / sumR(perte(EXH))).toFixed(1)} %)`);

// ── ② LA FORME DE LA PERTE : isolee, ou EN SERIE ? ────────────────────────────────────────────
// ⭐⭐⭐ C'est LA question pour une regle de protection. N pertes eparpillees se paient une par une ;
//   N pertes le meme jour sur le meme actif sont UN SEUL PARI perdu N fois, et c'est ca qui creuse
//   un drawdown. (`proteger_des_faits_rares_repetitifs` : corr. intra-secteur, N signaux UN pari.)
console.log(`\n   ── ② LA FORME : LA PERTE EST-ELLE EN SERIE ? ──`);
const parJ = new Map();
for (const x of poche) { const k = jour(x); const o = parJ.get(k) ?? { n: 0, p: 0, R: 0 }; o.n++; o.R += x.R ?? 0; if ((x.R ?? 0) <= 0) o.p++; parJ.set(k, o); }
const grappesPerdantes = [...parJ.entries()].filter(([, o]) => o.p >= 2).sort((a, b) => b[1].p - a[1].p);
console.log(`   ${parJ.size} grappes dans la poche · ${grappesPerdantes.length} en perdent ≥ 2`);
for (const [k, o] of grappesPerdantes.slice(0, 12))
  console.log(`      ${k.padEnd(26)} ${String(o.n).padStart(3)} tirs · ${String(o.p).padStart(3)} pertes · ${o.R.toFixed(1).padStart(6)} R`);
const pertesEnSerie = grappesPerdantes.reduce((s, [, o]) => s + o.p, 0);
console.log(`   ⇒ ${pertesEnSerie} des ${perte(poche).length} pertes de la poche (${(100 * pertesEnSerie / Math.max(1, perte(poche).length)).toFixed(0)} %) arrivent en SERIE`);
// le meme calcul HORS poche, sinon on ne sait pas si « en serie » est propre a la figure
const parJH = new Map();
for (const x of hors) { const k = jour(x); const o = parJH.get(k) ?? { n: 0, p: 0 }; o.n++; if ((x.R ?? 0) <= 0) o.p++; parJH.set(k, o); }
const serieH = [...parJH.values()].filter((o) => o.p >= 2).reduce((s, o) => s + o.p, 0);
console.log(`   HORS poche : ${serieH} des ${perte(hors).length} pertes (${(100 * serieH / Math.max(1, perte(hors).length)).toFixed(0)} %) en serie  ⇐ le point de comparaison`);

// ── ③ LA QUEUE : les pires journees du rang, et ce que la poche y pese ────────────────────────
console.log(`\n   ── ③ LES 12 PIRES JOURNEES DU RANG ① — ce que la figure y capte ──`);
const parJTout = new Map();
for (const x of EXH) { const k = jour(x); const o = parJTout.get(k) ?? { n: 0, p: 0, R: 0, fig: 0, figP: 0 }; o.n++; o.R += x.R ?? 0; if ((x.R ?? 0) <= 0) o.p++; if (FIG(x)) { o.fig++; if ((x.R ?? 0) <= 0) o.figP++; } parJTout.set(k, o); }
const pires = [...parJTout.entries()].sort((a, b) => a[1].R - b[1].R).slice(0, 12);
console.log(`   ${"actif|jour".padEnd(26)}${"tirs".padStart(6)}${"pertes".padStart(8)}${"R".padStart(9)}${"dont figure".padStart(13)}${"pertes captees".padStart(16)}`);
let captP = 0, totP = 0;
for (const [k, o] of pires) {
  captP += o.figP; totP += o.p;
  console.log(`   ${k.padEnd(26)}${String(o.n).padStart(6)}${String(o.p).padStart(8)}${o.R.toFixed(1).padStart(9)}${String(o.fig).padStart(13)}${`${o.figP}/${o.p}`.padStart(16)}`);
}
console.log(`   ⇒ sur ces 12 journees : la figure capte ${captP} des ${totP} pertes (${(100 * captP / Math.max(1, totP)).toFixed(0)} %)`);

// ── ④ CE QUE LA QUEUE DEVIENT SANS LA POCHE (approximation SANS substitution) ─────────────────
// ⚠⚠ APPROXIMATION ASSUMEE : retirer les tirs d'un carnet DEJA COURU n'est PAS un A/B. A `100/100`
//   la capacite ne mord pas, donc c'est proche — mais a `30/8` les slots liberes seraient
//   REOCCUPES et le resultat serait different. Le verdict se lit sur un carnet RE-COURU.
const eq = (arr) => {
  let e = 10000, peak = 10000, dd = 0;
  for (const x of arr) { e *= 1 + 0.01 * (x.R ?? 0); peak = Math.max(peak, e); dd = Math.max(dd, 100 * (peak - e) / peak); }
  return { fin: e, dd };
};
const a0 = eq(EXH), a1 = eq(hors);
console.log(`\n   ── ④ LA QUEUE AVEC ET SANS LA POCHE (approximation, PAS un A/B) ──`);
console.log(`   AVEC  ${EXH.length} tirs · WR ${(100 * (EXH.length - perte(EXH).length) / EXH.length).toFixed(2)} % · ${sumR(EXH).toFixed(1)} R · maxDD ${a0.dd.toFixed(2)} %`);
console.log(`   SANS  ${hors.length} tirs · WR ${(100 * (hors.length - perte(hors).length) / hors.length).toFixed(2)} % · ${sumR(hors).toFixed(1)} R · maxDD ${a1.dd.toFixed(2)} %`);
console.log(`   ⇒ ΔR ${(sumR(hors) - sumR(EXH)).toFixed(1)} · ΔmaxDD ${(a1.dd - a0.dd).toFixed(2)} pt`);
console.log(`\n   ⚠ le verdict d'un veto se lit a capacite REELLE (30/8), avec substitution.\n`);
