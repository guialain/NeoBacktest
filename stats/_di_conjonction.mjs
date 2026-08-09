// _di_conjonction.mjs — WR de l'EXH sous la CONJONCTION DI dictée par l'owner (09/08) :
//     DI+ = EXTREME_HIGH   ET   DI− = EXTREME_LOW   ET   écart DI = WIDENING
//
// ⭐ LES TROIS CLASSIFICATEURS VIENNENT DU MOTEUR, aucun n'est recopié ici — `diLevelBand` pour les
//   deux niveaux, `diGapDynH1` (déjà dans la fiche) pour la dynamique. Recouper à la main
//   fabriquerait un second vocabulaire pour la même grandeur (piège `derived_dataset_computed_3x`).
//
// ⚠ NIVEAU LU EN **LIVE** (`plusDiLive`/`minusDiLive`, `_s0` avec repli close) : `DI_LEVEL_BANDS`
//   [7 · 14,5 · 20,5 · 32] est calibré sur le live, et les DI décroissent de 13,3 % à chaque
//   ouverture de bougie. Bander la close avec ces bornes déplacerait toute la population.
//   La colonne « closes » est imprimée à côté POUR MONTRER l'écart, jamais pour conclure.
//
// ⚠ LA CONJONCTION EST DÉJÀ IMPLIQUÉE PAR L'ÉCART : DI+ ≥ 32 et DI− < 7 ⇒ écart > 25 ⇒ `STRONG_BUY`
//   forcé (bande ≥ 23). C'est donc un SOUS-ENSEMBLE de `STRONG_BUY` — la ligne `STRONG_BUY` est
//   imprimée comme référence, sans quoi on ne saurait pas si l'effet vient des NIVEAUX ou de l'écart.
//
// 🔴 COMPTAGE : épisodes (dédup 15 min) ET grappes actif×jour. Les tirs ne sont pas indépendants —
//   20 185 tirs = 222 grappes ⇒ σ gonflé ×9. La ligne « grappes » est celle qui tranche.
import { dedupeEpisodes, cohortStats } from "./_episodes.mjs";
import { diLevelBand }
  from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";

const API = "http://localhost:3001/api/matrix";
// `LIBRE=1` ⇒ `spacing=false&maxOpen=100000` : la capacité de prod supprime 82 % des tirs et c'est
//   l'ORDRE D'ARRIVÉE qui décide, pas la figure. Pour JUGER une figure rare, il faut la pop libre.
const LIBRE = String(process.env.LIBRE ?? "0") === "1";
const q = LIBRE ? "spacing=false&maxOpen=100000&cadenceMin=2&chargeSpread=true"
                : "maxOpen=30&cadenceMin=2&chargeSpread=true";

const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?${q}`)).json();
  for (const s of (j.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((a, b) => a.ep - b.ep);

const EXH = all.filter((s) => s.strategy === "EXH");
const ep = dedupeEpisodes(EXH).filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const bandLive  = (s) => [diLevelBand(s.plusDiLive), diLevelBand(s.minusDiLive)];
const bandClose = (s) => [diLevelBand(s.plusDi),     diLevelBand(s.minusDi)];
const COND = (s, f = bandLive) => {
  const [p, m] = f(s);
  return p === "EXTREME_HIGH" && m === "EXTREME_LOW" && s.diGapDynH1 === "WIDENING";
};

// ── une VOIX PAR GRAPPE actif×jour ────────────────────────────────────────────────────────────
const jour = (s) => String(s.tsMT || "").slice(0, 10);
function grappes(t) {
  const g = new Map();
  for (const s of t) {
    const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++;
  }
  const v = [...g.values()];
  const wr = v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN;
  return { g: v.length, wr };
}

const BE = 75;   // point mort effectif, spread facturé — JAMAIS 50
function line(lbl, t) {
  if (!t.length) { console.log(lbl.padEnd(34) + "— aucune occurrence"); return; }
  const c = cohortStats(t), gr = grappes(t);
  const se = Math.sqrt(0.75 * 0.25 / t.length) * 100;
  const sig = (c.wr - BE) / se;
  console.log(lbl.padEnd(34) +
    `n=${String(c.n).padStart(4)}  WR ${c.wr.toFixed(1).padStart(5)} %  ` +
    `${(sig >= 0 ? "+" : "") + sig.toFixed(2)} σ${Math.abs(sig) >= 2 ? " ⭐" : "  "}  ` +
    `R ${(c.R >= 0 ? "+" : "") + c.R.toFixed(1).padStart(6)}  R/ép ${c.rt.toFixed(3)}  ` +
    `| ${String(gr.g).padStart(3)} grappes, WR/grappe ${gr.wr.toFixed(1)} %`);
}

console.log(`${LIBRE ? "[POP LIBRE spacing=false maxOpen=100000]" : "[POP PROD maxOpen=30 spacing ON]"}` +
  `  [spread FACTURÉ]  [par ÉPISODE, dédup 15 min]  · σ contre le point mort 75 %`);
console.log(`${assets.length} actifs · ${all.length} tirs · ${EXH.length} tirs EXH · ${ep.length} épisodes EXH\n`);

line("EXH — TOUS", ep);
console.log("\n── LA CONJONCTION (niveaux LIVE `_s0`) ──");
const dans = ep.filter((s) => COND(s));
line("  DI+ XHIGH · DI− XLOW · WIDENING", dans);
line("  le RESTE", ep.filter((s) => !COND(s)));
console.log("  par côté :");
line("    dont BUY",  dans.filter((s) => s.side === "BUY"));
line("    dont SELL", dans.filter((s) => s.side === "SELL"));

// 🔴🔥 ORIENTÉ PAR LE CÔTÉ — sans ça la figure n'est qu'un DEMI-ÉCHANTILLON. `DI+ XHIGH · DI− XLOW`
//   est le repère BRUT du marché : les acheteurs écrasent. Un EXH ne peut y prendre qu'un SELL —
//   d'où 0 BUY ci-dessus, ce n'est pas un résultat, c'est la définition. La MÊME FIGURE côté BUY,
//   c'est `DI− XHIGH · DI+ XLOW` (les vendeurs écrasent, on fade à la hausse).
//   ⇒ « le camp qu'on FADE est à l'extrême haut, l'autre à l'extrême bas, et l'écart se creuse ».
const CONDO = (s, f = bandLive) => {
  const [p, m] = f(s);
  const [fade, contre] = s.side === "SELL" ? [p, m] : [m, p];   // SELL ⇒ on fade les acheteurs
  return fade === "EXTREME_HIGH" && contre === "EXTREME_LOW" && s.diGapDynH1 === "WIDENING";
};
console.log("\n── LA MÊME FIGURE, ORIENTÉE PAR LE CÔTÉ (le camp FADÉ à l'extrême haut) ──");
const dansO = ep.filter((s) => CONDO(s));
line("  figure orientée", dansO);
line("  le RESTE", ep.filter((s) => !CONDO(s)));
line("    dont BUY  (DI− XHIGH · DI+ XLOW)", dansO.filter((s) => s.side === "BUY"));
line("    dont SELL (DI+ XHIGH · DI− XLOW)", dansO.filter((s) => s.side === "SELL"));

console.log("\n── DÉCOMPOSITION — chaque brique SEULE, puis empilées (LIVE) ──");
line("  DI+ = EXTREME_HIGH",            ep.filter((s) => bandLive(s)[0] === "EXTREME_HIGH"));
line("  DI− = EXTREME_LOW",             ep.filter((s) => bandLive(s)[1] === "EXTREME_LOW"));
line("  gap = WIDENING",                ep.filter((s) => s.diGapDynH1 === "WIDENING"));
line("  XHIGH + XLOW (sans dynamique)", ep.filter((s) => bandLive(s)[0] === "EXTREME_HIGH" && bandLive(s)[1] === "EXTREME_LOW"));
line("  ⤷ + NARROWING",                 ep.filter((s) => bandLive(s)[0] === "EXTREME_HIGH" && bandLive(s)[1] === "EXTREME_LOW" && s.diGapDynH1 === "NARROWING"));
line("  ⤷ + STABLE",                    ep.filter((s) => bandLive(s)[0] === "EXTREME_HIGH" && bandLive(s)[1] === "EXTREME_LOW" && s.diGapDynH1 === "STABLE"));

console.log("\n── RÉFÉRENCE : l'écart seul (la conjonction en est un SOUS-ENSEMBLE) ──");
line("  diGapBandH1 = STRONG_BUY",  ep.filter((s) => s.diGapBandH1 === "STRONG_BUY"));
line("  STRONG_BUY + WIDENING",     ep.filter((s) => s.diGapBandH1 === "STRONG_BUY" && s.diGapDynH1 === "WIDENING"));

console.log("\n── CONTRÔLE : la MÊME condition lue sur les CLOSES `_c1` (bornes inadaptées, pour l'écart) ──");
line("  conjonction (closes)", ep.filter((s) => COND(s, bandClose)));
const src = ep.filter((s) => s.diLiveSrc === "c1").length;
console.log(`  ⚠ ${src}/${ep.length} épisodes sans \`_s0\` (repli close dans la lecture LIVE)`);

// ── PAR TIR — la lecture BRUTE que l'owner demande, mais BIAISÉE : le nombre de clones dépend de
//   l'ISSUE (un setup gagnant retire plus longtemps). ~5,5 pts d'écart mesurés, ça INVERSE des
//   conclusions. Imprimée pour répondre à la question posée, jamais pour trancher.
console.log("\n── PAR TIR ⚠ BIAISÉ (le nombre de clones dépend de l'issue) — pour information ──");
const tirs = EXH.filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");
line("  EXH — TOUS", tirs);
line("  conjonction brute (SELL only)", tirs.filter((s) => COND(s)));
line("  figure orientée", tirs.filter((s) => CONDO(s)));
line("    dont BUY",  tirs.filter((s) => CONDO(s) && s.side === "BUY"));
line("    dont SELL", tirs.filter((s) => CONDO(s) && s.side === "SELL"));
