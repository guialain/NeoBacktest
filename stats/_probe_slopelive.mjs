// La dérivée LIVE de la pente grandit-elle avec le NIVEAU de pente ? (owner 2026-08-02)
// ⚠ C'est la question qui décide de la STRUCTURE des coupures. Si |Δ| croît fortement avec le
//   niveau, il faut des coupures par niveau (comme `GAP_DELTA_MEDIAN` pour le ZScore, où |Δz|
//   était ×3,93 de SLACK à SNAPPED). Sinon une seule échelle par actif suffit — moins de
//   paramètres, plus d'observations par coupure.
// d = (slope_h1_s0 − slope_h1) × signe(slope_h1_s0)   ⇒ `_UP` = la pente s'accentue dans son sens.
import fs from "fs";
import { getSlopeClass } from "../../Matrix-Revolution/src/components/robot/engines/config/SlopeConfig.js";
const DIR = "data/matrix";
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const NIV = ["flat", "weak", "strong", "extreme"];
const niv = (c) => c === "flat" ? "flat" : (c.endsWith("_weak") ? "weak" : c.endsWith("_strong") ? "strong" : c.endsWith("_extreme") ? "extreme" : null);

const parA = {};
for (const f of fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const sym = f.replace(/\.csv$/i, "");
  const L = fs.readFileSync(`${DIR}/${f}`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const o = parA[sym] = Object.fromEntries(NIV.map((n) => [n, []]));
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const d = new Date(c[I.ts_utc]); const js = d.getUTCDay(); if (js === 0 || js === 6) continue;
    const s0 = num(c[I.slope_h1_s0]), s1 = num(c[I.slope_h1]);
    if (s0 === null || s1 === null || s0 === 0) continue;
    const n = niv(getSlopeClass(s1, sym)); if (!n) continue;          // ⬅ niveau depuis la CLÔTURE
    o[n].push(Math.abs((s0 - s1) * Math.sign(s0)));
  }
}
const syms = Object.keys(parA).sort();
console.log(`${"actif".padEnd(12)}${NIV.map((n) => n.padStart(10)).join("")}${"×extr/flat".padStart(12)}`);
for (const s of syms) {
  const m = NIV.map((n) => med(parA[s][n]));
  console.log(`${s.padEnd(12)}${m.map((x) => (x == null ? "—" : x.toFixed(3)).padStart(10)).join("")}`
    + `${(m[3] && m[0] ? (m[3] / m[0]).toFixed(2) : "—").padStart(12)}`);
}
console.log(`\n=== dispersion ENTRE ACTIFS, par niveau ===`);
for (const n of NIV) {
  const v = syms.map((s) => med(parA[s][n])).filter((x) => x != null && x > 0);
  console.log(`${n.padEnd(10)} min ${Math.min(...v).toFixed(3)} → max ${Math.max(...v).toFixed(3)}   ratio ${(Math.max(...v)/Math.min(...v)).toFixed(2)}`);
}
console.log(`\n=== effectifs (poolés) ===`);
for (const n of NIV) console.log(`${n.padEnd(10)}${String(syms.reduce((a, s) => a + parA[s][n].length, 0)).padStart(9)}`);
