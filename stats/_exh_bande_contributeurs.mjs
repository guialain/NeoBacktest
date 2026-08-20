// _exh_bande_contributeurs.mjs — QUI FAIT LE SCORE DANS UNE BANDE DU RANG ①.
// ============================================================================================
// ⚠⚠ LE PIEGE, ECRIT DANS LE MOTEUR : `boxes.exh.parts` garde les 8 notes d'ENTREE, mais **ce ne
//   sont plus les termes de la somme depuis le 11/08**. Ce qui se somme, ce sont les `familles`
//   (moyenne ponderee INTRA-famille, entree absente = 0). Un lecteur qui controle `Σ parts =
//   conviction` trouvera un ecart ET IL AURA TORT. On lit donc les DEUX, et on RECONCILIE d'abord.
// ⚠⚠ `parts` et `familles` sont SIGNES (convention `SELL = −BUY`), la conviction est en QUALITE.
//   ⇒ on ORIENTE par le cote avant de moyenner, sinon les deux cotes s'annulent et toutes les
//   contributions tombent vers 0 — un resultat plausible et faux.
// ⚠ Les commentaires du moteur disent « CINQ familles » alors que `EXH_FAMILLES_POIDS` en declare
//   QUATRE. Un commentaire assertif vieillit comme un chiffre en dur ⇒ on ne le croit pas, on
//   MESURE le diviseur qui reconcilie.
// ⚙ Usage : `MIN_EXH=15 BAS=17 HAUT=18 node stats/_exh_bande_contributeurs.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { MIN_EXH } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const { EXH_FAMILLES_POIDS } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/exhScoringV1.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

const envNum = (k, def) => {
  const raw = process.env[k];
  if (raw === undefined || raw === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
};
const BAS = envNum("BAS", 17), HAUT = envNum("HAUT", 18);
const MAXOPEN = envNum("MAXOPEN", 100), MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL,
  cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });

const EXH = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && typeof t.R === "number"
  && Number.isFinite(t.sc?.exh));
const avecBoite = EXH.filter((t) => t.sc?.boxes?.exh?.familles);
const dans = (t, a, b) => Math.abs(t.sc.exh) >= a && Math.abs(t.sc.exh) < b;
const BANDE = avecBoite.filter((t) => dans(t, BAS, HAUT));
const HAUTES = avecBoite.filter((t) => Math.abs(t.sc.exh) >= 21);   // les bandes SAINES, pour comparer

console.log(`\n══ RANG ① — CONTRIBUTEURS DU SCORE, BANDE [${BAS} · ${HAUT}[ ══`);
console.log(`   MIN_EXH ${MIN_EXH} · capacite ${MAXOPEN}/${MAXPERSYMBOL} · NO_TRIGGER=1`);
console.log(`   tirs EXH ${EXH.length} · avec boite lisible ${avecBoite.length}` +
  (avecBoite.length !== EXH.length ? `  ⚠⚠ ${EXH.length - avecBoite.length} SANS \`boxes.exh\` — POPULATION AMPUTEE` : ""));
console.log(`   bande n=${BANDE.length} · reference « score ≥ 21 » n=${HAUTES.length}`);
if (!BANDE.length) { console.log("\n   ⛔ BANDE VIDE — rien a decomposer.\n"); process.exit(0); }

// ── ① RECONCILIATION : on ne lit AUCUNE contribution avant de savoir ce qui fait le score. ─────
// ⭐ On teste `Σ familles` puis `Σ familles / k` pour k = 3..6 contre |sc.exh|. Le diviseur qui
//   colle est le VRAI, quel que soit ce que raconte le commentaire du moteur.
const orient = (v, side) => (side === "SELL" ? -v : v);
const somFam = (t) => Object.values(t.sc.boxes.exh.familles).reduce((a, b) => a + b, 0);
const nFam = (t) => Object.keys(t.sc.boxes.exh.familles).length;
console.log(`\n   ── RECONCILIATION (obligatoire avant toute lecture) ──`);
console.log(`   familles declarees dans EXH_FAMILLES_POIDS : ${Object.keys(EXH_FAMILLES_POIDS).join(" · ")} (${Object.keys(EXH_FAMILLES_POIDS).length})`);
const famVues = new Set(); for (const t of avecBoite) for (const k of Object.keys(t.sc.boxes.exh.familles)) famVues.add(k);
console.log(`   familles VUES sur les trades              : ${[...famVues].join(" · ")} (${famVues.size})`);
const ecart = (f) => {
  const e = avecBoite.map((t) => Math.abs(f(t) - Math.abs(t.sc.exh)));
  return { max: Math.max(...e), moy: e.reduce((a, b) => a + b, 0) / e.length };
};
for (const [nom, f] of [["Σ familles", (t) => Math.abs(somFam(t))],
                        ["Σ familles / n_familles", (t) => Math.abs(somFam(t) / nFam(t))],
                        ["Σ familles / 4", (t) => Math.abs(somFam(t) / 4)],
                        ["Σ familles / 5", (t) => Math.abs(somFam(t) / 5)],
                        ["Σ parts", (t) => Math.abs(Object.values(t.sc.boxes.exh.parts ?? {}).reduce((a, b) => a + b, 0))]]) {
  const { max, moy } = ecart(f);
  console.log(`   ${nom.padEnd(26)} vs |sc.exh|   ecart moyen ${moy.toFixed(4).padStart(9)}   max ${max.toFixed(4).padStart(9)}   ${max < 0.02 ? "✅ RECONCILIE" : ""}`);
}
console.log(`   ⚠ `+"`sc.exh` est le score BONIFIE ; `BONUS_APPLIQUE=false` ⇒ bonus nul, la reconciliation doit etre EXACTE.");

// ── ② LES CONTRIBUTIONS, ORIENTEES PAR LE COTE ────────────────────────────────────────────────
const stat = (arr, get) => {
  const v = arr.map(get).filter(Number.isFinite);
  if (!v.length) return null;
  const moy = v.reduce((a, b) => a + b, 0) / v.length;
  return { n: v.length, moy };
};
const tableau = (titre, pop, cles, get) => {
  console.log(`\n   ── ${titre} (n=${pop.length}) ──`);
  console.log(`   ${"cle".padEnd(14)}${"presente".padStart(9)}${"contrib. moy".padStart(14)}${"part du score".padStart(15)}${"| ref ≥21".padStart(12)}${"ecart".padStart(9)}`);
  const totMoy = stat(pop, (t) => Math.abs(t.sc.exh))?.moy ?? NaN;
  const lignes = cles.map((k) => {
    const s = stat(pop, (t) => { const v = get(t)[k]; return Number.isFinite(v) ? orient(v, t.side) : NaN; });
    const r = stat(HAUTES, (t) => { const v = get(t)[k]; return Number.isFinite(v) ? orient(v, t.side) : NaN; });
    return { k, s, r };
  }).filter((x) => x.s).sort((a, b) => b.s.moy - a.s.moy);
  for (const { k, s, r } of lignes) {
    // ⚠ LA RECONCILIATION A TRANCHE : `Σ familles = |sc.exh|` A L'EXACT. Le score est donc la SOMME
    //   des familles, PAS leur moyenne — le denominateur de la part est le SCORE, sans diviseur.
    //   (1er jet : `totMoy * nFam`, qui rendait toutes les parts 4x trop petites.)
    const part = 100 * s.moy / totMoy;
    console.log(`   ${k.padEnd(14)}${String(s.n).padStart(6)}/${String(pop.length).padEnd(2)}${s.moy.toFixed(3).padStart(14)}${(part.toFixed(1) + " %").padStart(15)}${(r ? r.moy.toFixed(3) : "—").padStart(12)}${(r ? (s.moy - r.moy).toFixed(3) : "—").padStart(9)}`);
  }
};
const clesFam = [...famVues];
const clesParts = [...new Set(avecBoite.flatMap((t) => Object.keys(t.sc.boxes.exh.parts ?? {})))];
tableau("FAMILLES — ce qui SE SOMME", BANDE, clesFam, (t) => t.sc.boxes.exh.familles);
tableau("PARTS — les entrees (DIAGNOSTIC, ne se somment PAS)", BANDE, clesParts, (t) => t.sc.boxes.exh.parts ?? {});

// ── ③ LE MEME DECOUPAGE PAR COTE ET PAR SORT — la bande a un SELL a 71 %. ─────────────────────
// ⭐⭐ « un chiffre agrege ne decrit pas une population qui a deux moities » : on regarde si la
//   composition du score DIFFERE entre gagnants et perdants, et entre BUY et SELL.
for (const [lbl, pop] of [["BUY", BANDE.filter((t) => t.side === "BUY")],
                          ["SELL", BANDE.filter((t) => t.side === "SELL")],
                          ["GAGNANTS", BANDE.filter((t) => (t.R ?? 0) > 0)],
                          ["PERDANTS", BANDE.filter((t) => (t.R ?? 0) <= 0)]]) {
  if (!pop.length) continue;
  const w = pop.filter((t) => (t.R ?? 0) > 0).length;
  const parts = clesFam.map((k) => {
    const s = stat(pop, (t) => { const v = t.sc.boxes.exh.familles[k]; return Number.isFinite(v) ? orient(v, t.side) : NaN; });
    return `${k} ${s ? s.moy.toFixed(2) : "—"}`;
  }).join(" · ");
  console.log(`   ${lbl.padEnd(9)} n=${String(pop.length).padStart(3)}  WR ${(100 * w / pop.length).toFixed(2).padStart(6)} %   ${parts}`);
}

// ── ④ LES MUETTES : une entree ABSENTE n'est pas une entree a 0 (elle sort du numerateur). ────
const muets = new Map();
for (const t of BANDE) for (const m of (t.sc.boxes.exh.muets ?? [])) muets.set(m, (muets.get(m) ?? 0) + 1);
const muetsRef = new Map();
for (const t of HAUTES) for (const m of (t.sc.boxes.exh.muets ?? [])) muetsRef.set(m, (muetsRef.get(m) ?? 0) + 1);
console.log(`\n   ── ENTREES MUETTES (sortent du total, ne valent PAS 0) ──`);
if (!muets.size) console.log("   (aucune)");
for (const [k, v] of [...muets.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`   ${k.padEnd(14)}${(100 * v / BANDE.length).toFixed(1).padStart(6)} % de la bande   |  ref ≥21 : ${(100 * (muetsRef.get(k) ?? 0) / HAUTES.length).toFixed(1)} %`);
console.log("");
