// _cont_famille_anticorrel.mjs — QUELLE FAMILLE PORTE L'ANTI-CORRELATION DU RANG ③ ?
//
// 🎯 PREREQUIS NOMME : mesure du 12/08 — le barema CONT est ANTI-CORRELE cote BUY. Le WR par grappe
//   passe de 85,7 % (bande la plus BASSE) a 64,9 % (bande `[24·28[`), et 60 % du volume BUY vit dans
//   les bandes hautes, qui portent les deux grosses pertes (−14,3 et −30,6 R). Le total dit QUE le
//   barema note haut ce qui perd ; il ne dit pas LAQUELLE des trois familles le fait.
//
// ⭐⭐ ON DECOUPE PAR FAMILLE, PAS PAR ENTREE. Les entrees d'une meme famille sont MOYENNEES entre
//   elles (`rsi` = 2·H1 + 1·M15) : les separer poserait une question a laquelle le barema ne repond
//   pas — il ne lit jamais `rsiH1` seul. ⚠ `parts` reste imprime pour le diagnostic.
//
// ⚠⚠ LE COLLIDER, ET POURQUOI IL EST ATTENUE ICI SANS ETRE ABSENT. Le depot interdit de juger un
//   expert SUR LES TIRS : au-dessus d'un seuil, les termes du score sont anti-correles (un score
//   eleve avec une famille basse signale que les DEUX autres ont compense). Ici `MIN_CONT = -11`
//   ⇒ AUCUNE selection par le score, tout le residu tire. **MAIS la CAPACITE sature**, et elle
//   selectionne — pas par le score, par la chronologie et l'espacement. Le biais restant est donc
//   celui de la capacite, pas celui du seuil. ⇒ lire les ORDRES, pas les niveaux absolus.
//
// ⚠ WR PAR GRAPPE actif x jour (sigma x9). Point mort 75,0 %. Bandes DERIVEES des donnees — une
//   borne ecrite se perime avec l'echelle, et ca vient d'arriver sur la sonde jumelle.
//   usage : node stats/_cont_famille_anticorrel.mjs   [COTE=BUY|SELL]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "-11";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const COTE = process.env.COTE ?? "BUY";

let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const T = all.filter((s) => s.strategy === "CONT" && fini(s) && s.side === COTE
                         && s.sc?.boxes?.cont?.familles);
const fam = (s, n) => s.sc.boxes.cont.familles[n];

const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };

console.log(`\n═══ RANG ③ · QUELLE FAMILLE PORTE L'ANTI-CORRELATION ? · COTE ${COTE} ═══`);
console.log(`  [MIN_CONT=${process.env.MIN_CONT} · ① et ② a leurs seuils REELS · spread FACTURE · point mort 75,0 %]`);
console.log(`  ${T.length} tirs avec familles tracees`);
if (!T.length) { console.log("  🔴 AUCUN TIR — rien a mesurer."); process.exit(0); }

for (const nom of ["rsi", "di", "kH4"]) {
  const avec = T.filter((s) => Number.isFinite(fam(s, nom)));
  const muet = T.length - avec.length;
  console.log(`\n  ── FAMILLE \`${nom}\` ──  ${avec.length} tirs notes · ${muet} muets (${(100 * muet / T.length).toFixed(1)} %)`);
  if (!avec.length) { console.log("     🔴 famille MUETTE sur toute la population — elle ne peut rien porter."); continue; }
  const vals = avec.map((s) => fam(s, nom));
  const MIN = Math.min(...vals), MAX = Math.max(...vals);
  const PAS = Math.max(2, Math.ceil((MAX - MIN) / 8 / 2) * 2);
  const LO = Math.floor(MIN / PAS) * PAS, HI = Math.ceil(MAX / PAS) * PAS;
  console.log("     bande        tirs grap  WR/grap        R      R/tir");
  const pts = [];
  for (let lo = LO; lo < HI; lo += PAS) {
    const s = st(avec.filter((x) => fam(x, nom) >= lo && fam(x, nom) < lo + PAS));
    if (!s) { console.log(`     [${String(lo).padStart(3)} · ${String(lo + PAS).padStart(3)}[      —    —        —        —`); continue; }
    pts.push([lo + PAS / 2, s.wrg]);
    console.log(`     [${String(lo).padStart(3)} · ${String(lo + PAS).padStart(3)}[ ${String(s.n).padStart(6)} ${String(s.gr).padStart(4)} ${s.wrg.toFixed(1).padStart(8)}% ${((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9)} ${(s.R / s.n).toFixed(3).padStart(9)}`);
  }
  // ⭐ PENTE au sens de la CORRELATION DE RANG (Spearman simplifie sur les bandes) : le signe suffit,
  //   et il ne depend pas de l'echelle. NEGATIF = la famille note HAUT ce qui perd.
  if (pts.length >= 3) {
    const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    let sxy = 0, sxx = 0;
    for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
    const pente = sxx ? sxy / sxx : NaN;
    console.log(`     → pente WR/grappe par point de note : ${(pente >= 0 ? "+" : "") + pente.toFixed(3)} pt` +
      `   ${pente < -0.05 ? "🔴 ANTI-CORRELEE" : pente > 0.05 ? "✅ ordonne" : "· plate"}`);
  }
}
console.log(`\n  ⚠ Les bandes basses sont des SURVIVANTES (capacite saturee) — lire les ORDRES, pas les niveaux.`);
console.log(`  ⚠ La pente est une DESCRIPTION de la table imprimee, pas un test : elle ignore les effectifs.\n`);
