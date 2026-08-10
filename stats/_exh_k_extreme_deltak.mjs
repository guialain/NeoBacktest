// _exh_k_extreme_deltak.mjs — « LE %K EST À L'EXTRÊME ET IL CALE, OU IL S'EMPIRE » (owner 09/08).
//
// ⭐ LA QUESTION : quand le stochastique est SATURÉ du côté d'où le fade revient, sa VITESSE
//   change-t-elle l'issue ? `cale` = `FLAT` · `s'empire` = il s'enfonce ENCORE dans l'extrême.
//   C'est la 4ᵉ fois qu'on pose la même question aujourd'hui (z/BBW · écart DI · Δ RSI H1) — si le
//   %K répond pareil, ce n'est plus une case de grille, c'est un mécanisme.
//
// 🔴🔥 LA ZONE EST **DERRIÈRE**, PAS DEVANT. Un EXH SELL fade un mouvement HAUSSIER : sa zone
//   extrême est `EXTREME_HAUTE`, celle d'où il revient (`ZONES_BEHIND` de `vetoGate`). Prendre
//   `EXTREME_AHEAD` mesurerait la population inverse — et les deux existent dans le carnet.
//
// 🔴🔥 ORIENTATION PAR LE CÔTÉ, OBLIGATOIRE. `deltaKBand` rend le sens BRUT. Pour un fade SELL,
//   « ça s'empire » = `_UP` ; pour un fade BUY, c'est `_DOWN`. Sans orientation chaque classe est
//   un DEMI-ÉCHANTILLON — la faute du 06/08 (`FAST_DOWN` à 100 % sur 21 ép, une seule moitié).
//   ⇒ Ici `_UP` signifie TOUJOURS « le %K s'enfonce dans l'extrême qu'on fade ».
//
// ⚠ DEUX TF, PARCE QUE LES DEUX SONT DES ENTRÉES DU BARÈME (⑤ `kH1Live`, ④ `kH4Live`) et qu'ils ne
//   répondent pas à la même question : le H1 porte la ZONE du routeur, le H4 la saturation lente.
// ⚠ `zoneH1`/`dKBandH1` sont les valeurs LIVE du moteur (`perTf`), pas des recopies : ΔK = k(s0) − k(s1).
// ⚠ Population = celle du moteur COURANT (veto DI + 7ᵉ entrée + seuil 15). Les effectifs sont donc
//   plus petits qu'en début de journée — c'est la population qui tire aujourd'hui, c'est elle qui
//   compte pour décider, mais elle a moins de résolution.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
// `LIBRE=1` : spacing off + cap levé. Pour JUGER une figure, la capacité de prod supprime des tirs
//   par ORDRE D'ARRIVÉE et pas par figure. ⚠ Elle rend MOINS d'épisodes (les tirs se chaînent).
const LIBRE = String(process.env.LIBRE ?? "0") === "1";
const OPTS = LIBRE ? { spacing: false, maxOpen: 100000, cadenceMin: 2, chargeSpread: true }
                   : { maxOpen: 30, cadenceMin: 2, chargeSpread: true };

let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), OPTS);
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const EXH = all.filter((s) => s.strategy === "EXH");
const ep = dedupeEpisodes(EXH).filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function grappes(t) {
  const g = new Map();
  for (const s of t) {
    const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++;
  }
  const v = [...g.values()];
  return { g: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN,
           bas: v.filter((o) => o.w / o.n < 0.75).length };
}
const BE = 75;
function line(lbl, t) {
  if (!t.length) { console.log("  " + lbl.padEnd(30) + "—"); return; }
  const w = t.filter((x) => x.outcome === "WIN").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const wr = 100 * w / t.length, sig = (wr - BE) / (Math.sqrt(0.75 * 0.25 / t.length) * 100);
  const gr = grappes(t);
  console.log("  " + lbl.padEnd(30) +
    `ép=${String(t.length).padStart(3)}  WR ${wr.toFixed(1).padStart(5)} %  ` +
    `${(sig >= 0 ? "+" : "") + sig.toFixed(2)} σ${Math.abs(sig) >= 2 ? " ⭐" : "  "} ` +
    `R ${(R >= 0 ? "+" : "") + R.toFixed(1).padStart(6)}  ` +
    `| ${String(gr.g).padStart(3)} gr. ${gr.wr.toFixed(1).padStart(5)} % (${gr.bas} <75)`);
}

// La zone extrême D'OÙ le fade revient. Miroir structurel par `side`, jamais écrit en dur.
const EXTREME_BEHIND = { SELL: "EXTREME_HAUTE", BUY: "EXTREME_BASSE" };
const MIROIR = { EXPLOSIVE_DOWN: "EXPLOSIVE_UP", FAST_DOWN: "FAST_UP", SOFT_DOWN: "SOFT_UP", FLAT: "FLAT",
                 SOFT_UP: "SOFT_DOWN", FAST_UP: "FAST_DOWN", EXPLOSIVE_UP: "EXPLOSIVE_DOWN" };
const ORDRE = ["EXPLOSIVE_DOWN", "FAST_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"];
// ⭐ `_UP` orienté = « le %K S'ENFONCE dans l'extrême qu'on fade » ; `_DOWN` = « il en revient ».
const orient = (b, side) => (b == null ? null : side === "BUY" ? MIROIR[b] ?? b : b);

console.log(`${LIBRE ? "[POP LIBRE]" : "[POP PROD]"} [spread FACTURÉ] [par ÉPISODE] ` +
  `· moteur COURANT (veto DI + 7ᵉ entrée + seuil 15) · σ contre 75 %`);
console.log(`${ep.length} épisodes EXH  (BUY ${ep.filter((s) => s.side === "BUY").length} · ` +
  `SELL ${ep.filter((s) => s.side === "SELL").length})\n`);
line("EXH — TOUS (référence)", ep);
line("  BUY", ep.filter((s) => s.side === "BUY"));
line("  SELL", ep.filter((s) => s.side === "SELL"));

// 🔴🔥⭐⭐⭐ LE SÉLECTEUR EST LA ZONE À LA **CLÔTURE** (`kH1S1`), LA VITESSE RESTE **LIVE** — owner
//   09/08. ⚠ Ce n'est pas un réglage de fraîcheur, c'est ce qui rend le croisement LISIBLE :
//   `k(s0) = k(s1) + ΔK`. Sélectionner sur `k(s0)` et ventiler par `ΔK`, c'est croiser une grandeur
//   avec une de ses PROPRES COMPOSANTES — un gros ΔK positif pousse mécaniquement le niveau dans
//   l'extrême, donc la case « extrême ET s'empire » est en partie fabriquée par l'algèbre, pas par
//   le marché. Identité, pas corrélation. Même correction que `zClosed`+`dZ` le 29/07.
//   ⇒ `k(s1)` = ce qui est ÉTABLI · `ΔK` = ce qui se passe MAINTENANT. Aucun terme commun.
// ⚠ LA LIGNE `H1 (live)` EST GARDÉE EN DESSOUS, EXPRÈS : l'écart entre les deux lectures MESURE
//   l'artefact. S'il est gros, la version live était en train de mentir.
for (const [tf, zk, bk] of [["H1 ⭐ zone CLÔTURE _s1", "zoneH1S1", "dKBandH1"],
                            ["H1 (zone LIVE — axes NON indépendants, gardé pour MESURER l'artefact)", "zoneH1", "dKBandH1"],
                            ["H4 ⭐ zone CLÔTURE _s1", "zoneH4S1", "dKBandH4"]]) {
  const dans = ep.filter((s) => s[zk] === EXTREME_BEHIND[s.side]);
  const hors = ep.filter((s) => s[zk] != null && s[zk] !== EXTREME_BEHIND[s.side]);
  console.log(`\n══ %K ${tf} À L'EXTRÊME D'OÙ LE FADE REVIENT ` +
    `(SELL ⇒ EXTREME_HAUTE · BUY ⇒ EXTREME_BASSE) ══`);
  line("zone extrême", dans);
  line("  le reste des zones", hors);
  const muet = ep.length - dans.length - hors.length;
  if (muet) console.log(`  ⚠ ${muet} épisode(s) sans zone ${tf} — exclus`);

  console.log(`  ── par niveau de Δ%K ${tf}, ORIENTÉ (_UP = il S'ENFONCE dans l'extrême) ──`);
  let vus = 0;
  for (const c of ORDRE) {
    const t = dans.filter((s) => orient(s[bk], s.side) === c);
    vus += t.length; line(`  ${c}`, t);
  }
  if (dans.length - vus) console.log(`    ⚠ ${dans.length - vus} sans Δ%K — exclus`);

  console.log("  ── regroupé ──");
  const sEmpire = dans.filter((s) => String(orient(s[bk], s.side)).endsWith("_UP"));
  const cale    = dans.filter((s) => orient(s[bk], s.side) === "FLAT");
  const revient = dans.filter((s) => String(orient(s[bk], s.side)).endsWith("_DOWN"));
  line("  S'EMPIRE (_UP ×3)", sEmpire);
  line("  CALE (FLAT)", cale);
  line("  REVIENT (_DOWN ×3)", revient);
  console.log("  ── et PAR CÔTÉ, parce que l'axe s'est inversé 2 fois aujourd'hui ──");
  for (const [nom, t] of [["s'empire", sEmpire], ["cale", cale], ["revient", revient]]) {
    line(`  ${nom} · BUY`,  t.filter((s) => s.side === "BUY"));
    line(`  ${nom} · SELL`, t.filter((s) => s.side === "SELL"));
  }
}
