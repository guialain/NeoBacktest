// _cont_m15_surtension.mjs — LE M15 EST EN SURTENSION : `z live > 2,3` ET `%K live > 90`.
// =============================================================================================
// LA FIGURE (owner 21/08) : on regarde les CONT **BUY** dont le M15 est simultanement tres loin de
//   sa moyenne (`z live > +2,3`) et satur en haut de sa bande (`%K live > 90`). Miroir derive pour
//   le SELL (`z < -2,3` et `%K < 10`). Le M15 est le TF le plus rapide du scan : son `s0` vit au
//   plus 15 minutes, c'est donc la lecture ou « le prix vient de partir » se voit sans retard.
//
// MIROIR DERIVE, LE **BUY** EST LE SENS BRUT ICI (l'inverse des figures H4 de la journee) :
//   `u = BUY ? x : -x` pour le `z`, `kP = BUY ? k : 100 - k` pour le `%K`.
//
// POPULATION : les TIRS du carnet (rang 3), capacite 100/100, spread facture.
//   « LES BARRES NE SONT PAS LES TIRS » — c'est bien le carnet qui est lu ici, pas les candidats.
//
// Usage : `node --max-old-space-size=12288 stats/_cont_m15_surtension.mjs`
//         surcharges : `Z=2.3 K=90`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const R = runMatrixPortfolio(fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv")).sort().map((f) => path.join(DIR, f)),
  { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const S = R.signals ?? [];
const ZB = Number(process.env.Z ?? 2.3), KB = Number(process.env.K ?? 90);

const SG = (t) => t.side === "BUY" ? 1 : -1;                 // ICI le BUY est le sens brut
const lisible = (t) => Number.isFinite(t.zscoreM15S0) && Number.isFinite(t.kM15);
const zP = (t) => t.zscoreM15S0 * SG(t);
const kP = (t) => (SG(t) === 1 ? t.kM15 : 100 - t.kM15);
const a1 = (t) => zP(t) > ZB;
const a2 = (t) => kP(t) > KB;
const figure = (t) => a1(t) && a2(t);

const CONT = S.filter((t) => t.strategy === "CONT" && typeof t.R === "number");
const LIS = CONT.filter(lisible);
const P = LIS.filter(figure), REST = LIS.filter((t) => !figure(t));
const B = (a) => a.filter((t) => t.side === "BUY"), V = (a) => a.filter((t) => t.side === "SELL");

const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const jour = (t) => `${t.asset}|${String(t.tsMT ?? "").slice(0, 10)}`;
const grap = (a) => new Set(a.map(jour)).size;
const wrG = (a) => { const m = new Map(); for (const t of a) { const k = jour(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  let g = 0; for (const [, v] of m) if (Rn(v) > 0) g++; return m.size ? 100 * g / m.size : NaN; };
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(26)}${String(a.length).padStart(6)}${String(grap(a)).padStart(6)}${wr(a).toFixed(2).padStart(9)} %${wrG(a).toFixed(1).padStart(8)} %${Rn(a).toFixed(1).padStart(9)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(26)}     —`;
const HEAD = `   ${"".padEnd(26)}${"tirs".padStart(6)}${"grap".padStart(6)}${"WR".padStart(10)}${"WRgrap".padStart(9)}${"R".padStart(9)}${"R/tir".padStart(9)}`;

console.log(`\n== CONT · M15 EN SURTENSION — z live > ${ZB} ET %K live > ${KB} (BUY brut, SELL miroir) ==`);
console.log(`   carnet ${S.length} · rang 3 ${CONT.length} · lisibles ${LIS.length} (${CONT.length - LIS.length} capteur muet)`);
console.log(`   REPERES : point mort 75,00 · carnet ${wr(S).toFixed(2)} · rang 3 ${wr(CONT).toFixed(2)} · 3 BUY ${wr(B(CONT)).toFixed(2)} · 3 SELL ${wr(V(CONT)).toFixed(2)}\n`);
console.log(HEAD);
console.log(L("LA CIBLE", P));
console.log(L("   BUY  (brut)", B(P)));
console.log(L("   SELL (miroir)", V(P)));
console.log(L("RESTE DU RANG 3", REST));
console.log(L("   BUY", B(REST)));
console.log(L("   SELL", V(REST)));

console.log(`\n   -- CHAQUE AXE SEUL --`); console.log(HEAD);
for (const [nm, f] of [[`z M15 live > ${ZB}`, a1], [`%K M15 live > ${KB}`, a2]]) {
  console.log(L(nm, LIS.filter(f)));
  console.log(L("     BUY", B(LIS.filter(f))));
  console.log(L("     SELL", V(LIS.filter(f))));
}

console.log(`\n   -- BALAYAGE MARGINAL du z M15 (a %K > ${KB}) --`); console.log(HEAD);
{
  const Z = [0, 1.0, 1.5, 2.0, 2.3, 2.7, 3.2, Infinity];
  for (let i = 0; i < Z.length - 1; i++)
    console.log(L(`z [${Z[i].toFixed(1)} . ${Z[i + 1] === Infinity ? "+inf" : Z[i + 1].toFixed(1)}[`,
      LIS.filter((t) => a2(t) && zP(t) >= Z[i] && zP(t) < Z[i + 1])));
}
console.log(`\n   -- BALAYAGE MARGINAL du %K M15 (a z > ${ZB}) --`); console.log(HEAD);
{
  const K = [0, 50, 70, 80, 90, 95, 100.01];
  for (let i = 0; i < K.length - 1; i++)
    console.log(L(`%K [${K[i]} . ${K[i + 1] > 100 ? "100" : K[i + 1]}[`,
      LIS.filter((t) => a1(t) && kP(t) >= K[i] && kP(t) < K[i + 1])));
}
console.log("");

// -- LA BORNE `%K M15 > 90` EST-ELLE SEULEMENT ATTEIGNABLE ? --
// ⚠⚠ Doctrine du depot : « une borne se controle comme ATTEINTE ». Une regle dont la borne n'est
//   jamais franchie est un VETO MORT-NE — vrai a la lecture, jamais declenche (cf. `kdCur CONTACT`
//   ombre par `CROSS`, 51/51 le 21/08).
{
  const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
  for (const [nm, pop] of [["rang 3 (CONT)", LIS], ["TOUT le carnet", S.filter(lisible)]]) {
    const raw = pop.map((t) => t.kM15), ori = pop.map(kP);
    console.log(`   ${nm} — n=${pop.length}`);
    console.log(`     %K M15 BRUT    min ${Math.min(...raw).toFixed(1)} · p50 ${q(raw, .5).toFixed(1)} · p90 ${q(raw, .9).toFixed(1)} · p99 ${q(raw, .99).toFixed(1)} · MAX ${Math.max(...raw).toFixed(1)}`);
    console.log(`     %K M15 ORIENTE min ${Math.min(...ori).toFixed(1)} · p50 ${q(ori, .5).toFixed(1)} · p90 ${q(ori, .9).toFixed(1)} · p99 ${q(ori, .99).toFixed(1)} · MAX ${Math.max(...ori).toFixed(1)}`);
    for (const b of [80, 85, 90, 95]) console.log(`     brut > ${b} : ${raw.filter((x) => x > b).length} · oriente > ${b} : ${ori.filter((x) => x > b).length}`);
  }
}
