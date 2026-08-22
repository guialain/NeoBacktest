// _cont_di_grille_now.mjs — LA GRILLE `di` DU ③, MESUREE SUR LE MOTEUR D'AUJOURD'HUI.
//
// 🎯 PREREQUIS D'UNE DICTEE : les populations inscrites dans `CONT_DI_GRID` datent du **12/08** —
//   avant le modulateur `meanSlopeH1`, avant la refonte de `rsi` et de `kH4`, a un autre `MIN_CONT`
//   et avec deux vetos de plus. **Aucune de ces lignes ne decrit le moteur actuel.**
//   ⭐ « Une dictee se juge au VOLUME QU'ELLE DEPLACE » : sans la population D'AUJOURD'HUI, on
//   re-dicte a l aveugle et on peut deplacer des cases qui ne portent plus rien.
//
// ⚠⚠ CE QUE CETTE MESURE EST, ET CE QU'ELLE N'EST PAS. Elle porte sur les **TIRS**, donc APRES les
//   vetos et le spacing. Elle dit ce que le bareme NOTE parmi ce qui SURVIT — c'est la bonne
//   population pour re-doser des NOTES (un bareme ne note que ce qu'il rencontre), mais PAS pour
//   conclure qu'une case « vaut » tant : le spacing peut inverser le signe entre barre et tir.
// ⚠ WR par GRAPPE (actif|jour), sigma sur les grappes. Point mort 75,0 %.
// ⚠ DECOUPE PAR COTE obligatoire — le ③ porte un ecart BUY−SELL de 13 pt.
//   usage : node stats/_cont_di_grille_now.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { CONT_DI_GRID } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/contScoringV1.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s));
const P = (s) => s.sc?.boxes?.cont?.parts ?? {};
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const p = [...g.values()].map((o) => o.w / o.n);
  const m = p.reduce((a, b) => a + b, 0) / p.length;
  const v = p.length > 1 ? p.reduce((a, b) => a + (b - m) ** 2, 0) / (p.length - 1) : null;
  return { n: t.length, gr: p.length, wr: 100 * m, sig: v === null ? null : 100 * Math.sqrt(v / p.length),
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const NIV = Object.keys(CONT_DI_GRID);
const DYN = ["NARROWING", "STABLE", "WIDENING"];
const cel = (s) => s ? String(s.n).padStart(6) + String(s.gr).padStart(5) + (s.wr.toFixed(1) + "%").padStart(8)
                      + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8) : "     —    —       —       —";

console.log("\n═══ GRILLE `di` — MESUREE SUR LE MOTEUR DU 22/08 ═══  [MIN_CONT=" + (process.env.MIN_CONT ?? "defaut 10") + "]");
const T = st(CONT);
console.log("  " + CONT.length + " tirs · " + T.gr + " grappes · reference " + T.wr.toFixed(1) + " % · " + (T.R >= 0 ? "+" : "") + T.R.toFixed(1) + " R · point mort 75,0 %");
const sansNiv = CONT.filter((s) => !P(s).diNiveau).length;
console.log("  " + sansNiv + " tirs sans `diNiveau` (famille MUETTE) · " + (100 * sansNiv / CONT.length).toFixed(1) + " %");

for (const [lbl, sel] of [["TOUS", () => true], ["BUY", (x) => x.side === "BUY"], ["SELL", (x) => x.side === "SELL"]]) {
  const POP = CONT.filter(sel);
  console.log("\n  ══ " + lbl + " ══  " + POP.length + " tirs   [ tirs · grappes · WR/grappe · R ]");
  console.log("  " + "niveau".padEnd(15) + DYN.map((d) => d.padStart(27)).join("") + "        LIGNE");
  console.log("  " + "─".repeat(15 + 27 * 3 + 27));
  for (const nv of NIV) {
    const L = POP.filter((s) => P(s).diNiveau === nv);
    const notes = DYN.map((d) => String(CONT_DI_GRID[nv][d]).padStart(3));
    console.log("  " + nv.padEnd(15) + DYN.map((d) => cel(st(L.filter((s) => P(s).diDyn === d)))).join("") + " │" + cel(st(L)));
    console.log("  " + "  note dictee".padEnd(15) + notes.map((n) => (n + "        ").padStart(27)).join(""));
  }
  // ⚠ La colonne TOTALE, lue sur toute la population du cote : c'est elle qui dit si l'axe DYNAMIQUE
  //   separe quoi que ce soit, independamment du niveau.
  console.log("  " + "─".repeat(15 + 27 * 3 + 27));
  console.log("  " + "COLONNE".padEnd(15) + DYN.map((d) => cel(st(POP.filter((s) => P(s).diDyn === d)))).join("") + " │" + cel(st(POP)));
}
console.log("\n  ⚠ Les `diDyn` absents ne sont dans AUCUNE colonne : la somme des colonnes peut etre < la ligne.\n");
