// _m15_z_franchit_le_mid.mjs — LE `z` M15 A **PASSE LE MID** ET IL EST DEJA A 0,5 DE L'AUTRE COTE.
// =============================================================================================
// LA DICTEE (owner 21/08) : « z a passe le mid et est > 0,5, dz va vers le haut, et on sell ».
//
// /!\ « PASSER LE MID » A DEUX LECTURES, ET ELLES NE DECRIVENT PAS LA MEME CHOSE. On mesure LES
//   DEUX plutot que de deviner — c'est le meme piege que « kd = contact » ce soir.
//     (A) NIVEAU       : le `z` EST au-dela du mid    -> `z live > +0,50`
//     (B) FRANCHISSEMENT : le `z` VIENT de traverser  -> `z CLOTURE <= 0` ET `z live > +0,50`
//   (B) est STRICTEMENT INCLUS dans (A). (A) attrape aussi les barres deja au-dessus depuis
//   longtemps ; (B) ne garde que celles qui ont CHANGE DE COTE dans la barre en cours.
//   ⭐ Sur (B) le `dz > 0` est REDONDANT par construction (`dz = live - cloture`, donc > 0,5 si la
//   cloture est <= 0 et le live > 0,5) — on le laisse explicite pour que la regle se lise.
//
// LA FIGURE, EN MOTS : on est en regime baissier (le cote vient de `regDir`), donc on VEND. Et le
//   prix vient de repasser AU-DESSUS de sa moyenne M15, deja d'un demi-sigma, en montant. Ce n'est
//   plus un repli dans la tendance : la moyenne courte a ete reprise a contre-sens.
//
// MIROIR : SELL = sens brut. BUY = `z cloture >= 0` ET `z live < -0,50` ET `dz < 0`.
// /!\ CE FICHIER CLASSE. Seul le carnet prouve — d'ou la ventilation, dont `TIRE rang 3`.
// Usage : `node --max-old-space-size=12288 stats/_m15_z_franchit_le_mid.mjs`  surcharges : `Z=0.5`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";

if (String(process.env.PRO_DIR_SRC ?? "regime") !== "regime") {
  console.log("\n STOP : `PRO_DIR_SRC` est pose.\n"); process.exit(1);
}
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const ZB = Number(process.env.Z ?? 0.50);

const rawOf = (f) => {
  const txt = fs.readFileSync(path.join(MATRIX, f), "utf8").split("\n");
  const h = txt[0].split(";");
  const ix = ["timestamp", "zscore_m15_s0", "zscore_m15"].map((c) => h.indexOf(c));
  const m = new Map();
  for (let n = 1; n < txt.length; n++) {
    const v = txt[n].split(";"); if (v.length < h.length) continue;
    m.set(v[ix[0]], { z0: Number(v[ix[1]]), zc: Number(v[ix[2]]) });
  }
  return m;
};

const ALL = [];   // tout ce qui satisfait (A), avec un drapeau `franchit` pour (B)
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
    if (!r || !Number.isFinite(r.z0) || !Number.isFinite(r.zc)) continue;
    lis++;
    const S = side === "SELL" ? 1 : -1;              // le SELL est le sens brut
    const zL = r.z0 * S, zC = r.zc * S, dz = (r.z0 - r.zc) * S;
    if (!(zL > ZB && dz > 0)) continue;              // (A) NIVEAU
    const w = p.walk({ ...x, side });
    if (!w || typeof w.R !== "number") continue;
    const destin = x.selStrategy === "CONT" ? "TIRE rang 3"
                 : x.selStrategy ? `pris par ${x.selStrategy}`
                 : x.waitNature === "cont-counter-cross" ? "cont-counter-cross"
                 : x.waitNature === "cont-below-min" ? "MIN_CONT (score)"
                 : x.waitNature === "cont-vetoed" ? "VETO voisin"
                 : (x.waitNature ?? "autre");
    ALL.push({ asset, ts: x.tsMT, side, zL, zC, dz, R: w.R, destin, franchit: zC <= 0 });
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
const FR = ALL.filter((t) => t.franchit), DEJA = ALL.filter((t) => !t.franchit);

console.log(`\n== LE z M15 AU-DELA DU MID (> ${ZB}) ET QUI MONTE — DEUX LECTURES ==`);
console.log(`   ${rows} lignes · ${lis} avec cote et capteurs M15 · capacite INFINIE, sans spacing`);
console.log(`   point mort 75,00 · rang 3 SELL 79,32 · rang 3 BUY 88,53 · carnet 87,35\n`);
console.log(HEAD);
console.log(L("(A) NIVEAU  z live > " + ZB, ALL));
console.log(L("      SELL", V(ALL))); console.log(L("      BUY", B(ALL)));
console.log(L("(B) FRANCHIT le mid", FR));
console.log(L("      SELL (la dictee)", V(FR))); console.log(L("      BUY (miroir)", B(FR)));
console.log(L("(A sans B) DEJA au-dela", DEJA));
console.log(L("      SELL", V(DEJA))); console.log(L("      BUY", B(DEJA)));

for (const [nm, POP] of [["(B) FRANCHIT", FR], ["(A sans B) DEJA au-dela", DEJA]]) {
  console.log(`\n   -- OU MEURENT LES BARRES DE ${nm} --`); console.log(HEAD);
  for (const d of [...new Set(POP.map((t) => t.destin))].sort((a, b) => POP.filter((t) => t.destin === b).length - POP.filter((t) => t.destin === a).length)) {
    const a = POP.filter((t) => t.destin === d);
    console.log(L(d, a)); console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a)));
  }
}
console.log(`\n   -- (B) PAR SEUIL DE z live, CUMULATIF --`); console.log(HEAD);
for (const z of [0.5, 0.8, 1.2, 1.8]) {
  const a = FR.filter((t) => t.zL > z);
  console.log(L(`franchit + z > ${z.toFixed(1)}`, a));
  if (a.length) { console.log(L("     SELL", V(a))); console.log(L("     BUY", B(a))); }
}
console.log("");
