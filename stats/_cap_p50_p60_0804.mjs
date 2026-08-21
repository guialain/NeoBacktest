// _cap_p50_p60_0804.mjs — LE CAP DE SPREAD À P50 CONTRE P60, PAR TIR **ET** PAR ÉPISODE.
// ⚠⚠ LA TABLE FIGÉE EST DÉSACTIVÉE (`spreadCap: false`) ET LES DEUX CRANS PASSENT PAR
//   `spreadCapPct` : cumuler les deux ferait toujours gagner le plus strict, et l'A/B ne mesurerait
//   rien. Même mécanisme, même calcul, seul le percentile change.
// 🔴 REGARD EN AVANT ASSUMÉ : `spreadCapPct` calcule le percentile sur TOUTE la fenêtre, donc il
//   connaît le futur. C'est acceptable pour CALIBRER (on cherche où poser la borne), PAS pour
//   conclure sur un P&L. La table figée de `SpreadCapConfig` est la version sans look-ahead.
// ⚠ SPREAD FACTURÉ dans les deux cas — sans ça un cap de spread ne peut que paraître nuisible.
// ⚠ `NO_TRIGGER=1` comme le serveur : c'est le mode « moteur pur » de l'UI backtest, PAS le
//   comportement prod (la prod a le trio ACTIF).
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { dedupeEpisodes } = await import("./_episodes.mjs");

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv")).sort();

const stat = (t) => {
  const w = t.filter((x) => x.outcome === "WIN").length, l = t.filter((x) => x.outcome === "LOSS").length;
  const R = t.reduce((a, b) => a + (Number.isFinite(b.R) ? b.R : 0), 0);
  const o = [...t].sort((a, b) => String(a.exitTs || a.tsMT || "").localeCompare(String(b.exitTs || b.tsMT || "")));
  let e = 0, p = 0, d = 0; for (const x of o) { e += Number.isFinite(x.R) ? x.R : 0; p = Math.max(p, e); d = Math.max(d, p - e); }
  // Le POINT MORT bouge avec la composition du run (R moyen d'un TP) : la MARGE est la seule
  //   quantité comparable d'une ligne à l'autre. Règle reprise de `_spread_cap.mjs`.
  const tp = t.filter((x) => x.reason === "TP");
  const rtp = tp.length ? tp.reduce((s, x) => s + x.R, 0) / tp.length : NaN;
  const be = Number.isFinite(rtp) ? 100 / (1 + rtp) : NaN;
  const wr = (w + l) ? 100 * w / (w + l) : NaN;
  return { n: t.length, wr, be, marge: wr - be, rt: t.length ? R / t.length : NaN, R, dd: d,
           exh: t.filter((x) => x.type === "EXHAUSTION").length };
};

const collect = (pct) => {
  const out = [];
  for (const f of files) {
    const r = runMatrixBacktest(path.join(MATRIX, f), {
      maxOpen: 30, cadenceMin: 2, chargeSpread: true,
      spreadCap: false,                 // ⚠ table figée OFF — sinon elle domine
      spreadCapPct: pct,
    });
    // ⚠ PROJECTION IMMÉDIATE : chaque signal porte une copie plate de sa ligne (~292 colonnes).
    //   Garder les runs entiers fait sauter le tas.
    for (const s of (r.signals || [])) if (typeof s.R === "number")
      // ⚠⚠ `ep` EST OBLIGATOIRE — `dedupeEpisodes` le lit, et SANS LUI ELLE DEVIENT UN NO-OP
      //   SILENCIEUX : `last[k] = undefined`, donc `last[k] == null` reste vrai à chaque tour et
      //   TOUT passe. Aucune erreur, juste plus de déduplication. Même famille que `num("")=0`.
      out.push({ R: s.R, outcome: s.outcome, reason: s.reason, type: s.type, side: s.side, ep: s.ep,
                 exitTs: s.exitTs, tsMT: s.tsMT, asset: f.replace(/\.csv$/i, "") });
  }
  return out;
};

const show = (lbl, s) => console.log(
  lbl.padEnd(20) + String(s.n).padStart(6) + (s.wr.toFixed(2) + " %").padStart(9) +
  (Number.isFinite(s.be) ? s.be.toFixed(2) + " %" : "   —").padStart(9) +
  (Number.isFinite(s.marge) ? s.marge.toFixed(2) : " —").padStart(8) +
  s.rt.toFixed(4).padStart(9) + s.R.toFixed(1).padStart(8) + s.dd.toFixed(1).padStart(8) +
  ((s.exh / s.n * 100).toFixed(1) + " %").padStart(9) + (s.R / s.dd).toFixed(2).padStart(7));

console.log("cap / comptage         n       WR   pt mort    marge     R/tr       R   maxDD  ratioEXH   R/DD");
for (const pct of [50, 60, 70, 80]) {
  const t = collect(pct);
  const ep = dedupeEpisodes(t, (s) => s.asset);
  show(`P${pct} · par TIR`, stat(t));
  show(`P${pct} · par ÉPISODE`, stat(ep));
  console.log("");
}
console.log("⚠ La MARGE (WR − point mort) est la seule quantité comparable entre deux runs : le point");
console.log("  mort bouge avec la composition. Un cap se juge sur ce qu'il RETIRE, pas sur le R total,");
console.log("  qui est EXTENSIF (il monte avec le volume).");
