// _exh_meanslope_alimente.mjs — LE RANG ① FADE-T-IL DES EXTREMES ENCORE ALIMENTES ?
// ============================================================================================
// 🎯 PREREQUIS NOMME : `AUDUSD 2026.07.02 16:03:17`, EXH SELL, conviction 17/46,5 — une belle figure
//   (prix +1,96 ATR, %K au sommet repassant sous son %D, DI+ qui s'effondre) qui PERD. Le seul
//   capteur qui criait sur cette barre est `meanSlope = +0,1413`, bande **EXPLOSIVE_UP** : la
//   MOYENNE elle-meme accelere vers le haut. Or le rang ① ne le lit NULLE PART.
// ⭐⭐⭐ L'HYPOTHESE : `alimentation_de_l_extreme` dit « pas de fade sur un extreme encore ALIMENTE ».
//   `meanSlope` est precisement la mesure de l'alimentation — et il est INDEPENDANT du gap
//   (`meanSlope ↔ |gapAtr|` = +0,031, mesure le 12/08). Le rang ① lit la POSITION, les OSCILLATEURS
//   et la FORCE ; jamais la vitesse du support sur lequel le prix s'appuie.
// ⚠ ORIENTE CONTRE LE FADE : `+` = la moyenne va DANS le sens que ce fade contrarie.
// ⚠ WR PAR GRAPPE actif x jour · point mort 75,0 %.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixBacktest } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const D = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { computeDeviation, DELTA_COLS, DELTA_COL_MIRROR } = await import(D);
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const T = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f), sym = path.basename(f, ".csv").toUpperCase();
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/); const h = L[0].split(";");
  const iT = h.indexOf("timestamp");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); rows.set(c[iT], c); }
  for (const s of (runMatrixBacktest(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || [])) {
    if (s.strategy !== "EXH" || typeof s.R !== "number") continue;
    const c = rows.get(s.tsMT); if (!c) continue;
    const d = computeDeviation(Object.fromEntries(h.map((k, i) => [k, c[i]])), sym, "h1");
    if (!d?.meanSlopeBand) continue;
    // ⭐ ORIENTE : pour un SELL, une moyenne qui MONTE va contre le fade. Pour un BUY, l'inverse.
    T.push({ ...s, asset: sym, band: s.side === "SELL" ? d.meanSlopeBand : DELTA_COL_MIRROR[d.meanSlopeBand] });
  }
  rows.clear();
}
const jour = (s) => String(s.tsMT || "").slice(0, 10);
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wr: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const cel = (v) => v ? String(v.n).padStart(6) + String(v.gr).padStart(5) + v.wr.toFixed(1).padStart(7) + "%" + ((v.R >= 0 ? "+" : "") + v.R.toFixed(1)).padStart(8) : "     —    —      —       —";
console.log(`\n══ RANG ① · la PENTE DE LA MOYENNE, orientee CONTRE le fade (${T.length} tirs) ══`);
console.log(`   \u26a0 le rang ① ne lit ce capteur NULLE PART. On mesure ce qu'il ignore.\n`);
console.log(`   bande (contre le fade)     tirs grap     WR       R`);
console.log(`   ` + "─".repeat(52));
for (const b of DELTA_COLS) console.log(`   ${b.padEnd(20)}` + cel(st(T.filter((x) => x.band === b))));
console.log(`   ` + "─".repeat(52));
console.log(`   ${"TOUS".padEnd(20)}` + cel(st(T)));
const nourri = st(T.filter((x) => x.band === "FAST_UP" || x.band === "EXPLOSIVE_UP"));
const reste = st(T.filter((x) => x.band !== "FAST_UP" && x.band !== "EXPLOSIVE_UP"));
if (nourri && reste) {
  console.log(`\n   ⇒ extreme ENCORE ALIMENTE (la moyenne accelere contre le fade, FAST+EXPLOSIVE) :`);
  console.log(`        ${nourri.wr.toFixed(1)} % sur ${nourri.gr} grappes · R ${nourri.R.toFixed(1)} · ${nourri.n} tirs (${(100 * nourri.n / T.length).toFixed(1)} % du volume)`);
  console.log(`      contre ${reste.wr.toFixed(1)} % · R ${reste.R.toFixed(1)} ailleurs   ⇒ ecart ${(nourri.wr - reste.wr).toFixed(1)} pts`);
}
console.log(`\n  ⚠ Point mort 75,0 %. ⭐ Un ecart NET ferait de ce capteur un candidat — entree ou veto.\n`);
