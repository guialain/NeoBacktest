// _exh_h4_poussee_non_extreme.mjs — « LE H4 POUSSE ENCORE ET N'EST PAS AU BOUT » (owner, 20/08).
// ============================================================================================
// 🎯 LA FIGURE, cote SELL (on fade une hausse) :
//      ① `kdH4` DIVERGE      — K est au-dessus de D **et l'ecart s'ELARGIT** (K s'echappe)
//      ② `kH4 < 80`          — le stoch H4 n'est PAS encore a l'extreme : il reste de la place
//      ③ `dRSI H1` flat/up   — l'elan H1 n'a pas casse
//      ④ `dRSI H4` up        — l'elan H4 pousse
//   ⇒ On vend un epuisement pendant que l'horloge SUPERIEURE est en pleine poussee ET pas au bout.
//
// ⚠⚠ « DIVERGING » EST UNE VARIATION, PAS UN NIVEAU. `kdGapH4 > 0` dit seulement que K est au-dessus
//   de D ; il faut COMPARER a la cloture precedente (`kH4S1 − dH4S1`) pour savoir si l'ecart
//   s'ELARGIT ou se RESSERRE. Confondre les deux ferait passer un ecart qui se REFERME — c'est-a-dire
//   l'inverse exact de la figure — pour un ecart qui diverge.
//
// ⚠⚠ MIROIR : l'owner demande le SELL. On le rend, ET on rend le BUY miroir en CONTROLE — « pas de
//   regle par cote, une fenetre = une saison », et un cote jamais mesure est ou le degat arrive.
//      SELL : gap > 0 · gap > gapPrec · kH4 < 80 · dRSI H1 ≥ 0 · dRSI H4 > 0
//      BUY  : gap < 0 · gap < gapPrec · kH4 > 20 · dRSI H1 ≤ 0 · dRSI H4 < 0
//
// ⭐ EMPILEMENT, pas une seule case : chaque condition est ajoutee une a une. Une case finale seule
//   ne dit pas QUI trie — et une conjonction de 4 termes finit toujours par isoler un episode.
// ⚙ Usage : `node stats/_exh_h4_poussee_non_extreme.mjs`  ·  `K_EXT=80` pour bouger la borne ②
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { MIN_EXH } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

const envNum = (k, def) => {
  const raw = process.env[k];
  if (raw === undefined || raw === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
};
const K_EXT = envNum("K_EXT", 80);
const MAXOPEN = envNum("MAXOPEN", 100), MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL,
  cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const EXH = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && typeof t.R === "number");

const S = (t) => (t.side === "SELL" ? 1 : -1);              // repere « cote fade »
const gapNow = (t) => (Number.isFinite(t.kdGapH4) ? S(t) * t.kdGapH4 : null);
const gapPrec = (t) => (Number.isFinite(t.kH4S1) && Number.isFinite(t.dH4S1) ? S(t) * (t.kH4S1 - t.dH4S1) : null);
const kOr = (t) => (Number.isFinite(t.kH4) ? (t.side === "SELL" ? t.kH4 : 100 - t.kH4) : null);
const dRsi1 = (t) => (Number.isFinite(t.dRsiH1) ? S(t) * t.dRsiH1 : null);
const dRsi4 = (t) => (Number.isFinite(t.drsiH4) ? S(t) * t.drsiH4 : null);

// ⚠⚠ ON COMPTE CE QU'ON JETTE : un capteur absent n'est PAS un « non ».
const lisible = EXH.filter((t) => [kOr(t), dRsi1(t), dRsi4(t), gapNow(t)].every((x) => Number.isFinite(x))
  && typeof t.kdCycleH4 === "string");
const perdus = EXH.length - lisible.length;
// ⭐ LA DISTRIBUTION DE L'ETAT DU MOTEUR — sans elle on ne sait pas si « DIVERGING » est rare ou
//   majoritaire, et une case de 5 % ne se lit pas comme une case de 50 %.
const distri = new Map();
for (const t of lisible) distri.set(t.kdCycleH4, (distri.get(t.kdCycleH4) ?? 0) + 1);

// 🔴🔥⭐⭐⭐ ON LIT `kdCycleH4` DU MOTEUR, ON NE LA RE-DERIVE PAS (owner, 20/08).
//   Le 1er jet ecrivait `gap > 0 && gap > gapPrec` — TROIS ecarts avec `kdCycleState` :
//     ① AUCUNE BANDE MORTE : un elargissement de +0,1 comptait comme DIVERGING ; le moteur exige
//        `Δ|K−D| > 2,1` (`KD_CYCLE_DEADBAND`, le meme nombre que `STOCHDYN_CONTACT`).
//     ② `kdCycleState` est **NON SIGNEE** — elle lit `|kd|`. Imposer `gap > 0` mesurait autre chose.
//     ③ CROSS et CONTACT n'existaient pas dans ma version : un flip de signe, ou `|kd| ≤ 2,1`,
//        tombait chez moi dans « diverge » alors que le moteur les nomme autrement.
//   ⇒ motif `derived_dataset_computed_3x` : deux sondes ecrites separement ne comptent JAMAIS
//     tout a fait pareil. La reference est le moteur, point.
// ⚠ HORLOGE : `kdCycle = kdCycleState(kd0, kd1)` — kd0 LIVE (`_s0`) contre kd1 CLOTURE (`_s1`).
const C = [
  ["① kdCycleH4 = DIVERGING (du moteur, non signee)", (t) => t.kdCycleH4 === "DIVERGING"],
  [`② kH4 < ${K_EXT} (pas encore a l'extreme)`,              (t) => kOr(t) < K_EXT],
  ["③ dRSI H1 flat/up (≥ 0)",                                (t) => dRsi1(t) >= 0],
  ["④ dRSI H4 up (> 0)",                                     (t) => dRsi4(t) > 0],
];
const BE = 75;
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => 100 * v.g / v.n;
const sg = (v) => (wr(v) - BE) / (Math.sqrt(0.75 * 0.25 / v.n) * 100);
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(52)}${String(a.length).padStart(5)}  ${wr(agg(a)).toFixed(2).padStart(6)} %  ${agg(a).R.toFixed(1).padStart(7)} R  ${(agg(a).R / a.length).toFixed(4).padStart(8)}  σ ${sg(agg(a)).toFixed(1).padStart(5)}`
  : `   ${lbl.padEnd(52)}    — (case vide)`;

console.log(`\n══ RANG ① — « LE H4 POUSSE ENCORE ET N'EST PAS AU BOUT » ══`);
console.log(`   MIN_EXH ${MIN_EXH} · capacite ${MAXOPEN}/${MAXPERSYMBOL} · NO_TRIGGER=1 · borne ② a ${K_EXT}`);
console.log(`   tirs EXH ${EXH.length} · lisibles ${lisible.length}` + (perdus ? `  ⚠ ${perdus} EXCLUS (capteur absent)` : ""));
console.log(`   ⭐ `+"`kdCycleH4` du moteur (bande morte 2,1, NON signee) : " +
  [...distri.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v} (${(100 * v / lisible.length).toFixed(1)} %)`).join(" · "));
// ⭐⭐ LE SENS, SEPAREMENT : `DIVERGING` ne dit pas DANS QUEL SENS les lignes s'ecartent. On mesure
//   donc aussi « DIVERGING **contre le fade** » (K s'echappe du cote qu'on vend) — c'est la barre
//   de l'owner (US_TECH100 : K−D H4 = +19,69 sur un SELL).
const divContre = (t) => t.kdCycleH4 === "DIVERGING" && gapNow(t) > 0;
const divPour = (t) => t.kdCycleH4 === "DIVERGING" && gapNow(t) <= 0;

for (const [nom, pop] of [["SELL — CE QUE TU DEMANDES", lisible.filter((t) => t.side === "SELL")],
                          ["BUY — LE MIROIR, EN CONTROLE", lisible.filter((t) => t.side === "BUY")],
                          ["LES DEUX COTES", lisible]]) {
  console.log(`\n   ${"═".repeat(96)}`);
  console.log(`   ${nom}   —   base ${pop.length} tirs / ${wr(agg(pop)).toFixed(2)} %`);
  console.log(`   ${"case".padEnd(52)}${"tirs".padStart(5)}      WR        R     R/tir      σ/BE`);
  console.log(`   ── CHAQUE CONDITION SEULE (marginal) ──`);
  for (const [lbl, f] of C) console.log(L(lbl, pop.filter(f)));
  console.log(L(`   ①a DIVERGING **contre le fade** (K s'echappe)`, pop.filter(divContre)));
  console.log(L(`   ①b DIVERGING **dans le sens du fade**`, pop.filter(divPour)));
  console.log(`   ── EMPILEMENT (qui fait le travail) ──`);
  let cur = pop;
  for (let i = 0; i < C.length; i++) {
    cur = cur.filter(C[i][1]);
    console.log(L(`  ①${i >= 1 ? "+②" : ""}${i >= 2 ? "+③" : ""}${i >= 3 ? "+④" : ""}`.padEnd(12) + C[i][0].slice(0, 38), cur));
  }
  console.log(L(`   ⭐ LA FIGURE COMPLETE`, cur));
  console.log(L(`      son complement (tout le reste du cote)`, pop.filter((t) => !C.every(([, f]) => f(t)))));

  // ⭐⭐⭐ LE CRIBLE : survit-elle au retrait de sa pire grappe ? Sept candidats du depot sont morts ici.
  const jour = (t) => `${t.asset ?? t.symbol}|${String(t.tsMT ?? "").slice(0, 10)}`;
  const pertes = new Map();
  for (const t of cur) if ((t.R ?? 0) <= 0) pertes.set(jour(t), (pertes.get(jour(t)) ?? 0) + 1);
  const pire = [...pertes.entries()].sort((a, b) => b[1] - a[1])[0];
  if (pire) {
    const reste = cur.filter((t) => jour(t) !== pire[0]);
    const ref = wr(agg(pop));
    console.log(`   ── CRIBLE DE LA PIRE GRAPPE ──   ${pire[0]} : ${pire[1]} pertes / ${cur.filter((t) => jour(t) === pire[0]).length} tirs de la case`);
    console.log(L(`      SANS elle`, reste));
    if (reste.length) console.log(`      ⇒ ${(wr(agg(reste)) - wr(agg(cur))).toFixed(2)} pt · moyenne du cote ${ref.toFixed(2)} %  ⇒  ${wr(agg(reste)) >= ref ? "⛔ S'INVERSE — ce n'etait pas une regle" : "✅ reste sous la moyenne"}`);
    const g = new Set(cur.map(jour));
    console.log(`      grappes distinctes dans la case : ${g.size} pour ${cur.length} tirs  ⇒  ${(cur.length / g.size).toFixed(2)} tirs/grappe`);
    if (g.size <= 3) console.log(`      ⚠⚠ ${g.size} GRAPPE(S) — une conjonction de 4 termes a isole un EPISODE, pas une population.`);
    console.log(`      les grappes : ${[...new Set(cur.map(jour))].slice(0, 12).join(" · ")}${g.size > 12 ? " …" : ""}`);
  } else if (cur.length) console.log(`   ── CRIBLE : aucune perte dans la case (${cur.length} tirs) — rien a retirer.`);
}
console.log(`\n   ⚠ point mort 75,0 %.\n`);
