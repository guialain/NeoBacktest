// _exh_z_balayage.mjs — BALAYAGE DE `z H1` AU PAS DE 0,1, EN **MARGINAL**.
// ============================================================================================
// 🎯 LA QUESTION : `2,15` est un chiffre de l'owner, pas une mesure. Est-ce une FRONTIERE (marche
//   d'escalier) ou un GRADIENT continu ? La reponse decide de la NATURE du geste :
//     · une marche  ⇒ un SEUIL (ou un veto)
//     · un gradient ⇒ une TABLE dictee, et un seuil y couperait au milieu d'une pente
//
// ⚠⚠ MARGINAL, PAS CUMULATIF — un cumulatif ne prouve JAMAIS une borne : il traine derriere lui
//   tout ce qui precede, donc il descend doucement quoi qu'il arrive. ⭐ ET LE PAS PORTE LE MEME
//   DEFAUT : au pas de 5, la « frontiere a 20 » du rang ① moyennait `]17·18]` a 70,7 % avec
//   `]18·19]` a 88,6 %. On balaie donc au pas de 0,1 et on lit les BANDES.
// ⚠ `zOr` est SIGNE et oriente cote fade (`SELL ? +z : −z`) — mesure du 20/08 : `zOr < 0` est VIDE
//   sur le rang ①, donc la question est bien « combien d'etirement », pas « de quel cote ».
// ⚠⚠ LE WR SATURE PRES DE 100 % : au-dessus de ~2,5 les bandes rendent 100 % et l'oeil croit voir
//   un plateau alors qu'il voit un PLAFOND. On imprime donc AUSSI le R/tir, qui, lui, ne sature pas.
// ⭐ LE BALAYAGE DE SEUIL EST DONNE EN SECOND ET ETIQUETE : il sert a CHOISIR une coupe une fois
//   qu'on sait qu'il y en a une, jamais a PROUVER qu'il y en a une.
// ⚙ Usage : `node stats/_exh_z_balayage.mjs`  ·  `PAS=0.1 NMIN=10 ZLIVE=1`
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
const PAS = envNum("PAS", 0.1), NMIN = envNum("NMIN", 10), SPAS = envNum("SPAS", 1);
const ZLIVE = envNum("ZLIVE", 0) === 1;
const MAXOPEN = envNum("MAXOPEN", 100), MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL,
  cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const EXH = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && typeof t.R === "number");

const S = (t) => (t.side === "SELL" ? 1 : -1);
const zOr = (t) => { const v = ZLIVE ? t.zscoreH1S0 : t.zscoreH1; return Number.isFinite(v) ? S(t) * v : null; };
const score = (t) => (Number.isFinite(t.sc?.exh) ? Math.abs(t.sc.exh) : null);
const lisible = EXH.filter((t) => Number.isFinite(zOr(t)) && Number.isFinite(score(t)));
const bandeS = (t) => Math.floor(score(t) / SPAS) * SPAS;

const BE = 75;
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => 100 * v.g / v.n;
const rt = (v) => v.R / v.n;
const zs = lisible.map(zOr);
const ZMIN = Math.min(...zs), ZMAX = Math.max(...zs);

console.log(`\n══ RANG ① — BALAYAGE MARGINAL DE \`z H1\` (${ZLIVE ? "LIVE" : "CLOTURE"}), pas de ${PAS} ══`);
console.log(`   MIN_EXH ${MIN_EXH} · capacite ${MAXOPEN}/${MAXPERSYMBOL} · NO_TRIGGER=1`);
console.log(`   tirs ${lisible.length} · zOr de ${ZMIN.toFixed(2)} a ${ZMAX.toFixed(2)}  (zOr = SELL ? +z : −z)`);
console.log(`   ⚠ le WR SATURE a 100 % — lire le R/tir a cote, il ne sature pas.\n`);

const cle = (v) => Math.floor(v / PAS) * PAS;
const bandes = [...new Set(lisible.map((t) => cle(zOr(t))))].sort((a, b) => a - b);
console.log(`   ${"bande zOr".padEnd(16)}${"tirs".padStart(6)}${"WR".padStart(9)}${"R/tir".padStart(9)}${"σ/BE".padStart(7)}   ${"BUY n/WR".padStart(16)}${"SELL n/WR".padStart(17)}`);
for (const b of bandes) {
  const p = lisible.filter((t) => cle(zOr(t)) === b);
  const v = agg(p);
  const c = (s) => { const q = p.filter((t) => t.side === s); return q.length ? `${String(q.length).padStart(4)}/${wr(agg(q)).toFixed(1).padStart(6)}%` : "     —     "; };
  const sig = (wr(v) - BE) / (Math.sqrt(0.75 * 0.25 / v.n) * 100);
  console.log(`   [${b.toFixed(1)} · ${(b + PAS).toFixed(1)}[`.padEnd(19) +
    `${String(v.n).padStart(5)}${wr(v).toFixed(2).padStart(8)} %${rt(v).toFixed(4).padStart(9)}${sig.toFixed(1).padStart(7)}   ${c("BUY").padStart(16)}${c("SELL").padStart(17)}` +
    (v.n < NMIN ? "  ⚠ sous le seuil de lecture" : ""));
}

// ⭐⭐⭐ LA FORME, RESUMEE — parce qu'une colonne de 40 lignes ne se lit pas. On regroupe en paliers
//   de 0,5 : assez large pour etre lisible, assez fin pour qu'une marche reste visible.
console.log(`\n   ── LA FORME, EN PALIERS DE 0,5 (pour voir la pente) ──`);
console.log(`   ${"palier".padEnd(16)}${"tirs".padStart(6)}${"WR".padStart(9)}${"R/tir".padStart(9)}   ${"BUY".padStart(14)}${"SELL".padStart(15)}`);
for (let b = Math.floor(ZMIN * 2) / 2; b < ZMAX; b += 0.5) {
  const p = lisible.filter((t) => zOr(t) >= b && zOr(t) < b + 0.5);
  if (!p.length) continue;
  const v = agg(p);
  const c = (s) => { const q = p.filter((t) => t.side === s); return q.length ? `${String(q.length).padStart(4)}/${wr(agg(q)).toFixed(1).padStart(5)}%` : "     —     "; };
  console.log(`   [${b.toFixed(1)} · ${(b + 0.5).toFixed(1)}[`.padEnd(19) +
    `${String(v.n).padStart(5)}${wr(v).toFixed(2).padStart(8)} %${rt(v).toFixed(4).padStart(9)}   ${c("BUY").padStart(14)}${c("SELL").padStart(15)}`);
}

// ⭐ LE BALAYAGE DE SEUIL — **EN SECOND ET ETIQUETE**. Il ne prouve aucune borne ; il dit, une fois
//   qu'on sait qu'une coupe existe, laquelle SEPARE le plus a SCORE EGAL.
function strat(pop, f) {
  let num = 0, den = 0, n = 0;
  for (const b of new Set(pop.map(bandeS))) {
    const p = pop.filter((t) => bandeS(t) === b);
    const a = p.filter(f), c = p.filter((t) => !f(t));
    if (!a.length || !c.length) continue;
    const w = (a.length * c.length) / (a.length + c.length);
    num += w * (wr(agg(a)) - wr(agg(c))); den += w; n += p.length;
  }
  return den ? { d: num / den, n } : null;
}
console.log(`\n   ── BALAYAGE DE SEUIL (⚠ CUMULATIF — ne prouve AUCUNE borne, sert a CHOISIR une coupe) ──`);
console.log(`   ${"seuil".padEnd(9)}${"n < s".padStart(7)}${"WR <".padStart(9)}${"n ≥ s".padStart(7)}${"WR ≥".padStart(9)}${"ecart brut".padStart(12)}${"ecart A SCORE EGAL".padStart(21)}`);
for (let s = 1.0; s <= 3.6; s += 0.1) {
  const a = lisible.filter((t) => zOr(t) < s), b = lisible.filter((t) => zOr(t) >= s);
  if (a.length < 20 || b.length < 20) continue;
  const st = strat(lisible, (t) => zOr(t) < s);
  console.log(`   ${s.toFixed(1).padEnd(9)}${String(a.length).padStart(7)}${wr(agg(a)).toFixed(2).padStart(8)} %${String(b.length).padStart(7)}${wr(agg(b)).toFixed(2).padStart(8)} %` +
    `${(wr(agg(a)) - wr(agg(b))).toFixed(2).padStart(11)} pt${(st ? ((st.d >= 0 ? "+" : "") + st.d.toFixed(2) + " pt") : "—").padStart(18)}`);
}
console.log(`\n   ⚠ point mort 75,0 % · capacite 100/100 ⇒ aucune substitution.\n`);
