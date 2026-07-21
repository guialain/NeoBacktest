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
import { detectOpportunity } from "../../../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { observeProfile } from "../../../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js";
import { createSpikeTracker } from "../../../../Matrix-Revolution/src/components/robot/engines/opportunities/SpikeGuard.js";
import GlobalMarketHours from "../../../../Matrix-Revolution/src/components/robot/engines/trading/GlobalMarketHours.js";
import { getTickFlowConfig, computeMeanTick5s } from "../../../../Matrix-Revolution/src/config/TickFlowConfig.js";
import { getTpSl } from "../../../../Matrix-Revolution/src/config/TpSlConfig.js";

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
    plusDiRegime: regimeOf(pdi, pdi2, pdi3, DI_BAND),
    minusDiRegime: regimeOf(mdi, mdi2, mdi3, DI_BAND),
    // ⭐ ORIENTÉ PAR LE SENS DU TRADE — c'est CETTE lecture qui porte le signal, pas la brute.
    //   Le DI a un SENS (contrairement à l'ADX) : un spread qui monte est haussier → bon pour un BUY,
    //   mauvais pour un SELL. Mesurer BUY et SELL ensemble les fait S'ANNULER (mesuré 17/07 : régimes
    //   bruts tous collés à la base ; orientés, TURN_WITH ressort à toutes les bandes).
    //   WITH/AGAINST = installé · TURN_WITH = la pression VIENT DE basculer en sens · TURN_AGAINST = contre.
    spreadRegimeRel: (rs.side === "BUY" || rs.side === "SELL")
      ? relRegime(spr1, spr2, spr3, rs.side === "BUY" ? 1 : -1, SPREAD_BAND) : null,
    // ── RSI (bare = CLOSE ; _s0 = live intra-barre — cf convention de nommage, ne jamais confondre)
    rsiH1: r2(numStrict(row?.rsi_h1)), rsiH4: r2(numStrict(row?.rsi_h4)), rsiM15: r2(numStrict(row?.rsi_m15)),
    rsiD1: r2(numStrict(row?.rsi_d1)), dRsiH1: r2(numStrict(row?.drsi_h1)),
    // ── STOCH per-TF : k, d, séparation, et le cross (ÉVÉNEMENT, per-TF — pas un vote)
    kH1: r2(h1.k), dH1: r2(h1.d), kdH1: (h1.k != null && h1.d != null) ? r2(h1.k - h1.d) : null,
    kM15: r2(m15.k), dM15: r2(m15.d), kdM15: (m15.k != null && m15.d != null) ? r2(m15.k - m15.d) : null,
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
          if (mk.some((x) => x == null) || md.some((x) => x == null)) return { m15CrossAge: null, m15KD: null };
          const mg = mk.map((k, i) => k - md[i]);
          let ca = null; for (let i = 0; i < 3; i++) if (mg[i] * mg[i + 1] < 0) { ca = i; break; }
          return { m15CrossAge: ca, m15KD: +mg[0].toFixed(2) };
        })(),
      };
    })(),
    zoneH1: h1.zone ?? null, crossFreshH1: h1.crossFresh === true, crossDeepH1: h1.crossDeep === true,
    crossFreshM15: m15.crossFresh === true, kdH4: r2(h4.kd), separation: r2(st.separation), dLevel: r2(st.dLevel),
    // ── ENERGY / MATURITY
    bbwH1: r2(e?.perTf?.h1?.bbw), bbwM15: r2(e?.perTf?.m15?.bbw), bbwDynH1: e?.perTf?.h1?.dyn ?? null,
    tick: r2(e.tick), energyScore: r2(e.score), maturityScore: r2(m.score), maturityState: m.state ?? null,
    // ── CONTEXTE brut
    zscoreH1: r2(numStrict(row?.zscore_h1)), wrH1: r2(numStrict(row?.wr_h1)),
    slopeD1: r2(numStrict(row?.slope_d1)), intradayChange: r2(numStrict(row?.intraday_change)),
    spread: r2(numStrict(row?.spread)),
  };
}
const STRAT = { CONT: "CONTINUATION", EXH: "EXHAUSTION", RANGE: "RANGE" };

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
//    NON répliqués, volontairement : Weekend et whitelist — les barres de l'archive sont déjà en séance
//    ouvrable sur des actifs tradés.
export function admissionBlock(row, asset) {
  // Gate 1 — heures de marché (UTC, comme GlobalMarketHours.getHour)
  const market = resolveMarket(row?.assetclass);
  const now = new Date(row?.ts_utc ?? row?.timestamp);
  if (!Number.isNaN(now.getTime())) {
    const h = GlobalMarketHours.check(market, now, asset);
    if (h && h.allowed === false) return "hours";
  }
  // Gate 3 — tick low (marché mort ; ⟺ Energy DEAD). null = passthrough safe.
  const mean5s = computeMeanTick5s(row);
  if (mean5s !== null) {
    const p20 = getTickFlowConfig(asset, row?.assetclass)?.tf_5s?.p20;
    if (typeof p20 === "number" && mean5s < p20) return "tick_low";
  }
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

export function runMatrixBacktest(csvPath, opts = {}) {
  const maxOpen = num(opts.maxOpen) ?? 30;
  const cadenceMin = num(opts.cadenceMin) ?? 2;
  const maxHoldMin = num(opts.maxHoldMin) ?? 0;   // 0 = jusqu'à la fin du jour
  const initialEquity = num(opts.initialEquity) ?? 10000;
  const riskPct = num(opts.riskPct) ?? 1.0;       // % de l'equity risqué par trade (SL = 1R). PnL = R × risque.
  const admission = opts.admission !== false;      // true (défaut) = applique les gates heures + tick_low

  const rows = loadCsvRows(csvPath);
  if (!rows.length) return { asset: null, params: opts, summary: { rows: 0 }, signals: [] };
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
    return { ep: Number.isFinite(ep) ? Math.round(ep / 60000) : null, price: num(r.price), atr: num(r.atr_h1), atrLive: num(r.atr_h1), day: String(r.ts_utc ?? r.timestamp).slice(0, 10), tsMT: r.timestamp, i: 0 };
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
  let lastEp = -1e9, fires = 0, evals = 0;
  const adm = { hours: 0, tick_low: 0 };   // funnel Admission, par label
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
      const blk = admissionBlock(rows[i], asset);
      if (blk) { adm[blk] = (adm[blk] ?? 0) + 1; continue; }
    }
    // État inter-barres, MÊME code que le live (MatrixEngine) : anti-spike observe AVANT (il ne
    //   dépend que de la row, pas du verdict). C'est désormais le SEUL état, ici comme en prod.
    spikeTracker.observe(rows[i]);
    let det;
    try {
      det = detectOpportunity(rows[i], asset, {
        spike: spikeOn ? spikeTracker.state(rows[i]) : null,
      });
    } catch { continue; }
    const sel = det.selection;
    const hasSide = sel?.side === "BUY" || sel?.side === "SELL";
    if (!hasSide) continue;   // la TRANSITION est désormais un fallback DANS decideSignal (plus de branche ici)
    if (opts.contGate && sel.strategy === "CONT" && opts.contGate(rows, i, sel)) continue;   // gate expérimental (ex: cont-into-rising-maturity) appliqué AU STADE FIRE → le cap réutilise le slot libéré
    if (opts.exhGate && sel.strategy === "EXH" && opts.exhGate(rows, i, sel, det)) continue;   // gate EXH expérimental (ex: exh-vs-daily-angle)
    fires++;
    // type : plus de cas TRANS — la famille `Transitioning` est SUPPRIMÉE du moteur (Matrix `1f798c9`,
    //   mesurée à avgR +0,000 sur 3 973 trades). `sel.profile` ne peut plus valoir "Transitioning".
    //   trans = objet de MarketTransition (diagnostic : quelle CELLULE a tiré). Backtest only.
    //   🎯 `crossoverMaturity` n'y est PAS porté ⇒ impossible d'attribuer un R à FRESH vs CONFIRMED
    //      autrement que par différence de runs. À plomber si on re-mesure la fenêtre (cf. `fa86826`).
    const obs = observeProfile({ vector: det.vector, energy: det.energy, maturity: det.maturity, stoch: det.stoch });
    cands.push({ i, ep: s.ep, tsMT: s.tsMT, side: sel.side, strategy: sel.strategy,
      type: STRAT[sel.strategy] ?? sel.strategy,
      entry: s.price, atr: s.atr, score: sel.score, profile: sel.profile ?? det.marketProfile?.profile ?? null,
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
  const finalizeOHLC = (c, b, reason, sgn, slDist, px, fireMin) => {
    const exit = px ?? b.close;
    const R = slDist > 0 ? ((exit - c.entry) * sgn) / slDist : 0;
    const outcome = reason === "TP" ? "WIN" : reason === "SL" ? "LOSS" : (R > 0 ? "WIN" : "LOSS");
    const hold = b.ep - fireMin;
    return { ...c, exitTs: b.ts, exit: +exit.toFixed(6), reason, outcome, R: +R.toFixed(3), barsHeld: hold, closeEp: c.ep + hold,
             tp: +(c.entry + sgn * (slDist * tpAtr / slAtr)).toFixed(6), sl: +(c.entry - sgn * slDist).toFixed(6) };
  };
  const walkOHLC = (c) => {
    if (c.entry == null || !(c.atr > 0)) return null;
    const sgn = c.side === "BUY" ? 1 : -1;
    const tpDist = tpAtr * c.atr, slDist = slAtr * c.atr;
    const tp = c.entry + sgn * tpDist, sl = c.entry - sgn * slDist;
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
      if (maxHoldMin > 0 && b.ep - fireMin > maxHoldMin) return finalizeOHLC(c, b, "TIMEOUT", sgn, slDist, null, fireMin);
      if (sgn > 0) { if (b.high >= tp) return finalizeOHLC(c, b, "TP", sgn, slDist, tp, fireMin); if (b.low <= sl) return finalizeOHLC(c, b, "SL", sgn, slDist, sl, fireMin); }
      else         { if (b.low <= tp) return finalizeOHLC(c, b, "TP", sgn, slDist, tp, fireMin);  if (b.high >= sl) return finalizeOHLC(c, b, "SL", sgn, slDist, sl, fireMin); }
      last = b;
    }
    return last ? finalizeOHLC(c, last, "OPEN_END", sgn, slDist, null, fireMin) : null;
  };

  cands.sort((a, b) => a.ep - b.ep);
  const book = [];   // exitEp des positions ouvertes
  let openedCount = 0, rejectedCap = 0;
  const signals = [];
  for (const c of cands) {
    for (let k = book.length - 1; k >= 0; k--) if (book[k] <= c.ep) book.splice(k, 1);
    if (book.length >= maxOpen) { rejectedCap++; continue; }
    const res = ohlc ? walkOHLC(c) : walk(c); if (!res) continue;
    const exitEp = res.closeEp ?? (series.find((s) => s.tsMT === res.exitTs)?.ep ?? c.ep);
    res.openEp = c.ep; res.closeEp = exitEp;
    book.push(exitEp); openedCount++;
    signals.push(res);
  }

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
    // tpSlSource : d'où vient le couple (config actif / défaut univers / override d'étude) — sans ça, on ne
    //   sait pas ce qui a tourné, et un balayage se confond avec une config.
    params: { tpAtr, slAtr, tpSlSource, maxOpen, cadenceMin, maxHoldMin, initialEquity, riskPct, admission },
    summary: {
      rows: rows.length, evals, fires, opened: openedCount, rejectedCap,
      // Funnel Admission par label (hours / tick_low) + total.
      //   admHours/admTick gardés en alias : des scripts d'analyse les lisent.
      adm, admHours: adm.hours, admTick: adm.tick_low,
      admBlocked: Object.values(adm).reduce((a, b) => a + b, 0),
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
