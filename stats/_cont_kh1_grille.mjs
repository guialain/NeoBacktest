// _cont_kh1_grille.mjs — LA GRILLE `%K H1 LIVE x K-D H1`, POUR REMPLACER `di` A L'ENTREE ⑵.
//
// 🎯 DICTEE owner 22/08 : « adx / di n'aide pas a cause des zigzags, on le sort et on remplace par
//   kH1Live comme pour kH4 ». Meme FORME que l'entree ⑶ : niveau x ΔK, miroir DERIVE.
//
// ⭐⭐⭐ CE QUI DESIGNAIT DEJA `%K H1`, MESURE CE SOIR EN LE RETIRANT DU PRODUIT `kH4` :
//   il separe de **11,8 pt** (`[15·25[` 73,4 % -> `[75·85[` 85,2 %) sur 62 et 85 grappes, avec un R
//   de +3,3 contre +38,3. ⚠ ET AVEC LA POLARITE INVERSE de celle que le facteur lui appliquait :
//   les DEUX MEILLEURES bandes (85,2 et 84,8) etaient celles que le facteur ETEIGNAIT a 1 et 0.
//   ⇒ « s'il revient, il revient comme AXE, avec la polarite INVERSE, jamais comme multiplicateur ».
//
// ⚠ `dKBandH1Live` avait ete RETIRE du contrat le 16/08 (« le facteur kH1 lit K−D, plus ΔK »).
//   Il est remis ici — 4 ENDROITS : producteur, contrat, destructuration, appelant. Oublier le 3e
//   jette un `ReferenceError` a chaque barre et rend un carnet VIDE en silence (paye ce jour meme).
//
// ⚠ COLONNE EN SENS BRUT (`UP` = le %K monte), comme `kH4` : le miroir echange `DOWN`/`UP`. Ne pas
//   l'orienter ici — c'est la convention du fichier, et l'orienter deux fois est la faute type.
// ⚠ WR par GRAPPE. Point mort 75,0 %. Decoupe PAR COTE — le ③ porte 13 pt d'ecart BUY−SELL.
//   usage : node stats/_cont_kh1_grille.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { GROUPE_VITESSE } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/exhScoringV1.js");
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
  return { n: t.length, gr: p.length, wr: 100 * p.reduce((a, b) => a + b, 0) / p.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const cel = (t) => { const x = st(t);
  return x ? String(x.n).padStart(6) + String(x.gr).padStart(5) + (x.wr.toFixed(1) + "%").padStart(8) + ((x.R >= 0 ? "+" : "") + x.R.toFixed(1)).padStart(8)
           : "     -    -       -       -"; };
// ⚠ Les bandes de `kH4` sont reprises TELLES QUELLES pour que les deux entrees soient comparables.
const NIV = [[0,10],[10,20],[20,45],[45,55],[55,80],[80,90],[90,101]];
const COL = ["KD_POS","CONTACT","KD_NEG"];
const avec = CONT.filter((s) => Number.isFinite(P(s).kH1Brut) && P(s).kH1Col);
const T = st(CONT);
console.log(`\n═══ %K H1 LIVE x ΔK H1 ═══  ${CONT.length} tirs · ${avec.length} avec les deux capteurs`);
console.log(`  reference ${T.wr.toFixed(1)} % · ${(T.R>=0?"+":"")+T.R.toFixed(1)} R · point mort 75,0 %`);
for (const [lbl, sel] of [["TOUS",()=>true],["BUY",(x)=>x.side==="BUY"],["SELL",(x)=>x.side==="SELL"]]) {
  const POP = avec.filter(sel);
  console.log(`\n  == ${lbl} ==   [ tirs . grappes . WR/grappe . R ]`);
  console.log("  " + "%K H1".padEnd(12) + COL.map((c) => c.padStart(27)).join("") + "        LIGNE");
  console.log("  " + "-".repeat(12 + 27*COL.length + 27));
  for (const [lo, hi] of NIV) {
    const L2 = POP.filter((x) => P(x).kH1Brut >= lo && P(x).kH1Brut < hi);
    const nm = `[${lo}·${hi === 101 ? 100 : hi}[`;
    if (!L2.length) { console.log("  " + nm.padEnd(12) + "  (aucun tir)"); continue; }
    console.log("  " + nm.padEnd(12) + COL.map((c) => cel(L2.filter((x) => P(x).kH1Col === c))).join("") + " |" + cel(L2));
  }
  console.log("  " + "-".repeat(12 + 27*COL.length + 27));
  console.log("  " + "COLONNE".padEnd(12) + COL.map((c) => cel(POP.filter((x) => P(x).kH1Col === c))).join("") + " |" + cel(POP));
}
console.log("");
