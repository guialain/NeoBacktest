// _cont_kh4_decompose.mjs — LA FAMILLE `kH4` DECOMPOSEE : LA BASE, LE FACTEUR, ET QUI DECIDE.
//
// 🎯 PREREQUIS D'UNE DICTEE (owner 22/08) : « meanslope module deja la somme, on va supprimer le
//   modulateur du H4 et refaire sa table plus proprement ». Avant de re-dicter, il faut savoir ce
//   que chaque moitie APPORTE — sinon on re-dicte la base en croyant corriger ce que faisait le
//   facteur, ou l'inverse.
//     note famille  =  contNoteKh4(%K H4, dKBand H4, side)   ×   facteur(%K H1, K−D H1, side)
//                        `kH4Brut` ∈ [0 · 5]                      `facH1App` ∈ {0, 1, 2}
//
// ⭐⭐⭐ CE QU'ON CHERCHE, ET C'EST UNE QUESTION DE FORME AVANT D'ETRE UNE QUESTION DE CHIFFRE :
//   si la BASE est plate et le FACTEUR discrimine, alors la famille n'est pas une note x un
//   modulateur — c'est un modulateur DEGUISE, et la « table » n'est qu'un porteur. Le retrait du
//   facteur serait alors le retrait du SEUL organe qui trie, pas d'une couche redondante.
//   ⇒ On mesure la dispersion de CHAQUE moitie, et le WR par valeur de chacune.
//
// ⚠ WR par GRAPPE (actif|jour). Point mort 75,0 %. `MIN_CONT` = defaut (5).
// ⚠ La table de base note QUASIMENT QUE la colonne `UP` (14 cases sur 21 valent 0) : une base a 0
//   n'est pas « muette », elle est NOTEE ZERO — la famille parle quand meme et DILUE.
//   usage : node stats/_cont_kh4_decompose.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
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
const L = (lbl, t, w = 16) => { const s = st(t);
  console.log("  " + String(lbl).padEnd(w) + String(t.length).padStart(7) + (s ? String(s.gr).padStart(6) : "     0")
    + (s ? (s.wr.toFixed(1) + "%").padStart(9) : "        —")
    + (s && s.sig !== null ? ("±" + s.sig.toFixed(1)).padStart(8) : "       —")
    + (s ? ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9) : "        —")
    + (s && s.gr < 20 ? "  ⚠ <20 grap" : (s && s.wr < 75 ? "  🔴" : ""))); };
const H = (t, w = 16) => { console.log("  " + t.padEnd(w) + "tirs".padStart(7) + "grap".padStart(6) + "WR/grap".padStart(9) + "sigma".padStart(8) + "R".padStart(9));
  console.log("  " + "─".repeat(w + 39)); };

const ref = st(CONT);
console.log(`\n═══ LA FAMILLE \`kH4\` DECOMPOSEE ═══  ${CONT.length} tirs · ${ref.gr} grappes · ref ${ref.wr.toFixed(1)} %`);

console.log(`\n  ── ① LA BASE SEULE (\`kH4Brut\`, la table 2D, [0 · 5]) ──`);
H("kH4Brut");
const bruts = [...new Set(CONT.map((s) => P(s).kH4Brut).filter((x) => x !== null && x !== undefined))].sort((a, b) => a - b);
for (const v of bruts) L(String(v), CONT.filter((s) => P(s).kH4Brut === v));
L("(absent)", CONT.filter((s) => P(s).kH4Brut === null || P(s).kH4Brut === undefined));

console.log(`\n  ── ② LE FACTEUR SEUL (\`facH1App\` ∈ {0,1,2}) ──`);
H("facteur");
for (const v of [0, 1, 2]) L(String(v), CONT.filter((s) => P(s).facH1App === v));

console.log(`\n  ── ③ LE PRODUIT — qui decide vraiment ? ──`);
H("base × fact", 16);
for (const b of bruts) for (const f of [0, 1, 2]) {
  const t = CONT.filter((s) => P(s).kH4Brut === b && P(s).facH1App === f);
  if (t.length) L(`${b} × ${f} = ${b * f}`, t);
}

console.log(`\n  ── ④ LA BANDE \`%K H1\` QUI PORTE LE FACTEUR (l'axe qu'on s'apprete a retirer) ──`);
H("kH1Bande", 16);
const bandes = [...new Set(CONT.map((s) => P(s).kH1Bande).filter(Boolean))].sort();
for (const b of bandes) L(b, CONT.filter((s) => P(s).kH1Bande === b));
console.log(`\n  ⚠ La question de forme : si ① est PLATE et ② discrimine, la « table » kH4 n'est qu'un`);
console.log(`     porteur et le FACTEUR est le vrai capteur — le retirer retirerait ce qui trie.\n`);
