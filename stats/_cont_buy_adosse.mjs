// _cont_buy_adosse.mjs — L'ANTI-CORRELATION DU CONT BUY EST-ELLE ADOSSEE A QUELQUES ACTIFS ?
// ============================================================================================
// ⭐⭐⭐ L'HYPOTHESE OWNER (12/08) : « il y a eu de fortes hausses sur la periode, et le prix montait
//   MEME QUAND LES INDICATEURS SATURAIENT — exemple US_TECH100 ». Si c'est vrai, alors les barres a
//   BAS score CONT BUY sont les barres SATUREES (le bareme penalise `EXTREME`/`SNAPPED`, la zone RSI
//   haute, le %K haut) — et elles gagnent parce que la tendance a traverse la saturation.
//   ⇒ **L'anti-correlation ne serait pas un defaut de calibrage, ce serait un REGIME.**
// ⚠⚠ ET C'EST LA DIFFERENCE QUI DECIDE DE TOUT : un defaut de calibrage se corrige dans la table ;
//   un regime NE SE CORRIGE PAS — le corriger, c'est AJUSTER AU REGIME, et le depot a deja paye ca
//   (`aout_refute_juillet` : « tout ce qui precede le 06/08 est a REJUGER »).
// 🎯 CE QUE CETTE SONDE TRANCHE, ET RIEN D'AUTRE : le gain des bandes BASSES et la perte des bandes
//   HAUTES sont-ils CONCENTRES sur quelques actifs / quelques jours ? Le signal d'alarme du depot est
//   un gain ADOSSE.
// ⚠ WR PAR GRAPPE actif x jour. ⚠ Point mort 75,0 %.
// ⚠ `file:///C:/...` en dur : sur Windows un chemin absolu nu est refuse par le chargeur ESM.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "-11";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const conv = (s) => s.sc?.boxes?.cont?.conviction;
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const BUY = all.filter((s) => s.strategy === "CONT" && s.side === "BUY"
  && (s.outcome === "WIN" || s.outcome === "LOSS") && Number.isFinite(conv(s)));

const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wr: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };

const BAS = (s) => conv(s) < 0, HAUT = (s) => conv(s) >= 12;
const pc = (x) => x == null ? "     —" : x.toFixed(1).padStart(6);
console.log(`\n══ CONT BUY — l'anti-correlation est-elle ADOSSEE ? (${BUY.length} tirs) ══`);
console.log(`   BANDE BASSE = score < 0 (les barres que le bareme REFUSE — donc les SATUREES)`);
console.log(`   BANDE HAUTE = score >= 12 (celles qu'il RECOMPENSE)\n`);

console.log(`   actif            BASSE (score<0)              HAUTE (score>=12)          ecart`);
console.log(`                  tirs grap    WR       R  │  tirs grap    WR       R  │  WR pts`);
console.log(`   ` + "─".repeat(78));
const assets = [...new Set(BUY.map((s) => s.asset))];
const lig = (nom, sel) => {
  const b = st(BUY.filter((s) => sel(s) && BAS(s))), h = st(BUY.filter((s) => sel(s) && HAUT(s)));
  const ec = (b && h && b.gr >= 5 && h.gr >= 5) ? ((b.wr - h.wr >= 0 ? "+" : "") + (b.wr - h.wr).toFixed(1)).padStart(7) : "      ·";
  const cel = (v) => v ? String(v.n).padStart(5) + String(v.gr).padStart(5) + pc(v.wr) + "%" + ((v.R >= 0 ? "+" : "") + v.R.toFixed(1)).padStart(8) : "    —    —      —       —";
  console.log(`   ${nom.padEnd(13)}${cel(b)}  │${cel(h)}  │${ec}`);
};
for (const a of assets.sort((x, y) => BUY.filter((s) => s.asset === y).length - BUY.filter((s) => s.asset === x).length)) lig(a, (s) => s.asset === a);
console.log(`   ` + "─".repeat(78));
const US = new Set(["US_30", "US_500", "US_TECH100"]);
lig("— 3 US —", (s) => US.has(s.asset));
lig("— HORS US —", (s) => !US.has(s.asset));
lig("— TOUS —", () => true);
console.log(`\n  ⭐ SI l'ecart s'effondre HORS US, l'anti-correlation est un REGIME (fortes hausses des`);
console.log(`     indices US) et NON un defaut du bareme. Corriger la table serait ajuster au regime.`);
console.log(`  ⚠ Point mort 75,0 % : c'est cette barre-la qui juge, pas la comparaison entre bandes.\n`);
