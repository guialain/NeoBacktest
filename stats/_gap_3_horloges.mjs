// _cont_gap_h1_vs_h4.mjs — LE `gapAtr` H4 EST-IL LISIBLE AVEC LES BARREAUX DU H1 ? (owner 16/08)
//
// 🎯 PREREQUIS NOMME : l'owner veut un `gapH4` au rang ③ et pose que **`gapAtrH4` n'est pas
//   approprie tel quel, le H4 etant deux fois plus lent que le H1** (rapport 1,92x mesure le
//   16/08 sur le `K−D`). Avant de dicter quoi que ce soit, il faut savoir de COMBIEN l'echelle
//   change — sinon on branche un capteur H4 dans un vocabulaire H1.
//
// 🔴🔥⭐⭐⭐ DEUX PERIMAGES SIMULTANES SI ON PASSE `"h4"` A `computeDeviation`, ET ILS SONT DANS LE CODE :
//   ① `atrP50Price` fait `getATRConfig(symbol, "H1")` — l'etalon est **CODE EN DUR** sur H1
//      (`DeviationConfig` L176). Un gap H4 serait donc divise par l'ATR **H1**.
//   ② `gapLevel(gapAtr, symbol)` n'a **AUCUN parametre `tf`** (L272) et ses barreaux sont
//      « calibres sur la population de |zscore_h1| » (L202, textuel).
//   ⇒ On lirait une grandeur H4 avec un etalon H1 dans des bandes H1. C'est **exactement** la faute
//   que le meme fichier nomme a la L116 — « bornes ADX (calibrees H1, lues M15) », six jours perdus.
//
// ⚠ CE QUE CETTE SONDE FAIT, ET RIEN D'AUTRE : elle compare les DEUX distributions et l'occupation
//   des bandes, sur le MEME etalon (l'ATR H1, celui du code) — donc elle mesure l'effet du CAPTEUR,
//   pas celui de l'etalon. Elle ne dicte aucun barreau.
// ⚠ Lignes MORTES exclues (panne broker — cf. `_gel_deux_horloges`), et les transitions comptees sur
//   `ts_utc` avec rupture au-dela de 5 min : une transition se compte sur des lignes CONTIGUES.
//   usage : node stats/_cont_gap_h1_vs_h4.mjs
import fs from "fs"; import path from "path";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { gapLevel, GAP_LEVELS, atrP50Price } = await import(R);

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const TROU = 5, MORT = 5;
const CH = ["timestamp", "ts_utc", "price", "symbol",
            "zscore_h1_s0", "sigma_h1", "zscore_h4_s0", "sigma_h4", "zscore_m15_s0", "sigma_m15"];
const S = {};
for (const tf of ["M15", "H1", "H4"]) S[tf] = { abs: [], bandes: {}, tr: 0, n: 0, hors: 0 };
for (const tf of ["M15", "H1", "H4"]) for (const b of GAP_LEVELS) S[tf].bandes[b] = 0;
let nL = 0, nMort = 0, minutes = 0;

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const ix = {}; for (const n of CH) ix[n] = head.indexOf(n);
  const manq = CH.filter((n) => ix[n] < 0); if (manq.length) throw new Error(`${f} : ${manq.join(", ")}`);
  // ── lignes mortes : `timestamp` fige pendant que `ts_utc` avance ──
  const rows = [];
  for (const l of L.slice(1)) {
    const c = l.split(";"); const u = Date.parse(c[ix.ts_utc]) / 60000;
    if (!Number.isFinite(u)) continue;
    rows.push({ u, T: c[ix.timestamp], sym: c[ix.symbol], p: Number(c[ix.price]),
                z1: Number(c[ix.zscore_h1_s0]), s1: Number(c[ix.sigma_h1]),
                z4: Number(c[ix.zscore_h4_s0]), s4: Number(c[ix.sigma_h4]),
                zm: Number(c[ix.zscore_m15_s0]), sm: Number(c[ix.sigma_m15]) });
  }
  rows.sort((a, b) => a.u - b.u);
  for (let i = 1; i < rows.length; i++) rows[i].mort = rows[i].T === rows[i - 1].T;
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].mort) continue;
    let j = i; while (j < rows.length && rows[j].mort) j++;
    if (j - i >= MORT) for (let k = i; k < j; k++) { rows[k].panne = true; nMort++; }
    i = j - 1;
  }
  const cur = { M15: null, H1: null, H4: null };
  let prev = null;
  for (const r of rows) {
    if (r.panne) { cur.M15 = cur.H1 = cur.H4 = null; prev = null; continue; }
    const rupt = prev != null && r.u - prev > TROU;
    if (rupt) { cur.M15 = cur.H1 = cur.H4 = null; }
    else if (prev != null) minutes += r.u - prev;
    prev = r.u;
    nL++;
    const atr = atrP50Price(r.sym, r.p);
    if (!(atr > 0)) continue;
    for (const [tf, z, s] of [["M15", r.zm, r.sm], ["H1", r.z1, r.s1], ["H4", r.z4, r.s4]]) {
      if (!Number.isFinite(z) || !Number.isFinite(s) || !(s > 0)) continue;
      const g = (z * s) / atr;
      const st = S[tf];
      st.n++; st.abs.push(Math.abs(g));
      const b = gapLevel(g, r.sym);
      if (b == null) { st.hors++; continue; }
      st.bandes[b]++;
      if (cur[tf] != null && cur[tf] !== b) st.tr++;
      cur[tf] = b;
    }
  }
}

const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const pc = (n, t) => (t ? (100 * n / t).toFixed(2) : "0.00") + " %";
console.log(`\n══ \`gapAtr\` H1 CONTRE H4 — MEME ETALON (ATR H1, celui du code) ══`);
console.log(`  ${nL} lignes retenues · ${nMort} lignes MORTES exclues · ${minutes.toFixed(0)} minutes reelles\n`);
console.log(`  ── ① DISTRIBUTION de |gapAtr| ──`);
console.log("  " + "tf".padEnd(6) + ["p25", "p50", "p75", "p90", "p95", "p99", "max"].map((s) => s.padStart(9)).join(""));
for (const tf of ["M15", "H1", "H4"]) {
  const a = S[tf].abs;
  console.log("  " + tf.padEnd(6) + [0.25, 0.50, 0.75, 0.90, 0.95, 0.99].map((p) => q(a, p).toFixed(2).padStart(9)).join("")
    // ⚠ `Math.max(...a)` EXPLOSE sur 420 k valeurs (spread = autant d'arguments, stack overflow).
    //   Piege Node du meme genre que « ne jamais indexer un dataset entier en objets ».
    + a.reduce((x, y) => (y > x ? y : x), -Infinity).toFixed(2).padStart(9));
}
const r50 = q(S.H4.abs, 0.5) / q(S.H1.abs, 0.5), r90 = q(S.H4.abs, 0.9) / q(S.H1.abs, 0.9);
console.log(`  ⭐ RAPPORT H4/H1 : mediane ${r50.toFixed(2)}×  ·  p90 ${r90.toFixed(2)}×`);

console.log(`\n  ── ② OCCUPATION DES BANDES \`gapLevel\` (barreaux calibres sur |zscore_h1|) ──`);
console.log("  " + "bande".padEnd(14) + "M15".padStart(10) + "H1".padStart(10) + "H4".padStart(10));
for (const b of GAP_LEVELS)
  console.log("  " + b.padEnd(14) + pc(S.M15.bandes[b], S.M15.n).padStart(10) + pc(S.H1.bandes[b], S.H1.n).padStart(10) + pc(S.H4.bandes[b], S.H4.n).padStart(10));
console.log("  " + "hors bande".padEnd(14) + pc(S.M15.hors, S.M15.n).padStart(10) + pc(S.H1.hors, S.H1.n).padStart(10) + pc(S.H4.hors, S.H4.n).padStart(10));
const haut = (tf) => ["TENSE_HIGH", "EXTREME", "SNAPPED"].reduce((a, b) => a + S[tf].bandes[b], 0);
console.log(`  ⭐ moitie HAUTE (TENSE_HIGH+EXTREME+SNAPPED) : M15 ${pc(haut("M15"), S.M15.n)}  ·  H1 ${pc(haut("H1"), S.H1.n)}  ·  H4 ${pc(haut("H4"), S.H4.n)}`);

console.log(`\n  ── ③ PERSISTANCE de la bande (transitions / 1 000 min reelles) ──`);
for (const tf of ["M15", "H1", "H4"]) console.log(`  ${tf} : ${(1000 * S[tf].tr / minutes).toFixed(2)}`);
console.log(`  ⭐ RAPPORT H1/H4 : ${((S.H1.tr / S.H4.tr)).toFixed(2)}×`);
console.log(`\n  ⚠ ① et ② mesurent le CAPTEUR a etalon constant. Elles ne disent PAS quels barreaux`);
console.log(`     un \`gapH4\` devrait avoir — elles disent de combien ceux du H1 sont a cote.\n`);
