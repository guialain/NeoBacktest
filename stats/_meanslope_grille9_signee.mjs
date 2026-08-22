// _meanslope_grille9_signee.mjs — LA GRILLE OWNER A 9 BANDES, SUR LA DISTRIBUTION **SIGNEE**
//
// 🎯 DICTEE owner 22/08, telle quelle :
//     v > P95            EXTREME_UP        |  v < P05            EXTREME_DOWN
//     P85 … P95          STRONG_UP         |  P05 … P15          STRONG_DOWN
//     P65 … P85          AVERAGE_UP        |  P15 … P35          AVERAGE_DOWN
//     P55 … P65          WEAK_UP           |  P35 … P45          WEAK_DOWN
//                        P45 … P55  FLAT
//   Poids : 5 + 10 + 20 + 10 = 45 % par cote, 10 % de FLAT. Somme 100 %. ✅
//
// ⚠⚠⭐⭐⭐ CE QUI CHANGE PAR RAPPORT A LA GRAMMAIRE ACTUELLE, ET QUI N'EST PAS UN DETAIL :
//   `deltaBand` bande `|meanSlope|` et centre donc ses bandes sur **ZERO**. Une grille en
//   percentiles SIGNES les centre sur la **MEDIANE**. Or le veto `cont-mean-flat` note lui-meme que
//   la mediane de `meanSlope` est FRANCHEMENT SIGNEE par actif sur ce dataset. ⇒ `FLAT` peut ne PAS
//   contenir zero, et une bande `*_DOWN` peut etre entierement composee de pentes POSITIVES.
//
// 🔴🔥 C'EST POURQUOI CE SCRIPT MESURE AUSSI **LE PERCENTILE DE ZERO** (`P(v<0)`), par actif. C'est
//   le seul chiffre qui dit si le VOCABULAIRE est honnete :
//     · si P(zero) tombe dans [45 · 55], `FLAT` contient zero et les noms disent la verite ;
//     · s'il en sort, une bande porte un nom qu'elle ne merite pas, EN SILENCE.
//   ⭐ Le motif du depot : « un commentaire assertif vieillit comme un chiffre en dur » — ici c'est
//   le NOM DE LA BANDE qui ferait l'affirmation fausse, et un nom ne leve jamais.
//
// ⚠ La fenetre est UNE SAISON (28 jours ouvres, juillet-aout). Une grille centree sur la mediane
//   encode donc la derive de juillet DANS LA GRAMMAIRE, pas seulement dans une table. C'est un fait
//   a poser, pas un verdict : c'est aussi ce qui NORMALISE la pente au regime propre de l'actif.
//
// ⚠ Population = TOUTES les barres (les bandes sont une propriete de l'ACTIF, pas d'un rang).
// ⚠ Lignes MORTES exclues (>= 5 lignes au meme timestamp = panne broker), comme le 16/08.
//   usage : node stats/_meanslope_grille9_signee.mjs
import fs from "fs"; import path from "path";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { computeDeviation, meanFlatCut } = await import(R);
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const MORT = 5;
const CH = ["timestamp", "symbol", "price", "zscore_h1_s0", "sigma_h1", "middle_h1_s1", "close_h1_s1"];
const q = (a, p) => { const i = Math.min(a.length - 1, Math.max(0, Math.floor(p * a.length))); return a[i]; };
const PS = [0.05, 0.15, 0.35, 0.45, 0.55, 0.65, 0.85, 0.95];
const NOM = ["P05", "P15", "P35", "P45", "P55", "P65", "P85", "P95"];
const lignes = []; let nTot = 0, nMuet = 0;

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const ix = {}; for (const n of CH) ix[n] = head.indexOf(n);
  const manq = CH.filter((n) => ix[n] < 0); if (manq.length) throw new Error(`${a} : ${manq.join(", ")}`);
  const nPar = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); nPar.set(c[ix.timestamp], (nPar.get(c[ix.timestamp]) ?? 0) + 1); }
  const gele = new Set([...nPar].filter(([, n]) => n >= MORT).map(([t]) => t));
  const vals = [];
  for (const l of L.slice(1)) {
    const c = l.split(";"); if (gele.has(c[ix.timestamp])) continue;
    const row = {}; for (const n of CH) row[n] = c[ix[n]];
    nTot++;
    const d = computeDeviation(row, a, "h1");
    if (!Number.isFinite(d?.meanSlope)) { nMuet++; continue; }
    vals.push(d.meanSlope);                      // ⚠ SIGNE, pas |v| — c'est tout l'objet de la dictee
  }
  vals.sort((x, y) => x - y);
  const cuts = PS.map((x) => q(vals, x));
  // ⭐ LE PERCENTILE DE ZERO : la part des barres dont la pente est NEGATIVE. C'est le controle.
  const pz = 100 * vals.filter((v) => v < 0).length / vals.length;
  lignes.push({ a, n: vals.length, cuts, med: q(vals, 0.50), pz, flat: meanFlatCut(a) });
}

console.log(`\n══ \`meanSlope\` H1 SIGNE — LA GRILLE OWNER A 9 BANDES ══  ${nTot} lignes · ${nMuet} sans pente\n`);
console.log("  " + "actif".padEnd(12) + NOM.map((n) => n.padStart(9)).join("") + "   mediane");
console.log("  " + "─".repeat(12 + 9 * NOM.length + 10));
for (const r of lignes)
  console.log("  " + r.a.padEnd(12) + r.cuts.map((v) => ((v >= 0 ? "+" : "") + v.toFixed(4)).padStart(9)).join("")
    + ((r.med >= 0 ? "  +" : "  ") + r.med.toFixed(4)).padStart(10));

console.log(`\n  ── 🔴 LE CONTROLE : OU TOMBE ZERO DANS L'ECHELLE ? ──`);
console.log("  " + "actif".padEnd(12) + "P(v<0)".padStart(9) + "   verdict");
console.log("  " + "─".repeat(72));
let ko = 0;
for (const r of lignes) {
  const dans = r.pz >= 45 && r.pz <= 55;
  if (!dans) ko++;
  // ⚠ On NOMME la bande dans laquelle zero tombe, pas seulement « hors FLAT » : c'est elle qui
  //   portera un nom faux, et c'est elle qu'il faudra citer.
  const b = r.pz < 5 ? "EXTREME_DOWN" : r.pz < 15 ? "STRONG_DOWN" : r.pz < 35 ? "AVERAGE_DOWN"
          : r.pz < 45 ? "WEAK_DOWN" : r.pz <= 55 ? "FLAT" : r.pz <= 65 ? "WEAK_UP"
          : r.pz <= 85 ? "AVERAGE_UP" : r.pz <= 95 ? "STRONG_UP" : "EXTREME_UP";
  console.log("  " + r.a.padEnd(12) + (r.pz.toFixed(1) + " %").padStart(9) + "   zero tombe dans `" + b + "`"
    + (dans ? "" : "   🔴 FLAT NE CONTIENT PAS ZERO"));
}
console.log("  " + "─".repeat(72));
console.log(`  ⭐ ${lignes.length - ko}/${lignes.length} actifs ont zero dans \`FLAT\` · ${ko} ne l'ont PAS.`);

console.log(`\n  ── LES BANDES ENTIEREMENT D'UN SEUL SIGNE (le nom ment) ──`);
let men = 0;
for (const r of lignes) {
  const B = [["EXTREME_DOWN", -Infinity, r.cuts[0]], ["STRONG_DOWN", r.cuts[0], r.cuts[1]],
             ["AVERAGE_DOWN", r.cuts[1], r.cuts[2]], ["WEAK_DOWN", r.cuts[2], r.cuts[3]],
             ["FLAT", r.cuts[3], r.cuts[4]], ["WEAK_UP", r.cuts[4], r.cuts[5]],
             ["AVERAGE_UP", r.cuts[5], r.cuts[6]], ["STRONG_UP", r.cuts[6], r.cuts[7]],
             ["EXTREME_UP", r.cuts[7], Infinity]];
  const faux = B.filter(([n, lo, hi]) =>
    (n.endsWith("_DOWN") && lo >= 0) || (n.endsWith("_UP") && hi <= 0) ||
    (n === "FLAT" && (lo > 0 || hi < 0)));
  if (faux.length) { men++; console.log("  " + r.a.padEnd(12) + "🔴 " + faux.map(([n]) => n).join(", ")); }
}
if (!men) console.log("  ✅ aucune — sur les 19 actifs, chaque bande `*_DOWN` contient bien du negatif et chaque `*_UP` du positif.");

console.log(`\n  ⚠ RAPPEL : ces coupes sont mesurees sur UNE SAISON (28 jours ouvres). Une grille centree sur`);
console.log(`     la MEDIANE encode la derive de la fenetre DANS LE VOCABULAIRE, pas seulement dans une table.\n`);
