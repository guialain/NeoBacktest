// _ecart_distribution.mjs — OÙ TOMBERAIENT LES BARREAUX SI ON PASSAIT DE z À Ecart ?
//
//   Ecart = z_s0 × sigma_h1 / (ATRConfig(sym,"H1").p50 / 100000 × price)
//
// Trois questions, dans l'ordre où elles peuvent tuer l'idée :
//   1. Les barreaux ÉQUIVALENTS — quelle valeur d'Ecart reproduit la population de chaque barreau
//      de z (0,30 / 1,05 / 1,55 / 2,15 / 2,60) ? C'est la migration à population constante.
//   2. 🔴 LA QUESTION QUI DÉCIDE — Ecart peut-il garder une grille UNIVERSELLE comme z ?
//      z est uniforme entre actifs PAR CONSTRUCTION (c'est un z-score). Ecart ne l'est pas
//      forcément : sa dispersion inter-actifs = celle de `sigma / ATR_P50`. Si elle est large,
//      il faudra des barreaux par actif — ce qui est interdit (no_per_asset_logic_universal).
//   3. Combien de barres CHANGENT de barreau ? Si c'est ~0, la métrique ne re-trie rien et tout ce
//      travail est cosmétique.
//
// ⚠ Le niveau Ecart n'utilise que des valeurs LIVE (z_s0, sigma, price) : il n'est PAS touché par
//   le défaut d'ancre mobile qui atteint Δz dans 22 % des heures. Seul le DELTA l'est.
import fs from "fs";
import { getATRConfig } from "../../Matrix-Revolution/src/components/robot/engines/config/ATRConfig.js";

const DIR = "data/matrix";
const Z_BANDS = [0.30, 1.05, 1.55, 2.15, 2.60];
const NOMS = ["NO_TENSION", "SLACK", "TENSE", "TENSE_HIGH", "EXTREME", "SNAPPED"];
const QS = [0.50, 0.70, 0.80, 0.90, 0.95, 0.99];
const q = (t, p) => t.length ? t[Math.min(t.length - 1, Math.floor(t.length * p))] : null;

const assets = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"))
  .map((f) => f.replace(/\.csv$/i, "")).sort();

const data = {};
for (const sym of assets) {
  const p50 = getATRConfig(sym, "H1")?.p50; if (!p50) { console.log(`${sym}: pas d'ATRConfig H1`); continue; }
  const L = fs.readFileSync(`${DIR}/${sym}.csv`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const az = [], ae = [], paires = [];
  let prev = null;
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const d = new Date(c[I.ts_utc]); if (Number.isNaN(d.getTime())) continue;
    const js = d.getUTCDay(); if (js === 0 || js === 6) continue;
    const z = +c[I.zscore_h1_s0], s = +c[I.sigma_h1], p = +c[I.price];
    if (![z, s, p].every(Number.isFinite) || !(s > 0) || !(p > 0)) continue;
    // ⚠ dédoublonnage du flux gelé : une valeur répétée à l'identique n'est pas une observation
    const cle = `${z}|${s}|${p}`; if (cle === prev) continue; prev = cle;
    const e = z * s / (p50 / 100000 * p);
    az.push(Math.abs(z)); ae.push(Math.abs(e)); paires.push([Math.abs(z), Math.abs(e)]);
  }
  az.sort((a, b) => a - b); ae.sort((a, b) => a - b);
  data[sym] = { az, ae, paires, p50 };
}

// ── 1. LES BARREAUX ÉQUIVALENTS, À POPULATION CONSTANTE ───────────────────────────────────────
console.log(`=== 1. BARREAUX ÉQUIVALENTS — la valeur d'|Ecart| qui garde la même population que chaque |z| ===`);
console.log(`${"actif".padEnd(12)}${Z_BANDS.map((b) => `|z|=${b}`.padStart(11)).join("")}`);
const equiv = {};
for (const sym of assets) {
  const { az, ae } = data[sym]; if (!az?.length) continue;
  const l = Z_BANDS.map((b) => {
    const part = az.filter((v) => v < b).length / az.length;   // population sous le barreau
    return q(ae, part);
  });
  equiv[sym] = l;
  console.log(`${sym.padEnd(12)}${l.map((v) => v.toFixed(2).padStart(11)).join("")}`);
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const univ = Z_BANDS.map((_, i) => med(assets.filter((s) => equiv[s]).map((s) => equiv[s][i])));
console.log(`${"MÉDIANE".padEnd(12)}${univ.map((v) => v.toFixed(2).padStart(11)).join("")}   ⬅ grille universelle candidate`);

// ── 2. UNIVERSALITÉ : qui est le plus uniforme entre actifs ? ─────────────────────────────────
console.log(`\n=== 2. 🔴 UNIVERSALITÉ — dispersion des percentiles ENTRE ACTIFS (min → max, et ratio) ===`);
console.log(`${"quantile".padEnd(10)}${"|z|  min→max".padStart(24)}${"ratio".padStart(8)}   ${"|Ecart|  min→max".padStart(24)}${"ratio".padStart(8)}`);
for (const p of QS) {
  const vz = assets.filter((s) => data[s]?.az.length).map((s) => q(data[s].az, p));
  const ve = assets.filter((s) => data[s]?.ae.length).map((s) => q(data[s].ae, p));
  const f = (a) => `${Math.min(...a).toFixed(2)} → ${Math.max(...a).toFixed(2)}`;
  console.log(`p${String(Math.round(p * 100)).padEnd(9)}${f(vz).padStart(24)}${(Math.max(...vz) / Math.min(...vz)).toFixed(2).padStart(8)}   `
    + `${f(ve).padStart(24)}${(Math.max(...ve) / Math.min(...ve)).toFixed(2).padStart(8)}`);
}

// ── 3. COMBIEN DE BARRES CHANGENT DE BARREAU ? ────────────────────────────────────────────────
const bandOf = (v, bands) => { for (let i = 0; i < bands.length; i++) if (v < bands[i]) return i; return bands.length; };
console.log(`\n=== 3. RE-TRI — part des barres qui changent de barreau (grille universelle en Ecart) ===`);
let gTot = 0, gCh = 0;
const flux = {};
for (const sym of assets) {
  const P = data[sym]?.paires; if (!P?.length) continue;
  let ch = 0;
  for (const [z, e] of P) {
    const a = bandOf(z, Z_BANDS), b = bandOf(e, univ);
    if (a !== b) { ch++; flux[`${NOMS[a]} → ${NOMS[b]}`] = (flux[`${NOMS[a]} → ${NOMS[b]}`] ?? 0) + 1; }
  }
  gTot += P.length; gCh += ch;
  console.log(`${sym.padEnd(12)}${(100 * ch / P.length).toFixed(1).padStart(6)} %   (n=${P.length})`);
}
console.log(`${"UNIVERS".padEnd(12)}${(100 * gCh / gTot).toFixed(1).padStart(6)} %   (n=${gTot})`);
console.log(`\n-- les dix migrations les plus fréquentes --`);
for (const [k, v] of Object.entries(flux).sort((a, b) => b[1] - a[1]).slice(0, 10))
  console.log(`  ${k.padEnd(34)} ${String(v).padStart(7)}  (${(100 * v / gTot).toFixed(2)} % de l'univers)`);
