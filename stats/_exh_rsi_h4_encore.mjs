// _exh_rsi_h4_encore.mjs — « RSI H4 CLOTURE > 70 ET QUI MONTE ENCORE » — sur le fade vendeur.
// ============================================================================================
// 🎯 DICTEE OWNER (12/08) : « cherche WR exh sell pour rsiH4 closed > 70 et dRsiH4 > 0 ».
// ⭐ CE QUE LA FIGURE DECRIT : l'horloge LENTE est en surachat ET elle POUSSE ENCORE. C'est un
//   extreme ENCORE ALIMENTE, sur le TF le plus lent du bareme.
// 🔴🔥 A CONFRONTER A DEUX MESURES DU JOUR QUI DISENT L'INVERSE DE L'INTUITION :
//     · `intraday_change` deja parcouru CONTRE le fade : 72,4 % a plat -> **79,9 %** au-dela de +1 %
//     · pente de la moyenne CONTRE le fade : 73,0 % a `FLAT` -> **83,7 %** a `EXPLOSIVE_UP`
//   Les deux disent : plus l'extreme est alimente, MIEUX le fade marche. Si le RSI H4 dit l'inverse,
//   c'est une information neuve ; s'il dit la meme chose, c'est une troisieme confirmation.
// ⚠ MIROIR SYSTEMATIQUE : le BUY est mesure sur `< 30` ET `dRsi < 0`. Une regle qui ne tient qu'a
//   un cote decrit la FENETRE, pas la figure (le depot vient de l'illustrer sur `CONTACT->CROSS`).
// ⚠ GRADIENT ET PAS UNE SEULE COUPURE : un seuil unique ne dit pas s'il est dans une pente ou sur
//   un accident. `70` est la dictee ; `65` et `75` disent si elle est stable.
// ⚠ `readTfs(row).h4` — les valeurs du MOTEUR, jamais re-derivees ici.
// ⚠ WR PAR GRAPPE actif x jour · point mort 75,0 %.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixBacktest } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { readTfs } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const T = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f), sym = path.basename(f, ".csv");
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/); const h = L[0].split(";");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); rows.set(c[h.indexOf("timestamp")], c); }
  for (const s of (runMatrixBacktest(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || [])) {
    if (s.strategy !== "EXH" || typeof s.R !== "number") continue;
    const c = rows.get(s.tsMT); if (!c) continue;
    const t = readTfs(Object.fromEntries(h.map((k, i) => [k, c[i]])))?.h4;
    if (!t || !Number.isFinite(t.rsiClosed) || !Number.isFinite(t.dRsi)) continue;
    T.push({ ...s, asset: sym, rsi: t.rsiClosed, d: t.dRsi });
  }
  rows.clear();
}
const jour = (s) => String(s.tsMT || "").slice(0, 10);
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wr: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const cel = (v) => v ? String(v.n).padStart(6) + String(v.gr).padStart(5) + v.wr.toFixed(1).padStart(7) + "%" + ((v.R >= 0 ? "+" : "") + v.R.toFixed(1)).padStart(8) : "     —    —      —       —";
const lig = (lbl, t, ref) => {
  const a = st(t);
  const e = (a && ref && a.gr >= 20 && ref.gr >= 20) ? `   ecart ${(a.wr - ref.wr >= 0 ? "+" : "") + (a.wr - ref.wr).toFixed(1)} pts` : (a && a.gr < 20 ? `   ⚠ ${a.gr} grappes — sous le plancher` : "");
  console.log(`     ${lbl.padEnd(30)}` + cel(a) + e);
  return a;
};
console.log(`\n══ RANG ① · RSI H4 CLOTURE a l'extreme ET QUI POUSSE ENCORE (${T.length} tirs EXH) ══`);
console.log(`   point mort 75,0 %\n`);
console.log(`     population                       tirs grap     WR       R`);
for (const [side, cmp, dcmp, mot] of [["SELL", (r, s) => r > s, (d) => d > 0, "> "], ["BUY", (r, s) => r < 100 - s, (d) => d < 0, "< "]]) {
  const S = T.filter((x) => x.side === side);
  console.log(`\n  ── ${side} (${S.length} tirs) ── ${side === "SELL" ? "RSI H4 > seuil ET dRsi > 0" : "MIROIR : RSI H4 < 100−seuil ET dRsi < 0"}`);
  const base = st(S);
  lig("TOUT le cote", S, null);
  for (const seuil of [65, 70, 75]) {
    const dans = S.filter((x) => cmp(x.rsi, seuil) && dcmp(x.d));
    lig(`RSI ${mot}${side === "SELL" ? seuil : 100 - seuil} ET ${side === "SELL" ? "dRsi > 0" : "dRsi < 0"}`, dans, base);
  }
  // ⚠ LES DEUX CONDITIONS SEPAREES : sans ca on ne sait pas laquelle porte l'effet.
  console.log(`     ── les deux conditions, separement ──`);
  lig(`RSI ${mot}${side === "SELL" ? 70 : 30} SEUL`, S.filter((x) => cmp(x.rsi, 70)), base);
  lig(`${side === "SELL" ? "dRsi > 0" : "dRsi < 0"} SEUL`, S.filter((x) => dcmp(x.d)), base);
}
console.log("");
