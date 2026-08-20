// _exh_z_x_div_x_score.mjs — `z H1` × `kdCycleH4 = DIVERGING`, LE TOUT A SCORE EGAL.
// ============================================================================================
// 🎯 CE QU'ON SAIT DEJA (20/08) : `zOr H1 < 2,15` (seuil SIGNE, oriente cote fade) vaut 85,98 %
//   contre 96,58 %, l'ecart SURVIT a la stratification par bande de score (−11,35 pt a score egal,
//   107 % de l'ecart brut conserve) et il va dans le MEME sens des deux cotes (SELL −13,36 · BUY
//   −7,37). ⭐ `zOr < 0` est VIDE : le rang ① ne tire jamais a contresens du z, donc la coupe
//   separe « etire mais PAS ASSEZ » de « etire », et rien d'autre.
//
// 🎯 LA QUESTION ICI : `kdCycleH4 = DIVERGING` AJOUTE-T-IL QUELQUE CHOSE, ou est-il redondant ?
//   Mesure du 20/08 : DIVERGING SEUL est LEGEREMENT POSITIF (SELL +1,23 · BUY +0,96). Un terme
//   inerte en marginal peut malgre tout AMPLIFIER un autre — c'est toute la difference entre une
//   somme et un produit. On lit donc l'INTERACTION, pas la case.
//
// ⭐⭐⭐ TROIS LECTURES, ET LA 3e EST LA SEULE QUI TRANCHE :
//     ① le 2×2 brut — descriptif
//     ② l'effet de `z` DANS chaque moitie de DIVERGING (si l'ecart de z est plus fort chez les
//        DIVERGING, le terme AMPLIFIE ; s'il est identique, il est REDONDANT)
//     ③ le tout STRATIFIE par bande de score — parce que la question « est-ce deja le score ? »
//        se repose a chaque nouvel axe.
// ⚠ SAISON HAUSSIERE : on lit le BUY en « SOUS les autres BUY ? », jamais en « d'accord avec le SELL ? ».
// ⚠ CAPACITE 100/100 ⇒ AUCUNE substitution. Rien ici ne dit ce qu'une regle RAPPORTERAIT.
// ⚙ Usage : `node stats/_exh_z_x_div_x_score.mjs`  ·  `Z_SEUIL=2.15 PAS=1 DEPUIS=16`
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
const Z_SEUIL = envNum("Z_SEUIL", 2.15), PAS = envNum("PAS", 1), DEPUIS = envNum("DEPUIS", 16);
const MAXOPEN = envNum("MAXOPEN", 100), MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL,
  cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const EXH = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && typeof t.R === "number");

const S = (t) => (t.side === "SELL" ? 1 : -1);
const zOr = (t) => (Number.isFinite(t.zscoreH1) ? S(t) * t.zscoreH1 : null);
const score = (t) => (Number.isFinite(t.sc?.exh) ? Math.abs(t.sc.exh) : null);
const lisible = EXH.filter((t) => Number.isFinite(zOr(t)) && Number.isFinite(score(t)) && typeof t.kdCycleH4 === "string");
const perdus = EXH.length - lisible.length;
const mou = (t) => zOr(t) < Z_SEUIL;                     // « etire mais pas assez »
const div = (t) => t.kdCycleH4 === "DIVERGING";
const bande = (t) => Math.floor(score(t) / PAS) * PAS;

const BE = 75;
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => 100 * v.g / v.n;
const sg = (v) => (wr(v) - BE) / (Math.sqrt(0.75 * 0.25 / v.n) * 100);

// ⭐ L'ECART STRATIFIE : effet de `f` a SCORE EGAL, poids Mantel-Haenszel, bandes ou les DEUX
//   cases existent seulement. Rend aussi l'effectif utile, parce qu'un ecart sur 40 tirs et un
//   ecart sur 900 ne se lisent pas pareil.
function strat(pop, f) {
  let num = 0, den = 0, n = 0, nb = 0;
  for (const b of new Set(pop.map(bande))) {
    const p = pop.filter((t) => bande(t) === b);
    const a = p.filter(f), c = p.filter((t) => !f(t));
    if (!a.length || !c.length) continue;
    const w = (a.length * c.length) / (a.length + c.length);
    num += w * (wr(agg(a)) - wr(agg(c))); den += w; n += p.length; nb++;
  }
  return den ? { d: num / den, n, nb } : null;
}
const fmt = (s) => (s ? `${(s.d >= 0 ? "+" : "") + s.d.toFixed(2)} pt  (${s.n} tirs, ${s.nb} bandes)` : "— (pas de bande a deux cases)");
const cel = (a) => (a.length ? `${String(a.length).padStart(4)} / ${wr(agg(a)).toFixed(2).padStart(6)} % / ${agg(a).R.toFixed(1).padStart(6)} R` : "   —                  ");

console.log(`\n══ RANG ① — \`z H1\` × \`kdCycleH4 = DIVERGING\`, A SCORE EGAL ══`);
console.log(`   MIN_EXH ${MIN_EXH} · capacite ${MAXOPEN}/${MAXPERSYMBOL} · NO_TRIGGER=1 · seuil SIGNE zOr = ${Z_SEUIL}`);
console.log(`   tirs EXH ${EXH.length} · lisibles ${lisible.length}` + (perdus ? `  ⚠ ${perdus} EXCLUS` : ""));

for (const [nom, pop] of [["LES DEUX COTES", lisible],
                          ["SELL", lisible.filter((t) => t.side === "SELL")],
                          ["BUY  (⚠ saison haussiere — lire « sous les autres BUY ? »)", lisible.filter((t) => t.side === "BUY")]]) {
  console.log(`\n   ${"═".repeat(96)}`);
  console.log(`   ${nom}  —  ${pop.length} tirs / ${wr(agg(pop)).toFixed(2)} %`);
  console.log(`\n   ── ① LE 2×2 BRUT ──`);
  console.log(`   ${"".padEnd(26)}${"DIVERGING".padStart(24)}${"non-DIVERGING".padStart(24)}${"ecart z→".padStart(12)}`);
  const cases = {};
  for (const [lz, fz] of [[`z « pas assez » (< ${Z_SEUIL})`, mou], [`z « etire »     (≥ ${Z_SEUIL})`, (t) => !mou(t)]]) {
    const a = pop.filter((t) => fz(t) && div(t)), b = pop.filter((t) => fz(t) && !div(t));
    cases[lz] = { a, b };
    console.log(`   ${lz.padEnd(26)}${cel(a).padStart(24)}${cel(b).padStart(24)}` +
      `${(a.length && b.length ? ((wr(agg(a)) - wr(agg(b)) >= 0 ? "+" : "") + (wr(agg(a)) - wr(agg(b))).toFixed(2)) : "—").padStart(12)}`);
  }
  // ⭐⭐⭐ ② L'INTERACTION : l'effet de `z` est-il PLUS FORT chez les DIVERGING ? Si les deux
  //   colonnes rendent le meme ecart, `DIVERGING` est REDONDANT — il retrecit la population sans
  //   rien apprendre. Si elles different, il AMPLIFIE, et c'est un produit, pas une somme.
  console.log(`\n   ── ② L'EFFET DE \`z\` DANS CHAQUE MOITIE DE DIVERGING (brut) ──`);
  for (const [lbl, sub] of [["chez les DIVERGING", pop.filter(div)], ["chez les non-DIVERGING", pop.filter((t) => !div(t))]]) {
    const a = sub.filter(mou), b = sub.filter((t) => !mou(t));
    console.log(`      ${lbl.padEnd(26)} pas assez ${cel(a)}   ·   etire ${cel(b)}` +
      `   ⇒ ${(a.length && b.length ? ((wr(agg(a)) - wr(agg(b))).toFixed(2)) : "—")} pt`);
  }
  console.log(`\n   ── ③ A SCORE EGAL (stratifie par bande de ${PAS}) ──`);
  console.log(`      effet de \`z pas assez\`  · toute la population   ${fmt(strat(pop, mou))}`);
  console.log(`      effet de \`z pas assez\`  · chez les DIVERGING    ${fmt(strat(pop.filter(div), mou))}`);
  console.log(`      effet de \`z pas assez\`  · chez les non-DIVERG.  ${fmt(strat(pop.filter((t) => !div(t)), mou))}`);
  console.log(`      effet de \`DIVERGING\`    · chez z « pas assez »  ${fmt(strat(pop.filter(mou), div))}`);
  console.log(`      effet de \`DIVERGING\`    · chez z « etire »      ${fmt(strat(pop.filter((t) => !mou(t)), div))}`);

  // ⭐ LE CRIBLE sur la case la PLUS MAUVAISE — sept candidats du depot sont morts sur UNE journee.
  const pire = cases[`z « pas assez » (< ${Z_SEUIL})`];
  for (const [lbl, a] of [["z pas assez × DIVERGING", pire.a], ["z pas assez × non-DIVERGING", pire.b]]) {
    if (!a.length) continue;
    const jour = (t) => `${t.asset ?? t.symbol}|${String(t.tsMT ?? "").slice(0, 10)}`;
    const pe = new Map();
    for (const t of a) if ((t.R ?? 0) <= 0) pe.set(jour(t), (pe.get(jour(t)) ?? 0) + 1);
    const p = [...pe.entries()].sort((x, y) => y[1] - x[1])[0];
    const g = new Set(a.map(jour));
    if (!p) { console.log(`      CRIBLE ${lbl} : aucune perte`); continue; }
    const reste = a.filter((t) => jour(t) !== p[0]);
    console.log(`      CRIBLE ${lbl.padEnd(30)} ${g.size} grappes · pire ${p[0]} (${p[1]} pertes)` +
      `  ⇒ SANS elle ${reste.length} / ${reste.length ? wr(agg(reste)).toFixed(2) : "—"} %` +
      `  ${reste.length && wr(agg(reste)) >= wr(agg(pop)) ? "⛔ s'inverse" : "✅ tient"}`);
  }
}
console.log(`\n   ⚠ point mort 75,0 % · capacite 100/100 ⇒ aucune substitution.\n`);
