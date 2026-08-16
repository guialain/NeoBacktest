// _cont_wr_bandes_ab.mjs — WR CONT PAR BANDE DE SCORE, **EN % DE L'ECHELLE**, pour un A/B.
//
// 🔴🔥⭐⭐⭐ POURQUOI EN POURCENTAGE ET PAS EN POINTS. Les deux bras compares n'ont PAS la meme
//   echelle — `[0 · +50]` a 5 familles, `[0 · +60]` a 6. Une bande `[20 · 24[` ne designe donc pas
//   la meme population des deux cotes : c'est 40-48 % du barema dans un bras et 33-40 % dans
//   l'autre. Comparer les bandes en POINTS ferait lire un deplacement de courbe la ou il n'y a
//   qu'un changement d'unite. ⇒ **l'axe est `conviction / CONT_ECHELLE.max`**, et l'echelle est LUE
//   sur le barema, jamais recopiee (elle a deja peri 3 fois dans ce depot).
//
// ⚠⚠ MARGINAL, PAS CUMULATIF. « un CUMULATIF ne prouve JAMAIS une borne, il la maquille » — les
//   lignes emboitees font monter mecaniquement le WR. Ce qu'on veut voir ici est la FORME : est-ce
//   que le score ORDONNE. Seul le marginal la montre.
// ⚠ LES DEUX COMPTAGES SONT IMPRIMES (tir ET grappe) : le TIR decide de l'ampleur, la GRAPPE de la
//   confiance, et leur ecart mesure la concentration.
// ⚠ PAR COTE, TOUJOURS — un total qui s'ameliore peut cacher un cote qui s'effondre.
// ⚠⚠ `MIN_CONT` EST ECRASE TRES BAS pour voir toute la courbe : conditionner sur le seuil de prod
//   ne montrerait que la moitie haute — le COLLIDER. ⇒ la population ci-dessous n'est PAS celle de
//   prod, et les bandes basses sont des SURVIVANTES du spacing, pas une cohorte tiree au sort.
// 🔴 CE QUE CETTE TABLE NE DIT PAS : ce que chaque bande RAPPORTERAIT si on la prenait seule. Elle
//   decoupe UN carnet deja produit ; les creneaux ne se reallouent qu'au RE-RUN.
//   usage : MAXOPEN=100 MAXPERSYMBOL=100 MIN_CONT=0 node stats/_cont_wr_bandes_ab.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "0";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { CONT_ECHELLE } = await import(`${M}/contScoringV1.js`);
const { BONUS_APPLIQUE, MIN_CONT } = await import(`${M}/scoringDecision.js`);

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const envNum = (k, d) => { const r = process.env[k]; if (r === undefined || r === "") return d;
                           const v = Number(r); return Number.isFinite(v) ? v : d; };
const OPTS = { maxOpen: envNum("MAXOPEN", 100), cadenceMin: 2, chargeSpread: true };
const mps = envNum("MAXPERSYMBOL", undefined); if (mps !== undefined) OPTS.maxPerSymbol = mps;
const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, OPTS);

const conv = (s) => s.sc?.boxes?.cont?.conviction;
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const CONT = (RUN.signals ?? []).filter((s) => s.strategy === "CONT" && fini(s) && Number.isFinite(conv(s)));

const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = (x.asset ?? x.symbol) + "|" + jour(x);
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  const w = t.filter((x) => x.outcome === "WIN").length;
  return { n: t.length, gr: v.length, wr: 100 * w / t.length,
           wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const cell = (s) => s ? String(s.n).padStart(6) + String(s.gr).padStart(5) + s.wr.toFixed(1).padStart(8) + "%"
                        + s.wrg.toFixed(1).padStart(7) + "%" + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8)
                      : "     —    —       —       —       —";

const MAX = CONT_ECHELLE.max;
console.log(`\n═══ CONT · WR PAR BANDE DE SCORE (% DE L'ECHELLE) ═══  ${process.env.LABEL ?? ""}`);
console.log(`  barema [${CONT_ECHELLE.min} · ${MAX}] · ${CONT_ECHELLE.familles.length} familles : ${CONT_ECHELLE.familles.join(" + ")}`);
console.log(`  MIN_CONT du run = ${MIN_CONT} (${(100 * MIN_CONT / MAX).toFixed(1)} % de l'echelle) · bonus ${BONUS_APPLIQUE ? "APPLIQUES" : "DEBRANCHES"}`);
console.log(`  capacite maxOpen ${OPTS.maxOpen} · maxPerSymbol ${OPTS.maxPerSymbol ?? "(live)"} · ${CONT.length} tirs CONT · point mort 75,0 %`);
const vals = CONT.map(conv);
console.log(`  conviction observee : ${Math.min(...vals).toFixed(1)} … ${Math.max(...vals).toFixed(1)}  ⇒  ${(100 * Math.min(...vals) / MAX).toFixed(1)} … ${(100 * Math.max(...vals) / MAX).toFixed(1)} % de l'echelle\n`);

const BUY = CONT.filter((s) => s.side === "BUY"), SELL = CONT.filter((s) => s.side === "SELL");
const HEAD = () => {
  console.log("  " + " ".repeat(18) + "            B U Y            │            S E L L          │ ecart");
  console.log("  " + "bande".padEnd(18) + "  tirs grap  WR/tir WR/grap       R │  tirs grap  WR/tir WR/grap       R │ /grap");
  console.log("  " + "─".repeat(18) + "─".repeat(30) + "┼" + "─".repeat(30) + "┼" + "─".repeat(7));
};
const ligne = (lbl, f) => {
  const b = st(BUY.filter(f)), s = st(SELL.filter(f));
  const ec = (b && s && b.gr >= 20 && s.gr >= 20)
    ? ((b.wrg - s.wrg >= 0 ? "+" : "") + (b.wrg - s.wrg).toFixed(1)).padStart(6) : "     ·";
  console.log("  " + lbl.padEnd(18) + cell(b) + " │" + cell(s) + " │" + ec);
};

// 🔄 16/08 — TRANCHES **ABSOLUES** (owner) : `PAS` points de conviction, depuis `MIN_CONT`. Le %
//   de l'echelle reste imprime a cote, parce que deux baremes d'echelles differentes ne se comparent
//   QUE la-dessus (lecon du matin : `[0·50]` contre `[0·60]`).
const PAS = envNum("PAS", 5);
const DEB = Math.floor(Math.min(...vals) / PAS) * PAS, FIN = Math.ceil(Math.max(...vals) / PAS) * PAS;
console.log(`  ── ① MARGINAL, par tranche de ${PAS} points (disjointes) ──`);
HEAD();
for (let v = DEB; v < FIN; v += PAS)
  ligne(`[${String(v).padStart(3)}·${v + PAS}[  ${(100 * v / MAX).toFixed(0)}%`, (s) => conv(s) >= v && conv(s) < v + PAS);
ligne("TOUS", () => true);
// ⚠⚠ LE CUMULATIF EST IMPRIME PARCE QU'UN SEUIL SE LIT DESSUS — et c'est TOUT ce qu'on peut en dire.
//   « un CUMULATIF ne prouve JAMAIS une borne, il la MAQUILLE » : les lignes sont emboitees, donc le
//   WR y monte mecaniquement. Et ce n'est PAS un balayage : ca decoupe UN carnet deja produit, les
//   creneaux ne se reallouent qu'au RE-RUN (mesure : une tranche promettait 92,7 %, le re-run a rendu 74,4 %).
console.log(`\n  ── ② CUMULATIF (score ≥ v) — a lire avec la reserve ci-dessous, JAMAIS seul ──`);
HEAD();
for (let v = DEB; v < FIN; v += PAS)
  ligne(`≥ ${String(v).padStart(3)}       ${(100 * v / MAX).toFixed(0)}%`, (s) => conv(s) >= v);
console.log(`\n  ⚠ MARGINAL : chaque ligne est DISJOINTE. Un cumulatif ferait monter le WR mecaniquement.`);
console.log(`  ⚠ Bandes basses = survivantes du SPACING, pas une cohorte. Creneaux realloues au RE-RUN seulement.`);
console.log(`  ⚠ Crediter une regle de son cote le PLUS FAIBLE — un MIN_CONT unique lit les deux colonnes.\n`);
