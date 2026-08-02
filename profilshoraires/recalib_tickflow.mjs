// recalib_tickflow.mjs — RECALIBRAGE DES BASELINES TICKFLOW SUR LES DONNÉES ACTUELLES
//
// Cible : REGIME_BASELINE_TICKFLOW_MEANT5 (percentiles de `computeMeanTick5s` = mean s0..s4).
//   Valeurs en place : calibrées sur **6 jours de mai 2026**, 8-20h UTC (cf. en-tête TickFlowConfig).
//   Ici : matrice courante, mêmes conventions d'heures pour que les deux soient comparables.
//
// ⚠⚠ CETTE CONSTANTE EST ORPHELINE — vérifié le 02/08 : aucun lecteur dans Matrix-Revolution ni
//   Neo-Backtest, et le `classifyDim` cité par son en-tête n'existe nulle part. La recalibrer ne
//   change RIEN au moteur. Ce qui est câblé, c'est TICKFLOW_CONFIG (11 fichiers, dont
//   AssetEligibility / RobotCore / PreFilterVolRegime) — intact ici.
//
// ⭐ CONTRÔLE JOINT, celui-là touche au LIVE : `classifyTickflow(meanTick5s, tf5)` compare une
//   MOYENNE DE 5 à des percentiles calculés sur des ticks_5s INDIVIDUELS (l'en-tête de
//   TICKFLOW_CONFIG le dit lui-même). Une moyenne de 5 a la même espérance mais une variance ~5×
//   plus faible : ses queues sont bien plus courtes. Si les deux distributions divergent, les bandes
//   DEAD et BURST du live sont sous-peuplées et les bandes centrales sur-peuplées. On mesure.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { computeMeanTick5s, REGIME_BASELINE_TICKFLOW_MEANT5, getTickFlowConfig }
  from "../../Matrix-Revolution/src/config/TickFlowConfig.js";

const DIR = "data/matrix";
const OUT = path.dirname(fileURLToPath(import.meta.url));
const H_DEB = 8 * 60, H_FIN = 20 * 60;   // 8-20h UTC — LA CONVENTION DE L'ANCIENNE CALIBRATION
const QS = ["p10", "p15", "p20", "p25", "p30", "p50", "p75", "p95", "p99"];
const QV = [0.10, 0.15, 0.20, 0.25, 0.30, 0.50, 0.75, 0.95, 0.99];
const quant = (tri, p) => tri.length ? tri[Math.min(tri.length - 1, Math.floor(tri.length * p))] : null;
const r1 = (v) => v == null ? null : Math.round(v * 10) / 10;

const assets = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"))
  .map((f) => f.replace(/\.csv$/i, "")).sort();

const res = {};
let jours = new Set();
for (const sym of assets) {
  const L = fs.readFileSync(path.join(DIR, `${sym}.csv`), "utf8").split(/\r?\n/);
  const head = L[0].split(";");
  const iU = head.indexOf("ts_utc");
  const idx = [0, 1, 2, 3, 4].map((k) => head.indexOf(`tick_count_5s_s${k}`));
  const moy = [], indiv = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < head.length) continue;
    const d = new Date(c[iU]); if (Number.isNaN(d.getTime())) continue;
    const jsem = d.getUTCDay(); if (jsem === 0 || jsem === 6) continue;      // week-end = flux gelé
    const min = d.getUTCHours() * 60 + d.getUTCMinutes();
    if (min < H_DEB || min >= H_FIN) continue;
    jours.add(c[iU].slice(0, 10));
    const row = {}; for (let k = 0; k < 5; k++) row[`tick_count_5s_s${k}`] = c[idx[k]];
    const m = computeMeanTick5s(row);                       // ⭐ fonction du MOTEUR, pas une recopie
    if (m != null && Number.isFinite(m)) moy.push(m);
    // série des ticks INDIVIDUELS, pour le contrôle d'échelle (mêmes filtres que computeMeanTick5s)
    for (let k = 0; k < 5; k++) { const v = Number(c[idx[k]]); if (Number.isFinite(v) && v >= 0) indiv.push(v); }
  }
  moy.sort((a, b) => a - b); indiv.sort((a, b) => a - b);
  res[sym] = {
    n: moy.length,
    neuf: Object.fromEntries(QS.map((q, i) => [q, r1(quant(moy, QV[i]))])),
    indiv: Object.fromEntries(QS.map((q, i) => [q, r1(quant(indiv, QV[i]))])),
    ancien: REGIME_BASELINE_TICKFLOW_MEANT5[sym] ?? null,
    tf5: getTickFlowConfig(sym)?.tf_5s ?? null,
  };
}
const lj = [...jours].sort();
console.log(`Fenêtre : ${lj[0]} → ${lj[lj.length - 1]} · ${lj.length} jours ouvrés · 08:00-20:00 UTC`);
console.log(`(l'ancienne baseline : 6 jours de mai 2026, mêmes heures)\n`);

// ── 1. ANCIEN vs NEUF ─────────────────────────────────────────────────────────────────────────
console.log(`=== REGIME_BASELINE_TICKFLOW_MEANT5 — ancien → neuf (× = facteur sur p75) ===`);
console.log(`${"actif".padEnd(12)}${"n".padStart(7)}   ${QS.map((q) => (q + " anc→neuf").padStart(16)).join("")}   ×p75`);
const lignes = [];
for (const sym of assets) {
  const r = res[sym]; const a = r.ancien;
  const cells = QS.map((q) => `${a ? a[q] : "—"}→${r.neuf[q]}`.padStart(16)).join("");
  const fac = (a && a.p75 > 0 && r.neuf.p75 != null) ? (r.neuf.p75 / a.p75) : null;
  console.log(`${sym.padEnd(12)}${String(r.n).padStart(7)}   ${cells}   ${fac ? fac.toFixed(2) + "×" : "—"}`);
  lignes.push({ sym, ...r, fac });
}

// ── 2. LE CONTRÔLE QUI TOUCHE AU LIVE ─────────────────────────────────────────────────────────
console.log(`\n=== ⭐ MOYENNE-DE-5 vs TICKS INDIVIDUELS — les percentiles que lit classifyTickflow ===`);
console.log(`${"actif".padEnd(12)}${"p25 moy / indiv / TICKFLOW_CONFIG".padStart(34)}${"p95 moy / indiv / CONFIG".padStart(32)}`);
for (const sym of assets) {
  const r = res[sym], t = r.tf5;
  console.log(`${sym.padEnd(12)}`
    + `${`${r.neuf.p25} / ${r.indiv.p25} / ${t?.p25 ?? "—"}`.padStart(34)}`
    + `${`${r.neuf.p95} / ${r.indiv.p95} / ${t?.p95 ?? "—"}`.padStart(32)}`);
}

// ── 3. BLOC PRÊT À COLLER ─────────────────────────────────────────────────────────────────────
const bloc = [
  `// Recalibré ${new Date(lj[lj.length - 1]).toISOString().slice(0, 10)} sur data/matrix — ${lj.length} jours ouvrés`,
  `// (${lj[0]} → ${lj[lj.length - 1]}), 08:00-20:00 UTC, week-ends exclus, ~${Math.round(
    assets.reduce((a, s) => a + res[s].n, 0) / assets.length / 100) * 100} échantillons/symbole.`,
  `// Remplace la calibration du 2026-06-05 (6 jours de mai). Quantité inchangée : computeMeanTick5s.`,
  `export const REGIME_BASELINE_TICKFLOW_MEANT5 = {`,
  // ⚠ virgules OBLIGATOIRES et alignement sur 5 caractères : ce bloc est destiné à REMPLACER la
  //   constante dans TickFlowConfig.js, il doit être du JS valide tel quel.
  ...assets.map((s) => {
    const n = res[s].neuf;
    const cell = (k) => `${k}: ${(n[k].toFixed(1) + ",").padEnd(6)}`;
    return `  ${(s + ":").padEnd(12)}{ ${QS.map(cell).join("")}},`.replace(/,\s*}$/, " },");
  }),
  `};`,
].join("\n");
fs.writeFileSync(path.join(OUT, "tickflow_baseline_recalibree.js"), bloc + "\n", "utf8");

const csv = [`Actif;n;${QS.map((q) => `${q}_ancien`).join(";")};${QS.map((q) => `${q}_neuf`).join(";")};${QS.map((q) => `${q}_indiv`).join(";")}`];
for (const s of assets) {
  const r = res[s];
  csv.push(`${s};${r.n};${QS.map((q) => r.ancien ? String(r.ancien[q]).replace(".", ",") : "").join(";")};`
    + `${QS.map((q) => String(r.neuf[q]).replace(".", ",")).join(";")};`
    + `${QS.map((q) => String(r.indiv[q]).replace(".", ",")).join(";")}`);
}
fs.writeFileSync(path.join(OUT, "tickflow_baseline_recalibree.csv"), csv.join("\r\n") + "\r\n", "utf8");
console.log(`\nÉcrit : tickflow_baseline_recalibree.js (bloc à coller) · .csv (ancien | neuf | individuels)`);
