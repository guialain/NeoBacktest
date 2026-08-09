// _exh_adx_bandes.mjs — WR DE L'EXH PAR PLAGE D'ADX H1 LIVE, bandes LIBRES.
//   `_kh4_table_perf.mjs` confronte la table à SES lignes ; celui-ci découpe où on veut, pour
//   chercher la frontière AVANT de redicter la table.
//
// 🔴 L'ADX EST UNE MAGNITUDE : **aucune orientation par le côté.** `35-40` veut dire la même chose
//   pour un BUY et pour un SELL — c'est le seul capteur du barème dont les deux tables sont la
//   NÉGATION l'une de l'autre et non une réflexion. ⇒ on affiche les deux côtés BRUTS, côte à côte,
//   et l'écart entre eux EST l'information (une magnitude ne peut pas les distinguer, donc si les
//   deux côtés divergent, la table ne PEUT pas être juste des deux bords à la fois).
//
// ⚠ Lu sur `adx14_h1_s0` (LIVE) — l'instant que l'entrée ③ lit depuis le 07/08.
//   ⚠⚠ `adx14_h1_s0` manque sur ~1 % des barres et l'ADX < 10 n'a PAS de ligne : dans les deux cas
//   l'entrée est MUETTE, donc RETIRÉE du dénominateur, donc elle AMPLIFIE les six autres. Le
//   compte des hors-bande est imprimé — un silence non compté se lit comme une absence d'effet.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
const SOCLE = String(process.env.SOCLE ?? "0") === "1";
if (SOCLE) process.env.TOUT_ADMETTRE = "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const OPTS = SOCLE ? { spacing: false, maxOpen: 100000, cadenceMin: 2, chargeSpread: true }
                   : { maxOpen: 30, cadenceMin: 2, chargeSpread: true };
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), OPTS);
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const ep = dedupeEpisodes(all.filter((s) => s.strategy === "EXH"))
  .filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function gr(t) {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN,
           bas: v.filter((o) => o.w / o.n < 0.75).length };
}
const wr = (t) => (t.length ? 100 * t.filter((x) => x.outcome === "WIN").length / t.length : NaN);
const somR = (t) => t.reduce((a, b) => a + (b.R || 0), 0);
const BE = 75;
const cell = (t) => {
  if (!t.length) return "        —                          ";
  const s = (wr(t) - BE) / (Math.sqrt(0.75 * 0.25 / t.length) * 100);
  const g = gr(t);
  return `${String(t.length).padStart(3)} ép ${wr(t).toFixed(1).padStart(5)} %${Math.abs(s) >= 2 ? "⭐" : " "} ` +
         `R ${(somR(t) >= 0 ? "+" : "") + somR(t).toFixed(1).padStart(5)} ${g.wr.toFixed(1).padStart(5)} %/gr(${g.bas}/${g.n})`;
};

const COUPES = String(process.env.COUPES ?? "30,35,40,45,50,55").split(",").map(Number);
const PLAGES = COUPES.map((c, i) => [c, COUPES[i + 1] ?? Infinity]);

console.log(`${SOCLE ? "[SOCLE]" : "[POP PROD]"} [spread FACTURÉ] [par ÉPISODE] · ADX H1 LIVE ` +
  `(\`adx14_h1_s0\`) · σ contre 75 %\n`);
for (const cote of ["SELL", "BUY"]) {
  const pop = ep.filter((s) => s.side === cote);
  console.log(`══ EXH ${cote} · réf ${pop.length} ép ${wr(pop).toFixed(1)} % (${gr(pop).wr.toFixed(1)} %/gr) ══`);
  let vus = 0;
  for (const [lo, hi] of PLAGES) {
    const t = pop.filter((s) => Number.isFinite(s.adxH1Live) && s.adxH1Live >= lo && s.adxH1Live < hi);
    vus += t.length;
    console.log(`  ${(hi === Infinity ? `≥ ${lo}` : `${lo}-${hi}`).padEnd(8)} ${cell(t)}`);
  }
  const bas = pop.filter((s) => Number.isFinite(s.adxH1Live) && s.adxH1Live < COUPES[0]).length;
  const muet = pop.filter((s) => !Number.isFinite(s.adxH1Live)).length;
  console.log(`  ${`< ${COUPES[0]}`.padEnd(8)} ${cell(pop.filter((s) => Number.isFinite(s.adxH1Live) && s.adxH1Live < COUPES[0]))}`);
  if (muet) console.log(`  ⚠ ${muet} épisode(s) SANS \`adx14_h1_s0\` ⇒ entrée ③ MUETTE (elle AMPLIFIE les six autres)`);
  console.log("");
}
