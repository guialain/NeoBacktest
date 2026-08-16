// _exh_wr_bandes.mjs — WR EXH PAR TRANCHE DE SCORE, PAR COTE (jumeau de `_cont_wr_bandes_ab`).
//
// 🎯 PREREQUIS NOMME : la normalisation `gapM15 x 2` (16/08) fait passer le rang ① de 985 a 1 362
//   tirs (+38 %), et la cohorte marginale est a **74,8 %** — sous le point mort — pour **−1,1 R**.
//   Il faut voir OU elle tombe dans le barème : c'est la seule chose qui dise si la table doit etre
//   re-dictee sur les cases hautes, ou si c'est le SEUIL qui doit bouger.
//
// ⚠⚠ MARGINAL D'ABORD (lignes DISJOINTES). « un CUMULATIF ne prouve JAMAIS une borne, il la
//   MAQUILLE » — les lignes emboitees font monter le WR mecaniquement. Le cumulatif est imprime
//   apres, parce qu'un seuil se lit dessus, et JAMAIS seul.
// ⚠ LES DEUX COMPTAGES (tir ET grappe) : le TIR decide de l'AMPLEUR, la GRAPPE de la CONFIANCE.
// ⚠ PAR COTE — un total qui monte peut cacher un cote qui s'effondre.
// ⚠⚠ CE N'EST PAS UN BALAYAGE : ca decoupe UN carnet deja produit. Les creneaux ne se reallouent
//   qu'au RE-RUN (mesure : une tranche promettait 92,7 %, le re-run a rendu 74,4 %).
//   usage : MAXOPEN=100 MAXPERSYMBOL=100 MIN_EXH=5 PAS=5 node stats/_exh_wr_bandes.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
process.env.MIN_EXH = process.env.MIN_EXH ?? "5";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { BONUS_APPLIQUE, MIN_EXH } = await import(`${M}/scoringDecision.js`);

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const envNum = (k, d) => { const r = process.env[k]; if (r === undefined || r === "") return d;
                           const v = Number(r); return Number.isFinite(v) ? v : d; };
const OPTS = { maxOpen: envNum("MAXOPEN", 100), cadenceMin: 2, chargeSpread: true };
const mps = envNum("MAXPERSYMBOL", undefined); if (mps !== undefined) OPTS.maxPerSymbol = mps;
const PAS = envNum("PAS", 5);
const RUN = runMatrixPortfolio(fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f)), OPTS);

// ⚠ `boxes.exh.conviction` est la note ORIENTEE (positif = bon fade de SON cote). Lire `sc.exh`
//   donnerait le score SIGNE — deux grandeurs differentes, et le depot a deja paye la confusion.
const conv = (s) => s.sc?.boxes?.exh?.conviction;
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const sym = (s) => String(s.asset ?? s.symbol ?? "");
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const EXH = (RUN.signals ?? []).filter((s) => s.strategy === "EXH" && fini(s) && Number.isFinite(conv(s)));

const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = sym(x) + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()], w = t.filter((x) => x.outcome === "WIN").length;
  return { n: t.length, gr: v.length, wr: 100 * w / t.length,
           wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const cell = (o) => o ? String(o.n).padStart(6) + String(o.gr).padStart(5) + o.wr.toFixed(1).padStart(8) + "%"
                        + o.wrg.toFixed(1).padStart(7) + "%" + ((o.R >= 0 ? "+" : "") + o.R.toFixed(1)).padStart(8)
                      : "     —    —       —       —       —";
const BUY = EXH.filter((s) => s.side === "BUY"), SELL = EXH.filter((s) => s.side === "SELL");
const HEAD = () => {
  console.log("  " + " ".repeat(12) + "            B U Y            │            S E L L");
  console.log("  " + "bande".padEnd(12) + "  tirs grap  WR/tir WR/grap       R │  tirs grap  WR/tir WR/grap       R");
  console.log("  " + "─".repeat(12) + "─".repeat(30) + "┼" + "─".repeat(30));
};
const ligne = (lbl, f) => console.log("  " + lbl.padEnd(12) + cell(st(BUY.filter(f))) + " │" + cell(st(SELL.filter(f))));

const vals = EXH.map(conv);
const DEB = Math.floor(Math.min(...vals) / PAS) * PAS, FIN = Math.ceil(Math.max(...vals) / PAS) * PAS;
console.log(`\n═══ EXH · WR PAR TRANCHE DE SCORE, PAR CÔTÉ ═══  ${process.env.LABEL ?? ""}`);
console.log(`  MIN_EXH du run = ${MIN_EXH} · bonus ${BONUS_APPLIQUE ? "APPLIQUÉS" : "DÉBRANCHÉS"} · maxOpen ${OPTS.maxOpen} · maxPerSymbol ${OPTS.maxPerSymbol ?? "(live)"}`);
console.log(`  ${EXH.length} tirs EXH · conviction observée ${Math.min(...vals).toFixed(1)} … ${Math.max(...vals).toFixed(1)} · point mort 75,0 %\n`);
console.log(`  ── ① MARGINAL, tranches de ${PAS} points (DISJOINTES) ──`);
HEAD();
for (let v = DEB; v < FIN; v += PAS) ligne(`[${String(v).padStart(3)}·${v + PAS}[`, (s) => conv(s) >= v && conv(s) < v + PAS);
ligne("TOUS", () => true);
console.log(`\n  ── ② CUMULATIF (score ≥ v) — à lire avec la réserve, JAMAIS seul ──`);
HEAD();
for (let v = DEB; v < FIN; v += PAS) ligne(`≥ ${String(v).padStart(3)}`, (s) => conv(s) >= v);
console.log(`\n  ⚠ MARGINAL = lignes disjointes · CUMULATIF = emboîtées, le WR y monte mécaniquement.`);
console.log(`  ⚠ PAS UN BALAYAGE : les créneaux ne se réallouent qu'au RE-RUN.\n`);
