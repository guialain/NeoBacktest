// _cont_di_x_adxm15.mjs — LA GRILLE `NIVEAU DI PORTEUR x ADX M15`, MESUREE SANS TOUCHER AU MOTEUR.
//
// 🎯 DICTEE owner 22/08 : le 2e axe de l'entree ⑵ devient l'**ADX M15**, decoupe par DECADES
//   (0-10 · 10-20 · 20-30 · 30-40 · 40-50 · 50+). Mesure a l'appui : sur l'ADX ce decoupage rend
//   `0,1 / 17,9 / 39,0 / 24,3 / 11,8 / 7,1 %` — cinq bandes utiles, et l'ADX va bien regulierement
//   au-dela de 40 (**18,9 % des barres en M15**, max 88,7). Sur le DI il aurait rendu trois cases
//   mortes (`30-40` 7,2 % · `40-50` 0,9 % · `50+` 0,1 %) : les deux grandeurs ne se bandent pas
//   pareil, et c'est ce qui a fait ecarter les decades pour le DI.
//
// ⭐⭐⭐ L'ADX N'EST LU NULLE PART AU RANG ③ — c'est un capteur NEUF, pas un doublon de la cascade.
//   Au ① il existe (`adx` = ADX H1 x `gapDynClose`) et il y est **ANTI-MONOTONE** (note 3 -> 97,08 %,
//   note 10 -> 88,44 %). ⛔ Ne pas supposer que « plus d'ADX = mieux » : ce depot a deja mesure
//   l'inverse sur l'autre rang.
//
// ⚠⚠ AUCUNE MODIFICATION DU MOTEUR POUR CETTE MESURE. L'ADX M15 est JOINT depuis le CSV par
//   `actif + timestamp`. Ajouter une entree au contrat pour mesurer, c'est 4 endroits a toucher et
//   un carnet vide en cas d'oubli — paye ce jour meme. On ne cable QUE ce qui sera dicte.
// ⚠ WR par GRAPPE. Point mort 75,0 %. Decoupe PAR COTE.
//   usage : node stats/_cont_di_x_adxm15.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
const adxDe = new Map();          // "actif|timestamp" -> adx14_m15_s0
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";"); const iT = h.indexOf("timestamp"), iA = h.indexOf("adx14_m15_s0");
  if (iT >= 0 && iA >= 0) for (const l of L.slice(1)) {
    const c = l.split(";"); const v = Number(c[iA]);
    if (c[iA] !== "" && Number.isFinite(v)) adxDe.set(a + "|" + c[iT], v);
  }
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s));
const P = (s) => s.sc?.boxes?.cont?.parts ?? {};
const adx = (s) => adxDe.get(s.asset + "|" + String(s.tsMT ?? ""));
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const p = [...g.values()].map((o) => o.w / o.n);
  const m = p.reduce((a, b) => a + b, 0) / p.length;
  return { n: t.length, gr: p.length, wr: 100 * m, R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const cel = (t) => { const x = st(t);
  return x ? String(x.n).padStart(6) + String(x.gr).padStart(5) + (x.wr.toFixed(1) + "%").padStart(8) + ((x.R >= 0 ? "+" : "") + x.R.toFixed(1)).padStart(8)
           : "     -    -       -       -"; };
const DEC = [[0,20],[20,30],[30,40],[40,50],[50,Infinity]];
const dl = ([lo,hi]) => hi === Infinity ? "ADX 50+" : `ADX ${lo}-${hi}`;
const NIV = ["EXTREME_LOW","LOW","MEDIUM","HIGH","EXTREME_HIGH"];

const avec = CONT.filter((s) => Number.isFinite(adx(s)));
const T = st(CONT);
console.log(`\n═══ NIVEAU DI PORTEUR x ADX M15 ═══  ${CONT.length} tirs · ${avec.length} joints (${(100*avec.length/CONT.length).toFixed(1)} %)`);
console.log(`  reference ${T.wr.toFixed(1)} % · ${(T.R>=0?"+":"")+T.R.toFixed(1)} R · point mort 75,0 %`);
console.log(`  ⚠ La bande ADX 0-10 est FUSIONNEE dans 10-20 : elle pese 0,1 % de la population.`);
for (const [lbl, sel] of [["TOUS",()=>true],["BUY",(x)=>x.side==="BUY"],["SELL",(x)=>x.side==="SELL"]]) {
  const POP = avec.filter(sel);
  console.log(`\n  == ${lbl} ==   [ tirs . grappes . WR/grappe . R ]`);
  console.log("  " + "niveau DI".padEnd(14) + DEC.map((d) => dl(d).padStart(27)).join("") + "        LIGNE");
  console.log("  " + "-".repeat(14 + 27*DEC.length + 27));
  for (const nv of NIV) {
    const L2 = POP.filter((x) => P(x).diNiveau === nv);
    if (!L2.length) { console.log("  " + nv.padEnd(14) + "  (aucun tir)"); continue; }
    console.log("  " + nv.padEnd(14) + DEC.map(([lo,hi]) => cel(L2.filter((x) => adx(x) >= lo && adx(x) < hi))).join("") + " |" + cel(L2));
  }
  console.log("  " + "-".repeat(14 + 27*DEC.length + 27));
  console.log("  " + "COLONNE".padEnd(14) + DEC.map(([lo,hi]) => cel(POP.filter((x) => adx(x) >= lo && adx(x) < hi))).join("") + " |" + cel(POP));
}
console.log("");
