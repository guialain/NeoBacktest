// SLOPE_CONFIG tient-elle encore, et sur QUELLE population ? (owner 2026-08-02)
// ⚠ Le fichier dit : « calibration P40/P60 (flat) — P20/P80 (weak) — P97 (strong/extreme),
//   données réelles H1, 12 mois (~6043 barres), recalibré le 2026-03-18 ».
//   6043 barres ≈ 12 mois de CLÔTURES H1. Or le moteur lirait `slope_h1_s0`, échantillonné toutes
//   les 2 min. Deux populations différentes sous les mêmes bornes — le défaut exact de l'ADX
//   (calibré H1, lu M15) et du tickflow (percentiles de ticks, appliqués à une moyenne de 5).
import fs from "fs";
import { SLOPE_CONFIG, getSlopeConfig } from "../../Matrix-Revolution/src/components/robot/engines/config/SlopeConfig.js";
const DIR = "data/matrix";
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null;

const rows = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const sym = f.replace(/\.csv$/i, "");
  const L = fs.readFileSync(`${DIR}/${f}`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const live = [], parH = new Map();
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const d = new Date(c[I.ts_utc]); const js = d.getUTCDay(); if (js === 0 || js === 6) continue;
    const s0 = num(c[I.slope_h1_s0]), s1 = num(c[I.slope_h1]);
    if (s0 !== null) live.push(s0);
    if (s1 !== null) parH.set(c[I.ts_utc].slice(0, 13), s1);      // 1 valeur par heure = la clôture
  }
  const clos = [...parH.values()].sort((a, b) => a - b); live.sort((a, b) => a - b);
  const cfg = getSlopeConfig(sym), propre = !!SLOPE_CONFIG[sym];
  rows.push({ sym, propre, nC: clos.length, nL: live.length,
    dec: [cfg.flat.max, cfg.up_weak.max, cfg.up_strong.max],
    mesC: [q(clos, .60), q(clos, .80), q(clos, .97)],
    mesL: [q(live, .60), q(live, .80), q(live, .97)] });
}
const F = (v) => (v == null ? "  —  " : v.toFixed(2).padStart(6));
console.log(`${"actif".padEnd(12)}${"P60".padStart(7)}${"P80".padStart(7)}${"P97".padStart(7)}   `
          + `${"P60".padStart(7)}${"P80".padStart(7)}${"P97".padStart(7)}   `
          + `${"P60".padStart(7)}${"P80".padStart(7)}${"P97".padStart(7)}`);
console.log(`${"".padEnd(12)}${"--- DÉCLARÉ (18/03) ---".padStart(21)}   ${"--- clôtures H1 ---".padStart(21)}   ${"--- live 2 min ---".padStart(21)}`);
for (const r of rows.sort((a, b) => a.sym.localeCompare(b.sym))) {
  console.log(`${(r.sym + (r.propre ? "" : "*")).padEnd(12)}${r.dec.map(F).join(" ")}   ${r.mesC.map(F).join(" ")}   ${r.mesL.map(F).join(" ")}`);
}
console.log(`\n* = pas de bloc propre dans SLOPE_CONFIG, retombe sur \`default\``);
const dC = rows.map(r => r.mesC[2] / r.dec[2]), dL = rows.map(r => r.mesL[2] / r.dec[2]);
const moy = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`\nP97 mesuré / P97 déclaré :  clôtures ×${moy(dC).toFixed(2)}   ·   live ×${moy(dL).toFixed(2)}`);
