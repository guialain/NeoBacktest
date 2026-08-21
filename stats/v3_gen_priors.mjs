// v3_gen_priors.mjs — GÉNÈRE `routeurPriors.js` DEPUIS LES TABLES FIGÉES.
// ============================================================================================
// ⭐⭐ POURQUOI GÉNÉRÉ ET NON RECOPIÉ. Vingt cases × quatre nombres recopiées à la main, c'est
//   quatre-vingts occasions de se tromper d'un chiffre, et rien dans le fichier d'arrivée ne le
//   signalerait — un prior faux ne lève aucune erreur, il rend juste une éval trop douce ou trop
//   sévère. La table figée est la source ; ce script est le seul chemin entre elle et le moteur.
// ⚠ RELANCER À CHAQUE NOUVELLE EXTRACTION, sinon le moteur porte les priors d'un dataset qui n'est
//   plus le sien. La `meta` écrite dans le fichier de sortie est là pour que ça se voie.
import fs from "fs";

const OUT = process.argv[2] ?? "C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/routeurPriors.js";
const NMIN = 30;
const lire = (d) => fs.readFileSync(`${d}/tirs.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const meta = (d) => JSON.parse(fs.readFileSync(`${d}/meta.json`, "utf8"));

const ZONE_TS = {
  BUY:  { EXTREME_BASSE: "XAR", BASSE: "AR", MID: "MID", HAUTE: "AV", EXTREME_HAUTE: "XAV" },
  SELL: { EXTREME_HAUTE: "XAR", HAUTE: "AR", MID: "MID", BASSE: "AV", EXTREME_BASSE: "XAV" },
};
const ZONES_TS = ["XAR", "AR", "MID", "AV", "XAV"];
const jour = (r) => new Date(r.ep * 60000).toISOString().slice(0, 10);

// ⚠ UNE VOIX PAR GRAPPE ACTIF × JOUR. `spacing=false` fabrique des dizaines de tirs quasi
//   identiques sur le même mouvement : un σ calculé sur les tirs est gonflé d'un facteur ~9. Le
//   prior DOIT porter l'incertitude réelle, sinon il calibrerait la sévérité sur du vent.
const grap = (t) => {
  const g = {};
  for (const r of t) { const k = r.asset + "|" + jour(r); (g[k] ??= []).push(r.win); }
  const v = Object.values(g).map((a) => a.reduce((x, y) => x + y, 0) / a.length), n = v.length;
  if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1));
  return { n, wr: 100 * m, se: 100 * sd / Math.sqrt(n) };
};

const src = { EXH: "analyse_out/v3", CONT: "analyse_out/v3c" };
const rows = { EXH: lire(src.EXH), CONT: lire(src.CONT) };
const PRIORS = {};
for (const strategy of ["EXH", "CONT"]) for (const side of ["BUY", "SELL"]) {
  const pop = rows[strategy].filter((r) => r.side === side && Number.isFinite(r.R));
  const base = grap(pop);                       // ⭐ baseline DE SA cellule — jamais un agrégat
  const cel = {};
  for (const z of ZONES_TS) {
    const g = grap(pop.filter((r) => ZONE_TS[side][r.zone] === z));
    cel[z] = g ? { n: g.n, wr: +g.wr.toFixed(1), delta: +(g.wr - base.wr).toFixed(1), se: +g.se.toFixed(1) }
                : { n: 0, wr: null, delta: null, se: null };
  }
  PRIORS[`${strategy}_${side}`] = { base: +base.wr.toFixed(1), baseN: base.n, cel };
}

// ── LE TÊTE-À-TÊTE APPARIÉ — la SEULE comparaison légitime entre deux branches ───────────────
// 🔴🔥 POURQUOI IL EXISTE, ET CE QU'IL CORRIGE. Classer deux cellules par leur σ contre LEUR PROPRE
//   baseline ne répond pas à « laquelle prendre ici » : les baselines diffèrent de 15 points
//   (EXH ≈ 78 %, CONT ≈ 61 %), donc une cellule peut battre franchement une baseline basse tout en
//   étant moins bonne dans l'absolu. C'est le mirage d'agrégat déplacé dans l'arbitrage.
// ⭐⭐ Ici on compare les DEUX branches SUR LA MÊME BARRE (appariement `asset|ep`) : même instant,
//   même actif, mêmes sorties. Le biais de sélection disparaît.
// ⚠ CE QUI SUBSISTE : `getTpSl` est PAR ACTIF, donc la jambe CONT tourne avec un couple TP/SL qui
//   n'a pas été calibré pour elle. Le SENS de chaque case est solide ; le point exact de bascule
//   dépend des sorties.
const kx = (r) => r.asset + "|" + r.ep;
const mc = new Map(rows.CONT.map((r) => [kx(r), r]));
const H2H = {};
for (const z of ZONES_TS) {
  const paires = [];
  for (const e of rows.EXH) {
    if (ZONE_TS[e.side]?.[e.zone] !== z) continue;
    const c = mc.get(kx(e));
    if (c) paires.push([e, c]);
  }
  if (paires.length < 200) { H2H[z] = { n: paires.length, verdict: "INSUFFISANT", rExh: null, rCont: null }; continue; }
  const rE = paires.reduce((a, [e]) => a + e.R, 0) / paires.length;
  const rC = paires.reduce((a, [, c]) => a + c.R, 0) / paires.length;
  H2H[z] = { n: paires.length, rExh: +rE.toFixed(4), rCont: +rC.toFixed(4),
             rLesDeux: +((rE + rC)).toFixed(4),
             verdict: (rE <= 0 && rC <= 0) ? "AUCUNE" : (rE > rC ? "EXH" : "CONT") };
}

const j = (o) => JSON.stringify(o);
const bloc = Object.entries(PRIORS).map(([k, v]) =>
  `  // ${k.padEnd(9)} baseline ${String(v.base).padStart(5)} % sur ${v.baseN} grappes\n` +
  `  ${k}: {\n` +
  ZONES_TS.map((z) => `    ${(z + ":").padEnd(6)} ${j(v.cel[z])},`).join("\n") +
  `\n  },`).join("\n");

const txt = `// routeurPriors.js — LES PRIORS DE CELLULE. ⚠️ FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN.
// ============================================================================================
//   Source : \`Neo-Backtest/stats/v3_gen_priors.mjs\` depuis les tables figées V3.
//   Régénérer après CHAQUE nouvelle extraction, sinon le moteur porte les priors d'un dataset qui
//   n'est plus le sien — et rien ne le signalerait.
//
// ⭐⭐⭐ CE QUE CES NOMBRES SONT, ET CE QU'ILS NE SONT PAS. Ce sont des PRIORS DE POPULATION : « ce
//   que vaut, en moyenne, la population de cette cellule à cette zone ». Ils calibrent la SÉVÉRITÉ
//   de l'éval qui vit dans la cellule. **Ils ne disent rien d'un deal particulier** — confondre les
//   deux, c'est refuser un bon deal parce que ses voisins sont mauvais.
//
// ⚠⚠ PROVENANCE, ET ELLE LIMITE LA PORTÉE — à lire avant de s'appuyer sur un chiffre :
//   · moteur TOUT ADMIS (\`TOUT_ADMETTRE=1\`) : ni veto, ni admission. Ces priors décrivent la
//     population BRUTE d'une cellule, pas ce que le moteur en ferait aujourd'hui.
//   · \`spacing=false&maxOpen=100000\` : tous les tirs entrent. La capacité de prod en supprime 82 %
//     et le fait par ORDRE D'ARRIVÉE — mesurer avec elle aurait biaisé chaque zone à la fois.
//   · WR et σ par GRAPPE ACTIF × JOUR, jamais par tir (les tirs ne sont pas indépendants).
//   · spread FACTURÉ. Vérifié hors spread : structure identique, tout monte d'environ 2,5 points.
//   · UNE fenêtre de 28 jours, 15 à 19 actifs, un seul régime de marché. **Aucun hors-échantillon.**
//   · TP/SL partagés par les deux branches (\`getTpSl\` est PAR ACTIF) : les Δ INTRA-cellule sont
//     propres, une comparaison INTER-branches sur les valeurs absolues ne le serait pas.
//
// \`delta\` = écart de WR contre la baseline DE SA PROPRE CELLULE (branche × côté), en points.
// \`se\`    = erreur-type de ce WR, en points.   \`n\` = nombre de grappes.   \`wr\` = WR absolu.
// ⚠ \`n < ${NMIN}\` ⇒ traité \`NON_MESURE\` par \`priorDe()\` : refus par défaut AVEC logging.
export const PRIORS_META = ${j({
    genere_le: meta(src.EXH).fige_le,
    nMin: NMIN,
    dataset: meta(src.EXH).dataset,
    moteur: meta(src.EXH).moteur,
    tirs: { EXH: meta(src.EXH).comptages.tirs, CONT: meta(src.CONT).comptages.tirs },
    run: meta(src.EXH).run,
    unite: "grappe actif x jour",
    spread: "facture",
  })};

export const PRIORS = {
${bloc}
};

// ── CALIBRAGE DE LA SÉVÉRITÉ — du CONTENU, pas du cadre ──────────────────────────────────────
// ⭐⭐ POURQUOI ICI ET PAS DANS \`routeur.js\`. Le CADRE dit « il existe trois régimes de sévérité et
//   ils se déduisent du prior ». OÙ SONT LES FRONTIÈRES est une décision de calibrage, donc du
//   contenu : la changer ne doit pas rouvrir le module de routage.
// ⚠ \`2\` n'est pas une vérité, c'est une convention de ce dépôt (et elle est GÉNÉREUSE ici : le σ
//   est déjà calculé par grappe, mais une case reste une case parmi vingt).
export const SEVERITE_CUTS = { fort: 2, faible: -2 };

// ── ARBITRAGE : LE TÊTE-À-TÊTE APPARIÉ, INDEXÉ PAR LA ZONE VUE PAR L'EXH ─────────────────────
// ⭐⭐⭐ LA SEULE COMPARAISON LÉGITIME ENTRE DEUX BRANCHES. On ne classe PAS deux cellules par leur
//   σ contre leur propre baseline : celles-ci diffèrent de ~15 points, donc une cellule peut battre
//   franchement une baseline basse tout en étant moins bonne dans l'absolu. Ici les deux branches
//   sont comparées SUR LA MÊME BARRE — même instant, même actif, mêmes sorties.
// ⚠ Clé = la zone vue par la jambe EXH. La jambe CONT y voit la zone MIROIR (\`XAR\`↔\`XAV\`,
//   \`AR\`↔\`AV\`, \`MID\` est son propre reflet) — c'est mécanique, les côtés sont toujours opposés.
// ⚠ \`rLesDeux\` est la somme des deux jambes : il est DOMINÉ dans les cinq zones. « Prendre les
//   deux » est un straddle à TP/SL symétriques — la perte d'une jambe annule le gain de l'autre et
//   on paie DEUX péages. Éliminé par l'arithmétique, pas par préférence.
// ⚠ La jambe CONT tourne avec un TP/SL qui n'a pas été calibré pour elle (\`getTpSl\` est PAR ACTIF).
//   Le SENS de chaque case est solide ; le point exact de bascule dépend des sorties.
export const HEAD_TO_HEAD = ${JSON.stringify(H2H, null, 2).replace(/\n/g, "\n")};

export default PRIORS;
`;
fs.writeFileSync(OUT, txt);
console.log("écrit :", OUT);
for (const [k, v] of Object.entries(PRIORS))
  console.log(" ", k.padEnd(10), "base", String(v.base).padStart(5),
    ZONES_TS.map((z) => `${z}:${v.cel[z].n}/${v.cel[z].delta}`).join("  "));
