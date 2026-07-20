// ============================================================================================
// kd_gap_percentiles.mjs — EXISTE-T-IL UN PERCENTILE HAUT DE |K−D| AU-DELÀ DUQUEL LE CONT S'ARRÊTE
//   ET L'EXH COMMENCE ? (hypothèse owner 2026-07-20)
// --------------------------------------------------------------------------------------------
// ⚠️ CE QUI CLOCHAIT DANS MA PREMIÈRE MESURE : buckets FIXES (0-5, 5-10, …, 30+) posés à la main.
//   Le bucket haut contenait n=2 barres et n=7 trades ⇒ LA QUEUE N'ÉTAIT PAS TESTÉE, et j'ai
//   conclu « pas d'effet » sur une case vide. ⭐ Découper une variable continue AVANT d'avoir
//   regardé sa distribution, c'est décider où on ne verra rien.
//
// ICI : on lit d'abord la DISTRIBUTION de |K−D| H1, puis on découpe en PERCENTILES (déciles + la
//   queue P95/P99 isolée). Chaque case a donc, par construction, un effectif comparable.
//
// TROIS LECTURES, séparées :
//   A. distribution brute de |K−D|
//   B. P(cross dans les 3 barres H1) par percentile — la divergence annonce-t-elle le retournement ?
//   C. avgR du CONT pris DANS le sens de l'étirement, par percentile — faut-il s'arrêter, et où ?
//
// Usage : node --max-old-space-size=12288 stats/kd_gap_percentiles.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const HOR = 3;

// ── A. DISTRIBUTION + B. PRÉDICTION, sur barres H1 dédupliquées ────────────────────────────────
const gaps = []; const barsँ = [];
const allBars = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const L = fs.readFileSync(path.join(D, f), "utf8").trim().split(/\r?\n/);
  const H = L[0].split(";"); const ix = (n) => H.indexOf(n);
  const seen = new Set(); const bars = [];
  for (const line of L.slice(1)) {
    const r = line.split(";"); const ts = String(r[ix("timestamp")] ?? r[0]); const hk = ts.slice(0, 13);
    if (seen.has(hk)) continue; seen.add(hk);
    const k = num(r[ix("stoch_k_h1_s0")]), d = num(r[ix("stoch_d_h1_s0")]);
    if (k === null || d === null) continue;
    bars.push({ k, d, gap: k - d });
  }
  for (const b of bars) gaps.push(Math.abs(b.gap));
  allBars.push(bars);
}
gaps.sort((a, b) => a - b);
const P = (p) => gaps[Math.floor(gaps.length * p / 100)];
console.log(`A. DISTRIBUTION de |K−D| H1 (n=${gaps.length} barres)`);
for (const p of [50, 75, 90, 95, 97, 99, 99.5]) console.log(`   P${String(p).padEnd(5)} = ${P(p).toFixed(1)}`);
console.log(`   max     = ${gaps[gaps.length - 1].toFixed(1)}`);

const CUTS = [[0, 50], [50, 75], [75, 90], [90, 95], [95, 99], [99, 100]];
const inCut = (v, [a, b]) => v >= P(a) && (b === 100 ? true : v < P(b));
console.log(`\nB. P(cross dans les ${HOR} barres H1 suivantes) par percentile de |K−D|`);
console.log("   percentile   |K−D|          TOUTES barres        dont K<20 ou K>80 (extrême)");
for (const c of CUTS) {
  let n = 0, x = 0, ne = 0, xe = 0;
  for (const bars of allBars) for (let i = 0; i < bars.length - HOR; i++) {
    const b = bars[i]; if (!inCut(Math.abs(b.gap), c)) continue;
    let cr = false;
    for (let j = i + 1; j <= i + HOR; j++) if (Math.sign(bars[j].gap) !== Math.sign(b.gap)) { cr = true; break; }
    n++; if (cr) x++;
    if (b.k < 20 || b.k > 80) { ne++; if (cr) xe++; }
  }
  const rng = `${P(c[0]).toFixed(1)}–${c[1] === 100 ? "max" : P(c[1]).toFixed(1)}`;
  console.log(`   P${String(c[0]).padStart(2)}–P${String(c[1]).padEnd(3)}  ${rng.padEnd(12)}  ${(x / n * 100).toFixed(0)}% / n=${String(n).padStart(4)}      ${ne ? `${(xe / ne * 100).toFixed(0)}% / n=${String(ne).padStart(4)}` : "—"}`);
}

// ── C. RENDEMENT du CONT par percentile ────────────────────────────────────────────────────────
const mk = () => ({ n: 0, w: 0, l: 0, R: 0 });
const bump = (o, s) => { o.n++; o.R += s.R; if (s.outcome === "WIN") o.w++; else if (s.outcome === "LOSS") o.l++; };
const f3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
const wr = (o) => (o.w + o.l) ? (o.w / (o.w + o.l) * 100).toFixed(0) + "%" : "—";
const SIG = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) if (typeof s.R === "number") SIG.push(s);
console.log(`\nC. CONT pris DANS LE SENS DE L'ÉTIREMENT (SELL & K<D, ou BUY & K>D) — avgR / n / WR`);
console.log("   percentile   tous CONT étirés            + zone extrême (K<20 / K>80)");
for (const c of CUTS) {
  const a = mk(), b = mk();
  for (const s of SIG) {
    if (s.type === "EXHAUSTION" || s.kH1 == null || s.kdH1 == null) continue;
    const stretched = (s.side === "SELL" && s.kdH1 < 0) || (s.side === "BUY" && s.kdH1 > 0);
    if (!stretched || !inCut(Math.abs(s.kdH1), c)) continue;
    bump(a, s);
    if ((s.side === "SELL" && s.kH1 < 20) || (s.side === "BUY" && s.kH1 > 80)) bump(b, s);
  }
  const rng = `${P(c[0]).toFixed(1)}–${c[1] === 100 ? "max" : P(c[1]).toFixed(1)}`;
  const fmt = (o) => o.n ? `${f3(o.R / o.n)} / ${String(o.n).padStart(4)} / ${wr(o).padStart(3)}` : "—";
  console.log(`   P${String(c[0]).padStart(2)}–P${String(c[1]).padEnd(3)}  ${rng.padEnd(12)}  ${fmt(a).padEnd(28)} ${fmt(b)}`);
}
