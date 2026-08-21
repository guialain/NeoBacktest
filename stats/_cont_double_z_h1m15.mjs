// _cont_double_z_h1m15.mjs — LES DEUX HORLOGES SONT LOIN, ET LE K/D A LACHE.
// =============================================================================================
// LA FIGURE (owner 21/08) : « kh1 live > 55 + kd = contact ou k-d < 0 + z h1 > 2,3 + z m15 > 2,15 ».
//   BUY = SENS BRUT, SELL = miroir derive. Le prix est loin de sa moyenne sur les DEUX horloges
//   (H1 la structure, M15 l'entree), le %K H1 est encore au-dessus du milieu, et la geometrie
//   K/D a deja cede — soit les lignes se TOUCHENT, soit le rapide est passe SOUS le lent.
//
// /!\ « kd = CONTACT » A DEUX LECTURES, ET LE DEPOT A DEJA ETE MORDU PAR LA :
//   (a) l'ETAT de la roue `kdCycleState` — mais le 21/08 il a ete mesure INATTEIGNABLE en H4
//       (51/51 des cas sortent en `CROSS`, parce que `kd0*kd1 < 0` est teste AVANT la bande morte).
//   (b) la MAGNITUDE `|K-D| <= STOCHDYN_CONTACT (2,1)` — la lecture qui ne peut pas etre ombree.
//   => ON MESURE LES DEUX, et on dit laquelle porte la population. Ecrire (a) sans verifier
//   donnerait un terme MORT dans un OU, donc une regle qui n'est pas celle qu'on croit.
//
// /!\ `z h1` et `z m15` sont pris en LIVE (`zscore_*_s0`), comme les figures precedentes.
// POPULATION : les TIRS du carnet (rang 3), 100/100, spread facture — etat `b3e7838`.
// Usage : `node --max-old-space-size=12288 stats/_cont_double_z_h1m15.mjs`
//         surcharges : `K=55 ZH1=2.3 ZM15=2.15`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { STOCHDYN_CONTACT } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const R = runMatrixPortfolio(fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv")).sort().map((f) => path.join(DIR, f)),
  { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const S = R.signals ?? [];
const KB = Number(process.env.K ?? 55), ZH1 = Number(process.env.ZH1 ?? 2.3), ZM15 = Number(process.env.ZM15 ?? 2.15);

const SG = (t) => t.side === "BUY" ? 1 : -1;                    // le BUY est le sens brut
const lisible = (t) => Number.isFinite(t.kH1) && Number.isFinite(t.kdGapH1)
                    && Number.isFinite(t.zscoreH1S0) && Number.isFinite(t.zscoreM15S0);
const kP = (t) => (SG(t) === 1 ? t.kH1 : 100 - t.kH1);
const kdOr = (t) => t.kdGapH1 * SG(t);
const a1 = (t) => kP(t) > KB;
const contactEtat = (t) => t.kdCycleH1 === "CONTACT";
const contactMagn = (t) => Math.abs(t.kdGapH1) <= STOCHDYN_CONTACT;
const a2 = (t) => contactEtat(t) || kdOr(t) < 0;                // la dictee, lecture (a)
const a2m = (t) => contactMagn(t) || kdOr(t) < 0;               // la dictee, lecture (b)
const a3 = (t) => t.zscoreH1S0 * SG(t) > ZH1;
const a4 = (t) => t.zscoreM15S0 * SG(t) > ZM15;
const cible = (t) => a1(t) && a2(t) && a3(t) && a4(t);
const cibleM = (t) => a1(t) && a2m(t) && a3(t) && a4(t);

const CONT = S.filter((t) => t.strategy === "CONT" && typeof t.R === "number");
const LIS = CONT.filter(lisible);
const P = LIS.filter(cible), REST = LIS.filter((t) => !cible(t));
const B = (a) => a.filter((t) => t.side === "BUY"), V = (a) => a.filter((t) => t.side === "SELL");

const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const jour = (t) => `${t.asset}|${String(t.tsMT ?? "").slice(0, 10)}`;
const grap = (a) => new Set(a.map(jour)).size;
const wrG = (a) => { const m = new Map(); for (const t of a) { const k = jour(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  let g = 0; for (const [, v] of m) if (Rn(v) > 0) g++; return m.size ? 100 * g / m.size : NaN; };
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(28)}${String(a.length).padStart(6)}${String(grap(a)).padStart(6)}${wr(a).toFixed(2).padStart(9)} %${wrG(a).toFixed(1).padStart(8)} %${Rn(a).toFixed(1).padStart(9)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(28)}     —`;
const HEAD = `   ${"".padEnd(28)}${"tirs".padStart(6)}${"grap".padStart(6)}${"WR".padStart(10)}${"WRgrap".padStart(9)}${"R".padStart(9)}${"R/tir".padStart(9)}`;

console.log(`\n== CONT — %K H1 > ${KB} · (KD CONTACT ou K-D < 0) · z H1 > ${ZH1} · z M15 > ${ZM15} ==`);
console.log(`   BUY = sens brut · SELL = miroir derive`);
console.log(`   carnet ${S.length} · rang 3 ${CONT.length} · lisibles ${LIS.length} (${CONT.length - LIS.length} muet)`);
console.log(`   REPERES  point mort 75,00 · carnet ${wr(S).toFixed(2)} · rang 3 ${wr(CONT).toFixed(2)} · 3 BUY ${wr(B(CONT)).toFixed(2)} · 3 SELL ${wr(V(CONT)).toFixed(2)}\n`);
console.log(HEAD);
console.log(L("LA CIBLE", P)); console.log(L("   BUY  (brut)", B(P))); console.log(L("   SELL (miroir)", V(P)));
console.log(L("RESTE DU RANG 3", REST)); console.log(L("   BUY", B(REST))); console.log(L("   SELL", V(REST)));

console.log(`\n   -- LE TERME « CONTACT » APPORTE-T-IL QUELQUE CHOSE ? --`);
console.log(`   etat kdCycleH1 === CONTACT      : ${LIS.filter(contactEtat).length} tirs sur ${LIS.length}`);
console.log(`   magnitude |K-D| <= ${STOCHDYN_CONTACT}          : ${LIS.filter(contactMagn).length} tirs`);
console.log(`   CONTACT(etat) SANS K-D<0        : ${LIS.filter((t) => contactEtat(t) && !(kdOr(t) < 0)).length} tirs  <- ce que le OU ajoute`);
console.log(`   CONTACT(magn) SANS K-D<0        : ${LIS.filter((t) => contactMagn(t) && !(kdOr(t) < 0)).length} tirs`);
console.log(HEAD);
console.log(L("cible, contact = ETAT", P));
console.log(L("cible, contact = MAGNITUDE", LIS.filter(cibleM)));
console.log(L("cible, SANS le terme contact", LIS.filter((t) => a1(t) && kdOr(t) < 0 && a3(t) && a4(t))));

console.log(`\n   -- CHAQUE AXE SEUL --`); console.log(HEAD);
for (const [nm, f] of [[`%K H1 > ${KB}`, a1], ["KD contact ou K-D<0", a2], [`z H1 live > ${ZH1}`, a3], [`z M15 live > ${ZM15}`, a4]]) {
  const a = LIS.filter(f); console.log(L(nm, a)); console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a)));
}
console.log(`\n   -- CHAQUE AXE RETIRE --`); console.log(HEAD);
const AX = [[`%K > ${KB}`, a1], ["KD", a2], ["z H1", a3], ["z M15", a4]];
for (const [nm, f] of AX) {
  const a = LIS.filter((t) => AX.filter(([, g]) => g !== f).every(([, g]) => g(t)));
  console.log(L("sans " + nm, a)); if (a.length) { console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a))); }
}
console.log(`\n   -- LA CIBLE, TIR PAR TIR --`);
for (const t of P.sort((x, y) => String(x.tsMT).localeCompare(String(y.tsMT))))
  console.log(`   ${String(t.asset).padEnd(12)}${String(t.tsMT).padEnd(22)}${t.side.padEnd(5)} %K ${t.kH1.toFixed(1).padStart(5)}  K-D ${t.kdGapH1.toFixed(2).padStart(7)} ${String(t.kdCycleH1 ?? "-").padEnd(10)} zH1 ${t.zscoreH1S0.toFixed(2).padStart(6)}  zM15 ${t.zscoreM15S0.toFixed(2).padStart(6)}  R ${(t.R ?? 0).toFixed(2).padStart(6)}`);
console.log("");

// -- L'EMPILEMENT DANS L'ORDRE DE LA DICTEE (owner) : LA BASE D'ABORD, LES `z` ENSUITE --
//   base = `%K H1 > 55` ET (`kd = CONTACT` OU `K < D`)  — c'est ELLE le veto ; les deux `z` ne
//   sont que des resserrements qu'on evalue PAR-DESSUS.
{
  const base = (t) => a1(t) && a2(t);
  const bs = LIS.filter(base);
  const rest0 = LIS.filter((t) => !base(t));
  console.log(`   ===== 1. LA BASE : %K H1 > ${KB} ET (KD CONTACT ou K < D) =====`); console.log(HEAD);
  console.log(L("BASE", bs)); console.log(L("   BUY", B(bs))); console.log(L("   SELL", V(bs)));
  console.log(L("RESTE DU RANG 3", rest0)); console.log(L("   BUY", B(rest0))); console.log(L("   SELL", V(rest0)));

  console.log(`\n   ===== 2. LES DEUX BRANCHES DE LA BASE, SEPAREMENT =====`); console.log(HEAD);
  for (const [nm, f] of [["dont KD CONTACT (etat)", (t) => base(t) && contactEtat(t)],
                         ["dont K < D (K-D < 0)", (t) => base(t) && kdOr(t) < 0],
                         ["   CONTACT sans K<D", (t) => base(t) && contactEtat(t) && !(kdOr(t) < 0)],
                         ["   K<D sans CONTACT", (t) => base(t) && kdOr(t) < 0 && !contactEtat(t)]]) {
    const a = LIS.filter(f); console.log(L(nm, a)); console.log(L("        BUY", B(a))); console.log(L("        SELL", V(a)));
  }

  console.log(`\n   ===== 3. LES \`z\` AJOUTES PAR-DESSUS LA BASE =====`); console.log(HEAD);
  const ajouts = [
    [`base + z H1 > ${ZH1}`,                 (t) => base(t) && a3(t)],
    [`base + z M15 > ${ZM15}`,               (t) => base(t) && a4(t)],
    [`base + LES DEUX z`,                    (t) => base(t) && a3(t) && a4(t)],
  ];
  for (const [nm, f] of ajouts) {
    const a = LIS.filter(f); console.log(L(nm, a)); console.log(L("        BUY", B(a))); console.log(L("        SELL", V(a)));
  }

  console.log(`\n   ===== 4. BALAYAGE DU z H1 SUR LA BASE (cumulatif) =====`); console.log(HEAD);
  for (const z of [0, 1.0, 1.55, 2.0, 2.15, 2.3, 2.5]) {
    const a = bs.filter((t) => t.zscoreH1S0 * SG(t) > z);
    console.log(L(`base + z H1 > ${z.toFixed(2)}`, a)); console.log(L("        BUY", B(a))); console.log(L("        SELL", V(a)));
  }
  console.log(`\n   ===== 5. BALAYAGE DU z M15 SUR LA BASE (cumulatif) =====`); console.log(HEAD);
  for (const z of [0, 1.0, 1.55, 2.0, 2.15, 2.3, 2.5]) {
    const a = bs.filter((t) => t.zscoreM15S0 * SG(t) > z);
    console.log(L(`base + z M15 > ${z.toFixed(2)}`, a)); console.log(L("        BUY", B(a))); console.log(L("        SELL", V(a)));
  }
  console.log("");
}

// -- VARIANTE OWNER : `%K H1 > KB` + `K < D` SEUL (plus de CONTACT) + (`z M15 > ZM15` OU `z H1 > ZH1`)
//   Le `OU` a change de place : il n'est plus sur la geometrie K/D, il est sur les DEUX `z`.
{
  const bb = (t) => a1(t) && kdOr(t) < 0;              // base : zone + K < D SEUL
  const ouZ = (t) => a4(t) || a3(t);                   // z M15 OU z H1
  const cib = (t) => bb(t) && ouZ(t);
  const bs = LIS.filter(bb), P3 = LIS.filter(cib), R3 = LIS.filter((t) => !cib(t));
  console.log(`   ##### %K H1 > ${KB} + K < D + (z M15 > ${ZM15} OU z H1 > ${ZH1}) #####`); console.log(HEAD);
  console.log(L("BASE (zone + K<D)", bs)); console.log(L("   BUY", B(bs))); console.log(L("   SELL", V(bs)));
  console.log(L("LA CIBLE (base + OU z)", P3)); console.log(L("   BUY", B(P3))); console.log(L("   SELL", V(P3)));
  console.log(L("RESTE DU RANG 3", R3)); console.log(L("   BUY", B(R3))); console.log(L("   SELL", V(R3)));
  console.log(`\n   -- LES DEUX BRANCHES DU OU, SUR LA BASE --`); console.log(HEAD);
  for (const [nm, f] of [[`z M15 > ${ZM15}`, (t) => bb(t) && a4(t)],
                         [`z H1 > ${ZH1}`, (t) => bb(t) && a3(t)],
                         ["   les DEUX a la fois", (t) => bb(t) && a3(t) && a4(t)],
                         ["   z M15 SANS z H1", (t) => bb(t) && a4(t) && !a3(t)],
                         ["   z H1 SANS z M15", (t) => bb(t) && a3(t) && !a4(t)]]) {
    const a = LIS.filter(f); console.log(L(nm, a)); console.log(L("        BUY", B(a))); console.log(L("        SELL", V(a)));
  }
  console.log(`\n   -- LA CIBLE, TIR PAR TIR --`);
  for (const t of P3.sort((x, y) => String(x.tsMT).localeCompare(String(y.tsMT))))
    console.log(`   ${String(t.asset).padEnd(12)}${String(t.tsMT).padEnd(22)}${t.side.padEnd(5)} %K ${t.kH1.toFixed(1).padStart(5)}  K-D ${t.kdGapH1.toFixed(2).padStart(7)}  zH1 ${t.zscoreH1S0.toFixed(2).padStart(6)}  zM15 ${t.zscoreM15S0.toFixed(2).padStart(6)}  R ${(t.R ?? 0).toFixed(2).padStart(6)}`);
  console.log("");
}
