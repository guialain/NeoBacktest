// _cont_di_delta_porteur.mjs — LA DISTRIBUTION DE `ΔDI PORTEUR`, ET CE QU'ELLE SEPARE.
//
// 🎯 DICTEE owner 22/08 : « on laisse la polarite, pour buy on regarde uniquement di+ et ses
//   variations ». L'axe de l'entree ⑵ passe donc de `Δ|DI+ − DI−|` (l'ECART entre les camps) a
//   `ΔDI porteur` (le CAMP LUI-MEME) — DI+ en BUY, DI− en SELL.
//
// ⚠⚠ LE SEUIL NE SE TRANSPORTE PAS. `DI_GAP_DEADBAND = 2,0` est le p35 de `Δ|ecart|`. L'ecart est
//   une DIFFERENCE de deux DI : sa variation n'a pas la meme dispersion que celle d'un DI seul.
//   Reutiliser `2,0` elargirait `STABLE` sans que personne ne le voie — « un seuil se perime avec
//   son CAPTEUR ». ⇒ on mesure la distribution AVANT de dicter.
// ⚠ Lecture `c1 − c2`, DEUX CLOTURES, comme `gapDynClose` : les DI perdent **13,3 % a chaque
//   ouverture de bougie** (bougie interieure ⇒ DM nuls). Une lecture live-contre-close mesurerait
//   cette decroissance, pas le marche.
// ⚠ WR par GRAPPE. Point mort 75,0 %. Decoupe PAR COTE — le ③ porte 13 pt d'ecart BUY−SELL.
//   usage : node stats/_cont_di_delta_porteur.mjs
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
// ⭐ LE PORTEUR : DI+ en BUY, DI− en SELL. Le choix du camp EST le miroir — un seul endroit.
const dPort = (s) => (s.side === "BUY" ? P(s).diPlusDelta : s.side === "SELL" ? P(s).diMinusDelta : null);
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const p = [...g.values()].map((o) => o.w / o.n);
  const m = p.reduce((a, b) => a + b, 0) / p.length;
  const v = p.length > 1 ? p.reduce((a, b) => a + (b - m) ** 2, 0) / (p.length - 1) : null;
  return { n: t.length, gr: p.length, wr: 100 * m, sig: v === null ? null : 100 * Math.sqrt(v / p.length),
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const L = (lbl, t, w = 16) => { const s = st(t);
  console.log("  " + String(lbl).padEnd(w) + String(t.length).padStart(7) + (s ? String(s.gr).padStart(6) : "     0")
    + (s ? (s.wr.toFixed(1) + "%").padStart(9) : "        —")
    + (s && s.sig !== null ? ("±" + s.sig.toFixed(1)).padStart(8) : "       —")
    + (s ? ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9) : "        —")
    + (s && s.gr < 20 ? "  ⚠ <20 grap" : (s && s.wr < 75 ? "  🔴" : ""))); };
const H = (t, w = 16) => { console.log("  " + t.padEnd(w) + "tirs".padStart(7) + "grap".padStart(6) + "WR/grap".padStart(9) + "sigma".padStart(8) + "R".padStart(9));
  console.log("  " + "─".repeat(w + 39)); };

const avec = CONT.filter((s) => Number.isFinite(dPort(s)));
console.log(`\n═══ \`ΔDI PORTEUR\` (c1 − c2) ═══  ${CONT.length} tirs · ${avec.length} avec la mesure · ${CONT.length - avec.length} muets`);
const ref = st(CONT);
console.log(`  reference ${ref.wr.toFixed(1)} % ±${ref.sig.toFixed(1)} · ${(ref.R >= 0 ? "+" : "") + ref.R.toFixed(1)} R · point mort 75,0 %`);
const v = avec.map(dPort).sort((a, b) => a - b);
const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
console.log(`\n  ── ① LA DISTRIBUTION (c'est elle qui doit dicter le seuil) ──`);
console.log(`     min ${v[0].toFixed(2)} · p05 ${q(.05).toFixed(2)} · p20 ${q(.20).toFixed(2)} · p35 ${q(.35).toFixed(2)} · median ${q(.5).toFixed(2)}`);
console.log(`     p65 ${q(.65).toFixed(2)} · p80 ${q(.80).toFixed(2)} · p95 ${q(.95).toFixed(2)} · max ${v[v.length - 1].toFixed(2)}`);
const dans = (s) => Math.abs(dPort(s));
for (const d of [1, 1.5, 2, 2.5, 3]) {
  const st2 = 100 * v.filter((x) => Math.abs(x) <= d).length / v.length;
  console.log(`     seuil ±${d.toFixed(1)}  ⇒  STABLE = ${st2.toFixed(1)} %` + (Math.abs(st2 - 30) < 6 ? "   ⟵ proche des 30 % de `gapDynClose`" : ""));
}

console.log(`\n  ── ② CE QUE L'AXE SEPARE, PAR TRANCHE DE ΔDI PORTEUR ──`);
const TR = [[-Infinity, -3], [-3, -1.5], [-1.5, 0], [0, 1.5], [1.5, 3], [3, Infinity]];
const nom = (lo, hi) => (lo === -Infinity ? "< −3" : hi === Infinity ? "> +3" : `[${lo} · ${hi}[`);
for (const [lbl, sel] of [["TOUS", () => true], ["BUY (ΔDI+)", (x) => x.side === "BUY"], ["SELL (ΔDI−)", (x) => x.side === "SELL"]]) {
  const POP = avec.filter(sel);
  console.log(`\n  ══ ${lbl} ══  ${POP.length} tirs`);
  H("ΔDI porteur");
  for (const [lo, hi] of TR) L(nom(lo, hi), POP.filter((s) => dPort(s) >= lo && dPort(s) < hi));
}

// ── ④ LA GRILLE DICTEE : NIVEAU DI (porteur) x VITESSE (ΔDI porteur) ────────────────────────
// ⭐⭐ Croisement deja productif dans ce depot (« vitesse x niveau », quatre capteurs le portent).
// ⚠ Bandes de VITESSE centrees sur ZERO — le zero a un sens MECANIQUE (le camp se renforce ou
//   s affaiblit). La MEDIANE vaut −2,55 : elle n est qu un fait de population, pas un repere.
// 🔄 22/08 — **CINQ bandes, pas quatre** (owner). Le 1er jet fusionnait `]+1,5·+3]` (86,6 %) et
//   `> +3` (75,6 %) dans un seul `HAUSSE` a 79,7 % — **la moyenne de deux comportements opposes**.
//   C'est « un chiffre agrege ne decrit pas une population qui a deux moities », commis dans le
//   BANDAGE : le decoupage etait choisi pour equilibrer les effectifs, pas pour separer les faits.
//   ⭐ Symetrique autour de zero, qui est le seul repere MECANIQUE (le camp se renforce ou non).
const VIT = [[-Infinity,-4,"CHUTE <-4"],[-4,-2,"BAISSE -4..-2"],[-2,2,"PLAT +-2"],
             [2,4,"HAUSSE +2..+4"],[4,Infinity,"ENVOL >+4"]];
const NIV = Object.keys(CONT_DI_GRID);
const niv = (x) => P(x).diNiveau;
const cel = (t) => { const x = st(t);
  return x ? String(x.n).padStart(6) + String(x.gr).padStart(5) + (x.wr.toFixed(1)+"%").padStart(8) + ((x.R>=0?"+":"")+x.R.toFixed(1)).padStart(8)
           : "     -    -       -       -"; };
for (const [lbl, sel] of [["TOUS",()=>true],["BUY",(x)=>x.side==="BUY"],["SELL",(x)=>x.side==="SELL"]]) {
  const POP = avec.filter(sel);
  console.log("\n  == " + lbl + " ==   [ tirs . grappes . WR/grappe . R ]");
  console.log("  " + "niveau DI".padEnd(14) + VIT.map(([,,n]) => n.padStart(27)).join("") + "        LIGNE");
  console.log("  " + "-".repeat(14 + 27*VIT.length + 27));
  for (const nv of NIV) {
    const L2 = POP.filter((x) => niv(x) === nv);
    if (!L2.length) { console.log("  " + nv.padEnd(14) + "  (aucun tir)"); continue; }
    console.log("  " + nv.padEnd(14) + VIT.map(([lo,hi]) => cel(L2.filter((x) => dPort(x) >= lo && dPort(x) < hi))).join("") + " |" + cel(L2));
  }
  console.log("  " + "-".repeat(14 + 27*VIT.length + 27));
  console.log("  " + "COLONNE".padEnd(14) + VIT.map(([lo,hi]) => cel(POP.filter((x) => dPort(x) >= lo && dPort(x) < hi))).join("") + " |" + cel(POP));
}
console.log(`\n  ── ③ POUR MEMOIRE — l'axe SORTANT (\`gapDynClose\`, l'ECART) sur la meme population ──`);
H("gapDyn", 16);
for (const d of ["NARROWING", "STABLE", "WIDENING"]) L(d, CONT.filter((s) => P(s).diDyn === d));
console.log(`\n  ⚠ Les deux axes ne mesurent PAS la meme chose : l'un le CAMP, l'autre l'ECART entre camps.\n`);
