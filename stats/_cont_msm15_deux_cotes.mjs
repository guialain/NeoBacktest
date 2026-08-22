// _cont_msm15_deux_cotes.mjs — `meanSlope M15` x `%K M15` : LES DEUX COTES, deux reperes.
//
// 🎯 CE QUE CETTE SONDE TRANCHE, ET C EST LE 2e CRIBLE DU DEPOT :
//   la case « SELL x msM15 UP x %K<35 » a rendu 83,0 %. Deux lectures INCOMPATIBLES l expliquent :
//     (a) MECANISME  -- le mouvement court va CONTRE le pari et il est deja rendu => on vend la
//         reprise. Alors le BUY doit aimer le mouvement court vers le BAS. LES DEUX COTES BOUGENT
//         DANS LE MEME SENS une fois ORIENTES.
//     (b) ARTEFACT   -- juillet monte, donc `msM15 UP` marque simplement « le marche monte ». Alors
//         le BUY aime AUSSI `UP`, et en repere oriente LES DEUX COTES S OPPOSENT.
//   *** SEUL LE REPERE ORIENTE SEPARE (a) DE (b). Une table par cote en repere BRUT ne peut pas.
//
// REPERE BRUT    : bandes sur le percentile SIGNE (UP), memes coupes pour les deux cotes.
// REPERE ORIENTE : `CONTRE` = le mouvement M15 va contre le pari (SELL: ms haut / BUY: ms bas), et
//   `RENDU` = l oscillateur a deja efface ce contre-mouvement (SELL: %K<35 / BUY: %K>65).
//   ⭐ Le miroir est pris sur les COUPES (p55/p75/p95 <-> p45/p25/p05), pas sur une negation du
//     signal : la distribution n est pas symetrique, `-ms` n a pas le percentile `100-p`.
// ⛔ Percentiles issus de la POPULATION 12 mois (24h/24), jamais des tirs.
// ⚠ WR par GRAPPE (actif|jour). Point mort 75,0 %.
//   usage : node --max-old-space-size=8192 stats/_cont_msm15_deux_cotes.mjs
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/";
const { getATRConfig } = await import(R + "ATRConfig.js");
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const M1DIR = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/MeanSlopeRaw";
const Q = 15 * 60000;

const pct = (a, q) => {
  const i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo);
};

const all = [];
const MS = new Map();
const CUTS = new Map();

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const p50 = getATRConfig(a, "H1")?.p50;
  const pm1 = path.join(M1DIR, a + "_M1.csv");
  const clo = new Map();
  const ech = [];
  const buck = [];
  if (fs.existsSync(pm1) && p50 > 0) {
    const txt = fs.readFileSync(pm1, "utf8");
    let i0 = txt.indexOf("\n") + 1;
    while (i0 > 0 && i0 < txt.length) {
      const j = txt.indexOf("\n", i0);
      const l = txt.slice(i0, j < 0 ? txt.length : j);
      i0 = j < 0 ? -1 : j + 1;
      const c1 = l.indexOf(";"); if (c1 < 0) continue;
      const c2 = l.indexOf(";", c1 + 1); if (c2 < 0) continue;
      const c3 = l.indexOf(";", c2 + 1); if (c3 < 0) continue;
      const t = Date.parse(l.slice(c1 + 1, c2).replace(" ", "T") + "Z");
      const v = Number(l.slice(c3 + 1));
      if (!Number.isFinite(t) || !Number.isFinite(v) || v <= 0) continue;
      const b = Math.floor(t / Q) * Q;
      const i = buck.length - 1;                    // derniere barre M15 CLOTUREE
      if (i >= 19) {
        const atr = p50 / 100000 * v;
        if (atr > 0) ech.push(((v - clo.get(buck[i - 19])) / 20) / atr);
      }
      if (!clo.has(b)) buck.push(b);
      clo.set(b, v);                                // la derniere minute du bucket restera
    }
  }
  if (ech.length > 1000) {
    ech.sort((x, y) => x - y);
    CUTS.set(a, {
      p05: pct(ech, 0.05), p25: pct(ech, 0.25), p45: pct(ech, 0.45),
      p55: pct(ech, 0.55), p75: pct(ech, 0.75), p95: pct(ech, 0.95),
    });
  }
  const pos = new Map();
  buck.forEach((b, i) => pos.set(b, i));
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";");
  const iT = h.indexOf("timestamp"), iP = h.indexOf("price"), iK = h.indexOf("stoch_k_m15_s0");
  if (iT >= 0 && iP >= 0 && iK >= 0 && p50 > 0) {
    for (const l of L.slice(1)) {
      const c = l.split(";");
      const prix = Number(c[iP]), k = Number(c[iK]);
      const t = Date.parse(c[iT].slice(0, 19).replace(/\./g, "-").replace(" ", "T") + "Z");
      if (!Number.isFinite(t) || !Number.isFinite(prix) || prix <= 0) continue;
      const i = pos.get(Math.floor(t / Q) * Q - Q);
      if (i === undefined || i < 19) continue;
      const atr = p50 / 100000 * prix;
      if (!(atr > 0)) continue;
      MS.set(a + "|" + c[iT], {
        ms: ((prix - clo.get(buck[i - 19])) / 20) / atr,
        k: Number.isFinite(k) ? k : null,
      });
    }
  }
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}

const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const D = (s) => MS.get(s.asset + "|" + String(s.tsMT ?? ""));

const bBrut = (s) => {
  const d = D(s), c = CUTS.get(s.asset);
  if (!d || !c) return null;
  return d.ms > c.p95 ? "EXTREME UP" : d.ms > c.p75 ? "STRONG UP" : d.ms > c.p55 ? "WEAK UP" : "FLAT ou DOWN";
};
// ORIENTE : le mouvement M15 va-t-il CONTRE le pari, et de combien ?
const bOri = (s) => {
  const d = D(s), c = CUTS.get(s.asset);
  if (!d || !c) return null;
  if (s.side === "SELL") return d.ms > c.p95 ? "EXTREME CONTRE" : d.ms > c.p75 ? "STRONG CONTRE" : d.ms > c.p55 ? "WEAK CONTRE" : "NUL ou AVEC";
  return d.ms < c.p05 ? "EXTREME CONTRE" : d.ms < c.p25 ? "STRONG CONTRE" : d.ms < c.p45 ? "WEAK CONTRE" : "NUL ou AVEC";
};
const rendu = (s) => {
  const d = D(s);
  if (!d || !Number.isFinite(d.k)) return null;
  return (s.side === "SELL" ? d.k < 35 : d.k > 65) ? "RENDU" : "PAS RENDU";
};

const st = (t) => {
  if (!t.length) return null;
  const g = new Map();
  for (const x of t) {
    const k = x.asset + "|" + jour(x);
    if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++;
  }
  const p = [...g.values()].map((o) => o.w / o.n);
  const m = p.reduce((x, y) => x + y, 0) / p.length;
  const v = p.length > 1 ? p.reduce((x, y) => x + (y - m) ** 2, 0) / (p.length - 1) : null;
  return {
    gr: p.length, wr: 100 * m, R: t.reduce((x, y) => x + (y.R || 0), 0),
    sig: v === null ? null : 100 * Math.sqrt(v / p.length),
  };
};
const cel = (t) => {
  const s = st(t);
  if (!s) return "     0    —       —       ";
  return String(t.length).padStart(6) + String(s.gr).padStart(5)
    + (s.wr.toFixed(1) + "%").padStart(8) + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8)
    + (s.gr < 20 ? " ⚠ " : s.wr < 75 ? " 🔴" : "   ");
};

const CONT = all.filter((s) => s.strategy === "CONT" && fini(s) && D(s));
const BUY = CONT.filter((s) => s.side === "BUY");
const SELL = CONT.filter((s) => s.side === "SELL");
const ent = (t) => { const s = st(t); return `${String(t.length).padStart(4)} tirs · ${s.wr.toFixed(1)} % ±${s.sig.toFixed(1)} · ${(s.R >= 0 ? "+" : "") + s.R.toFixed(1)} R`; };

console.log(`\n  BUY  ${ent(BUY)}\n  SELL ${ent(SELL)}`);
console.log(`  colonnes : tirs / grappes / WR-grappe / R    ⚠ = moins de 20 grappes    point mort 75,0 %`);

console.log(`\n═══ ① REPERE BRUT — memes coupes des deux cotes (detecte l ARTEFACT de saison) ═══`);
console.log("  " + "bande (percentile signe)".padEnd(24) + "BUY".padStart(12) + "SELL".padStart(26));
for (const b of ["FLAT ou DOWN", "WEAK UP", "STRONG UP", "EXTREME UP"]) {
  console.log("  " + b.padEnd(24) + cel(BUY.filter((s) => bBrut(s) === b)) + "  " + cel(SELL.filter((s) => bBrut(s) === b)));
}

console.log(`\n═══ ② REPERE ORIENTE — « le M15 va CONTRE le pari » (le 2e CRIBLE) ═══`);
console.log("  " + "bande".padEnd(24) + "BUY".padStart(12) + "SELL".padStart(26));
for (const b of ["NUL ou AVEC", "WEAK CONTRE", "STRONG CONTRE", "EXTREME CONTRE"]) {
  console.log("  " + b.padEnd(24) + cel(BUY.filter((s) => bOri(s) === b)) + "  " + cel(SELL.filter((s) => bOri(s) === b)));
}

console.log(`\n═══ ③ ORIENTE x « le contre-mouvement est-il DEJA RENDU ? » (SELL %K<35 / BUY %K>65) ═══`);
console.log("  " + "bande x etat".padEnd(24) + "BUY".padStart(12) + "SELL".padStart(26));
for (const b of ["WEAK CONTRE", "STRONG CONTRE", "EXTREME CONTRE"]) {
  for (const r of ["RENDU", "PAS RENDU"]) {
    console.log("  " + (b + " · " + r).padEnd(24)
      + cel(BUY.filter((s) => bOri(s) === b && rendu(s) === r)) + "  "
      + cel(SELL.filter((s) => bOri(s) === b && rendu(s) === r)));
  }
}
console.log("");
