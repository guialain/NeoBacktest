// _cont_sell_figure_brute.mjs — LA FIGURE **AVANT** L'ENTONNOIR, PAS LE RESIDU DE 9 TIRS.
// =============================================================================================
// LA REMARQUE OWNER (21/08), ET ELLE EST JUSTE : « 9 tirs, c'est dans une population DEJA
//   selectionnee par le score min et DEJA couverte par d'autres vetos, donc relativise ».
//   => Les 9 tirs sont un RESIDU MARGINAL. Ils disent ce que la regle AJOUTE, pas ce qu'elle
//   DECRIT. Cette sonde mesure la figure sur les CANDIDATS du rang 3, avant `MIN_CONT` et avant
//   les vetos voisins, et montre a quel etage chaque tir est deja mort.
//
// LA DOCTRINE QUI PORTE LA REMARQUE : « un sigma faible NE DISQUALIFIE PAS une regle de
//   PROTECTION — un fait rare est DILUE par construction ; le juge d'un veto est le maxDD et la
//   QUEUE ». Une poche rare peut donc etre une VRAIE regle et rendre peu de tirs.
//
// MAIS LA CONTRE-DOCTRINE TIENT AUSSI, ET LES DEUX DOIVENT ETRE LUES ENSEMBLE :
//   « LES BARRES NE SONT PAS LES TIRS » (surestimation mesuree jusqu'a x7) et « une table CLASSE
//   des candidats, seul le CARNET RE-COURU prouve ». Ce fichier CLASSE. Il ne prouve pas.
//
// LA FIGURE (SELL seul, sens brut) :
//   `z H4 cloture > 0,30` · `dz H4 live > 0,20` · `%K H1 live < 70` · `K-D H1 > 2,1`
//
// Usage : `node --max-old-space-size=12288 stats/_cont_sell_figure_brute.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";

if (String(process.env.PRO_DIR_SRC ?? "regime") !== "regime") {
  console.log("\n STOP : `PRO_DIR_SRC` est pose, la deduction du cote serait FAUSSE en silence.\n");
  process.exit(1);
}

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const ZB = Number(process.env.ZB ?? 0.30), K1 = Number(process.env.K1 ?? 70);
const LO = Number(process.env.LO ?? 0.20), KD = Number(process.env.KD ?? 2.1);

const dzH4 = (x) => (Number.isFinite(x.zscoreH4S0) && Number.isFinite(x.zscoreH4)) ? x.zscoreH4S0 - x.zscoreH4 : null;
const lisible = (x) => Number.isFinite(x.kH1) && Number.isFinite(x.kdGapH1) && Number.isFinite(x.zscoreH4) && dzH4(x) !== null;
const c1 = (x) => x.zscoreH4 > ZB;
const c2 = (x) => dzH4(x) > LO;
const c3 = (x) => x.kH1 < K1;
const c4 = (x) => x.kdGapH1 > KD;
const AXES = [[`1 z H4 close > ${ZB}`, c1], [`2 dz H4 live > ${LO}`, c2], [`3 %K H1 live < ${K1}`, c3], [`4 K-D H1 > ${KD}`, c4]];
const figure = (x) => AXES.every(([, f]) => f(x));

// LE COTE DU RANG 3 : `+regDir`. Un candidat SELL est donc une barre a `regDir < 0`.
const CAND = [];
let rows = 0;
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "all-rows")) {
    rows++;
    if (!(x.regDir < 0)) continue;               // candidats SELL du rang 3
    if (!lisible(x)) continue;
    if (!figure(x)) continue;                    // on ne `walk` que la figure : le reste couterait pour rien
    const r = p.walk({ ...x, side: "SELL" });
    if (!r || typeof r.R !== "number") continue;
    // A QUEL ETAGE CETTE BARRE EST-ELLE MORTE ?
    const destin = x.selStrategy === "CONT" ? "TIRE (rang 3)"
                 : x.selStrategy ? `pris par ${x.selStrategy}`
                 : x.waitNature === "cont-counter-cross" ? "cont-counter-cross"
                 : x.waitNature === "cont-below-min" ? "MIN_CONT (score)"
                 : x.waitNature === "cont-vetoed" ? "VETO voisin"
                 : (x.waitNature ?? "autre");
    CAND.push({ ...x, asset, R: r.R, destin });
  }
}

const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const jour = (t) => `${t.asset}|${String(t.tsMT ?? "").slice(0, 10)}`;
const grap = (a) => new Set(a.map(jour)).size;
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(26)}${String(a.length).padStart(7)}${String(grap(a)).padStart(7)}${wr(a).toFixed(2).padStart(9)} %${Rn(a).toFixed(1).padStart(9)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(26)}      —`;
const HEAD = `   ${"".padEnd(26)}${"barres".padStart(7)}${"grap".padStart(7)}${"WR".padStart(10)}${"R".padStart(9)}${"R/barre".padStart(9)}`;

console.log(`\n== LA FIGURE SELL SUR LES **CANDIDATS**, PAS SUR LES TIRS ==`);
console.log(`   z H4 > ${ZB} · dz H4 > ${LO} · %K H1 < ${K1} · K-D H1 > ${KD}`);
console.log(`   ${rows} lignes balayees · ${CAND.length} barres SELL portent la figure\n`);
console.log(HEAD);
console.log(L("LA FIGURE, TOUT ETAGE", CAND));
console.log(`\n   -- A QUEL ETAGE CHAQUE BARRE MEURT --`); console.log(HEAD);
for (const d of [...new Set(CAND.map((t) => t.destin))].sort((a, b) => CAND.filter((t) => t.destin === b).length - CAND.filter((t) => t.destin === a).length))
  console.log(L(d, CAND.filter((t) => t.destin === d)));

console.log(`\n   -- LA FIGURE PAR GRAPPE (N signaux = 1 pari ?) --`);
{
  const m = new Map();
  for (const t of CAND) { const k = jour(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  const G = [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log(`   ${G.length} grappes pour ${CAND.length} barres — mediane ${G.length ? G[Math.floor(G.length / 2)][1].length : 0} barres/grappe`);
  let gg = 0; for (const [, v] of G) if (Rn(v) > 0) gg++;
  console.log(`   WR par GRAPPE : ${(100 * gg / (G.length || 1)).toFixed(2)} %   (contre ${wr(CAND).toFixed(2)} % par barre)`);
  console.log(`   les 8 plus grosses :`);
  for (const [k, v] of G.slice(0, 8)) console.log(`     ${k.padEnd(30)}${String(v.length).padStart(4)} barres · WR ${wr(v).toFixed(0).padStart(3)} % · R ${Rn(v).toFixed(1).padStart(6)}`);
}

console.log(`\n   -- LES TROIS RETRAITS SUR LA FIGURE --`); console.log(HEAD);
const pire = (a, cle) => { const m = new Map(); for (const t of a) m.set(cle(t), (m.get(cle(t)) ?? 0) + t.R);
  let bk = null, bv = Infinity; for (const [k, v] of m) if (v < bv) { bv = v; bk = k; } return [bk, bv]; };
for (const [nm, cle] of [["grappe", jour], ["jour", (t) => String(t.tsMT ?? "").slice(0, 10)], ["actif", (t) => t.asset]]) {
  const [k, v] = pire(CAND, cle);
  console.log(L(`sans la pire ${nm}`, CAND.filter((t) => cle(t) !== k)) + `   <- ${k} (${(v ?? 0).toFixed(1)} R)`);
}

console.log(`\n   -- LA FIGURE PAR ACTIF --`); console.log(HEAD);
for (const as of [...new Set(CAND.map((t) => t.asset))].sort((x, y) => CAND.filter((t) => t.asset === y).length - CAND.filter((t) => t.asset === x).length))
  console.log(L(as, CAND.filter((t) => t.asset === as)));
console.log("");
