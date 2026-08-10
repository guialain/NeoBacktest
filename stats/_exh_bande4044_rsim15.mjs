// _exh_bande4044_rsim15.mjs — LA POCHE `40-44` DU SCORE EXH SELL, VENTILÉE PAR NIVEAU DE RSI M15.
//
// ⭐ LA QUESTION : `|score| 40-44` côté SELL est la dernière bande négative du barème (109 tirs,
//   72,5 %, R −3,7) et elle est ENCADRÉE de bandes à 84,4 % et 92,1 %. Un score PLUS HAUT y vaut
//   MOINS qu'un score plus bas — c'est une vraie non-monotonie, pas un effet de coupure. Quelle
//   entrée compose ces scores-là ?
//
// ⭐⭐ LES BANDES SONT CELLES DU BARÈME (`RSIM15_V1_SELL`), PAS DES PERCENTILES REFAITS :
//   `0-15 · 15-25 · 25-40 · 40-60 · 60-75 · 75-85 · 85-101`. Recouper fabriquerait un second
//   vocabulaire pour la même grandeur. ⚠ Elles sont IMPORTÉES, jamais recopiées.
//
// 🔴🔥 CLÔTURÉ vs LIVE — ET ICI LA DISTINCTION PORTE UNE INFORMATION, pas seulement une précaution.
//   L'owner demande le RSI M15 **CLÔTURÉ** ; or l'entrée ⑥ du barème lit le **LIVE** (`rsi_m15_s0`).
//   Les deux colonnes sont donc imprimées côte à côte : si la poche se voit sur le CLÔTURÉ et pas
//   sur le LIVE, c'est que le barème note une valeur qui n'est pas celle qui décrit la barre.
//
// ⚠ Population PROD (le carnet déployable) : c'est là que la poche existe. Effectifs par TIR
//   affichés parce que la bande n'a que ~110 tirs ⇒ par épisode les cases seraient à un chiffre ;
//   les grappes sont données pour que le σ ne soit pas lu naïvement.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { RSIM15_V1_SELL } =
  await import("../../Matrix-Revolution/src/components/robot/engines/scoring/exhScoringV1.js");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const SELL = all.filter((s) => s.strategy === "EXH" && s.side === "SELL"
                            && (s.outcome === "WIN" || s.outcome === "LOSS")
                            && Number.isFinite(s.sc?.exh));
const sc = (s) => Math.abs(s.sc.exh);

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function grappes(t) {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { g: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN };
}
const BE = 75;
function line(lbl, t, ind = "  ") {
  if (!t.length) { console.log(ind + lbl.padEnd(26) + "—"); return; }
  const w = t.filter((x) => x.outcome === "WIN").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const wr = 100 * w / t.length, sig = (wr - BE) / (Math.sqrt(0.75 * 0.25 / t.length) * 100);
  const gr = grappes(t), ep = dedupeEpisodes(t).length;
  console.log(ind + lbl.padEnd(26) +
    `tirs=${String(t.length).padStart(4)} (${String(ep).padStart(3)} ép)  WR ${wr.toFixed(1).padStart(5)} %  ` +
    `${(sig >= 0 ? "+" : "") + sig.toFixed(2)} σ${Math.abs(sig) >= 2 ? " ⭐" : "  "} ` +
    `R ${(R >= 0 ? "+" : "") + R.toFixed(1).padStart(6)}  | ${String(gr.g).padStart(3)} gr. ${gr.wr.toFixed(1).padStart(5)} %`);
}

// Les bornes du barème, LUES sur sa table (jamais recopiées) : [lo, hi, note].
const BORNES = RSIM15_V1_SELL.map(([lo, hi, pts]) => ({ lo, hi, pts }));
const bande = (v) => (Number.isFinite(v) ? BORNES.find((b) => v >= b.lo && v < b.hi) ?? null : null);

console.log("[POP PROD] [spread FACTURÉ] · EXH SELL · bandes = celles de `RSIM15_V1_SELL`\n");
line("EXH SELL — TOUT", SELL);

for (const [lo, hi] of [[35, 40], [40, 45], [45, 50]]) {
  const B = SELL.filter((s) => sc(s) >= lo && sc(s) < hi);
  console.log(`\n══ |score| ${lo}-${hi - 1}${lo === 40 ? "   ⟵ LA POCHE" : "   (voisine, pour comparer)"} ══`);
  line("la bande entière", B);
  for (const [nom, champ] of [["RSI M15 CLÔTURÉ (`rsi_m15`)", "rsiM15"],
                              ["RSI M15 LIVE (ce que le barème LIT)", "rsiM15Live"]]) {
    console.log(`  ── ${nom} ──`);
    let vus = 0;
    for (const b of BORNES) {
      const t = B.filter((s) => bande(s[champ]) === b);
      vus += t.length;
      line(`  ${String(b.lo).padStart(3)}-${b.hi === 101 ? "100" : String(b.hi).padStart(3)}  (note ${b.pts >= 0 ? "+" : ""}${b.pts})`, t, "    ");
    }
    const orph = B.length - vus;
    if (orph) console.log(`      ⚠ ${orph} tir(s) sans \`${champ}\` — exclus, jamais comptés 0`);
  }
}
