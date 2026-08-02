// Que vaut réellement `dslope_h1`, et que vaudrait `dslope_h1_s0` ? (owner 2026-08-02)
// ⚠ server.js calcule `dslope_h1_s0 = slope_h1_s0 − slope_h1` (LIVE − CLÔTURE).
//   MatrixEngine:57 ALIASE `dslope_h1` dans `dslope_h1_s0` si celui-ci manque.
//   Si le CSV n'a que `dslope_h1`, backtest et live ne lisent PAS la même grandeur sous ce nom.
import fs from "fs";
const DIR = "data/matrix";
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null;

const h0 = fs.readFileSync(`${DIR}/SILVER.csv`, "utf8").split(/\r?\n/)[0].split(";");
console.log(`colonnes dslope_h1     : ${h0.includes("dslope_h1") ? "PRÉSENTE" : "absente"}`);
console.log(`colonnes dslope_h1_s0  : ${h0.includes("dslope_h1_s0") ? "PRÉSENTE" : "ABSENTE  ⇒ MatrixEngine aliasera dslope_h1"}\n`);

const A = [], B = [], C = []; let n = 0, egal = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const L = fs.readFileSync(`${DIR}/${f}`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const parH = new Map();
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const d = new Date(c[I.ts_utc]); const js = d.getUTCDay(); if (js === 0 || js === 6) continue;
    const dsl = num(c[I.dslope_h1]), s0 = num(c[I.slope_h1_s0]), s1 = num(c[I.slope_h1]);
    if (dsl === null || s0 === null || s1 === null) continue;
    n++;
    A.push(dsl);                       // ce que l'EA exporte
    B.push(s0 - s1);                   // ce que server.js calcule en live
    if (Math.abs(dsl - (s0 - s1)) < 1e-9) egal++;
    parH.set(c[I.ts_utc].slice(0, 13), { t: d.getTime(), s1 });
  }
  // clôture → clôture, l'hypothèse la plus probable pour `dslope_h1`
  const cl = [...parH.values()].sort((a, b) => a.t - b.t);
  for (let i = 1; i < cl.length; i++) if (cl[i].t - cl[i-1].t === 3600000) C.push(cl[i].s1 - cl[i-1].s1);
}
const st = (a, nom) => { a.sort((x, y) => x - y);
  console.log(`${nom.padEnd(34)} n=${String(a.length).padStart(7)}  p3 ${q(a,.03).toFixed(2).padStart(7)}  p25 ${q(a,.25).toFixed(2).padStart(6)}`
    + `  p50 ${q(a,.50).toFixed(2).padStart(6)}  p75 ${q(a,.75).toFixed(2).padStart(6)}  p97 ${q(a,.97).toFixed(2).padStart(6)}`); };
console.log(`\`dslope_h1\` == \`s0 − s1\` sur ${egal}/${n} lignes  (${(egal/n*100).toFixed(1)} %)\n`);
st(A, "A · dslope_h1 (colonne EA)");
st(B, "B · slope_h1_s0 − slope_h1 (live)");
st(C, "C · slope_h1 clôture → clôture");

const T = { explo: 4.7, acc: 1.5, soft: 0.5 };            // DSLOPE_THRESHOLDS.H1
const part = (a, nom) => { const N = a.length;
  const c = (f) => (a.filter(f).length / N * 100).toFixed(1).padStart(6);
  console.log(`${nom.padEnd(34)} EXPLO ${c(v=>Math.abs(v)>T.explo)}%   ACC ${c(v=>Math.abs(v)>T.acc&&Math.abs(v)<=T.explo)}%`
    + `   SFT ${c(v=>Math.abs(v)>T.soft&&Math.abs(v)<=T.acc)}%   FLAT ${c(v=>Math.abs(v)<=T.soft)}%`); };
console.log(`\n=== lues par DSLOPE_THRESHOLDS.H1 (explo 4,7 · acc 1,5 · soft 0,5) ===`);
part(A, "A · dslope_h1"); part(B, "B · live − clôture"); part(C, "C · clôture → clôture");
