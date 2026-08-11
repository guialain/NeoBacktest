// _pb_epuise_par_cote.mjs — LA CONDITION « PLUS DE PLACE » (`kOr >= 88`), CÔTÉ PAR CÔTÉ.
//
// ⭐⭐⭐ POURQUOI SÉPARER LES CÔTÉS ALORS QUE LA RÈGLE EST SYMÉTRIQUE. Justement parce qu'elle l'est :
//   une règle miroir DOIT être auditée sur chaque côté, sinon on ne sait pas lequel la paie. Le
//   dépôt le dit autrement — « créditer une règle de son côté le PLUS FAIBLE ».
// ⚠ La règle s'écrit `kOr >= 88` dans le repère ORIENTÉ, ce qui recouvre DEUX énoncés bruts :
//       PB SELL · %K brut <= 12   (le mouvement à rejoindre est au PLANCHER)
//       PB BUY  · %K brut >= 88   (il est au PLAFOND)
// ⚠⚠ DEUX POINTS DE FONCTIONNEMENT, ET C'EST L'ESSENTIEL DE CETTE FICHE :
//       `MIN_PB = -31` : tout tire ⇒ on voit la POPULATION que la condition vise.
//       `MIN_PB = 3`   : le seuil réel ⇒ on voit ce qu'elle RETIRE VRAIMENT.
//   Les confondre a produit trois erreurs le 10/08. Une condition qui agit sur le bas de
//   distribution paraît décisive au premier point et ne pèse rien au second.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1"; process.env.PB_ISOLE = "1";
process.env.PB_K_EPUISE = "101";                      // ⚠ DÉSARMÉE : on veut voir ce qu'elle retirerait
// 🔴🔥⭐⭐⭐ UN SEUL SEUIL PAR PROCESSUS, ET C'EST OBLIGATOIRE. `MIN_PB` est lu A L'IMPORT
//   (`export const MIN_PB = _envNum(...)` dans `scoringDecision`). Boucler sur plusieurs seuils dans
//   le MEME processus ne marche pas : un cache-buster sur `matrixBacktest` ne rebuste pas
//   `scoringDecision`, dont le specifier resout vers la MEME URL. Les deux blocs sortiraient
//   identiques — et se liraient comme un resultat, pas comme un bug. `MIN_PB=<n> node ...`
const SEUIL = process.env.MIN_PB ?? "-31";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/";
const { readTfs } = await import(M + "vetoGate.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const jour = (s) => String(s.tsMT).slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const R = t.reduce((a, b) => a + (b.R || 0), 0), g = new Map();
  for (const x of t) { const k = x.actif + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length, R }; };
const ligne = (lbl, t, tot) => { const q = st(t);
  if (!q) { console.log("  " + lbl.padEnd(34) + "        0"); return; }
  console.log("  " + lbl.padEnd(34) + String(q.n).padStart(6)
    + (tot ? (100 * q.n / tot).toFixed(1).padStart(7) + "%" : "".padStart(8))
    + String(q.gr).padStart(6) + q.wrg.toFixed(1).padStart(9) + "%"
    + ((q.R >= 0 ? "+" : "") + q.R.toFixed(1)).padStart(9)
    + (q.R / q.n).toFixed(3).padStart(8) + (q.gr < 40 ? "  ~" : "")); };

{
  const seuil = SEUIL;
  const { runMatrixBacktest } = await import(
    "file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
  const T = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
    const actif = path.basename(f, ".csv"), CSV = path.join(DIR, f);
    const L = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/), head = L[0].split(";");
    const rows = new Map();
    for (const l of L.slice(1)) { const c = l.split(";"), o = {};
      for (let i = 0; i < head.length; i++) o[head[i]] = c[i]; rows.set(o.timestamp, o); }
    for (const s of (runMatrixBacktest(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals ?? [])) {
      if (s.strategy !== "PB" || (s.outcome !== "WIN" && s.outcome !== "LOSS")) continue;
      const row = rows.get(s.tsMT); if (!row) continue;
      const k = readTfs(row).h1?.kClosed; if (k == null) continue;
      T.push({ ...s, actif, kBrut: k, kOr: s.side === "BUY" ? k : 100 - k });
    }
  }
  const S = T.filter((x) => x.side === "SELL"), B = T.filter((x) => x.side === "BUY");
  console.log(`\n══ MIN_PB = ${seuil}${seuil === "-31" ? "   (tout tire — la POPULATION visée)" : "   (seuil RÉEL — ce qu'elle RETIRE)"} ══`);
  console.log("                                      tirs    part   grap  WR/grap        R   R/tir");
  ligne("SELL · retiré  (%K brut ≤ 12)", S.filter((x) => x.kOr >= 88), S.length);
  ligne("SELL · gardé", S.filter((x) => x.kOr < 88), S.length);
  ligne("BUY  · retiré  (%K brut ≥ 88)", B.filter((x) => x.kOr >= 88), B.length);
  ligne("BUY  · gardé", B.filter((x) => x.kOr < 88), B.length);
}
