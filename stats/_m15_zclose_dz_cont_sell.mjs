// _m15_zclose_dz_cont_sell.mjs — `z M15 CLOTURE > 0,5` ET `dz M15 > 0,4`. LE CONT SELL MARCHE-T-IL ?
// =============================================================================================
// LA DICTEE (owner 21/08) : « zclose > 0,5 et deltaZ > 0,4 en m15, mesure si cont sell marche ».
//   SELL : `zscore_m15 (CLOTURE) > +0,50`  ET  `dz M15 > +0,40`
//   BUY  : `zscore_m15 (CLOTURE) < -0,50`  ET  `dz M15 < -0,40`      (miroir derive)
//
// ⭐ LES DEUX AXES N'ONT AUCUN TERME COMMUN, ET C'EST LE POINT : `zClosed` est CE QUI EST ETABLI,
//   `dz = z_s0 - zClosed` est CE QUI SE PASSE MAINTENANT. C'est exactement la decomposition que le
//   depot a imposee au ZScore Expert (v2 -> v3) parce que `z live` et `dz` PARTAGEAIENT `z_s0` et
//   laissaient le `dz` choisir sa propre ligne. Ici la mesure est donc PROPRE par construction.
//   /!\ Consequence a savoir : `z live` vaut alors > 0,90 (0,50 + 0,40) — la figure est plus HAUTE
//   qu'elle n'en a l'air.
//
// LA FIGURE, EN MOTS : le regime est baissier (le cote vient de `regDir`), donc on VEND. Mais a la
//   derniere cloture M15 le prix etait DEJA un demi-sigma AU-DESSUS de sa moyenne, et depuis il en
//   a repris quatre dixiemes de plus. Ce n'est plus un repli dans la tendance : la moyenne courte
//   est reprise, et ca continue.
//
// /!\ CE FICHIER CLASSE DES CANDIDATS. « LES BARRES NE SONT PAS LES TIRS » — la ligne qui compte
//   pour un veto CONT est `TIRE rang 3`, la seule qu'il toucherait.
// Usage : `node --max-old-space-size=12288 stats/_m15_zclose_dz_cont_sell.mjs`
//         surcharges : `Z=0.5 DZ=0.4`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";

if (String(process.env.PRO_DIR_SRC ?? "regime") !== "regime") {
  console.log("\n STOP : `PRO_DIR_SRC` est pose.\n"); process.exit(1);
}
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const ZB = Number(process.env.Z ?? 0.50), DZ = Number(process.env.DZ ?? 0.40);

const rawOf = (f) => {
  const txt = fs.readFileSync(path.join(MATRIX, f), "utf8").split("\n");
  const h = txt[0].split(";");
  const ix = ["timestamp", "zscore_m15_s0", "zscore_m15"].map((c) => h.indexOf(c));
  const m = new Map();
  for (let n = 1; n < txt.length; n++) {
    const v = txt[n].split(";"); if (v.length < h.length) continue;
    const z0 = Number(v[ix[1]]), zc = Number(v[ix[2]]);
    m.set(v[ix[0]], { zc, dz: z0 - zc });      // CLOTURE + ce qui se passe MAINTENANT
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
    if (!r || !Number.isFinite(r.zc) || !Number.isFinite(r.dz)) continue;
    lis++;
    const S = side === "SELL" ? 1 : -1;                 // le SELL est le sens brut
    const zC = r.zc * S, dz = r.dz * S;
    if (!(zC > ZB && dz > DZ)) continue;
    const w = p.walk({ ...x, side });
    if (!w || typeof w.R !== "number") continue;
    const destin = x.selStrategy === "CONT" ? "TIRE rang 3"
                 : x.selStrategy ? `pris par ${x.selStrategy}`
                 : x.waitNature === "cont-counter-cross" ? "cont-counter-cross"
                 : x.waitNature === "cont-below-min" ? "MIN_CONT (score)"
                 : x.waitNature === "cont-vetoed" ? "VETO voisin"
                 : (x.waitNature ?? "autre");
    ALL.push({ asset, ts: x.tsMT, side, zC, dz, R: w.R, destin });
  }
}

const wr = (a) => (a.length ? 100 * a.filter((t) => t.R > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + t.R, 0);
const jour = (t) => `${t.asset}|${String(t.ts ?? "").slice(0, 10)}`;
const grap = (a) => new Set(a.map(jour)).size;
const wrG = (a) => { const m = new Map(); for (const t of a) { const k = jour(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
  let g = 0; for (const [, v] of m) if (Rn(v) > 0) g++; return m.size ? 100 * g / m.size : NaN; };
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(28)}${String(a.length).padStart(7)}${String(grap(a)).padStart(6)}${wr(a).toFixed(2).padStart(9)} %${wrG(a).toFixed(1).padStart(8)} %${Rn(a).toFixed(1).padStart(10)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(28)}      —`;
const HEAD = `   ${"".padEnd(28)}${"barres".padStart(7)}${"grap".padStart(6)}${"WR".padStart(10)}${"WRgrap".padStart(9)}${"R".padStart(10)}${"R/barre".padStart(9)}`;
const B = (a) => a.filter((t) => t.side === "BUY"), V = (a) => a.filter((t) => t.side === "SELL");

console.log(`\n== z M15 CLOTURE > ${ZB} ET dz M15 > ${DZ} — le CONT SELL marche-t-il ? ==`);
console.log(`   SELL = sens brut · BUY = miroir · z live vaut donc > ${(ZB + DZ).toFixed(2)}`);
console.log(`   ${rows} lignes · ${lis} avec cote et capteurs · capacite INFINIE, sans spacing`);
console.log(`   REPERES  point mort 75,00 · rang 3 SELL 79,32 · rang 3 BUY 88,53 · carnet 87,35\n`);
console.log(HEAD);
console.log(L("LA FIGURE", ALL)); console.log(L("   SELL (la dictee)", V(ALL))); console.log(L("   BUY (miroir)", B(ALL)));

console.log(`\n   -- OU MEURENT CES BARRES --`); console.log(HEAD);
for (const d of [...new Set(ALL.map((t) => t.destin))].sort((a, b) => ALL.filter((t) => t.destin === b).length - ALL.filter((t) => t.destin === a).length)) {
  const a = ALL.filter((t) => t.destin === d);
  console.log(L(d, a)); console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a)));
}
console.log(`\n   -- BALAYAGE du z CLOTURE (a dz > ${DZ}), CUMULATIF --`); console.log(HEAD);
for (const z of [0.5, 0.8, 1.2, 1.8, 2.5]) {
  const a = ALL.filter((t) => t.zC > z);
  console.log(L(`z clot > ${z.toFixed(1)}`, a));
  if (a.length) { console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a)));
    const tir = a.filter((t) => t.destin === "TIRE rang 3");
    console.log(L("     dont TIRE (3)", tir)); }
}
console.log(`\n   -- BALAYAGE du dz (a z clot > ${ZB}), CUMULATIF --`); console.log(HEAD);
for (const d of [0.4, 0.7, 1.0, 1.5]) {
  const a = ALL.filter((t) => t.dz > d);
  console.log(L(`dz > ${d.toFixed(1)}`, a));
  if (a.length) { console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a))); }
}
console.log("");
