// _cont_2h_zdz_k.mjs — LA POCHE DICTEE LE 21/08, VERSION 5 AXES.
// =============================================================================================
// 🎯 LA FIGURE (owner) : la structure H4 est DEJA du cote haussier (`z H4 cloture > +0,30`) ET elle
//   s'y enfonce encore (`dz H4 live >= CONT_DZ_SEUIL`), le `K-D` H1 est franchement SEPARE dans le
//   meme sens (`> STOCHDYN_CONTACT`), et NI le `%K H4` cloture NI le `%K H1` live n'ont consomme
//   leur bande (`< 60` / `< 70`). Poussee ETABLIE, FRAICHE, et il lui reste de la course.
//   => VENDRE la, c'est se mettre devant une structure haussiere installee qui accelere.
//
// LES TROIS BORNES NUMERIQUES SONT DES CONSTANTES DU DEPOT, PAS DES CHIFFRES DE COURBE :
//     `0,30` = la frontiere `Z_MID -> Z_P_030` de `CONT_ZDZ_BANDES`, et le defaut de
//              `CONT_ZH4_PUSH_BORNE` — la meme frontiere sert deja de plancher a un veto voisin.
//     `0,20` = `CONT_DZ_SEUIL`     (bande morte du dz, partagee par les entrees 4 et 5 du rang 3)
//     `2,1`  = `STOCHDYN_CONTACT`  (`|K-D| <= 2,1` => CONTACT au detecteur)
//   => ON IMPORTE les deux qui sont exportees. Recopier ferait diverger la sonde du bareme.
//
// MIROIR DERIVE, aucun nombre par cote — `u = SELL ? x : -x` · `kP = SELL ? k : 100 - k`.
//
// DEUX RECOUVREMENTS NOMMES, la poche est donc MARGINALE (mesuree sur ce qui SURVIT deja) :
//   1. `cont-deux-horloges-contre` (deploye ce matin) partage `%K H4 < 60` et « le H1 pousse contre ».
//   2. `cont-h4-push-contre` refuse deja `z H4 cloture` du MAUVAIS cote dans `]0,30 · 1,05[` quand
//      le `dz` **H1** ne va pas le chercher. MEME PLANCHER `0,30`, autre horloge pour la vitesse,
//      et LUI A UN PLAFOND (1,05) que cette figure n'a pas.
//
// LA BARRE N'EST PAS LE POINT MORT (75 %). C'est le `WR` DEJA ACQUIS : rang 3 et carnet.
// Usage : `node --max-old-space-size=12288 stats/_cont_2h_zdz_k.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { CONT_DZ_SEUIL } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/contScoringV1.js");
const { STOCHDYN_CONTACT } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const R = runMatrixPortfolio(fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv")).sort().map((f) => path.join(DIR, f)),
  { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const S = R.signals ?? [];
const K4 = Number(process.env.K4 ?? 60), K1 = Number(process.env.K1 ?? 70);
const LO = CONT_DZ_SEUIL, KD = STOCHDYN_CONTACT, ZB = Number(process.env.ZB ?? 0.30);

const dzH4 = (t) => (Number.isFinite(t.zscoreH4S0) && Number.isFinite(t.zscoreH4)) ? t.zscoreH4S0 - t.zscoreH4 : null;
const lisible = (t) => Number.isFinite(t.kH4S1) && Number.isFinite(t.kH1) && Number.isFinite(t.kdGapH1)
                    && Number.isFinite(t.zscoreH4) && dzH4(t) !== null;
const SG = (t) => t.side === "SELL" ? 1 : -1;
const kP4 = (t) => (SG(t) === 1 ? t.kH4S1 : 100 - t.kH4S1);
const kP1 = (t) => (SG(t) === 1 ? t.kH1 : 100 - t.kH1);
const zP  = (t) => t.zscoreH4 * SG(t);                    // `z H4` CLOTURE, du cote ou ca pousse
const a1 = (t) => kP4(t) < K4;            // 1  %K H4 CLOTURE n'a pas consomme
const a2 = (t) => dzH4(t) * SG(t) >= LO;  // 2  dz H4 LIVE pousse contre le pari
const a3 = (t) => kP1(t) < K1;            // 3  %K H1 LIVE n'a pas consomme
const a4 = (t) => t.kdGapH1 * SG(t) > KD; // 4  K-D H1 LIVE separe, contre le pari
const a5 = (t) => zP(t) > ZB;             // 5  z H4 CLOTURE deja du cote qui pousse
const AXES = [["1 %K H4 close < " + K4, a1], ["2 dz H4 >= " + LO, a2], ["3 %K H1 live < " + K1, a3],
              ["4 K-D H1 > " + KD, a4], ["5 z H4 close > " + ZB, a5]];
const cible = (t) => AXES.every(([, f]) => f(t));

const CONT = S.filter((t) => t.strategy === "CONT" && typeof t.R === "number");
const LIS = CONT.filter(lisible);
const P = LIS.filter(cible), REST = LIS.filter((t) => !cible(t));

const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const jour = (t) => `${t.asset}|${String(t.tsMT ?? "").slice(0, 10)}`;
const grappes = (a) => { const m = new Map(); for (const t of a) { const k = jour(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); } return m; };
const wrGrap = (a) => { const m = grappes(a); let g = 0; for (const [, v] of m) if (Rn(v) > 0) g++; return m.size ? 100 * g / m.size : NaN; };
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(30)}${String(a.length).padStart(6)}${String(grappes(a).size).padStart(7)}${wr(a).toFixed(2).padStart(9)} %${wrGrap(a).toFixed(1).padStart(8)} %${Rn(a).toFixed(1).padStart(9)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(30)}     —`;
const HEAD = `   ${"".padEnd(30)}${"tirs".padStart(6)}${"grap".padStart(7)}${"WR".padStart(10)}${"WRgrap".padStart(9)}${"R net".padStart(9)}${"R/tir".padStart(9)}`;
const B = (a) => a.filter((t) => t.side === "BUY"), V = (a) => a.filter((t) => t.side === "SELL");

console.log(`\n== POCHE 5 AXES — z H4 close > ${ZB} + dz H4 >= ${LO} + %K H4 close < ${K4} + %K H1 live < ${K1} + K-D H1 > ${KD} ==`);
console.log(`   carnet ${S.length} tirs · rang3 CONT ${CONT.length} · lisibles ${LIS.length}`);
console.log(`   REPERES : point mort 75,00 · carnet ${wr(S).toFixed(2)} · rang 3 ${wr(CONT).toFixed(2)}\n`);
console.log(HEAD);
console.log(L("LA CIBLE", P)); console.log(L("   dont BUY", B(P))); console.log(L("   dont SELL", V(P)));
console.log(L("RESTE DU RANG 3", REST)); console.log(L("   dont BUY", B(REST))); console.log(L("   dont SELL", V(REST)));

console.log(`\n   -- CHAQUE AXE SEUL --`); console.log(HEAD);
for (const [nm, f] of AXES) console.log(L(nm, LIS.filter(f)));
console.log(`\n   -- CHAQUE AXE RETIRE (est-il NECESSAIRE ?) --`); console.log(HEAD);
for (const [nm, f] of AXES) console.log(L("sans " + nm.slice(0, 1), LIS.filter((t) => AXES.filter(([, g]) => g !== f).every(([, g]) => g(t)))));

console.log(`\n   -- LES TROIS RETRAITS --`); console.log(HEAD);
const pire = (a, cle) => { const m = new Map(); for (const t of a) m.set(cle(t), (m.get(cle(t)) ?? 0) + t.R);
  let bk = null, bv = Infinity; for (const [k, v] of m) if (v < bv) { bv = v; bk = k; } return [bk, bv]; };
for (const [nm, cle] of [["grappe", jour], ["jour", (t) => String(t.tsMT ?? "").slice(0, 10)], ["actif", (t) => t.asset]]) {
  const [k, v] = pire(P, cle);
  console.log(L(`sans la pire ${nm}`, P.filter((t) => cle(t) !== k)) + `   <- ${k} (${(v ?? 0).toFixed(1)} R)`);
}

// -- BALAYAGE SUR `z H4 close`, LES 4 AUTRES AXES TENUS — CUMULATIF PUIS MARGINAL --
{
  const base = (t) => a1(t) && a2(t) && a3(t) && a4(t);
  const Z = [0.00, 0.30, 0.60, 1.05, 1.55, 2.15, 3.00, Infinity];
  console.log(`\n   -- BALAYAGE z H4 close > X (4 autres axes tenus) — CUMULATIF --`); console.log(HEAD);
  for (const x of Z.slice(0, -1)) console.log(L(`z > ${x.toFixed(2)}`, LIS.filter((t) => base(t) && zP(t) > x)));
  console.log(`\n   -- LE MEME, EN BANDES MARGINALES --`); console.log(HEAD);
  for (let i = 0; i < Z.length - 1; i++)
    console.log(L(`[${Z[i].toFixed(2)} . ${Z[i + 1] === Infinity ? "+inf" : Z[i + 1].toFixed(2)}[`,
      LIS.filter((t) => base(t) && zP(t) >= Z[i] && zP(t) < Z[i + 1])));
  console.log(L(`z <= 0 (l autre cote)`, LIS.filter((t) => base(t) && zP(t) <= 0)));
}

console.log(`\n   -- LA CIBLE PAR ACTIF --`); console.log(HEAD);
for (const as of [...new Set(P.map((t) => t.asset))].sort((x, y) => P.filter((t) => t.asset === y).length - P.filter((t) => t.asset === x).length))
  console.log(L(as, P.filter((t) => t.asset === as)));
console.log("");
