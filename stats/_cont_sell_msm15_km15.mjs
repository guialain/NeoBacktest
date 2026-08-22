// _cont_sell_msm15_km15.mjs — CONT SELL x `meanSlope M15` x `%K M15 live < 35`.
//
// 🔴 `meanSlope M15` N'EST PAS DANS LA MATRICE : `computeDeviation` exige `middle_m15_s1`, et la
//   colonne n'existe pas (le scanner ecrit `middle_m15` LIVE ; les jumelles cloturees v8.40/v8.41
//   n'ont couvert que H1 et H4). ⇒ ON LE RECONSTRUIT depuis l'export M1 (12 mois, 22/08), par
//   l'identite VERIFIEE a 3,11e-10 ce matin :
//        middle_s0 − middle_s1 = ( prix_courant − cloture_M15[i−19] ) / 20
//   ⭐ C'est la MEME formule que pour le H1, transposee d'horloge. Aucune 2e implementation de la
//     SMA : on n'a besoin QUE de la cloture M15 vingt barres en arriere.
// ⚠ Les clotures M15 sont derivees du M1 (derniere minute de chaque quart d'heure). Le M1 a des
//   TROUS NORMAUX (pas de bougie sans tick) ⇒ on prend la DERNIERE minute disponible du bucket,
//   jamais une valeur reportee d'un autre bucket.
// ⚠ Normalisation par le MEME `atrP50Price` que le H1 : c'est l'etalon du depot, il ne depend pas
//   du TF. Les deux `meanSlope` sont donc comparables entre eux.
// ⚠ WR par GRAPPE. Point mort 75,0 %.
//   usage : node --max-old-space-size=8192 stats/_cont_sell_msm15_km15.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/";
const { getATRConfig } = await import(R + "ATRConfig.js");
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const M1DIR = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/MeanSlopeRaw";
const Q = 15 * 60000;
let all = [];
const MS = new Map();   // "actif|timestampMatrice" -> { ms, k }
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const p50 = getATRConfig(a, "H1")?.p50;
  // ── ① les clotures M15, derivees du M1 ──
  const pm1 = path.join(M1DIR, a + "_M1.csv");
  const clo = new Map();                       // debut de bucket M15 -> derniere cloture du bucket
  if (fs.existsSync(pm1) && p50 > 0) {
    const txt = fs.readFileSync(pm1, "utf8");
    let i0 = txt.indexOf("\n") + 1;
    while (i0 > 0 && i0 < txt.length) {
      const j = txt.indexOf("\n", i0);
      const l = txt.slice(i0, j < 0 ? txt.length : j); i0 = j < 0 ? -1 : j + 1;
      const c1 = l.indexOf(";"); if (c1 < 0) continue;
      const c2 = l.indexOf(";", c1 + 1); if (c2 < 0) continue;
      const c3 = l.indexOf(";", c2 + 1); if (c3 < 0) continue;
      const t = Date.parse(l.slice(c1 + 1, c2).replace(" ", "T") + "Z");
      const v = Number(l.slice(c3 + 1));
      if (Number.isFinite(t) && Number.isFinite(v) && v > 0) clo.set(Math.floor(t / Q) * Q, v);
    }
  }
  const buckets = [...clo.keys()].sort((x, y) => x - y);
  const pos = new Map(); buckets.forEach((b, i) => pos.set(b, i));
  // ── ② la ligne de matrice : prix et %K M15 live ──
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";");
  const iT = h.indexOf("timestamp"), iP = h.indexOf("price"), iK = h.indexOf("stoch_k_m15_s0");
  if (iT >= 0 && iP >= 0 && iK >= 0 && p50 > 0) for (const l of L.slice(1)) {
    const c = l.split(";");
    const prix = Number(c[iP]), k = Number(c[iK]);
    const t = Date.parse(c[iT].slice(0, 19).replace(/\./g, "-").replace(" ", "T") + "Z");
    if (!Number.isFinite(t) || !Number.isFinite(prix) || prix <= 0) continue;
    // la barre M15 EN FORMATION commence a `floor(t)` ; la derniere CLOTUREE est celle d'avant
    const i = pos.get(Math.floor(t / Q) * Q - Q);
    if (i === undefined || i < 19) continue;
    const atr = p50 / 100000 * prix; if (!(atr > 0)) continue;
    MS.set(a + "|" + c[iT], { ms: ((prix - clo.get(buckets[i - 19])) / 20) / atr, k: Number.isFinite(k) ? k : null });
  }
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s));
const D = (s) => MS.get(s.asset + "|" + String(s.tsMT ?? ""));
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const p = [...g.values()].map((o) => o.w / o.n);
  const m = p.reduce((a, b) => a + b, 0) / p.length;
  const v = p.length > 1 ? p.reduce((a, b) => a + (b - m) ** 2, 0) / (p.length - 1) : null;
  return { n: t.length, gr: p.length, wr: 100 * m, sig: v === null ? null : 100 * Math.sqrt(v / p.length),
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const L2 = (lbl, t, w = 34) => { const s = st(t);
  console.log("  " + lbl.padEnd(w) + String(t.length).padStart(7) + (s ? String(s.gr).padStart(6) : "     0")
    + (s ? (s.wr.toFixed(1) + "%").padStart(9) : "        —")
    + (s && s.sig !== null ? ("±" + s.sig.toFixed(1)).padStart(8) : "       —")
    + (s ? ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9) : "        —")
    + (s && s.gr < 20 ? "  ⚠ <20 grap" : (s && s.wr < 75 ? "  🔴" : ""))); };
const SELL = CONT.filter((s) => s.side === "SELL" && D(s) && Number.isFinite(D(s).ms) && Number.isFinite(D(s).k));
const T = st(CONT.filter((s) => s.side === "SELL"));
console.log(`\n═══ CONT SELL · meanSlope M15 x %K M15 live ═══`);
console.log(`  ${CONT.filter((s)=>s.side==="SELL").length} tirs SELL · ${SELL.length} avec les deux capteurs reconstruits`);
console.log(`  reference SELL ${T.wr.toFixed(1)} % ±${T.sig.toFixed(1)} · ${(T.R>=0?"+":"")+T.R.toFixed(1)} R · point mort 75,0 %`);
console.log("  " + "population".padEnd(34) + "tirs".padStart(7) + "grap".padStart(6) + "WR/grap".padStart(9) + "sigma".padStart(8) + "R".padStart(9));
console.log("  " + "─".repeat(73));
L2("SELL (avec capteurs)", SELL);
L2("meanSlope M15 UP  (> 0)", SELL.filter((s) => D(s).ms > 0));
L2("meanSlope M15 DOWN (<= 0)", SELL.filter((s) => D(s).ms <= 0));
L2("%K M15 < 35", SELL.filter((s) => D(s).k < 35));
L2("%K M15 >= 35", SELL.filter((s) => D(s).k >= 35));
console.log("  " + "─".repeat(73));
L2("⭐ msM15 UP  ET  %K M15 < 35", SELL.filter((s) => D(s).ms > 0 && D(s).k < 35));
L2("   msM15 UP  ET  %K M15 >= 35", SELL.filter((s) => D(s).ms > 0 && D(s).k >= 35));
L2("   msM15 DOWN ET %K M15 < 35", SELL.filter((s) => D(s).ms <= 0 && D(s).k < 35));
L2("   msM15 DOWN ET %K M15 >= 35", SELL.filter((s) => D(s).ms <= 0 && D(s).k >= 35));
console.log("");
