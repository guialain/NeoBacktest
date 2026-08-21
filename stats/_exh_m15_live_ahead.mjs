// _exh_m15_live_ahead.mjs — LA POCHE DE `m15-live-extreme-ahead`, CÔTÉ EXH.
//
// ⭐⭐⭐ LA QUESTION, ET ELLE N'EST PAS « COMBIEN ÇA RAPPORTE » : le point C a montré que la famille
//   AHEAD est ANTI-CORRÉLÉE à la qualité CÔTÉ PB — elle y bloquait les gagnants, ce qui en faisait
//   une erreur de SIGNE et non un réglage de rendement. Ces mêmes règles restent des refus PLEINS
//   côté EXH (14 785 déclenchements pour celle-ci), et personne n'a jamais posé la question dans ce
//   sens-là. ⇒ On mesure le CONTRASTE : ce que le veto bloque VAUT-IL MIEUX OU MOINS BIEN que ce
//   qu'il laisse passer ?
//
// ⚠⚠ CE QUE CETTE SONDE NE DIT PAS, ET IL FAUT LE LIRE AVANT LES CHIFFRES. « Un veto ne se juge PAS
//   sur le WR de sa poche » (mesuré le 09/08 : poche à −0,7 R, veto à −4,3 R). **LES VETOS NE
//   SOUSTRAIENT PAS, ILS REMPLACENT** — la place libérée est reprise par d'autres tirs, donc le
//   coût réel d'un retrait ne se lit QUE dans un A/B moteur complet. Ici on répond à la question du
//   SIGNE (« bloque-t-il les bons ? »), pas à celle de la VALEUR (« que gagne-t-on à le retirer ? »).
//
// ⚠ CONTREFACTUEL ET MAJORANT : ces trades n'existent pas. On les simule avec le `walk()` de
//   l'actif — celui qui produit les R du carnet — mais ils ne concourent contre PERSONNE, alors que
//   `maxOpen`/spacing réallouent dans le vrai moteur. Même réserve que `_pb_population_nue`.
//
// ⭐⭐ POPULATION = LES BARRES QUI AURAIENT TIRÉ. Filtrer sur `eConv > MIN_EXH` est le seul cadrage
//   honnête : une barre que le score refusait déjà n'est pas « bloquée par le veto », et l'inclure
//   diluerait la poche avec des barres que le retrait ne rendrait pas. ⚠ `eConv` est le score BRUT,
//   calculé AVANT le veto (le pré-gate a été retiré le 05/08) — sinon ce filtre serait circulaire.
//
// 🔴 ET ON SÉPARE « CE VETO SEUL » DE « CE VETO ACCOMPAGNÉ ». Une barre bloquée par trois refus ne
//   serait pas rendue par le retrait d'un seul : la compter dans le coût du veto lui attribuerait
//   le travail des autres. Le fichier `vetoGate` prévient d'ailleurs que cette règle RECOUVRE
//   partiellement sa jumelle `m15-no-room-ahead` — le recouvrement se mesure ici au lieu de se
//   deviner, et c'est la colonne « SEUL » qui porte l'attribution.
//
// ⚠ Dédoublonnage 15 min AVANT de marcher : une figure persiste plusieurs barres.
// ⚠ `tsMT` = `2026.08.05 …` ⇒ on NORMALISE avant toute découpe de date.
//   usage : node stats/_exh_m15_live_ahead.mjs   [VETO=<id>]
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");
const { MIN_EXH } = await import(
  "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");

const CIBLE = process.env.VETO ?? "m15-live-extreme-ahead";
const JUMELLE = "m15-no-room-ahead";
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

const G = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const p = prepareAsset(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true });
  if (!p) continue;
  for (const g of (p.ghosts || [])) if (g.ghost === "boxes") G.push({ ...g, asset: a, _walk: p.walk });
}

// 🔴 GARDE-FOU : sans `eVetos` recopié, TOUTE barre paraîtrait « jamais vetotée » — plausible et faux.
const avecIds = G.filter((g) => Array.isArray(g.eVetos)).length;
const bloquees = G.filter((g) => g.eBlk === true).length;
const avecIdsSiBloq = G.filter((g) => g.eBlk === true && (g.eVetos?.length ?? 0) > 0).length;
console.log(`\n═══ POCHE \`${CIBLE}\` · CÔTÉ EXH ═══  [NO_TRIGGER · spread FACTURÉ · MIN_EXH = ${MIN_EXH}]`);
console.log(`  ${G.length} barres · \`eVetos\` présent sur ${avecIds}  ·  EXH bloqué ${bloquees}, ` +
  `dont ${avecIdsSiBloq} avec au moins un id ` +
  (bloquees && avecIdsSiBloq === bloquees ? "✅" : "🔴 IDS MANQUANTS — ne pas conclure"));
if (bloquees && avecIdsSiBloq !== bloquees) process.exit(1);
// 🔴 SECOND GARDE-FOU : si le veto ciblé n'apparaît NULLE PART, la sonde rendrait des poches vides
//   qui se liraient « il ne coûte rien ». Une règle renommée doit LEVER, pas produire un zéro.
const porteurs = G.filter((g) => (g.eVetos || []).includes(CIBLE)).length;
if (!porteurs) { console.log(`\n🔴 \`${CIBLE}\` n'apparaît dans AUCUN \`eVetos\` — id inconnu ou règle morte. STOP.`); process.exit(1); }
console.log(`  \`${CIBLE}\` mord sur ${porteurs} barres (toutes convictions confondues)`);

const jour = (x) => String(x.tsMT || "").slice(0, 10).replace(/\./g, "-");
const dedupe = (pop) => { const v = new Set(), o = [];
  for (const g of pop.slice().sort((a, b) => a.ep - b.ep)) {
    const k = `${g.asset}|${g.eSide}|${Math.floor(g.ep / 15)}`; if (v.has(k)) continue; v.add(k); o.push(g); }
  return o; };
// ⚠⚠ LE `side` DU FANTÔME EST CELUI DU **PB**. Marcher dessus mesurerait l'autre boîte sans rien
//   signaler — le fantôme n'est poussé que quand la boîte PB a un côté. On force donc `eSide`.
const simuler = (pop) => dedupe(pop).map((g) => { const r = g._walk({ ...g, side: g.eSide });
  return r ? { ...g, side: g.eSide, R: r.R, outcome: r.outcome } : null; })
  .filter((x) => x && (x.outcome === "WIN" || x.outcome === "LOSS"));

const BE = 75;
const st = (t) => { if (!t.length) return null;
  const w = t.filter((x) => x.outcome === "WIN").length, R = t.reduce((a, b) => a + (b.R || 0), 0);
  const g = new Map();
  for (const x of t) { const k = `${x.asset}|${jour(x)}`; if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, wr: 100 * w / t.length, R, gr: v.length,
           wrg: 100 * v.reduce((a, o) => a + o.w / o.n, 0) / v.length,
           bas: v.filter((o) => o.w / o.n < BE / 100).length }; };
const ligne = (lbl, t) => { const s = st(t);
  if (!s) { console.log(`    ${lbl.padEnd(36)}     —`); return; }
  console.log(`    ${lbl.padEnd(36)} ${String(s.n).padStart(5)} ${s.wr.toFixed(1).padStart(7)}%` +
    ` ${s.wrg.toFixed(1).padStart(8)}% ${String(s.gr).padStart(5)} ${String(s.bas).padStart(5)}` +
    ` ${((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8)} ${(s.R / s.n).toFixed(3).padStart(7)}`);
  return s; };
const ENTETE = `    ${"".padEnd(36)}  tirs  WR/tir WR/grap  grap  <BE        R   R/tir`;

// ══ LA POPULATION QUI AURAIT TIRÉ ═════════════════════════════════════════════════════════════
const aurait = G.filter((g) => (g.eSide === "BUY" || g.eSide === "SELL")
  && Number.isFinite(g.eConv) && g.eConv > MIN_EXH);
const mord   = (x) => (x.eVetos || []).includes(CIBLE);
const seul   = (x) => mord(x) && (x.eVetos || []).length === 1;
const accomp = (x) => mord(x) && (x.eVetos || []).length > 1;
const libre  = (x) => !(x.eVetos || []).length;

console.log(`\n── ① LA POPULATION « AURAIT TIRÉ » (eConv > ${MIN_EXH}) ──`);
console.log(`  ${aurait.length} barres sur ${G.length} (${(100 * aurait.length / G.length).toFixed(1)} %)` +
  `  ·  dont \`${CIBLE}\` en bloque ${aurait.filter(mord).length}` +
  ` (${(100 * aurait.filter(mord).length / (aurait.length || 1)).toFixed(1)} %)`);
console.log(`  recouvrement : ${aurait.filter(seul).length} SEUL · ${aurait.filter(accomp).length} accompagné` +
  `  ·  dont ${aurait.filter((x) => mord(x) && (x.eVetos || []).includes(JUMELLE)).length} avec la jumelle \`${JUMELLE}\``);

console.log(`\n── ② LE CONTRASTE — le veto bloque-t-il MIEUX ou MOINS BIEN que ce qu'il laisse passer ? ──`);
console.log(`  ⭐ C'est la question du SIGNE. Un veto SAIN bloque une poche SOUS le point mort (${BE} %/gr)`);
console.log(`     et laisse passer au-dessus. L'inverse est une erreur de signe, comme côté PB.\n`);
console.log(ENTETE);
const sBloq  = ligne(`BLOQUÉ par ${CIBLE}`, simuler(aurait.filter(mord)));
const sSeul  = ligne("  …dont LUI SEUL (attribuable)", simuler(aurait.filter(seul)));
ligne("  …dont accompagné (non attribuable)", simuler(aurait.filter(accomp)));
const sLibre = ligne("LAISSÉ PASSER (aucun veto)", simuler(aurait.filter(libre)));

if (sSeul && sLibre) {
  const d = sSeul.wrg - sLibre.wrg;
  console.log(`\n  ⇒ écart WR/grappe (lui SEUL − laissé passer) : ${(d >= 0 ? "+" : "") + d.toFixed(1)} pt` +
    (d > 0 ? "   🔴 IL BLOQUE LES MEILLEURS — erreur de SIGNE, comme la famille AHEAD côté PB"
           : "   ✅ il bloque bien le moins bon — le signe est le bon"));
  console.log(`     ⚠ « il bloque le moins bon » ne veut PAS dire « le garder paie » : les vetos REMPLACENT.`);
}

console.log(`\n── ③ PAR CÔTÉ — la doctrine du dépôt crédite une règle de son côté le PLUS FAIBLE ──`);
console.log(ENTETE);
for (const s of ["BUY", "SELL"]) {
  ligne(`${s} — bloqué (lui seul)`, simuler(aurait.filter((x) => seul(x) && x.eSide === s)));
  ligne(`${s} — laissé passer`, simuler(aurait.filter((x) => libre(x) && x.eSide === s)));
}

console.log(`\n── ④ JUILLET / AOÛT — un gain ADOSSÉ est le signal d'alarme, pas un R faible ──`);
console.log(ENTETE);
for (const [lbl, f] of [["juillet", (x) => jour(x) < "2026-08-01"], ["août", (x) => jour(x) >= "2026-08-01"]]) {
  ligne(`${lbl} — bloqué (lui seul)`, simuler(aurait.filter((x) => seul(x) && f(x))));
  ligne(`${lbl} — laissé passer`, simuler(aurait.filter((x) => libre(x) && f(x))));
}
