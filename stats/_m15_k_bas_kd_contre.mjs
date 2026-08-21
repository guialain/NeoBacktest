// _m15_k_bas_kd_contre.mjs — M15 : le `%K` n'a pas consomme sa bande ET le `K-D` pousse CONTRE.
// =============================================================================================
// LA DEMANDE (owner 21/08) : « veto cont sell, km15 < 60, k-d > 2,1, m15 ». Pose en MIROIR
//   (« toutes les regles sont symetriques », owner) :
//     SELL : `%K M15 live < 60`  ET  `K-D M15 > +2,1`
//     BUY  : `%K M15 live > 40`  ET  `K-D M15 < -2,1`
//
// LA FIGURE : sur l'horloge de l'ENTREE, la ligne rapide est passee de l'autre cote de la lente
//   DANS LE SENS CONTRAIRE AU PARI, et franchement (hors de la bande de contact `STOCHDYN_CONTACT`),
//   pendant que le `%K` n'a PAS consomme sa bande du cote du pari. Le contre-mouvement demarre et
//   il a de la place. C'est la meme famille que `cont-deux-horloges-contre` (H1), une horloge plus bas.
//
// /!\ `2,1` = `STOCHDYN_CONTACT`, IMPORTE et jamais recopie : `> 2,1` veut dire « strictement HORS
//   de la bande de contact », pas un nombre choisi. C'est une frontiere de MECANISME.
// /!\ CE FICHIER CLASSE DES CANDIDATS. « LES BARRES NE SONT PAS LES TIRS » — seul le carnet prouve.
//   On rend donc AUSSI la ventilation par etage, dont la ligne `TIRE rang 3` qui est la seule que
//   le veto toucherait vraiment.
// Usage : `node --max-old-space-size=12288 stats/_m15_k_bas_kd_contre.mjs`   surcharges : `K=60`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
const { STOCHDYN_CONTACT } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js");

if (String(process.env.PRO_DIR_SRC ?? "regime") !== "regime") {
  console.log("\n STOP : `PRO_DIR_SRC` est pose, le cote serait FAUX en silence.\n"); process.exit(1);
}
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const KB = Number(process.env.K ?? 60), KD = Number(process.env.KD ?? STOCHDYN_CONTACT);

const rawOf = (f) => {
  const txt = fs.readFileSync(path.join(MATRIX, f), "utf8").split("\n");
  const h = txt[0].split(";");
  const ix = ["timestamp", "stoch_k_m15_s0", "stoch_d_m15_s0"].map((c) => h.indexOf(c));
  const m = new Map();
  for (let n = 1; n < txt.length; n++) {
    const v = txt[n].split(";"); if (v.length < h.length) continue;
    const k0 = Number(v[ix[1]]), d0 = Number(v[ix[2]]);
    m.set(v[ix[0]], { k0, kd0: k0 - d0 });
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
    if (!r || !Number.isFinite(r.k0) || !Number.isFinite(r.kd0)) continue;
    lis++;
    const S = side === "SELL" ? 1 : -1;               // le SELL est le sens brut
    const kP = S === 1 ? r.k0 : 100 - r.k0;           // le %K DU COTE DU PARI
    const kdOr = r.kd0 * S;                           // le K-D CONTRE le pari
    if (!(kP < KB && kdOr > KD)) continue;
    const w = p.walk({ ...x, side });
    if (!w || typeof w.R !== "number") continue;
    const destin = x.selStrategy === "CONT" ? "TIRE rang 3"
                 : x.selStrategy ? `pris par ${x.selStrategy}`
                 : x.waitNature === "cont-counter-cross" ? "cont-counter-cross"
                 : x.waitNature === "cont-below-min" ? "MIN_CONT (score)"
                 : x.waitNature === "cont-vetoed" ? "VETO voisin"
                 : (x.waitNature ?? "autre");
    ALL.push({ asset, ts: x.tsMT, side, k: r.k0, kP, kdOr, R: w.R, destin });
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

console.log(`\n== TOUTE LA POPULATION — %K M15 < ${KB} (cote du pari) ET K-D M15 > ${KD} (CONTRE le pari) ==`);
console.log(`   SELL = sens brut · BUY = miroir (%K > ${100 - KB}, K-D < -${KD}) · ${KD} = STOCHDYN_CONTACT`);
console.log(`   ${rows} lignes · ${lis} avec cote et capteurs · walk capacite INFINIE, sans spacing · point mort 75,00\n`);
console.log(HEAD);
console.log(L("LA FIGURE", ALL)); console.log(L("   SELL (brut)", V(ALL))); console.log(L("   BUY (miroir)", B(ALL)));

console.log(`\n   -- OU MEURENT CES BARRES --`); console.log(HEAD);
for (const d of [...new Set(ALL.map((t) => t.destin))].sort((a, b) => ALL.filter((t) => t.destin === b).length - ALL.filter((t) => t.destin === a).length)) {
  const a = ALL.filter((t) => t.destin === d);
  console.log(L(d, a)); console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a)));
}

console.log(`\n   -- BALAYAGE MARGINAL du %K (a K-D > ${KD}), PAR COTE --`); console.log(HEAD);
{
  const bd = [0, 20, 30, 40, 50, 60];
  for (let i = 0; i < bd.length - 1; i++) {
    const a = ALL.filter((t) => t.kP >= bd[i] && t.kP < bd[i + 1]);
    console.log(L(`%K [${bd[i]} . ${bd[i + 1]}[`, a));
    if (a.length) { console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a))); }
  }
}
console.log(`\n   -- BALAYAGE MARGINAL du K-D oriente (a %K < ${KB}) --`); console.log(HEAD);
{
  const bd = [KD, 5, 10, 15, 25, Infinity];
  for (let i = 0; i < bd.length - 1; i++) {
    const a = ALL.filter((t) => t.kdOr > bd[i] && t.kdOr <= bd[i + 1]);
    console.log(L(`K-D ]${bd[i]} . ${bd[i + 1] === Infinity ? "+inf" : bd[i + 1]}]`, a));
    if (a.length) { console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a))); }
  }
}
console.log("");
