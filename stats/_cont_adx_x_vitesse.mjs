// _cont_adx_x_vitesse.mjs — LA GRILLE `ADX M15 x VITESSE DE L'ADX`, MESUREE SANS TOUCHER AU MOTEUR.
//
// 🎯 DICTEE owner 22/08 : l'entree ⑵ devient `niveau ADX x vitesse ADX`, en M15. Le NIVEAU DI est
//   abandonne — mesure a l'appui : ses trois lignes peuplees font **81,8 · 82,1 · 82,1 %**, il ne
//   separe RIEN, alors que la colonne ADX separe de 31 pt (66,1 -> 97,4).
//
// ⚠⚠ DEUX CONSEQUENCES DE FOND, A LIRE AVANT LA TABLE :
//   ① L'ADX N'A PAS DE CAMP. Il mesure la force de la TENDANCE, pas celle d'un cote. Le miroir
//     `DI+`/`DI−` disparait donc, et la famille devient **IDENTIQUE AUX DEUX COTES**. Elle classera
//     a l'interieur de chaque cote ; elle ne pourra plus rien dire de specifique au SELL.
//   ② La famille s'appellerait encore `di` en ne lisant plus aucun DI — un nom qui MENT. A renommer
//     avec la dictee (⚠ `adx` existe deja comme famille du rang ①, collision de LECTURE).
//
// ⚠ VITESSE = `adx14_m15_c1 − adx14_m15_c2`, DEUX CLOTURES — meme convention que `gapDynClose` et
//   que les deltas DI : « un NIVEAU est un ETAT et gagne a etre frais, une DYNAMIQUE est un
//   EVENEMENT et exige des bougies COMPARABLES ».
// ⚠ Bandes de niveau : les DECADES dictees, avec `0-10` FUSIONNE dans `10-20` (0,1 % de la
//   population) et les deux bandes hautes gardees separees pour qu'on VOIE si elles sont lisibles.
// ⚠ WR par GRAPPE. Point mort 75,0 %. Decoupe PAR COTE.
//   usage : node stats/_cont_adx_x_vitesse.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = []; const AX = new Map();   // "actif|ts" -> { a: adx live, d: c1 - c2 }
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";");
  const iT = h.indexOf("timestamp"), i0 = h.indexOf("adx14_m15_s0"),
        i1 = h.indexOf("adx14_m15_c1"), i2 = h.indexOf("adx14_m15_c2");
  if (iT >= 0 && i0 >= 0 && i1 >= 0 && i2 >= 0) for (const l of L.slice(1)) {
    const c = l.split(";"); const v0 = Number(c[i0]), v1 = Number(c[i1]), v2 = Number(c[i2]);
    if (Number.isFinite(v0) && Number.isFinite(v1) && Number.isFinite(v2) && c[i0] !== "" && c[i1] !== "" && c[i2] !== "")
      AX.set(a + "|" + c[iT], { a: v0, d: v1 - v2 });
  }
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s));
const AXof = (s) => AX.get(s.asset + "|" + String(s.tsMT ?? ""));
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
const avec = CONT.filter((s) => AXof(s));
const T = st(CONT);
console.log(`\n═══ ADX M15 x VITESSE ═══  ${CONT.length} tirs · ${avec.length} joints (${(100*avec.length/CONT.length).toFixed(1)} %)`);
console.log(`  reference ${T.wr.toFixed(1)} % · ${(T.R>=0?"+":"")+T.R.toFixed(1)} R · point mort 75,0 %`);
const v = avec.map((s) => AXof(s).d).sort((a, b) => a - b);
const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
console.log(`\n  ── LA VITESSE (ΔADX = c1 − c2) — sa distribution dicte les bandes ──`);
console.log(`     min ${v[0].toFixed(2)} · p10 ${q(.10).toFixed(2)} · p30 ${q(.30).toFixed(2)} · median ${q(.5).toFixed(2)} · p70 ${q(.70).toFixed(2)} · p90 ${q(.90).toFixed(2)} · max ${v[v.length-1].toFixed(2)}`);
for (const d of [0.5, 1, 1.5, 2]) console.log(`     seuil ±${d}  ⇒  PLAT = ${(100*v.filter(x=>Math.abs(x)<=d).length/v.length).toFixed(1)} %`);
const NIV = [[0,20,"ADX <20"],[20,30,"ADX 20-30"],[30,40,"ADX 30-40"],[40,Infinity,"ADX 40+"]];
const VIT = [[-Infinity,-1,"CHUTE <-1"],[-1,1,"PLAT +-1"],[1,Infinity,"HAUSSE >+1"]];
for (const [lbl, sel] of [["TOUS",()=>true],["BUY",(x)=>x.side==="BUY"],["SELL",(x)=>x.side==="SELL"]]) {
  const POP = avec.filter(sel);
  console.log(`\n  == ${lbl} ==   [ tirs . grappes . WR/grappe . R ]`);
  console.log("  " + "niveau ADX".padEnd(13) + VIT.map(([,,n]) => n.padStart(27)).join("") + "        LIGNE");
  console.log("  " + "-".repeat(13 + 27*VIT.length + 27));
  for (const [lo, hi, nm] of NIV) {
    const L2 = POP.filter((x) => AXof(x).a >= lo && AXof(x).a < hi);
    if (!L2.length) { console.log("  " + nm.padEnd(13) + "  (aucun tir)"); continue; }
    console.log("  " + nm.padEnd(13) + VIT.map(([a2,b2]) => cel(L2.filter((x) => AXof(x).d >= a2 && AXof(x).d < b2))).join("") + " |" + cel(L2));
  }
  console.log("  " + "-".repeat(13 + 27*VIT.length + 27));
  console.log("  " + "COLONNE".padEnd(13) + VIT.map(([a2,b2]) => cel(POP.filter((x) => AXof(x).d >= a2 && AXof(x).d < b2))).join("") + " |" + cel(POP));
}
console.log("");
