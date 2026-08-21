// v3_analyse.mjs — PROTOCOLE V3, ÉTAPE B : LES REQUÊTES SUR LA TABLE FIGÉE.
// ============================================================================================
//   usage : node stats/v3_analyse.mjs            (par TIR, spread FACTURÉ)
//           BASE=episodes  node stats/v3_analyse.mjs
//           SPREAD=hors    node stats/v3_analyse.mjs
// ⚠ NE RELIT JAMAIS LE MOTEUR. Toute l'analyse tourne sur `analyse_out/v3/*.jsonl`, figé par
//   `v3_extract.mjs`. C'est ce qui rend deux lectures comparables.
//
// ⭐⭐⭐ LE σ EST CALCULÉ CONTRE LA BASELINE « TOUT ADMIS », PAS CONTRE LE POINT MORT 75 %.
//   La question de ce protocole n'est pas « cette case est-elle rentable ? » mais « cette case
//   DIFFÈRE-T-ELLE de la population dont elle est extraite ? » — c'est la seconde qui dit si un
//   critère d'admission APPORTE quelque chose. Le point mort reste affiché en tête comme repère.
//   ⚠ Et par TIR le WR est de toute façon BIAISÉ (le nombre de clones dépend de l'issue) : le
//   comparer au point mort en absolu ne voudrait rien dire, alors que l'écart ENTRE cases, si.
import fs from "fs";

const DIR    = process.env.DIR ?? "analyse_out/v3";
const BASE   = process.env.BASE ?? "tirs";              // `tirs` | `episodes`
const SPREAD = process.env.SPREAD ?? "facture";          // `facture` | `hors`
const NMIN   = Number(process.env.NMIN ?? 30);           // seuil d'effectif par cellule

const meta = JSON.parse(fs.readFileSync(`${DIR}/meta.json`, "utf8"));
const rows = fs.readFileSync(`${DIR}/${BASE}.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const RVAL = (r) => SPREAD === "hors" ? r.Rns : r.R;
const pop  = rows.filter((r) => Number.isFinite(RVAL(r)));

// ── ORIENTATION DE LA ZONE PAR LE CÔTÉ ──────────────────────────────────────────────────────
// 🔴🔥 INDISPENSABLE, ET C'EST LA FAUTE DÉJÀ PAYÉE LE 06/08. Un fade BUY et un fade SELL lisent le
//   même niveau de %K en sens OPPOSÉS : `EXTREME_HAUTE` côté SELL et `EXTREME_BASSE` côté BUY sont
//   LA MÊME FIGURE (l'extrême d'où l'on revient). Les afficher séparément couperait chaque classe
//   en deux demi-échantillons et comparerait des choses qui ne se comparent pas.
//   `XF` = extrême du côté FADÉ · `HF` = haute du côté fadé · `MID` · `HO`/`XO` = côté OPPOSÉ.
// ⚠⚠ LES DEUX ZONES DU CÔTÉ OPPOSÉ SONT FUSIONNÉES EN `OPPOSE`, ET LE MOTIF EST SÉMANTIQUE, PAS
//   NUMÉRIQUE. Pour un fade, « le prix est du MAUVAIS côté » est UNE situation, pas deux : un SELL
//   d'épuisement avec %K au plancher n'est pas « un peu moins extrême » qu'avec %K très au plancher,
//   il est hors sujet dans les deux cas. ⭐ Et c'est ce qui rend l'axe lisible : à 5 niveaux il est
//   NON MONOTONE du seul fait de `XO` (435 tirs, 0,5 % — n < NMIN sur la moitié de ses croisements),
//   à 4 il l'est. 🔴 LE PIÈGE À NE PAS TOMBER : fusionner PARCE QUE ça rend monotone serait choisir
//   un découpage sur son résultat. On fusionne parce que les deux niveaux décrivent la même chose,
//   et le gain de monotonie est une CONSÉQUENCE — le détail des 5 niveaux reste affiché en §2.
const ZONE_OR5 = {
  SELL: { EXTREME_HAUTE: "XF", HAUTE: "HF", MID: "MID", BASSE: "HO", EXTREME_BASSE: "XO" },
  BUY:  { EXTREME_BASSE: "XF", BASSE: "HF", MID: "MID", HAUTE: "HO", EXTREME_HAUTE: "XO" },
};
const ZONE_OR = { SELL: {}, BUY: {} };
for (const s of ["SELL", "BUY"]) for (const [z, v] of Object.entries(ZONE_OR5[s]))
  ZONE_OR[s][z] = (v === "XO" || v === "HO") ? "OPPOSE" : v;
for (const r of pop) {
  r.zoneOr  = r.zone == null ? null : (ZONE_OR[r.side]?.[r.zone] ?? null);
  r.zoneOr5 = r.zone == null ? null : (ZONE_OR5[r.side]?.[r.zone] ?? null);   // détail, §2 seulement
}

// ── LES AXES, avec leur ORDRE quand ils en ont un ───────────────────────────────────────────
// ⚠ `ordonne: false` ⇒ aucune COUPE monotone n'est proposée sur cet axe (voir étape C) : une règle
//   qui choisit un SOUS-ENSEMBLE de classes sans ordre est une collection de cases gagnantes, pas
//   une coupe. On la mesure, on ne la propose pas comme règle.
const AXES = {
  zoneOr:   { titre: "zone %K H1 (ORIENTÉE)", ordre: ["OPPOSE", "MID", "HF", "XF"], ordonne: true },
  kdCur:    { titre: "morphologie K/D",       ordre: ["CROSS", "DIVERGING", "STABLE", "CONTACT", "CONVERGING"], ordonne: false },
  kdGapOr:  { titre: "kdGap ORIENTÉ",         ordre: ["AGAINST", "FOR"], ordonne: true },
  force:    { titre: "dailyForce",            ordre: ["LOW", "MEDIUM", "HIGH", "EXTREME"], ordonne: true },
  dkBandOr: { titre: "ΔK band (ORIENTÉE)",    ordre: ["EXPLOSIVE_DOWN", "FAST_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"], ordonne: true },
};

// ── STATISTIQUE ─────────────────────────────────────────────────────────────────────────────
const st = (t) => {
  const n = t.length, w = t.filter((x) => x.win === 1).length;
  const R = t.reduce((a, b) => a + (RVAL(b) || 0), 0);
  return { n, w, wr: n ? 100 * w / n : NaN, R, rpt: n ? R / n : NaN };
};
const BASELINE = st(pop);
// σ de l'écart à la baseline : p0 = WR global, écart-type binomial sur n.
const sig = (s) => {
  if (!s.n) return NaN;
  const p0 = BASELINE.wr / 100;
  return (s.wr - BASELINE.wr) / (Math.sqrt(p0 * (1 - p0) / s.n) * 100);
};
const fmt = (s) => {
  if (!s.n) return "        —         ";
  const g = sig(s);
  const insuf = s.n < NMIN;
  return `${String(s.n).padStart(5)} ${s.wr.toFixed(1).padStart(5)}% ` +
         `${((s.wr - BASELINE.wr >= 0 ? "+" : "") + (s.wr - BASELINE.wr).toFixed(1)).padStart(5)} ` +
         `${((g >= 0 ? "+" : "") + g.toFixed(2)).padStart(6)}σ ${insuf ? "⚠INSUF" : (Math.abs(g) >= 2 ? "  ⭐  " : "      ")}`;
};
const entete = (t, base) => {
  console.log(`\n── ${t} ──`);
  console.log(`   base : ${base}`);
  console.log(`   ${"".padEnd(18)}${"n".padStart(5)} ${"WR".padStart(6)} ${"Δbase".padStart(5)} ${"σ/base".padStart(7)}        R      R/tir`);
};
const ligne = (lbl, t) => {
  const s = st(t);
  console.log(`   ${lbl.padEnd(18)}${fmt(s)}` +
    (s.n ? `${((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9)}  ${(s.rpt >= 0 ? "+" : "") + s.rpt.toFixed(3)}` : ""));
};

const baseTxt = `${pop.length} ${BASE} · ${SPREAD === "hors" ? "HORS SPREAD" : "spread FACTURÉ"} · ` +
                `${meta.dataset.debut}→${meta.dataset.fin} · ${meta.dataset.actifs} actifs`;

console.log("═".repeat(100));
console.log("  PROTOCOLE V3 — RAPPORT");
console.log("═".repeat(100));
console.log(`  moteur   ${JSON.stringify(meta.moteur)}`);
console.log(`  env      ${JSON.stringify(meta.env)}`);
console.log(`  run      ${meta.run}`);
console.log(`  base     ${baseTxt}`);
console.log(`  ⚠ ${meta.avertissement}`);
console.log(`  ⚠ filtres restants (NON remis en cause) : ${meta.filtres_restants_assumes.join(" · ")}`);
console.log(`  σ calculé contre la BASELINE (WR ${BASELINE.wr.toFixed(1)} %), pas contre le point mort 75 %.`);
console.log(`  seuil d'effectif : n < ${NMIN} ⇒ affiché, marqué ⚠INSUF, aucune conclusion.`);

// ══ 1. GLOBAL ═══════════════════════════════════════════════════════════════════════════════
entete("1. GLOBAL — la baseline « tout admis »", baseTxt);
ligne("TOUT ADMIS", pop);
for (const p of ["P1", "P2"]) ligne(`  ${p}`, pop.filter((r) => r.periode === p));
for (const s of ["BUY", "SELL"]) ligne(`  ${s}`, pop.filter((r) => r.side === s));

// ══ 2. MARGINAUX ════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(100)}\n  2. MARGINAUX — chaque axe SEUL\n${"═".repeat(100)}`);
for (const [k, ax] of Object.entries(AXES)) {
  entete(`2.${Object.keys(AXES).indexOf(k) + 1} ${ax.titre}   [${k}]${ax.ordonne ? "  (ordonné)" : "  (SANS ordre — pas de coupe proposable)"}`, baseTxt);
  for (const v of ax.ordre) ligne(v, pop.filter((r) => r[k] === v));
  const nul = pop.filter((r) => r[k] == null);
  if (nul.length) ligne("⚠ null", nul);
  // Le détail à 5 niveaux de la zone — publié pour que la fusion `OPPOSE` reste vérifiable.
  if (k === "zoneOr") {
    console.log("   détail non fusionné (XO/HO séparés) :");
    for (const v of ["XO", "HO"]) ligne(`     ${v}`, pop.filter((r) => r.zoneOr5 === v));
  }
}

// ══ 3. CROISEMENTS 2D ═══════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(100)}\n  3. CROISEMENTS 2D CIBLÉS\n${"═".repeat(100)}`);
const croise = (a, b) => {
  const A = AXES[a], B = AXES[b];
  console.log(`\n── 3.x ${A.titre} × ${B.titre} ──`);
  console.log(`   base : ${baseTxt}   ·   cellule = n / WR% / Δbase   ·   ⚠ = n < ${NMIN}`);
  console.log("   " + "".padEnd(16) + B.ordre.map((v) => v.slice(0, 13).padStart(15)).join(""));
  for (const va of A.ordre) {
    const cells = B.ordre.map((vb) => {
      const s = st(pop.filter((r) => r[a] === va && r[b] === vb));
      if (!s.n) return "—".padStart(15);
      const d = s.wr - BASELINE.wr;
      return `${s.n}/${s.wr.toFixed(0)}%/${(d >= 0 ? "+" : "") + d.toFixed(0)}${s.n < NMIN ? "⚠" : " "}`.padStart(15);
    });
    console.log("   " + va.padEnd(16) + cells.join(""));
  }
};
croise("zoneOr", "kdCur"); croise("zoneOr", "force"); croise("kdCur", "kdGapOr");
croise("kdCur", "force");  croise("force", "dkBandOr");

// ══ 4. ASSOCIATION ENTRE AXES ═══════════════════════════════════════════════════════════════
// ⭐⭐ LA QUESTION : « les bonnes cases marginales sont-elles LA MÊME sous-population ? » Si deux
//   axes sont fortement associés, empiler leurs deux règles ne filtre pas deux fois — ça filtre une
//   fois et donne l'illusion d'une confirmation indépendante.
// V de Cramér sur la table de contingence : 0 = indépendants, 1 = redondants.
console.log(`\n${"═".repeat(100)}\n  4. MATRICE D'ASSOCIATION DES AXES  (V de Cramér — 0 indépendants · 1 redondants)\n${"═".repeat(100)}`);
const cramerV = (a, b) => {
  const va = AXES[a].ordre, vb = AXES[b].ordre;
  const obs = {}, ra = {}, rb = {}; let N = 0;
  for (const r of pop) {
    if (r[a] == null || r[b] == null) continue;
    obs[`${r[a]}|${r[b]}`] = (obs[`${r[a]}|${r[b]}`] ?? 0) + 1;
    ra[r[a]] = (ra[r[a]] ?? 0) + 1; rb[r[b]] = (rb[r[b]] ?? 0) + 1; N++;
  }
  if (!N) return NaN;
  let chi2 = 0;
  for (const x of va) for (const y of vb) {
    const e = (ra[x] ?? 0) * (rb[y] ?? 0) / N;
    if (e > 0) { const o = obs[`${x}|${y}`] ?? 0; chi2 += (o - e) ** 2 / e; }
  }
  const k = Math.min(Object.keys(ra).length, Object.keys(rb).length);
  return k > 1 ? Math.sqrt(chi2 / (N * (k - 1))) : NaN;
};
const ks = Object.keys(AXES);
console.log("   " + "".padEnd(11) + ks.map((k) => k.slice(0, 9).padStart(11)).join(""));
for (const a of ks)
  console.log("   " + a.padEnd(11) + ks.map((b) => (a === b ? "·" : cramerV(a, b).toFixed(2)).padStart(11)).join(""));

// ══ 5. VERDICT DES ANCIENS A PRIORI ═════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(100)}\n  5. VERDICT DES ANCIENS A PRIORI  (chacun nommé, chiffré contre la baseline)\n${"═".repeat(100)}`);
const verdict = (titre, question, garde, jette) => {
  entete(titre, baseTxt);
  console.log(`   question : ${question}`);
  ligne("ce qu'on GARDAIT", pop.filter(garde));
  ligne("ce qu'on JETAIT", pop.filter(jette));
  for (const p of ["P1", "P2"]) {
    ligne(`  gardé · ${p}`, pop.filter((r) => garde(r) && r.periode === p));
    ligne(`  jeté  · ${p}`, pop.filter((r) => jette(r) && r.periode === p));
  }
};
verdict("5.1 ZONE EXTRÊME REQUISE ?", "le milieu du range tient-il ?",
        (r) => r.zoneOr === "XF", (r) => r.zoneOr && r.zoneOr !== "XF");
verdict("5.2 VETOS CONTACT/CONVERGING JUSTIFIÉS ?", "« trop tard pour fader » — jamais mesuré",
        (r) => ["CROSS", "DIVERGING", "STABLE"].includes(r.kdCur),
        (r) => ["CONTACT", "CONVERGING"].includes(r.kdCur));
verdict("5.3 kdGap ORIENTÉ > 0 REQUIS ?", "le fade APRÈS confirmation tient-il ?",
        (r) => r.kdGapOr === "FOR", (r) => r.kdGapOr === "AGAINST");

// ══ 6. RÈGLES CANDIDATES — PROTOCOLE ANTI-CUEILLETTE ════════════════════════════════════════
// RÈGLES DURES, appliquées par le code et pas par le lecteur :
//   ① une règle = UNE COUPE SIMPLE sur un axe ORDONNÉ (`≥ niveau` ou `≤ niveau`). Jamais une
//      collection de cellules gagnantes — une grille en gruyère est un surajustement, pas une règle.
//   ② MONOTONE : le WR doit être ordonné dans le même sens que l'axe sur tous ses barreaux.
//   ③ COHÉRENTE P1 **ET** P2 : le gain de la coupe doit être du même signe sur les deux moitiés.
//   ④ n ≥ NMIN sur CHAQUE barreau impliqué.
console.log(`\n${"═".repeat(100)}\n  6. RÈGLES CANDIDATES  (coupes simples et monotones — ①UNE COUPE ②MONOTONE ③P1&P2 ④n≥${NMIN})\n${"═".repeat(100)}`);
const cand = [];
for (const [k, ax] of Object.entries(AXES)) {
  if (!ax.ordonne) { console.log(`\n   ${ax.titre} [${k}] — axe SANS ORDRE : aucune coupe proposée (voir §2 pour les marginaux).`); continue; }
  const niveaux = ax.ordre.map((v) => ({ v, s: st(pop.filter((r) => r[k] === v)) })).filter((x) => x.s.n > 0);
  const monoUp   = niveaux.every((x, i) => i === 0 || x.s.wr >= niveaux[i - 1].s.wr - 1e-9);
  const monoDown = niveaux.every((x, i) => i === 0 || x.s.wr <= niveaux[i - 1].s.wr + 1e-9);
  console.log(`\n   ${ax.titre} [${k}] — monotone croissant ${monoUp ? "OUI" : "non"} · décroissant ${monoDown ? "OUI" : "non"}`);
  if (!monoUp && !monoDown) { console.log("   ⇒ NON MONOTONE : aucune coupe simple ne décrit cet axe. Refusé par ②."); continue; }
  for (let i = 1; i < niveaux.length; i++) {
    const gardeV = monoUp ? niveaux.slice(i).map((x) => x.v) : niveaux.slice(0, i).map((x) => x.v);
    if (!gardeV.length) continue;
    const G = pop.filter((r) => gardeV.includes(r[k]));
    const J = pop.filter((r) => r[k] != null && !gardeV.includes(r[k]));
    const sG = st(G), sJ = st(J);
    const barreauxOk = niveaux.every((x) => x.s.n >= NMIN);
    const p1 = st(G.filter((r) => r.periode === "P1")), p2 = st(G.filter((r) => r.periode === "P2"));
    const b1 = st(pop.filter((r) => r.periode === "P1")), b2 = st(pop.filter((r) => r.periode === "P2"));
    const coherent = (p1.wr - b1.wr) > 0 && (p2.wr - b2.wr) > 0;
    const ok = barreauxOk && coherent && sG.n >= NMIN;
    const nom = `${k} ${monoUp ? "≥" : "≤"} ${monoUp ? gardeV[0] : gardeV[gardeV.length - 1]}`;
    console.log(`     ${ok ? "✅" : "❌"} ${nom.padEnd(30)} garde ${String(sG.n).padStart(5)} ${sG.wr.toFixed(1)}% (Δ${(sG.wr - BASELINE.wr >= 0 ? "+" : "") + (sG.wr - BASELINE.wr).toFixed(1)}, σ${sig(sG).toFixed(2)}, R/tir ${sG.rpt.toFixed(3)})` +
                `  jette ${String(sJ.n).padStart(5)} ${sJ.wr.toFixed(1)}%` +
                `  P1 Δ${(p1.wr - b1.wr).toFixed(1)} P2 Δ${(p2.wr - b2.wr).toFixed(1)}` +
                `${barreauxOk ? "" : "  ❌④barreau<" + NMIN}${coherent ? "" : "  ❌③P1/P2"}`);
    if (ok) cand.push({ nom, k, gardeV, sG, sJ, p1: p1.wr - b1.wr, p2: p2.wr - b2.wr });
  }
}

// ── COMPARAISON À LA BASELINE **ET** À L'ANCIENNE FIGURE ────────────────────────────────────
const ANCIENNE = (r) => r.zoneOr === "XF" && r.kdGapOr === "FOR" && ["CROSS", "DIVERGING", "STABLE"].includes(r.kdCur);
console.log(`\n${"═".repeat(100)}\n  6b. CE QUE CHAQUE RÈGLE RETENUE AJOUTE / RETIRE\n${"═".repeat(100)}`);
entete("références", baseTxt);
ligne("baseline TOUT ADMIS", pop);
ligne("ANCIENNE FIGURE", pop.filter(ANCIENNE));
if (!cand.length) console.log("\n   (aucune règle ne passe les quatre contrôles)");
for (const c of cand) {
  const G = pop.filter((r) => c.gardeV.includes(r[c.k]));
  const anc = pop.filter(ANCIENNE);
  const inter = G.filter(ANCIENNE);
  console.log(`\n   ── ${c.nom}`);
  ligne("  la règle", G);
  ligne("  ∩ ancienne", inter);
  ligne("  AJOUTE (règle ∖ anc)", G.filter((r) => !ANCIENNE(r)));
  ligne("  RETIRE (anc ∖ règle)", anc.filter((r) => !c.gardeV.includes(r[c.k])));
}

// ══ 7. GRILLE PROPOSÉE — LA COMBINAISON, ET SEULEMENT SI LES AXES SONT INDÉPENDANTS ══════════
// ⭐⭐ ON NE COMBINE QUE DES AXES PEU ASSOCIÉS. Empiler deux règles portées par la MÊME
//   sous-population ne filtre pas deux fois : ça filtre une fois en donnant l'illusion d'une
//   confirmation indépendante. Le V de Cramér de §4 est le contrôle, et il est affiché ici.
console.log(`\n${"═".repeat(100)}\n  7. GRILLE PROPOSÉE — combinaison de DEUX coupes, sur deux axes vérifiés peu associés\n${"═".repeat(100)}`);
const R1 = { nom: "force ≥ HIGH",              f: (r) => ["HIGH", "EXTREME"].includes(r.force) };
const R2 = { nom: "zone ≥ HF (côté fadé)",     f: (r) => ["HF", "XF"].includes(r.zoneOr) };
console.log(`   association des deux axes (V de Cramér) : ${cramerV("force", "zoneOr").toFixed(2)}   ⇒ ${cramerV("force", "zoneOr") < 0.3 ? "peu associés, la combinaison est légitime" : "🔴 ASSOCIÉS — combinaison NON légitime"}`);
entete("étages de la grille", baseTxt);
ligne("baseline TOUT ADMIS", pop);
ligne(`① ${R1.nom}`, pop.filter(R1.f));
ligne(`② ${R2.nom}`, pop.filter(R2.f));
ligne("① ET ②", pop.filter((r) => R1.f(r) && R2.f(r)));
ligne("ANCIENNE FIGURE", pop.filter(ANCIENNE));
console.log("   — stabilité de la grille ① ET ② —");
for (const p of ["P1", "P2"]) ligne(`  ${p}`, pop.filter((r) => R1.f(r) && R2.f(r) && r.periode === p));
for (const s of ["BUY", "SELL"]) ligne(`  ${s}`, pop.filter((r) => R1.f(r) && R2.f(r) && r.side === s));
console.log("   — ce que la grille fait de l'ancienne figure —");
ligne("  ∩ ancienne", pop.filter((r) => R1.f(r) && R2.f(r) && ANCIENNE(r)));
ligne("  AJOUTE", pop.filter((r) => R1.f(r) && R2.f(r) && !ANCIENNE(r)));
ligne("  RETIRE", pop.filter((r) => ANCIENNE(r) && !(R1.f(r) && R2.f(r))));
console.log("   — les 4 axes NON retenus, sur la population de la grille (restent-ils muets ?) —");
for (const k of ["kdCur", "kdGapOr", "dkBandOr"]) {
  const sub = pop.filter((r) => R1.f(r) && R2.f(r));
  const sB = st(sub);
  const det = AXES[k].ordre.map((v) => { const s = st(sub.filter((r) => r[k] === v));
    return s.n ? `${v}:${s.n}/${s.wr.toFixed(0)}%${s.n < NMIN ? "⚠" : ""}` : null; }).filter(Boolean);
  console.log(`     ${k.padEnd(10)} (base ${sB.n} @ ${sB.wr.toFixed(1)}%)  ${det.join("  ")}`);
}
console.log("");
