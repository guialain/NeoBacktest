// _recap_etat.mjs — LE RECAP DE L'ETAT COURANT : par RANG et par COTE, tir ET grappe, par JOUR.
//
// ⭐⭐ LES DEUX COMPTAGES SONT IMPRIMES COTE A COTE, TOUJOURS (owner 15/08) : **le TIR decide de
//   l'AMPLEUR, la GRAPPE de la CONFIANCE**, et leur ECART mesure la concentration. Un WR/grappe
//   SUPERIEUR au WR/tir veut dire que les grappes PERDANTES sont plus grosses que les gagnantes —
//   quand le signal se trompe, il se trompe EN SERIE.
// ⚠ Une grappe = actif x jour. ⚠ Point mort 75,0 % sur le WR/TIR (spread facture).
// ⚠ Les seuils sont ceux de la SOURCE, pas des valeurs recopiees ici — ils sont imprimes.
//   usage : MAXOPEN=100 MAXPERSYMBOL=100 node stats/_recap_etat.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { MIN_EXH, MIN_PB, MIN_CONT, BONUS_APPLIQUE } = await import(`${M}/scoringDecision.js`);

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const envNum = (k, d) => { const r = process.env[k]; if (r === undefined || r === "") return d;
                           const v = Number(r); return Number.isFinite(v) ? v : d; };
const OPTS = { maxOpen: envNum("MAXOPEN", 100), cadenceMin: 2, chargeSpread: true };
const mps = envNum("MAXPERSYMBOL", undefined); if (mps !== undefined) OPTS.maxPerSymbol = mps;
const RUN = runMatrixPortfolio(fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f)), OPTS);

const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const sym = (s) => String(s.asset ?? s.symbol ?? "");
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const T = (RUN.signals ?? []).filter((s) => fini(s) && typeof s.R === "number");
// ⚠ LES JOURS SONT COMPTES SUR LE CARNET, pas sur le dataset : ce qui interesse est « combien de
//   trades un jour OUVRE », donc les jours ou le moteur a effectivement tire.
const JOURS = new Set(T.map(jour)).size;

const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = sym(x) + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()], w = t.filter((x) => x.outcome === "WIN").length;
  return { n: t.length, gr: v.length, wr: 100 * w / t.length,
           wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const L = (lab, t) => { const o = st(t);
  if (!o) { console.log("  " + lab.padEnd(16) + "        —"); return; }
  console.log("  " + lab.padEnd(16) + String(o.n).padStart(6) + String(o.gr).padStart(7)
    + o.wr.toFixed(2).padStart(9) + "%" + o.wrg.toFixed(2).padStart(9) + "%"
    + (o.wrg - o.wr >= 0 ? "+" : "") + (o.wrg - o.wr).toFixed(2).padStart(7)
    + ((o.R >= 0 ? "+" : "") + o.R.toFixed(1)).padStart(9)
    + (o.n / JOURS).toFixed(1).padStart(9)); };

console.log(`\n══ RÉCAP ÉTAT COURANT ══  MIN_EXH ${MIN_EXH} · MIN_PB ${MIN_PB} · MIN_CONT ${MIN_CONT} · bonus ${BONUS_APPLIQUE ? "ON" : "OFF"}`);
console.log(`   capacité maxOpen ${OPTS.maxOpen} · maxPerSymbol ${OPTS.maxPerSymbol ?? "(live)"} · ${JOURS} jours de bourse · point mort 75,00 %\n`);
console.log("  " + "rang / côté".padEnd(16) + "  tirs".padStart(6) + "grappes".padStart(7)
  + "  WR/tir".padStart(10) + " WR/grap".padStart(10) + "  écart".padStart(7) + "       R".padStart(9) + " tirs/j".padStart(9));
console.log("  " + "─".repeat(74));
for (const r of ["EXH", "PB", "CONT"]) {
  const R_ = T.filter((s) => s.strategy === r);
  L(`${r} BUY`, R_.filter((s) => s.side === "BUY"));
  L(`${r} SELL`, R_.filter((s) => s.side === "SELL"));
  L(`${r} ─ TOUS`, R_);
  console.log("");
}
L("TOTAL BUY", T.filter((s) => s.side === "BUY"));
L("TOTAL SELL", T.filter((s) => s.side === "SELL"));
console.log("  " + "─".repeat(74));
L("TOTAL", T);
const o = st(T);
console.log(`\n  ⇒ **${o.n} trades sur ${JOURS} jours = ${(o.n / JOURS).toFixed(1)} par jour** · ${o.gr} grappes actif×jour`);
console.log(`  ⚠ écart WR/grap − WR/tir POSITIF ⇒ les grappes PERDANTES sont plus GROSSES : le signal se trompe EN SÉRIE.\n`);
