// _exh_rsi_h1_live_delta.mjs — LE Δ RSI H1 **LIVE** AU MOMENT DU FADE, quand le RSI H1 live est
//   au-dessus de 70 (et son MIROIR sous 30). Demande owner du 09/08.
//
// ⭐ LA QUESTION : le RSI H1 est déjà en surachat — le fade vendeur marche-t-il mieux quand le RSI
//   RALENTIT que quand il POUSSE ENCORE ? C'est la même phrase que `alimentation_de_l_extreme` et
//   que `di-domination-still-widening`, posée sur un troisième capteur. Si les trois disent la même
//   chose, ce n'est plus une case trouvée dans une grille, c'est un MÉCANISME.
//
// ⚠⚠ TROIS CONTRÔLES AVANT LE MOINDRE WR — l'owner cherche des règles COHÉRENTES et ROBUSTES :
//   ① `drsi_h1_s0` EST-IL BIEN `rsi_h1_s0 − rsi_h1` ? Vérifié pour le H4 en juillet, JAMAIS pour le
//      H1. Sans ça on bande un ALIAS (la faute `dslope_h1_s0`).
//   ② LE Δ LIVE EST-IL MÉCANIQUEMENT BIAISÉ ? Sur les DI, `s0 − c1` est négatif 71 % du temps par
//      pure décroissance d'EMA, sans marché — et tout résultat bâti dessus était à refaire. On
//      regarde donc la distribution du signe sur TOUTES les barres avant de lire une bande.
//   ③ COMBIEN DE GRAPPES actif×jour ? 20 000 tirs ne valent que 222 grappes ; le σ par tir est
//      gonflé ×9. Chaque ligne porte son compte de grappes et son WR PAR GRAPPE.
//
// 🔴🔥 ORIENTATION PAR LE CÔTÉ — `rsiDeltaCol` rend le sens BRUT (`_UP` = le RSI monte). Pour un fade
//   SELL, « ça pousse encore » = `_UP` ; pour un fade BUY, c'est `_DOWN`. Lire les colonnes brutes
//   mélangerait deux demi-échantillons opposés — la faute payée le 06/08 (`FAST_DOWN` à 100 % sur
//   21 épisodes, qui n'était qu'une moitié de population).
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
// ⚠ `NO_TRIO=1` = MOTEUR PUR (DealTrigger bypassé), comme `server.js` et les ~30 autres scripts.
//   Ce n'est PAS la prod ; c'est la référence à laquelle toutes nos mesures se comparent.
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
// ⭐ LES COUPES DU MOTEUR, PAS DES PERCENTILES REFAITS ICI : `RSI_DELTA_CUTS = [0,95 · 3,09 · 6,00]`,
//   « mesurées et symétrisées, mêmes valeurs pour h1 et h4 ». Recouper fabriquerait un second
//   vocabulaire pour la même grandeur.
const { rsiDeltaCol, RSI_DELTA_COLS } =
  await import("../../Matrix-Revolution/src/components/robot/engines/scoring/experts/rsiExpert.js");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const SEUIL = Number(process.env.RSI_SEUIL ?? 70);

// 🔴🔥⭐⭐⭐ `SOCLE=1` — LA POPULATION NON TRIÉE PAR LE BARÈME (`TOUT_ADMETTRE` + spacing off).
//   INDISPENSABLE ICI depuis le 09/08 : le Δ RSI H1 est devenu la 7ᵉ ENTRÉE du barème. Mesurer son
//   axe sur les tirs que ce même barème a sélectionnés, c'est un COLLIDER — les cases qu'il pénalise
//   (`SOFT_UP` +10 côté SELL) ont déjà été retirées, donc l'axe paraît plat par construction et on
//   conclurait qu'il ne trie pas. On ne teste JAMAIS un expert sur les tirs qu'il a produits.
//   ⇒ `SOCLE=1` rend la population d'AVANT toute décision : tout ce qui est orientable.
process.env.TOUT_ADMETTRE = String(process.env.SOCLE ?? "0") === "1" ? "1" : (process.env.TOUT_ADMETTRE ?? "0");
const SOCLE = process.env.TOUT_ADMETTRE === "1";

// ══ ⓪ + ① + ② LES CONTRÔLES SUR LE DATASET NU, HORS MOTEUR ════════════════════════════════════
// ⓪ 🔴🔥 `rsi_h1_s1` EST-IL UTILISABLE COMME SÉLECTEUR ? L'owner l'a demandé nommément (09/08).
//    `scoringInputs` porte l'avertissement inverse : « `rsi_{tf}_s1` EST INUTILISABLE : absent en
//    h4, rempli sur 21,4 % des lignes en h1, et là où il existe il diffère de la forme nue sur
//    13,6 % des cas ». ⚠ Cette note date de juillet — on la REVÉRIFIE au lieu de la croire, et on
//    mesure l'écart avec `rsi_h1` (forme NUE = la CLÔTURE, convention de nommage du dépôt).
//    ⇒ Si le remplissage est faible, sélectionner dessus AMPUTE la population en silence.
let nS1 = 0, nS1vsNu = 0, ecartS1 = 0;
let nA = 0, ecartMax = 0, nDiff = 0, nNeg = 0, nTot = 0, nHaut = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const L = fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/);
  const h = L[0].split(";");
  const iS0 = h.indexOf("rsi_h1_s0"), iCl = h.indexOf("rsi_h1"), iD = h.indexOf("drsi_h1_s0");
  const iS1 = h.indexOf("rsi_h1_s1");
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const s0 = Number(c[iS0]), cl = Number(c[iCl]), d = Number(c[iD]);
    if (!Number.isFinite(s0) || !Number.isFinite(cl)) continue;
    nTot++;
    if (s0 >= SEUIL) nHaut++;
    // 🔴🔥 `Number("") === 0`, ET C'EST FINI — piège `num_empty_string_zero_bug`, dans lequel je suis
    //   tombé en écrivant CE contrôle même (09/08) : une colonne VIDE comptait « remplie à 100 % »
    //   avec des valeurs 0, d'où un « écart max 85,85 » qui était en réalité `0 vs 85,85`.
    //   ⇒ Une chaîne vide est une ABSENCE, jamais un zéro.
    const bs1 = iS1 >= 0 ? String(c[iS1]).trim() : "";
    const s1 = bs1 === "" ? NaN : Number(bs1);
    if (Number.isFinite(s1)) {
      nS1++;
      const e = Math.abs(s1 - cl);
      if (e > ecartS1) ecartS1 = e;
      if (e > 0.011) nS1vsNu++;
    }
    if (Number.isFinite(d)) {
      nA++;
      const e = Math.abs(d - (s0 - cl));
      if (e > ecartMax) ecartMax = e;
      if (e > 0.011) nDiff++;
      if (d < 0) nNeg++;
    }
  }
}
console.log("══ ⓪ `rsi_h1_s1` EST-IL UTILISABLE COMME SÉLECTEUR ? ══");
console.log(`  rempli sur ${(100 * nS1 / nTot).toFixed(1)} % des ${nTot} barres` +
  (nS1 / nTot < 0.95 ? "   🔴 TROP PEU — sélectionner dessus AMPUTE la population EN SILENCE" : "   ✅"));
if (nS1) console.log(`  vs la forme nue \`rsi_h1\` : ${(100 * nS1vsNu / nS1).toFixed(1)} % de désaccord ` +
  `· écart max ${ecartS1.toFixed(3)}` +
  (nS1vsNu / nS1 > 0.02 ? "   🔴 DEUX SÉRIES, pas deux noms du même champ" : ""));
console.log(`  ⇒ sélecteur retenu : **\`rsi_h1\`** (forme NUE = la CLÔTURE), qui est le RSI clôturé\n` +
  "    utilisable sur 100 % des barres. C'est la même GRANDEUR que celle demandée.\n");
console.log("══ ① `drsi_h1_s0` EST-IL `rsi_h1_s0 − rsi_h1` ? ══");
console.log(`  n=${nA}  ·  écart max ${ecartMax.toFixed(4)}  ·  lignes au-delà de l'arrondi (0,011) : ${nDiff}`);
console.log(nDiff === 0 ? "  ✅ MÊME SÉRIE — le Δ live est utilisable tel quel."
                        : "  🔴 DEUX SÉRIES DIFFÉRENTES — ne rien bander dessus avant d'avoir tranché laquelle.");
console.log("\n══ ② LE Δ LIVE EST-IL MÉCANIQUEMENT BIAISÉ (leçon des DI) ? ══");
console.log(`  ${(100 * nNeg / nA).toFixed(1)} % de Δ négatifs sur ${nA} barres` +
  (Math.abs(100 * nNeg / nA - 50) < 5 ? "   ✅ centré — pas de décroissance mécanique comme sur les DI"
                                      : "   🔴 DÉSÉQUILIBRÉ — vérifier la cause avant de lire une bande"));
console.log(`  barres à rsi_h1_s0 ≥ ${SEUIL} : ${nHaut} (${(100 * nHaut / nTot).toFixed(1)} % de ${nTot})`);

// ══ LE CARNET ═════════════════════════════════════════════════════════════════════════════════
let all = [];
const OPTS = SOCLE ? { spacing: false, maxOpen: 100000, cadenceMin: 2, chargeSpread: true }
                   : { maxOpen: 30, cadenceMin: 2, chargeSpread: true };
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), OPTS);
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const EXH = all.filter((s) => s.strategy === "EXH");
const ep = dedupeEpisodes(EXH).filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function grappes(t) {
  const g = new Map();
  for (const s of t) {
    const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++;
  }
  const v = [...g.values()];
  return { g: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN };
}
const BE = 75;
function line(lbl, t) {
  if (!t.length) { console.log("  " + lbl.padEnd(32) + "—"); return; }
  const w = t.filter((x) => x.outcome === "WIN").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const wr = 100 * w / t.length, sig = (wr - BE) / (Math.sqrt(0.75 * 0.25 / t.length) * 100);
  const gr = grappes(t);
  console.log("  " + lbl.padEnd(32) +
    `ép=${String(t.length).padStart(3)}  WR ${wr.toFixed(1).padStart(5)} %  ` +
    `${(sig >= 0 ? "+" : "") + sig.toFixed(2)} σ${Math.abs(sig) >= 2 ? " ⭐" : "  "} ` +
    `R ${(R >= 0 ? "+" : "") + R.toFixed(1).padStart(6)}  ` +
    `| ${String(gr.g).padStart(3)} gr. ${gr.wr.toFixed(1)} %`);
}

// ⭐ ORIENTÉ : `_UP` = le RSI va DANS LE SENS DU MOUVEMENT QU'ON FADE (il monte pour un SELL, il
//   descend pour un BUY). `FLAT` est son propre reflet.
const MIROIR = { EXPLOSIVE_DOWN: "EXPLOSIVE_UP", FAST_DOWN: "FAST_UP", SOFT_DOWN: "SOFT_UP", FLAT: "FLAT",
                 SOFT_UP: "SOFT_DOWN", FAST_UP: "FAST_DOWN", EXPLOSIVE_UP: "EXPLOSIVE_DOWN" };
const colBrute  = (s) => rsiDeltaCol(s.dRsiH1Live);
const colOrient = (s) => { const c = colBrute(s); return (s.side === "BUY" && c) ? MIROIR[c] : c; };

console.log(`\n══ ③ EXH — RÉFÉRENCE ══`);
line("TOUS", ep);
line("  BUY", ep.filter((s) => s.side === "BUY"));
line("  SELL", ep.filter((s) => s.side === "SELL"));

const muet = ep.filter((s) => !Number.isFinite(s.rsiH1Live)).length;
if (muet) console.log(`\n⚠ ${muet} épisode(s) sans \`rsi_h1_s0\` — EXCLUS, jamais comptés 0`);

// 🔴🔥⭐⭐⭐ LE SÉLECTEUR EST LE RSI **CLÔTURÉ** (`rsi_h1`), LE Δ RESTE LIVE — owner 09/08.
//   `rsi_s0 = rsi_h1 + Δ` : sélectionner sur le LIVE et ventiler par le Δ, c'est croiser une
//   grandeur avec une de ses PROPRES COMPOSANTES. Sur le %K, la même faute FABRIQUAIT deux classes
//   entières (`FAST_UP` 32 ép à 93,8 % → 0 épisode avec le sélecteur clôturé) et INVERSAIT l'ordre.
//   ⇒ `rsi_h1` = ce qui est ÉTABLI · `Δ live` = ce qui se passe MAINTENANT. Aucun terme commun.
// ⚠ LES DEUX LECTURES SONT IMPRIMÉES : l'écart entre elles EST la taille de l'artefact.
for (const [titre, pop] of [
  [`⭐ RSI H1 CLÔTURÉ > ${SEUIL}  (surachat établi — le fade y est VENDEUR)`,
    ep.filter((s) => Number.isFinite(s.rsiH1) && s.rsiH1 > SEUIL)],
  [`⭐ MIROIR : RSI H1 CLÔTURÉ < ${100 - SEUIL}  (survente établie — fade ACHETEUR)`,
    ep.filter((s) => Number.isFinite(s.rsiH1) && s.rsiH1 < 100 - SEUIL)],
  [`RSI H1 LIVE > ${SEUIL}  — lecture CONTAMINÉE, gardée pour MESURER l'artefact`,
    ep.filter((s) => Number.isFinite(s.rsiH1Live) && s.rsiH1Live > SEUIL)],
  [`RSI H1 LIVE < ${100 - SEUIL}  — lecture CONTAMINÉE`,
    ep.filter((s) => Number.isFinite(s.rsiH1Live) && s.rsiH1Live < 100 - SEUIL)],
]) {
  console.log(`\n══ ${titre} ══`);
  line("population", pop);
  line("  dont BUY", pop.filter((s) => s.side === "BUY"));
  line("  dont SELL", pop.filter((s) => s.side === "SELL"));
  console.log("  ── par niveau de Δ RSI H1 live, ORIENTÉ (`_UP` = ça pousse ENCORE dans le sens fadé) ──");
  let vus = 0;
  for (const c of RSI_DELTA_COLS) {
    const t = pop.filter((s) => colOrient(s) === c);
    vus += t.length;
    line(`  ${c}`, t);
  }
  const orph = pop.length - vus;
  if (orph) console.log(`    ⚠ ${orph} épisode(s) sans Δ — exclus`);
  console.log("  ── regroupé : POUSSE ENCORE / PLAT / RALENTIT ──");
  line("  pousse (_UP ×3)",  pop.filter((s) => String(colOrient(s)).endsWith("_UP")));
  line("  FLAT",             pop.filter((s) => colOrient(s) === "FLAT"));
  line("  ralentit (_DOWN ×3)", pop.filter((s) => String(colOrient(s)).endsWith("_DOWN")));
}

// ⭐ LES DEUX MOITIÉS RÉUNIES — c'est la RÈGLE candidate, si règle il y a : « le RSI H1 est à
//   l'extrême visé ET il y pousse encore », lue d'un seul côté puis de l'autre.
console.log(`\n══ LES DEUX CÔTÉS RÉUNIS — la figure MIROIR complète ══`);
const extreme = (s) => Number.isFinite(s.rsiH1) &&
  (s.side === "SELL" ? s.rsiH1 > SEUIL : s.rsiH1 < 100 - SEUIL);
const pousse = (s) => String(colOrient(s)).endsWith("_UP");
line("extrême visé + POUSSE encore", ep.filter((s) => extreme(s) && pousse(s)));
line("extrême visé + ne pousse pas", ep.filter((s) => extreme(s) && !pousse(s)));
line("hors extrême visé",            ep.filter((s) => !extreme(s)));
