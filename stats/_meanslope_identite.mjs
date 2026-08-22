// _meanslope_identite.mjs — `meanSlope` EST-IL UNE PENTE, OU UN DEPLACEMENT SUR 20 BARRES ?
//
// 🎯 L'HYPOTHESE, tiree de l'algebre de la SMA(20) et NON d'une lecture de code :
//     middle_s0 = (p + c1 + … + c19)/20   (barre EN FORMATION, `p` tient lieu de cloture)
//     middle_s1 = (c1 + … + c19 + c20)/20 (barre CLOTUREE)
//     ⇒ middle_s0 − middle_s1 = (p − c20)/20
//   Si c'est vrai, `meanSlope` ne mesure PAS une pente locale : il mesure le DEPLACEMENT DU PRIX
//   SUR 20 HEURES, divise par 20. Ce serait un MOMENTUM, pas une derivee.
//
// ⭐⭐⭐ LE TEST, ET IL NE SUPPOSE RIEN : dans UNE MEME barre H1, `c20` est CONSTANT (c'est une
//   cloture passee). Donc `p − 20·(middle_s0 − middle_s1)` doit etre RIGOUREUSEMENT constant sur
//   tous les scans de l'heure. On mesure la DISPERSION de cette quantite intra-barre, en part du
//   prix. Si elle est nulle a la precision d'ecriture du CSV, l'identite tient.
//
// ⚠ Ce que le test NE PEUT PAS faire : verifier que la constante EST bien `c20` (la matrice ne
//   porte pas `close_h1_s20`). Il etablit la FORME de la relation, pas l'identite du terme. C'est
//   suffisant pour la question posee — « pente locale ou deplacement long » — et il faut le dire.
// ⚠ Barres avec un seul scan ignorees (aucune dispersion possible, elles ne testent rien).
//   usage : node stats/_meanslope_identite.mjs
import fs from "fs"; import path from "path";
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const CH = ["timestamp", "price", "middle_h1", "middle_h1_s1"];
const num = (v) => { if (v === null || v === undefined || v === "") return null;
  const n = Number(v); return Number.isFinite(n) ? n : null; };
console.log("\n══ `meanSlope` : PENTE LOCALE ou DEPLACEMENT SUR 20 BARRES ? ══");
console.log("  test : `p − 20·(middle_h1 − middle_h1_s1)` doit etre CONSTANT dans une meme barre H1\n");
console.log("  " + "actif".padEnd(12) + "barres".padStart(8) + "scans".padStart(8)
  + "dispersion intra-barre (part du prix)".padStart(40) + "   verdict");
console.log("  " + "─".repeat(90));
let glob = 0, gn = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const ix = {}; for (const n of CH) ix[n] = head.indexOf(n);
  if (CH.some((n) => ix[n] < 0)) { console.log("  " + a.padEnd(12) + "  colonnes absentes"); continue; }
  const par = new Map();                       // heure H1 -> [valeurs de la constante]
  let nsc = 0;
  for (const l of L.slice(1)) {
    const c = l.split(";");
    const p = num(c[ix.price]), m0 = num(c[ix.middle_h1]), m1 = num(c[ix.middle_h1_s1]);
    if (p === null || m0 === null || m1 === null || p <= 0) continue;
    const h = String(c[ix.timestamp]).slice(0, 13);   // "YYYY.MM.DD HH" — la barre H1
    const k = p - 20 * (m0 - m1);
    if (!par.has(h)) par.set(h, []);
    par.get(h).push(k / p);                     // NORMALISE par le prix : comparable entre actifs
    nsc++;
  }
  // ⭐ On mesure l'ETENDUE (max−min) dans chaque barre, pas un ecart-type : une identite exacte a
  //   une etendue NULLE, et l'etendue ne se laisse pas diluer par le nombre de scans.
  let som = 0, nb = 0, pire = 0;
  for (const v of par.values()) {
    if (v.length < 2) continue;
    const e = Math.max(...v) - Math.min(...v);
    som += e; nb++; if (e > pire) pire = e;
  }
  if (!nb) { console.log("  " + a.padEnd(12) + "  aucune barre multi-scan"); continue; }
  const moy = som / nb;
  glob += som; gn += nb;
  const ok = moy < 1e-6;
  console.log("  " + a.padEnd(12) + String(nb).padStart(8) + String(nsc).padStart(8)
    + ("moy " + moy.toExponential(2) + " · pire " + pire.toExponential(2)).padStart(40)
    + "   " + (ok ? "✅ CONSTANT" : moy < 1e-4 ? "≈ constant" : "🔴 VARIE"));
}
console.log("  " + "─".repeat(90));
console.log(`  ⭐ etendue intra-barre MOYENNE, tous actifs : ${(glob / gn).toExponential(3)} (part du prix, sur ${gn} barres)`);
console.log(`\n  ⚠ Une etendue nulle etablit la FORME \`middle_s0 − middle_s1 = (p − K)/20\` avec K constant`);
console.log(`     dans la barre. Elle n'etablit PAS que K vaut \`close_h1[20]\` — la matrice ne le porte pas.\n`);
