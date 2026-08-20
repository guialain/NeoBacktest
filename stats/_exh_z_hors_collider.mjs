// _exh_z_hors_collider.mjs — LE CHANTIER `z` MESURE **HORS COLLIDER**, SUR LES FANTOMES.
// ============================================================================================
// 🔴🔥⭐⭐⭐ POURQUOI CE FICHIER EXISTE (owner, 20/08). Toutes les mesures `z` de la journee tournent
//   sur les TIRS. Or un tir est une barre qui a survecu a TROIS filtres : les vetos, `MIN_EXH`, et
//   le spacing. Conditionner dessus est un COLLIDER — et il rend la conclusion « cette figure,
//   c'est la journee du 30/07 » INVERIFIABLE, parce que la meme figure peut exister ailleurs sans
//   jamais devenir un trade. ⇒ « la journee n'est peut-etre pas isolee, elle est peut-etre le seul
//   endroit ou ces barres PASSENT ENCORE. »
//
// ⭐ `ghostAllExh` rend TOUTES les barres ou la these de fade a un avis (`exh ≠ 0`), tirees ou non,
//   avec `fired`, `vetoed` et `waitNature`. On les simule avec `p.walk` : elles ne prennent aucune
//   place au carnet et ne paient pas l'espacement — on mesure donc la VALEUR INFORMATIVE de `z`,
//   pas ce que rapporterait de tout prendre. C'est exactement ce qu'on veut ici.
// ⚠ DEDUPLICATION AVANT le walk (`_episodes.mjs`) : sans elle, 5 marches sur 6 sont des clones de
//   la meme barre et la « rafale » du 30/07 serait comptee cinq fois — ce qui FABRIQUERAIT le
//   resultat qu'on est en train de tester.
// ⚠ Le cote du fantome vient du SIGNE du score (`exhScore > 0 ? BUY : SELL`), donc `zOr = SELL ?
//   +z : −z` se calcule ici, pas dans le moteur.
// ⚙ Usage : `node stats/_exh_z_hors_collider.mjs`  ·  `Z_SEUIL=2.2`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes } from "./_episodes.mjs";
const { MIN_EXH } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");

const envNum = (k, def) => {
  const raw = process.env[k];
  if (raw === undefined || raw === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
};
const Z_SEUIL = envNum("Z_SEUIL", 2.2);
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";

const E = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllExh: true, chargeSpread: true });
  const g = (p.ghosts ?? []).filter((c) => c.ghost === "exh-all").map((c) => ({ ...c, asset }));
  for (const c of dedupeEpisodes(g)) {
    const r = p.walk(c);
    if (r && typeof r.R === "number") E.push({ ...c, R: r.R, outcome: r.outcome });
  }
}
const S = (x) => (x.side === "SELL" ? 1 : -1);
const zOr = (x) => (Number.isFinite(x.zscoreH1) ? S(x) * x.zscoreH1 : null);
const pop = E.filter((x) => Number.isFinite(zOr(x)) && Number.isFinite(x.exhScore));
const jour = (x) => `${x.asset}|${String(x.tsMT ?? "").slice(0, 10)}`;

const BE = 75;
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => 100 * v.g / v.n;
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(46)}${String(a.length).padStart(6)}  ${wr(agg(a)).toFixed(2).padStart(6)} %  ${agg(a).R.toFixed(1).padStart(8)} R  ${(agg(a).R / a.length).toFixed(4).padStart(8)}`
  : `   ${lbl.padEnd(46)}     — (vide)`;

console.log(`\n══ CHANTIER \`z\` — POPULATION FANTOME (non conditionnee par les tirs) ══`);
console.log(`   MIN_EXH ${MIN_EXH} · seuil zOr ${Z_SEUIL} · NO_TRIGGER=1`);
const tires = pop.filter((x) => x.fired);
console.log(`   episodes EXH scores ${pop.length}  ·  dont TIRES ${tires.length} (${(100 * tires.length / pop.length).toFixed(1)} %)`);
console.log(`   ⇒ ${pop.length - tires.length} barres avaient un avis de fade et ne sont JAMAIS devenues un trade.`);

// ── ① L'EFFET DE `z`, SUR LES FANTOMES, PUIS SUR LES TIRS — le meme calcul, deux populations. ──
console.log(`\n   ── ① L'EFFET DE \`z\` : FANTOMES vs TIRS ──`);
for (const [nom, sous] of [["TOUS LES FANTOMES", pop], ["les TIRES seulement", tires], ["les NON TIRES", pop.filter((x) => !x.fired)]]) {
  const a = sous.filter((x) => zOr(x) < Z_SEUIL), b = sous.filter((x) => zOr(x) >= Z_SEUIL);
  console.log(`   ${nom}`);
  console.log(L(`      zOr < ${Z_SEUIL}`, a));
  console.log(L(`      zOr ≥ ${Z_SEUIL}`, b));
  if (a.length && b.length) console.log(`      ⇒ ecart ${(wr(agg(a)) - wr(agg(b))).toFixed(2)} pt`);
}

// ── ② LA JOURNEE EST-ELLE ISOLEE ? On la compare aux autres (actif|jour) SUR LES FANTOMES. ──
// ⭐⭐⭐ LA QUESTION EXACTE : `US_TECH100 30/07` produit-il des barres ANORMALES, ou seulement des
//   barres qui SURVIVENT plus souvent ? Deux colonnes repondent : le NOMBRE de fantomes, et le
//   TAUX DE SURVIE (fired / fantomes). Une journee banale qui survit anormalement est un probleme
//   de FILTRE ; une journee anormale est un probleme de MARCHE. Ce ne sont pas le meme chantier.
console.log(`\n   ── ② LA JOURNEE DU 30/07 EST-ELLE ISOLEE ? (sur les FANTOMES, pas les tirs) ──`);
const parJour = new Map();
for (const x of pop) {
  const k = jour(x);
  const o = parJour.get(k) ?? { n: 0, g: 0, R: 0, f: 0, fg: 0, veto: 0, sousSeuil: 0 };
  o.n++; o.R += x.R ?? 0; if ((x.R ?? 0) > 0) o.g++;
  if (x.fired) { o.f++; if ((x.R ?? 0) > 0) o.fg++; }
  else if ((x.vetoed ?? []).length) o.veto++;
  else if (Math.abs(x.exhScore) < MIN_EXH) o.sousSeuil++;
  parJour.set(k, o);
}
// ⚠⚠ SEUIL D'EFFECTIF BAS **PARCE QU'ON EST EN EPISODES, PAS EN TIRS** : `dedupeEpisodes` ecrase
//   une rafale de 15 tirs en 1 episode (946 tirs → 77 episodes tires). Un « ≥ 8 » calibre sur des
//   tirs ne laisse plus que 2 couples et la question ne peut plus se poser. C'est le motif
//   `episodes_et_comptage` : le meme seuil ne veut pas dire la meme chose sur les deux unites.
const NMIN_J = envNum("NMIN_J", 3);
const lignes = [...parJour.entries()].filter(([, o]) => o.n >= NMIN_J);
const tauxSurvie = (o) => 100 * o.f / o.n;
console.log(`   ${(parJour.size)} couples actif|jour · ${lignes.length} avec ≥ 8 fantomes`);
console.log(`   ${"actif|jour".padEnd(26)}${"fant.".padStart(7)}${"WR fant.".padStart(10)}${"tires".padStart(7)}${"WR tires".padStart(10)}${"survie".padStart(9)}${"veto".padStart(7)}${"<seuil".padStart(8)}`);
// ⚠ LA CIBLE SE PECHE DANS **TOUS** LES COUPLES, PAS DANS `lignes` — la filtrer par le seuil
//   d'effectif l'aurait fait disparaitre du tableau exactement quand elle est petite, c'est-a-dire
//   dans le cas ou la reponse est « elle n'est pas exceptionnelle ». (bug du 1er jet)
const cible = [...parJour.entries()].filter(([k]) => k.includes("2026.07.30") || k.includes("2026-07-30"));
const pires = [...lignes].sort((a, b) => wr(a[1]) - wr(b[1])).slice(0, 10);
const aff = new Map([...pires, ...cible].map((x) => [x[0], x[1]]));
for (const [k, o] of [...aff.entries()].sort((a, b) => wr(a[1]) - wr(b[1]))) {
  console.log(`   ${k.padEnd(26)}${String(o.n).padStart(7)}${wr(o).toFixed(2).padStart(9)} %${String(o.f).padStart(7)}${(o.f ? (100 * o.fg / o.f).toFixed(2) : "—").padStart(9)} %${tauxSurvie(o).toFixed(0).padStart(8)} %${String(o.veto).padStart(7)}${String(o.sousSeuil).padStart(8)}`);
}
const survies = lignes.map(([, o]) => tauxSurvie(o)).sort((a, b) => a - b);
const med = survies[Math.floor(survies.length / 2)];
console.log(`   ⇒ taux de survie MEDIAN sur les ${lignes.length} couples : ${med.toFixed(1)} %`);

// ── ③ ET LE CRIBLE, REFAIT SUR LES FANTOMES ────────────────────────────────────────────────────
// ⭐ Si l'ecart de `z` tient sur les fantomes APRES retrait de la pire grappe, alors il n'a jamais
//   ete « la journee » — et le crible applique aux tirs disait surtout que la journee est le seul
//   endroit ou ces barres passent.
console.log(`\n   ── ③ LE CRIBLE DE LA PIRE GRAPPE, REFAIT SUR LES FANTOMES ──`);
const mou = pop.filter((x) => zOr(x) < Z_SEUIL);
const pe = new Map();
for (const x of mou) if ((x.R ?? 0) <= 0) pe.set(jour(x), (pe.get(jour(x)) ?? 0) + 1);
const pire = [...pe.entries()].sort((a, b) => b[1] - a[1])[0];
if (pire) {
  const reste = mou.filter((x) => jour(x) !== pire[0]);
  const ref = wr(agg(pop));
  console.log(`      pire grappe : ${pire[0]} (${pire[1]} pertes / ${mou.filter((x) => jour(x) === pire[0]).length} fantomes de la poche)`);
  console.log(L(`      poche zOr < ${Z_SEUIL} AVEC elle`, mou));
  console.log(L(`      poche zOr < ${Z_SEUIL} SANS elle`, reste));
  console.log(`      moyenne fantome ${ref.toFixed(2)} %  ⇒  ${wr(agg(reste)) >= ref ? "⛔ s'inverse" : "✅ tient"}`);
  console.log(`      grappes distinctes dans la poche : ${new Set(mou.map(jour)).size}`);
}
console.log("");
