// _cont_figure_brute_miroir.mjs — LA FIGURE SUR LES CANDIDATS, **LES DEUX COTES EN MIROIR**.
// =============================================================================================
// LE 2e CRIBLE DU DEPOT : « les deux cotes doivent bouger dans le MEME sens ». Une figure qui ne
//   marche que d'un cote sur une fenetre de 28 jours decrit une SAISON, pas un mecanisme — et
//   « un miroir sur un cote JAMAIS MESURE, c'est la que le degat arrive ».
//
// LA FIGURE, MIROIR DERIVE — aucun nombre par cote, `u = SELL ? x : -x` et `kP = SELL ? k : 100-k` :
//   SELL : z H4 close > +0,30 · dz H4 live > +0,20 · %K H1 live < 70 · K-D H1 > +2,1
//   BUY  : z H4 close < -0,30 · dz H4 live < -0,20 · %K H1 live > 30 · K-D H1 < -2,1
//   (« la structure H4 est deja du cote qui pousse CONTRE mon pari et elle s'y enfonce, le H1
//     pousse dans le meme sens, et aucun des deux oscillateurs n'a consomme sa bande »)
//
// POPULATION : les CANDIDATS du rang 3 (cote = `+regDir`), avant `MIN_CONT` et avant les vetos.
//   Ce fichier CLASSE des candidats — « LES BARRES NE SONT PAS LES TIRS ». Seul le carnet prouve.
//
// Usage : `node --max-old-space-size=12288 stats/_cont_figure_brute_miroir.mjs`
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
const K4L = Number(process.env.K4L ?? 70);

const dzH4 = (x) => (Number.isFinite(x.zscoreH4S0) && Number.isFinite(x.zscoreH4)) ? x.zscoreH4S0 - x.zscoreH4 : null;
const lisible = (x) => Number.isFinite(x.kH1) && Number.isFinite(x.kdGapH1) && Number.isFinite(x.zscoreH4) && Number.isFinite(x.kH4) && dzH4(x) !== null;
const SG = (side) => side === "SELL" ? 1 : -1;                 // le signe qui oriente, une seule fois
const c1 = (x, s) => x.zscoreH4 * SG(s) > ZB;
const c2 = (x, s) => dzH4(x) * SG(s) > LO;
const c3 = (x, s) => (SG(s) === 1 ? x.kH1 : 100 - x.kH1) < K1;
const c4 = (x, s) => x.kdGapH1 * SG(s) > KD;
const c5 = (x, s) => (SG(s) === 1 ? x.kH4 : 100 - x.kH4) < K4L;   // %K H4 LIVE
const AXES = [[`1 z H4 > ${ZB}`, c1], [`2 dz H4 > ${LO}`, c2], [`3 %K H1 < ${K1}`, c3], [`4 K-D H1 > ${KD}`, c4], [`5 %K H4 live < ${K4L}`, c5]];
const figure = (x, s) => AXES.every(([, f]) => f(x, s));

const CAND = [];
let rows = 0;
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "all-rows")) {
    rows++;
    if (!Number.isFinite(x.regDir) || x.regDir === 0) continue;
    const side = x.regDir > 0 ? "BUY" : "SELL";        // le rang 3 suit `+regDir`
    if (!lisible(x) || !figure(x, side)) continue;
    const r = p.walk({ ...x, side });
    if (!r || typeof r.R !== "number") continue;
    const destin = x.selStrategy === "CONT" ? "TIRE (rang 3)"
                 : x.selStrategy ? `pris par ${x.selStrategy}`
                 : x.waitNature === "cont-counter-cross" ? "cont-counter-cross"
                 : x.waitNature === "cont-below-min" ? "MIN_CONT (score)"
                 : x.waitNature === "cont-vetoed" ? "VETO voisin"
                 : (x.waitNature ?? "autre");
    CAND.push({ ...x, asset, side, R: r.R, destin });
  }
}
const V = CAND.filter((t) => t.side === "SELL"), B = CAND.filter((t) => t.side === "BUY");

const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const jour = (t) => `${t.asset}|${String(t.tsMT ?? "").slice(0, 10)}`;
const grap = (a) => new Set(a.map(jour)).size;
const wrG = (a) => { const m = new Map(); for (const t of a) { const k = jour(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  let g = 0; for (const [, v] of m) if (Rn(v) > 0) g++; return m.size ? 100 * g / m.size : NaN; };
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(24)}${String(a.length).padStart(7)}${String(grap(a)).padStart(6)}${wr(a).toFixed(2).padStart(9)} %${wrG(a).toFixed(1).padStart(8)} %${Rn(a).toFixed(1).padStart(9)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(24)}      —`;
const HEAD = `   ${"".padEnd(24)}${"barres".padStart(7)}${"grap".padStart(6)}${"WR".padStart(10)}${"WRgrap".padStart(9)}${"R".padStart(9)}${"R/barre".padStart(9)}`;

console.log(`\n== LA FIGURE SUR LES CANDIDATS — LES DEUX COTES, MIROIR DERIVE ==`);
console.log(`   SELL : z > +${ZB} · dz > +${LO} · %K H1 < ${K1} · K-D > +${KD}`);
console.log(`   SELL : + %K H4 live < ${K4L}   |   BUY : %K H4 live > ${100 - K4L}`);
console.log(`   BUY  : z < -${ZB} · dz < -${LO} · %K H1 > ${100 - K1} · K-D < -${KD}`);
console.log(`   ${rows} lignes balayees\n`);
console.log(HEAD);
console.log(L("LES DEUX COTES", CAND));
console.log(L("   SELL (dicte)", V));
console.log(L("   BUY  (miroir)", B));

console.log(`\n   -- A QUEL ETAGE, PAR COTE --`); console.log(HEAD);
for (const d of [...new Set(CAND.map((t) => t.destin))].sort((a, b) => CAND.filter((t) => t.destin === b).length - CAND.filter((t) => t.destin === a).length)) {
  console.log(L(d, CAND.filter((t) => t.destin === d)));
  console.log(L("     SELL", V.filter((t) => t.destin === d)));
  console.log(L("     BUY", B.filter((t) => t.destin === d)));
}

console.log(`\n   -- LES TROIS RETRAITS, PAR COTE --`); console.log(HEAD);
const pire = (a, cle) => { const m = new Map(); for (const t of a) m.set(cle(t), (m.get(cle(t)) ?? 0) + t.R);
  let bk = null, bv = Infinity; for (const [k, v] of m) if (v < bv) { bv = v; bk = k; } return [bk, bv]; };
for (const [lbl, a] of [["SELL", V], ["BUY", B]]) {
  for (const [nm, cle] of [["grappe", jour], ["jour", (t) => String(t.tsMT ?? "").slice(0, 10)], ["actif", (t) => t.asset]]) {
    const [k, v] = pire(a, cle);
    console.log(L(`${lbl} sans pire ${nm}`, a.filter((t) => cle(t) !== k)) + `   <- ${k} (${(v ?? 0).toFixed(1)} R)`);
  }
}

console.log(`\n   -- LES GRAPPES, PAR COTE (les 10 plus grosses de chaque) --`);
for (const [lbl, a] of [["SELL", V], ["BUY", B]]) {
  const m = new Map(); for (const t of a) { const k = jour(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  console.log(`   ${lbl} : ${m.size} grappes pour ${a.length} barres`);
  for (const [k, v] of [...m.entries()].sort((x, y) => y[1].length - x[1].length).slice(0, 10))
    console.log(`     ${k.padEnd(28)}${String(v.length).padStart(4)} barres · WR ${wr(v).toFixed(0).padStart(3)} % · R ${Rn(v).toFixed(1).padStart(7)}`);
}

console.log(`\n   -- PAR ACTIF, PAR COTE --`); console.log(HEAD);
for (const as of [...new Set(CAND.map((t) => t.asset))].sort((x, y) => CAND.filter((t) => t.asset === y).length - CAND.filter((t) => t.asset === x).length)) {
  console.log(L(as, CAND.filter((t) => t.asset === as)));
  console.log(L("     SELL", V.filter((t) => t.asset === as)));
  console.log(L("     BUY", B.filter((t) => t.asset === as)));
}
console.log("");
