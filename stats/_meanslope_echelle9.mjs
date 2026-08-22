// _meanslope_echelle9.mjs — L'ECHELLE COMPLETE DE `|meanSlope|` PAR ACTIF, POUR UNE GRAMMAIRE A 9 BANDES
//
// 🎯 PREREQUIS NOMME : owner 22/08 — passer `meanSlope` de 7 a **9 bandes**
//   (`FLAT` + WEAK/AVERAGE/STRONG/EXTREME x UP/DOWN), pour separer les EXTREMES proches de
//   l'epuisement des CONTINUATIONS FORTES. 9 bandes = **4 coupes** sur `|meanSlope|` ; le script du
//   16/08 (`_meanslope_percentiles`) n'en sort que trois BASSES (p20/p25/p30). Il en faut des HAUTES.
//
// 🔴🔥 ET C'EST LA QUE LE PROBLEME CHANGE DE NATURE. Le 16/08 on notait : « l'ecretage n'a pas
//   d'importance, un percentile BAS y est insensible ». **Cette phrase ne vaut plus.** Les coupes
//   qu'on cherche maintenant sont a p80/p90/p95 — EN PLEIN dans la queue que les barres MAL
//   APPARIEES (week-end, marche ferme) contaminent, jusqu'a 36x le P99. ⇒ on imprime BRUT **et**
//   ECRETE, et surtout on COMPTE les valeurs aberrantes au lieu de supposer qu'il y en a peu.
//   ⭐⭐ Le motif : « un seuil se perime avec son CAPTEUR » — ici c'est la JUSTIFICATION d'un choix
//   de methode qui se perime quand on deplace le percentile vise.
//
// ⚠ Population = TOUTES les barres, pas le residu du ③ : les bandes sont une propriete de l'ACTIF.
// ⚠ Lignes MORTES exclues (>= 5 lignes au meme timestamp = panne broker), comme le 16/08.
// ⚠ CE SCRIPT NE DICTE RIEN. Il imprime l'echelle ; les 4 coupes sont une DICTEE owner.
//   usage : node stats/_meanslope_echelle9.mjs
import fs from "fs"; import path from "path";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { computeDeviation, getDeviationBands, meanFlatCut } = await import(R);
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const MORT = 5;
const CH = ["timestamp", "symbol", "price", "zscore_h1_s0", "sigma_h1", "middle_h1_s1", "close_h1_s1"];
const q = (a, p) => { const i = Math.min(a.length - 1, Math.floor(p * a.length)); return a[i]; };
const PS = [0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 0.97, 0.99];
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
    vals.push(Math.abs(d.meanSlope));
  }
  vals.sort((x, y) => x - y);
  const p99 = q(vals, 0.99);
  // ⭐ ON COMPTE LES ABERRANTES AU LIEU DE LES SUPPOSER RARES : combien de barres depassent 5x le p99 ?
  //   C'est la mesure qui dit si l'ecretage est une precaution ou une necessite.
  const ab5 = vals.filter((v) => v > 5 * p99).length, ab10 = vals.filter((v) => v > 10 * p99).length;
  const clip = vals.slice(0, Math.floor(vals.length * 0.995));
  lignes.push({ a, n: vals.length, p: PS.map((x) => q(vals, x)), cp: PS.map((x) => q(clip, x)),
                max: vals[vals.length - 1], p99, ab5, ab10,
                flat: meanFlatCut(a), stock: getDeviationBands(a)?.dMean ?? null });
}

console.log(`\n══ |meanSlope| H1 — ECHELLE COMPLETE PAR ACTIF ══  ${nTot} lignes lues · ${nMuet} sans pente\n`);
console.log("  " + "actif".padEnd(12) + PS.map((x) => ("p" + Math.round(x * 100)).padStart(8)).join(""));
console.log("  " + "─".repeat(12 + 8 * PS.length));
for (const r of lignes) console.log("  " + r.a.padEnd(12) + r.p.map((v) => v.toFixed(4).padStart(8)).join(""));

console.log(`\n  ── CONTAMINATION DE LA QUEUE (les barres mal appariees) ──`);
console.log("  " + "actif".padEnd(12) + "p99".padStart(9) + "max".padStart(11) + "max/p99".padStart(10)
  + ">5xp99".padStart(9) + ">10xp99".padStart(9) + "   p90 brut → ecrete");
console.log("  " + "─".repeat(78));
for (const r of lignes) {
  const i90 = PS.indexOf(0.90);
  const dr = 100 * (r.p[i90] - r.cp[i90]) / r.cp[i90];
  console.log("  " + r.a.padEnd(12) + r.p99.toFixed(4).padStart(9) + r.max.toFixed(4).padStart(11)
    + (r.max / r.p99).toFixed(1).padStart(10) + String(r.ab5).padStart(9) + String(r.ab10).padStart(9)
    + "   " + r.p[i90].toFixed(4) + " → " + r.cp[i90].toFixed(4)
    + ((dr >= 0 ? " (+" : " (") + dr.toFixed(1) + " %)") + (Math.abs(dr) > 3 ? "  🔴" : ""));
}

console.log(`\n  ── OU TOMBE LE PLANCHER ACTUEL DU VETO (\`dMeanFlat\`, p20 dicte le 16/08) ──`);
console.log("  " + "actif".padEnd(12) + "dMeanFlat".padStart(11) + "p20 mesure".padStart(12)
  + "  ecart" + "   │ dMean[0] stocke".padStart(20) + "  p30 mesure".padStart(13) + "  ecart");
console.log("  " + "─".repeat(88));
let s1 = 0, s2 = 0, c = 0;
for (const r of lignes) {
  const p20 = r.p[PS.indexOf(0.20)], p30 = r.p[PS.indexOf(0.30)];
  const e1 = r.flat ? 100 * (p20 - r.flat) / r.flat : null;
  const e2 = r.stock?.[0] ? 100 * (p30 - r.stock[0]) / r.stock[0] : null;
  if (e1 !== null) { s1 += Math.abs(e1); }
  if (e2 !== null) { s2 += Math.abs(e2); c++; }
  console.log("  " + r.a.padEnd(12) + (r.flat ?? 0).toFixed(4).padStart(11) + p20.toFixed(4).padStart(12)
    + ((e1 === null ? "—" : (e1 >= 0 ? "+" : "") + e1.toFixed(1) + " %")).padStart(9)
    + "   │" + (r.stock?.[0] ?? 0).toFixed(4).padStart(16) + p30.toFixed(4).padStart(13)
    + ((e2 === null ? "—" : (e2 >= 0 ? "+" : "") + e2.toFixed(1) + " %")).padStart(9)
    + (e2 !== null && Math.abs(e2) > 15 ? "  🔴" : ""));
}
console.log("  " + "─".repeat(88));
console.log(`  ⭐ ecart ABSOLU moyen — \`dMeanFlat\` vs p20 mesure : ${(s1 / c).toFixed(1)} %   ·   \`dMean[0]\` vs p30 mesure : ${(s2 / c).toFixed(1)} %`);
console.log(`\n  ⚠ CE SCRIPT NE DICTE PAS LES COUPES. Il montre l'echelle ; les 4 percentiles sont une DICTEE.\n`);
