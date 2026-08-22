// _cont_sell_msm15_bandes.mjs — CONT SELL : `meanSlope M15` decompose WEAK/STRONG/EXTREME x `%K M15`.
//
// ⚠ IL N EXISTE AUCUNE ECHELLE M15. `MEANSLOPE_ECHELLE` (MeanSlopeConfig.js) a ete calibree sur le
//   H1 SEUL. On la reconstruit ici pour le M15, PAR ACTIF, sur les 12 mois d export M1 -- MEME
//   methode que le H1 : `meanSlope LIVE` a CHAQUE minute (prix = cloture M1 courante), pas a chaque
//   cloture M15. C est ce que lit le moteur.
// ⛔ ON NE CALIBRE PAS SUR LE CARNET : les percentiles viennent de la POPULATION (toutes les barres,
//   24h/24), jamais des tirs -- sinon la bande decrirait la SELECTION et non le marche.
// ⭐ BANDES SUR LE PERCENTILE SIGNE (grille owner du modulateur H1) :
//      p <= 55 FLAT . 55-75 WEAK UP . 75-95 STRONG UP . > 95 EXTREME UP
//   /!\ `ms > 0` et `p > 55` NE SONT PAS LA MEME POPULATION : la mediane d un actif n est pas 0.
//      La table precedente lisait le SIGNE, celle-ci lit le PERCENTILE. Les totaux vont differer,
//      et c est normal -- ce n est pas une incoherence.
// ⚠ WR par GRAPPE (actif|jour). Point mort 75,0 %.
//   usage : node --max-old-space-size=8192 stats/_cont_sell_msm15_bandes.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/";
const { getATRConfig } = await import(R + "ATRConfig.js");
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const M1DIR = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/MeanSlopeRaw";
const Q = 15 * 60000;
const pct = (a, q) => { const i = (a.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo); };
let all = []; const MS = new Map(); const CUTS = new Map();
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const p50 = getATRConfig(a, "H1")?.p50;
  const pm1 = path.join(M1DIR, a + "_M1.csv");
  const clo = new Map(); const echant = [];
  if (fs.existsSync(pm1) && p50 > 0) {
    const txt = fs.readFileSync(pm1, "utf8");
    let i0 = txt.indexOf("\n") + 1; let buck = [];
    while (i0 > 0 && i0 < txt.length) {
      const j = txt.indexOf("\n", i0);
      const l = txt.slice(i0, j < 0 ? txt.length : j); i0 = j < 0 ? -1 : j + 1;
      const c1 = l.indexOf(";"); if (c1 < 0) continue;
      const c2 = l.indexOf(";", c1 + 1); if (c2 < 0) continue;
      const c3 = l.indexOf(";", c2 + 1); if (c3 < 0) continue;
      const t = Date.parse(l.slice(c1 + 1, c2).replace(" ", "T") + "Z");
      const v = Number(l.slice(c3 + 1));
      if (!Number.isFinite(t) || !Number.isFinite(v) || v <= 0) continue;
      const b = Math.floor(t / Q) * Q;
      // `meanSlope` LIVE a CETTE minute : prix courant contre la cloture M15 d il y a 19 barres
      const i = buck.length - 1;                 // derniere barre M15 CLOTUREE
      if (i >= 19) { const atr = p50 / 100000 * v;
        if (atr > 0) echant.push(((v - clo.get(buck[i - 19])) / 20) / atr); }
      if (!clo.has(b)) buck.push(b);
      clo.set(b, v);                              // la derniere minute du bucket restera
    }
  }
  if (echant.length > 1000) { echant.sort((x, y) => x - y);
    CUTS.set(a, { p55: pct(echant, .55), p75: pct(echant, .75), p95: pct(echant, .95), n: echant.length }); }
  const buckets = [...clo.keys()].sort((x, y) => x - y);
  const pos = new Map(); buckets.forEach((b, i) => pos.set(b, i));
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";");
  const iT = h.indexOf("timestamp"), iP = h.indexOf("price"), iK = h.indexOf("stoch_k_m15_s0");
  if (iT >= 0 && iP >= 0 && iK >= 0 && p50 > 0) for (const l of L.slice(1)) {
    const c = l.split(";");
    const prix = Number(c[iP]), k = Number(c[iK]);
    const t = Date.parse(c[iT].slice(0, 19).replace(/\./g, "-").replace(" ", "T") + "Z");
    if (!Number.isFinite(t) || !Number.isFinite(prix) || prix <= 0) continue;
    const i = pos.get(Math.floor(t / Q) * Q - Q);
    if (i === undefined || i < 19) continue;
    const atr = p50 / 100000 * prix; if (!(atr > 0)) continue;
    MS.set(a + "|" + c[iT], { ms: ((prix - clo.get(buckets[i - 19])) / 20) / atr, k: Number.isFinite(k) ? k : null, a });
  }
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const D = (s) => MS.get(s.asset + "|" + String(s.tsMT ?? ""));
const bande = (s) => { const d = D(s); const c = CUTS.get(s.asset); if (!d || !c) return null;
  if (d.ms > c.p95) return "EXTREME UP"; if (d.ms > c.p75) return "STRONG UP";
  if (d.ms > c.p55) return "WEAK UP"; return "FLAT ou DOWN"; };
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const p = [...g.values()].map((o) => o.w / o.n);
  const m = p.reduce((x, y) => x + y, 0) / p.length;
  const v = p.length > 1 ? p.reduce((x, y) => x + (y - m) ** 2, 0) / (p.length - 1) : null;
  return { gr: p.length, wr: 100 * m, sig: v === null ? null : 100 * Math.sqrt(v / p.length),
           R: t.reduce((x, y) => x + (y.R || 0), 0) }; };
const L2 = (lbl, t, w = 30) => { const s = st(t);
  console.log("  " + lbl.padEnd(w) + String(t.length).padStart(6) + (s ? String(s.gr).padStart(6) : "     0")
    + (s ? (s.wr.toFixed(1) + "%").padStart(9) : "        —")
    + (s && s.sig !== null ? ("±" + s.sig.toFixed(1)).padStart(8) : "       —")
    + (s ? ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9) : "        —")
    + (!s ? "" : s.gr < 20 ? "  ⚠ <20 grap" : s.wr < 75 ? "  🔴" : "")); };
const SELL = all.filter((s) => s.strategy === "CONT" && fini(s) && s.side === "SELL" && bande(s));
const T = st(SELL);
console.log(`\n═══ CONT SELL · bandes de percentile M15 (12 mois, par actif) ═══`);
console.log(`  ${SELL.length} tirs · reference ${T.wr.toFixed(1)} % ±${T.sig.toFixed(1)} · ${(T.R>=0?"+":"")+T.R.toFixed(1)} R · point mort 75,0 %`);
console.log("  " + "bande".padEnd(30) + "tirs".padStart(6) + "grap".padStart(6) + "WR/grap".padStart(9) + "sigma".padStart(8) + "R".padStart(9));
console.log("  " + "─".repeat(68));
const B = ["FLAT ou DOWN", "WEAK UP", "STRONG UP", "EXTREME UP"];
for (const b of B) L2(b, SELL.filter((s) => bande(s) === b));
console.log("  " + "─".repeat(68) + "\n  ⭐ CROISE AVEC %K M15 LIVE\n");
for (const b of B.slice(1)) {
  L2(b + " · %K < 35", SELL.filter((s) => bande(s) === b && D(s).k < 35));
  L2(b + " · %K >= 35", SELL.filter((s) => bande(s) === b && D(s).k >= 35));
}
console.log("\n  Les coupes reconstruites (unites `meanSlope`, echantillon 12 mois) :");
[...CUTS.entries()].sort().forEach(([a, c]) =>
  console.log(`    ${a.padEnd(14)} p55 ${c.p55.toFixed(4).padStart(8)} · p75 ${c.p75.toFixed(4).padStart(8)} · p95 ${c.p95.toFixed(4).padStart(8)}   n=${c.n}`));
console.log("");
