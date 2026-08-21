// _m15_bas_converging_population.mjs — `%K M15 < 20` ET `kd = CONVERGING`, SUR TOUTE LA POPULATION.
// =============================================================================================
// LA DEMANDE (owner 21/08) : « sur toute la population mesure km15<20 et kd converging ».
//   => PAS le carnet. Les TIRS sont ce qui survit a `MIN_CONT`, aux vetos, a la pause US **et au
//   spacing** (69 % des `fires`) : ils disent ce qu'une figure AJOUTE, jamais ce qu'elle DECRIT.
//
// /!\ `kdCycleM15` N'EXISTE NI SUR LE SIGNAL NI SUR LE FANTOME — seuls `kdCycleH1` et `kdCycleH4`
//   y sont. On RECALCULE donc l'etat avec `kdCycleState` IMPORTE du detecteur, jamais recopie, sur
//   les colonnes `stoch_k|d_m15_s0|s1` du CSV.
// /!\ ET IL FAUT SAVOIR CE QUE `CONVERGING` PEUT ATTRAPER : `kdCycleState` teste dans l'ordre
//   `CROSS` (flip de signe) -> `CONTACT` (|kd0| <= 2,1) -> `DIVERGING`/`CONVERGING` (variation de
//   l'ecart au-dela de 2,1) -> `STABLE`. Les deux premiers OMBRENT les suivants : en H4 c'est ce
//   qui rend `CONTACT` inatteignable (51/51 en `CROSS`, mesure du 21/08). On CONTROLE donc la
//   population des 5 etats avant de lire le WR — une borne se verifie comme ATTEINTE.
//
// ⭐ ORIENTATION : le SELL est le sens brut (`%K` BAS pour une vente), le BUY est le miroir
//   (`%K > 80`). `CONVERGING` est une MAGNITUDE (variation de |K-D|), donc NON SIGNE : il ne se
//   miroite pas, il vaut a l'identique des deux cotes. C'est voulu, pas un oubli.
// /!\ CE FICHIER CLASSE DES CANDIDATS, IL NE PROUVE PAS. Seul le carnet re-couru chiffre un geste.
// Usage : `node --max-old-space-size=12288 stats/_m15_bas_converging_population.mjs`
//         surcharges : `K=20`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
const { kdCycleState, KD_CYCLE_DEADBAND } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js");

if (String(process.env.PRO_DIR_SRC ?? "regime") !== "regime") {
  console.log("\n STOP : `PRO_DIR_SRC` est pose, la deduction du cote serait FAUSSE en silence.\n");
  process.exit(1);
}
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const KB = Number(process.env.K ?? 20);
// ⭐ L'ETAT est parametrable (owner 21/08) : la meme sonde sert CONVERGING, CONTACT, DIVERGING…
//   /!\ Chaque etat a sa propre atteignabilite — le tableau de controle ci-dessous la redonne
//   A CHAQUE RUN, pour qu'on ne mesure jamais une figure ombree sans le voir.
const ETAT = String(process.env.ETAT ?? "CONVERGING");

const rawOf = (f) => {
  const txt = fs.readFileSync(path.join(MATRIX, f), "utf8").split("\n");
  const h = txt[0].split(";");
  const ix = ["timestamp", "stoch_k_m15_s0", "stoch_d_m15_s0", "stoch_k_m15_s1", "stoch_d_m15_s1"].map((c) => h.indexOf(c));
  const m = new Map();
  for (let n = 1; n < txt.length; n++) {
    const v = txt[n].split(";"); if (v.length < h.length) continue;
    const [k0, d0, k1, d1] = ix.slice(1).map((i) => Number(v[i]));
    m.set(v[ix[0]], { k0, kd0: k0 - d0, kd1: k1 - d1 });
  }
  return m;
};

const ALL = [];
let rows = 0, avecCote = 0;
const etats = {};
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const raw = rawOf(f);
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "all-rows")) {
    rows++;
    if (!Number.isFinite(x.regDir) || x.regDir === 0) continue;
    const side = x.regDir > 0 ? "BUY" : "SELL";
    const r = raw.get(String(x.tsMT ?? ""));
    if (!r || !Number.isFinite(r.k0) || !Number.isFinite(r.kd0) || !Number.isFinite(r.kd1)) continue;
    avecCote++;
    const et = kdCycleState(r.kd0, r.kd1);
    etats[et ?? "null"] = (etats[et ?? "null"] ?? 0) + 1;
    const S = side === "SELL" ? 1 : -1;
    const kP = S === 1 ? r.k0 : 100 - r.k0;
    if (!(kP < KB && et === ETAT)) continue;
    const w = p.walk({ ...x, side });
    if (!w || typeof w.R !== "number") continue;
    const destin = x.selStrategy === "CONT" ? "TIRE rang 3"
                 : x.selStrategy ? `pris par ${x.selStrategy}`
                 : x.waitNature === "cont-counter-cross" ? "cont-counter-cross"
                 : x.waitNature === "cont-below-min" ? "MIN_CONT (score)"
                 : x.waitNature === "cont-vetoed" ? "VETO voisin"
                 : (x.waitNature ?? "autre");
    ALL.push({ asset, ts: x.tsMT, side, k: r.k0, kP, kd0: r.kd0, R: w.R, destin });
  }
}

const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const jour = (t) => `${t.asset}|${String(t.ts ?? "").slice(0, 10)}`;
const grap = (a) => new Set(a.map(jour)).size;
const wrG = (a) => { const m = new Map(); for (const t of a) { const k = jour(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  let g = 0; for (const [, v] of m) if (Rn(v) > 0) g++; return m.size ? 100 * g / m.size : NaN; };
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(26)}${String(a.length).padStart(7)}${String(grap(a)).padStart(6)}${wr(a).toFixed(2).padStart(9)} %${wrG(a).toFixed(1).padStart(8)} %${Rn(a).toFixed(1).padStart(10)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(26)}      —`;
const HEAD = `   ${"".padEnd(26)}${"barres".padStart(7)}${"grap".padStart(6)}${"WR".padStart(10)}${"WRgrap".padStart(9)}${"R".padStart(10)}${"R/barre".padStart(9)}`;
const B = (a) => a.filter((t) => t.side === "BUY"), V = (a) => a.filter((t) => t.side === "SELL");

console.log(`\n== TOUTE LA POPULATION — %K M15 live < ${KB} (cote du pari) ET kd M15 = ${ETAT} ==`);
console.log(`   ${rows} lignes · ${avecCote} avec un cote et les capteurs M15`);
console.log(`   SELL = sens brut (%K < ${KB}) · BUY = miroir (%K > ${100 - KB}) · ${ETAT} est NON SIGNE (magnitude)`);
console.log(`   walk a capacite INFINIE, SANS spacing · point mort 75,00\n`);
console.log(`   -- CONTROLE D'ATTEIGNABILITE : les 5 etats de la roue K/D en M15 (deadband ${KD_CYCLE_DEADBAND}) --`);
const tot = Object.values(etats).reduce((a, b) => a + b, 0);
for (const [k, n] of Object.entries(etats).sort((a, b) => b[1] - a[1]))
  console.log(`     ${String(k).padEnd(12)}${String(n).padStart(8)}   ${(100 * n / tot).toFixed(2)} %`);

console.log(`\n`); console.log(HEAD);
console.log(L("LA FIGURE", ALL)); console.log(L("   SELL (brut)", V(ALL))); console.log(L("   BUY (miroir)", B(ALL)));

console.log(`\n   -- OU MEURENT CES BARRES --`); console.log(HEAD);
for (const d of [...new Set(ALL.map((t) => t.destin))].sort((a, b) => ALL.filter((t) => t.destin === b).length - ALL.filter((t) => t.destin === a).length)) {
  const a = ALL.filter((t) => t.destin === d);
  console.log(L(d, a)); console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a)));
}

console.log(`\n   -- BALAYAGE MARGINAL du %K M15 (a ${ETAT}), PAR COTE --`); console.log(HEAD);
console.log(`   (necessite un 2e passage — voir la sonde soeur si besoin d'un balayage complet)`);

console.log(`\n   -- PAR ACTIF --`); console.log(HEAD);
for (const as of [...new Set(ALL.map((t) => t.asset))].sort((x, y) => ALL.filter((t) => t.asset === y).length - ALL.filter((t) => t.asset === x).length))
  console.log(L(as, ALL.filter((t) => t.asset === as)));
console.log("");
