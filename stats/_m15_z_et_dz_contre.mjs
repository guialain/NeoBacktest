// _m15_z_et_dz_contre.mjs — M15 : le prix est du mauvais cote de sa moyenne ET il s'en eloigne VITE.
// =============================================================================================
// LA DEMANDE (owner 21/08) : « teste zm15 > 0,3 + deltam15 > 0,4, cont sell ». Pose en MIROIR.
//   SELL : `z M15 live > +0,30`  ET  `dz M15 > +0,40`
//   BUY  : `z M15 live < -0,30`  ET  `dz M15 < -0,40`
//
// /!\ « deltam15 » EST LU COMME LE `dz` M15, PAS LE `dK`, ET C'EST UNE DEDUCTION QUI S'ARGUMENTE :
//   le `dK` se mesure en POINTS de %K, ou la bande morte `deltaKBand` va deja jusqu'a **4,4**.
//   Un seuil a `0,4` y serait a l'interieur de `FLAT` — il ne selectionnerait rien. Sur le `dz`,
//   dont la mediane mesuree vaut ~0,25 en M15, `0,4` est un seuil qui MORD. Une seule lecture a
//   du sens. /!\ Si l'intention etait le `dK`, la mesure ci-dessous ne repond pas a la question.
//
// LA FIGURE : les deux termes sont de MEME SIGNE, donc le prix est deja du mauvais cote de sa
//   moyenne M15 pour ce trade ET il continue de s'en ecarter. En vocabulaire du depot : la colonne
//   `dz` est `*_ECARTE`. On vend un marche au-dessus de sa moyenne qui monte encore.
// ⭐ C'est la petite soeur de `cont-z-etire-h1-m15` (`z M15 > 2,15`), mais SEPT FOIS plus bas sur le
//   `z` et avec une condition de VITESSE en plus : la question est de savoir si la vitesse remplace
//   la distance.
//
// /!\ `dz` = celui du MOTEUR (`zscore_m15_s0 - zscore_m15`, INTRA-BARRE), PAS la colonne EA.
// /!\ CE FICHIER CLASSE. Seul le carnet prouve — d'ou la ventilation, dont `TIRE rang 3`.
// Usage : `node --max-old-space-size=12288 stats/_m15_z_et_dz_contre.mjs`  surcharges : `Z=0.3 DZ=0.4`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";

if (String(process.env.PRO_DIR_SRC ?? "regime") !== "regime") {
  console.log("\n STOP : `PRO_DIR_SRC` est pose.\n"); process.exit(1);
}
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const ZB = Number(process.env.Z ?? 0.30), DZ = Number(process.env.DZ ?? 0.40);

const rawOf = (f) => {
  const txt = fs.readFileSync(path.join(MATRIX, f), "utf8").split("\n");
  const h = txt[0].split(";");
  const ix = ["timestamp", "zscore_m15_s0", "zscore_m15"].map((c) => h.indexOf(c));
  const m = new Map();
  for (let n = 1; n < txt.length; n++) {
    const v = txt[n].split(";"); if (v.length < h.length) continue;
    const z0 = Number(v[ix[1]]), zp = Number(v[ix[2]]);
    m.set(v[ix[0]], { z0, dz: z0 - zp });
  }
  return m;
};

const ALL = [];
let rows = 0, lis = 0;
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const raw = rawOf(f);
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "all-rows")) {
    rows++;
    if (!Number.isFinite(x.regDir) || x.regDir === 0) continue;
    const side = x.regDir > 0 ? "BUY" : "SELL";
    const r = raw.get(String(x.tsMT ?? ""));
    if (!r || !Number.isFinite(r.z0) || !Number.isFinite(r.dz)) continue;
    lis++;
    const S = side === "SELL" ? 1 : -1;              // le SELL est le sens brut
    if (!(r.z0 * S > ZB && r.dz * S > DZ)) continue;
    const w = p.walk({ ...x, side });
    if (!w || typeof w.R !== "number") continue;
    const destin = x.selStrategy === "CONT" ? "TIRE rang 3"
                 : x.selStrategy ? `pris par ${x.selStrategy}`
                 : x.waitNature === "cont-counter-cross" ? "cont-counter-cross"
                 : x.waitNature === "cont-below-min" ? "MIN_CONT (score)"
                 : x.waitNature === "cont-vetoed" ? "VETO voisin"
                 : (x.waitNature ?? "autre");
    ALL.push({ asset, ts: x.tsMT, side, z: r.z0 * S, dz: r.dz * S, R: w.R, destin });
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

console.log(`\n== TOUTE LA POPULATION — z M15 > ${ZB} ET dz M15 > ${DZ} (les deux CONTRE le pari) ==`);
console.log(`   SELL = sens brut · BUY = miroir (z < -${ZB}, dz < -${DZ})`);
console.log(`   ${rows} lignes · ${lis} avec cote et capteurs M15 · capacite INFINIE, sans spacing · point mort 75,00\n`);
console.log(HEAD);
console.log(L("LA FIGURE", ALL)); console.log(L("   SELL (brut)", V(ALL))); console.log(L("   BUY (miroir)", B(ALL)));

console.log(`\n   -- OU MEURENT CES BARRES --`); console.log(HEAD);
for (const d of [...new Set(ALL.map((t) => t.destin))].sort((a, b) => ALL.filter((t) => t.destin === b).length - ALL.filter((t) => t.destin === a).length)) {
  const a = ALL.filter((t) => t.destin === d);
  console.log(L(d, a)); console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a)));
}
console.log(`\n   -- BALAYAGE MARGINAL du z (a dz > ${DZ}) --`); console.log(HEAD);
{
  const bd = [ZB, 0.6, 1.05, 1.55, 2.15, Infinity];
  for (let i = 0; i < bd.length - 1; i++) {
    const a = ALL.filter((t) => t.z > bd[i] && t.z <= bd[i + 1]);
    console.log(L(`z ]${bd[i]} . ${bd[i + 1] === Infinity ? "+inf" : bd[i + 1]}]`, a));
    if (a.length) { console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a))); }
  }
}
console.log(`\n   -- BALAYAGE MARGINAL du dz (a z > ${ZB}) --`); console.log(HEAD);
{
  const bd = [DZ, 0.6, 0.9, 1.3, 2.0, Infinity];
  for (let i = 0; i < bd.length - 1; i++) {
    const a = ALL.filter((t) => t.dz > bd[i] && t.dz <= bd[i + 1]);
    console.log(L(`dz ]${bd[i]} . ${bd[i + 1] === Infinity ? "+inf" : bd[i + 1]}]`, a));
    if (a.length) { console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a))); }
  }
}
console.log("");

// -- BALAYAGE DEMANDE (owner) : `z M15 > 0,5 / 1,0 / 1,5` a `dz M15 > 0,40`, CUMULATIF PUIS MARGINAL
//   /!\ La collecte se fait a `z > ${ZB}` : tous les seuils demandes sont AU-DESSUS, donc filtrables
//   sans re-collecter. Un seuil SOUS `ZB` rendrait un resultat TRONQUE en silence — d'ou ce controle.
{
  const SEUILS = [0.5, 1.0, 1.5];
  if (SEUILS.some((z) => z < ZB)) { console.log(`   /!\ SEUIL SOUS LA COLLECTE (${ZB}) — resultat tronque`); }
  console.log(`   ===== BALAYAGE z M15 (a dz > ${DZ}) — CUMULATIF =====`); console.log(HEAD);
  for (const z of SEUILS) {
    const a = ALL.filter((t) => t.z > z);
    console.log(L(`z > ${z.toFixed(2)}`, a)); console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a)));
    const tir = a.filter((t) => t.destin === "TIRE rang 3");
    console.log(L("     dont TIRE (3)", tir));
    if (tir.length) { console.log(L("        SELL", V(tir))); console.log(L("        BUY", B(tir))); }
  }
  console.log(`\n   ===== LE MEME, EN BANDES MARGINALES =====`); console.log(HEAD);
  const bd = [ZB, 0.5, 1.0, 1.5, Infinity];
  for (let i = 0; i < bd.length - 1; i++) {
    const a = ALL.filter((t) => t.z > bd[i] && t.z <= bd[i + 1]);
    console.log(L(`z ]${bd[i]} . ${bd[i + 1] === Infinity ? "+inf" : bd[i + 1].toFixed(2)}]`, a));
    if (a.length) { console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a))); }
  }
  console.log("");
}
