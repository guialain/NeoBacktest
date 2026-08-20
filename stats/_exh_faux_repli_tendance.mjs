// _exh_faux_repli_tendance.mjs — « L'OSCILLATEUR PLAFONNE ET FAIT SEMBLANT DE RETRACER, LE PRIX
//   RESTE LOIN DE LA MOYENNE ET CONTINUE » (owner, 20/08 — pattern vu maintes fois en reel).
// ============================================================================================
// 🎯 LE MECANISME, ET C'EST LUI QUI DOIT TENIR A L'OOS, PAS LE CHIFFRE :
//   `%K` est **BORNE** [0·100] et renormalise sur sa fenetre recente. `z` est **NON BORNE** : il
//   mesure la distance a la moyenne. En tendance installee, la fenetre du stochastique se DEPLACE
//   avec le prix ⇒ le `%K` peut plafonner puis refluer **sans que le prix revienne d'un pouce**.
//   Le rang ① lit le `%K` (famille `stochH1`) et y voit un essoufflement. Il n'y en a pas.
//   ⇒ LA SIGNATURE EST UN **DESACCORD DE SIGNE** entre la vitesse d'un capteur BORNE et celle d'un
//     capteur NON BORNE. Aucune famille du bareme ne peut l'exprimer : elles s'ADDITIONNENT.
//
// 🎯 LES TROIS TERMES, tous orientes « cote fade » (SELL = on fade une hausse ; BUY en miroir) :
//   Ⓐ L'OSCILLATEUR PLAFONNE ET REFLUE : `kOr H1 > K_HAUT` ET `%K` en BAISSE depuis la cloture
//      precedente (`kH1 − kH1S1` oriente < 0). C'est le « faux repli ».
//   Ⓑ LE PRIX NE REVIENT PAS : `zOr ≥ Z_LOIN` (toujours loin de la moyenne) ET `Δz` oriente ≥ 0
//      (l'ecart ne se resorbe pas). C'est le « le prix continue ».
//   Ⓒ LA TENDANCE EST INSTALLEE : regime `Strong Bull`/`Rally` quand on VEND (miroir : `Strong
//      Bear`/`Sell-off` quand on ACHETE) — on fade une tendance forte, pas un marche mou.
//
// ⚠⚠ MESURE SUR LES **FANTOMES** D'ABORD (`ghostAllExh`), PAS SUR LES TIRS. Mesure du 20/08 : 87 %
//   des barres a avis de fade ne deviennent JAMAIS un trade (vetos, `MIN_EXH`, spacing). Lire la
//   figure sur les tirs, c'est la lire la ou les filtres l'ont deja laissee passer — un COLLIDER.
//   ⭐ Et c'est ce qui a fait croire 8 fois que « la figure est la journee du 30/07 » : le 30/07 est
//   en fait un jour de MARCHE (11 actifs, 30 episodes, 33,3 % contre 75,2 % de moyenne).
// ⚠ DEDUPLICATION avant le walk : sans elle une rafale de 15 tirs compte 15 fois et FABRIQUE l'effet.
// ⚙ Usage : `node stats/_exh_faux_repli_tendance.mjs`  ·  `K_HAUT=70 Z_LOIN=2.0`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes } from "./_episodes.mjs";

const envNum = (k, def) => {
  const raw = process.env[k];
  if (raw === undefined || raw === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
};
const K_HAUT = envNum("K_HAUT", 70), Z_LOIN = envNum("Z_LOIN", 1.5);
const ADX_MIN = envNum("ADX_MIN", 25), DI_RATIO = envNum("DI_RATIO", 2.0), NMIN = envNum("NMIN", 25);
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
// 🔴🔥 `dz_h1` (BARRE A BARRE), PAS `z_s0 − z_close` (INTRA-BARRE). Le 1er jet prenait le second :
//   sur la barre de reference de l'owner il vaut −0,11 quand `dz_h1` vaut +0,01 — SIGNES OPPOSES,
//   et les deux ne s'accordent que dans 38,7 % des cas. « Le prix ne revient pas » d'une barre a
//   l'autre se lit sur `dz_h1`. Mesurer l'autre, c'etait mesurer l'inverse de la figure.
const dzOr = (x) => (Number.isFinite(x.dzH1Col) ? S(x) * x.dzH1Col : null);
const kOr = (x) => (Number.isFinite(x.kH1) ? (x.side === "SELL" ? x.kH1 : 100 - x.kH1) : null);
const dkOr = (x) => (Number.isFinite(x.kH1) && Number.isFinite(x.kH1S1) ? S(x) * (x.kH1 - x.kH1S1) : null);
// ⛔ LE REGIME EST INUTILISABLE ICI : `null` sur 478 des 592 episodes (81 %). Le 1er jet s'en
//   servait pour « marche fortement haussier » — il n'ecartait pas des marches mous, il ecartait
//   des DONNEES MANQUANTES, et la figure complete tombait a 1 episode. ⭐ On le remplace par
//   l'ADX + la DOMINANCE DI, qui sont PEUPLES — et qui sont justement les capteurs que le rang ①
//   ne lit plus depuis le 13/08 (`diFade` supprime avec l'entree ②).
// ⚠ « DI contre le fade » = le camp qu'on affronte : +DI si on VEND, −DI si on ACHETE.
const diContre = (x) => (x.side === "SELL" ? x.diPlus : x.diMinus);
const diPour = (x) => (x.side === "SELL" ? x.diMinus : x.diPlus);
const tendance = (x) => Number.isFinite(x.adxH1Live) && Number.isFinite(diContre(x)) && Number.isFinite(diPour(x))
  && x.adxH1Live >= ADX_MIN && diPour(x) > 0 && (diContre(x) / diPour(x)) >= DI_RATIO;

const pop = E.filter((x) => [zOr(x), dzOr(x), kOr(x), dkOr(x)].every(Number.isFinite));
const perdus = E.length - pop.length;

const BE = 75;
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => 100 * v.g / v.n;
const ref = wr(agg(pop));
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(50)}${String(a.length).padStart(5)}  ${wr(agg(a)).toFixed(2).padStart(6)} %  ${agg(a).R.toFixed(1).padStart(7)} R  ${(agg(a).R / a.length).toFixed(4).padStart(8)}  ${((wr(agg(a)) - ref >= 0 ? "+" : "") + (wr(agg(a)) - ref).toFixed(2)).padStart(7)} pt`
  : `   ${lbl.padEnd(50)}    — (vide)`;

const A = (x) => kOr(x) > K_HAUT && dkOr(x) < 0;      // l'oscillateur plafonne et reflue
const B = (x) => zOr(x) >= Z_LOIN && dzOr(x) >= 0;    // le prix ne revient pas
const C = tendance;                                    // la tendance est installee

console.log(`\n══ « FAUX REPLI EN TENDANCE » — POPULATION FANTOME (hors collider) ══`);
console.log(`   Ⓐ kOr H1 > ${K_HAUT} ET %K en baisse (vs cloture prec.)`);
console.log(`   Ⓑ zOr ≥ ${Z_LOIN} ET \`dz_h1\` oriente ≥ 0  (BARRE A BARRE, pas intra-barre)`);
console.log(`   Ⓒ ADX H1 live ≥ ${ADX_MIN} ET DI-contre / DI-pour ≥ ${DI_RATIO}`);
console.log(`   episodes lisibles ${pop.length}` + (perdus ? `  ⚠ ${perdus} EXCLUS (capteur absent)` : "") + `  ·  moyenne fantome ${ref.toFixed(2)} %`);
// ⭐ LE CAS D'ECOLE DOIT PASSER SES PROPRES FILTRES. Le 1er jet excluait la barre de reference de
//   l'owner par 0,02 (zOr 1,98 contre un seuil a 2,0) — une figure dont le cas d'ecole echoue ne
//   mesure pas la figure. On le VERIFIE a l'ecran, on ne l'espere pas.
{
  const t = pop.filter((x) => x.asset === "US_TECH100" && String(x.tsMT ?? "").startsWith("2026.07.30"));
  console.log(`   ⭐ cas d'ecole US_TECH100 30/07 : ${t.length} episode(s) dans la population` +
    t.map((x) => `  [${x.tsMT} ${x.side} zOr ${zOr(x)?.toFixed(2)} dz ${dzOr(x)?.toFixed(2)} kOr ${kOr(x)?.toFixed(1)} dk ${dkOr(x)?.toFixed(1)} adx ${x.adxH1Live} DI ${diContre(x)}/${diPour(x)} ⇒ Ⓐ${A(x) ? "✔" : "✘"} Ⓑ${B(x) ? "✔" : "✘"} Ⓒ${C(x) ? "✔" : "✘"}]`).join(""));
}

console.log(`\n   ${"case".padEnd(50)}${"ep.".padStart(5)}      WR        R     R/ep    ecart`);
console.log(`   ── CHAQUE TERME SEUL ──`);
console.log(L(`Ⓐ oscillateur plafonne et reflue`, pop.filter(A)));
console.log(L(`Ⓑ le prix ne revient pas`, pop.filter(B)));
console.log(L(`Ⓒ tendance forte dans le sens fade`, pop.filter(C)));
console.log(`   ── LE DESACCORD SEUL (Ⓐ ET Ⓑ) — la signature ──`);
console.log(L(`⭐ Ⓐ ET Ⓑ  « le %K reflue, le prix non »`, pop.filter((x) => A(x) && B(x))));
console.log(L(`   Ⓐ ET NON-Ⓑ  (le %K reflue ET le prix revient)`, pop.filter((x) => A(x) && !B(x))));
console.log(L(`   NON-Ⓐ ET Ⓑ  (le %K ne reflue pas)`, pop.filter((x) => !A(x) && B(x))));
console.log(L(`   NON-Ⓐ ET NON-Ⓑ`, pop.filter((x) => !A(x) && !B(x))));
console.log(`   ── AVEC LE REGIME ──`);
console.log(L(`⭐⭐ Ⓐ ET Ⓑ ET Ⓒ  — la figure complete`, pop.filter((x) => A(x) && B(x) && C(x))));
console.log(L(`   Ⓐ ET Ⓑ SANS Ⓒ (meme desaccord, marche mou)`, pop.filter((x) => A(x) && B(x) && !C(x))));

// ⭐⭐⭐ L'INTERACTION : le desaccord Ⓐ×Ⓑ coute-t-il PLUS que la somme de ses deux termes ?
//   Une combinaison LINEAIRE ne discrimine pas ; seul un CROISEMENT separe. On le CALCULE.
{
  const n = pop.filter((x) => !A(x) && !B(x)), a = pop.filter((x) => A(x) && !B(x));
  const b = pop.filter((x) => !A(x) && B(x)), ab = pop.filter((x) => A(x) && B(x));
  if (n.length && a.length && b.length && ab.length) {
    const pred = wr(agg(n)) + (wr(agg(a)) - wr(agg(n))) + (wr(agg(b)) - wr(agg(n)));
    console.log(`\n   ── INTERACTION Ⓐ×Ⓑ ──  additif predirait ${pred.toFixed(2)} % · observe ${wr(agg(ab)).toFixed(2)} %` +
      `  ⇒ ${(wr(agg(ab)) - pred >= 0 ? "+" : "") + (wr(agg(ab)) - pred).toFixed(2)} pt` +
      // ⚠⚠ UN VERDICT EXIGE UN EFFECTIF. Le 1er jet imprimait « CROISEMENT REEL » sur 8 episodes.
      //   Un garde-fou qui conclut sans regarder n est un commentaire executable.
      `${ab.length < NMIN ? `   ⚠⚠ ${ab.length} EPISODES — SOUS LE SEUIL DE LECTURE (${NMIN}), AUCUN VERDICT`
        : Math.abs(wr(agg(ab)) - pred) < 3 ? "   ⇒ ADDITIF : le croisement n'apporte rien" : "   ⇒ CROISEMENT REEL"}`);
  }
}
// ⭐ PAR COTE + CRIBLE — un cote jamais mesure est ou le degat arrive ; et le 30/07 est un JOUR DE
//   MARCHE, donc une figure qui n'y vit QUE la-dedans decrit la journee, pas la barre.
const fig = pop.filter((x) => A(x) && B(x) && C(x));
if (fig.length) {
  const jour = (x) => `${x.asset}|${String(x.tsMT ?? "").slice(0, 10)}`;
  console.log(`\n   ── LA FIGURE : PAR COTE, PAR JOUR ──`);
  for (const c of ["SELL", "BUY"]) {
    const p = fig.filter((x) => x.side === c), r = wr(agg(pop.filter((x) => x.side === c)));
    console.log(`      ${c.padEnd(5)} ${String(p.length).padStart(3)} ep. / ${p.length ? wr(agg(p)).toFixed(2) : "—"} %   (moyenne fantome du cote ${r.toFixed(2)} %)`);
  }
  const g = new Map();
  for (const x of fig) { const k = jour(x); const o = g.get(k) ?? { n: 0, w: 0 }; o.n++; if ((x.R ?? 0) > 0) o.w++; g.set(k, o); }
  console.log(`      grappes distinctes : ${g.size} pour ${fig.length} episodes`);
  const j3007 = [...g.entries()].filter(([k]) => k.includes("2026.07.30"));
  console.log(`      dont le 30/07 : ${j3007.length} couple(s), ${j3007.reduce((a, [, o]) => a + o.n, 0)} episode(s)`);
  const sans = fig.filter((x) => !String(x.tsMT ?? "").startsWith("2026.07.30"));
  console.log(L(`      la figure SANS toute la journee du 30/07`, sans));
  console.log(`      les grappes : ${[...g.keys()].slice(0, 14).join(" · ")}${g.size > 14 ? " …" : ""}`);
}
console.log("");
