// add_adx_s0.mjs — reconstruit les colonnes LIVE de la famille ADX (owner 2026-07-26).
// --------------------------------------------------------------------------------------------
// POURQUOI : l'EA n'exporte `adx14_*_s0` / `plus_di_*_s0` / `minus_di_*_s0` que depuis le 18/07.
//   Avant, le moteur est aveugle à la bougie EN FORMATION pendant toute sa durée — donc le passage
//   du niveau ADX au live n'est pas mesurable sur 80 % de la fenêtre de backtest.
//
// COMMENT : un `s0` à l'instant T = l'état de l'indicateur après la dernière bougie FERMÉE, plus
//   UN pas de lissage avec la bougie PARTIELLE reconstruite depuis les M1 écoulées.
//
// ⭐🔥 LA FORMULE EST CELLE DE L'« ADX SIMPLE » DE METATRADER (`iADX`), PAS CELLE DE WILDER :
//     DI bruts = 100·DM/TR      → ratio calculé PAR BARRE (et non ratio de sommes lissées)
//     lissage  = EMA α=2/(p+1)  → et non le 1/p de Wilder
//   Vérifié sur 4 321 bougies contre l'export MT5 : erreur MAX 0,005, soit l'arrondi du fichier.
//   ⚠ Se tromper de variante coûte ~8 points d'ADX en moyenne — ce n'est pas un détail.
//
// ⚠ ON NE REMPLIT QUE LES CELLULES VIDES. Les valeurs réelles de l'EA ne sont jamais écrasées :
//   elles servent au contraire de JUGE (cf. la validation ci-dessous).
// ⚠ ÉCRITURE EN STAGING par défaut. `--install` écrit dans data/matrix après backup.
//
// Validation attendue (mesurée sur 4 actifs) : erreur médiane 0,003 · 95 % sous 0,5. La queue
//   restante vient de trous dans les M1. Les minutes 00-05 sont pires (13 % > 0,5) mais c'est la
//   valeur ENREGISTRÉE qui est en retard là, pas la reconstruction — l'EA met ~5 min à basculer.
import fs from "fs";
import path from "path";

const P = 14, ALPHA = 2 / (P + 1);
const MATRIX = "data/matrix";
const OHLC = "data/ohlc";
const STAGING = "data/_staging/adx_s0";
const INSTALL = process.argv.includes("--install");

// ⚠ JAMAIS `Number(v)` seul : `Number("") === 0` et 0 est fini. Un capteur absent lu 0 a déjà
//   coûté deux bugs majeurs à ce projet (cf. num_empty_string_zero_bug).
const num = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

// Clé de bougie pour un TF donné : 'YYYY.MM.DD HH:MM' arrondi au début de la bougie.
const barKey = (ts, minutes) => {
  const d = ts.slice(0, 11);                       // 'YYYY.MM.DD '
  const hh = ts.slice(11, 13), mm = +ts.slice(14, 16);
  return minutes >= 60 ? `${d}${hh}:00` : `${d}${hh}:${String(Math.floor(mm / minutes) * minutes).padStart(2, "0")}`;
};

// Un pas de l'ADX simple : rend le nouvel état {pdi, mdi, adx} depuis l'état précédent et la barre.
function step(prev, cur) {
  let up = cur.h - prev.h, dn = prev.l - cur.l;
  if (up < 0) up = 0; if (dn < 0) dn = 0;
  if (up > dn) dn = 0; else if (up < dn) up = 0; else { up = 0; dn = 0; }
  const tr = Math.max(Math.abs(cur.h - cur.l), Math.abs(cur.h - prev.c), Math.abs(cur.l - prev.c));
  const rp = tr ? 100 * up / tr : 0, rm = tr ? 100 * dn / tr : 0;
  const pdi = prev.pdi + (rp - prev.pdi) * ALPHA;
  const mdi = prev.mdi + (rm - prev.mdi) * ALPHA;
  const s = pdi + mdi, dx = s ? 100 * Math.abs(pdi - mdi) / s : 0;
  return { pdi, mdi, adx: prev.adx + (dx - prev.adx) * ALPHA };
}

// Depuis les M1 : bougies fermées + état après chacune + cumul partiel minute par minute.
function buildTf(m1, minutes) {
  const bars = new Map(), partial = new Map();
  for (const m of m1) {
    const k = barKey(m.t, minutes);
    const b = bars.get(k);
    if (!b) bars.set(k, { t: k, h: m.hi, l: m.lo, c: m.c });
    else { b.h = Math.max(b.h, m.hi); b.l = Math.min(b.l, m.lo); b.c = m.c; }
    const p = partial.get(k);
    if (!p) partial.set(k, [{ t: m.t, h: m.hi, l: m.lo, c: m.c }]);
    else { const q = p[p.length - 1]; p.push({ t: m.t, h: Math.max(q.h, m.hi), l: Math.min(q.l, m.lo), c: m.c }); }
  }
  const S = [...bars.values()].sort((a, b) => (a.t < b.t ? -1 : 1));
  const state = new Map(); const idx = new Map(S.map((b, i) => [b.t, i]));
  let st = null;
  for (let i = 1; i < S.length; i++) {
    const prev = st ? { ...S[i - 1], ...st } : { ...S[i - 1], pdi: 0, mdi: 0, adx: 0 };
    st = step(prev, S[i]);
    state.set(S[i].t, { ...st, h: S[i].h, l: S[i].l, c: S[i].c });
  }
  return { S, idx, state, partial };
}

// s0 à l'instant `ts` : état après la bougie précédente + un pas avec la partielle courante.
function liveAt(B, ts, minutes) {
  const k = barKey(ts, minutes);
  const i = B.idx.get(k); if (i == null || i < 1) return null;
  const prev = B.state.get(B.S[i - 1].t); if (!prev) return null;
  const arr = B.partial.get(k); if (!arr) return null;
  const mk = ts.slice(0, 16);
  let pb = null; for (const x of arr) { if (x.t <= mk) pb = x; else break; }
  if (!pb) return null;
  return step(prev, pb);
}

const COLS = [
  { tf: "h1", minutes: 60, adx: "adx14_h1_s0", pdi: "plus_di_h1_s0", mdi: "minus_di_h1_s0" },
  { tf: "m15", minutes: 15, adx: "adx14_m15_s0", pdi: "plus_di_m15_s0", mdi: "minus_di_m15_s0" },
];

fs.mkdirSync(STAGING, { recursive: true });
const assets = fs.readdirSync(MATRIX).filter((f) => f.endsWith(".csv")).map((f) => f.slice(0, -4));
const report = [];

for (const sym of assets) {
  const ohlcPath = path.join(OHLC, `ohlc_${sym}_M1.csv`);
  if (!fs.existsSync(ohlcPath)) { console.log(`SKIP ${sym} : pas de M1`); continue; }

  const m1 = [];
  for (const l of fs.readFileSync(ohlcPath, "utf8").split("\n").slice(1)) {
    const p = l.split(";"); if (p.length < 5) continue;
    const t = p[0].trim(); if (!t) continue;
    const hi = num(p[2]), lo = num(p[3]), c = num(p[4]);
    if (hi == null || lo == null || c == null) continue;
    m1.push({ t, hi, lo, c });
  }
  m1.sort((a, b) => (a.t < b.t ? -1 : 1));
  const B = { h1: buildTf(m1, 60), m15: buildTf(m1, 15) };

  const raw = fs.readFileSync(path.join(MATRIX, `${sym}.csv`), "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);
  const H = lines[0].split(";");
  const ix = (n) => H.indexOf(n);
  const tsIx = ix("ts_utc");

  const stats = { filled: 0, cmp: 0, err: [] };
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const g = lines[i].split(";");
    const ts = g[tsIx]; if (!ts) continue;
    // ts_utc = '2026-07-23T14:05:00Z' -> '2026.07.23 14:05' (format des M1)
    const mt = `${ts.slice(0, 10).replace(/-/g, ".")} ${ts.slice(11, 16)}`;
    let touched = false;
    for (const c of COLS) {
      const ia = ix(c.adx), ip = ix(c.pdi), im = ix(c.mdi);
      if (ia < 0) continue;
      const real = num(g[ia]);
      const live = liveAt(B[c.tf], mt, c.minutes);
      if (!live) continue;
      if (real != null) { stats.cmp++; stats.err.push(Math.abs(live.adx - real)); continue; }  // JUGE, on n'écrase pas
      g[ia] = live.adx.toFixed(2);
      if (ip >= 0 && num(g[ip]) == null) g[ip] = live.pdi.toFixed(2);
      if (im >= 0 && num(g[im]) == null) g[im] = live.mdi.toFixed(2);
      stats.filled++; touched = true;
    }
    if (touched) lines[i] = g.join(";");
  }

  fs.writeFileSync(path.join(STAGING, `${sym}.csv`), lines.join(eol), "utf8");
  const e = stats.err.sort((a, b) => a - b);
  const q = (f) => (e.length ? e[Math.floor(f * (e.length - 1))] : NaN);
  report.push({ sym, filled: stats.filled, cmp: stats.cmp, med: q(0.5), p95: q(0.95),
    ok: e.length ? e.filter((x) => x < 0.5).length / e.length : null });
  console.log(`${sym.padEnd(12)} rempli ${String(stats.filled).padStart(6)}   jugé sur ${String(stats.cmp).padStart(6)}` +
    `   médiane ${q(0.5).toFixed(3)}   p95 ${q(0.95).toFixed(3)}   <0,5 : ${(report[report.length-1].ok*100).toFixed(1)}%`);
}

// ── VERDICT ────────────────────────────────────────────────────────────────────────────────────
const okAll = report.filter((r) => r.ok != null);
const worst = okAll.slice().sort((a, b) => a.ok - b.ok)[0];
const medAll = okAll.reduce((s, r) => s + r.med, 0) / okAll.length;
console.log(`\nactifs traités ${report.length}   cellules remplies ${report.reduce((s,r)=>s+r.filled,0)}`);
console.log(`médiane d'erreur moyenne ${medAll.toFixed(3)}   pire actif : ${worst.sym} ${(worst.ok*100).toFixed(1)}% sous 0,5`);
// 🔴 GARDE-FOU : on refuse d'installer si la reconstruction ne tient pas face aux valeurs réelles.
if (worst.ok < 0.85) { console.log("\n🔴 REFUS D'INSTALLER — un actif est sous 85 % de points à moins de 0,5."); process.exit(1); }
console.log(`\nstaging écrit dans ${STAGING}`);
if (INSTALL) {
  const bak = `${MATRIX}_pre_s0_${new Date().toISOString().slice(0,10).replace(/-/g,"")}`;
  fs.cpSync(MATRIX, bak, { recursive: true });
  for (const r of report) fs.copyFileSync(path.join(STAGING, `${r.sym}.csv`), path.join(MATRIX, `${r.sym}.csv`));
  console.log(`INSTALLÉ dans ${MATRIX}   (backup : ${bak})`);
} else {
  console.log("relancer avec --install pour installer (backup automatique).");
}
