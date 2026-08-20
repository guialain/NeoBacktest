// _exh_bandes_score.mjs — WR DU RANG ① PAR TRANCHE DE SCORE, AU PAS DE 1, ET PAR COTE.
// ============================================================================================
// ⚠⚠ ON LIT LE **MARGINAL**, PAS LE CUMULATIF. Un cumulatif ne prouve JAMAIS une borne : au pas de
//   5, la « frontiere a 20 » du 19/08 moyennait `]17.18]` a 70,7 % avec `]18.19]` a 88,6 %. Le pas
//   du balayage porte le meme defaut que le cumul ⇒ **un seuil se tranche AU PAS DE 1**.
// ⚠⚠ POUR VOIR UNE BANDE SOUS LE SEUIL COURANT, IL FAUT BAISSER LE SEUIL — une barre a 15,4 ne
//   TIRE PAS quand `MIN_EXH = 16`, donc elle n'a ni R ni outcome. `MIN_EXH=15` est donc OBLIGATOIRE
//   pour lire `[15.16[`, et ce n'est PAS le meme run que la prod : les tirs sont CONCURRENTS.
// ⚠ ON LIT `sc.exh` = `sExhB` (score BONIFIE), la quantite que le seuil compare — pas `exhRaw`.
//   Le score du rang ① est SIGNE (le cote vient du signe) ⇒ on range sur `Math.abs`.
// ⚙ Usage : `MIN_EXH=15 MAXOPEN=100 MAXPERSYMBOL=100 node stats/_exh_bandes_score.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { MIN_EXH } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

// ⚠ `Number("")` vaut 0 et il est FINI : une variable POSEE MAIS VIDE servirait un bras extreme en
//   silence. On n'accepte la surcharge que si elle est posee ET finie. (3e rechute du motif)
const envNum = (k, def) => {
  const raw = process.env[k];
  if (raw === undefined || raw === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
};
const MAXOPEN = envNum("MAXOPEN", 100);
const MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);
const PAS = envNum("PAS", 1);
const DEPUIS = envNum("DEPUIS", 15);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, {
  maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL, cadenceMin: 2,
  chargeSpread: true, initialEquity: 10000, riskPct: 1.0,
});
const sig = RUN.signals ?? [];
const SUM = RUN.summary ?? {};

const EXH = sig.filter((t) => t.strategy === "EXH" && typeof t.R === "number");
const lisible = EXH.filter((t) => Number.isFinite(t.sc?.exh));

const bande = (s) => Math.floor(Math.abs(s) / PAS) * PAS;
const cel = new Map();
const add = (k, t) => {
  const v = cel.get(k) ?? { n: 0, g: 0, R: 0 };
  v.n++; v.R += t.R ?? 0; if ((t.R ?? 0) > 0) v.g++;
  cel.set(k, v);
};
for (const t of lisible) {
  const b = bande(t.sc.exh);
  add(`${b}|TOUS`, t); add(`${b}|${t.side}`, t);
}

const BE = 75;
const pct = (v) => (100 * v.g / v.n);
// ⭐ MARGE EN ECARTS-TYPES SOUS H0 = point mort 75 % : dit si la bande PORTE quelque chose ou si
//   son effectif la rend illisible. Un σ faible ne disqualifie pas — il interdit de conclure.
const sigma = (v) => (pct(v) - BE) / (Math.sqrt(0.75 * 0.25 / v.n) * 100);

console.log(`\n══ RANG ① — WR PAR TRANCHE DE SCORE (marginal, pas de ${PAS}) ══`);
console.log(`   MIN_EXH ${MIN_EXH}  ·  capacite maxOpen ${MAXOPEN} / maxPerSymbol ${MAXPERSYMBOL}  ·  NO_TRIGGER=1`);
console.log(`   tirs EXH ${EXH.length}  ·  score lisible ${lisible.length}` +
  (lisible.length !== EXH.length ? `  ⚠ ${EXH.length - lisible.length} SANS score` : ""));
console.log(`\n   bande        tirs      WR        R    R/tir     σ/BE   |   BUY  n / WR      |  SELL  n / WR`);
const bandes = [...new Set([...cel.keys()].map((k) => Number(k.split("|")[0])))]
  .filter((b) => b >= DEPUIS).sort((a, b) => a - b);
for (const b of bandes) {
  const v = cel.get(`${b}|TOUS`); if (!v) continue;
  const bu = cel.get(`${b}|BUY`), se = cel.get(`${b}|SELL`);
  const cote = (x) => x ? `${String(x.n).padStart(4)} / ${pct(x).toFixed(2).padStart(6)} %` : `   —          `;
  const lbl = `[${b} · ${b + PAS}[`;
  console.log(`   ${lbl.padEnd(11)} ${String(v.n).padStart(5)}  ${pct(v).toFixed(2).padStart(6)} % ${v.R.toFixed(1).padStart(7)}  ${(v.R / v.n).toFixed(4).padStart(7)}  ${sigma(v).toFixed(1).padStart(6)}   |  ${cote(bu)}  |  ${cote(se)}`);
}
// ⭐ LE CUMULATIF EN DERNIER, ET ETIQUETE COMME TEL — il sert a lire ce qu'un seuil RAMENERAIT,
//   jamais a justifier une borne. La borne se lit sur les lignes marginales ci-dessus.
console.log(`\n   ── cumulatif « score ≥ X » (NE PROUVE AUCUNE BORNE — lecture de volume seulement) ──`);
for (const b of bandes) {
  const t = lisible.filter((x) => Math.abs(x.sc.exh) >= b);
  if (!t.length) continue;
  const g = t.filter((x) => (x.R ?? 0) > 0).length, R = t.reduce((a, x) => a + (x.R ?? 0), 0);
  console.log(`   ≥ ${String(b).padStart(3)}   ${String(t.length).padStart(5)} tirs  ${(100 * g / t.length).toFixed(2).padStart(6)} %  ${R.toFixed(1).padStart(7)} R`);
}
console.log(`\n   FUNNEL  evals ${SUM.evals} -> fires ${SUM.fires} -> opened ${SUM.opened}  ·  refuses CAPACITE ${SUM.rejectedCap} / SPACING ${SUM.rejSpacingTotal}`);
console.log(`   ⚠ point mort 75,0 % (spread facture).\n`);
