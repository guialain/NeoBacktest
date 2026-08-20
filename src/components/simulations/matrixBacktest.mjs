// ============================================================================================
// matrixBacktest.mjs — Backtest MOTEUR MATRIX par actif (SSOT : import cross-repo, pas de copie).
// --------------------------------------------------------------------------------------------
// Charge un CSV actif (format Matrix, snapshots bakés) → run detectOpportunity row-par-row →
//   signaux post-trio → walk TP/SL close-to-close sur `price` (ATR-based) avec cap concurrence.
// Sortie = LOG DE SIGNAUX (timestamp MT pour croiser MT5) + résumé. R-multiples (pas de currency PnL
//   pour l'instant : les specs contrat viendront pour brancher le simulateur complet).
// Import cross-repo = SSOT (le moteur = celui de la prod, jamais une copie).
// ============================================================================================
import fs from "fs";
import { detectOpportunity, deltaKBand, stochZone, diGapBand, diGapDynamics, diGapDynamicsLive, diLevelBand } from "../../../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { decideFromScoring, MIN_CONT, MIN_EXH, MIN_PB, MIN_PRES } from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js";
// ⭐ LES QUATRE SEUILS, ADRESSÉS PAR RANG. Écrit comme une table et non comme un ternaire : c'est
//   très exactement la forme qui a laissé passer le rang ② (un `a ? x : y` ne peut pas avoir trois
//   issues, et il n'échoue pas quand on lui en demande une troisième — il en rend une fausse).
//   `MIN_PRES` n'est pas ici : il ne qualifie aucun rang, il sépare deux issues DANS le rang ①.
const MIN_BY_MODE = { EXH: MIN_EXH, PB: MIN_PB, CONT: MIN_CONT };
// ⭐⭐⭐ LES SEUILS ACTIFS, EMBARQUÉS DANS CHAQUE RÉPONSE. `MIN_BY_MODE` sert à DÉCIDER, `thresholds`
//   sert à DIRE — et les deux lisent la même source, donc ils ne peuvent pas diverger.
// 🔴🔥 SANS ÇA L'UI MENT, ET SILENCIEUSEMENT : `_envNum` lit `process.env`, absent du navigateur ⇒
//   tout `MIN_*` importé côté client retombe sur son DÉFAUT (`MIN_PB = 1000`) pendant que le serveur
//   tourne avec la valeur passée à son démarrage. Deux nombres, un seul nom, aucune erreur levée.
// ⚠ `MIN_PRES` en fait partie bien qu'il ne qualifie AUCUN rang : il sépare deux issues DANS le
//   rang ① (`exh-ambiguous`, et depuis le 11/08 `exh-present-empeche`), donc il change le carnet.
const thresholds = { MIN_EXH, MIN_PRES, MIN_PB, MIN_CONT };
import { observeProfile } from "../../../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js";
import { createSpikeTracker } from "../../../../Matrix-Revolution/src/components/robot/engines/opportunities/SpikeGuard.js";
import GlobalMarketHours from "../../../../Matrix-Revolution/src/components/robot/engines/trading/GlobalMarketHours.js";
// ⭐ INVARIANT 10 — le garde d'empilement du LIVE, importé et non recopié (cf. bloc au point d'ouverture).
import { checkPositionSpacing } from "../../../../Matrix-Revolution/src/components/robot/engines/trading/PositionSpacing.js";
import { getTickFlowConfig, computeMeanTick5s, getMeanTick5sBaseline, MEANT5_DEAD_PCT } from "../../../../Matrix-Revolution/src/config/TickFlowConfig.js";
import { spreadCapBlock } from "../../../../Matrix-Revolution/src/config/SpreadCapConfig.js";
import { getTpSl } from "../../../../Matrix-Revolution/src/config/TpSlConfig.js";
// ⭐ `computeDeviation` — l'écart prix ↔ moyenne normalisé par l'ATR p50 de l'actif, c'est-à-dire
//   L'ENTRÉE DE L'EXPERT `gap` (ex-`zscore` du fade, renommé le 06/08). Importé le 07/08 : la fiche
//   portait le SCORE de l'expert (`sc.exp.gap`) mais jamais sa MESURE, donc « WR par gapAtr » était
//   inrépondable. ⚠ NE PAS confondre avec `gap0..gap3`, qui sont les écarts K−D du H1.
import { computeDeviation } from "../../../../Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
import { TRADABLE_SYMBOLS } from "../../../../Matrix-Revolution/src/config/allowedSymbols.js";
// ⭐ 19/08 — LA LISTE DES ENTREES DU RANG ① VIENT DE LA TABLE QUI DECIDE (cf. `eParts`).
import { EXH_FAMILLES_POIDS } from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/exhScoringV1.js";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
// ⚠ num("") === 0 (Number("") === 0) → une colonne VIDE se lit « 0 », pas « absent ». Pour un DIAGNOSTIC
//   affiché, ce zéro fantôme mentirait (ADX absent ≠ ADX à 0). numStrict traite ""/null/undefined en null.
const numStrict = (v) => (v === "" || v == null) ? null : num(v);
const r2 = (v) => (v == null ? null : +Number(v).toFixed(2));

/**
 * adxRegime — dérivée SECONDE de l'ADX H1 (owner 2026-07-17), sur les 3 closes dispo (c1,c2,c3).
 *   Δ₁ = c1−c2 (le plus récent) · Δ₂ = c2−c3 (le précédent).
 *   MÊME signe   ⇒ la force garde sa direction  → RISING / FALLING (mouvement INSTALLÉ)
 *   signes OPPOSÉS ⇒ la force pivote            → TURN_DOWN / TURN_UP (INFLEXION fraîche)
 * Pourquoi c'est utile : le gate d'exhaustion (Δ₁ ≤ −1,8) ne distingue PAS « baisse depuis 2 h » d'un
 *   « vient de se retourner » — or pour un fade ce n'est pas le même moment.
 * ⚠ Bande morte FLAT_BAND : sans elle, un Δ de ±0,05 (bruit) compterait comme un vrai signe et
 *   TURN_* serait dominé par du hasard. 1,8 = borne de la bande FLAT (étude ADX 15/07), réutilisée ici
 *   pour rester cohérent avec le seuil déjà calibré — PAS un nouveau réglage.
 */
// ⚠ LA BANDE EST UN PARAMÈTRE, PAS UNE CONSTANTE PARTAGÉE : chaque série a SA dispersion. Réutiliser la
//   bande de l'ADX sur le DI n'aurait aucun fondement (leçon bande MID / balayage ΔADX du 17/07).
//   ADX : 1,8 = borne FLAT (étude 15/07). DI : bandes mesurées sur la distribution réelle (P50 de |Δ|).
// Mesuré 17/07 (univers, |Δ₁| H1) — le DI est BEAUCOUP plus dispersé que l'ADX :
//   ADX P25 0,89 · P50 1,84 · P95 4,19   |   +DI/−DI P25 1,70 · P50 2,65   |   spread P25 2,01 · P50 4,89
// Bandes calées sur le P25 de CHAQUE série (le signal ADX vivait vers P13–P27 de la sienne, pas au P50).
// ⚠ PROVISOIRE : à balayer comme l'ADX avant d'en tirer la moindre règle.
const ADX_BAND = 1.8;       // borne FLAT, étude ADX 15/07 (≈ P50 de |Δ| ADX)
const DI_BAND = 1.7;        // P25 de |Δ| +DI/−DI
const SPREAD_BAND = 2.0;    // P25 de |Δ| du spread — 3× l'ADX : recopier 1,8 ici n'aurait aucun sens
function regimeOf(c1, c2, c3, band) {
  if (c1 == null || c2 == null || c3 == null) return null;
  const d1 = c1 - c2, d2 = c2 - c3;
  const s = (d) => (Math.abs(d) < band ? 0 : Math.sign(d));
  const s1 = s(d1), s2 = s(d2);
  if (s1 === 0 && s2 === 0) return "FLAT";
  if (s1 === 0) return "FLAT_1";            // le mouvement vient de s'éteindre
  if (s2 === 0) return s1 > 0 ? "START_UP" : "START_DOWN";   // démarre depuis un plat
  if (s1 === s2) return s1 > 0 ? "RISING" : "FALLING";        // installé
  return s1 > 0 ? "TURN_UP" : "TURN_DOWN";                    // inflexion fraîche
}

/**
 * relRegime — même grammaire, mais ORIENTÉE par le sens du trade (`sgn` = +1 BUY / −1 SELL).
 *   Réservé aux séries qui ont un SENS (le spread DI) : « monte » n'y veut rien dire tant qu'on n'a pas
 *   dit « par rapport à quoi ». L'ADX, lui, est aveugle au côté → regimeOf brut suffit.
 */
function relRegime(c1, c2, c3, sgn, band) {
  if (c1 == null || c2 == null || c3 == null) return null;
  const d1 = (c1 - c2) * sgn, d2 = (c2 - c3) * sgn;
  const s = (d) => (Math.abs(d) < band ? 0 : Math.sign(d));
  const s1 = s(d1), s2 = s(d2);
  if (s1 === 0 || s2 === 0) return "FLAT";
  if (s1 === s2) return s1 > 0 ? "WITH" : "AGAINST";
  return s1 > 0 ? "TURN_WITH" : "TURN_AGAINST";
}

/**
 * fireSnapshot — PHOTO des indicateurs à l'instant du tir, recopiée sur le trade (page « Signaux »).
 *
 * Pourquoi : le moteur calcule tout ça pour décider, puis le jette. Sans photo, une question aussi simple
 *   que « à quel RSI / quel ADX ce trade a-t-il tiré ? » exige de rejouer la barre à la main.
 *
 * ⚠ STRICTEMENT PASSIF — lecture seule, aucune influence sur la décision. Ne JAMAIS s'en servir comme
 *   source pour un gate : le gate doit lire l'observable du moteur, pas cette copie (sinon deux vérités).
 * ⚠ Backtest only : `data/matrix` porte des colonnes ABSENTES du scan live (adx14_*, cf le bloquant EA).
 */
function fireSnapshot(row, det, obs) {
  const v = det?.vector ?? {}, e = det?.energy ?? {}, m = det?.maturity ?? {}, st = det?.stoch ?? {};
  const rs = det?.rawSelection ?? {};
  const h1 = st?.perTf?.h1 ?? {}, m15 = st?.perTf?.m15 ?? {}, h4 = st?.perTf?.h4 ?? {};
  const adxH1 = numStrict(row?.adx14_h1_c1), adxH1p = numStrict(row?.adx14_h1_c2), adxH1pp = numStrict(row?.adx14_h1_c3);
  const adxM15 = numStrict(row?.adx14_m15_c1), adxM15p = numStrict(row?.adx14_m15_c2);
  const pdi = numStrict(row?.plus_di_h1_c1), pdi2 = numStrict(row?.plus_di_h1_c2), pdi3 = numStrict(row?.plus_di_h1_c3);
  const mdi = numStrict(row?.minus_di_h1_c1), mdi2 = numStrict(row?.minus_di_h1_c2), mdi3 = numStrict(row?.minus_di_h1_c3);
  // SPREAD DI = +DI − −DI : la pression directionnelle SIGNÉE (l'ADX, lui, est aveugle au sens).
  //   Sur 3 closes → mêmes Δ₁/Δ₂ et même comparaison de signe que l'ADX.
  const sp = (a, b) => (a != null && b != null) ? a - b : null;
  const spr1 = sp(pdi, mdi), spr2 = sp(pdi2, mdi2), spr3 = sp(pdi3, mdi3);
  const d = (a, b) => (a != null && b != null) ? r2(a - b) : null;
  return {
    // ── DÉCISION (couche 3) — pourquoi ce trade existe
    confidence: r2(rs.confidence), gap: r2(rs.gap), override: rs.override ?? null,
    reasons: Array.isArray(rs.reasons) ? rs.reasons : [],
    // ── LES OBSERVABLES DU CONTRAT (couche 2) — l'état du marché tel que le moteur le VOIT.
    //   ⛔ 2026-07-20 : `thetaDay` SORTI du contrat (13 → 12 observables). Il ne SCORE plus et ne
    //   FILTRE plus (les 2 gates thetaDay sont supprimés, +144,7 R mesurés).
    //   ⚠️ Il apparaît ENCORE comme clé d'`obs` — `observeProfile` l'émet pour la carte Vector de la
    //   page de trace. `obs` porte donc 13 clés pour 12 observables de contrat : NE PAS compter les
    //   clés d'`obs` pour connaître le contrat, la référence est `observableContract.js`.
    obs: { ...obs },
    // ── TREND / VECTOR — theta = pente D1 (le « taux instantané »), dTheta = sa rotation
    thetaDayDeg: r2(v.thetaDayDeg), dTheta: r2(v.deltaTheta), thetaRotation: v.thetaRotation ?? null,
    thetaWindowMin: v.thetaWindowMin ?? null, angleTheta: r2(v.angleTheta), forceScore: r2(v.forceScore),
    // ⭐ 2026-07-20 — `forceRegime` EXPOSÉ : depuis `734b029` c'est la BANDE IntradayConfig (ladder
    //   sur intraday_change) qui produit `dailyForce`/`dailyDirection`. C'était invisible dans l'UI
    //   alors que ça pilote désormais le régime. Sans cette colonne, on lit `Force` sans sa cause.
    forceRegime: v.perTf?.d1?.forceRegime ?? null,
    continuationDelta: v.continuationDelta == null ? null : +Number(v.continuationDelta).toFixed(6),
    vectorScore: r2(v.score),
    // ── ADX / DI (H1 + M15). dAdx H1 = la MÊME formule que le gate d'exhaustion (c1 − c2).
    adx: adxH1, dAdx: (adxH1 != null && adxH1p != null) ? r2(adxH1 - adxH1p) : null,
    // ⭐ `adxH1Live` — 3ᵉ entrée du barème EXH v1, passée en LIVE le 07/08 (« adx en live s0 aussi,
    //   c'est plus cohérent »). ⚠ `adx` juste à gauche est la CLÔTURE (`_c1`) : les deux sont
    //   exposés parce qu'ILS NE DISENT PAS LA MÊME CHOSE — mesuré sur les 343 140 barres du dataset,
    //   **16,31 % changent de ligne du barème** entre les deux lectures, alors que la distribution
    //   agrégée est identique à deux dixièmes près. Mirage d'agrégat : c'est le par-barre qui décide.
    // ⚠⚠ NE PAS retomber sur `h1?.adx?.adx` : le détecteur y expose `a0 ?? a1`, donc live SI dispo,
    //   sinon la CLÔTURE — un repli silencieux qui rendrait la colonne inattribuable.
    adxH1Live: numStrict(row?.adx14_h1_s0),
    // DÉRIVÉE SECONDE (owner 2026-07-17) : le gate ne lit que Δ₁ → il confond « l'ADX baisse depuis 2 h »
    //   (déclin INSTALLÉ) et « l'ADX vient de se retourner » (INFLEXION fraîche). Δ₂ = c2 − c3 donne le
    //   signe précédent ; même signe ⇒ la force persiste, signes opposés ⇒ elle pivote. c3 existait dans
    //   data/matrix sans être lu par personne. DIAGNOSTIC — aucun gate ne s'en sert (encore).
    dAdx2: (adxH1p != null && adxH1pp != null) ? r2(adxH1p - adxH1pp) : null,
    adxAccel: (adxH1 != null && adxH1p != null && adxH1pp != null) ? r2((adxH1 - adxH1p) - (adxH1p - adxH1pp)) : null,
    // ⭐ 2026-07-20 — LA VÉRITÉ MOTEUR, LUE ET NON RECALCULÉE. `dominance` (bande de NIVEAU) et
    //   `dominanceTurn` (INFLEXION) sortent de l'expert Dynamique — ce sont EXACTEMENT les valeurs sur
    //   lesquelles la couche 3 décide (la porte d'exhaustion exige `dominanceTurn === "TURN_DOWN"`
    //   depuis aujourd'hui). À lire en priorité dans les rapports.
    dominance: h1?.adx?.dominance ?? null,
    dominanceTurn: h1?.adx?.dominanceTurn ?? null,
    // ⚠️ `adxRegime` N'EST PAS `dominanceTurn` — DEUX IMPLÉMENTATIONS, DEUX RÉSULTATS :
    //     ici  regimeOf, bande morte ADX_BAND = 1,8 · 6 états (+ FLAT_1 / START_UP / START_DOWN)
    //     moteur adxTurnBand, bande morte 1,0 · 5 états
    //   Et 1,8 a été EXPLICITEMENT REJETÉ par le calibrage du 18/07 : « bande morte 1,0 (8,3 % de
    //   U-turn) et PAS 1,8 (2,4 %, |Δ| médian = 1,84) — à 1,8 le signal est étouffé ».
    //   ⇒ conservé comme DIAGNOSTIC (granularité plus fine, utilisé par des analyses existantes),
    //   mais ne JAMAIS le lire comme le verdict du moteur. Pour ça : `dominanceTurn`.
    adxRegime: regimeOf(adxH1, adxH1p, adxH1pp, ADX_BAND),
    adxM15: adxM15, dAdxM15: (adxM15 != null && adxM15p != null) ? r2(adxM15 - adxM15p) : null,
    plusDi: pdi, minusDi: mdi, diDelta: r2(spr1),
    // ── DI sur 2 périodes (owner 2026-07-17) — même grammaire que l'ADX : Δ₁ vs Δ₂, signe comparé.
    //   L'ADX dit « la force monte/baisse » SANS le sens ; le DI dit « la pression penche de quel côté ».
    //   dSpread = variation de la pression signée ; spreadRegime = installée (RISING/FALLING) vs inflexion
    //   fraîche (TURN_UP/TURN_DOWN). ⚠ Ici TURN_UP = pression qui bascule VERS LE HAUT (sémantique opposée
    //   à adxRegime, où il s'agit de la FORCE, sans côté) — ne pas lire les deux comme la même chose.
    dPlusDi: d(pdi, pdi2), dPlusDi2: d(pdi2, pdi3),
    dMinusDi: d(mdi, mdi2), dMinusDi2: d(mdi2, mdi3),
    dSpread: d(spr1, spr2), dSpread2: d(spr2, spr3),
    spreadRegime: regimeOf(spr1, spr2, spr3, SPREAD_BAND),
    // ⭐ LA BANDE ET LA DYNAMIQUE DE L'ÉCART DI, telles que l'expert `di` les lit — importées de
    //   `OpportunityDetector`, jamais rebandées ici. ⚠ `gapDyn` porte sur Δ|DI+ − DI−| : un spread
    //   qui passe de −16 à −12 a un delta SIGNÉ positif alors que l'ÉCART s'est RÉDUIT.
    // ⚠ MÊME REPLI QUE `scoringInputs` : on prend la lecture LIVE (`_s0` contre `_c1`) quand elle
    //   existe, sinon les deux closes. Choisir un seul instant ici ferait diverger la fiche du
    //   moteur sur les 15 % de barres où `_s0` manque.
    ...(() => { const p0 = numStrict(row?.plus_di_h1_s0), m0 = numStrict(row?.minus_di_h1_s0);
                const p1 = numStrict(row?.plus_di_h1_c1), m1 = numStrict(row?.minus_di_h1_c1);
                const p2 = numStrict(row?.plus_di_h1_c2), m2 = numStrict(row?.minus_di_h1_c2);
                const P = p0 ?? p1, M = m0 ?? m1;
                const live = (p0 !== null && m0 !== null) ? diGapDynamicsLive(p0, m0, p1, m1) : null;
                return { diGapBandH1: diGapBand(P, M), diGapDynH1: live ?? diGapDynamics(p1, m1, p2, m2) }; })(),
    plusDiRegime: regimeOf(pdi, pdi2, pdi3, DI_BAND),
    minusDiRegime: regimeOf(mdi, mdi2, mdi3, DI_BAND),
    // ⭐ LE NIVEAU DE CHAQUE CAMP, EN LIVE — `diLevelBand` est calibré sur `_s0` et SEULEMENT sur lui
    //   (« ces bornes sont pour la lecture LIVE ; appliquées aux closes elles déforment dans l'autre
    //   sens », OpportunityDetector). Or `plusDi`/`minusDi` ci-dessus sont les CLOSES `_c1`.
    //   ⇒ on expose les deux lectures CÔTE À CÔTE, même motif que `rsiM15` / `rsiM15Live` : sans ça,
    //   bander la valeur close avec les bornes live mesure une population voisine et fausse.
    //   ⚠ REPLI sur la close quand `_s0` manque (15 % des barres) — un capteur présent sous une
    //   autre forme vaut mieux qu'un capteur muet. `diLiveSrc` dit laquelle a servi.
    ...(() => { const p0 = numStrict(row?.plus_di_h1_s0), m0 = numStrict(row?.minus_di_h1_s0);
                return { plusDiLive: r2(p0 ?? pdi), minusDiLive: r2(m0 ?? mdi),
                         diLiveSrc: (p0 !== null && m0 !== null) ? "s0" : "c1" }; })(),
    // ⭐ LA BANDE DE NIVEAU DE CHAQUE CAMP (09/08) — `diLevelBand` importée du moteur, jamais
    //   recopiée. La fiche portait les VALEURS (`plusDiLive`/`minusDiLive`) mais pas leurs CLASSES :
    //   toute question posée en `EXTREME_HIGH`/`HIGH`/… exigeait de rebander côté stats, avec le
    //   risque de recalibrer par accident (`derived_dataset_computed_3x`).
    // ⚠ LUE SUR LE LIVE, ET SEULEMENT LUI : « ces bornes sont pour la lecture LIVE ; appliquées aux
    //   closes elles déforment dans l'autre sens » (OpportunityDetector). Les DI décroissent de
    //   13,3 % à chaque ouverture de bougie — avec les bornes closes, `EXTREME_HIGH` perdait un
    //   quart de sa population. On bande donc exactement la valeur que `plusDiLive` expose.
    ...(() => { const p0 = numStrict(row?.plus_di_h1_s0), m0 = numStrict(row?.minus_di_h1_s0);
                return { diPlusLevelH1: diLevelBand(p0 ?? pdi), diMinusLevelH1: diLevelBand(m0 ?? mdi) }; })(),
    // ⭐⭐ LA TRANSITION DE LA DYNAMIQUE DE L'ÉCART DI (09/08) — `prev → cur`, deux fenêtres
    //   GLISSANTES d'une barre, exactement comme `kdPrev`/`kdCur` du %K/%D.
    // 🔴🔥 LES DEUX TERMES SONT CLOSE À CLOSE, ET C'EST NON NÉGOCIABLE ICI. `diGapDynH1` juste
    //   au-dessus vaut `live ?? closes` : il MÉLANGE deux horloges, ce qui est le bon choix pour
    //   reproduire ce que le moteur lit, et le pire possible pour une TRANSITION — on comparerait un
    //   état mesuré sur `s0−c1` à un état mesuré sur `c1−c2`. Or les DI perdent 13,3 % à chaque
    //   ouverture de bougie : 9,1 % des bascules de bande se produisent SANS UN SEUL TICK, toutes
    //   vers le centre. Une transition lue à cheval sur les deux horloges verrait donc des
    //   changements d'état qui ne sont que le changement d'heure.
    //   ⇒ `cur` = `(c1,c2)`, `prev` = `(c2,c3)`. Même leçon que `delta_di_decroissance_inerte` :
    //   tout résultat lu sur `s0−c1` est à refaire close à close.
    ...(() => { const p1 = numStrict(row?.plus_di_h1_c1), m1 = numStrict(row?.minus_di_h1_c1);
                const p2 = numStrict(row?.plus_di_h1_c2), m2 = numStrict(row?.minus_di_h1_c2);
                const p3 = numStrict(row?.plus_di_h1_c3), m3 = numStrict(row?.minus_di_h1_c3);
                return { diGapDynCloseH1: diGapDynamics(p1, m1, p2, m2),
                         diGapDynPrevH1:  diGapDynamics(p2, m2, p3, m3) }; })(),
    // ⭐ ORIENTÉ PAR LE SENS DU TRADE — c'est CETTE lecture qui porte le signal, pas la brute.
    //   Le DI a un SENS (contrairement à l'ADX) : un spread qui monte est haussier → bon pour un BUY,
    //   mauvais pour un SELL. Mesurer BUY et SELL ensemble les fait S'ANNULER (mesuré 17/07 : régimes
    //   bruts tous collés à la base ; orientés, TURN_WITH ressort à toutes les bandes).
    //   WITH/AGAINST = installé · TURN_WITH = la pression VIENT DE basculer en sens · TURN_AGAINST = contre.
    spreadRegimeRel: (rs.side === "BUY" || rs.side === "SELL")
      ? relRegime(spr1, spr2, spr3, rs.side === "BUY" ? 1 : -1, SPREAD_BAND) : null,
    // ── RSI (bare = CLOSE ; _s0 = live intra-barre — cf convention de nommage, ne jamais confondre)
    rsiH1: r2(numStrict(row?.rsi_h1)), rsiH4: r2(numStrict(row?.rsi_h4)), rsiM15: r2(numStrict(row?.rsi_m15)),
    // ⭐ `rsiM15Live` — 6ᵉ entrée du barème EXH v1, dictée LIVE (07/08). ⚠ NE PAS confondre avec
    //   `rsiM15` juste à gauche : la nue est la CLÔTURE. Les deux sont exposés côte à côte
    //   EXPRÈS — le barème lit `_s0`, et une fiche qui ne porterait que la clôture ferait mesurer
    //   une population voisine et fausse sans que rien ne le dise.
    rsiM15Live: r2(numStrict(row?.rsi_m15_s0)),
    // ⭐ LE Δ M15 LIVE (09/08) — même paire que sur le H1 : le NIVEAU se lit à la CLÔTURE
    //   (`rsiM15`), la VITESSE en LIVE. Croiser `rsiM15Live` avec ce Δ croiserait une grandeur avec
    //   sa propre composante (`rsi_s0 = rsi_m15 + Δ`) et FABRIQUERAIT les cases rapides.
    // ⚠ `dRsiM15LiveCalc` est un CONTRÔLE, pas un doublon : `drsi_m15_s0` et `rsi_m15_s0 − rsi_m15`
    //   doivent être la MÊME série. Vérifié pour h4 (juillet) et h1 (09/08) ; le M15 jamais.
    dRsiM15Live:     r2(numStrict(row?.drsi_m15_s0)),
    dRsiM15LiveCalc: (numStrict(row?.rsi_m15_s0) != null && numStrict(row?.rsi_m15) != null)
      ? r2(numStrict(row?.rsi_m15_s0) - numStrict(row?.rsi_m15)) : null,
    rsiD1: r2(numStrict(row?.rsi_d1)), dRsiH1: r2(numStrict(row?.drsi_h1)),
    // ⭐⭐ LE H1 EN LIVE, ET SON Δ LIVE (2026-08-09) — la fiche ne portait que la CLÔTURE (`rsiH1`) et
    //   un Δ lui aussi CLÔTURÉ (`dRsiH1` ← `drsi_h1`, forme nue = close). Mesurer « le RSI H1 live au
    //   moment du fade » sur ces deux champs aurait décrit une population voisine et fausse, sans que
    //   rien ne le signale — exactement le motif qui a fait exposer `rsiM15` et `rsiM15Live` côte à
    //   côte juste au-dessus.
    // ⚠ `dRsiH1LiveCalc` EST UN CONTRÔLE, PAS UN DOUBLON : la colonne `drsi_h1_s0` et la différence
    //   `rsi_h1_s0 − rsi_h1` doivent être la MÊME série. La vérification a déjà été faite pour le H4
    //   (écart max 0,010, soit l'arrondi) et JAMAIS pour le H1. Sans elle, on plaquerait un barème
    //   sur un alias — la faute `dslope_h1_s0`. Les deux sont exposés le temps de trancher.
    rsiH1Live:     r2(numStrict(row?.rsi_h1_s0)),
    dRsiH1Live:    r2(numStrict(row?.drsi_h1_s0)),
    dRsiH1LiveCalc: (numStrict(row?.rsi_h1_s0) != null && numStrict(row?.rsi_h1) != null)
      ? r2(numStrict(row?.rsi_h1_s0) - numStrict(row?.rsi_h1)) : null,
    // ── STOCH per-TF : k, d, séparation, et le cross (ÉVÉNEMENT, per-TF — pas un vote)
    kH1: r2(h1.k), dH1: r2(h1.d), kdH1: (h1.k != null && h1.d != null) ? r2(h1.k - h1.d) : null,
    kM15: r2(m15.k), dM15: r2(m15.d), kdM15: (m15.k != null && m15.d != null) ? r2(m15.k - m15.d) : null,
    // ⭐ `zoneM15`/`kdDistM15` — les CLASSES du moteur, importées de `perTf` et non rebandées depuis
    //   `kM15` (arrondi à 2 décimales). Les deux vetos M15 du fade raisonnent sur `zone`, pas sur le
    //   %K brut : sans ces champs, on ne pouvait pas mesurer la population qu'ils gouvernent.
    zoneM15: m15.zone ?? null, kdDistM15: m15.kdDistance ?? null,
    // ── GAP / DIV K/D H1 (spec 2026-07-21) — PHOTO PASSIVE POUR L'ÉTUDE. gap_i=|k−d|_si · div_j=gap_j−gap_{j+1}.
    //   ⚠️ STRICTEMENT diagnostic : n'entre dans AUCUNE décision (l'étude teste s'il DEVRAIT). L'expert
    //   Dynamique produit déjà crossoverState/Maturity/crossAge dans h1.kd ; on les recopie + gap/div bruts.
    ...(() => {
      const kk = [0, 1, 2, 3].map((i) => numStrict(row?.[`stoch_k_h1_s${i}`]));
      const dd = [0, 1, 2, 3].map((i) => numStrict(row?.[`stoch_d_h1_s${i}`]));
      const gp = kk.map((k, i) => (k != null && dd[i] != null) ? Math.abs(k - dd[i]) : null);
      const dv = [0, 1, 2].map((i) => (gp[i] != null && gp[i + 1] != null) ? +(gp[i] - gp[i + 1]).toFixed(2) : null);
      return {
        gap0: r2(gp[0]), gap1: r2(gp[1]), gap2: r2(gp[2]), gap3: r2(gp[3]),
        div0: dv[0], div1: dv[1], div2: dv[2],
        crossState: h1?.kd?.crossoverState ?? null, crossAge: h1?.kd?.crossAge ?? null,
        crossMat: h1?.kd?.crossoverMaturity ?? null, kdSide: h1?.kd?.side ?? null,
        // M15 gap/cross (photo passive, étude cross M15 → CONT) : crossAge M15 sur fenêtre s0..s3, g0 = K−D M15.
        ...(() => {
          const mk = [0, 1, 2, 3].map((i) => numStrict(row?.[`stoch_k_m15_s${i}`]));
          const md = [0, 1, 2, 3].map((i) => numStrict(row?.[`stoch_d_m15_s${i}`]));
          const mg = mk.map((k, i) => (k != null && md[i] != null) ? k - md[i] : null);
          // crossAge = fenêtre s0..s3 (change de signe) — exige les 4.
          let ca = null; if (mg.every((x) => x != null)) for (let i = 0; i < 3; i++) if (mg[i] * mg[i + 1] < 0) { ca = i; break; }
          // pincement K−D M15 (|K−D| monotone décroissant s2→s1→s0) = EXACTEMENT ce que lit le gate cont-kd-pinch
          //   (moteur : m15KdSeq = [s0,s1,s2]) → n'utilise que s0,s1,s2, indépendant de s3.
          const s3ok = mg[0] != null && mg[1] != null && mg[2] != null;
          const tight = s3ok ? (Math.abs(mg[0]) < Math.abs(mg[1]) && Math.abs(mg[1]) < Math.abs(mg[2])) : null;
          return { m15CrossAge: ca, m15KD: mg[0] != null ? +mg[0].toFixed(2) : null,
            m15Kd1: mg[1] != null ? +mg[1].toFixed(2) : null, m15Kd2: mg[2] != null ? +mg[2].toFixed(2) : null, m15Pinch: tight };
        })(),
      };
    })(),
    // ⛔ `crossDeepH1` RETIRÉ le 2026-07-27 : le champ était ÉCRIT dans chaque fiche de trade et
    //   AUCUN filtre, aucune stat ne l'interrogeait — le capteur a été supprimé du moteur.
    // ⚠ `kH1`/`dH1` EXPOSÉS (01/08) : `crossFreshH1` dit qu'un croisement vient d'avoir lieu, JAMAIS
    //   dans quel sens — c'est le même angle mort que `crossAgainst` documente dans `vetoGate`. Le
    //   signe de K−D en live le donne : cross frais + K>D ⇒ croisement HAUSSIER.
    kH1: r2(h1.k), dH1: r2(h1.d),
    // ⚠ LE H4 EN TROIS MOTS (01/08) — zone, état du cycle K/D, vitesse signée de %K. La fiche portait
    //   la géométrie H1 complète et RIEN du H4 en dehors de `kdH4`, alors que les deux thèses lisent
    //   les quatre TF. Toute question croisant un profil H4 était donc inrépondable sans rejouer.
    zoneH4: h4.zone ?? null, kdCycleH4: h4.kdCycle ?? null, dKBandH4: h4.dKBand ?? null,
    // ⭐ LA TRANSITION H4, PAS SEULEMENT L'ÉTAT (07/08). `kdCycleH4` seul ne dit pas d'où l'on
    //   vient ; or le barème K/D raisonne en `prev→cur` depuis toujours. Sans ce champ, une question
    //   du type « H4 DIVERGING→DIVERGING » était inrépondable sans rejouer le moteur.
    kdCyclePrevH4: h4.kdCyclePrev ?? null,
    // ⭐ `kdDistH4` — LA BANDE DE MAGNITUDE |K−D| DU H4 (CONTACT/LOW/MEDIUM/HIGH/EXTREME). Ajoutée
    //   le 07/08 : le veto `h4-kd-mid-gap` tient en UNE ligne (`kdDist === "MEDIUM"`) et refuse
    //   9 830 barres — impossible de mesurer ce qu'il retire sans ce champ.
    // ⚠ IMPORTÉE de `perTf`, jamais recalculée depuis `kH4 − dH4` : les deux sont arrondis à 2
    //   décimales sur la fiche, et rebander un arrondi ferait basculer les barres de frontière.
    kdDistH4: h4.kdDistance ?? null,
    // ⭐ `kdGapH4` — L'ÉCART **SIGNÉ** K−D du H4, même motif que `kdGapH1` : `kH4` et `dH4` sont
    //   ARRONDIS à 2 décimales sur la fiche, donc leur différence recalculée peut CHANGER DE SIGNE
    //   près de zéro — et le signe est précisément ce qu'on veut lire. Calculé sur les valeurs nues.
    kdGapH4: (h4.k == null || h4.d == null) ? null : r2(h4.k - h4.d),
    // ⚠ %K et %D H4 EN LIVE — `kdCycleH4` dit DIVERGING/STABLE, qui décrivent l'ÉCART sans son
    //   signe. Le signe de K−D est la seule façon de savoir de quel côté les lignes sont.
    kH4: r2(h4.k), dH4: r2(h4.d),
    // ⚠ LE D1 EST CALCULÉ ICI ET NULLE PART AILLEURS, et c'est une exception à justifier :
    //   `dynamicsGate` ne boucle que sur h1/h4/m15, le moteur n'a donc AUCUN `perTf.d1`. On ne
    //   réimplémente pas les classificateurs pour autant — `deltaKBand` et `stochZone` sont IMPORTÉS
    //   du moteur (la faute `derived_dataset_computed_3x` serait de les recopier ici avec leurs
    //   coupures). Seule la lecture des colonnes est locale.
    //   🔴 À SAVOIR AVANT DE LIRE CES DEUX CHAMPS : `DELTA_K_BANDS` ([4,4 · 13 · 21] points de %K)
    //   est calibré sur les TF intraday. Une bougie D1 déplace %K bien davantage, donc les bandes
    //   `_UP`/`_DOWN` y sont mécaniquement plus peuplées aux extrêmes. Comparable d'un jour à
    //   l'autre, PAS comparable barreau pour barreau avec le H4.
    // ⚠ `drsi_h4_s0` = la VARIATION du RSI H4 en LIVE (s0), pas son niveau. Le niveau `rsi_h4_s0`
    //   est déjà lisible par ailleurs ; c'est la dérivée qui manquait. ⚠ Contrairement au %K, le RSI
    //   n'est pas borné de la même façon et sa variation n'a AUCUNE bande calibrée dans le moteur —
    //   on sort donc la valeur BRUTE, et c'est à la mesure de choisir ses coupures. Ne pas inventer
    //   un bandage ici : ce serait un classificateur de plus, hors de tout contrôle d'invariant.
    drsiH4S0: r2(numStrict(row?.drsi_h4_s0)), drsiH4: r2(numStrict(row?.drsi_h4)),
    rsiH4S0:  r2(numStrict(row?.rsi_h4_s0)),
    // ⚠ LE ZSCORE D1 LIVE — `zscore_d1` (fermé) N'EXISTE PAS dans le dataset, seul `_s0` est
    //   exporté. Il n'y a donc pas de couple fermé/live sur le journalier, contrairement au H1
    //   et au H4 : toute lecture du z D1 est intra-journée, et une journée dure 24 h.
    zscoreD1S0: r2(numStrict(row?.zscore_d1_s0)),
    zoneD1: stochZone(numStrict(row?.stoch_k_d1_s0)),
    dKBandD1: (() => { const a = numStrict(row?.stoch_k_d1_s0), b = numStrict(row?.stoch_k_d1_s1);
                       return (a == null || b == null) ? null : deltaKBand(+(a - b).toFixed(2)); })(),
    // ⭐ `dKBandH1`/`kdCycleH1` AJOUTES (06/08) — le H4 les portait deja (l.211), le H1 non : on ne
    //   pouvait pas decouper une population H1 par vitesse de %K sans les redériver cote stats, ce
    //   qui aurait ete `derived_dataset_computed_3x`. Ils viennent du MEME `perTf` que le H4.
    zoneH1: h1.zone ?? null, crossFreshH1: h1.crossFresh === true,
    dKBandH1: h1.dKBand ?? null, kdCycleH1: h1.kdCycle ?? null, dKH1: h1.dK ?? null,
    // ⭐⭐⭐ LE %K H1 À LA CLÔTURE (`_s1`) ET SA ZONE — owner 09/08 : « mettre le sélecteur sur
    //   kH1s1 extrême et le deltakH1 live ».
    // 🔴🔥 CE N'EST PAS UN CHOIX DE FRAÎCHEUR, C'EST UNE DÉCOMPOSITION. `zoneH1` juste au-dessus est
    //   lue sur `k(s0)` et `dKBandH1` vaut `k(s0) − k(s1)` : les deux axes PARTAGENT un terme —
    //   `k(s0) = k(s1) + ΔK`. Croiser NIVEAU × VITESSE dans ces conditions, c'est croiser une
    //   grandeur avec une de ses propres composantes : un gros ΔK positif POUSSE mécaniquement le
    //   niveau dans l'extrême, donc la case « extrême ET s'empire » est en partie fabriquée par
    //   l'algèbre. Ce n'est pas une corrélation qu'on pourrait mesurer et accepter, c'est une
    //   IDENTITÉ. ⭐ Exactement la faute corrigée le 29/07 sur le zscore (`zClosed` + `dZ` au lieu
    //   de `z_s0` + `dZ`), et le motif est écrit noir sur blanc dans `scoringInputs`.
    //   ⇒ `k(s1)` = ce qui est ÉTABLI · `ΔK live` = ce qui se passe MAINTENANT. Aucun terme commun.
    // ⚠ `stochZone` est IMPORTÉE du moteur, jamais recopiée — mêmes coupes 12/38/62/88.
    kH1S1: r2(numStrict(row?.stoch_k_h1_s1)),
    zoneH1S1: stochZone(numStrict(row?.stoch_k_h1_s1)),
    // ⚠ LE H4 AUSSI, ET CE N'EST PAS UN AJOUT DE CONFORT : `zoneH4` porte EXACTEMENT le même terme
    //   partagé avec `dKBandH4`. Ne corriger que le H1 aurait laissé un tableau contaminé à côté
    //   d'un tableau propre, dans la même sortie — la pire des deux situations, parce que la
    //   comparaison entre TF aurait paru légitime.
    kH4S1: r2(numStrict(row?.stoch_k_h4_s1)),
    zoneH4S1: stochZone(numStrict(row?.stoch_k_h4_s1)),
    // ⭐ LE %D À LA CLÔTURE (09/08) — la fiche portait `dH1`/`dH4` en LIVE et RIEN à la clôture,
    //   alors qu'elle porte les DEUX pour le %K depuis ce matin. Toute question sur un NIVEAU de
    //   %D était donc inrépondable dans la seule colonne où le niveau est ÉTABLI.
    // ⚠ Pas de `zone…` ici : `stochZone` a été calibrée sur le %K (coupes 12/38/62/88) et le %D est
    //   sa MOYENNE MOBILE — il n'atteint pas les mêmes extrêmes. Bander le %D avec les coupes du %K
    //   fabriquerait des classes vides et un faux « il ne sature jamais ». Le niveau brut, et les
    //   coupes se décident sur la mesure.
    dH1S1: r2(numStrict(row?.stoch_d_h1_s1)),
    dH4S1: r2(numStrict(row?.stoch_d_h4_s1)),
    // ⭐⭐ Δ%D LIVE = `D(s0) − D(s1)` — LA VITESSE, pour aller avec le NIVEAU CLÔTURÉ juste au-dessus.
    //   Même décomposition que `kH1S1` + `dKH1` : le niveau est ce qui est ÉTABLI, le Δ est ce qui se
    //   passe MAINTENANT, et les deux ne PARTAGENT AUCUN TERME. Lire le niveau en live reviendrait à
    //   croiser `D(s1) + ΔD` avec `ΔD` — une identité, pas une corrélation.
    // 🔴🔥 CALCULÉ SUR LES VALEURS NON ARRONDIES, et c'est le point : `dH1`/`dH1S1` sont arrondis à 2
    //   décimales, or ici on ne lit que le SIGNE. Une différence de quelques centièmes CHANGE DE SIGNE
    //   à l'arrondi, exactement dans la zone où le %D fait son sommet — c'est-à-dire précisément la
    //   population que la question vise. Même motif que `kdGapH1`, même raison que
    //   `derived_dataset_computed_3x` : un dérivé se calcule UNE fois, à la source.
    ...(() => {
      const dd1 = (tf) => {
        const a = numStrict(row?.[`stoch_d_${tf}_s0`]), b = numStrict(row?.[`stoch_d_${tf}_s1`]);
        return (a == null || b == null) ? null : r2(a - b);
      };
      return { dDH1: dd1("h1"), dDH4: dd1("h4") };
    })(),
    // ⭐ `kdGapH1` AJOUTE (07/08, protocole V3) — l'ECART SIGNE `K−D` en LIVE, sur le H1. La fiche
    //   portait `kH1` et `dH1` mais PAS leur difference, et c'est un piege : tous deux sont
    //   ARRONDIS A 2 DECIMALES, donc `kH1 - dH1` recalcule cote stats peut CHANGER DE SIGNE quand
    //   l'ecart vaut quelques centiemes — precisement la zone ou le signe decide de tout (c'est le
    //   sens du fade). On sort donc la difference calculee sur les valeurs NON arrondies.
    //   ⚠ Meme raison que `derived_dataset_computed_3x` : un derive se calcule UNE fois, a la
    //   source, jamais chez trois lecteurs.
    kdGapH1: (h1.k == null || h1.d == null) ? null : r2(h1.k - h1.d),
    // ⭐ L'ÉCART PRIX ↔ MOYENNE, LES DEUX INSTANTS. `gapAtrClose` est celui que `gapExhScore` LIT
    //   (refonte du 29/07 : le niveau se lit à la CLÔTURE, la vitesse en live) ; `gapAtr` est le live,
    //   exposé à côté pour qu'on puisse mesurer l'écart entre les deux au lieu de le supposer.
    // ⚠ `gapLevelClose` est la BANDE calibrée PAR ACTIF — ne jamais rebander `gapAtr` avec un seuil
    //   universel : la mesure du 02/08 donne un facteur 21 entre actifs sur cette grandeur.
    // ⚠ `row` ET `row.symbol` — pas `rows[i]` ni `asset` : on est dans `fireSnapshot(row, det, obs)`,
    //   qui ne voit ni la boucle ni le scope de `runMatrixBacktest`. Mon premier jet a écrit les deux
    //   noms du CONTEXTE APPELANT et la fonction a levé `rows is not defined` à la première barre.
    ...(() => { const d = computeDeviation(row, String(row?.symbol || ""), "h1");
                // ⭐ `gapSlope`/`gapSlopeBand` — la VITESSE de l'écart, |Δ| par barre H1, bandes
                //   calibrées PAR ACTIF (cuts p30/p70/p90 de `dGap`). Le NIVEAU dit où le prix est,
                //   la PENTE dit s'il s'y enfonce ou s'il en revient : deux questions distinctes,
                //   séparées dans le moteur depuis la refonte du 29/07.
                // ⭐ `gapLevelLive` — 1ʳᵉ entrée du barème EXH v1, dictée LIVE (07/08). C'est
                //   `d.level`, calculé par `computeDeviation` sur le gap LIVE avec les MÊMES coupes
                //   par actif que `levelClose`. ⚠⚠ Ces coupes ont été calibrées pour reproduire la
                //   population de `|zscore_h1|` **à la CLÔTURE** : les lire en live garde la métrique
                //   et l'échelle, mais DÉCALE la population des bandes. Tension assumée, à
                //   re-mesurer le jour où le `gap` se recalibre — jamais à « corriger » ici.
                return d ? { gapAtr: r2(d.gapAtr), gapAtrClose: r2(d.gapAtrClose), gapLevelClose: d.levelClose ?? null,
                             gapLevelLive: d.level ?? null,
                             gapSlope: d.gapSlope == null ? null : r2(d.gapSlope), gapSlopeBand: d.gapSlopeBand ?? null }
                         : { gapAtr: null, gapAtrClose: null, gapLevelClose: null, gapLevelLive: null,
                             gapSlope: null, gapSlopeBand: null }; })(),
    crossFreshM15: m15.crossFresh === true,
    // 🔴 `kdH4` ÉTAIT MORT (2026-08-05) : il lisait `h4.kd`, que `dynamicsGate` ne produit pas — le
    //   champ était écrit dans CHAQUE fiche de trade et valait `null` sur toutes. Il n'a jamais levé
    //   d'erreur parce qu'une propriété absente est `undefined`, et `r2(undefined)` rend `null` :
    //   exactement un capteur qui a l'air d'exister. Dérivé comme `kdM15` deux lignes plus haut, à
    //   partir des deux valeurs qui, elles, sont bien là.
    kdH4: (h4.k != null && h4.d != null) ? r2(h4.k - h4.d) : null,
    separation: r2(st.separation), dLevel: r2(st.dLevel),
    // ── ENERGY / MATURITY
    bbwH1: r2(e?.perTf?.h1?.bbw), bbwM15: r2(e?.perTf?.m15?.bbw), bbwDynH1: e?.perTf?.h1?.dyn ?? null,
    tick: r2(e.tick), energyScore: r2(e.score), maturityScore: r2(m.score), maturityState: m.state ?? null,
    // ── CONTEXTE brut
    // ⚠ LES DEUX LECTURES DU MÊME z, ET C'EST VOULU (2026-08-01) : `zscore_h1` est la bougie FERMÉE
    //   (le `s1` du ZScore Expert v3), `zscore_h1_s0` est le LIVE intra-barre — celui qui existe à
    //   l'instant du tir. Sans les deux, on ne peut pas dire si une barre est « autour de la moyenne »
    //   MAINTENANT ou si elle y est DEPUIS UNE HEURE, et c'est exactement ce que sépare la mesure de
    //   la population « pile ou face ». Cf. `scan_field_naming_convention_audit` : bare = CLOSE.
    zscoreH1: r2(numStrict(row?.zscore_h1)), zscoreH1S0: r2(numStrict(row?.zscore_h1_s0)),
    // ⭐ `dzH1Col` — LA COLONNE BRUTE `dz_h1` DU CSV, PORTEE POUR QU'ON PUISSE LA DISTINGUER DU `dZ`
    //   DU MOTEUR (20/08). Ce ne sont PAS la meme grandeur : `scoringInputs` construit
    //   `dZ = zscore_h1_s0 − zscore_h1` (live moins cloture), le CSV expose en plus une colonne
    //   `dz_h1` calculee par l'EA. Mesure du 20/08 sur `US_TECH100 2026.07.30 16:31` : le `dZ` du
    //   moteur vaut **−0,11** quand la colonne vaut **+0,01** — elles ont des SIGNES OPPOSES sur la
    //   meme barre. Une sonde qui lit « dz » sans dire LAQUELLE mesure autre chose que ce qu'elle croit.
    // ⚠ STRICTEMENT PASSIF, comme tout `fireSnapshot` : diagnostic, aucune influence sur la decision.
    dzH1Col: r2(numStrict(row?.dz_h1)),
    // ⚠ H4 AJOUTÉ (01/08) — même couple fermé/live. ⚠ Sur H4 le `s0` vit jusqu'à QUATRE HEURES : la
    //   distance entre `zscore_h4_s0` et `zscore_h4` n'a pas le même sens qu'en H1, où elle vaut au
    //   plus une heure. Ne pas lire les deux colonnes comme si elles étaient l'analogue exact du H1.
    zscoreH4: r2(numStrict(row?.zscore_h4)), zscoreH4S0: r2(numStrict(row?.zscore_h4_s0)),
    wrH1: r2(numStrict(row?.wr_h1)),
    slopeD1: r2(numStrict(row?.slope_d1)), intradayChange: r2(numStrict(row?.intraday_change)),
    spread: r2(numStrict(row?.spread)),
  };
}
// ⛔ TABLE LOCALE REMPLACÉE (phase C « trois modes », 05/08). Elle était la CINQUIÈME écriture du
//   nom d'un mode — quatre vivaient côté moteur (supprimées en phase B au profit de `MODES`), et
//   celle-ci, dans un AUTRE DÉPÔT, dupliquait la même vérité sans que rien ne les relie.
// ⭐⭐ C'est le cas le plus dangereux des cinq, et l'ajout du rang ② l'a prouvé : `STRAT[sel.strategy]`
//   sur un `PB` rendait `undefined`, le `?? sel.strategy` retombait sur la chaîne `"PB"`, et le
//   backtest tradait donc un type `"PB"` que rien en aval ne connaît — SANS ERREUR. Un pullback
//   aurait été mesuré sous une étiquette inexistante.
//   ⚠ `RANGE` y traînait encore, alors que le moteur ne produit plus ce mode depuis le 13/07.
// ⇒ On lit désormais la table du MOTEUR. Un mode ajouté là-bas est connu ici sans rien toucher.
import { MODES, MODE_ORDER, modeOf } from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/modes.js";
import { SILENCE_COUNTS, SILENCE_PENALTY } from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js";
// ⭐⭐⭐ LA RÉSOLUTION DU JEU D'EXPERTS PAR RANG — UN SEUL ENDROIT (2026-08-05).
// Deux défauts d'affichage, tous deux SILENCIEUX, vivaient dans le même geste recopié :
//   ① `Object.entries(g.exhExperts)` traitait `exhExperts` comme une map PLATE `{id → {global}}`.
//      Elle porte `exh.expertsBySide`, donc `{BUY:{…}, SELL:{…}}` ⇒ l'écran rendait littéralement
//      deux lignes nommées `BUY` et `SELL`, toutes deux « muet ». Les six experts du fade
//      n'étaient JAMAIS visibles — et c'est l'écran qu'il faut pour juger le fade.
//   ② `sel.strategy === "EXH" ? exhExperts : contExperts` ne connaissait que deux rangs. `PB`
//      tombait dans le `else` et recevait les experts de la CONTINUATION, alors que le pullback est
//      scoré par ceux du FADE (`sExhBySide[+regDir]`, même barème, autre côté). L'écran affichait
//      des chiffres SANS LIEN avec la décision montrée à côté.
// ⭐ Troisième et quatrième occurrence du même motif dans ce fichier (après `STRAT[...]` et le
//   ternaire des seuils) : **un ternaire ne peut pas avoir trois issues, et il n'échoue pas quand on
//   lui en demande une troisième — il en rend une fausse.** D'où une TABLE, et une seule.
// ⚠ Le côté vient de `g.exhSide`, que la trace porte déjà : c'est le côté RÉELLEMENT scoré par le
//   rang (`SIDE_EXH` pour ①, `SIDE_PRO` pour ②). Ne pas le redéduire du signe du score — il en est
//   indépendant depuis que le profil donne le côté.
// ⛔🔴 SEUL LE RANG ③ A ENCORE DES EXPERTS (11/08). `exhaustionScorer` a été SUPPRIMÉ — les rangs ①
//   et ② sont des BARÈMES À SOMME, et leur décomposition voyage dans `sc.boxes.{exh,pb}.parts`, pas
//   dans un bundle d'experts avec `perTf`/`global`.
// ⚠⚠ POURQUOI ON NE SE CONTENTE PAS DE RENDRE `{}` : le code d'avant faisait `(g.exhExperts ?? {})`,
//   donc il RETOMBAIT SILENCIEUSEMENT sur un objet vide le jour où le champ disparaît. Les colonnes
//   d'experts des tirs EXH/PB se seraient vidées sans un mot — « une valeur plausible et fausse »,
//   le motif que ce dépôt paie le plus cher. On rend `null` et on le NOMME.
// ⭐ `null` ≠ `{}` : le premier dit « ce rang n'a pas d'experts, par construction », le second « il en
//   a, mais aucun n'a parlé ». Les lecteurs en aval doivent pouvoir distinguer les deux.
const EXPERTS_OF = { CONT: "cont" };

function expertsFor(g, strategy) {
  if (!g || EXPERTS_OF[strategy] !== "cont") return null;   // ① et ② : barèmes, pas d'experts
  const out = {};
  for (const [id, e] of Object.entries(g.contExperts ?? {})) out[id] = e?.global ?? null;
  return out;
}

// ⭐⭐⭐ LE PAYLOAD DE SCORING, UNE SEULE FOIS (2026-08-05) — il était inline dans la construction
//   des TIRS, donc structurellement indisponible aux DROP. Or la population des refus est la SEULE
//   non biaisée pour juger un expert ou un veto : la garder aveugle revenait à produire
//   l'information (c'est tout l'objet du retrait du pré-gate) puis à la jeter à l'affichage.
// ⚠ `sel` peut être une sélection de DROP : aucun champ tradé n'est lu ici.
//
// 🔴🔥 LE MODE SE LIT SUR `strategy` **PUIS** SUR `rank` (2026-08-05) — ET C'EST LA CORRECTION QUI
//   REND LES REFUS LISIBLES. `drop()` pose `strategy: null` (scoringDecision.js), donc
//   `EXPERTS_OF[null] ?? "cont"` servait le panel de la CONTINUATION à TOUS les drops — y compris à
//   ceux que le rang ① venait de refuser. Mesuré avant correctif : **3 332 drops de rang `EXH`
//   affichaient `energy` (expert retiré du fade le 03/08) et AUCUN n'affichait `slope`.** L'écran
//   montrait donc cinq nombres qui n'avaient aucun rapport avec la décision affichée à côté.
// ⭐⭐ ET LE SYMPTÔME ÉTAIT DANS LE MÊME OBJET, VISIBLE, SANS QUE ÇA SUFFISE : `expFamily` se
//   terminait par `?? null` et annonçait donc « famille inconnue », pendant que `expertsFor` se
//   terminait par `?? "cont"` et servait la continuation. **Deux replis pour une même question, l'un
//   qui se déclare et l'autre qui se tait** — et c'est celui qui se tait qui remplissait le tableau.
//   ⇒ D'où UNE seule résolution, ici, lue par les trois champs. Le motif est celui du fichier :
//   tant qu'il y a deux sites, ils divergent, et le fail-open rend l'écart muet.
// ⚠ `rank` est TOUJOURS renseigné dès qu'un rang a été atteint (`enter()` en couche 3), sur les
//   refus comme sur les tirs. Il reste `null` sur les refus ANTÉRIEURS au routage (`unevaluable`,
//   `no-regime`) — et là `?? "cont"` reprend la main, ce qui est correct : aucun rang n'a scoré.
function scoringPayload(g, sel) {
  if (!g) return null;
  const mode = sel?.strategy ?? sel?.rank ?? null;
  const exp = expertsFor(g, mode);
      // ⭐🔥 LE SCORE BRUT ET LE BONUS, SÉPARÉS (2026-07-31). `cont`/`exh` sont les scores BONIFIÉS —
      //   ceux qui décident. Sans `contRaw`/`exhRaw` et le détail des règles qui ont poussé, un
      //   `exh = +8` venu d'un accord des six experts est indiscernable d'un `−1,8` retourné par un
      //   bonus. La trace doit permettre de REFAIRE LA SOUSTRACTION ; le moteur les expose depuis
      //   le 29/07, ce fichier ne les recopiait simplement pas.
      return { cont: g.cont ?? null, exh: g.exh ?? null, exp,
        contRaw: g.contRaw ?? null, contBonus: g.contBonus ?? 0, contBonusHits: g.contBonusHits ?? [],
        exhRaw: g.exhRaw ?? null, exhBonus: g.exhBonus ?? 0, exhBonusHits: g.exhBonusHits ?? [],
        // ⭐ PHASE C — LE SEUIL DU RANG QUI A DÉCIDÉ, ET IL Y EN A TROIS. Le ternaire précédent
        //   n'en connaissait que deux : un PULLBACK y recevait `MIN_CONT` (0,1) alors qu'il est
        //   jugé à `MIN_PB` (2,2). La trace aurait affiché un score largement au-dessus de son
        //   seuil pour une barre qui n'a pas tiré — la lecture de la trace elle-même aurait menti.
        // ⚠ `?? null` et pas de repli sur `MIN_CONT` : un rang inconnu doit produire un trou
        //   visible dans la trace, pas un seuil plausible et faux.
        min: MIN_BY_MODE[sel?.strategy] ?? null,
        // ⭐ LES RANGS TRAVERSÉS, remontés du moteur (phase A). C'est la paire qui distingue
        //   « rang jamais atteint » (= non câblé) de « rang atteint et refusé » (= sévère).
        rank: sel.rank ?? null, ranks: sel.ranks ?? [],
        // ⭐⭐⭐ `boxes` — LE VERDICT PARALLÈLE PAR BOÎTE (chantier PULLBACK, point 5 du 10/08).
        // 🔴 CETTE LIGNE N'EST PAS UNE FORMALITÉ : `scoringPayload` est une WHITELIST. Le moteur peut
        //   parfaitement produire `boxes` sans qu'il atteigne jamais la fiche, et une sonde écrite en
        //   aval rendrait alors `null` partout — elle se lirait « aucune row n'a de verdict de boîte »
        //   au lieu de « le champ n'est pas recopié ». C'est le motif `toprows`, et il coûte deux
        //   endroits à chaque fois. ⚠ Il en reste un TROISIÈME non fait, et c'est délibéré : la
        //   whitelist de `server.js` (UI). Hors périmètre des mesures 2-3-4, à faire si l'UI en a besoin.
        // ⚠ Vient de `sel` (posé par `tag`), PAS de `g` (la trace de scoring) — ce sont deux objets.
        boxes: sel.boxes ?? null,
        regDir: g.regDir ?? null,
        pbConviction: g.pbConviction ?? null, pbYieldedBy: g.pbYieldedBy ?? null,
        exhYieldedBy: g.yieldedBy ?? null,
        // ⭐ LE CÔTÉ RÉELLEMENT SCORÉ PAR LE RANG, et le nom de la famille d'experts affichée.
        //   Sans eux, `exp` est un tableau de six nombres dont on ignore à quoi ils se rapportent —
        //   et c'est précisément l'ambiguïté qui rendait le défaut ② invisible.
        // ⚠ LE CÔTÉ DÉPEND DE LA FAMILLE, et le confondre remet exactement le défaut qu'on vient
        //   de corriger, d'un cran plus bas. `g.exhSide` est le côté du FADE : il vaut `SIDE_EXH`
        //   pour le rang ①, `SIDE_PRO` pour le rang ② — mais sur une trace de CONTINUATION il
        //   porte encore le côté du fade CÉDÉ, donc l'inverse du trade. Mesuré : `regDir = −1`,
        //   trade SELL, `exhSide = BUY` ⇒ l'en-tête aurait annoncé « côté BUY » sur un SELL.
        //   Pour la continuation, le côté se dérive du régime — c'est sa définition depuis que le
        //   profil donne le côté : `SIDE_PRO = regDir > 0 ? BUY : SELL`.
        // ⚠ `mode` ET NON `sel.strategy` : ces deux champs DÉCRIVENT `exp`, ils doivent donc être
        //   résolus par la même clé que lui. Les laisser sur `strategy` remettrait le défaut d'un
        //   cran plus bas — un panel de fade coiffé d'un en-tête « famille cont ».
        expSide: (EXPERTS_OF[mode] === "cont")
                   ? (g.regDir == null ? null : (g.regDir > 0 ? "BUY" : "SELL"))
                   : (g.exhSide ?? null),
        expFamily: EXPERTS_OF[mode] ?? null,
        // ── LE CONTEXTE SANS LEQUEL UN SCORE N'EST PAS INTERPRÉTABLE ────────────────────────
        // ⭐ `MIN_PRES` : le rang ① a DEUX seuils, pas un. Sous `MIN_PRES` il se DÉSISTE (la main
        //   passe) ; entre `MIN_PRES` et `MIN_EXH` il **DROP** — « épuisement PRÉSENT mais faible ».
        //   Cette bande est une CONTRAINTE DE RISQUE assumée (la rendre à la continuation doublait
        //   le maxDD, 39,4 → 79,5), et elle était invisible : on voyait le seuil de tir, jamais la
        //   frontière qui sépare un DROP d'un repli.
        minPres: MIN_PRES,
        // ⭐⭐ LE RÉGIME DE SILENCE. Un score de 2,1 ne veut PAS dire la même chose selon la façon
        //   dont les experts muets ont été traités — et les trois régimes déplacent le volume de
        //   100 % à 36 %. Sans cette ligne, deux runs incomparables se lisent pareil.
        //       amplifie : le muet est RETIRÉ du dénominateur (il fait parler les autres plus fort)
        //       dilue    : il pèse, sans s'opposer
        //       pénalise : il s'oppose au côté soumis
        silence: !SILENCE_COUNTS ? "amplifie" : (SILENCE_PENALTY.EXH ? `pénalise ${SILENCE_PENALTY.EXH}` : "dilue") };
}


const STRAT = Object.fromEntries(MODE_ORDER.map((c) => [c, MODES[c].type]));

// Copie du switch AssetEligibility.resolveMarket (celui-ci importe "./GlobalMarketHours" SANS extension →
// KO sous Node ESM ; le mapping est stable/documenté). assetclass → clé GlobalMarketHours.
function resolveMarket(assetclass) {
  switch (String(assetclass ?? "").toUpperCase()) {
    case "FX":      return "FX";
    case "INDEX":   return "INDEX";
    case "CRYPTO":  return "CRYPTO";
    case "METAL":   return "METAL";
    case "ENERGY":  return "ENERGY";
    case "OIL_GAS": return "ENERGY";
    case "GAS":     return "ENERGY";
    case "AGRI":    return "AGRI";
    case "SOFT":    return "AGRI";
    default:        return null;
  }
}

// ── ADMISSION — réplique les gates que le LIVE applique EN AMONT du moteur (AssetEligibility, couche 0).
//    Sans eux le backtest fire là où la prod aurait rejeté → mesure fausse.
//
//    ⚠ SIMPLIFICATION owner 2026-07-16 : l'Admission ne garde que DEUX filtres réglables — `hours` et
//    `tick_low`. `tick_burst` et le bloc ATR M1 (`atr_low` + `atr_high`) ont été SUPPRIMÉS du live
//    (mesurés quasi inertes : burst 89 barres / atr_high 7 sur l'univers, 0 et 0 en live) → plus rien à
//    répliquer ici. L'antispike sera REFAIT en gate ratio/ÉVÉNEMENT (s0/s1, calibration Iran 2026-05-21) ;
//    tous les champs nécessaires sont déjà dans data/matrix.
//
//    NON répliqué, volontairement : Weekend — les barres de l'archive sont déjà en séance ouvrable.
//
// 🔴🔥 LA WHITELIST, ELLE, MANQUAIT — ET LE COMMENTAIRE QUI L'EXCUSAIT ÉTAIT FAUX (corrigé 02/08).
//    Il disait « les barres de l'archive sont déjà sur des actifs tradés ». Or `data/matrix` contient
//    les 19 actifs d'`ALLOWED_SYMBOLS`, dont trois absents de `TRADABLE_SYMBOLS`. Le backtest tradait
//    donc COCOA, GASOLINE et USDCAD — **2 002 trades, 15 % du livre**, sur des actifs que la prod
//    refuse en couche 0. Et ils notaient MIEUX que les tradables (R/tr 0,0852 contre 0,0614) : la
//    mesure était gonflée par ce que la production ne prend pas.
//    ⭐⭐ UNE EXCLUSION ÉCRITE DANS UN COMMENTAIRE N'EST PAS UNE EXCLUSION. Même famille que les
//    invariants jamais appelés et que `dslope_h1_s0` aliasé : le fichier affirmait un fait au lieu
//    de le faire tenir par du code.
//    ⭐ `TRADABLE_SYMBOLS` est IMPORTÉE et non recopiée — une quatrième copie de liste dans ce
//    fichier (il en porte déjà pour l'admission) aurait divergé au premier changement.
/**
 * @param {boolean} useSpreadCap  ⚠ `false` DÉSACTIVE le cap de spread, et ça ne sert QU'À LE
 *   RECALIBRER : le sweep de `_spread_cap.mjs` doit voir la population NON coupée pour recalculer
 *   des percentiles, sinon il mesurerait des seuils sur les barres que le seuil actuel a déjà
 *   retirées — et convergerait vers un cap toujours plus serré, tour après tour. Ce n'est pas une
 *   option de mesure ordinaire : un run à `false` ne représente plus la prod.
 */
export function admissionBlock(row, asset, useSpreadCap = true) {
  // Gate 0 — l'actif est-il seulement tradable ? C'est le premier refus d'`AssetEligibility`.
  if (!TRADABLE_SYMBOLS.includes(asset)) return "not_tradable";
  // Gate 1 — heures de marché (UTC, comme GlobalMarketHours.getHour)
  const market = resolveMarket(row?.assetclass);
  const now = new Date(row?.ts_utc ?? row?.timestamp);
  if (!Number.isNaN(now.getTime())) {
    const h = GlobalMarketHours.check(market, now, asset);
    // ⚠ DEUX LABELS, PAS UN. La coupure du vendredi 17h UTC passe par le même `allowed:false` que les
    //   horaires de marché ; la ranger sous `hours` la rendrait invisible dans le funnel — on ne
    //   saurait jamais combien de barres elle retire. Le funnel compte par label et accepte une clé
    //   nouvelle (`adm[blk] = (adm[blk] ?? 0) + 1`), donc la ligne apparaît toute seule.
    if (h?.weekEnd === true) return "friday_cutoff";
    if (h && h.allowed === false) return "hours";
  }
  // Gate 3 — tick low (marché mort ; ⟺ Energy DEAD). null = passthrough safe.
  // 🔴 2026-08-02 : SUIT LA CORRECTION D'ÉCHELLE DU LIVE — `getMeanTick5sBaseline` (percentiles de
  //   la MOYENNE) au lieu de `tf_5s` (percentiles de ticks INDIVIDUELS), seuil `MEANT5_DEAD_PCT`.
  // ⚠⚠ CE GATE EST UNE COPIE DE CELUI D'`AssetEligibility`, pas un import — c'est le motif
  //   `derived_dataset_computed_3x`. Il a fallu le corriger SÉPARÉMENT : la première mesure post-fix
  //   est sortie IDENTIQUE au chiffre près parce que le live était corrigé et pas cette copie, qui
  //   bloquait toujours en amont les barres que le nouveau seuil devait laisser passer.
  //   🎯 Tant qu'elle reste une copie, toute modification du gate live doit être répercutée ICI.
  const mean5s = computeMeanTick5s(row);
  if (mean5s !== null) {
    const p20 = getMeanTick5sBaseline(asset)?.[MEANT5_DEAD_PCT];
    if (typeof p20 === "number" && mean5s < p20) return "tick_low";
  }
  // Gate 4 — CAP DE SPREAD (owner 2026-08-03). ⭐ IMPORTÉ DU LIVE, PAS RECOPIÉ : c'est le seul gate
  //   de ce fichier qui ne soit pas une copie, et c'est délibéré — la note du gate 3 ci-dessus
  //   documente la panne muette que la duplication a déjà causée. `spreadCapBlock` est la SEULE
  //   implémentation, appelée par `AssetEligibility` et par ici.
  if (useSpreadCap && spreadCapBlock(row?.spread, row?.atr_h1, asset)) return "spread_cap";
  return null;   // admissible
}

// Parse CSV ';' → tableau de rows (objets clé→string).
export function loadCsvRows(csvPath) {
  const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(";");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split(";"); const o = {};
    for (let j = 0; j < header.length; j++) o[header[j]] = v[j];
    rows.push(o);
  }
  return rows;
}

// ── OHLC M1 CONTINU (owner 2026-07-13) : l'archive snapshot a des TROUS (soirs/nuits — buffer live) qui
//    faisaient rater TP/SL au walk (ex. USDJPY 07-08 19:45 : TP touché à 20:36 mais snapshot coupé à 19:57).
//    On charge l'historique M1 GAPLESS exporté de MT5 (script mql5/ExportOHLC_M1) → walk TP/SL sur high/low
//    intra-barre, temps MT server. Fallback = ancien walk snapshot si pas d'OHLC pour l'actif.
const mtMin = (s) => { const m = String(s).match(/(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2})/); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000) : null; };
function loadOHLC(ohlcPath) {
  let txt; try { txt = fs.readFileSync(ohlcPath, "utf8"); } catch { return null; }
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(";"); const ep = mtMin(p[0]);
    if (ep == null) continue;
    out.push({ ep, ts: p[0], date: String(p[0]).slice(0, 10), high: +p[2], low: +p[3], close: +p[4] });
  }
  out.sort((a, b) => a.ep - b.ep);
  return out.length ? out : null;
}

/**
 * runMatrixBacktest(csvPath, opts) — Mode A (par actif).
 * opts : { tpAtr=0.65, slAtr=1.95, maxOpen=30, cadenceMin=2, maxHoldMin=0(=EOD) }
 * @returns {{ asset, params, summary, signals:[...] }}
 */
// ── ⛔ PHOTOS HORAIRES SUPPRIMÉES (2026-07-20) ───────────────────────────────────────────────────────
//   TransitionProfile.js est SUPPRIMÉ côté Matrix : `detectTransition` ne lit plus que `h1Crossover`,
//   donc plus personne ne lisait `gate.photos`. Le harness tenait un buffer, le roulait et l'enregistrait
//   à chaque barre pour un état que le moteur ne consultait plus.
//   ⭐ PARITÉ : le backtest ne doit PAS garder un état que le live n'a plus — sinon les deux divergent
//   en silence, et c'est LE BACKTEST QUI MENT. L'anti-spike reste le seul état inter-barres, des 2 côtés.

/**
 * prepareAsset — PASSE 1 SEULE : tout ce qui ne dépend que d'UN actif.
 * ⭐🔥 EXTRAITE LE 29/07 POUR RENDRE LE MODE PORTEFEUILLE POSSIBLE. La détection (quels candidats) ne
 *   dépend que du CSV de l'actif ; l'ALLOCATION (lesquels on ouvre vraiment) dépend du carnet, donc du
 *   portefeuille. Tant que les deux vivaient dans la même fonction, le carnet était forcément
 *   mono-actif — et le cap global ne pouvait pas mordre.
 * ⚠ ON EXTRAIT, ON NE DUPLIQUE PAS : `runMatrixBacktest` devient le cas particulier
 *   `allocate([un seul actif])`. Une seconde boucle d'allocation aurait divergé au premier changement.
 * @returns {null|{asset, rows, series, cands, walk, meta}}
 */
export function prepareAsset(csvPath, opts = {}) {
  const cadenceMin = num(opts.cadenceMin) ?? 2;
  const maxHoldMin = num(opts.maxHoldMin) ?? 0;   // 0 = jusqu'à la fin du jour
  const admission = opts.admission !== false;      // true (défaut) = applique les gates heures + tick_low

  const rows = loadCsvRows(csvPath);
  if (!rows.length) return null;
  // ⭐⭐ NE PLUS FORCER LES MAJUSCULES (2026-07-20) — c'était une DIVERGENCE BACKTEST/LIVE.
  //   Le live passe le symbole du scan TEL QUEL (`CrudeOIL`) ; le harness l'uppercasait
  //   (`CRUDEOIL`). Or `INTRADAY_CONFIG[symbol]` est un lookup par CLÉ EXACTE avec fallback
  //   `?? default` — qui réussit TOUJOURS, donc aucune erreur n'était levée.
  //   Pour les 18 autres actifs la forme majuscule coïncide avec la clé (EURUSD, BRENT_OIL…) :
  //   ça marchait PAR CHANCE. `CrudeOIL`, seul symbole en casse mixte, prenait l'échelle
  //   générique — 2,5× trop basse — pendant que le live prenait la bonne. ⭐ Le backtest ne
  //   mentait pas sur tous les actifs : sur UN SEUL. C'est ce qui rend ce genre de bug indétectable
  //   au total. Cf. `scripts/validate_intraday_config.mjs` côté Matrix (garde anti-récidive).
  //   ⚠️ `asset` sert aussi à getTpSl / GlobalMarketHours / le chemin OHLC : ces trois-là doivent
  //   donc être adressés avec la MÊME casse que le live (fichier renommé ohlc_CrudeOIL_M1.csv).
  const asset = String(rows[0].symbol || "");

  // TP/SL — coefficients PAR ACTIF (SSOT : Matrix-Revolution/src/config/TpSlConfig.js, owner 2026-07-17).
  //   Résolu APRÈS le chargement : le couple dépend de l'actif, or l'actif vient de rows[0].symbol.
  //   opts.tpAtr/slAtr = override explicite (grilles, balayages, champs de l'UI) et PRIME sur la config —
  //   sinon aucune étude ne pourrait plus balayer les coefficients. Absent ⇒ config.
  const cfg = getTpSl(asset);
  const tpAtr = num(opts.tpAtr) ?? cfg.tp;
  const slAtr = num(opts.slAtr) ?? cfg.sl;
  const tpSlSource = (num(opts.tpAtr) !== null || num(opts.slAtr) !== null) ? "override" : cfg.source;

  // OHLC M1 continu (gapless) pour l'actif — data/ohlc/ohlc_<ASSET>_M1.csv (dérivé du chemin matrix).
  const ohlc = loadOHLC(csvPath.replace(/matrix[\/\\][^\/\\]+\.csv$/i, `ohlc/ohlc_${asset}_M1.csv`));

  // série prix (walk TP/SL) : ep en minutes, price, day, atr_h1, ts MT
  // ── ATR de RÉFÉRENCE (owner 2026-07-17) — `atrRef` : "live" (défaut, historique) | "p50" | "trailing"
  //   POURQUOI : l'ATR live est fragile — UNE bougie inhabituelle dans les 14 précédentes et il s'envole
  //   (mesuré : la plus grosse bougie pèse 13-16 % de l'ATR vs 7,1 % si uniforme, et pollue 14 h). Un TP/SL
  //   assis dessus bouge donc pour une raison qui n'a rien à voir avec le trade. Un ATR de RÉFÉRENCE stable
  //   (P50 de l'actif) découple la distance du bruit récent.
  //   ⚠ "p50" = médiane sur TOUT le dataset → LOOK-AHEAD (utilise le futur). Acceptable pour CALIBRER une
  //     constante, INTERDIT pour juger une perf. "trailing" = médiane glissante causale (fenêtre `atrRefWin`,
  //     défaut 3 j) → sans look-ahead, c'est la version honnête pour mesurer.
  const atrRefMode = opts.atrRef ?? "live";
  const atrRefWin = num(opts.atrRefWin) ?? 4320;     // minutes (3 j) pour le mode trailing
  const series = rows.map((r) => {
    const ep = Date.parse(r.ts_utc ?? r.timestamp);
    // ⭐ `spread` PORTÉ SUR LA SÉRIE (03/08) — le spread HISTORIQUE de la barre, en unités de prix.
    //   Rempli à 100 % dans le dataset. Il ne sert qu'à `opts.chargeSpread` ; sans le flag, personne
    //   ne le lit et le run est identique au bit près.
    return { ep: Number.isFinite(ep) ? Math.round(ep / 60000) : null, price: num(r.price), atr: num(r.atr_h1), atrLive: num(r.atr_h1), spread: num(r.spread), day: String(r.ts_utc ?? r.timestamp).slice(0, 10), tsMT: r.timestamp, i: 0 };
  });
  if (atrRefMode === "p50") {
    const v = series.map((s) => s.atrLive).filter((x) => x > 0).sort((a, b) => a - b);
    const p50 = v.length ? v[Math.floor(v.length / 2)] : null;
    series.forEach((s) => (s.atr = p50));            // constante par actif
  } else if (atrRefMode === "trailing") {
    // médiane glissante CAUSALE : ne regarde que le passé (fenêtre atrRefWin minutes)
    for (let i = 0; i < series.length; i++) {
      const t0 = series[i].ep - atrRefWin;
      const w = [];
      for (let j = i; j >= 0 && series[j].ep >= t0; j--) if (series[j].atrLive > 0) w.push(series[j].atrLive);
      w.sort((a, b) => a - b);
      series[i].atr = w.length >= 30 ? w[Math.floor(w.length / 2)] : series[i].atrLive;   // pas assez d'historique → live
    }
  }
  series.forEach((s, i) => (s.i = i));

  // ── PASSE 1 : détecter les fires (au cadenceMin) ──
  const cands = [];   // { i, ep, tsMT, side, strategy, entry, atr }
  // ══ LES DROP, ÉCHANTILLONNÉS ET INSPECTABLES (2026-08-05) ═══════════════════════════════════
  // ⭐⭐⭐ LA POPULATION DES REFUS EST LA SEULE NON BIAISÉE POUR JUGER UN EXPERT OU UN VETO. C'est la
  //   raison pour laquelle les deux scorers tournent toujours, et la raison pour laquelle le
  //   pré-gate a été retiré : le score existe désormais SUR LES BARRES REFUSÉES. On produisait donc
  //   cette information et on ne pouvait pas la regarder — un comble, vu ce qu'a coûté sa production.
  // ⚠ PLAFOND PAR MOTIF, ET IL EST DÉCLARÉ. Émettre tous les refus multiplierait la charge utile par
  //   ~5 (les DROP sont l'écrasante majorité des barres). On garde donc les `DROP_CAP` premiers de
  //   CHAQUE motif — stratifié, pas un `slice` global qui ne montrerait que les motifs fréquents —
  //   et `dropsOmitted` compte ce qui a été écarté. ⭐ Un plafond SILENCIEUX se lit comme une
  //   couverture complète : celui-ci se dit.
  const DROP_CAP = 250;
  const drops = [], dropsSeen = {}, dropsOmitted = {};
  // ⭐ FANTÔMES `unripe` (opt-in `opts.ghostUnripe`) — LES CONT TUÉS PAR RICOCHET DU SEUIL.
  //   Un score EXH non nul mais SOUS `MIN_EXH` pose `exhRefused.kind = "unripe"`, qui SUPPRIME
  //   la continuation de la barre. Monter le seuil en tue donc DAVANTAGE — et ces trades-là n'ont
  //   jamais été mesurés séparément, parce qu'ils ne deviennent pas des candidats : ils n'existent
  //   nulle part en aval.
  // ⚠⚠ POURQUOI UNE LISTE À PART ET NON DES CANDIDATS : les mêler à `cands` leur ferait PRENDRE DES
  //   PLACES dans le carnet, donc déplacerait les trades réels. On mesurerait alors un NET (« ce que
  //   le moteur devient »), pas une COHORTE (« ce que ces barres valaient »), et c'est précisément la
  //   confusion que cette mesure doit lever — cf. « les vetos ne soustraient pas, ils REMPLACENT ».
  // ⚠ STRICTEMENT PASSIF : rien ici n'entre dans `allocate`, le run reste identique au bit près quand
  //   le flag est absent.
  const ghosts = [];
  // ⭐ SEUIL DU CAP DE SPREAD, en `spread/atr_h1`, calculé PAR ACTIF sur son propre dataset.
  //   Un seuil universel n'aurait aucun sens : le rapport médian va de 0,111 (AUDUSD) à des valeurs
  //   très différentes selon l'actif, exactement comme pour `DEVIATION_BANDS`.
  // ⚠⚠ REGARD EN AVANT ASSUMÉ ET À NE PAS OUBLIER : le percentile est calculé sur TOUTE la fenêtre,
  //   donc il connaît le futur. C'est acceptable pour CALIBRER (on cherche où poser la borne), ça ne
  //   l'est pas pour conclure sur un P&L. Une mise en production figerait la valeur par actif dans
  //   une config, comme les barreaux du gap — et il faudrait la rejouer à chaque rebuild.
  const spreadCap = (() => {
    const pct = num(opts.spreadCapPct);
    if (pct == null || !(pct > 0) || pct >= 100) return null;
    const v = series.map((x) => (x.spread > 0 && x.atr > 0 ? x.spread / x.atr : null))
      .filter((x) => x != null).sort((a, b) => a - b);
    return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * pct / 100))] : null;
  })();
  let lastEp = -1e9, fires = 0, evals = 0;
  const adm = { hours: 0, tick_low: 0 };   // funnel Admission, par label
  const dec = {};                          // funnel DÉCISION, par issue (cf. plus bas)
  const spikeOn = opts.spike !== false;   // ANTI-SPIKE activable (défaut ON) — spike:false → état non passé
  // ÉTAT anti-spike (idem) — SSOT SpikeGuard.js. opts.spikeK/spikeCooldown = knobs de CALIBRATION du
  //   backtest uniquement ; par défaut le moteur utilise ses propres constantes (SPIKE_K/COOLDOWN).
  const spikeTracker = createSpikeTracker({
    ...(num(opts.spikeK) !== null ? { k: num(opts.spikeK) } : {}),
    ...(num(opts.spikeCooldown) !== null ? { cooldownMin: num(opts.spikeCooldown) } : {}),
  });
  for (let i = 0; i < rows.length; i++) {
    const s = series[i];
    if (s.ep == null || s.ep < lastEp + cadenceMin) continue;
    lastEp = s.ep; evals++;
    // ADMISSION en amont (comme le live) : barre inadmissible → pas d'évaluation moteur.
    if (admission) {
      // Tout label non-null = rejet (comme le live). On compte PAR label — sans quoi un gate ajouté
      //   plus tard passerait au travers de la boucle en silence, en croyant filtrer.
      const blk = admissionBlock(rows[i], asset, opts.spreadCap !== false);
      if (blk) { adm[blk] = (adm[blk] ?? 0) + 1; continue; }
    }
    // ⭐🔥 CAP DE SPREAD (opt-in `opts.spreadCapPct`, owner 2026-08-03) — ON N'ADMET PAS UNE BARRE
    //   DONT LE PÉAGE EST TROP CHER. Le seuil porte sur `spread / atr_h1` et NON sur le spread nu :
    //   le coût d'un trade en R vaut `spread / (sl × atr)`, donc c'est le RAPPORT qui est la dépense.
    //   ⚠⚠ Ce n'est pas un détail de forme. Mesuré sur AUDUSD, le spread nu est quasi CONSTANT
    //   (p10 ≈ p90) : sa dispersion vient de l'ATR. Un cap sur le spread nu ne couperait donc que le
    //   rollover de 21h UTC — 2 % des barres, et le moteur n'y tire déjà que 2 trades. Il aurait
    //   l'air de mordre et ne retirerait rien.
    // ⭐ REFUS D'ADMISSION, DONC REFUS PARTAGÉ : la barre disparaît pour les DEUX thèses. Il ne peut
    //   pas produire le ricochet d'un seuil interne (`unripe` supprime la CONT et fait monter le
    //   ratio EXH) — c'est le refus de STRUCTURE que le chantier du ratio réclame, pas un seuil de
    //   plus dans l'arbitrage. Cf. `threshold_ricochet_cohort_2026_08_03`.
    // ⚠ COMPTÉ dans le funnel `adm`, comme les autres : un garde qu'on ne compte pas est un garde
    //   dont on ne saura jamais s'il a agi.
    if (spreadCap != null) {
      const sp = s.spread, at = s.atr;
      if (sp > 0 && at > 0 && sp / at > spreadCap) { adm.spread_cap = (adm.spread_cap ?? 0) + 1; continue; }
    }
    // État inter-barres, MÊME code que le live (MatrixEngine) : anti-spike observe AVANT (il ne
    //   dépend que de la row, pas du verdict). C'est désormais le SEUL état, ici comme en prod.
    spikeTracker.observe(rows[i]);
    let det;
    try {
      det = detectOpportunity(rows[i], asset, {
        spike: spikeOn ? spikeTracker.state(rows[i]) : null,
        // ⭐🔥 LA NOUVELLE COUCHE 3 — INDISPENSABLE, ET C'EST UN PIÈGE QUI A FAILLI SE REFERMER.
        //   Depuis le 27/07, `detectOpportunity` prend la décision en INJECTION, avec l'ANCIENNE
        //   (`decideSignal`) en défaut de compatibilité. `MatrixEngine` passe `decideFromScoring` ;
        //   ce fichier ne passait rien. Le backtest aurait donc mesuré l'ANCIENNE logique pendant que
        //   la prod tourne sur la nouvelle — des chiffres justes sur un moteur qui n'existe plus.
        //   ⚠ Le commentaire ci-dessus (« MÊME code que le live ») était devenu FAUX sans que rien
        //   ne le signale : c'est exactement le type d'écart que le défaut fail-open rend silencieux.
        //   🎯 Tant que l'injection existe, TOUT appelant de `detectOpportunity` doit passer `decide`,
        //   sinon il mesure autre chose que la prod. Le jour où `decideSignal` disparaît, ce risque
        //   disparaît avec lui.
        // 🔴🔥 ET IL S'EST REFERMÉ UNE SECONDE FOIS LE 28/07, SUR LE MÊME MÉCANISME. La règle
        //   `wait-cont` (le côté d'une continuation ne peut pas contredire le régime) a été câblée
        //   dans `MatrixEngine` en passant `_c2` à la couche 3 ; ICI l'argument manquait encore, donc
        //   `regimeDirection` rendait 0 et la règle était INERTE. Mesure identique au R près à la
        //   décimale — un « aucun effet » parfaitement crédible, et parfaitement faux.
        //   ⭐⭐ LA LEÇON N'EST PAS « PENSER AUX DEUX SITES », C'EST QUE DEUX SITES EXISTENT. Cette
        //   closure est une COPIE de celle de `MatrixEngine` ; tant qu'il y en a deux, chaque
        //   changement de signature doit être fait deux fois et le fail-open rend l'oubli muet.
        //   🎯 Le vrai correctif est d'exporter le câblage UNE fois depuis le moteur et de l'importer
        //   ici — pas de mieux se souvenir.
        decide: (c2, _obs, gate, r) => decideFromScoring(r, gate, c2),
      });
    } catch { continue; }
    const sel = det.selection;
    const hasSide = sel?.side === "BUY" || sel?.side === "SELL";
    // ⭐🔥🔥 POPULATION NON SÉLECTIONNÉE (opt-in `opts.ghostAllExh`) — TOUTES les barres où la thèse
    //   EXH a un avis, qu'elle ait tiré ou non, gagné ou perdu l'arbitrage.
    // ⚠⚠ POURQUOI ELLE EST NÉCESSAIRE, ET CE QU'AUCUNE MESURE SUR LES TIRS NE PEUT DONNER : les
    //   trades observés sont ceux où `|somme pondérée| ≥ MIN_EXH`. Conditionner sur une SOMME
    //   anti-corrèle ses termes — une barre retenue avec un expert fort a les autres plus faibles,
    //   sinon elle serait passée de toute façon. C'est un COLLIDER, et il est MESURÉ : les huit
    //   experts EXH ont une corrélation négative avec la somme des autres dans les tirs (slope −0,44,
    //   rsi −0,25 …). ⇒ Au-dessus du seuil, un score élevé signale un terme qui a COMPENSÉ, pas une
    //   meilleure barre. Un score peut informer et ne pas trier dans la population qu'il a sélectionnée.
    //   La stratification ATTÉNUE ce biais ; seule une population non conditionnée le SUPPRIME.
    // ⚠ On pousse un CANDIDAT, pas un trade : `walk` est appelé par la sonde, APRÈS déduplication par
    //   épisode. Walker d'abord ferait ~150 000 marches dont 5 sur 6 seraient des clones.
    // ⚠ `sExhB !== 0` : sans côté il n'y a rien à simuler. Et `scoring` est `null` sur un raccourci
    //   (aucun score n'existe sur ces barres) — exclu par construction, pas par oubli.
    // ⭐⭐⭐ `ghostAllRows` — **TOUTES LES LIGNES**, sans AUCUNE condition (owner, 20/08).
    //   🔴 POURQUOI IL FALLAIT UN TROISIEME COLLECTEUR : `ghostAllExh` lui-meme filtre — il exige
    //   `exh !== 0`, donc « la these de fade a un avis ». Mesurer une figure d'INDICATEURS dessus
    //   reste conditionne par le bareme. Ici on ne conditionne sur RIEN : chaque barre est rendue
    //   avec ses capteurs bruts, et c'est la SONDE qui decide ce qu'elle en fait.
    //   ⇒ Le cote n'existe pas sur une barre non selectionnee : la sonde l'impose (ici SELL), et le
    //   `walk` simule une entree comme si le moteur avait tire. Ce n'est PAS ce que le moteur ferait,
    //   c'est la valeur INFORMATIVE des capteurs, sans capacite ni spacing ni veto.
    // ⚠ VOLUME : ~23 000 lignes par actif, objets plats — on ne `walk` pas ici, la sonde ne simule
    //   que les lignes qu'elle retient. Simuler les 434 644 barres couterait sans rien apprendre.
    if (opts.ghostAllRows) {
      const h1 = det?.stoch?.perTf?.h1 ?? {}, h4 = det?.stoch?.perTf?.h4 ?? {};
      ghosts.push({ i, ep: s.ep, tsMT: s.tsMT, ghost: "all-rows",
                    entry: s.price, atr: s.atr, spreadRaw: s.spread,
                    kH1: r2(h1.k), dH1: r2(h1.d),
                    kdGapH1: (h1.k == null || h1.d == null) ? null : r2(h1.k - h1.d),
                    kH4: r2(h4.k), kdGapH4: (h4.k == null || h4.d == null) ? null : r2(h4.k - h4.d),
                    kdCycleH4: h4.kdCycle ?? null, dKBandH4: h4.dKBand ?? null,
                    kH1S1: r2(numStrict(rows[i]?.stoch_k_h1_s1)),
                    zscoreH1: r2(numStrict(rows[i]?.zscore_h1)),
                    zscoreH1S0: r2(numStrict(rows[i]?.zscore_h1_s0)),
                    dzH1Col: r2(numStrict(rows[i]?.dz_h1)),
                    dRsiH1: r2(numStrict(rows[i]?.drsi_h1)),
                    dRsiH1Live: r2(numStrict(rows[i]?.drsi_h1_s0)),
                    adxH1Live: r2(numStrict(rows[i]?.adx14_h1_s0)),
                    plusDi: r2(numStrict(rows[i]?.plus_di_h1_c1)), minusDi: r2(numStrict(rows[i]?.minus_di_h1_c1)),
                    // ⭐ CE QUE LE MOTEUR EN AURAIT FAIT — pour pouvoir separer, DANS la sonde, ce qui
                    //   a tire de ce qui a ete refuse et pourquoi. Sans ces trois champs on ne peut
                    //   pas comparer « toutes les lignes » a « les tirs ».
                    exhScore: Number.isFinite(det.rawSelection?.scoring?.exh) ? det.rawSelection.scoring.exh : null,
                    aTire: hasSide && sel?.strategy === "EXH",
                    // 🔴 LA FORME DE `vetoed`, ET ELLE A DEUX VARIANTES (corrige le 20/08) :
                    //   `{ strategy, side, score, hits: [{id, tf, why}] }`  ← le cas courant
                    //   `{ strategy, side, score, routeur: "contre-sa-zone", zoneEXH }`  ← SANS `hits`
                    //   Un `v?.id` ne trouve NI l'un NI l'autre : il rendait `[object Object]`, donc
                    //   une ventilation par identifiant illisible alors que les COMPTES etaient bons.
                    // ⚠ On garde une entree par veto TOUCHE (pas par objet `vetoed`), et on nomme
                    //   explicitement la variante sans hits plutot que de la perdre en silence.
                    vetoed: (det.rawSelection?.vetoed ?? []).flatMap((v) => {
                      const h = (v?.hits ?? []).map((x) => x?.id).filter(Boolean);
                      if (h.length) return h;
                      if (v?.routeur) return [`routeur:${v.routeur}`];
                      return ["(veto sans hits)"];
                    }),
                    waitNature: sel?.waitNature ?? null,
                    // 🔴🔥⭐⭐⭐ CES QUATRE CHAMPS AVAIENT ETE POSES SUR LE MAUVAIS FANTOME (20/08).
                    //   Ecrits dans `exh-all` alors que la sonde interrogeait `all-rows` : elle a
                    //   rendu **0 ligne sur 90 781**, sans qu'aucune erreur ne leve. C'est le motif
                    //   « UN CARNET VIDE NE SE SIGNALE PAS » du depot, dans sa 3e forme connue —
                    //   `node --check` passe, la sonde tourne, et le tableau sort VIDE.
                    //   🎯 VERIFIER DANS QUEL OBJET ON POSE UNE ENTREE, toujours.
                    // ⭐ `selStrategy` = ce que la CASCADE a retenu (EXH/PB/CONT/null). Sans lui, une
                    //   barre ou le ③ a tire est indiscernable d'une barre morte.
                    selStrategy: hasSide ? (sel?.strategy ?? null) : null,
                    hasSide: !!hasSide,
                    // ⭐⭐ LE VETO DU RANG ③, A PART. `vetoed` melange les entrees des trois rangs
                    //   (`{strategy:"EXH"|"CONT", side, hits}`) : les aplatir attribuerait un veto
                    //   CONT au rang ①. Et le cote du ③ (`contSide`) est l'OPPOSE de `SIDE_EXH`.
                    // ⚠⚠ ORDRE DES REFUS AU ③ : `cont-counter-cross` → `cont-below-min` →
                    //   `cont-vetoed`. Le veto est teste APRES le seuil : une barre sous `MIN_CONT`
                    //   ne l'atteint JAMAIS. Ne pas separer ces causes attribuerait au VETO ce que
                    //   le SEUIL a deja refuse.
                    contVeto: (() => {
                      const v = (det.rawSelection?.vetoed ?? []).find((x) => x?.strategy === "CONT");
                      if (!v) return null;
                      return { side: v.side ?? null, ids: (v.hits ?? []).map((h) => h?.id).filter(Boolean) };
                    })(),
                    // 🔴🔥⭐⭐⭐ `regDir` EST LE SEUL MOYEN DE CONNAITRE LE COTE D'UNE BARRE REFUSEE
                    //   EN `cont-counter-cross` (20/08). Ce refus est le PREMIER du rang ③, pose AVANT
                    //   `cont-below-min` et AVANT `vetoGate` : la barre n'a donc **ni `contVeto` ni
                    //   `selStrategy`**, et les deux sondes existantes en deduisaient le cote par
                    //   `x.contVeto?.side ?? (selStrategy === "CONT" ? x.side : null)` ⇒ **`null`**
                    //   ⇒ `continue`. ⚠⚠ **18 491 LIGNES (20,37 % DU FLUX) ETAIENT DONC INVISIBLES DANS
                    //   TOUTE MESURE DU ③, SANS QU'AUCUNE ERREUR NE LEVE.** 4e forme du motif
                    //   « un carnet vide ne se signale pas » : ici ce n'est pas le carnet qui est vide,
                    //   c'est une POPULATION ENTIERE qui manque a un tableau qui a l'air complet.
                    // ⚠ `contSide = SIDE_PRO`, et `SIDE_PRO = proDir` — qui vaut `regDir` UNIQUEMENT
                    //   parce que `PRO_DIR_SRC` vaut `regime` par defaut. Si ce levier est pose, cette
                    //   deduction devient FAUSSE en silence. ⛔ ne pas lire ce champ sans verifier l'env.
                    regDir: Number.isFinite(det.rawSelection?.scoring?.regDir) ? det.rawSelection.scoring.regDir : null,
                    // ⭐⭐ LE CROSS K/D H1 QUI COMMANDE `cont-counter-cross`, POSE SUR `traceCont` LE 20/08.
                    //   Il est sur la TRACE et pas sur les `extra` du drop : `traceCont` est partage par
                    //   TOUS les devenirs du ③ (drop ET tir), donc la population devient COMPARABLE.
                    // ⚠ `ccMat` vaut `FRESH` (age 0) ou `CONFIRMED` (age >= 1 + |K-D| qui se creuse).
                    //   `STALLED` n'arrive JAMAIS ici : `detectTransition` le rejette en amont.
                    // ⚠⚠ `FRESH` SE LIT SUR LA BARRE H1 **NON CLOSE** (`kds[0]` est le live) : le cross
                    //   peut se de-croiser avant la cloture. Ne pas traiter les deux maturites comme
                    //   deux graduations d'un meme axe — elles n'ont PAS la meme horloge.
                    ccMat: det.rawSelection?.scoring?.ccMat ?? null,
                    ccAge: Number.isFinite(det.rawSelection?.scoring?.ccAge) ? det.rawSelection.scoring.ccAge : null,
                    ccSide: det.rawSelection?.scoring?.ccSide ?? null,
                    contScore: Number.isFinite(det.rawSelection?.scoring?.cont) ? det.rawSelection.scoring.cont : null });
    }
    if (opts.ghostAllExh) {
      const g = det.rawSelection?.scoring ?? null;
      const sExhB = g?.exh;
      if (Number.isFinite(sExhB) && sExhB !== 0) {
        // ⛔ L'ARGUMENT DE CÔTÉ A DISPARU AVEC LES EXPERTS EXH (11/08) — il ne servait qu'à choisir
        //   entre `exhExperts.BUY` et `exhExperts.SELL`, un champ qui n'existe plus. Le rang ① est
        //   un barème à somme : sa décomposition est dans `boxes.exh.parts`, déjà côté-résolue.
        // ⚠ `exp` vaut donc `null` ici, et c'est JUSTE : ce fantôme n'a pas de bundle d'experts.
        //   Le laisser à `{}` aurait fait croire à un panel vide plutôt qu'à un panel INEXISTANT.
        const exp = expertsFor(g, "EXH");
        ghosts.push({ i, ep: s.ep, tsMT: s.tsMT, side: sExhB > 0 ? "BUY" : "SELL",
                      strategy: "EXH", type: "EXHAUSTION", ghost: "exh-all",
                      entry: s.price, atr: s.atr, spreadRaw: s.spread,
                      exhScore: sExhB, exhRaw: g.exhRaw ?? null, exp,
                      // ⭐⭐⭐ LES AXES DU CHANTIER `z`, PORTES SUR LE FANTOME (20/08, owner) — SANS
                      //   EUX ON NE PEUT MESURER `z` QUE SUR LES TIRS, donc sur une population deja
                      //   filtree par les vetos, `MIN_EXH` et le spacing. Or c'est exactement la
                      //   question posee : « la journee est-elle SPECIALE, ou est-elle le seul
                      //   endroit ou de telles barres SURVIVENT aux filtres ? » Un crible de grappe
                      //   applique aux seuls tirs ne peut PAS y repondre — c'est un COLLIDER.
                      // ⚠ `zOr` n'est PAS pre-oriente ici : le cote du fantome est deduit du SIGNE
                      //   du score (`sExhB > 0 ? BUY : SELL`), la sonde oriente elle-meme.
                      zscoreH1: r2(numStrict(rows[i]?.zscore_h1)),
                      zscoreH1S0: r2(numStrict(rows[i]?.zscore_h1_s0)),
                      // 🔴🔥 DEUX `Δz`, ET ILS NE MESURENT PAS LA MEME CHOSE (mesure du 20/08) :
                      //   `zscoreH1S0 − zscoreH1` est un mouvement **INTRA-BARRE** (live moins
                      //   cloture) ; `dz_h1` est la variation **DE BARRE A BARRE** calculee par l'EA.
                      //   Sur `US_TECH100 2026.07.30 16:31` ils ont des SIGNES OPPOSES (−0,11 contre
                      //   +0,01), et ils ne s'accordent que dans 38,7 % des cas. Pour « le prix ne
                      //   revient pas » d'une barre a l'autre, c'est `dz_h1` qu'il faut.
                      dzH1Col: r2(numStrict(rows[i]?.dz_h1)),
                      kdCycleH4: det?.stoch?.perTf?.h4?.kdCycle ?? null,
                      kH4: r2(det?.stoch?.perTf?.h4?.k), dKBandH4: det?.stoch?.perTf?.h4?.dKBand ?? null,
                      // ⭐⭐⭐ LA FIGURE « L'OSCILLATEUR PLAFONNE, LE PRIX NON » (owner, 20/08) exige de
                      //   comparer une grandeur BORNEE (`%K`, renormalisee sur la fenetre recente) a
                      //   une grandeur NON BORNEE (`z`, distance a la moyenne). En tendance forte le
                      //   `%K` peut refluer SANS que le prix revienne — et le rang ① lit le `%K`.
                      //   ⇒ il faut `kH1` ET sa cloture precedente pour voir le reflux, et le regime
                      //   pour savoir si on fade une tendance INSTALLEE.
                      kH1: r2(det?.stoch?.perTf?.h1?.k), dH1: r2(det?.stoch?.perTf?.h1?.d),
                      kH1S1: r2(numStrict(rows[i]?.stoch_k_h1_s1)),
                      kdGapH1: (det?.stoch?.perTf?.h1?.k == null || det?.stoch?.perTf?.h1?.d == null)
                        ? null : r2(det.stoch.perTf.h1.k - det.stoch.perTf.h1.d),
                      regime: det?.marketProfile?.profile ?? null,
                      adxH1Live: r2(numStrict(rows[i]?.adx14_h1_s0)),
                      diPlus: r2(numStrict(rows[i]?.plus_di_h1_c1)), diMinus: r2(numStrict(rows[i]?.minus_di_h1_c1)),
                      // ⭐ POURQUOI la barre n'a pas tire — la SEULE facon de distinguer « refusee
                      //   par un VETO » de « sous le SEUIL » de « evincee par le SPACING ».
                      // 🔴🔥⭐⭐⭐ LE CÔTÉ EST INDISPENSABLE, ET L'AVOIR JETÉ A PRODUIT UNE TABLE FAUSSE
                      //   (20/08). `scoringDecision` empile les vetos des **DEUX** côtés :
                      //       for (const s of sides) if (exhVeto[s].blocked) vetoed.push({ side: s, … })
                      //   Or **UN SEUL côté est admis au rang ①** (`SIDE_EXH = −regDir`). Un veto qui
                      //   touche le côté NON retenu est donc ENREGISTRÉ SANS AVOIR RIEN BLOQUÉ.
                      //   ⇒ Aplatir en ids fait compter comme « exclusives » des barres que le veto
                      //   n'a jamais empêchées. PREUVE : `VETO_GAP_AHEAD=off` rend un carnet
                      //   IDENTIQUE AU BIT PRÈS alors que la table lui prêtait 1 577 barres
                      //   exclusives dont 992 au-dessus de `MIN_EXH`.
                      // ⭐ On garde donc les ids PAR CÔTÉ. Le côté du fantôme est `sExhB > 0 ? BUY :
                      //   SELL` ; seuls les vetos de CE côté-là ont pu bloquer.
                      vetoedBySide: (det.rawSelection?.vetoed ?? []).reduce((acc, v) => {
                        const ids = (v?.hits ?? []).map((x) => x?.id).filter(Boolean);
                        const l = ids.length ? ids : (v?.routeur ? [`routeur:${v.routeur}`] : ["(veto sans hits)"]);
                        const k = v?.side ?? "?";
                        (acc[k] ??= []).push(...l);
                        return acc;
                      }, {}),
                      // ⚠ CONSERVÉ TEL QUEL pour ne pas casser les sondes écrites avant le correctif,
                      //   mais IL MÉLANGE LES DEUX CÔTÉS : ne PAS s'en servir pour juger un veto.
                      vetoed: (det.rawSelection?.vetoed ?? []).flatMap((v) => {
                        const h = (v?.hits ?? []).map((x) => x?.id).filter(Boolean);
                        if (h.length) return h;
                        if (v?.routeur) return [`routeur:${v.routeur}`];
                        return ["(veto sans hits)"];
                      }),
                      waitNature: sel?.waitNature ?? null,
                      // ⭐⭐⭐ OÙ VA LA BARRE, ET PAS SEULEMENT « EST-CE QUE L'EXH A TIRÉ » (20/08).
                      //   `fired` ne parle que du rang ① : une barre où le ③ a tiré y est
                      //   INDISCERNABLE d'une barre morte. Or la question « où vont les barres
                      //   vetoées par l'EXH ? » se joue exactement là — le dépôt dit « un refus
                      //   `structure` ROUTE, un `timing` TUE », et rien ne permettait de le VÉRIFIER.
                      //   ⇒ `selStrategy` = ce que la cascade a RETENU sur cette barre (EXH / PB /
                      //   CONT / null), `hasSide` = un côté a-t-il été résolu.
                      selStrategy: hasSide ? (sel?.strategy ?? null) : null,
                      hasSide: !!hasSide,
                      // ⭐⭐⭐ LE VETO DU RANG ③, A PART (20/08). `vetoed` melange les entrees des
                      //   TROIS rangs (`{strategy:"EXH"|"CONT", side, hits}`) : les aplatir ensemble
                      //   attribuerait un veto CONT au rang ①. Et le cote du ③ (`contSide`) n'est PAS
                      //   celui du ① (`SIDE_EXH = −regDir`) — c'est son OPPOSE.
                      // ⚠⚠ ORDRE DES REFUS AU ③, et il commande toute la lecture :
                      //     `cont-counter-cross`  →  `cont-below-min`  →  `cont-vetoed`
                      //   Le veto est teste APRES `MIN_CONT` : une barre sous le seuil ne l'atteint
                      //   JAMAIS. Compter « ce que les vetos ③ bloquent » sans separer ces trois
                      //   causes attribuerait au veto ce que le SEUIL a deja refuse.
                      contVeto: (() => {
                        const v = (det.rawSelection?.vetoed ?? []).find((x) => x?.strategy === "CONT");
                        if (!v) return null;
                        return { side: v.side ?? null, ids: (v.hits ?? []).map((h) => h?.id).filter(Boolean) };
                      })(),
                      contScore: Number.isFinite(det.rawSelection?.scoring?.cont) ? det.rawSelection.scoring.cont : null,
                      fired: hasSide && sel.strategy === "EXH" });
      }
    }
    // ⭐⭐⭐ `opts.ghostBoxes` — LA POPULATION NON SÉLECTIONNÉE DU **CADRE PARALLÈLE** (owner 10/08).
    //   Même patron et même motif que `ghostAllExh` ci-dessus — on ne conditionne pas sur les tirs,
    //   sinon on mesure un collider. Ce qui change : ce fantôme ne porte pas le score d'UNE thèse,
    //   il porte le VERDICT DES TROIS BOÎTES sur la barre, et son côté est celui du **PULLBACK**.
    // 🎯 CE QU'IL DÉBLOQUE, et rien d'autre ne le peut :
    //     · mesure 4 « le robinet » — la distribution de la conviction EXH sur les barres qui n'ont
    //       PAS tiré. Le carnet ne contient que les tirs ; or `ScoreMinDrop_EXH` se calibre
    //       précisément sur ce qui tombe SOUS le seuil, donc sur ce qui n'y est pas.
    //     · mesure 3 « le Drop croisé » — les deals PB tués par un Drop EXH. Le côté et le prix sont
    //       ici, donc la sonde peut appeler `walk()` et obtenir l'issue CONTREFACTUELLE. C'est la
    //       seule façon de chiffrer ce que le veto de row coûte : il empêche le trade d'exister,
    //       donc il n'y a rien à lire dans le carnet, par construction.
    // ⚠ `boxes` EST APLATI EN SCALAIRES, PAS RECOPIÉ TEL QUEL. Trois sous-objets par barre sur
    //   ~430 000 barres feraient exactement ce que le commentaire de `rows` décrit plus bas (OOM à
    //   4 Go, mesuré). Un fantôme doit rester plat et petit.
    // ⚠ `side` VIENT DE `boxes.pb.side` (donc du PROFIL), jamais du signe d'un score — c'est
    //   l'invariant du cadre. Et `type: "CONTINUATION"` parce que `MODES.PB.type` l'est par DÉCISION
    //   owner (05/08), pas par repli : le TP/SL simulé doit être celui que le PB aurait vraiment eu.
    // ⚠ On pousse un CANDIDAT, pas un trade : `walk` est appelé par la sonde APRÈS déduplication par
    //   épisode, comme pour `ghostAllExh`.
    if (opts.ghostBoxes) {
      const bx = det.rawSelection?.boxes ?? null;
      if (bx && (bx.pb?.side === "BUY" || bx.pb?.side === "SELL")) {
        ghosts.push({ i, ep: s.ep, tsMT: s.tsMT, side: bx.pb.side,
                      strategy: "PB", type: "CONTINUATION", ghost: "boxes",
                      entry: s.price, atr: s.atr, spreadRaw: s.spread,
                      regDir: bx.regDir ?? null,
                      eSide: bx.exh?.side ?? null, eConv: bx.exh?.conviction ?? null,
                      // ⭐ LES AXES BRUTS DE LA FIGURE `POUSSEE`, pour pouvoir DICTER sa table sur des
                      //   chiffres au lieu de l'ecrire a l'aveugle. Ce sont ceux que la barre
                      //   `AUDUSD 29/07 19:35` a rendus criants : `z H1` +2,49 · `dRSI H1` +27,43 ·
                      //   `%K H1` 69,55 apres 14,56. La table n'existe pas encore ; ces colonnes
                      //   servent a savoir CE QU'ELLE DEVRAIT LIRE.
                      // ⚠ `bare = CLOTURE, _s0 = LIVE` — on prend les DEUX pour `z`, parce que la
                      //   porte de type choisit sur le CLOTURE et verifie sur le LIVE : sans les deux
                      //   on ne peut pas rejouer sa decision.
                      zH1Closed: r2(numStrict(rows[i]?.zscore_h1)),
                      dzH1: (() => { const a = numStrict(rows[i]?.zscore_h1_s0), b = numStrict(rows[i]?.zscore_h1);
                                     return (a == null || b == null) ? null : r2(a - b); })(),
                      dRsiH1b: r2(numStrict(rows[i]?.drsi_h1)),
                      rsiH1b: r2(numStrict(rows[i]?.rsi_h1)),
                      kH1b: r2(numStrict(rows[i]?.stoch_k_h1_s1)),
                      eVerd: bx.exh?.verdict ?? null, eBlk: bx.exh?.blocked ?? null,
                      pConv: bx.pb?.conviction ?? null, pVerd: bx.pb?.verdict ?? null,
                      pBlk: bx.pb?.blocked ?? null,
                      // ⭐ LES IDs DES VETOS QUI ONT MORDU CÔTÉ PB — sans eux on ne peut pas
                      //   discriminer par FAMILLE, qui est toute la question du point C.
                      //   ⚠ Le seul champ non scalaire du fantôme, et il est assumé : tableau VIDE
                      //   dans ~39 % des cas, 1 à 2 chaînes sinon. Aplatir en une chaîne jointe
                      //   obligerait la sonde à re-parser — un vocabulaire de plus pour rien.
                      pVetos: bx.pb?.vetoIds ?? [], eVetos: bx.exh?.vetoIds ?? [],
                      // ⭐⭐⭐ LES 8 NOTES DU RANG ① (2026-08-12). Sans elles, « ces deux entrées
                      //   disent-elles la même chose ? » est une question qu'aucune sonde ne peut
                      //   poser — et c'est exactement celle que l'owner pose en proposant de retirer
                      //   `kH1` et `kdH1`. La somme passe par les FAMILLES, mais la redondance se lit
                      //   sur les PARTS.
                      // ⚠ ON NE COPIE QUE LES 8 NOTES, pas `parts` en bloc : il porte aussi des
                      //   étiquettes de trace (niveaux, bandes) qui tripleraient le poids du fantôme
                      //   sans servir ici. Le fantôme doit rester plat et court — 4 Go mesurés le jour
                      //   où on y a mis des objets.
                      // 🔴🔥⭐⭐⭐ 19/08 — CETTE LISTE ÉTAIT RECOPIÉE À LA MAIN, ET ELLE S'ÉTAIT PÉRIMÉE
                      //   EN SILENCE : elle nommait `kdH1`, `kH4` et `di` — RETIRÉES du barème les 12
                      //   et 13/08 — et OMETTAIT `gapM15` (13/08) et `gapH4` (15/08), vivantes. Une
                      //   sonde qui lisait `eParts` mesurait donc un barème qui n'existe plus, avec
                      //   trois colonnes de `null` et deux entrées manquantes, **sans que rien ne lève**.
                      //   ⭐ C'est le piège que le dépôt nomme (« une liste recopiée dans une sonde se
                      //   périme en silence »), sur l'organe même qui sert à mesurer les barèmes.
                      // ⇒ ON DÉRIVE LA LISTE DE LA TABLE QUI DÉCIDE, jamais d'une copie : ajouter ou
                      //   retirer une entrée au rang ① suit désormais TOUT SEUL.
                      // ⚠ On ne copie toujours PAS `parts` en bloc : il porte des étiquettes de trace
                      //   (niveaux, bandes) qui tripleraient le poids du fantôme — 4 Go mesurés le jour
                      //   où on y a mis des objets. On ne prend que les NOTES des entrées déclarées.
                      eParts: bx.exh?.parts ? Object.fromEntries(
                        Object.values(EXH_FAMILLES_POIDS).flatMap((f) => Object.keys(f))
                          .map((k) => [k, Number.isFinite(bx.exh.parts[k]) ? bx.exh.parts[k] : null])) : null,
                      // ⭐ ET LES VALEURS DES FAMILLES, pas seulement leur NOMBRE : sans elles, aucune
                      //   sonde ne peut dire QUELLE famille porte un score — seulement combien parlent.
                      //   ⚠ 4 nombres, ça reste plat : c'est l'objet `parts` complet qui pesait.
                      eFamV: bx.exh?.familles ?? null,
                      cConv: bx.cont?.conviction ?? null, cVerd: bx.cont?.verdict ?? null,
                      // ⭐⭐⭐ SUR QUELLE ÉCHELLE LA BARRE A-T-ELLE ÉTÉ JUGÉE (2026-08-12). Les trois
                      //   barèmes RETIRENT DE LA SOMME toute famille/entrée entièrement muette ⇒
                      //   l'échelle atteignable vaut `n_présentes × amplitude`, alors que `SEUIL_V1`,
                      //   `MIN_PB` et `MIN_CONT` sont des nombres ABSOLUS. Sans ces trois compteurs,
                      //   deux barres au même score sont indistinguables alors qu'elles n'ont pas été
                      //   jugées sur la même règle — et aucune sonde ne peut poser la question.
                      // ⚠ SCALAIRES, pas les objets `familles`/`muets` : le fantôme doit rester PLAT
                      //   (4 Go mesurés sinon). La question est « combien », la réponse est un nombre.
                      // ⚠ Le rang ② n'a PAS de couche `familles` — il somme 3 ENTRÉES. On compte donc
                      //   ses muets à l'envers ; c'est la même grandeur (le nombre de termes présents),
                      //   pas un second vocabulaire.
                      // 🔴🔥 ET LE COMPTE N'EST VALIDE QUE SI LE BARÈME A TOURNÉ. `refus` non vide =
                      //   critère d'appartenance refusé ⇒ AUCUNE entrée n'a été consultée, et `null`
                      //   est la seule réponse vraie. Le premier jet lisait `3 − muets.length` sans ce
                      //   test et annonçait « 38,6 % des barres notées sur UNE entrée » : plausible, et
                      //   faux — ces barres n'étaient pas notées du tout.
                      // ⚠ `cBonus` / `cRaw` : le rang ③ est le SEUL des trois à être bonifié, et
                      //   `cConv` fond déjà le barème et le bonus. Sans les deux champs, « la barre
                      //   passe-t-elle grâce au barème ou grâce au bonus » est indécidable.
                      cBonus: bx.cont?.bonus ?? null, cRaw: bx.cont?.convRaw ?? null,
                      eFam: bx.exh?.familles ? Object.keys(bx.exh.familles).length : null,
                      pFam: (bx.pb?.refus?.length || !bx.pb?.muets) ? null : 3 - bx.pb.muets.length,
                      // ⭐⭐⭐ LA RAISON DU SILENCE DU ②, ET ELLE A DEUX FORMES OPPOSEES (20/08) :
                      //   `refus` non vide  => un critere d'APPARTENANCE a refuse, le bareme n'a
                      //     JAMAIS ETE CONSULTE. La barre « n'est pas de cette figure ».
                      //   `muets` non vide  => le bareme A tourne, mais des entrees se sont tues.
                      // ⚠⚠ `pFam` ci-dessus RESUME les deux en `null` : il dit « on ne sait pas
                      //   combien », pas POURQUOI. Sans ces deux champs, « le ② n'a pas note » est
                      //   indiscernable de « le ② a note trop bas » — deux choses OPPOSEES, et les
                      //   confondre fait mesurer un seuil sur une population qui ne l'a jamais
                      //   rencontre. C'est la faute que `pbYieldedWhy` avait deja corrigee cote
                      //   moteur le 11/08 ; le fantome, lui, ne la portait pas encore.
                      pRefus: bx.pb?.refus ?? null,
                      pMuets: bx.pb?.muets ?? null,
                      cFam: bx.cont?.familles ? Object.keys(bx.cont.familles).length : null,
                      // ⭐⭐ LES VALEURS DES 5 FAMILLES DU ③, pas seulement leur NOMBRE (20/08).
                      //   `cFam` disait COMBIEN de familles parlent ; il ne pouvait pas dire LAQUELLE
                      //   porte le score. Or c'est exactement la question quand un barema trie un cote
                      //   et pas l'autre. Meme geste et meme argument que `eFamV` pour le rang ① :
                      //   5 nombres restent PLATS — c'est l'objet `parts` complet qui pesait 4 Go.
                      // ⚠ ON NE DERIVE PAS LA LISTE DES CLES ICI : `familles` est deja l'objet que
                      //   `contScoreV1` a construit, donc il suit tout seul un ajout/retrait d'entree.
                      //   Recopier une liste de noms serait la faute « une liste recopiee dans une
                      //   sonde se perime en silence », qui a deja fait mesurer un barema disparu.
                      cFamV: bx.cont?.familles ?? null,
                      // ⭐⭐ `z H4` ET SON `dz`, LES DEUX ENTREES DE LA FAMILLE `zdzH4` (20/08).
                      //   `cFamV.zdzH4` donne la NOTE ; sans ses deux entrees on ne peut pas dire
                      //   QUELLE CASE l'a produite — et une note de 9,74/10 peut venir d'un `z`
                      //   modere qui pousse fort ou d'un `z` extreme qui pousse peu. Deux figures
                      //   opposees, une seule note.
                      // ⚠ `zH4Closed` est la CLOTURE (`zscore_h4`), `dzH4` est l'ecart au LIVE
                      //   (`zscore_h4_s0 - zscore_h4`). La table lit exactement ce couple — ne pas
                      //   y substituer `zscore_h4_s0` seul, ce serait une 3e grandeur.
                      zH4Closed: r2(numStrict(rows[i]?.zscore_h4)),
                      dzH4: (() => { const a = numStrict(rows[i]?.zscore_h4_s0), b = numStrict(rows[i]?.zscore_h4);
                                     return (a == null || b == null) ? null : r2(a - b); })(),
                      // ⭐ CE QUE LA CASCADE A RÉELLEMENT FAIT DE LA BARRE — sans lui on ne peut pas
                      //   distinguer « le PB aurait validé » de « le PB a validé ». C'est l'ÉCART
                      //   entre les deux lectures qui est la mesure, pas l'une des deux.
                      firedStrategy: hasSide ? sel.strategy : null,
                      // ⭐⭐⭐ LE RANG ATTEINT PAR LA CASCADE, EN BOOLÉEN (2026-08-12). Sans lui, la
                      //   population du rang ③ est INDERIVABLE de ce fantôme : `cConv` existe sur
                      //   TOUTES les barres parce que les trois boîtes sont évaluées EN PARALLÈLE —
                      //   il dit « ce que ③ penserait », pas « ce que ③ a reçu ». Les deux diffèrent
                      //   de tout ce que ① et ② ont retenu ou droppé.
                      // ⚠ ON NE LE RECONSTRUIT PAS depuis `eConv`/`pConv` : refaire la cascade dans
                      //   la sonde, c'est recopier un arbre de décision qui change toutes les
                      //   semaines — il a changé DEUX FOIS aujourd'hui. La sonde diverge alors en
                      //   silence, et c'est le motif `derived_dataset_computed_3x`.
                      // ⚠ BOOLÉEN et non le tableau `ranks` : un fantôme doit rester PLAT (4 Go
                      //   mesurés sinon). La question posée est binaire, la réponse aussi.
                      rangCont: (sel?.ranks ?? []).includes("CONT") });
      }
    }
    // ⭐⭐ `opts.ghostExec` — LE RECOUVREMENT DES PORTES D'EXÉCUTION (10/08). Le funnel ne peut pas
    //   y répondre : `heldBy` ne nomme que la PREMIÈRE porte qui retient, donc deux portes qui
    //   retiennent la même barre se lisent comme une seule. Ici on enregistre le verdict de CHACUNE.
    // ⚠ Population = les barres où la DÉTECTION a produit un côté (`rawSelection`), pas `selection` :
    //   `selection` est déjà le résultat des portes, s'en servir reviendrait à conditionner sur ce
    //   qu'on mesure.
    // ⚠⚠ N'A DE SENS QU'AVEC LE TRIGGER ACTIF — sous `NO_TRIGGER`/`NO_TRIGGER`, `DealTrigger` rend
    //   `BYPASS/pass` et le recouvrement mesuré serait vide côté M1, sans que rien ne le signale.
    if (opts.ghostExec && det.execution
        && (det.rawSelection?.side === "BUY" || det.rawSelection?.side === "SELL")) {
      // ⭐⭐ GÉNÉRIQUE, PAS DE CHAMPS NOMMÉS PAR PORTE. Le premier jet écrivait `m5Pass`/`trigPass` :
      //   il a fallu le réécrire dès que le M5 a disparu, et il aurait fallu le réécrire encore à la
      //   séparation `WAIT_TRIGGER`/`WAIT_ZONE`. Une sonde qui nomme les portes vieillit à chaque
      //   changement du tableau — celle-ci le recopie tel qu'il est.
      ghosts.push({ i, ep: s.ep, tsMT: s.tsMT, side: det.rawSelection.side, ghost: "exec",
                    strategy: det.rawSelection.strategy ?? null,
                    portes: det.execution.portes.map((p) => ({ n: p.nom, pass: p.pass, state: p.state })),
                    entry: s.price, atr: s.atr, spreadRaw: s.spread });
    }
    // ⭐ FUNNEL DE DÉCISION (2026-07-31) — l'admission et le spacing étaient comptés, la DÉCISION non.
    //   On ne savait donc pas ce que devient une barre où le fade est refusé : elle finit en WAIT, ou
    //   la CONT la ramasse ? « Un garde qu'on ne compte pas est un garde dont on ne saura jamais s'il
    //   a agi » — la même phrase vaut pour une bifurcation.
    if (sel) {
      const out = hasSide ? `FIRE_${sel.strategy}` : `WAIT_${sel.waitNature ?? "?"}`;
      if (!hasSide) {
        // ⚠ LE MOTIF NE VIT PAS TOUJOURS AU MÊME ENDROIT, et le `?? "?"` du funnel le masquait :
        //   `selection` est le verdict APRÈS `DealTrigger`, et une barre TENUE par le trigger n'a pas
        //   de `waitNature` — c'est `rawSelection` qui porte celui de la couche 3. Sans ce repli,
        //   le second bucket des refus s'appelait « ? » et pesait 1 226 barres : un motif inconnu
        //   qui n'est pas inconnu, juste lu au mauvais endroit.
        const nat = sel.waitNature
                 ?? det.rawSelection?.waitNature
                 ?? (sel.heldBy === "DealTrigger" ? "trigger-hold" : "?");
        dropsSeen[nat] = (dropsSeen[nat] ?? 0) + 1;
        if (dropsSeen[nat] <= DROP_CAP) {
          const g = det.rawSelection?.scoring ?? null;
          drops.push({ i, ep: s.ep, tsMT: s.tsMT, nature: nat, price: s.price,
            // ⚠ `plannedSide` et non `side` : un DROP n'a pas de côté tradé, il a un côté ENVISAGÉ.
            //   Les confondre ferait compter des refus comme des positions dans tout agrégat par côté.
            plannedSide: det.rawSelection?.plannedSide ?? null,
            reasons: sel.reasons ?? det.rawSelection?.reasons ?? [],
            ...((det.rawSelection?.vetoed ?? []).length ? { vetoed: det.rawSelection.vetoed } : {}),
            sc: g ? scoringPayload(g, det.rawSelection) : null });
        } else dropsOmitted[nat] = (dropsOmitted[nat] ?? 0) + 1;
      }
      dec[out] = (dec[out] ?? 0) + 1;
      const er = sel.exhRefused;
      if (er) {
        const k = `exh_refuse[${er.kind}] ${er.by.join("+")} -> ${out}`;
        dec[k] = (dec[k] ?? 0) + 1;
      }
    }
    // ⭐ CAPTURE DU FANTÔME — AVANT le `continue`, sinon la barre est perdue. `suppressedCont` est
    //   posé par `scoringDecision` sur les WAIT `wait-exh` ; `by = ["below-threshold"]` est la
    //   signature EXACTE du refus par SEUIL, celle qui distingue le ricochet `unripe` d'un refus de
    //   TIMING (m5/m15), qui lui n'a rien à voir avec `MIN_EXH`.
    if (opts.ghostUnripe && !hasSide && sel?.waitNature === "wait-exh"
        && sel.suppressedCont?.by?.includes("below-threshold")) {
      ghosts.push({ i, ep: s.ep, tsMT: s.tsMT, side: sel.suppressedCont.side, strategy: "CONT",
                    type: STRAT.CONT ?? "CONT", entry: s.price, atr: s.atr, spreadRaw: s.spread,
                    score: sel.suppressedCont.score, ghost: "unripe",
                    exhScore: sel.scoring?.exh ?? null });
    }
    // ⭐⭐ SECONDE CLASSE DE FANTÔME — `outbid` : LE CONT QUI A PERDU LE CONCOURS CONTRE UN EXH QUI
    //   TIRE. C'est CELLE-CI que vise le chantier des « 529 perdus par ricochet », et la distinction
    //   avec `unripe` n'est pas cosmétique :
    //     · `unripe` = l'EXH était DÉJÀ sous le seuil. Ces barres sont perdues AUJOURD'HUI.
    //     · `outbid` = l'EXH tire ENCORE. Monter `MIN_EXH` au-dessus de son score le fait
    //        basculer en `unripe` — et le CONT de la barre n'est PAS rendu, il est supprimé à son
    //        tour. C'est le ricochet : on croit reprendre une barre au fade, on la perd deux fois.
    //   ⇒ Bander ces fantômes par `exhScore` donne EXACTEMENT ce que coûte chaque cran de seuil,
    //     AVANT de le monter. `contested` garantit qu'un candidat CONT existait vraiment (il a passé
    //     l'incohérence de régime et la porte de cross) ; son côté est le signe de son score.
    if (opts.ghostUnripe && hasSide && sel.strategy === "EXH" && sel.contested
        && Number.isFinite(sel.scoring?.cont) && sel.scoring.cont !== 0) {
      ghosts.push({ i, ep: s.ep, tsMT: s.tsMT, side: sel.scoring.cont > 0 ? "BUY" : "SELL",
                    strategy: "CONT", type: STRAT.CONT ?? "CONT", entry: s.price, atr: s.atr, spreadRaw: s.spread,
                    score: sel.scoring.cont, ghost: "outbid",
                    exhScore: sel.scoring?.exh ?? null });
    }
    if (!hasSide) continue;   // la TRANSITION est désormais un fallback DANS decideSignal (plus de branche ici)
    if (opts.contGate && sel.strategy === "CONT" && opts.contGate(rows, i, sel)) continue;   // gate expérimental (ex: cont-into-rising-maturity) appliqué AU STADE FIRE → le cap réutilise le slot libéré
    if (opts.exhGate && sel.strategy === "EXH" && opts.exhGate(rows, i, sel, det)) continue;   // gate EXH expérimental (ex: exh-vs-daily-angle)
    fires++;
    // type : plus de cas TRANS — la famille `Transitioning` est SUPPRIMÉE du moteur (Matrix `1f798c9`,
    //   mesurée à avgR +0,000 sur 3 973 trades). `sel.profile` ne peut plus valoir "Transitioning".
    //   trans = objet de MarketTransition (diagnostic : quelle CELLULE a tiré). Backtest only.
    //   🎯 `crossoverMaturity` n'y est PAS porté ⇒ impossible d'attribuer un R à FRESH vs CONFIRMED
    //      autrement que par différence de runs. À plomber si on re-mesure la fenêtre (cf. `fa86826`).
    const obs = observeProfile({ vector: det.vector, energy: det.energy, maturity: det.maturity, stoch: det.stoch,
      dominance: det.dominance });
    cands.push({ i, ep: s.ep, tsMT: s.tsMT, side: sel.side, strategy: sel.strategy,
      type: STRAT[sel.strategy] ?? sel.strategy,
      // ⭐ DEUX CHAMPS LÀ OÙ IL N'Y EN AVAIT QU'UN (2026-07-27), parce qu'ils ont cessé de dire la même
      //   chose. `profile` valait le régime c2 gagnant tant que c'était LUI qui décidait ; depuis la
      //   nouvelle couche 3 il vaut la THÈSE retenue (« Continuation » / « Exhaustion »), et le repli
      //   `?? det.marketProfile?.profile` ne se déclenchait donc PLUS JAMAIS — la ventilation par
      //   régime avait silencieusement disparu des stats.
      //   ⚠ `regime` est un DIAGNOSTIC : la couche 2 tourne encore mais ne décide plus rien. Le voir à
      //   côté de la thèse est justement l'intérêt — on lit dans QUELS régimes le nouveau moteur tire,
      //   alors qu'il ne les regarde pas. Un désaccord entre les deux colonnes est une information,
      //   plus une incohérence.
      // ⭐ Porté sur le trade pour qu'on puisse mesurer le SORT des barres où le fade a été refusé.
      exhRef: sel.exhRefused ? { kind: sel.exhRefused.kind, by: sel.exhRefused.by.join("+") } : null,
      // ⚠⚠ `spreadRaw` ET SURTOUT PAS `spread` : `...fireSnapshot(...)` est étalé À LA FIN de ce
      //   littéral et porte `spread: r2(numStrict(row.spread))` — ARRONDI À 2 DÉCIMALES. Il écrasait
      //   donc la valeur exacte, et sur tout le FX (spread ≈ 0,00009) l'arrondi rend **0** : six
      //   actifs facturés à zéro EN SILENCE, avec un A/B qui affichait « aucun changement » sans une
      //   seule erreur. Trouvé parce que six lignes bougeaient de 0,0000 exactement — un résultat
      //   INCHANGÉ après une modif qui devait mordre est un SIGNAL.
      entry: s.price, atr: s.atr, spreadRaw: s.spread, score: sel.score,
      profile: sel.profile ?? null,                       // la THÈSE qui a décidé
      // ⭐ LA CLÉ DE MESURE DU CIRCUIT COURT (2026-07-30). Sans elle, la cohorte du raccourci est
      //   indiscernable d'un fade ordinaire — même `strategy`, même `profile`. Et elle DOIT être
      //   isolable : la phase 0 a mesuré que l'effet du raccourci se décompose en trois populations
      //   de qualités très différentes (création ≈ base, relabel neutre, inversion coûteuse) ; une
      //   moyenne qui les mélange ne dit rien de ce que la règle fait.
      shortcut: sel.shortcut ?? null,
      regime: det.marketProfile?.profile ?? null,          // le régime c2 gagnant (diagnostic)
      regimeConf: det.marketProfile?.confidence ?? null,
      // ⭐ LE DÉTAIL DU SCORING, JUSQU'À LA FICHE DE TRADE (owner 2026-07-28). Sans lui, la seule
      //   façon de savoir POURQUOI un trade a tiré était de rejouer la barre à la main. On porte les
      //   deux totaux, le seuil de la thèse RETENUE, et le global de chaque expert — pas la moyenne
      //   seule : deux experts à +8 et deux à −8 rendent 0, indiscernable de quatre experts muets.
      //   ⚠ STRICTEMENT PASSIF, comme `fireSnapshot` : lecture seule, aucune influence sur la décision.
      sc: det.rawSelection?.scoring ? scoringPayload(det.rawSelection.scoring, sel) : null,
      // ⭐ LES REFUS POSÉS SUR LA BARRE, même quand une thèse a gagné : « l'EXH a été retiré par un
      //   veto pendant que le CONT tirait » est une information qu'on perdait en ne traçant les vetos
      //   que sur les WAIT. Vide dans l'immense majorité des cas — porté seulement s'il y a matière.
      ...((det.rawSelection?.vetoed ?? []).length ? { vetoed: det.rawSelection.vetoed } : {}),
      trans: det.rawSelection?.transition ?? null,
      impulse: obs.impulse ?? null,
      ...fireSnapshot(rows[i], det, obs) });
  }

  // ── PASSE 2 : cap concurrence + walk TP/SL close-to-close ──
  const walk = (c) => {                                        // fallback (pas d'OHLC) — snapshot troué, SANS timeout EOD
    if (c.entry == null || !(c.atr > 0)) return null;
    const sgn = c.side === "BUY" ? 1 : -1;
    const tpDist = tpAtr * c.atr, slDist = slAtr * c.atr;
    const tp = c.entry + sgn * tpDist, sl = c.entry - sgn * slDist;
    for (let j = c.i + 1; j < series.length; j++) {
      const s = series[j];
      if (maxHoldMin > 0 && s.ep - c.ep > maxHoldMin) return finalize(c, s, "TIMEOUT", sgn, slDist);
      if (s.price == null) continue;
      if (sgn > 0 ? s.price >= tp : s.price <= tp) return finalize(c, s, "TP", sgn, slDist, tp);
      if (sgn > 0 ? s.price <= sl : s.price >= sl) return finalize(c, s, "SL", sgn, slDist, sl);
    }
    // pas de TP/SL sur toutes les données → OPEN_END (fin des données)
    let last = c.i; for (let j = c.i + 1; j < series.length; j++) if (series[j].price != null) last = j;
    return finalize(c, series[last], "OPEN_END", sgn, slDist);
  };
  // reason = DÉCLENCHEUR de sortie (TP/SL/TIMEOUT) ; outcome = RÉSULTAT P&L (WIN/LOSS). TP→WIN, SL→LOSS,
  //   TIMEOUT→WIN si R>0 sinon LOSS (une clôture EOD peut finir gagnante ou perdante). Séparés : « pourquoi
  //   c'est sorti » ≠ « ça a rapporté ou coûté » (owner 2026-07-12).
  const finalize = (c, s, reason, sgn, slDist, px) => {
    const exit = px ?? s.price;
    const R = slDist > 0 ? ((exit - c.entry) * sgn) / slDist : 0;
    const outcome = reason === "TP" ? "WIN" : reason === "SL" ? "LOSS" : (R > 0 ? "WIN" : "LOSS");
    return { ...c, exitTs: s.tsMT, exit: +exit.toFixed(6), reason, outcome, R: +R.toFixed(3), barsHeld: s.i - c.i,
             tp: +(c.entry + sgn * (slDist * tpAtr / slAtr)).toFixed(6), sl: +(c.entry - sgn * slDist).toFixed(6) };
  };

  // ── WALK OHLC M1 (gapless, high/low intra-barre) — utilisé si `ohlc` dispo, sinon walk() snapshot ──
  // ⭐🔥🔥 FACTURATION DU SPREAD (opt-in `opts.chargeSpread`, 2026-08-03) — CE QUE LE HARNAIS NE
  //   FACTURAIT PAS DEPUIS TOUJOURS. Les barres M1 de `ExportOHLC_M1` viennent de `CopyRates`, et
  //   MT5 construit ses barres sur les ticks **BID** : il n'existe pas de série ask dans l'historique.
  //   Le simulateur entrait donc au bid et sortait au bid, dans les deux sens.
  //
  // ⭐⭐ LE MODÈLE EST CELUI DE `Neo_TradeExecutor.mq5`, PAS UNE APPROXIMATION EN R. L'exécuteur :
  //     · remplit un BUY à l'**ASK**, un SELL au **BID** (`SymbolInfoDouble`, l. 236-238) ;
  //     · puis RECALCULE SL/TP **depuis ce prix de remplissage** (`sl = price ∓ slDist`, l. 247-258).
  //   Conséquence, et c'est contre-intuitif : **le R de chaque issue reste NOMINAL** (un TP paie
  //   toujours tpDist/slDist). Ce qui change, c'est **QUELLE issue survient** — les deux niveaux sont
  //   décalés d'un spread dans le repère du bid, donc le TP demande un spread de course en plus et
  //   le SL se déclenche un spread plus tôt. ⇒ **C'est le WR qui paie, pas le R/trade.**
  //   ⚠ Retrancher `spread/slDist` du R/trade — le réflexe naturel — modélise la MAUVAISE grandeur.
  //
  //   Décalages, tous exprimés dans le repère BID des barres :
  //     BUY  : remplissage à `bid+s`, clôture sur le BID  ⇒ niveaux inchangés, entrée décalée de +s
  //     SELL : remplissage au `bid`,  clôture sur l'ASK   ⇒ entrée inchangée, niveaux décalés de −s
  // ⚠ `s = 0` quand le flag est absent ⇒ `fill = c.entry` et tous les seuils reviennent à l'identique.
  //   La référence historique reste comparable AU BIT PRÈS. C'est le contrôle qui valide l'ajout.
  // ⚠ LIT `spreadRaw`, JAMAIS `spread` — cf. la note de la construction du candidat : `fireSnapshot`
  //   occupe déjà la clé `spread` avec une valeur ARRONDIE À 2 DÉCIMALES, donc nulle sur tout le FX.
  const spreadOf = (c) => (opts.chargeSpread && Number.isFinite(c.spreadRaw) && c.spreadRaw > 0 ? c.spreadRaw : 0);

  // ⭐🔥 `spreadMode` (owner 2026-08-03) — QUI PAIE LE SPREAD, LE RISQUE OU LE GAIN ?
  //   · "raw" (défaut) — SL/TP posés depuis le remplissage, tels que `Neo_TradeExecutor` les pose
  //     aujourd'hui. Le spread mord DEUX FOIS : le TP demande une course en plus ET le SL se
  //     déclenche une course plus tôt. C'est l'état réel de la prod.
  //   · "sl" — ON ÉLARGIT LE SL DU SPREAD, TP INCHANGÉ. Le SL revient exactement là où il serait
  //     sans spread (BUY : `fill − (slDist+s) = P − slDist`), donc il ne se déclenche plus
  //     prématurément ; le spread n'est plus payé que sur le TP, et le R d'un gain vaut
  //     `tpDist / (slDist + s)` au lieu de `tpDist / slDist`. ⇒ **on paie le broker dans les gains,
  //     plus dans le risque.**
  //   ⭐ MIROIR SANS RIEN AJOUTER : côté SELL, `fill + (slDist+s)` lu en bid (`−s`) redonne aussi
  //     `P + slDist`. Le geste est symétrique par construction, il n'y a pas d'asymétrie à déclarer.
  //   ⚠ Ce n'est PAS gratuit et ce n'est pas un artifice de mesure : élargir le SL élargit le RISQUE
  //     RÉEL. À risque en % constant, la taille de position baisse — c'est ce que traduit le R plus
  //     faible au TP. Le mode ne crée pas d'argent, il déplace qui absorbe le coût.
  const spreadMode = opts.spreadMode ?? "raw";

  const finalizeOHLC = (c, b, reason, sgn, slDist, px, fireMin, fill, sprd, tpDist) => {
    // ⚠ `px` COMME `b.close` SONT EN BID — `px` est le niveau de DÉCLENCHEMENT déjà ramené au bid par
    //   `walkOHLC`. La conversion en prix RÉALISÉ est donc la même dans les deux cas, et elle doit
    //   être faite ICI, une seule fois : un BUY se solde sur le bid, un SELL sur l'ask (= bid + s).
    //   La faire au niveau de l'appelant pour `px` et pas pour `b.close` rendrait les sorties
    //   OPEN_END incohérentes avec les sorties TP/SL — sur le seul côté SELL, donc invisible en agrégat.
    const exitBid = px ?? b.close;
    const exit = exitBid + (sgn > 0 ? 0 : sprd);
    const R = slDist > 0 ? ((exit - fill) * sgn) / slDist : 0;
    const outcome = reason === "TP" ? "WIN" : reason === "SL" ? "LOSS" : (R > 0 ? "WIN" : "LOSS");
    const hold = b.ep - fireMin;
    return { ...c, exitTs: b.ts, exit: +exit.toFixed(6), reason, outcome, R: +R.toFixed(3), barsHeld: hold, closeEp: c.ep + hold,
             fill: +fill.toFixed(6), spreadCharged: sprd,
             // ⚠ `tpDist` REÇU, PLUS DÉDUIT DE `slDist * tpAtr / slAtr` : en mode "sl" le `slDist`
             //   est ÉLARGI du spread, donc la déduction par le ratio donnerait un TP faux.
             tp: +(fill + sgn * tpDist).toFixed(6), sl: +(fill - sgn * slDist).toFixed(6) };
  };
  const walkOHLC = (c) => {
    if (c.entry == null || !(c.atr > 0)) return null;
    const sgn = c.side === "BUY" ? 1 : -1;
    const sprd = spreadOf(c);
    // Remplissage : ASK pour un BUY (bid + spread), BID pour un SELL (inchangé).
    const fill = c.entry + (sgn > 0 ? sprd : 0);
    // ⭐ MODE "sl" : le SL absorbe le spread, le TP ne bouge pas. Cf. la note de `spreadMode`.
    const tpDist = tpAtr * c.atr, slDist = slAtr * c.atr + (spreadMode === "sl" ? sprd : 0);
    // Niveaux posés par l'exécuteur DEPUIS LE REMPLISSAGE, puis ramenés dans le repère BID des barres :
    //   un SELL se clôture sur l'ask, donc son déclenchement se lit à `niveau − spread` en bid.
    const lvlToBid = sgn > 0 ? 0 : -sprd;
    const tp = fill + sgn * tpDist + lvlToBid, sl = fill - sgn * slDist + lvlToBid;
    const fireMin = mtMin(c.tsMT), fireDate = String(c.tsMT).slice(0, 10);
    if (fireMin == null) return null;
    let lo = 0, hi = ohlc.length;                                   // 1re barre M1 STRICTEMENT après l'entrée
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ohlc[mid].ep <= fireMin) lo = mid + 1; else hi = mid; }
    // PAS DE TIMEOUT EOD (owner 2026-07-13) : le trade tient jusqu'à TP ou SL, À TRAVERS LES JOURS (OHLC
    //   continu, week-end inclus). maxHoldMin (0=off par défaut) reste dispo pour un futur maxHoldGreen.
    //   Seule sortie non-TP/SL = OPEN_END (fin des données OHLC dispo) — artefact de bord de fenêtre, à surveiller.
    let last = null;
    for (let j = lo; j < ohlc.length; j++) {
      const b = ohlc[j];
      if (maxHoldMin > 0 && b.ep - fireMin > maxHoldMin) return finalizeOHLC(c, b, "TIMEOUT", sgn, slDist, null, fireMin, fill, sprd, tpDist);
      if (sgn > 0) { if (b.high >= tp) return finalizeOHLC(c, b, "TP", sgn, slDist, tp, fireMin, fill, sprd, tpDist); if (b.low <= sl) return finalizeOHLC(c, b, "SL", sgn, slDist, sl, fireMin, fill, sprd, tpDist); }
      else         { if (b.low <= tp) return finalizeOHLC(c, b, "TP", sgn, slDist, tp, fireMin, fill, sprd, tpDist);  if (b.high >= sl) return finalizeOHLC(c, b, "SL", sgn, slDist, sl, fireMin, fill, sprd, tpDist); }
      last = b;
    }
    return last ? finalizeOHLC(c, last, "OPEN_END", sgn, slDist, null, fireMin, fill, sprd, tpDist) : null;
  };

  // ⚠ `rows` N'EST PAS RENVOYÉ, ET C'EST UNE CONTRAINTE DE MÉMOIRE, PAS UN OUBLI. 19 actifs ×
  //   23 115 lignes × 292 colonnes tenus simultanément font sauter le tas de Node (mesuré : OOM à
  //   4 Go au premier essai du mode portefeuille). Les `rows` ne servent QU'À LA PASSE 1 — ni `walk`
  //   ni `walkOHLC` ne les référencent (le premier lit `series`, le second l'OHLC M1), et
  //   `fireSnapshot` en fait une COPIE plate dans chaque candidat. Ne pas les exposer les rend
  //   collectables dès le retour. `rowsLen` suffit au résumé.
  // ⚠ `drops` REMONTE PAR ICI, et il le fallait : le collecteur vit dans `prepareAsset` (là où les
  //   barres sont évaluées) tandis que la réponse est construite dans `runMatrixBacktest`. Les deux
  //   fonctions ne partagent aucune portée — un `drops` référencé directement au retour lève un
  //   `ReferenceError`, ce que le serveur AVALE en renvoyant un payload silencieusement amputé.
  return { asset, series, cands, ghosts, drops, walk: ohlc ? walkOHLC : walk,
           meta: { tpAtr, slAtr, tpSlSource, fires, evals, adm, dec, hasOhlc: !!ohlc, rowsLen: rows.length,
                   dropCap: DROP_CAP, dropsSeen, dropsOmitted } };
}

/**
 * allocate — PASSE 2, COMMUNE au mono-actif et au portefeuille.
 * Un SEUL carnet, un SEUL cap global, l'espacement live par actif. C'est ici et nulle part ailleurs
 *   qu'on décide quels candidats deviennent des trades.
 *
 * ⭐🔥 LA POLITIQUE D'ATTRIBUTION (owner 2026-07-29) : À MINUTE ÉGALE, LE MEILLEUR SCORE PASSE D'ABORD.
 *   Cette question n'existait pas en mono-actif — la cadence garantit UN candidat par minute et par
 *   actif, donc il n'y avait jamais deux prétendants pour une place. En portefeuille, dix-neuf actifs
 *   peuvent tirer la même minute avec une seule place libre, et l'ordre décide alors d'une partie du
 *   résultat. Le laisser à l'ordre des boucles, ce serait choisir par accident.
 *   ⚠ CONSÉQUENCE VÉRIFIABLE : en mono-actif ce tri ne peut JAMAIS départager quoi que ce soit (un
 *   candidat par minute), donc les chiffres d'avant la refonte doivent être identiques AU BIT PRÈS.
 *   C'est le contrôle qui valide l'extraction — pas une relecture.
 *   ⚠ `score` peut être `null` (candidat sans scoring) ⇒ traité comme 0, il passe en dernier au lieu
 *   de faire remonter `NaN` dans le comparateur et de rendre le tri instable.
 *
 * ⭐ Le carnet porte le SYMBOLE : `checkPositionSpacing` filtre lui-même par actif (P1 same-symbol
 *   same-side, P2 count same-symbol). On lui passe donc le carnet ENTIER, il en tire ce qui le
 *   concerne — exactement comme en live où `openPositions` couvre tous les actifs du compte.
 * @param {Array} prepared  sortie(s) de `prepareAsset`
 */
export function allocate(prepared, opts = {}) {
  const maxOpen = num(opts.maxOpen) ?? 30;
  // Spacing ACTIF par défaut = comme la prod. `spacing:false` sert à MESURER son effet, pas à s'en passer.
  const spacing = opts.spacing !== false;
  // ⭐🔥 PLAFOND PAR ACTIF (owner 2026-07-29). Défaut = celui du live (8). Le MONO-ACTIF le passe à
  //   `maxOpen` : il simule un actif COMME S'IL ÉTAIT TOUT LE COMPTE, donc la seule limite qui ait un
  //   sens pour lui est le cap global. Avec 8, `maxOpen` ne se déclenchait JAMAIS (mesuré :
  //   `rejectedCap = 0` sur les 19 actifs, contre 41 263 rejets P2) — le paramètre affiché dans l'UI
  //   ne bornait rien du tout, et le carnet plafonnait à 8 sans que rien ne le dise.
  //   ⚠ `undefined` ⇒ le module live applique SA constante. On ne surcharge que si on le demande.
  const maxPerSymbol = num(opts.maxPerSymbol) ?? undefined;
  // ⭐🔥 FACTEUR D'ESPACEMENT SURCHARGEABLE (15/08). `undefined` ⇒ le module live applique SA constante
  //   (0.05). Mesuré le 15/08 : à `maxOpen 100 / maxPerSymbol 100`, `rejectedCap = 0` et P1 `TOO_CLOSE`
  //   refuse 7 347 des 10 646 fires — le goulot du dépôt N'EST PLUS la capacité, c'est CE facteur.
  const spacingFactor = num(opts.spacingFactor) ?? undefined;
  const spacingOpts = {};
  if (maxPerSymbol !== undefined) spacingOpts.maxPerSymbol = maxPerSymbol;
  if (spacingFactor !== undefined) spacingOpts.spacingFactor = spacingFactor;

  const cands = [];
  prepared.forEach((p, ai) => { for (const c of p.cands) cands.push({ ...c, _ai: ai, asset: p.asset }); });
  cands.sort((a, b) => (a.ep - b.ep)
    || (Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0))   // ⭐ meilleur score d'abord (owner)
    || (a._ai - b._ai));                                   // départage stable et reproductible
  const book = [];   // positions ouvertes : { exitEp, symbol, side, entry } — requis par le spacing
  const rejSpacing = {};   // funnel du spacing, PAR RAISON (TOO_CLOSE / MAX_POSITIONS_REACHED)
  let openedCount = 0, rejectedCap = 0;
  // ⭐🔥🔥 POSITION SPACING (owner 2026-07-28) — LE GARDE-FOU LIVE QUI MANQUAIT AU BACKTEST.
  //   Le moteur produit des signaux RAPPROCHÉS : sur la même barre H1, la même thèse tire à chaque
  //   évaluation tant que la configuration tient. En LIVE, `checkPositionSpacing` (INVARIANT 10)
  //   empêche ces positions de s'empiler au même prix ; ici, RIEN ne l'empêchait. Le backtest
  //   mesurait donc un moteur AUTORISÉ À FAIRE CE QUE LA PROD INTERDIT.
  //   ⚠ Cas qui l'a fait apparaître — AUDUSD 2026-06-29, 11h01→11h59 : **14 BUY CONT** ouverts dans
  //   l'heure, étalés sur 0,055 % de prix (0,00038 sur 0,690), **14 pertes, −14 R**. Une seule
  //   décision, quatorze fois — et quatorze fois le même SL.
  //   ⭐ ON IMPORTE LE MODULE LIVE, ON NE LE RÉÉCRIT PAS : c'est la règle de ce harnais (« MÊME code
  //   que le live »). Une réimplémentation aurait divergé au premier changement de `SPACING_FACTOR`.
  //   ⚠ P2 PLAFONNE À 8 PAR ACTIF. En MONO-actif c'est lui le cap réel et `maxOpen` ne se déclenche
  //   JAMAIS (mesuré le 29/07 : `rejectedCap = 0` sur les 19 actifs, contre 41 263 rejets P2). En
  //   PORTEFEUILLE les 30 places sont partagées, et `maxOpen` redevient la contrainte qu'il est en live.
  const signals = [];
  for (const c of cands) {
    for (let k = book.length - 1; k >= 0; k--) if (book[k].exitEp <= c.ep) book.splice(k, 1);
    if (book.length >= maxOpen) { rejectedCap++; continue; }
    if (spacing) {
      // Forme attendue par le module live : [{ symbol, side, price_open }].
      const sp = checkPositionSpacing(c.asset, c.side, c.entry,
        book.map((b) => ({ symbol: b.symbol, side: b.side, price_open: b.entry })),
        spacingOpts);
      // Compté PAR RAISON, comme le funnel d'admission — un garde qu'on ne compte pas est un garde
      //   dont on ne saura jamais s'il a agi.
      if (!sp.allowed) { rejSpacing[sp.reason] = (rejSpacing[sp.reason] ?? 0) + 1; continue; }
    }
    const p = prepared[c._ai];
    const res = p.walk(c); if (!res) continue;
    const exitEp = res.closeEp ?? (p.series.find((s) => s.tsMT === res.exitTs)?.ep ?? c.ep);
    res.openEp = c.ep; res.closeEp = exitEp;
    book.push({ exitEp, symbol: c.asset, side: c.side, entry: c.entry }); openedCount++;
    signals.push(res);
  }
  return { signals, openedCount, rejectedCap, rejSpacing };
}

/**
 * runMatrixPortfolio — MODE B (TOUS les actifs, UN carnet).
 * ⭐🔥 CE QUE CE MODE RÉCONCILIE, ET C'EST TOUTE SA RAISON D'ÊTRE. En mono-actif chaque actif dispose
 *   de ses 8 places en permanence et `maxOpen` ne se déclenche JAMAIS (mesuré : `rejectedCap = 0` sur
 *   les 19). Additionné, le harnais autorisait donc jusqu'à ~152 positions simultanées là où le live
 *   en permet 30 — le backtest était PLUS permissif que la prod, pas moins. Ici les 30 places sont
 *   partagées, le cap global mord, et le max drawdown devient celui du PORTEFEUILLE au lieu d'être la
 *   somme de 19 courbes indépendantes.
 * ⚠ L'equity est COMMUNE : le risque par trade se fige sur l'equity réalisée du portefeuille. C'est ce
 *   qui rend le `%` de rendement et le DD comparables au live, et c'est aussi ce qui fait qu'un actif
 *   qui saigne réduit la taille des trades des autres — exactement comme sur le compte.
 *
 * ⚠⚠ CE N'EST PAS LE MODE DU BACKTEST, ET C'EST UNE DÉCISION OWNER (29/07). L'UI et
 *   `/api/matrix/run/:asset` restent en ACTIF PAR ACTIF, volontairement : les deux modes ne répondent
 *   pas à la même question. Par actif = « le moteur produit-il de bons signaux ? », capacité
 *   volontairement infinie pour que rien ne masque l'effet d'un changement de barème — c'est l'outil
 *   des A/B. Portefeuille = « que ferait le compte ? », et il juge le couple moteur + capacité.
 *   ⇒ Aucun ne remplace l'autre. Lire l'un pour l'autre est la seule vraie faute possible ici.
 *
 * 🛠 OUTIL DE LIGNE DE COMMANDE — DEUX CONDITIONS, SANS QUOI LES CHIFFRES SONT FAUX OU LE PROCESS MEURT :
 *     NO_TRIGGER=1 node --max-old-space-size=8192 <script qui l'appelle>
 *   · `NO_TRIGGER=1` : `server.js:8` le pose pour tout le harnais (owner 15/07 — le gate de timing
 *     masque l'effet des changements moteur). Un CLI qui l'oublie mesure un AUTRE moteur : 2 308
 *     fires au lieu de 4 984 sur US_500, soit la moitié. Piège coûteux, constaté le 29/07.
 *   · `--max-old-space-size` : 19 actifs préparés ensemble saturent le tas par défaut (OOM à 4 Go).
 *
 * 📌 CE QU'IL A MESURÉ LE 29/07, et qui justifie de le garder : cap 30 PARTAGÉ ⇒ 83 018 rejets sur
 *   88 367 fires (94 %), 3 592 trades au lieu de 15 753, +13 R, max DD 53 %. Le mono-actif sommé
 *   supposait ~152 positions simultanées (19 × 8) là où le compte en permet 30 : le harnais est plus
 *   PERMISSIF que la prod, pas plus contraint. À carnet saturé, un seuil ne supprime plus des trades,
 *   il change LESQUELS obtiennent les places rares — c'est là que `SCORE_MIN_*` deviendra mesurable.
 * @param {string[]} csvPaths
 */
export function runMatrixPortfolio(csvPaths, opts = {}) {
  const initialEquity = num(opts.initialEquity) ?? 10000;
  const riskPct = num(opts.riskPct) ?? 1.0;
  const maxOpen = num(opts.maxOpen) ?? 30;
  const spacing = opts.spacing !== false;

  const prepared = csvPaths.map((p) => prepareAsset(p, opts)).filter(Boolean);
  if (!prepared.length) return { assets: [], params: opts, summary: { rows: 0 }, signals: [] };
  const { signals, openedCount, rejectedCap, rejSpacing } = allocate(prepared, opts);

  const eq = equityOf(signals, initialEquity, riskPct);
  const wins = signals.filter((s) => s.outcome === "WIN").length;
  const losses = signals.filter((s) => s.outcome === "LOSS").length;
  const sumR = signals.reduce((a, s) => a + s.R, 0);
  const byReason = { TP: 0, SL: 0, TIMEOUT: 0 }, byType = {}, bySide = { BUY: 0, SELL: 0 };
  for (const s of signals) { byReason[s.reason] = (byReason[s.reason] || 0) + 1; byType[s.type] = (byType[s.type] || 0) + 1; bySide[s.side]++; }

  // Ventilation PAR ACTIF, dérivée des mêmes signaux — pas d'un second run. ⭐ C'est la seule façon
  //   de comparer un actif au mono-actif sans confondre « il rapporte moins » et « il a eu moins de
  //   places » : ici le nombre de trades EST le résultat de la concurrence entre actifs.
  const byAsset = {};
  for (const p of prepared) byAsset[p.asset] = { fires: p.meta.fires, evals: p.meta.evals, opened: 0, wins: 0, losses: 0, R: 0 };
  for (const s of signals) {
    const b = byAsset[s.asset]; if (!b) continue;
    b.opened++; b.R += s.R; if (s.outcome === "WIN") b.wins++; else b.losses++;
  }
  for (const b of Object.values(byAsset)) {
    b.R = +b.R.toFixed(2);
    b.winRate = (b.wins + b.losses) ? +(100 * b.wins / (b.wins + b.losses)).toFixed(1) : null;
  }

  return {
    assets: prepared.map((p) => p.asset),
    params: { maxOpen, cadenceMin: num(opts.cadenceMin) ?? 2, spacing, initialEquity, riskPct,
              admission: opts.admission !== false, allocation: "best-score-first",
              // ⭐⭐⭐ LES SEUILS ACTIFS, RENVOYÉS PAR LE SERVEUR — même motif que `chargeSpread`
              //   ci-dessous : sans eux, deux captures identiques raconteraient deux moteurs.
              // 🔴🔥 ET ICI CE N'EST PAS UN CONFORT, C'EST UNE CORRECTION DE MENSONGE : les `MIN_*`
              //   sont lus par `_envNum` via `process.env`, qui N'EXISTE PAS dans le navigateur.
              //   L'UI qui importe le module côté client retombe donc sur les DÉFAUTS (`1000`) et
              //   affiche un seuil que le serveur n'a jamais appliqué. La vérité est côté serveur,
              //   elle doit VOYAGER. ⚠ Ne jamais réafficher un `MIN_*` importé côté navigateur.
              thresholds },
    summary: {
      rows: prepared.reduce((a, p) => a + p.meta.rowsLen, 0),
      evals: prepared.reduce((a, p) => a + p.meta.evals, 0),
      fires: prepared.reduce((a, p) => a + p.meta.fires, 0),
      opened: openedCount, rejectedCap,
      rejSpacing, rejSpacingTotal: Object.values(rejSpacing).reduce((x, y) => x + y, 0),
      wins, losses, byReason,
      winRate: wins + losses ? +(100 * wins / (wins + losses)).toFixed(1) : null,
      avgR: signals.length ? +(sumR / signals.length).toFixed(3) : null,
      totalR: +sumR.toFixed(2),
      initialEquity, finalEquity: +eq.equity.toFixed(2), netPnL: +eq.netPnL.toFixed(2),
      returnPct: +(100 * eq.netPnL / initialEquity).toFixed(2),
      maxDrawdown: +eq.maxDD.toFixed(2), maxDrawdownPct: eq.peak > 0 ? +(100 * eq.maxDD / eq.peak).toFixed(2) : 0,
      profitFactor: eq.gLoss > 0 ? +(eq.gWin / eq.gLoss).toFixed(2) : null,
      byType, bySide, byAsset,
    },
    equityCurve: eq.equityCurve,
    signals,
  };
}

/**
 * equityOf — la courbe d'equity risk-based, EXTRAITE pour être partagée par les deux modes.
 * À l'OPEN on fige risque = riskPct% × equity réalisée ; au CLOSE : equity += R × risque.
 * ⚠ Les opens (k=0) passent avant les closes (k=1) à instant égal — sinon un trade fermé au même
 *   moment financerait le suivant, ce que le compte ne fait pas.
 */
function equityOf(signals, initialEquity, riskPct) {
  const events = [];
  for (const s of signals) { events.push({ t: s.openEp, k: 0, s }); events.push({ t: s.closeEp, k: 1, s }); }
  events.sort((a, b) => a.t - b.t || a.k - b.k);
  let equity = initialEquity, peak = equity, maxDD = 0, netPnL = 0, gWin = 0, gLoss = 0;
  const equityCurve = [{ ts: signals[0]?.tsMT ?? null, equity: +equity.toFixed(2) }];
  for (const ev of events) {
    if (ev.k === 0) { ev.s.riskAmount = (riskPct / 100) * equity; continue; }
    const pnl = ev.s.R * (ev.s.riskAmount ?? 0);
    ev.s.pnl = +pnl.toFixed(2);
    equity += pnl; netPnL += pnl;
    if (pnl > 0) gWin += pnl; else gLoss += -pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity; if (dd > maxDD) maxDD = dd;
    equityCurve.push({ ts: ev.s.exitTs, equity: +equity.toFixed(2), pnl: ev.s.pnl });
  }
  return { equity, peak, maxDD, netPnL, gWin, gLoss, equityCurve };
}

/** runMatrixBacktest — MODE A (un actif). = `prepareAsset` + `allocate([lui])`, sortie inchangée. */
export function runMatrixBacktest(csvPath, opts = {}) {
  const initialEquity = num(opts.initialEquity) ?? 10000;
  const riskPct = num(opts.riskPct) ?? 1.0;       // % de l'equity risqué par trade (SL = 1R). PnL = R × risque.
  const maxOpen = num(opts.maxOpen) ?? 30;
  const spacing = opts.spacing !== false;
  const cadenceMin = num(opts.cadenceMin) ?? 2;
  const maxHoldMin = num(opts.maxHoldMin) ?? 0;
  const admission = opts.admission !== false;

  // ⭐ EN MONO-ACTIF, LE PLAFOND PAR ACTIF = LE CAP GLOBAL (owner 2026-07-29). L'actif est simulé comme
  //   s'il était tout le compte : le borner à 8 revenait à mesurer une capacité qui n'est ni celle du
  //   live (30 partagées) ni celle qu'on croyait paramétrer (`maxOpen`, qui ne se déclenchait jamais).
  //   `opts.maxPerSymbol` reste surchargeable pour retrouver le comportement live sur un seul actif.
  const maxPerSymbol = num(opts.maxPerSymbol) ?? maxOpen;

  const p = prepareAsset(csvPath, opts);
  if (!p) return { asset: null, params: opts, summary: { rows: 0 }, signals: [] };
  const { asset } = p;
  const { tpAtr, slAtr, tpSlSource, fires, evals, adm, dec } = p.meta;
  const { signals: _tousSignaux, openedCount, rejectedCap, rejSpacing } = allocate([p], { ...opts, maxPerSymbol });

  // ══ 🔬 `only` — LE VOILE : NE MONTRER QU'UNE FAMILLE (owner 2026-08-10) ═══════════════════════
  // ⭐⭐⭐ POSÉ **APRÈS** `allocate`, ET C'EST TOUT LE POINT. L'allocation se fait avec TOUTES les
  //   familles en concurrence — l'EXH prend réellement ses créneaux (`maxOpen`, spacing), donc le PB
  //   obtient exactement les places qu'il aurait en vrai. On MASQUE ensuite, on ne re-simule pas.
  //   🔴 Filtrer AVANT l'allocation donnerait au PB des créneaux que l'EXH lui prend : un MIRAGE DE
  //   CAPACITÉ, et le volume validé ne serait pas celui qu'on livrerait.
  // ⭐ Et il est posé AVANT l'equity et le résumé, sinon la liste montrerait le PB pendant que le
  //   `summary`, la courbe et le `maxDD` décriraient encore l'EXH — une page qui se contredit
  //   elle-même sans qu'aucun chiffre ne soit faux isolément.
  // ⚠ CE QUE LA COURBE VEUT DIRE SOUS VOILE : « ce que le PB aurait fait avec les places qui lui
  //   restaient ». Ce n'est PAS « un moteur PB seul » — celui-là aurait toutes les places.
  // ⚠ `CARNET_ONLY` en repli d'environnement pour que le serveur puisse le poser globalement ; le
  //   paramètre d'appel gagne, pour qu'un script puisse mesurer sans dépendre du shell.
  const _only = String(opts.only ?? (typeof process !== "undefined" ? process.env.CARNET_ONLY : "") ?? "").toUpperCase();
  const signals = _only ? _tousSignaux.filter((s) => String(s.strategy).toUpperCase() === _only) : _tousSignaux;

  // ── EQUITY (risk-based, compound) : à l'OPEN on fige risque = riskPct% × equity réalisée ;
  //    au CLOSE : equity += R × risque. PnL en devise sans tickValue. Curve + max drawdown. ──
  const events = [];
  for (const s of signals) { events.push({ t: s.openEp, k: 0, s }); events.push({ t: s.closeEp, k: 1, s }); }
  events.sort((a, b) => a.t - b.t || a.k - b.k);   // opens (k=0) avant closes (k=1) à t égal
  let equity = initialEquity, peak = equity, maxDD = 0, netPnL = 0, gWin = 0, gLoss = 0;
  const equityCurve = [{ ts: signals[0]?.tsMT ?? null, equity: +equity.toFixed(2) }];
  for (const ev of events) {
    if (ev.k === 0) { ev.s.riskAmount = (riskPct / 100) * equity; }
    else {
      const pnl = ev.s.R * (ev.s.riskAmount ?? 0);
      ev.s.pnl = +pnl.toFixed(2);
      equity += pnl; netPnL += pnl;
      if (pnl > 0) gWin += pnl; else gLoss += -pnl;
      if (equity > peak) peak = equity;
      const dd = peak - equity; if (dd > maxDD) maxDD = dd;
      equityCurve.push({ ts: ev.s.exitTs, equity: +equity.toFixed(2), pnl: ev.s.pnl });
    }
  }

  // ── résumé ──
  const wins = signals.filter((s) => s.outcome === "WIN").length;
  const losses = signals.filter((s) => s.outcome === "LOSS").length;   // wins+losses = TOUS les trades (outcome binaire)
  const byReason = { TP: 0, SL: 0, TIMEOUT: 0 };                       // déclencheur de sortie (indépendant du P&L)
  for (const s of signals) byReason[s.reason] = (byReason[s.reason] || 0) + 1;
  const sumR = signals.reduce((a, s) => a + s.R, 0);
  const byType = {}, bySide = { BUY: 0, SELL: 0 };
  for (const s of signals) { byType[s.type] = (byType[s.type] || 0) + 1; bySide[s.side]++; }

  return {
    asset,
    // ⭐⭐⭐ LES REFUS, ÉCHANTILLONNÉS — la population non biaisée, enfin regardable.
    drops: p.drops ?? [],
    // tpSlSource : d'où vient le couple (config actif / défaut univers / override d'étude) — sans ça, on ne
    //   sait pas ce qui a tourné, et un balayage se confond avec une config.
    // ⚠ `chargeSpread` RENVOYÉ : un run facturé n'est comparable à AUCUN chiffre publié du dépôt.
    //   S'il n'était pas dans la réponse, l'UI ne pourrait pas le dire et deux captures d'écran
    //   identiques raconteraient deux moteurs différents.
    // ⚠ `thresholds` : voir le bloc du retour multi-actifs — les `MIN_*` ne survivent PAS au passage
    //   navigateur (`process.env` absent ⇒ défauts `1000`), donc c'est le serveur qui les dit.
    params: { tpAtr, slAtr, tpSlSource, maxOpen, cadenceMin, maxHoldMin, initialEquity, riskPct, admission, spacing, chargeSpread: !!opts.chargeSpread, thresholds },
    summary: {
      rows: p.meta.rowsLen, evals, fires, opened: openedCount, rejectedCap,
      // Funnel Admission par label (hours / tick_low) + total.
      //   admHours/admTick gardés en alias : des scripts d'analyse les lisent.
      adm, admHours: adm.hours, admTick: adm.tick_low, dec,
      // Funnel SPACING par raison + total — même doctrine que l'admission : un garde non compté est
      //   un garde dont on ne sait pas s'il agit.
      rejSpacing, rejSpacingTotal: Object.values(rejSpacing).reduce((x, y) => x + y, 0),
      admBlocked: Object.values(adm).reduce((a, b) => a + b, 0),
      // ⚠ CE QUI A ÉTÉ ÉCARTÉ DE L'ÉCHANTILLON DE DROP, PAR MOTIF. Un plafond silencieux se lit
      //   comme une couverture complète — celui-ci se déclare, motif par motif.
      dropCap: p.meta.dropCap, dropsSeen: p.meta.dropsSeen, dropsOmitted: p.meta.dropsOmitted,
      wins, losses, byReason,
      winRate: wins + losses ? +(100 * wins / (wins + losses)).toFixed(1) : null,
      avgR: signals.length ? +(sumR / signals.length).toFixed(3) : null,
      totalR: +sumR.toFixed(2),
      // devise (risk-based)
      initialEquity, finalEquity: +equity.toFixed(2), netPnL: +netPnL.toFixed(2),
      returnPct: +(100 * netPnL / initialEquity).toFixed(2),
      maxDrawdown: +maxDD.toFixed(2), maxDrawdownPct: peak > 0 ? +(100 * maxDD / peak).toFixed(2) : 0,
      profitFactor: gLoss > 0 ? +(gWin / gLoss).toFixed(2) : null,
      byType, bySide,
    },
    equityCurve,
    signals,
    // 🔴🔥 `ghosts` REMONTE PAR ICI — SANS CETTE LIGNE LES COLLECTEURS OPT-IN SONT INVISIBLES.
    //   `prepareAsset` les remplit (`ghostAllExh`, `ghostBoxes`, `ghostUnripe`) et son retour les
    //   expose, mais `runMatrixBacktest` reconstruit un payload CHAMP PAR CHAMP : ils s'arrêtaient
    //   là. Une sonde qui lit `r.ghosts` recevait `undefined`, donc ZÉRO — ce qui se lit « l'option
    //   ne collecte rien » et non « le champ n'est pas propagé ». Vécu le 10/08, et c'est le même
    //   motif que la whitelist `scoringPayload` : un producteur correct, un intermédiaire muet.
    //   ⚠ Les sondes existantes appelaient `prepareAsset` DIRECTEMENT, ce qui masquait le trou.
    // ⭐ Neutre par défaut : sans option de collecte, `ghosts` est un tableau VIDE.
    ghosts: p.ghosts ?? [],
  };
}

// CLI : node src/components/simulations/matrixBacktest.mjs data/matrix/ETHUSD.csv
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("matrixBacktest.mjs")) {
  const csvPath = process.argv[2] || "data/matrix/ETHUSD.csv";
  const r = runMatrixBacktest(csvPath, {});
  console.log(`\n=== ${r.asset} — Matrix backtest (${JSON.stringify(r.params)}) ===`);
  console.log(JSON.stringify(r.summary, null, 2));
  console.log(`\n-- 10 premiers signaux --`);
  for (const s of r.signals.slice(0, 10)) console.log(`${s.tsMT}  ${s.side.padEnd(4)} ${s.type.padEnd(12)} entry ${s.entry}  ${s.outcome.padEnd(4)} ${s.reason.padEnd(7)} R=${s.R}  (${s.barsHeld}min)`);
}
