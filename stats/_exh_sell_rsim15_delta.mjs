// _exh_sell_rsim15_delta.mjs — EXH SELL, RSI M15 **CLÔTURÉ** > 70, ventilé par Δ RSI M15 **LIVE**.
//   Owner 09/08. Même géométrie que l'étude H1 : le NIVEAU à la clôture, la VITESSE en live —
//   `rsi_s0 = rsi_m15 + Δ`, donc sélectionner sur le live et ventiler par le Δ croiserait une
//   grandeur avec sa propre composante et fabriquerait les colonnes rapides (mesuré sur le %K :
//   32 ép à 93,8 % → 0 épisode une fois le sélecteur clôturé, et l'ordre s'inverse).
//
// ⚠⚠ TROIS CONTRÔLES AVANT DE LIRE UNE SEULE BANDE — et le troisième est NEUF :
//   ① `drsi_m15_s0` == `rsi_m15_s0 − rsi_m15` ? (fait pour h4 en juillet, h1 le 09/08, M15 JAMAIS)
//   ② le Δ live est-il mécaniquement biaisé ? (leçon des DI : `s0−c1` négatif 71 % sans marché)
//   ③ 🔴🔥 **`RSI_DELTA_CUTS` EST-IL À L'ÉCHELLE DU M15 ?** Le fichier dit « mesurées et symétrisées,
//      MÊMES VALEURS POUR h1 ET h4 » — le M15 n'y figure PAS. Or un Δ de 15 minutes n'a aucune
//      raison d'avoir la même amplitude qu'un Δ horaire. Plaquer des coupes calibrées ailleurs,
//      c'est le piège « un seuil se périme avec son CAPTEUR » : la table se remplirait quand même,
//      les bandes auraient l'air peuplées, et `FLAT` ne voudrait pas dire la même chose qu'en H1.
//      ⇒ On imprime la RÉPARTITION avant la performance. Si `FLAT` avale tout, la ventilation ne
//      décrit plus rien et il faut recalibrer AVANT de conclure.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { rsiDeltaCol, RSI_DELTA_COLS, RSI_DELTA_CUTS } =
  await import("../../Matrix-Revolution/src/components/robot/engines/scoring/experts/rsiExpert.js");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const SEUIL = Number(process.env.RSIM15_SEUIL ?? 70);

// ══ CONTRÔLES SUR LE DATASET NU ═══════════════════════════════════════════════════════════════
let n = 0, ecartMax = 0, nDiff = 0, nNeg = 0, nHaut = 0, tot = 0;
const absH1 = [], absM15 = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const L = fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/);
  const h = L[0].split(";");
  const iS0 = h.indexOf("rsi_m15_s0"), iCl = h.indexOf("rsi_m15"), iD = h.indexOf("drsi_m15_s0");
  const iDH1 = h.indexOf("drsi_h1_s0");
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    // ⚠ `Number("")` vaut 0 ET il est fini — une chaîne vide est une ABSENCE, jamais un zéro.
    const num = (j) => { const b = String(c[j] ?? "").trim(); return b === "" ? NaN : Number(b); };
    const s0 = num(iS0), cl = num(iCl), d = num(iD), dh1 = num(iDH1);
    if (!Number.isFinite(s0) || !Number.isFinite(cl)) continue;
    tot++; if (s0 > SEUIL) nHaut++;
    if (Number.isFinite(d)) {
      n++; const e = Math.abs(d - (s0 - cl));
      if (e > ecartMax) ecartMax = e;
      if (e > 0.011) nDiff++;
      if (d < 0) nNeg++;
      absM15.push(Math.abs(d));
    }
    if (Number.isFinite(dh1)) absH1.push(Math.abs(dh1));
  }
}
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(p * s.length)]; };
console.log("══ ① `drsi_m15_s0` == `rsi_m15_s0 − rsi_m15` ? ══");
console.log(`  n=${n} · écart max ${ecartMax.toFixed(4)} · lignes au-delà de l'arrondi : ${nDiff}` +
  (nDiff === 0 ? "   ✅ MÊME SÉRIE" : "   🔴 DEUX SÉRIES"));
console.log("\n══ ② biais mécanique ? ══");
console.log(`  ${(100 * nNeg / n).toFixed(1)} % de Δ négatifs` +
  (Math.abs(100 * nNeg / n - 50) < 5 ? "   ✅ centré" : "   🔴 DÉSÉQUILIBRÉ"));
console.log(`  barres à rsi_m15 > ${SEUIL} : ${nHaut} (${(100 * nHaut / tot).toFixed(1)} %)`);
console.log("\n══ ③ `RSI_DELTA_CUTS` EST-IL À L'ÉCHELLE DU M15 ? ══");
console.log(`  coupes appliquées : [${RSI_DELTA_CUTS.join(" · ")}]  (calibrées h1/h4, PAS m15)`);
console.log(`  |Δ| médian   H1 ${q(absH1, 0.5).toFixed(3)}   M15 ${q(absM15, 0.5).toFixed(3)}` +
  `      p90   H1 ${q(absH1, 0.9).toFixed(3)}   M15 ${q(absM15, 0.9).toFixed(3)}`);
const partFlat = absM15.filter((v) => v <= RSI_DELTA_CUTS[0]).length / absM15.length;
const partFlatH1 = absH1.filter((v) => v <= RSI_DELTA_CUTS[0]).length / absH1.length;
console.log(`  part classée FLAT :  H1 ${(100 * partFlatH1).toFixed(1)} %   M15 ${(100 * partFlat).toFixed(1)} %` +
  (Math.abs(partFlat - partFlatH1) > 0.10 ? "   🔴 `FLAT` NE VEUT PAS DIRE LA MÊME CHOSE SUR LES DEUX TF" : "   ✅ comparable"));

// ══ LE CARNET ═════════════════════════════════════════════════════════════════════════════════
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const SELL = all.filter((s) => s.strategy === "EXH" && s.side === "SELL"
                            && (s.outcome === "WIN" || s.outcome === "LOSS"));

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function grappes(t) {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { g: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN,
           bas: v.filter((o) => o.w / o.n < 0.75).length };
}
const BE = 75;
function line(lbl, t, ind = "  ") {
  if (!t.length) { console.log(ind + lbl.padEnd(24) + "—"); return; }
  const w = t.filter((x) => x.outcome === "WIN").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const wr = 100 * w / t.length, sig = (wr - BE) / (Math.sqrt(0.75 * 0.25 / t.length) * 100);
  const gr = grappes(t), ep = dedupeEpisodes(t).length;
  console.log(ind + lbl.padEnd(24) +
    `tirs=${String(t.length).padStart(4)} (${String(ep).padStart(3)} ép)  WR ${wr.toFixed(1).padStart(5)} %  ` +
    `${(sig >= 0 ? "+" : "") + sig.toFixed(2)} σ${Math.abs(sig) >= 2 ? " ⭐" : "  "} ` +
    `R ${(R >= 0 ? "+" : "") + R.toFixed(1).padStart(6)}  ` +
    `| ${String(gr.g).padStart(3)} gr. ${gr.wr.toFixed(1).padStart(5)} % (${gr.bas} <75)`);
}

// ⭐ Côté SELL, le sens BRUT EST le sens orienté : le fade vendeur contrarie un mouvement HAUSSIER,
//   donc `_UP` = « ça pousse encore ». Aucune inversion à faire ici. (Le miroir BUY serait
//   `rsi_m15 < 30` avec les colonnes retournées — hors périmètre de cette mesure.)
const dans = SELL.filter((s) => Number.isFinite(s.rsiM15) && s.rsiM15 > SEUIL);
console.log(`\n[POP PROD] [spread FACTURÉ] · EXH SELL · sélecteur \`rsi_m15\` CLÔTURÉ > ${SEUIL} · Δ LIVE\n`);
line("EXH SELL — TOUT", SELL);
line(`rsi_m15 clôturé > ${SEUIL}`, dans);
line("le reste", SELL.filter((s) => Number.isFinite(s.rsiM15) && s.rsiM15 <= SEUIL));

console.log(`\n── par Δ RSI M15 LIVE (sens brut ; côté SELL, _UP = ça pousse ENCORE) ──`);
let vus = 0;
for (const c of RSI_DELTA_COLS) {
  const t = dans.filter((s) => rsiDeltaCol(s.dRsiM15Live) === c);
  vus += t.length; line(`  ${c}`, t);
}
if (dans.length - vus) console.log(`    ⚠ ${dans.length - vus} tir(s) sans Δ — exclus`);
console.log("  ── regroupé ──");
line("  pousse encore (_UP)", dans.filter((s) => String(rsiDeltaCol(s.dRsiM15Live)).endsWith("_UP")));
line("  FLAT", dans.filter((s) => rsiDeltaCol(s.dRsiM15Live) === "FLAT"));
line("  ralentit (_DOWN)", dans.filter((s) => String(rsiDeltaCol(s.dRsiM15Live)).endsWith("_DOWN")));
