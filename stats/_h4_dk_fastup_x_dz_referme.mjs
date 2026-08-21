// _h4_dk_fastup_x_dz_referme.mjs — H4 : le `%K` remonte VITE contre le pari ET l'elastique se REFERME.
// =============================================================================================
// LA DEMANDE (owner 21/08) : « cont sell, Kh4 fastup, deltazh4 referme ». Pose en MIROIR.
//   SELL : `dK H4 = FAST_UP`    ET  `dz H4 = *_REFERME`
//   BUY  : `dK H4 = FAST_DOWN`  ET  `dz H4 = *_REFERME`
//
// LA FIGURE : sur la structure LENTE, la ligne rapide du stochastique remonte VITE dans le sens
//   CONTRAIRE au pari, et dans le meme temps le prix REVIENT vers sa moyenne H4. Deux capteurs
//   independants qui disent la meme chose : le mouvement qu'on veut poursuivre se DEFAIT.
//
// /!\ DEUX VOCABULAIRES DE VITESSE, ET ILS N'ONT PAS LA MEME SEMANTIQUE — c'est tout le piege de
//   la soiree du 21/08 :
//   (a) `deltaKBand(dK)` -> `SOFT/FAST/EXPLOSIVE_UP|DOWN` sur `dK = %K_s0 - %K_s1`, **BRUT** :
//       `FAST_UP` veut dire « le %K MONTE vite », point. Il ne se miroite pas tout seul — c'est
//       NOUS qui choisissons `FAST_UP` pour le SELL et `FAST_DOWN` pour le BUY.
//   (b) `zDeltaCol(dz x signe(z), zLevel(z))` -> `SOFT/FAST/EXPLO_ECARTE|REFERME`, **ORIENTE** :
//       `REFERME` veut dire « |z| SE REDUIT », le prix revient vers sa moyenne. C'est deja
//       side-neutre : il n'y a rien a retourner pour le miroir.
//   => le miroir ne porte donc QUE sur (a). Ecrire l'inverse serait la faute que le renommage
//      `ECARTE`/`REFERME` a servi a rendre impossible.
//
// /!\ `dK H4` N'EST PAS SUR LE FANTOME `all-rows` : on le recalcule depuis `stoch_k_h4_s0|s1` avec
//   `deltaKBand` IMPORTE du detecteur, jamais recopie (bandes `[4,4 · 13 · 21]`).
// /!\ CE FICHIER CLASSE DES CANDIDATS. Seul le carnet re-couru prouve — d'ou la ventilation par
//   etage, dont `TIRE rang 3`, la seule ligne qu'un veto CONT toucherait vraiment.
// Usage : `node --max-old-space-size=12288 stats/_h4_dk_fastup_x_dz_referme.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
const { deltaKBand } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js");
const { zDeltaCol, zLevel } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/experts/zscoreExpert.js");

if (String(process.env.PRO_DIR_SRC ?? "regime") !== "regime") {
  console.log("\n STOP : `PRO_DIR_SRC` est pose.\n"); process.exit(1);
}
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const REFERME = ["SOFT_REFERME", "FAST_REFERME", "EXPLO_REFERME"];

const rawOf = (f) => {
  const txt = fs.readFileSync(path.join(MATRIX, f), "utf8").split("\n");
  const h = txt[0].split(";");
  const ix = ["timestamp", "stoch_k_h4_s0", "stoch_k_h4_s1", "zscore_h4_s0", "zscore_h4"].map((c) => h.indexOf(c));
  const m = new Map();
  for (let n = 1; n < txt.length; n++) {
    const v = txt[n].split(";"); if (v.length < h.length) continue;
    const k0 = Number(v[ix[1]]), k1 = Number(v[ix[2]]), z0 = Number(v[ix[3]]), zp = Number(v[ix[4]]);
    m.set(v[ix[0]], { dK: k0 - k1, z0, zp });
  }
  return m;
};

const ALL = [];
let rows = 0, lis = 0;
const bandes = {}, cols = {};
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const raw = rawOf(f);
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "all-rows")) {
    rows++;
    if (!Number.isFinite(x.regDir) || x.regDir === 0) continue;
    const side = x.regDir > 0 ? "BUY" : "SELL";
    const r = raw.get(String(x.tsMT ?? ""));
    if (!r || !Number.isFinite(r.dK) || !Number.isFinite(r.z0) || !Number.isFinite(r.zp)) continue;
    lis++;
    const bK = deltaKBand(r.dK);
    const cZ = zDeltaCol((r.z0 - r.zp) * (Math.sign(r.zp || 0) || 1), zLevel(r.zp));
    bandes[bK ?? "null"] = (bandes[bK ?? "null"] ?? 0) + 1;
    cols[cZ ?? "null"] = (cols[cZ ?? "null"] ?? 0) + 1;
    const bVoulue = side === "SELL" ? "FAST_UP" : "FAST_DOWN";     // le miroir ne porte QUE sur dK
    if (!(bK === bVoulue && REFERME.includes(cZ))) continue;
    const w = p.walk({ ...x, side });
    if (!w || typeof w.R !== "number") continue;
    const destin = x.selStrategy === "CONT" ? "TIRE rang 3"
                 : x.selStrategy ? `pris par ${x.selStrategy}`
                 : x.waitNature === "cont-counter-cross" ? "cont-counter-cross"
                 : x.waitNature === "cont-below-min" ? "MIN_CONT (score)"
                 : x.waitNature === "cont-vetoed" ? "VETO voisin"
                 : (x.waitNature ?? "autre");
    ALL.push({ asset, ts: x.tsMT, side, dK: r.dK, cZ, R: w.R, destin });
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

console.log(`\n== TOUTE LA POPULATION — dK H4 = FAST_UP (SELL) / FAST_DOWN (BUY) ET dz H4 = *_REFERME ==`);
console.log(`   ${rows} lignes · ${lis} avec cote et capteurs H4 · walk capacite INFINIE, sans spacing · point mort 75,00`);
console.log(`\n   -- CONTROLE D'ATTEIGNABILITE --`);
console.log(`   dK H4 (deltaKBand, BRUT) : ` + Object.entries(bandes).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${k} ${(100*n/lis).toFixed(1)}%`).join(" · "));
console.log(`   dz H4 (zDeltaCol, ORIENTE) : ` + Object.entries(cols).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${k} ${(100*n/lis).toFixed(1)}%`).join(" · "));
console.log(`\n`); console.log(HEAD);
console.log(L("LA FIGURE", ALL)); console.log(L("   SELL (FAST_UP)", V(ALL))); console.log(L("   BUY (FAST_DOWN)", B(ALL)));

console.log(`\n   -- OU MEURENT CES BARRES --`); console.log(HEAD);
for (const d of [...new Set(ALL.map((t) => t.destin))].sort((a, b) => ALL.filter((t) => t.destin === b).length - ALL.filter((t) => t.destin === a).length)) {
  const a = ALL.filter((t) => t.destin === d);
  console.log(L(d, a)); console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a)));
}
console.log(`\n   -- PAR COLONNE DE dz (les 3 REFERME) --`); console.log(HEAD);
for (const c of REFERME) {
  const a = ALL.filter((t) => t.cZ === c);
  console.log(L(c, a)); if (a.length) { console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a))); }
}
console.log("");
