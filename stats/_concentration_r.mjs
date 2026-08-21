// _concentration_r.mjs — LE CARNET TIENT-IL SUR QUELQUES JOURNEES ?
// ============================================================================================
// 🎯 PREREQUIS NOMME (owner 12/08) : le tir `BRENT_OIL 2026.07.23` perd sur un choc geopolitique
//   (+2,41 % en 3 h 49, crise petroliere). Un evenement pareil n'est pas lisible par un bareme
//   d'oscillateurs — mais il peut PESER assez pour orienter toutes les decisions de calibrage.
// ⭐⭐⭐ LA DOCTRINE DU DEPOT : « le signal d'alarme est un gain ADOSSE ». Elle vaut dans les DEUX
//   sens — une PERTE concentree sur deux journees ne doit pas plus faire changer une regle qu'un
//   gain concentre ne doit la faire garder.
// ⚠ On mesure par GRAPPE actif x jour, l'unite d'independance de ce depot (sigma x9 sinon).
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const sig = (runMatrixPortfolio(paths, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals ?? [])
  .filter((s) => typeof s.R === "number");
const jour = (s) => String(s.tsMT || "").slice(0, 10);
for (const RANG of ["EXH", "PB", "CONT", null]) {
  const T = RANG ? sig.filter((s) => s.strategy === RANG) : sig;
  if (!T.length) continue;
  const g = new Map();
  for (const s of T) {
    const k = (s.asset ?? s.symbol ?? "?") + " " + jour(s);
    const o = g.get(k) ?? { n: 0, R: 0 }; o.n++; o.R += s.R; g.set(k, o);
  }
  const L = [...g.entries()].sort((a, b) => a[1].R - b[1].R);
  const total = T.reduce((a, s) => a + s.R, 0);
  const pire = L.slice(0, 5), meilleur = L.slice(-5).reverse();
  const sP = pire.reduce((a, x) => a + x[1].R, 0), sM = meilleur.reduce((a, x) => a + x[1].R, 0);
  console.log(`\n══ ${RANG ?? "TOUS RANGS"} — ${T.length} tirs · ${g.size} grappes · R total ${total.toFixed(1)} ══`);
  console.log(`   les 5 PIRES grappes :`);
  for (const [k, v] of pire) console.log(`     ${k.padEnd(24)} ${String(v.n).padStart(3)} tirs   R ${v.R.toFixed(1).padStart(7)}`);
  console.log(`   les 5 MEILLEURES :`);
  for (const [k, v] of meilleur) console.log(`     ${k.padEnd(24)} ${String(v.n).padStart(3)} tirs   R ${v.R.toFixed(1).padStart(7)}`);
  console.log(`   ⇒ 5 pires ${sP.toFixed(1)} R  ·  5 meilleures +${sM.toFixed(1)} R  ·  soit ${((Math.abs(sP) + sM) / Math.abs(total) * 100).toFixed(0)} % du |R total| sur ${(10 / g.size * 100).toFixed(1)} % des grappes`);
}
// ── le poids de l'ENERGIE sur la fenetre de crise
const ENER = new Set(["BRENT_OIL", "CrudeOIL", "GASOLINE"]);
const crise = sig.filter((s) => ENER.has(s.asset) && jour(s) >= "2026.07.20" && jour(s) <= "2026.07.31");
const rc = crise.reduce((a, s) => a + s.R, 0), rt = sig.reduce((a, s) => a + s.R, 0);
console.log(`\n══ ENERGIE du 20 au 31/07 (fenetre de la crise petroliere) ══`);
console.log(`   ${crise.length} tirs · R ${rc.toFixed(1)}  —  sur un R total de ${rt.toFixed(1)}`);
console.log(`   ⇒ ${(100 * crise.length / sig.length).toFixed(1)} % des tirs portent ${(100 * rc / rt).toFixed(1)} % du R total.\n`);
