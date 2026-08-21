// _z_m15_h1_population.mjs — LES DEUX `z` SUR TOUTE LA POPULATION, PAS SUR LE RESIDU DU CARNET.
// =============================================================================================
// LA REMARQUE OWNER (21/08) : « le nombre de trades me parait trop bas ». Elle est juste, et c'est
//   la MEME correction que ce matin : les TIRS du carnet sont ce qui survit a `MIN_CONT`, aux
//   vetos voisins, a la pause US **et au spacing** (qui jette a lui seul ~69 % des `fires`).
//   Mesurer une figure sur ce residu, c'est mesurer ce qu'elle AJOUTE, pas ce qu'elle DECRIT.
//
// ICI ON MESURE SUR **TOUTES LES LIGNES** qui ont un cote (`regDir != 0`), avec un `walk` a
//   capacite infinie et sans spacing. Ce n'est PAS ce que le moteur ferait — c'est la valeur
//   INFORMATIVE des capteurs. « LES BARRES NE SONT PAS LES TIRS » : ce fichier CLASSE, il ne
//   prouve pas. Seul le carnet re-couru chiffre un geste.
//
// Le cote du rang 3 suit `+regDir` ; le BUY est le SENS BRUT, le SELL le miroir derive.
// Usage : `node --max-old-space-size=12288 stats/_z_m15_h1_population.mjs`
//         surcharges : `ZM15=2.15 ZH1=2.30`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";

if (String(process.env.PRO_DIR_SRC ?? "regime") !== "regime") {
  console.log("\n STOP : `PRO_DIR_SRC` est pose, la deduction du cote serait FAUSSE en silence.\n");
  process.exit(1);
}
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const ZM15 = Number(process.env.ZM15 ?? 2.15), ZH1 = Number(process.env.ZH1 ?? 2.30);

// on relit le CSV pour `zscore_m15_s0` : il vit sur le record de SIGNAL, pas sur le fantome all-rows
const rawOf = (f) => {
  const txt = fs.readFileSync(path.join(MATRIX, f), "utf8").split("\n");
  const h = txt[0].split(";");
  const iT = h.indexOf("timestamp"), iM = h.indexOf("zscore_m15_s0"), iH = h.indexOf("zscore_h1_s0");
  const m = new Map();
  for (let n = 1; n < txt.length; n++) {
    const v = txt[n].split(";"); if (v.length < h.length) continue;
    m.set(v[iT], { zm: Number(v[iM]), zh: Number(v[iH]) });
  }
  return m;
};

const ALL = [];
let rows = 0, avecCote = 0;
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const raw = rawOf(f);
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "all-rows")) {
    rows++;
    if (!Number.isFinite(x.regDir) || x.regDir === 0) continue;
    const side = x.regDir > 0 ? "BUY" : "SELL";
    const r = raw.get(String(x.tsMT ?? ""));
    if (!r || !Number.isFinite(r.zm) || !Number.isFinite(r.zh)) continue;
    avecCote++;
    const S = side === "BUY" ? 1 : -1;
    const zm = r.zm * S, zh = r.zh * S;
    if (!(zm > ZM15 || zh > ZH1)) continue;          // on ne `walk` que ce qui sert
    const w = p.walk({ ...x, side });
    if (!w || typeof w.R !== "number") continue;
    const destin = x.selStrategy === "CONT" ? "TIRE rang 3"
                 : x.selStrategy ? `pris par ${x.selStrategy}`
                 : x.waitNature === "cont-counter-cross" ? "cont-counter-cross"
                 : x.waitNature === "cont-below-min" ? "MIN_CONT (score)"
                 : x.waitNature === "cont-vetoed" ? "VETO voisin"
                 : (x.waitNature ?? "autre");
    ALL.push({ asset, ts: x.tsMT, side, zm, zh, R: w.R, destin });
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

const m15 = ALL.filter((t) => t.zm > ZM15), h1 = ALL.filter((t) => t.zh > ZH1);
const deux = ALL.filter((t) => t.zm > ZM15 && t.zh > ZH1);
const m15Seul = ALL.filter((t) => t.zm > ZM15 && !(t.zh > ZH1));
const h1Seul = ALL.filter((t) => t.zh > ZH1 && !(t.zm > ZM15));

console.log(`\n== LES DEUX \`z\` SUR TOUTE LA POPULATION (pas le carnet) ==`);
console.log(`   ${rows} lignes balayees · ${avecCote} avec un cote et les deux capteurs`);
console.log(`   BUY = sens brut · SELL = miroir derive · walk a capacite INFINIE, SANS spacing\n`);
console.log(HEAD);
for (const [nm, a] of [[`z M15 > ${ZM15}`, m15], [`z H1 > ${ZH1}`, h1],
                       [`LES DEUX (ET)`, deux], [`z M15 SEUL`, m15Seul], [`z H1 SEUL`, h1Seul],
                       [`L'UN OU L'AUTRE (OU)`, ALL]]) {
  console.log(L(nm, a)); console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a)));
}

console.log(`\n   -- OU MEURENT LES BARRES DE \`z M15 > ${ZM15}\` --`); console.log(HEAD);
for (const d of [...new Set(m15.map((t) => t.destin))].sort((a, b) => m15.filter((t) => t.destin === b).length - m15.filter((t) => t.destin === a).length)) {
  const a = m15.filter((t) => t.destin === d);
  console.log(L(d, a)); console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a)));
}
console.log(`\n   -- OU MEURENT LES BARRES DE \`z H1 > ${ZH1}\` --`); console.log(HEAD);
for (const d of [...new Set(h1.map((t) => t.destin))].sort((a, b) => h1.filter((t) => t.destin === b).length - h1.filter((t) => t.destin === a).length)) {
  const a = h1.filter((t) => t.destin === d);
  console.log(L(d, a)); console.log(L("     BUY", B(a))); console.log(L("     SELL", V(a)));
}
console.log("");
