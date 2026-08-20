// _exh_faux_repli_tirs.mjs — « FAUX REPLI EN TENDANCE », MESURE **SUR LES TIRS**.
// ============================================================================================
// 🎯 POURQUOI SUR LES TIRS (owner, 20/08). La mesure fantome ne pouvait PAS tester cette figure :
//   `dedupeEpisodes` garde UN representant par episode, et pour `US_TECH100 30/07` il a garde la
//   barre de 13:44 (ou le `%K` MONTE, `dk = +2,1`) au lieu de celle de 16:31. ⇒ Une figure de
//   BARRE est invisible dans une population d'EPISODES des que le representant ne la porte pas.
//   Sur les tirs, chaque barre existe pour elle-meme.
// ⚠⚠ LE PRIX A PAYER, ET IL EST REEL : les tirs sont une population DEJA FILTREE (vetos, `MIN_EXH`,
//   spacing) — 87 % des barres a avis de fade n'y sont pas. C'est un COLLIDER. On ne peut donc PAS
//   conclure « la figure n'existe pas ailleurs » ; seulement « parmi ce qui a tire, voici ce qu'elle
//   vaut ». Les deux lectures sont complementaires, aucune ne remplace l'autre.
// ⭐⭐⭐ ET ON AGREGE AUX DEUX NIVEAUX : par TIR **et** par GRAPPE (actif|jour compte pour 1). Une
//   rafale de 15 tirs pese 15 fois au premier et 1 fois au second. Si les deux lectures divergent,
//   c'est que le resultat EST la rafale. (`tirs_comptent_autant_que_grappes`)
//
// 🎯 LES TROIS TERMES, orientes cote fade (SELL tel quel, BUY en miroir) :
//   Ⓐ `kOr H1 > K_HAUT` ET `%K` en BAISSE vs cloture precedente  — l'oscillateur plafonne et reflue
//   Ⓑ `zOr ≥ Z_LOIN` ET `dz_h1` oriente ≥ 0 (up OU flat)          — le prix ne revient pas
//   Ⓒ `ADX H1 live ≥ ADX_MIN` ET DI-contre/DI-pour ≥ DI_RATIO      — la tendance est installee
// ⚠ `dz_h1` = variation BARRE A BARRE (colonne EA). PAS `z_s0 − z_close`, qui est INTRA-BARRE et
//   rend le signe OPPOSE sur la barre de reference (−0,11 contre +0,01).
// ⚙ Usage : `node stats/_exh_faux_repli_tirs.mjs`  ·  `Z_LOIN=1.5 K_HAUT=70 ADX_MIN=25 DI_RATIO=2`
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
const K_HAUT = envNum("K_HAUT", 70), Z_LOIN = envNum("Z_LOIN", 1.5);
const ADX_MIN = envNum("ADX_MIN", 25), DI_RATIO = envNum("DI_RATIO", 2.0), NMIN = envNum("NMIN", 25);
const MAXOPEN = envNum("MAXOPEN", 100), MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL,
  cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const EXH = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && typeof t.R === "number");

const S = (x) => (x.side === "SELL" ? 1 : -1);
const zOr = (x) => (Number.isFinite(x.zscoreH1) ? S(x) * x.zscoreH1 : null);
const dzOr = (x) => (Number.isFinite(x.dzH1Col) ? S(x) * x.dzH1Col : null);
const kOr = (x) => (Number.isFinite(x.kH1) ? (x.side === "SELL" ? x.kH1 : 100 - x.kH1) : null);
const dkOr = (x) => (Number.isFinite(x.kH1) && Number.isFinite(x.kH1S1) ? S(x) * (x.kH1 - x.kH1S1) : null);
const diContre = (x) => (x.side === "SELL" ? x.plusDi : x.minusDi);
const diPour = (x) => (x.side === "SELL" ? x.minusDi : x.plusDi);

const pop = EXH.filter((x) => [zOr(x), dzOr(x), kOr(x), dkOr(x)].every(Number.isFinite));
const perdus = EXH.length - pop.length;
const A = (x) => kOr(x) > K_HAUT && dkOr(x) < 0;
const B = (x) => zOr(x) >= Z_LOIN && dzOr(x) >= 0;
const C = (x) => Number.isFinite(x.adxH1Live) && Number.isFinite(diContre(x)) && Number.isFinite(diPour(x))
  && x.adxH1Live >= ADX_MIN && diPour(x) > 0 && (diContre(x) / diPour(x)) >= DI_RATIO;

const BE = 75;
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => 100 * v.g / v.n;
const jour = (x) => `${x.asset ?? x.symbol}|${String(x.tsMT ?? "").slice(0, 10)}`;
// ⭐ WR/GRAPPE : chaque couple actif|jour pese 1, quel que soit son nombre de tirs. Un WR/grappe
//   NETTEMENT sous le WR/tir dit que le signal se trompe EN SERIE — l'inverse dit que les rafales
//   sont gagnantes. Les deux ensemble sont la seule lecture honnete d'une population a rafales.
const wrGrappe = (a) => {
  const g = new Map();
  for (const x of a) { const k = jour(x); const o = g.get(k) ?? { n: 0, w: 0 }; o.n++; if ((x.R ?? 0) > 0) o.w++; g.set(k, o); }
  const v = [...g.values()];
  return { g: v.length, wr: v.length ? 100 * v.reduce((s, o) => s + o.w / o.n, 0) / v.length : NaN };
};
const ref = wr(agg(pop));
const L = (lbl, a) => {
  if (!a.length) return `   ${lbl.padEnd(46)}    — (vide)`;
  const q = wrGrappe(a);
  return `   ${lbl.padEnd(46)}${String(a.length).padStart(5)}  ${wr(agg(a)).toFixed(2).padStart(6)} %  ${agg(a).R.toFixed(1).padStart(7)} R  ` +
    `${((wr(agg(a)) - ref >= 0 ? "+" : "") + (wr(agg(a)) - ref).toFixed(2)).padStart(7)} pt   ${String(q.g).padStart(3)} gr / ${q.wr.toFixed(2).padStart(6)} %`;
};

console.log(`\n══ « FAUX REPLI EN TENDANCE » — SUR LES TIRS (population filtree, COLLIDER assume) ══`);
console.log(`   Ⓐ kOr H1 > ${K_HAUT} ET %K en baisse   ·   Ⓑ zOr ≥ ${Z_LOIN} ET dz_h1 ≥ 0 (up/flat)   ·   Ⓒ ADX ≥ ${ADX_MIN} ET DI ≥ ${DI_RATIO}:1`);
console.log(`   tirs EXH ${EXH.length} · lisibles ${pop.length}` + (perdus ? `  ⚠ ${perdus} EXCLUS` : "") + `  ·  WR/tir moyen ${ref.toFixed(2)} %`);

// ⭐ LE CAS D'ECOLE, BARRE PAR BARRE — il doit passer ses propres filtres, on le VERIFIE.
const ecole = pop.filter((x) => (x.asset ?? x.symbol) === "US_TECH100" && String(x.tsMT ?? "").startsWith("2026.07.30"));
console.log(`\n   ── CAS D'ECOLE : US_TECH100 30/07 (${ecole.length} tirs) ──`);
console.log(`   ${"heure".padEnd(10)}${"cote".padStart(6)}${"zOr".padStart(7)}${"dz".padStart(7)}${"kOr".padStart(7)}${"dk".padStart(7)}${"ADX".padStart(7)}${"DI c/p".padStart(14)}${"R".padStart(7)}   Ⓐ Ⓑ Ⓒ`);
for (const x of ecole.slice(0, 20))
  console.log(`   ${String(x.tsMT).slice(11, 19).padEnd(10)}${x.side.padStart(6)}${zOr(x).toFixed(2).padStart(7)}${dzOr(x).toFixed(2).padStart(7)}` +
    `${kOr(x).toFixed(1).padStart(7)}${dkOr(x).toFixed(1).padStart(7)}${String(x.adxH1Live ?? "—").padStart(7)}` +
    `${`${diContre(x)}/${diPour(x)}`.padStart(14)}${(x.R ?? 0).toFixed(2).padStart(7)}   ${A(x) ? "✔" : "✘"} ${B(x) ? "✔" : "✘"} ${C(x) ? "✔" : "✘"}`);
const okEcole = ecole.filter((x) => A(x) && B(x) && C(x)).length;
console.log(`   ⇒ ${okEcole}/${ecole.length} tirs du cas d'ecole passent LES TROIS termes` +
  (okEcole === 0 ? `   ⛔⛔ LA FIGURE NE DECRIT PAS SA PROPRE BARRE DE REFERENCE — inutile de lire la suite comme un test de la these` : ""));

for (const [nom, p] of [["LES DEUX COTES", pop], ["SELL", pop.filter((x) => x.side === "SELL")], ["BUY", pop.filter((x) => x.side === "BUY")]]) {
  const r = wr(agg(p)), q = wrGrappe(p);
  console.log(`\n   ${"═".repeat(100)}`);
  console.log(`   ${nom}  —  ${p.length} tirs / ${r.toFixed(2)} %   ·   ${q.g} grappes / ${q.wr.toFixed(2)} %`);
  console.log(`   ${"case".padEnd(46)}${"tirs".padStart(5)}      WR        R    ecart      grappes`);
  console.log(L(`Ⓐ oscillateur plafonne et reflue`, p.filter(A)));
  console.log(L(`Ⓑ le prix ne revient pas`, p.filter(B)));
  console.log(L(`Ⓒ tendance installee (ADX/DI)`, p.filter(C)));
  console.log(L(`⭐ Ⓐ ET Ⓑ — la signature`, p.filter((x) => A(x) && B(x))));
  console.log(L(`   Ⓐ ET NON-Ⓑ`, p.filter((x) => A(x) && !B(x))));
  console.log(L(`   NON-Ⓐ ET Ⓑ`, p.filter((x) => !A(x) && B(x))));
  console.log(L(`   NON-Ⓐ ET NON-Ⓑ`, p.filter((x) => !A(x) && !B(x))));
  console.log(L(`⭐⭐ Ⓐ ET Ⓑ ET Ⓒ — la figure complete`, p.filter((x) => A(x) && B(x) && C(x))));
  console.log(L(`   son complement`, p.filter((x) => !(A(x) && B(x) && C(x)))));
  const n0 = p.filter((x) => !A(x) && !B(x)), a0 = p.filter((x) => A(x) && !B(x));
  const b0 = p.filter((x) => !A(x) && B(x)), ab = p.filter((x) => A(x) && B(x));
  if (n0.length && a0.length && b0.length && ab.length) {
    const pred = wr(agg(a0)) + wr(agg(b0)) - wr(agg(n0));
    console.log(`   ── INTERACTION Ⓐ×Ⓑ : additif ${pred.toFixed(2)} % · observe ${wr(agg(ab)).toFixed(2)} % ⇒ ${(wr(agg(ab)) - pred >= 0 ? "+" : "") + (wr(agg(ab)) - pred).toFixed(2)} pt` +
      `${ab.length < NMIN ? `   ⚠⚠ ${ab.length} TIRS — SOUS LE SEUIL (${NMIN}), AUCUN VERDICT` : Math.abs(wr(agg(ab)) - pred) < 3 ? "   ⇒ ADDITIF" : "   ⇒ CROISEMENT"}`);
  }
  const fig = p.filter((x) => A(x) && B(x) && C(x));
  if (fig.length) {
    const pe = new Map();
    for (const x of fig) if ((x.R ?? 0) <= 0) pe.set(jour(x), (pe.get(jour(x)) ?? 0) + 1);
    const pire = [...pe.entries()].sort((a, b) => b[1] - a[1])[0];
    if (pire) {
      const reste = fig.filter((x) => jour(x) !== pire[0]);
      console.log(`   ── CRIBLE : pire grappe ${pire[0]} (${pire[1]} pertes / ${fig.filter((x) => jour(x) === pire[0]).length} tirs)`);
      console.log(L(`      la figure SANS elle`, reste));
      if (reste.length) console.log(`      ⇒ ${wr(agg(reste)) >= r ? "⛔ s'inverse (passe au-dessus de la moyenne du cote)" : "✅ reste sous la moyenne du cote"}`);
    } else console.log(`   ── CRIBLE : aucune perte dans la figure`);
  }
}
console.log(`\n   ⚠ point mort 75,0 % · capacite ${MAXOPEN}/${MAXPERSYMBOL} ⇒ aucune substitution.\n`);
