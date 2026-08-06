// _wr_par_kd.mjs — LE WR DU FADE PAR ECART K/D H4.
// ⭐ DEUX LECTURES, et elles ne disent pas la meme chose :
//   1. les 5 bandes NOMMEES du moteur (`kdDistanceBand` sur |K−D|) — la MAGNITUDE, non signee ;
//   2. 20 bandes de 5 percentiles sur l'ecart ORIENTE PAR LE COTE — c'est la seule qui peut montrer
//      une NON-MONOTONIE, et la convention du depot depuis le 03/08.
// ⚠ ORIENTE : pour un fade SELL, un `kdH4 > 0` (K au-dessus de D) est une poussee CONTRE le trade.
//   On multiplie donc par `-1` cote SELL pour que « positif = contre le fade » des deux cotes.
// ⚠ Le point mort effectif est ~75 % spread facture — c'est LUI la reference, pas 50 %.
import { dedupeEpisodes } from "./_episodes.mjs";
import { kdDistanceBand }
  from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";

const SPREAD = String(process.env.CHARGE_SPREAD ?? "true") !== "false";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2&chargeSpread=${SPREAD}`)).json();
  for (const s of (j.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const ep = dedupeEpisodes(all, (s) => s.asset)
  .filter((s) => s.strategy === "EXH")
  .filter((s) => s.outcome === "WIN" || s.outcome === "LOSS")
  .filter((s) => Number.isFinite(s.kdH4))
  .map((s) => ({ ...s, kdOr: s.side === "SELL" ? -s.kdH4 : s.kdH4 }));

const BE = 75;                                     // point mort effectif, spread facture
const st = (t) => {
  const w = t.filter((x) => x.outcome === "WIN").length, n = t.length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const p = n ? w / n : NaN;
  const s0 = n ? Math.sqrt(0.75 * 0.25 / n) * 100 : NaN;      // sigma sous H0 = point mort
  return { n, w, l: n - w, wr: p * 100, R, sig: (p * 100 - BE) / s0 };
};
const line = (lbl, t) => {
  if (!t.length) return;
  const s = st(t);
  const star = Math.abs(s.sig) >= 2 ? "  ⭐" : "";
  console.log(lbl.padEnd(26) + `n=${String(s.n).padStart(4)}  W=${String(s.w).padStart(3)} L=${String(s.l).padStart(3)}  ` +
    `WR ${s.wr.toFixed(1).padStart(5)} %  vs point mort ${(s.sig >= 0 ? "+" : "") + s.sig.toFixed(2)} σ${star}  ` +
    `R ${(s.R >= 0 ? "+" : "") + s.R.toFixed(1)}`);
};

console.log(SPREAD ? "[spread FACTURÉ]" : "[HORS SPREAD] ⚠ non comparable aux baselines");
line("── COHORTE EXH ENTIÈRE", ep);

console.log("\n── 1 · BANDES NOMMÉES (kdDistanceBand sur |K−D| H4, magnitude) ──");
for (const b of ["CONTACT", "LOW", "MEDIUM", "HIGH", "EXTREME"])
  line(`  ${b}`, ep.filter((s) => kdDistanceBand(s.kdH4) === b));

console.log("\n── 2 · ÉCART ORIENTÉ (positif = K pousse CONTRE le fade), 20 bandes P5 ──");
const tri = [...ep].sort((a, b) => a.kdOr - b.kdOr);
const N = tri.length;
for (let i = 0; i < 20; i++) {
  const a = Math.floor(i * N / 20), b = Math.floor((i + 1) * N / 20);
  const v = tri.slice(a, b); if (!v.length) continue;
  line(`  P${String(i * 5).padStart(2)}-${String((i + 1) * 5).padStart(3)} [${v[0].kdOr.toFixed(1)} · ${v[v.length - 1].kdOr.toFixed(1)}]`, v);
}
