// _cont_bande_contributeurs.mjs — QUELLE FAMILLE PORTE LE SCORE ③, DANS UNE BANDE ET PAR COTE.
// ============================================================================================
// 🎯 LA QUESTION (owner, 20/08) : le barème ③ ORDONNE le BUY (78 → 86 → 83 → 93 → 97 → 100 par
//   dizaine) et n'ordonne PAS le SELL (71 → 73 → 77 → 85 → **76** → **62**). Dans le haut de
//   l'échelle, là où le barème est le plus sûr de lui, le SELL est SOUS le point mort.
//   ⇒ QUELLE famille fabrique ces scores-là ?
//
// ⚠⚠⚠ LA MISE EN GARDE VIENT AVANT LES CHIFFRES, PARCE QU'ELLE LES DOMINE :
//   `[50·60[` SELL, C'EST **16 TIRS**. Aucune decomposition sur 16 trades ne prouve quoi que ce
//   soit — le plancher de bruit du depot est a ~0,3 pt de WR sur des milliers de tirs. Cette
//   bande est imprimee parce qu'elle a ete DEMANDEE, et `[40·50[` (104 tirs SELL) est imprimee a
//   cote pour qu'il existe un point de comparaison LISIBLE. ⛔ Ne rien dicter sur la 1re seule.
//
// ⚠ POPULATION = LE NIVEAU **FIRE**, PAS LE CARNET. `firedStrategy === "CONT"` = ce que la cascade
//   a retenu, AVANT cadence et spacing (qui jettent ~69 % des fires). Les effectifs sont donc plus
//   GROS que ceux du tableau par bande, qui comptait des trades OUVERTS. C'est volontaire : la
//   question porte sur le BAREME, et le barème agit au niveau fire. Ne pas comparer les deux
//   effectifs terme a terme.
//
// ⚠ `MIN_CONT=0` est impose ICI pour que les bandes basses existent. C'est un AUTRE run que la
//   prod — les tirs sont concurrents. On ne lit que des PARTS et des WR intra-bande, jamais un R
//   qu'on additionnerait au carnet.
//
// ⭐ CE QU'ON LIT, ET CE QU'ON NE LIT PAS : `cFamV` porte les 5 valeurs de familles APRES la
//   moyenne intra-famille et APRES le produit `kH4 × facteur kH1`. C'est bien la grandeur qui entre
//   dans la somme. ⚠ Une famille MUETTE sort de la somme (absente ≠ 0) ⇒ on compte sa presence
//   separement, sinon une famille rare et forte se lit comme une famille faible.
// ⚙ Usage : `node stats/_cont_bande_contributeurs.mjs`  ·  `BANDES=50:60,40:50,30:40`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "0";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";

const BANDES = String(process.env.BANDES ?? "50:60,40:50,30:40,20:30,10:20,0:10")
  .split(",").map((x) => x.split(":").map(Number));
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";

const T = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostBoxes: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "boxes")) {
    if (x.firedStrategy !== "CONT" || !x.cFamV) continue;
    if (!Number.isFinite(x.cConv)) continue;
    const r = p.walk({ ...x });
    if (!r || typeof r.R !== "number") continue;
    T.push({ ...x, asset, R: r.R });
  }
}

const NOMS = [...new Set(T.flatMap((t) => Object.keys(t.cFamV)))];
const wr = (a) => (a.length ? 100 * a.filter((t) => (t.R ?? 0) > 0).length / a.length : NaN);

console.log(`\n══ RANG ③ — QUI PORTE LE SCORE, PAR BANDE ET PAR COTE ══`);
console.log(`   ${T.length} tirs ③ au niveau FIRE (avant cadence/spacing) · MIN_CONT ${process.env.MIN_CONT}`);
console.log(`   familles vues : ${NOMS.join(" · ")}`);
console.log(`   ⚠ point mort 75,00 % — et une bande a 16 tirs ne prouve RIEN.`);

for (const [a, b] of BANDES) {
  for (const cote of ["SELL", "BUY"]) {
    const P = T.filter((t) => t.side === cote && Math.abs(t.cConv) >= a && Math.abs(t.cConv) < b);
    if (!P.length) continue;
    // ⭐ LA PART EST CALCULEE SUR LA SOMME DES FAMILLES PRESENTES, pas sur `cConv` : `cConv` est
    //   BONIFIE (`sContB = sCont + bonus`) et le bonus n'est pas une famille. Diviser par lui
    //   ferait des parts qui ne somment pas a 100 % sans qu'on sache pourquoi.
    const somme = P.reduce((s, t) => s + NOMS.reduce((u, n) => u + (Number.isFinite(t.cFamV[n]) ? t.cFamV[n] : 0), 0), 0);
    const bonusMoy = P.reduce((s, t) => s + (Number.isFinite(t.cBonus) ? t.cBonus : 0), 0) / P.length;
    console.log(`\n   ── [${a}·${b}[ ${cote} — ${P.length} tirs · WR ${wr(P).toFixed(2)} % · conviction moy ${(P.reduce((s,t)=>s+Math.abs(t.cConv),0)/P.length).toFixed(1)} (dont bonus ${bonusMoy.toFixed(1)}) ──`);
    console.log(`      ${"famille".padEnd(10)}${"parle".padStart(8)}${"note moy".padStart(10)}${"note moy".padStart(11)}${"part du".padStart(9)}`);
    console.log(`      ${"".padEnd(10)}${"".padStart(8)}${"(si parle)".padStart(10)}${"(globale)".padStart(11)}${"score".padStart(9)}`);
    const lignes = NOMS.map((n) => {
      const parle = P.filter((t) => Number.isFinite(t.cFamV[n]));
      const tot = parle.reduce((s, t) => s + t.cFamV[n], 0);
      return { n, np: parle.length, moySiParle: parle.length ? tot / parle.length : 0,
               moyGlob: tot / P.length, part: somme ? 100 * tot / somme : 0 };
    }).sort((x, y) => y.part - x.part);
    for (const L of lignes)
      console.log(`      ${L.n.padEnd(10)}${(100 * L.np / P.length).toFixed(0).padStart(6)} %${L.moySiParle.toFixed(2).padStart(10)}${L.moyGlob.toFixed(2).padStart(11)}${L.part.toFixed(1).padStart(8)} %`);
  }
}
console.log(`\n   ⚠ « part du score » = part de la SOMME DES FAMILLES (le bonus n'en est pas une).`);
console.log(`   ⚠ « parle » = la famille n'est pas muette. Une muette SORT de la somme, elle ne vaut pas 0.\n`);
