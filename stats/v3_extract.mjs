// v3_extract.mjs — PROTOCOLE V3, ÉTAPE A : L'EXTRACTION ONE-SHOT, FIGÉE.
// ============================================================================================
// ⭐⭐⭐ CE QUE CE SCRIPT INVERSE. Jusqu'ici chaque mesure re-filtrait la population en amont (zone
//   extrême, morphologies choisies, `kdGap` orienté) puis décrivait ce qui restait. Une question
//   comme « la zone extrême est-elle requise ? » ne pouvait donc PAS être posée : la réponse était
//   déjà dans la construction de l'échantillon. Ici on extrait UNE FOIS la population du SOCLE, et
//   toutes les questions se posent ENSUITE, sur la même table.
//
// SOCLE (le définitionnel du fade, rien d'autre) :
//   ① capteurs H1 présents  ② `regDir ≠ 0`  ③ côté = `−regDir`  ④ MIROIR (les deux côtés)
// TOUT LE RESTE EST UNE COLONNE : zone · kdCur · kdGap orienté · dailyForce · dKBand.
//
// ⚠⚠ CE QUI RESTE UN FILTRE, ASSUMÉ ET NOMMÉ — il faut le savoir en lisant la table :
//   · `spread_cap` (P60) et `tick_low` — portes de COÛT, pas de régime. Les retirer mettrait dans la
//     table des barres non traçables en vrai, dont le R serait une fiction.
//   · `friday_cutoff` et les heures de session — mêmes raisons.
//   · `m5-timing` — refus de DERNIER INSTANT (≈2,5 % des tirs), appliqué après le score. Ce n'est
//     pas un a priori sur la figure, c'est une porte d'exécution.
//   ⇒ Ces quatre-là ne sont PAS des axes du test et ne seront pas remis en cause par lui.
//
// 🔴🔥 POURQUOI `spacing=false` ET `maxOpen=100000`, ET C'EST LA DÉCISION LA PLUS IMPORTANTE DU
//   FICHIER. Moteur éteint + bonus de test ⇒ TOUTE barre du socle tire. Mesuré sur EURUSD :
//       fires 5747 · spacing ACTIF → opened 1052   (82 % supprimés, `TOO_CLOSE` 4695)
//       fires 5747 · spacing OFF   → opened 3671   (`maxOpen=30` en rejette encore 2076)
//       fires 5747 · spacing OFF + maxOpen 100000 → opened 5747, `rejectedCap = 0`
//   Avec la capacité de prod, ce qui entre dans le carnet est décidé par l'ORDRE D'ARRIVÉE et non
//   par la figure : une figure RARE n'obtient presque jamais de place, une figure FRÉQUENTE sature
//   les 8 places de l'actif. Le biais frapperait CHAQUE AXE À LA FOIS, et dans le même sens.
//   ⇒ On mesure le MÉRITE de la figure, pas sa position dans la file. La courbe d'équité de ce run
//   n'a donc AUCUN SENS (positions superposées) — on ne lit que WR et R PAR TIR.
//
// ⚠ LE FICHIER EST FIGÉ ET VERSIONNÉ : hash du moteur (2 dépôts), bornes du dataset, paramètres du
//   run, comptages. Une analyse qui ne peut pas nommer la table sur laquelle elle tourne n'est pas
//   reproductible.
import fs from "fs";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { dedupeEpisodes } from "./_episodes.mjs";

const API  = "http://localhost:3001/api/matrix";
const OUT  = process.env.OUT ?? "analyse_out/v3";
const RUN  = "maxOpen=100000&cadenceMin=2&spacing=false";

// ── Bandes : RECOPIÉES DU MOTEUR, jamais redécoupées ────────────────────────────────────────
// ⚠ `FORCE_BANDS = [25,50,75]` vient de `classifyMarketProfile.js`. `forceScore` est QUANTIFIÉ
//   (0 · 25 · 50 · 75 observés) : un découpage en percentiles couperait AU MILIEU d'une valeur.
const forceBand = (f) => f == null ? null
  : f < 25 ? "LOW" : f < 50 ? "MEDIUM" : f < 75 ? "HIGH" : "EXTREME";

// ⭐⭐ `kdGap` ORIENTÉ PAR LE CÔTÉ. Un fade BUY et un fade SELL lisent le même écart en sens
//   OPPOSÉS : `K>D` côté SELL et `K<D` côté BUY sont LA MÊME FIGURE. Comparer les signes BRUTS
//   couperait chaque classe en deux demi-échantillons — la faute du 06/08 (`FAST_DOWN` à 100 % sur
//   21 ép, qui n'était qu'une moitié de population).
//   `FOR` = l'écart s'ouvre DANS LE SENS d'où l'on fade · `AGAINST` = son contraire.
const gapOriente = (gap, side) => gap == null ? null
  : ((side === "SELL" ? gap : -gap) > 0 ? "FOR" : "AGAINST");

// ⭐ Idem pour la VITESSE de %K : `_UP` = %K va dans le sens d'où l'on fade.
const MIROIR_BANDE = { EXPLOSIVE_DOWN: "EXPLOSIVE_UP", FAST_DOWN: "FAST_UP", SOFT_DOWN: "SOFT_UP",
                       FLAT: "FLAT",
                       SOFT_UP: "SOFT_DOWN", FAST_UP: "FAST_DOWN", EXPLOSIVE_UP: "EXPLOSIVE_DOWN" };
const dkOriente = (b, side) => b == null ? null : (side === "BUY" ? (MIROIR_BANDE[b] ?? b) : b);

// ── Sous-périodes : bornes du DATASET, pas de la population (mêmes fenêtres pour toute analyse) ──
const D0 = Math.floor(Date.UTC(2026, 5, 29) / 60000);
const D1 = Math.floor(Date.UTC(2026, 7,  6) / 60000);
const periode = (ep) => !Number.isFinite(ep) ? null : (ep < D0 + (D1 - D0) / 2 ? "P1" : "P2");

// ⚠⚠ LE HASH SEUL MENT SI L'ARBRE EST MODIFIÉ. Un `rev-parse HEAD` sur un dépôt sale nomme un état
//   que la mesure n'a PAS utilisé — et c'est exactement le cas ici (l'instrumentation V3 n'est pas
//   commitée). On publie donc HEAD **et** le hash du diff : deux extractions faites sur deux arbres
//   sales différents ne peuvent plus se confondre.
const rev = (d) => {
  try {
    const h = execSync("git rev-parse --short HEAD", { cwd: d }).toString().trim();
    const diff = execSync("git diff HEAD", { cwd: d }).toString();
    if (!diff.trim()) return h;
    const dh = createHash("sha1").update(diff).digest("hex").slice(0, 8);
    return `${h}+dirty:${dh}`;
  } catch { return "?"; }
};

const assets = await (await fetch(`${API}/assets`)).json();
const byKey = new Map();          // `${asset}|${ep}|${side}` → ligne
let firesTot = 0, openedTot = 0;

for (const SP of [true, false]) {                       // deux passes : facturé, puis hors spread
  for (const a of assets) {
    const j = await (await fetch(`${API}/run/${a}?${RUN}&chargeSpread=${SP}`)).json();
    if (SP) { firesTot += j.summary?.fires ?? 0; openedTot += j.summary?.opened ?? 0; }
    if ((j.summary?.rejectedCap ?? 0) || (j.summary?.rejSpacingTotal ?? 0))
      throw new Error(`${a}: la capacité mord encore (cap ${j.summary.rejectedCap} · spacing ${j.summary.rejSpacingTotal}) — la table serait biaisée`);
    for (const s of (j.signals || [])) {
      if (typeof s.R !== "number") continue;
      if (s.outcome !== "WIN" && s.outcome !== "LOSS") continue;
      const k = `${a}|${s.ep}|${s.side}`;
      if (SP) {
        byKey.set(k, {
          // ⭐ `strategy` PORTÉ DANS LA TABLE (07/08) : la même extraction sert la branche EXH
          //   (`BONUS_TEST_EXH`) et la branche CONT (`BONUS_TEST_CONT`). Sans cette colonne, deux
          //   tables identiques de forme seraient indiscernables une fois relues.
          strategy: s.strategy ?? null,
          asset: a, side: s.side, ep: s.ep, ts: s.tsMT, periode: periode(s.ep),
          // 🔴🔥 `winNs` EST INDISPENSABLE, ET SON ABSENCE A PRODUIT DE FAUX TABLEAUX (corrigé
          //   07/08). La 1ᵉʳ version ne reprenait que `R` de la passe hors spread ; `win` restait
          //   celui de la passe FACTURÉE. Toute colonne « hors spread » affichait donc un WR
          //   facturé à côté d'un R nominal — le pire des deux mondes, et parfaitement muet.
          //   ⚠ C'est exactement l'inverse de ce que le péage fait : **le R reste NOMINAL, c'est le
          //   WR qui paie** (le spread pousse des gagnants de justesse en perdants). Le champ qui
          //   DEVAIT changer entre les deux modes était le seul qu'on ne reprenait pas.
          outcome: s.outcome, win: s.outcome === "WIN" ? 1 : 0,
          R: s.R, Rns: null, winNs: null, outcomeNs: null,
          dureeMin: (Number.isFinite(s.closeEp) && Number.isFinite(s.openEp)) ? s.closeEp - s.openEp : null,
          // ── LES 5 AXES ──
          zone:      s.zoneH1 ?? null,
          kdCur:     s.kdCycleH1 ?? null,
          kdGap:     s.kdGapH1 ?? null,
          kdGapOr:   gapOriente(s.kdGapH1, s.side),
          force:     forceBand(s.forceScore),
          forceRaw:  s.forceScore ?? null,
          dkBand:    s.dKBandH1 ?? null,
          dkBandOr:  dkOriente(s.dKBandH1, s.side),
          // ── LES SCORES, AJOUTÉS LE 07/08 — ce qui manquait pour passer des FIGURES aux THÈSES ──
          // 🔴🔥 POURQUOI ILS SONT INDISPENSABLES. Le montage « moteur éteint + bonus 2000 » isole
          //   une POPULATION, jamais une THÈSE : le bonus noie les deux scoreurs, donc les rangs ②
          //   et ③ tirent sur EXACTEMENT les mêmes barres (vérifié : 78 490 clés communes, R
          //   identique à 100 %). Ce qui SÉPARE les deux thèses est le SCORE, et lui seul.
          // ⭐ `exhRaw`/`contRaw` sont les scores AVANT bonus — c'est ce qui permet de refaire la
          //   soustraction. Prendre `exh`/`cont` bonifiés ne montrerait que le +2000 de la sonde.
          // ⚠ CE QUE CHACUN VAUT DÉPEND DU RANG QUI A DÉCIDÉ, et c'est un piège de lecture :
          //     rang ① (EXH)  `exhRaw` = sExhBySide[−regDir]  · `contRaw` = score de continuation
          //     rang ② (PB)   `exhRaw` = sExhBySide[+regDir]  · `contRaw` = score de continuation
          //     rang ③ (CONT) `exhRaw` = **null** — la trace du rang ③ ne porte pas de score de fade
          //   ⇒ pour comparer PULLBACK et CONTINUATION sur la MÊME barre, il faut la table du
          //   rang ② (`BONUS_TEST_RANG=2`) : elle SEULE porte les deux scores côte à côte.
          exhRaw:  s.sc?.exhRaw ?? null,
          contRaw: s.sc?.contRaw ?? null,
          minRang: s.sc?.min ?? null, rang: s.sc?.rank ?? null,
          // ⭐ LE DÉTAIL PAR EXPERT — `di`, `rsi`, `gap`, `kd`, `zscore`… selon le mode. C'est la
          //   matière première de « quels experts dans quelle cellule ».
          // ⚠ `null` = expert MUET (il sort du dénominateur et AMPLIFIE les autres), `0` = expert
          //   qui a parlé pour ne rien dire. Ne JAMAIS confondre les deux en aval.
          exp: s.sc?.exp ?? null,
          // ── diagnostics, PAS des axes ──
          regime: s.regime ?? null, spreadRaw: s.spreadRaw ?? null,
        });
      } else {
        const row = byKey.get(k);    // ⚠ appariement par CLÉ, jamais par index : un run peut différer
        if (row) { row.Rns = s.R; row.outcomeNs = s.outcome; row.winNs = s.outcome === "WIN" ? 1 : 0; }
      }
    }
  }
}

const tirs = [...byKey.values()].sort((x, y) => x.ep - y.ep || x.asset.localeCompare(y.asset));
// ⚠ `dedupeEpisodes` attend les signaux bruts et un accesseur d'actif — même fonction que partout
//   ailleurs dans le dépôt, jamais réimplémentée ici.
const eps = dedupeEpisodes(tirs, (s) => s.asset);
const sansRns = tirs.filter((t) => t.Rns == null).length;

fs.mkdirSync(OUT, { recursive: true });
const meta = {
  protocole: "V3 — socle seul, tout admis, tout mesuré",
  fige_le: new Date(Date.now()).toISOString().slice(0, 10),
  moteur: { "Matrix-Revolution": rev("C:/Users/Public/Matrix-Revolution"), "Neo-Backtest": rev("C:/Users/Public/Neo-Backtest") },
  env: { MIROIR: process.env.MIROIR ?? null, TOUT_ADMETTRE: process.env.TOUT_ADMETTRE ?? null,
         ZONES: process.env.ZONES ?? "all (défaut)", KDCUR: process.env.KDCUR ?? "les 5 (défaut)",
         KDGAP: process.env.KDGAP ?? "all (défaut)", DK: process.env.DK ?? "all (défaut)" },
  run: RUN + " · chargeSpread ∈ {true,false}",
  dataset: { debut: new Date(D0 * 60000).toISOString().slice(0, 10),
             fin:   new Date((D1 - 1) * 60000).toISOString().slice(0, 10), actifs: assets.length },
  comptages: { fires: firesTot, opened: openedTot, tirs: tirs.length, episodes: eps.length,
               tirs_sans_R_hors_spread: sansRns },
  filtres_restants_assumes: ["spread_cap P60", "tick_low", "friday_cutoff / heures de session", "m5-timing"],
  avertissement: "spacing OFF + maxOpen 100000 ⇒ positions superposées : la courbe d'équité et le maxDD n'ont AUCUN sens sur ce run. Lire WR et R PAR TIR uniquement.",
};
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 2));
fs.writeFileSync(`${OUT}/tirs.jsonl`, tirs.map((r) => JSON.stringify(r)).join("\n") + "\n");
fs.writeFileSync(`${OUT}/episodes.jsonl`, eps.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(JSON.stringify(meta, null, 2));
