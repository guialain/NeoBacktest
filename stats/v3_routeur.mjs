// v3_routeur.mjs — LA TABLE DU ROUTEUR : LES DEUX BRANCHES, CELLULE PAR CELLULE.
// ============================================================================================
//   usage : node stats/v3_routeur.mjs        (SPREAD=hors pour l'autre mode)
//   lit `analyse_out/v3` (EXH, côté −regDir) et `analyse_out/v3c` (CONT, côté +regDir).
//
// ⭐⭐⭐ TOUT EST ORIENTÉ PAR LE CÔTÉ DU **TRADE**, ET C'EST CE QUI REND LES DEUX TABLES LISIBLES
//   ENSEMBLE. La V3 EXH orientait par le côté du FADE — utile tant qu'on ne regardait qu'une
//   branche, ingérable dès qu'il y en a deux : le fade et la continuation prennent des côtés
//   OPPOSÉS sur le même régime, donc deux conventions opposées se croiseraient à chaque ligne.
//   Une seule échelle, ancrée sur la direction du trade qu'on prend :
//       XAR   extrême DERRIÈRE   %K à l'opposé du trade, à fond      (BUY : %K ≤ 12)
//       AR    derrière
//       MID   milieu
//       AV    devant
//       XAV   extrême DEVANT     %K dans le sens du trade, à fond    (BUY : %K ≥ 88)
//   ⇒ Le fade vit DERRIÈRE (on achète un plancher), la continuation vit DEVANT (on achète une
//   hausse installée). Dit comme ça, la règle ① du routeur devient une phrase : **EXH derrière,
//   CONT devant**, et la question ouverte est de savoir si le « devant » du CONT vaut quelque chose.
// ⚠ CONSÉQUENCE À NE PAS RATER EN RELISANT LES ANCIENS CHIFFRES : le `XF` de la table EXH (extrême
//   du côté fadé) EST `XAR` ici. Même population, autre nom, parce que l'ancre a changé.
//
// ⚠ σ ET EFFECTIF : une voix par grappe ACTIF × JOUR. `spacing=false` fabrique des dizaines de tirs
//   quasi identiques sur le même mouvement — un σ calculé sur les tirs est gonflé d'un facteur ~9.
// ⚠ TP/SL : `getTpSl(asset)` est PAR ACTIF, pas par stratégie. Les deux branches partagent donc le
//   MÊME couple. Ce n'est pas un choix de ce script, c'est l'état du moteur — et ça rend au moins
//   la comparaison cellule à cellule honnête, les deux colonnes subissant la même sortie.
import fs from "fs";

const SPREAD = process.env.SPREAD ?? "facture";
const NMIN   = Number(process.env.NMIN ?? 30);
const lire = (d) => fs.readFileSync(`${d}/tirs.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const RVAL = (r) => SPREAD === "hors" ? r.Rns : r.R;
// 🔴🔥 LE MODE DE SPREAD CHANGE L'ISSUE, PAS SEULEMENT LE R — et c'est le sens même du péage : il
//   pousse des gagnants de justesse en perdants. La 1ᵉʳ version de ce script lisait `r.win` dans les
//   DEUX modes ; « hors spread » y affichait donc un WR FACTURÉ à côté d'un R nominal, c'est-à-dire
//   un tableau qui ne décrivait aucun des deux mondes. Écart réel mesuré : **+2,7 pts (EXH) et
//   +2,4 pts (CONT)** — exactement l'ordre de grandeur que le dépôt attribue au spread.
const WVAL = (r) => SPREAD === "hors" ? r.winNs : r.win;

// ── ORIENTATION UNIQUE, PAR LE CÔTÉ DU TRADE ────────────────────────────────────────────────
const ZONE_TS = {
  BUY:  { EXTREME_BASSE: "XAR", BASSE: "AR", MID: "MID", HAUTE: "AV", EXTREME_HAUTE: "XAV" },
  SELL: { EXTREME_HAUTE: "XAR", HAUTE: "AR", MID: "MID", BASSE: "AV", EXTREME_BASSE: "XAV" },
};
const ORDRE_Z = ["XAR", "AR", "MID", "AV", "XAV"];
const MIR_DK = { EXPLOSIVE_DOWN: "EXPLOSIVE_UP", FAST_DOWN: "FAST_UP", SOFT_DOWN: "SOFT_UP", FLAT: "FLAT",
                 SOFT_UP: "SOFT_DOWN", FAST_UP: "FAST_DOWN", EXPLOSIVE_UP: "EXPLOSIVE_DOWN" };
const prep = (rows, br) => rows.map((r) => ({
  ...r, branche: br,
  z: r.zone == null ? null : (ZONE_TS[r.side]?.[r.zone] ?? null),
  // `kdPour` : %K domine %D DANS LE SENS DU TRADE (BUY : K>D · SELL : K<D). Une seule convention.
  kdPour: r.kdGap == null ? null : ((r.side === "BUY" ? r.kdGap : -r.kdGap) > 0 ? "POUR" : "CONTRE"),
  // `dk` : `_UP` = %K accélère DANS LE SENS DU TRADE.
  dk: r.dkBand == null ? null : (r.side === "BUY" ? r.dkBand : (MIR_DK[r.dkBand] ?? r.dkBand)),
})).filter((r) => Number.isFinite(RVAL(r)));

const EXH  = prep(lire("analyse_out/v3"),  "EXH");
const CONT = prep(lire("analyse_out/v3c"), "CONT");
const jour = (r) => new Date(r.ep * 60000).toISOString().slice(0, 10);
const grap = (t) => {
  const g = {};
  for (const r of t) { const k = r.asset + "|" + jour(r); (g[k] ??= []).push(WVAL(r)); }
  const v = Object.values(g).map((a) => a.reduce((x, y) => x + y, 0) / a.length), n = v.length;
  if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1));
  return { n, tirs: t.length, wr: 100 * m, se: 100 * sd / Math.sqrt(n) };
};
// baseline par BRANCHE × CÔTÉ — la seule référence honnête : on ne compare jamais un CONT BUY à un
//   agrégat qui contient de l'EXH SELL. C'est la doctrine des quatre cellules appliquée au calcul.
const B = {};
for (const [br, pop] of [["EXH", EXH], ["CONT", CONT]])
  for (const s of ["BUY", "SELL"]) B[`${br}|${s}`] = grap(pop.filter((r) => r.side === s));

const cell = (pop, br, side, f) => {
  const g = grap(pop.filter((r) => r.side === side && f(r)));
  if (!g) return "        —         ";
  const b = B[`${br}|${side}`], d = g.wr - b.wr;
  const marque = g.n < NMIN ? "⚠" : (Math.abs(d) / g.se >= 2 ? "⭐" : " ");
  return `${String(g.n).padStart(4)} ${g.wr.toFixed(1).padStart(5)}% ${((d >= 0 ? "+" : "") + d.toFixed(1)).padStart(5)}±${g.se.toFixed(1).padStart(4)}${marque}`;
};

console.log("═".repeat(112));
console.log(`  TABLE DU ROUTEUR — EXH (côté −regDir) contre CONT (côté +regDir)   ·   ${SPREAD === "hors" ? "HORS SPREAD" : "spread FACTURÉ"}`);
console.log("═".repeat(112));
console.log(`  EXH  ${EXH.length} tirs   ·   CONT ${CONT.length} tirs   ·   une voix par grappe ACTIF × JOUR`);
console.log("  cellule = grappes · WR · Δ contre la baseline de SA cellule (branche × côté) ± err.type");
console.log(`  ⭐ = |Δ| ≥ 2 σ   ·   ⚠ = moins de ${NMIN} grappes, aucune conclusion`);
console.log("\n  baselines par cellule :");
for (const k of Object.keys(B)) if (B[k]) console.log(`     ${k.padEnd(10)} ${String(B[k].n).padStart(4)} grappes · ${B[k].tirs} tirs · ${B[k].wr.toFixed(1)}% ±${B[k].se.toFixed(1)}`);

console.log(`\n${"═".repeat(112)}\n  LA TABLE — zone %K orientée par le côté du TRADE\n${"═".repeat(112)}`);
console.log("  zone      " + ["EXH BUY", "EXH SELL", "CONT BUY", "CONT SELL"].map((x) => x.padStart(19)).join(""));
for (const z of ORDRE_Z) {
  const f = (r) => r.z === z;
  console.log("  " + z.padEnd(10)
    + cell(EXH, "EXH", "BUY", f) + cell(EXH, "EXH", "SELL", f)
    + cell(CONT, "CONT", "BUY", f) + cell(CONT, "CONT", "SELL", f));
}

// ── LES 4 QUESTIONS DU ROUTEUR ──────────────────────────────────────────────────────────────
const abs = (pop, side, f) => { const g = grap(pop.filter((r) => r.side === side && f(r))); return g ? `${String(g.n).padStart(4)} grap · ${g.wr.toFixed(1)}% ±${g.se.toFixed(1)}` : "—"; };
const Q = (titre, question, f) => {
  console.log(`\n── ${titre} ──\n   ${question}`);
  for (const side of ["BUY", "SELL"])
    console.log(`     ${side.padEnd(5)}  EXH ${abs(EXH, side, f).padEnd(26)}  CONT ${abs(CONT, side, f)}`);
};
console.log(`\n${"═".repeat(112)}\n  LES 4 QUESTIONS DU ROUTEUR\n${"═".repeat(112)}`);
Q("Q1 · LA CASE DU ROUTEUR — zone DEVANT (AV + XAV)",
  "la règle ① y ferme l'EXH et route vers CONT. Le CONT y est-il bon ? C'est LA case à valider.",
  (r) => r.z === "AV" || r.z === "XAV");
Q("Q2 · EXTRÊME PRO-RÉGIME (XAV)",
  "le prix est à fond dans le sens du trade — le CONT tient-il si tard, ou est-ce la zone de l'épuisement ?",
  (r) => r.z === "XAV");
Q("Q3 · MID", "la règle ② dit « ne tire pas ». Vérifié sur les deux branches ?", (r) => r.z === "MID");
Q("Q4a · morphologie CONTACT/CONVERGING", "muettes à l'extrême EXH, utiles au MID — et dans CONT ?",
  (r) => ["CONTACT", "CONVERGING"].includes(r.kdCur));
Q("Q4b · %K domine %D DANS LE SENS DU TRADE", "le critère K/D a-t-il un rôle dans la branche CONT ?",
  (r) => r.kdPour === "POUR");

// ── VERDICT : où les DEUX branches sont mauvaises ⇒ WAIT structurel ──────────────────────────
console.log(`\n${"═".repeat(112)}\n  VERDICT — cellules où AUCUNE des deux branches ne bat sa baseline (⇒ WAIT structurel)\n${"═".repeat(112)}`);
// 🔴🔥 DEUX LECTURES, ET ELLES NE RÉPONDENT PAS À LA MÊME QUESTION — les confondre est l'erreur
//   naturelle de ce tableau :
//     Δ CONTRE SA PROPRE BASELINE  → « cette zone est-elle bonne DANS sa branche ? » PROPRE :
//        même stratégie, mêmes sorties, tout le reste égal.
//     WR ABSOLU ENTRE BRANCHES     → « où faut-il ENVOYER la barre ? » C'est ce que le routeur
//        demande, et c'est CONFONDU : `getTpSl` est PAR ACTIF, donc les deux branches partagent un
//        couple TP/SL qui n'a pas été calibré pour la continuation. Un WR se déplace mécaniquement
//        avec le TP — comparer deux stratégies à TP imposé ne les départage pas.
//   ⇒ On publie les deux, étiquetées. Le verdict d'aiguillage reste SUSPENDU tant que la branche
//   CONT n'a pas ses propres sorties.
console.log("  zone × côté          Δ/baseline EXH   Δ/baseline CONT  │  WR ABSOLU EXH   CONT   (⚠ TP/SL partagé)");
for (const z of ORDRE_Z) for (const side of ["BUY", "SELL"]) {
  const e = grap(EXH.filter((r) => r.side === side && r.z === z));
  const c = grap(CONT.filter((r) => r.side === side && r.z === z));
  if (!e || !c) continue;
  const de = e.wr - B[`EXH|${side}`].wr, dc = c.wr - B[`CONT|${side}`].wr;
  const insuf = e.n < NMIN || c.n < NMIN;
  const v = insuf ? "⚠ effectif insuffisant"
    : (de <= 0 && dc <= 0) ? "🔴 les DEUX sous leur baseline ⇒ WAIT"
    : "";
  console.log(`  ${(z + " · " + side).padEnd(20)} ${((de >= 0 ? "+" : "") + de.toFixed(1)).padStart(7)}±${e.se.toFixed(1).padEnd(5)} ` +
              `${((dc >= 0 ? "+" : "") + dc.toFixed(1)).padStart(8)}±${c.se.toFixed(1).padEnd(6)} │ ` +
              `${(e.wr.toFixed(1) + "%").padStart(8)} ${(c.wr.toFixed(1) + "%").padStart(7)}  ${v}`);
}
console.log("");
