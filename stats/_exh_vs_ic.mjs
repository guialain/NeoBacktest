// _exh_vs_ic.mjs — LES DEALS "EXH" ACTUELS SONT-ILS DES EXH, OU DES PULLBACKS DÉGUISÉS ?
//
// ⭐⭐⭐ LE CONSTAT OWNER (2026-08-10). Le rang ① évalue « fade sur extrême %K » SANS regarder de
//   quel côté de l'`ic` (le sens du JOUR) le fade se place. Or :
//       fade CONTRE l'ic  (BUY · ic<0   |  SELL · ic>0)  = EXH VRAI     — on fade la journée
//       fade DANS le sens (BUY · ic>0   |  SELL · ic<0)  = PLB DÉGUISÉ  — on fade la CORRECTION
//   Acheter une correction dans un jour qui monte n'est pas acheter un effondrement. Ce sont deux
//   figures, et le WR agrégé de ~85 % est un BLEND tant qu'on ne les a pas séparées.
//
// ⭐ `ic` = `intraday_change`, le % depuis l'open du jour. DÉJÀ PORTÉ PAR LA FICHE
//   (`matrixBacktest` l'écrit en `intradayChange`) ⇒ aucune extraction, aucun rebuild.
//
// ⭐⭐ LA ZONE MORTE N'EST PAS UN SEUIL INVENTÉ. `getIntradayLevelBySymbol` classe déjà l'`ic` PAR
//   ACTIF (24 mois de D1 · soft = P50 de la magnitude · symétrique) ⇒ `NEUTRE` EST la zone morte.
//   🔴 Un seuil universel en % aurait été un seuil PAR ACTIF déguisé : le p90 de |ic| va de 0,27 %
//   (USDCAD) à 5,75 % (COCOA), facteur 21 — il aurait trié « actif volatil », pas « jour orienté ».
//
// 🔴🔥 GARDE-FOU EN TÊTE DE SORTIE : si `intradayChange` n'était pas sur la fiche, TOUT tomberait en
//   `NEUTRE` et le tableau se lirait « la zone morte est énorme » au lieu de « la sonde est à la
//   mauvaise adresse ». On imprime donc la COUVERTURE du champ avant toute conclusion, et le nombre
//   d'actifs retombés sur `INTRADAY_CONFIG.default` (repli silencieux = seuils d'un autre actif).
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/";
const { getIntradayLevelBySymbol } = await import(`${M}utils/marketLevels.js`);
const { INTRADAY_CONFIG } = await import(`${M}components/robot/engines/config/IntradayConfig.js`);
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const US_IDX = new Set(["US_30", "US_500", "US_TECH100"]);

let all = [];
const sansCfg = new Set();
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  if (!INTRADAY_CONFIG[a]) sansCfg.add(a);
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) {
    if (s.strategy !== "EXH" || typeof s.R !== "number") continue;
    if (s.outcome !== "WIN" && s.outcome !== "LOSS") continue;
    all.push({ ...s, asset: a });
  }
}

// ⚠ COUVERTURE D'ABORD — sans ça le reste n'est pas interprétable.
const avecIc = all.filter((s) => Number.isFinite(s.intradayChange));
console.log(`\n═══ SÉPARATION EXH / PLB PAR LE CÔTÉ vs l'ic ═══  [NO_TRIGGER · spread FACTURÉ · SEUIL_V1=10]`);
console.log(`  ${all.length} tirs EXH · \`intradayChange\` présent sur ${avecIc.length} ` +
  `(${(100 * avecIc.length / (all.length || 1)).toFixed(1)} %)` +
  (avecIc.length < all.length * 0.99 ? "   🔴 CHAMP INCOMPLET — ne pas conclure" : "   ✅"));
console.log(`  actifs sans entrée \`INTRADAY_CONFIG\` (repli sur \`default\`) : ` +
  (sansCfg.size ? `🔴 ${[...sansCfg].join(", ")}` : "aucun ✅"));

// ── CLASSIFICATION ────────────────────────────────────────────────────────────────────────────
// ⚠ Le NIVEAU (`NEUTRE`) porte la zone morte ; le SIGNE de l'ic porte le côté. On ne déduit pas le
//   côté du niveau : `SOFT_UP` dit « journée haussière », il ne dit pas de combien.
const classe = (s) => {
  if (!Number.isFinite(s.intradayChange)) return "SANS_IC";
  if (getIntradayLevelBySymbol(s.intradayChange, s.asset) === "NEUTRE") return "ZONE_MORTE";
  const icUp = s.intradayChange > 0;
  const proIc = (s.side === "BUY" && icUp) || (s.side === "SELL" && !icUp);
  return proIc ? "PLB_DEGUISE" : "EXH_VRAI";
};
for (const s of all) s.cls = classe(s);

// 🔴🔥 `tsMT` S'ÉCRIT `2026.08.05 20:11:38` — AVEC DES POINTS. Premier jet de ce script : je
//   comparais à `"2026-08-01"`, et comme `.` (0x2E) > `-` (0x2D) en ASCII, TOUTES les lignes
//   passaient pour août et le filtre « sans le 04/08 » ne matchait jamais. Les trois découpes
//   rendaient un tableau parfaitement lisible et faux. ⇒ On NORMALISE, et le garde-fou plus bas
//   refuse de tourner si le format change encore.
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const grappes = (t) => {
  const g = new Map();
  for (const s of t) {
    const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++;
  }
  const v = [...g.values()];
  return { n: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN,
           bas: v.filter((o) => o.w / o.n < 0.75).length };
};
const BE = 75;
const ligne = (lbl, t) => {
  if (!t.length) { console.log(`    ${lbl.padEnd(16)}      —`); return; }
  const w = t.filter((x) => x.outcome === "WIN").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const wr = 100 * w / t.length, g = grappes(t);
  const sig = (wr - BE) / (Math.sqrt(0.75 * 0.25 / t.length) * 100);
  console.log(`    ${lbl.padEnd(16)} ${String(t.length).padStart(5)} ${wr.toFixed(1).padStart(7)}%` +
    ` ${g.wr.toFixed(1).padStart(8)}% ${String(g.n).padStart(5)} ${String(g.bas).padStart(5)}` +
    ` ${((R >= 0 ? "+" : "") + R.toFixed(1)).padStart(8)} ${(R / t.length).toFixed(3).padStart(7)}` +
    ` ${((sig >= 0 ? "+" : "") + sig.toFixed(2)).padStart(7)}`);
};
const bloc = (titre, pop) => {
  console.log(`\n── ${titre} ── (${pop.length} tirs)`);
  console.log(`    ${"".padEnd(16)}  tirs  WR/tir WR/grap  grap  <BE        R   R/tir       σ`);
  for (const c of ["EXH_VRAI", "PLB_DEGUISE", "ZONE_MORTE"]) {
    const t = pop.filter((s) => s.cls === c);
    ligne(c, t);
    for (const side of ["BUY", "SELL"]) ligne(`  ${side}`, t.filter((s) => s.side === side));
  }
};

// ⭐ GARDE-FOU DE FORMAT — une découpe par date qui ne matche RIEN se lit comme « cette période est
//   vide », pas comme « le format a changé ». On refuse de tourner plutôt que de rendre du faux.
const jours = [...new Set(all.map(jour))].sort();
if (!jours.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))) {
  console.log(`\n🔴 FORMAT DE DATE INATTENDU — exemples : ${jours.slice(0, 3).join(" · ")}. STOP.`);
  process.exit(1);
}
console.log(`  fenêtre : ${jours[0]} → ${jours[jours.length - 1]} · ${jours.length} journées`);

bloc("TOUTE LA FENÊTRE", all);
bloc("JUILLET", all.filter((s) => jour(s) < "2026-08-01"));
bloc("AOÛT", all.filter((s) => jour(s) >= "2026-08-01"));
bloc("SANS LE 04/08", all.filter((s) => jour(s) !== "2026-08-04"));
bloc("SANS LES INDICES US", all.filter((s) => !US_IDX.has(s.asset)));
bloc("SANS 04/08 NI INDICES US", all.filter((s) => jour(s) !== "2026-08-04" && !US_IDX.has(s.asset)));

// ── LA ZONE MORTE, CHIFFRÉE ───────────────────────────────────────────────────────────────────
const zm = all.filter((s) => s.cls === "ZONE_MORTE");
console.log(`\n── ZONE MORTE (\`ic\` = NEUTRE, sous le P50 de |ic| DE CET ACTIF) ──`);
console.log(`  ${zm.length} tirs sur ${all.length} (${(100 * zm.length / (all.length || 1)).toFixed(1)} %)` +
  `  ·  |ic| médian ${(() => { const v = zm.map((s) => Math.abs(s.intradayChange)).sort((a, b) => a - b);
     return v.length ? v[v.length >> 1].toFixed(3) : "—"; })()} %`);
const parActif = new Map();
for (const s of zm) parActif.set(s.asset, (parActif.get(s.asset) ?? 0) + 1);
console.log(`  répartition : ` + [...parActif.entries()].sort((a, b) => b[1] - a[1])
  .map(([a, n]) => `${a} ${n}`).join(" · "));

// ── COMPOSITION PAR CÔTÉ — la prédiction n°2 se lit ICI ───────────────────────────────────────
console.log(`\n── COMPOSITION DE CHAQUE CÔTÉ (prédiction n°2 : le BUY serait surtout du PLB déguisé) ──`);
for (const side of ["BUY", "SELL"]) {
  const t = all.filter((s) => s.side === side);
  const p = (c) => `${(100 * t.filter((s) => s.cls === c).length / (t.length || 1)).toFixed(1)} %`;
  console.log(`  ${side.padEnd(5)} ${String(t.length).padStart(4)} tirs  ·  EXH vrai ${p("EXH_VRAI").padStart(7)}` +
    `  ·  PLB déguisé ${p("PLB_DEGUISE").padStart(7)}  ·  zone morte ${p("ZONE_MORTE").padStart(7)}`);
}
