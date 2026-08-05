// IndicatorsPage.jsx — lecture des capteurs pour UNE ligne du dataset, sur les 4 TF (owner 2026-07-25).
// --------------------------------------------------------------------------------------------
// But : voir ce que le moteur VOIT sur une barre donnée, avant de brancher les nouveaux classificateurs.
//
// ⭐ RÈGLE : les bandes viennent des FONCTIONS DU MOTEUR importées cross-repo (SSOT), JAMAIS d'une
//   recopie locale. Un jour où l'UI recalculait un dérivé de son côté, elle a divergé du moteur en
//   silence (cf. `derived_dataset_computed_3x`). Ici `zscoreBand` / `stochZone` / `kdDistanceBand` /
//   `kdCycleState` / `adxLevelBand` sont ceux d'OpportunityDetector.js.
//
// ⚠ ADX : l'EA n'exporte `adx14_*` QUE pour h1 et m15. D1/H4 affichent « non exporté » — un tiret
//   silencieux laisserait croire à une valeur nulle, ce qui est exactement le piège `num("")=0`.
import { useEffect, useState } from "react";
import { T, Panel, N, TH, TD } from "./ui.jsx";
import ScoringTable from "./scoring/ScoringTable.jsx";
// ⭐⭐⭐ LA DÉCISION, PAS SEULEMENT LES CAPTEURS (2026-08-05). Cette page répondait à « que VOIT le
//   moteur sur cette barre » et s'arrêtait là — or depuis la refonte en trois rangs, voir les
//   capteurs ne suffit plus à comprendre un verdict : le CÔTÉ vient du profil, un veto ROUTE ou TUE
//   selon son `kind`, et une barre peut traverser trois rangs avant d'atterrir. On appelle donc le
//   moteur pour de vrai, sur la row affichée.
// ⚠ ON PASSE PAR `detectOpportunity` ET NON PAR `decideFromScoring` DIRECTEMENT : c'est lui qui
//   construit `gate` et le ranking `c2` à partir de la row. Les reconstruire ici serait une recopie
//   locale d'un dérivé du moteur — exactement ce que l'en-tête de ce fichier interdit
//   (`derived_dataset_computed_3x`), et la page divergerait en silence.
// ⚠ `decide` est REQUIS depuis la suppression de `decideSignal` (05/08) : sans injection, l'appel
//   lève. C'est voulu — un repli silencieux ferait mesurer un décideur que le moteur n'utilise plus.
import { detectOpportunity } from "../../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { decideFromScoring, MIN_EXH, MIN_PRES, MIN_PB, MIN_CONT }
  from "../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js";
import { MODES } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/modes.js";
import {
  stochZone, kdDistanceBand, kdCycleState, adxLevelBand,
  deltaKBand, adxTurnBand, diGapBand, diGapDynamics, diLevelBand, diDeltaLive,
} from "../../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
// ⭐ LE ZSCORE SE LIT CHEZ SON EXPERT (owner 2026-07-27), plus chez le moteur. `zscoreBand`/`deltaZBand`
//   ont été SUPPRIMÉS : cette page était leur unique consommateur, et ils affichaient une lecture que
//   rien d'autre n'utilisait — coupure `0,65` mesurée comme n'étant PAS une frontière (60 % de
//   relâchement avant, 57 % après), et un Δz BRUT qui donnait le sens INVERSE de l'expert sur 30,7 %
//   des barres (l'expert oriente : `Δz × signe(z)`, donc `_UP` = « l'élastique se tend », pas « z monte »).
//   La page expliquait donc le score avec un autre capteur que celui qui le produit.
import { zLevel, zDeltaCol } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/experts/zscoreExpert.js";
// ⛔ COLONNE « DOMAINE FADE » RETIRÉE LE 2026-08-05 — `range` N'EST PLUS UN EXPERT DU FADE.
//   `SCORING_WEIGHT.EXH` vaut `k · di · zscore · kd · rsi · slope` : ni `range`, ni `energy`. La
//   colonne affichait donc une bande de fade (`rangeExhLevel`, domaines p10/p67/p75 selon que la
//   bougie va avec ou contre le camp) pour un expert qui ne score plus cette thèse — c'est-à-dire
//   qu'elle EXPLIQUAIT LE SCORE AVEC UN CAPTEUR QUI NE LE PRODUIT PAS, exactement la faute que le
//   bloc ci-dessous reproche à l'ancienne lecture du zscore. Le `rangeRatio` brut et `bodyLevel`
//   RESTENT : ils servent la continuation, où `range` pèse toujours 0,2.
// ⚠ La justification d'origine est conservée ci-dessous parce qu'elle reste vraie DU MOMENT où elle
//   a été écrite (29/07) — c'est le monde qui a changé, pas le raisonnement.
// ⭐ RANGE — `rangeRatio` (% du p75 d'ATR de l'ACTIF et du TF) et `bodyLevel` viennent de l'expert ;
//   `rangeExhLevel` vient du scorer de FADE, parce que depuis la refonte du 29/07 les deux thèses ne
//   découpent plus le même axe : la continuation garde les quintiles par TF (`rangeLevel`), le fade
//   a deux repères de marché absolus (p10 · p67 · p75) et DEUX DOMAINES selon que la bougie va avec
//   ou contre le camp. Afficher `rangeLevel` ici expliquerait le score du fade avec la bande d'un
//   autre expert — exactement la faute qui a fait supprimer `zscoreBand` de cette page.
import { rangeRatio, bodyLevel } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/experts/rangeExpert.js";
// ⭐ RSI — le septième expert (30/07), affiché ici depuis le 31/07. `rsiZone` distingue les deux
//   côtés de 50 pour l'ŒIL ; le barème, lui, replie le haut sur le bas et ne connaît que la
//   magnitude. On montre donc la zone signée (ce que l'utilisateur lit sur un graphe) à côté d'un
//   score calculé sur l'axe replié — les deux disent la même chose, dans deux repères.
import { rsiZone, rsiDeltaCol } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/experts/rsiExpert.js";
// ⭐ LE DOMAINE DE TF VIENT DU MOTEUR (`SCORER_TFS`), pas d'un booléen local comme `tf.adx`. Ce
//   dernier décrit une contrainte d'EXPORT (l'EA ne sort l'ADX qu'en h1/m15) ; ici c'est un choix de
//   l'expert, et il doit pouvoir changer à un seul endroit.
import { SCORER_TFS } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js";

const TFS = [
  { id: "d1", label: "D1", adx: false },
  { id: "h4", label: "H4", adx: false },
  { id: "h1", label: "H1", adx: true },
  { id: "m15", label: "M15", adx: true },
];

// "" / null → null (JAMAIS 0 : un capteur absent lu 0 a déjà coûté deux bugs majeurs).
const num = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

// Largeur de bande et sa dynamique — MÊMES formules qu'en couche 1 et dans `scoringInputs`, non
//   exportées là-bas. ⚠ Deux lignes d'arithmétique, aucune bande, aucun seuil : la classification
//   reste chez l'expert. Le jour où le moteur les exporte, ceci disparaît.
const BBW_DYN_SLOT = { m15: 9, h1: 15, h4: 30 };
const bbwOf = (row, tf) => {
  const sg = num(row?.[`sigma_${tf}`]), mid = num(row?.[`middle_${tf}`]);
  return (sg === null || mid === null || mid === 0) ? null : (4 * sg / mid) * 100;
};
const dBbwPct = (row, tf) => {
  const now = bbwOf(row, tf);
  if (now === null) return null;
  const prev = num(row?.[`bbw_${tf}_s${BBW_DYN_SLOT[tf]}min`]);
  return (prev === null || prev === 0) ? null : +((now - prev) / prev * 100).toFixed(4);
};
const f = (v, d = 2) => (v == null ? "—" : v.toFixed(d));

// Couleur par famille de bande : froid = bas/serré, chaud = haut/étendu, gris = neutre/absent.
const BAND_COLOR = {
  EXTREME_LOW: "#4493f8", EXTREME_LOWER: "#4493f8", EXTREME_BASSE: "#4493f8",
  LOW: "#5fa8d3", LOWER: "#5fa8d3", BASSE: "#5fa8d3",
  MEDIUM: "#8b949e", NEUTRAL: "#8b949e", MID: "#8b949e", STABLE: "#8b949e",
  HIGH: "#d29922", UPPER: "#d29922", HAUTE: "#d29922", DIVERGING: "#d29922",
  EXTREME_HIGH: "#f85149", EXTREME_UPPER: "#f85149", EXTREME_HAUTE: "#f85149", EXTREME: "#f85149",
  CONTACT: "#3fb950", CONVERGING: "#5fa8d3", CROSS: "#f85149",
  // zones RSI (31/07) — `EXTREME_LOWER`/`EXTREME_UPPER` étaient DÉJÀ là (bandes partagées) ; seules
  //   les quatre intermédiaires manquaient. Même rampe froid→chaud, aucun ton nouveau.
  STRONG_LOWER: "#5fa8d3", SOFT_LOWER: "#7fa8bd",
  SOFT_UPPER: "#bfa05e", STRONG_UPPER: "#d29922",
  // écart DI (signé, même convention froid→chaud que zone/zscore) et sa dynamique
  STRONG_SELL: "#4493f8", SOLID_SELL: "#5fa8d3", WEAK_SELL: "#7fa8bd", BALANCED: "#8b949e",
  WEAK_BUY: "#bfa05e", SOLID_BUY: "#d29922", STRONG_BUY: "#f85149",
  NARROWING: "#5fa8d3", WIDENING: "#d29922",
  // dominanceTurn — vert = la pression se renforce, rouge = elle s'érode (non signé : c'est la MAGNITUDE)
  RISING: "#3fb950", TURN_UP: "#8dc891", TURN_DOWN: "#e08b7d", FALLING: "#f85149",
  // échelle de VITESSE signée (deltaKBand / deltaZBand) — froid = baisse, chaud = hausse, gris = flat
  EXPLOSIVE_DOWN: "#4493f8", FAST_DOWN: "#5fa8d3", SOFT_DOWN: "#7fa8bd",
  FLAT: "#8b949e",
  SOFT_UP: "#bfa05e", FAST_UP: "#d29922", EXPLOSIVE_UP: "#f85149",
};

// ⚠ COMPACT (owner 2026-07-26) : 14 colonnes doivent tenir sans défilement horizontal. Les pastilles
//   sont le poste le plus large — police et padding réduits, sans toucher aux LIBELLÉS : abréger
//   `EXTREME_LOW` en `EX_LO` ferait gagner de la place au prix de la lisibilité.
function Band({ v }) {
  if (!v) return <span style={{ color: T.ink3, fontSize: 13 }}>—</span>;
  const c = BAND_COLOR[v] ?? T.ink2;
  return (
    <span style={{ color: c, background: c + "1f", border: `1px solid ${c}55`, borderRadius: 5,
      padding: "1px 5px", fontSize: 10.5, fontWeight: 600, letterSpacing: 0.1, whiteSpace: "nowrap" }}>{v}</span>
  );
}

// 🔴 PLACEHOLDER — un delta dont la BANDE n'est pas encore calibrée. On montre la valeur (elle est
//   exacte) et on DIT que la classification manque, plutôt que d'inventer des seuils ou de laisser
//   croire que la colonne est finie. Même parti pris que le bandeau « barèmes non définis ».
const DeltaTBD = ({ v, on }) => {
  if (!on) return <span style={{ color: T.ink3, fontSize: 12, fontStyle: "italic" }}>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 550,
        color: v == null ? T.ink3 : v >= 0 ? T.green : T.red }}>
        {v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}`}
      </span>
      <span style={{ color: T.amber, fontSize: 9.5, opacity: 0.7, fontStyle: "italic" }}>à calibrer</span>
    </span>
  );
};

const Val = ({ children, dim }) => (
  <span style={{ fontVariantNumeric: "tabular-nums", color: dim ? T.ink3 : T.ink,
    marginRight: 5, fontSize: 13, fontWeight: 550 }}>{children}</span>
);

// ⭐ `jump` (owner 2026-07-29) — `{ ts, n }` posé par un clic sur un signal du backtest. `n` est un
//   compteur, PAS de la décoration : sans lui, recliquer le MÊME signal ne rechargerait rien (la
//   dépendance d'effet ne verrait aucun changement) alors que l'utilisateur a navigué entre-temps.
export default function IndicatorsPage({ asset, jump }) {
  const [data, setData] = useState(null);
  const [idx, setIdx] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // `q` = querystring déjà formée ("" = dernière ligne, "?i=" index, "?ts=" horodatage).
  const fetchRow = (q) => {
    if (!asset) return;
    setBusy(true); setErr("");
    fetch(`http://localhost:3001/api/matrix/row/${asset}${q}`)
      .then((r) => r.json())
      .then((j) => { if (j.error) throw new Error(j.error); setData(j); setIdx(j.index); })
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setBusy(false));
  };
  const load = (i) => fetchRow(i == null ? "" : `?i=${i}`);
  // Saut par horodatage : le serveur prend la 1re ligne >= à la valeur demandée (le scan n'a pas
  //   forcément une ligne à la minute exacte — marché fermé, trou de collecte).
  const goTo = (date, hh, mm) => fetchRow(`?ts=${encodeURIComponent(`${date}T${hh}:${mm}:00Z`)}`);

  // Changement d'actif OU saut demandé depuis un signal. Sans `jump`, on charge la dernière ligne.
  //   ⚠ La navigation MANUELLE dans la page (flèches, sélecteurs) ne redéclenche pas cet effet — elle
  //   ne touche ni `asset` ni `jump.n` — donc l'affichage ne « revient » pas en arrière tout seul.
  useEffect(() => {
    setData(null);
    if (jump?.ts) fetchRow(`?ts=${encodeURIComponent(jump.ts)}`);
    else load(null);
    /* eslint-disable-next-line */
  }, [asset, jump?.n]);

  const row = data?.row;
  const total = data?.total ?? 0;

  // Les sélecteurs SUIVENT la ligne chargée (pas d'état parallèle qui dériverait de l'affichage).
  const cur = row?.ts_utc ? String(row.ts_utc) : null;
  const selDate = cur ? cur.slice(0, 10) : "";
  const selHH = cur ? cur.slice(11, 13) : "00";
  const selMM = cur ? cur.slice(14, 16) : "00";
  const minDate = data?.firstTs ? String(data.firstTs).slice(0, 10) : undefined;
  const maxDate = data?.lastTs ? String(data.lastTs).slice(0, 10) : undefined;
  const pad2 = (n) => String(n).padStart(2, "0");

  // Une ligne de table par TF. Tout passe par les classificateurs du moteur.
  const lines = TFS.map((tf) => {
    const open = num(row?.[`open_${tf.id}_s0`]);
    const close = num(row?.[`close_${tf.id}_s0`]);
    const high = num(row?.[`high_${tf.id}_s0`]);
    const low = num(row?.[`low_${tf.id}_s0`]);
    const chg = (open != null && close != null) ? close - open : null;
    const chgPct = (chg != null && open) ? (chg / open) * 100 : null;

    const z = num(row?.[`zscore_${tf.id}_s0`]);
    const k = num(row?.[`stoch_k_${tf.id}_s0`]);
    const d = num(row?.[`stoch_d_${tf.id}_s0`]);
    const k1 = num(row?.[`stoch_k_${tf.id}_s1`]);
    const d1 = num(row?.[`stoch_d_${tf.id}_s1`]);
    const k2 = num(row?.[`stoch_k_${tf.id}_s2`]);
    const d2 = num(row?.[`stoch_d_${tf.id}_s2`]);
    const kd = (k != null && d != null) ? k - d : null;
    const kdPrev = (k1 != null && d1 != null) ? k1 - d1 : null;
    // s2 sert UNIQUEMENT à dater l'état de la barre précédente : kdCycleState compare deux barres,
    //   donc l'état EN s1 se lit sur le couple (s1, s2). Ça donne la TRANSITION s1 → s0.
    const kd2 = (k2 != null && d2 != null) ? k2 - d2 : null;

    // ΔK = s0 − s1 (`stoch_k_*_s1` existe sur les 4 TF).
    const dK = (k != null && k1 != null) ? k - k1 : null;
    // Δz = s0 − s1. ⭐ La forme NUE `zscore_{tf}` EST le shift 1 — exactement ce que `_s1` désigne
    //   pour le stochastique (même shift chez l'EA). Le D1 était le seul TF sans elle : comblé par
    //   l'EA v8.39 côté live, et par `stats/add_zscore_d1.mjs` côté historique (reconstruction
    //   Bollinger(20) validée contre l'EA à 0,00005 près, 19/19 actifs).
    const zPrev = num(row?.[`zscore_${tf.id}`]);
    const dZ = (z != null && zPrev != null) ? z - zPrev : null;
    const hasDz = zPrev != null;

    // ── RSI (expert 7, CONT seule) ──────────────────────────────────────────────────────────────
    // ⭐ MÊME CONSTRUCTION QUE LE ZSCORE, ET C'EST DÉLIBÉRÉ : la forme NUE du CSV vaut la CLÔTURE,
    //   `_s0` vaut le live. Le barème lit donc `rsiClosed` (établi) et `dRsi = s0 − clôture` (ce qui
    //   se passe maintenant) — aucun terme commun, contrairement à l'identité `z_s0 = z_s1 + Δz`
    //   démontée le 29/07.
    // 🔴 `rsi_{tf}_s1` EXISTE MAIS EST INUTILISABLE : absent en h4, rempli sur 21,4 % des lignes en
    //   h1, et là où il existe il diffère de la forme nue sur 13,6 % des cas. On ne s'en sert pas —
    //   ici comme dans le moteur, `dRsi` se construit contre la forme NUE.
    const rsiClosed = num(row?.[`rsi_${tf.id}`]);
    const rsiLive = num(row?.[`rsi_${tf.id}_s0`]);
    const dRsi = (rsiLive != null && rsiClosed != null) ? +(rsiLive - rsiClosed).toFixed(2) : null;

    // ── RANGE, VERSION FADE (refonte owner 2026-07-29) ─────────────────────────────────────────
    // ⭐ On affiche ce que l'expert LIT VRAIMENT, dans son ordre de décision : le ratio au p75, le
    //   camp (`signe(zClosed)`), le sens de la bougie PAR RAPPORT au camp, puis le domaine qui en
    //   découle. Sans le camp à l'écran, « CTR » et « EXT » sur la même bougie sont indéchiffrables :
    //   c'est le camp qui décide lequel des deux domaines s'applique.
    // ⚠ `rangeRatio` a besoin de l'ACTIF (p75 d'ATR par actif × TF). Si `asset` manque, il rend
    //   `null` et la colonne dit « — » : jamais 0, ce serait lu comme « range nul ».
    const rgRatio = rangeRatio({ open, high, low, symbol: asset, tf: tf.id });
    const span = (high != null && low != null) ? high - low : null;
    const bodyPct = (span > 0 && chg != null) ? Math.abs(chg) / span * 100 : null;
    const bodyBand = bodyLevel(bodyPct);
    // Camp = `signe(zClosed)`, comme Energy. `zPrev` EST `zscore_{tf}`, donc la clôture.
    const camp = (zPrev == null || zPrev === 0) ? null : Math.sign(zPrev);
    // ⚠ `chg === 0` compte comme AVEC le camp (le rejet), pas comme un contre-pied — même règle que
    //   `rangeExhScore`. La recopier ici est un risque de divergence assumé et SIGNALÉ : la page ne
    //   peut pas appeler le scorer, qui ne rend qu'un score et pas le domaine choisi.
    const against = (camp == null || chg == null) ? null : (chg !== 0 && Math.sign(chg) !== camp);

    // s0 = bougie EN FORMATION (EA v8.37, présent à partir du 18/07 seulement). Avant, le moteur
    //   est structurellement aveugle à la bougie en cours pendant toute sa durée.
    const a0 = tf.adx ? num(row?.[`adx14_${tf.id}_s0`]) : null;
    const a1 = tf.adx ? num(row?.[`adx14_${tf.id}_c1`]) : null;
    const a2 = tf.adx ? num(row?.[`adx14_${tf.id}_c2`]) : null;
    // 3e close : `dominanceTurn` compare DEUX deltas (c1−c2 et c2−c3), il en faut donc trois.
    const a3 = tf.adx ? num(row?.[`adx14_${tf.id}_c3`]) : null;
    const dAdx = (a1 != null && a2 != null) ? a1 - a2 : null;
    const dAdx2 = (a2 != null && a3 != null) ? a2 - a3 : null;

    // DI — exportés sur les mêmes TF que l'ADX (h1/m15). Le c2 sert la dynamique de l'écart.
    // s0 = bougie EN FORMATION. Sert le NIVEAU ; l'écart et sa dynamique restent sur les closes.
    const dp0 = tf.adx ? num(row?.[`plus_di_${tf.id}_s0`]) : null;
    const dm0 = tf.adx ? num(row?.[`minus_di_${tf.id}_s0`]) : null;
    const dp1 = tf.adx ? num(row?.[`plus_di_${tf.id}_c1`]) : null;
    const dm1 = tf.adx ? num(row?.[`minus_di_${tf.id}_c1`]) : null;
    const dp2 = tf.adx ? num(row?.[`plus_di_${tf.id}_c2`]) : null;
    const dm2 = tf.adx ? num(row?.[`minus_di_${tf.id}_c2`]) : null;
    // c3 ne sert qu'à dater l'état PRÉCÉDENT : la dynamique compare deux barres, donc l'état EN c2
    //   se lit sur le couple (c2, c3). Ça donne la séquence c2 → c1.
    const dp3 = tf.adx ? num(row?.[`plus_di_${tf.id}_c3`]) : null;
    const dm3 = tf.adx ? num(row?.[`minus_di_${tf.id}_c3`]) : null;

    return {
      // ⭐ `zPrev` EXPOSÉ (2026-07-29) : c'est l'entrée RÉELLE du ZScore Expert v3, qui lit le niveau
      //   sur la bougie FERMÉE. Il était calculé ici depuis toujours et jamais sorti — la page
      //   n'aurait donc pas pu montrer ce qui score. `z` (s0) reste exposé : c'est le fait de marché
      //   le plus frais, mais ce n'est PAS ce qui entre dans le barème.
      tf, chg, chgPct, z, zPrev, k, kd, kdPrev, a0, a1, dAdx, dK, dZ, hasDz,
      turn: adxTurnBand(dAdx, dAdx2),   // bande morte 1,0 — fonction du MOTEUR, pas une recopie
      // ⚠ ÉCART EN LIVE lui aussi (owner 2026-07-26) : sinon le gap affiché ne vaut PAS la
      //   différence des deux niveaux affichés — vu sur CRUDEOIL 25/07, DI+ 31,1 et DI− 13,4
      //   donnaient 17,6 à l'œil alors que la colonne gap montrait +5,6 (deux instants).
      //   Les seuils tiennent : distributions live et close quasi identiques (p35 −5,5 / −5,6).
      gap: (dp0 ?? dp1) != null && (dm0 ?? dm1) != null ? +((dp0 ?? dp1) - (dm0 ?? dm1)).toFixed(2) : null,
      gapBand: diGapBand(dp0 ?? dp1, dm0 ?? dm1),                       // 5 bandes signées [−23 · −5,5 · +5,5 · +23]
      // Séquence : état LIVE (s0 vs c1, corrigé) précédé de l'état de la dernière close (c1 vs c2).
      // ⚠ La dynamique QUI SCORE est celle des CLOSES : lue en live elle est muette 65 % du temps
      //   (bougie sans extension de range ⇒ les deux DI décroissent pareil ⇒ delta corrigé nul).
      gapDynClose: diGapDynamics(dp1, dm1, dp2, dm2),     // c1 vs c2 — celle du barème
      gapDynPrev:  diGapDynamics(dp2, dm2, dp3, dm3),     // c2 vs c3 — pour la séquence
      // ── LA FAMILLE DI, camp par camp ────────────────────────────────────────────────────────
      //   ⭐ `diLevelBand` sert les DEUX camps : leurs distributions sont identiques (p35 15,1
      //   contre 15,0 · p95 32,9 contre 32,4), donc une seule échelle [7 · 15 · 21 · 33].
      //   🔴 Les DELTAS n'ont PAS de classificateur : on affiche la valeur brute, la bande reste
      //   à calibrer sur distribution comme les autres. Placeholder assumé, pas un oubli.
      // ⭐ NIVEAU lu en LIVE (`_s0`), repli sur la close — même politique que l'ADX. Les bandes
      //   `[7 · 14,5 · 20,5 · 32]` sont calibrées SUR LE LIVE : les DI décroissent de 13,3 % à chaque
      //   ouverture, ce qui décale toute la distribution live de ~0,7 pt vers le bas.
      //   ⚠ L'ÉCART reste sur les closes et garde ses seuils : la contraction touche les deux DI
      //   pareillement et s'annule presque dans leur différence.
      diPlus: dp0 ?? dp1, diMinus: dm0 ?? dm1,
      diPlusBand: diLevelBand(dp0 ?? dp1), diMinusBand: diLevelBand(dm0 ?? dm1),
      diLive: dp0 != null && dm0 != null,
      // ⚠ LIVE CORRIGÉ, pas `s0 − c1` nu : ce dernier est négatif 73,5 % du temps par pure
      //   décroissance (les DI × 0,867 à chaque ouverture). On retire ce qui était déjà écrit.
      dDiPlus:  diDeltaLive(dp0, dp1),
      dDiMinus: diDeltaLive(dm0, dm1),
      // ⚠ `zBand` est la TENSION `|z|` en 6 barreaux (NO_TENSION…SNAPPED), pas un niveau signé : le
      //   côté est porté à part, comme chez l'expert. `dZBand` est ORIENTÉ et calibré sur la médiane
      //   de SA ligne — d'où le second argument.
      // ⭐🔥 LUS SUR `zPrev`, PAS SUR `z` (2026-07-29). L'expert v3 lit le niveau à la CLÔTURE, parce
      //   que `z_s0 = z_s1 + Δz` est une IDENTITÉ : sur `z_s0`, le barreau affiché pouvait être
      //   déplacé par le Δz affiché juste à côté. Les garder sur `s0` ferait expliquer le score par
      //   une lecture que le barème n'utilise pas — la faute déjà corrigée en supprimant
      //   `zscoreBand`/`deltaZBand` (cf. en-tête).
      zBand: zLevel(zPrev), kBand: stochZone(k),
      kdBand: kdDistanceBand(kd),
      // ⚠ `rsiClosed`/`dRsi` portent EXACTEMENT les noms des paramètres de `rsiExpertScore` — c'est
      //   ce qui permet de relire `scoringScales` et cette page côte à côte sans traduire. Le %K n'a
      //   pas eu cette chance (`kdBand` ici, `kdDist` chez l'expert) et ça a vidé sa colonne en
      //   silence le 31/07.
      rsiClosed, rsiLive, dRsi,
      rsiBand: rsiZone(rsiClosed),
      dRsiCol: rsiDeltaCol(dRsi),
      // ⭐🔥 LA LECTURE FERMÉE DU CYCLE (v5, 2026-07-29). L'expert %K score la zone et le camp sur la
      //   bougie FERMÉE — « les faits passés jugent le présent » — et garde ΔK en live. `k1`/`kdPrev`
      //   étaient calculés ici depuis toujours et jamais sortis : la page ne pouvait donc pas montrer
      //   ce qui score, exactement comme pour `zPrev` avant ce matin.
      //   ⚠ `kBand` (live) N'EST PAS TOUCHÉE : elle décrit, et le K/D Expert comme les deux tables
      //   d'exhaustion la lisent toujours en live. Deux instants nommés, un seul classificateur.
      kClosed: k1,
      kBandClosed: stochZone(k1),
      kdClosed: kdPrev,
      kdDistClosed: kdDistanceBand(kdPrev),
      dKBand: deltaKBand(dK), dZBand: zDeltaCol(dZ * Math.sign(zPrev || 0), zLevel(zPrev)),
      // ⚠ `z`, `dZ` et `kd` sont DÉJÀ dans la liste compacte plus haut — ils étaient redéclarés ici
      //   avec leur commentaire, donc trois clés en DOUBLE dans le même objet littéral (repéré par
      //   `vite build` le 29/07 : « Duplicate key »). Sans effet aujourd'hui — même variable, même
      //   valeur, la seconde gagne — mais c'est un bug en puissance : modifier UNE des deux
      //   occurrences ne changerait rien, en silence. Les clés sont retirées, la doc reste.
      //     `z` · `dZ`  BRUTS : le ZScore Expert bande lui-même — `|z|` en 6 barreaux et `Δz`
      //                 calibré PAR NIVEAU n'existent nulle part ailleurs dans le moteur.
      //     `kd`        écart SIGNÉ K−D : oriente le K/D Expert.
      kdDyn: kdCycleState(kd, kdPrev),          // état EN s0  (couple s0/s1)
      kdDynPrev: kdCycleState(kdPrev, kd2),     // état EN s1  (couple s1/s2)
      // ⭐🔥 NIVEAU LU SUR LE LIVE (owner 2026-07-26). À 11h52 on ne qualifie pas la pression avec
      //   l'ADX d'une bougie terminée depuis 52 minutes — on lit la bougie EN COURS.
      //   ⚠ Le moteur affirme en commentaire que « l'ADX d'une bougie en formation ne suit pas la
      //   même distribution » : MESURÉ FAUX sur 107 335 lignes (19→25/07). p5/p35/p50/p65/p95 =
      //   15,7/24,6/28,5/33,0/53,8 en s0 contre 15,8/24,7/28,4/33,0/53,0 en c1 — identiques au
      //   dixième. Les bandes [16·24·33·55] valent pour les deux, aucune recalibration.
      //   La BANDE change tout de même sur 17,5 % des barres (8,8 % plus haut, 8,8 % plus bas).
      //   🔴 REPLI SUR c1 quand s0 est absent — c'est le cas AVANT LE 18/07, soit l'essentiel de la
      //   fenêtre de backtest : l'effet de ce changement n'y est pas mesurable.
      // ── ENERGY (owner 2026-07-28) — largeur de bande et sa variation, BRUTES.
      //   L'expert bande lui-même (cf. zscore) : ni `bbw` ni `Δbbw` n'ont de classificateur dans le
      //   moteur, c'est `energyLevel`/`energyDyn` qui les coupent — et le niveau a besoin de l'ACTIF.
      //   ⚠ H1 SEUL : `bbw_m15_s9min` / `bbw_h4_s30min` n'existent pas. Les autres TF resteront vides.
      bbw: bbwOf(row, tf.id),
      dBbw: dBbwPct(row, tf.id),
      // ── RANGE (owner 2026-07-28) — l'OHLC BRUT de la bougie EN FORMATION (s0). L'expert dérive
      //   tout : ratio au p75 de l'ATR de l'ACTIF et du TF, part du corps, puis bande lui-même.
      //   ⚠ M15 restera vide : l'expert ne sert que h1/h4/d1 (décision owner).
      open, high, low, close,
      rgRatio, bodyPct, bodyBand, camp, against,
      adxBand: tf.adx ? adxLevelBand(a0 ?? a1) : null,
      adxBandClose: tf.adx ? adxLevelBand(a1) : null,   // référence, pour comparer à l'écran
    };
  });

  // ⚠ TH/TD viennent de `ui.jsx` (2026-07-26) : la table de scoring doit avoir EXACTEMENT la même
  //   géométrie, et deux jeux de styles copiés divergent toujours.

  // Horodatage : « 2026-07-23T03:16:00Z » → date et heure séparées, pour un affichage lisible de loin.
  const tsUtc = row?.ts_utc ? String(row.ts_utc) : null;
  const tsDate = tsUtc ? tsUtc.slice(0, 10) : null;
  const tsTime = tsUtc ? tsUtc.slice(11, 19) : null;

  return (
    <Panel
      title={`Indicateurs — ${asset ?? "—"}`}
      extra={<span style={{ fontSize: 13, color: T.ink3, fontVariantNumeric: "tabular-nums" }}>
        {idx == null ? "—" : `ligne ${idx + 1} / ${total}`}</span>}
      flex={1}
      bodyStyle={{ padding: 18, overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}
    >
      {/* ── HORODATAGE — l'information de repère la plus consultée : on la met en gros, pas en coin ── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap",
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 15, color: T.ink2, fontVariantNumeric: "tabular-nums" }}>{tsDate ?? "—"}</span>
          <span style={{ fontSize: 30, fontWeight: 700, color: T.ink, letterSpacing: -0.5,
            fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{tsTime ?? "—"}</span>
          <span style={{ fontSize: 13, color: T.ink3, letterSpacing: 0.4 }}>UTC</span>
        </div>
        {row?.timestamp && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, paddingLeft: 18,
            borderLeft: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.6 }}>heure MT5</span>
            <span style={{ fontSize: 17, color: T.ink2, fontVariantNumeric: "tabular-nums" }}>{row.timestamp}</span>
          </div>
        )}
        <div style={{ marginLeft: "auto", fontSize: 13, color: T.ink3, fontVariantNumeric: "tabular-nums" }}>
          {idx == null ? "" : `${idx + 1} / ${total}`}
        </div>
      </div>

      {/* ── ALLER À une date / heure / minute (UTC) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px" }}>
        <span style={{ fontSize: 12, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.6 }}>aller à</span>

        <input type="date" value={selDate} min={minDate} max={maxDate} disabled={busy || !total}
          onChange={(e) => e.target.value && goTo(e.target.value, selHH, selMM)}
          style={{ background: T.surface, color: T.ink, border: `1px solid ${T.borderHi}`, borderRadius: 8,
            padding: "8px 12px", fontSize: 15, fontFamily: "inherit", colorScheme: "dark" }} />

        <select value={selHH} disabled={busy || !selDate}
          onChange={(e) => goTo(selDate, e.target.value, selMM)}
          style={{ background: T.surface, color: T.ink, border: `1px solid ${T.borderHi}`, borderRadius: 8,
            padding: "8px 10px", fontSize: 15, fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={pad2(h)}>{pad2(h)}</option>)}
        </select>
        <span style={{ color: T.ink3, fontSize: 17, marginLeft: -4, marginRight: -4 }}>:</span>
        <select value={selMM} disabled={busy || !selDate}
          onChange={(e) => goTo(selDate, selHH, e.target.value)}
          style={{ background: T.surface, color: T.ink, border: `1px solid ${T.borderHi}`, borderRadius: 8,
            padding: "8px 10px", fontSize: 15, fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}>
          {Array.from({ length: 60 }, (_, m) => <option key={m} value={pad2(m)}>{pad2(m)}</option>)}
        </select>

        <span style={{ fontSize: 13, color: T.ink3 }}>
          {minDate && maxDate ? `dataset ${minDate} → ${maxDate}` : ""}
        </span>
      </div>

      {/* Navigation dans le dataset */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {[["⏮ −100", -100], ["← −1", -1], ["+1 →", 1], ["+100 ⏭", 100]].map(([lbl, step]) => (
          <button key={lbl} type="button" disabled={busy || idx == null}
            onClick={() => load(Math.max(0, Math.min(total - 1, idx + step)))}
            style={{ background: "transparent", color: T.ink2, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: "7px 14px", fontSize: 14, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>{lbl}</button>
        ))}
        <button type="button" onClick={() => load(null)} disabled={busy}
          style={{ background: "transparent", color: T.ink2, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: "7px 14px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>dernière</button>
        <input type="range" min={0} max={Math.max(0, total - 1)} value={idx ?? 0} disabled={!total}
          onChange={(e) => setIdx(Number(e.target.value))}
          onMouseUp={(e) => load(Number(e.target.value))}
          onTouchEnd={(e) => load(Number(e.target.value))}
          style={{ flex: 1, minWidth: 200, accentColor: T.blue, height: 22 }} />
      </div>

      {err && <div style={{ color: T.red, fontSize: 14 }}>{err}</div>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <TH w={40} dense>TF</TH>
              <TH dense>change</TH>
              {/* ⭐ `s1` ANNONCÉ DANS L'EN-TÊTE (2026-07-29) : la valeur GROSSE est celle de la bougie
                  FERMÉE, qui est l'entrée du barème. Le `s0` la suit en gris — plus frais, mais il
                  ne score pas. Sans cette distinction, la colonne montrait un nombre et le score en
                  utilisait un autre. */}
              <TH dense>zscore <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s1 · (s0)</span></TH>
              <TH dense>Δz <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0−s1</span></TH>
              {/* ⭐ Même grammaire que le zscore : la valeur GROSSE est celle qui SCORE, l'autre suit
                  en gris. ⚠ MAIS ELLE S'INVERSE ICI DEPUIS LA v6 (31/07) — le Cycle lit la zone ET le
                  camp en `s0`. Le zscore reste, lui, sur la clôture. Deux experts, deux instants :
                  c'est précisément pour ça que l'en-tête nomme le shift au lieu de dire « valeur ». */}
              <TH dense>K level <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0 · (s1)</span></TH>
              <TH dense>ΔK <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0−s1</span></TH>
              <TH dense>K/D gap signé <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0 · (s1)</span></TH>
              <TH dense>K/D dynamique <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s1 → s0</span></TH>
              {/* ❌ COLONNES ADX RETIRÉES (owner 2026-07-26) : `ADX live`, `ADX c1`, `ΔADX`, `Δ live`.
                  Le pivot est assumé — on suit les DI, pas l'ADX. ⚠ Le Pressure Expert LIT ENCORE
                  `adxBand` et `turn` : son score reste calculé, seul l'affichage disparaît.
                  `dominanceTurn` est gardé, c'est la dernière visibilité sur ce que l'expert consomme. */}
              <TH dense>DI+ level <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0 · [7·14,5·20,5·32]</span></TH>
              <TH dense>ΔDI+ <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0−c1 corrigé</span></TH>
              <TH dense>DI− level <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>même échelle</span></TH>
              <TH dense>ΔDI− <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0−c1 corrigé</span></TH>
              <TH dense>Gap DI <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0 · [5,5 · 10 · 23]</span></TH>
              <TH dense>Dynamic Gap DI <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>Δ|écart| · c2 → c1</span></TH>
              {/* ── RANGE, VERSION FADE (2026-07-29) — trois colonnes, dans l'ordre de décision de
                  l'expert : combien de course la bougie a faite, de quel côté elle va par rapport au
                  camp, et quel domaine en résulte. ⚠ Le M15 restera vide : l'expert est en H1 seul. */}
              {/* ⭐ RSI (31/07) — même grammaire que le zscore : la CLÔTURE score, le `s0` suit en
                  gris. La zone affichée est SIGNÉE (`rsiZone`, six bandes 15·30·50·70·85) alors que
                  le barème replie le haut sur le bas ; c'est l'écran qui parle le repère du trader.
                  ⚠ h1 et h4 SEULEMENT — D1/M15 restent vides, c'est le domaine de l'expert. */}
              <TH dense>RSI <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>clôture · (s0)</span></TH>
              <TH dense>ΔRSI <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0−clôture · [0,95·3,09·6]</span></TH>
              <TH dense>Range s0 <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>% du p75 · corps</span></TH>
              <TH dense>Camp <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>signe(z s1) · bougie</span></TH>
            </tr>
          </thead>
          <tbody>
            {lines.map((L) => (
              <tr key={L.tf.id}>
                <TD dense><span style={{ fontWeight: 700, color: T.ink, fontSize: 14, letterSpacing: 0.2 }}>{L.tf.label}</span></TD>

                <TD dense>
                  <Val>{L.chgPct == null ? "—" : `${L.chgPct >= 0 ? "+" : ""}${f(L.chgPct)} %`}</Val>
                  <span style={{ color: T.ink3, fontSize: 11 }}>{L.chg == null ? "" : `(${L.chg >= 0 ? "+" : ""}${f(L.chg, 5)})`}</span>
                </TD>

                {/* La bande suit `s1` : c'est le barreau que l'expert applique réellement. */}
                <TD dense>
                  <Val>{f(L.zPrev)}</Val>
                  <span style={{ color: T.ink3, fontSize: 11, marginRight: 9 }}>
                    {L.z == null ? "" : `(${f(L.z)})`}
                  </span>
                  <Band v={L.zBand} />
                </TD>

                <TD dense>
                  {L.hasDz
                    ? <><span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 550,
                        color: L.dZ == null ? T.ink3 : L.dZ >= 0 ? T.green : T.red, marginRight: 9 }}>
                        {L.dZ == null ? "—" : `${L.dZ >= 0 ? "+" : ""}${f(L.dZ)}`}
                      </span><Band v={L.dZBand} /></>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>pas de s1</span>}
                </TD>

                {/* La bande suit `s1` : c'est le barreau que le Cycle v5 applique réellement. */}
                <TD dense>
                  <Val>{f(L.k, 1)}</Val>
                  <span style={{ color: T.ink3, fontSize: 11, marginRight: 9 }}>
                    {L.kClosed == null ? "" : `(${f(L.kClosed, 1)})`}
                  </span>
                  <Band v={L.kBand} />
                </TD>

                <TD dense>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 550,
                    color: L.dK == null ? T.ink3 : L.dK >= 0 ? T.green : T.red, marginRight: 9 }}>
                    {L.dK == null ? "—" : `${L.dK >= 0 ? "+" : ""}${f(L.dK, 1)}`}
                  </span>
                  <Band v={L.dKBand} />
                </TD>

                {/* ⭐ v6 (31/07) : c'est le gap LIVE qui porte le camp du Cycle (`K > D` ⇒ achat dans
                    le corps), comme pour le K/D Expert. Le fermé passe en gris — il n'a plus qu'un
                    lecteur, `vetoGate`, dont les règles ne s'affichent pas ici. */}
                <TD dense>
                  <Val>{L.kd == null ? "—" : `${L.kd >= 0 ? "+" : ""}${f(L.kd)}`}</Val>
                  <span style={{ color: T.ink3, fontSize: 11, marginRight: 9 }}>
                    {L.kdClosed == null ? "" : `(${L.kdClosed >= 0 ? "+" : ""}${f(L.kdClosed)})`}
                  </span>
                  <Band v={L.kdBand} />
                </TD>

                <TD dense>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span style={{ opacity: L.kdDynPrev && L.kdDynPrev !== L.kdDyn ? 0.85 : 0.45 }}>
                      <Band v={L.kdDynPrev} />
                    </span>
                    <span style={{ color: L.kdDynPrev && L.kdDyn && L.kdDynPrev !== L.kdDyn ? T.amber : T.ink3,
                      fontSize: 13, fontWeight: 700 }}>→</span>
                    <Band v={L.kdDyn} />
                  </span>
                </TD>

                {/* ── FAMILLE DI — niveau de chaque camp, puis leur écart ──────────────────── */}
                <TD dense>
                  {L.tf.adx
                    ? <><Val>{f(L.diPlus, 1)}</Val><Band v={L.diPlusBand} /></>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>non exporté</span>}
                </TD>

                {/* 🔴 PLACEHOLDER : valeur brute, bande non calibrée. */}
                <TD dense><DeltaTBD v={L.dDiPlus} on={L.tf.adx} /></TD>

                <TD dense>
                  {L.tf.adx
                    ? <><Val>{f(L.diMinus, 1)}</Val><Band v={L.diMinusBand} /></>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>non exporté</span>}
                </TD>

                <TD dense><DeltaTBD v={L.dDiMinus} on={L.tf.adx} /></TD>

                <TD dense>
                  {L.tf.adx
                    ? <><Val>{L.gap == null ? "—" : `${L.gap >= 0 ? "+" : ""}${f(L.gap, 1)}`}</Val><Band v={L.gapBand} /></>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>non exporté</span>}
                </TD>

                {/* SÉQUENCE c2 → c1, même présentation que `K/D dynamique` : la flèche passe en
                    ambre quand l'état CHANGE — c'est là que l'écart s'inverse. */}
                <TD dense>
                  {L.tf.adx
                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ opacity: L.gapDynPrev && L.gapDynPrev !== L.gapDynClose ? 0.85 : 0.45 }}>
                          <Band v={L.gapDynPrev} />
                        </span>
                        <span style={{ color: L.gapDynPrev && L.gapDynClose && L.gapDynPrev !== L.gapDynClose ? T.amber : T.ink3,
                          fontSize: 13, fontWeight: 700 }}>→</span>
                        <Band v={L.gapDynClose} />
                      </span>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>—</span>}
                </TD>

                {/* ── RSI (expert 7, CONT seule) ─────────────────────────────────────────────────
                    ⚠ « hors domaine » ET PAS UN TIRET sur D1/M15 : `rsi_d1` et `rsi_m15` EXISTENT et
                    sont remplis. Un tiret laisserait croire à une donnée absente, alors que c'est
                    l'expert qui ne les lit pas. Même règle que « non exporté » pour l'ADX — dire
                    POURQUOI la case est vide, sinon on rouvre le piège `num("")=0` à l'envers. */}
                <TD dense>
                  {SCORER_TFS.rsi.includes(L.tf.id)
                    ? <><Val>{f(L.rsiClosed, 1)}</Val>
                        <span style={{ color: T.ink3, fontSize: 11, marginRight: 9 }}>
                          {L.rsiLive == null ? "" : `(${f(L.rsiLive, 1)})`}
                        </span>
                        <Band v={L.rsiBand} /></>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>hors domaine</span>}
                </TD>

                <TD dense>
                  {SCORER_TFS.rsi.includes(L.tf.id)
                    ? <><span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 550,
                          color: L.dRsi == null ? T.ink3 : L.dRsi >= 0 ? T.green : T.red, marginRight: 9 }}>
                          {L.dRsi == null ? "—" : `${L.dRsi >= 0 ? "+" : ""}${f(L.dRsi, 2)}`}
                        </span><Band v={L.dRsiCol} /></>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>—</span>}
                </TD>

                {/* Le ratio est en % du p75 : 100 = la bougie a fait son p75. Les deux repères du
                    fade (67 et 100) sont donc lisibles directement sur le nombre. */}
                <TD dense>
                  <Val>{L.rgRatio == null ? "—" : `${f(L.rgRatio, 0)} %`}</Val>
                  <span style={{ color: T.ink3, fontSize: 11, marginRight: 9 }}>
                    {L.bodyPct == null ? "" : `(corps ${f(L.bodyPct, 0)} %)`}
                  </span>
                  <Band v={L.bodyBand} />
                </TD>

                {/* ⭐ Sans le camp, « CTR » et « EXT » sur la même bougie sont indéchiffrables : c'est
                    lui qui décide lequel des deux domaines s'applique. */}
                <TD dense>
                  {L.camp == null
                    ? <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>pas de camp</span>
                    : <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: L.camp > 0 ? T.green : T.red }}>
                          {L.camp > 0 ? "haussier" : "baissier"}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600,
                          color: L.against == null ? T.ink3 : L.against ? T.amber : T.ink2 }}>
                          {L.against == null ? "—" : L.against ? "· bougie CONTRE" : "· bougie avec"}
                        </span>
                      </span>}
                </TD>


              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── SCORING — même géométrie, sous la table des indicateurs (owner 2026-07-26).
             UNE SEULE table : les experts entrent dans leur colonne, pas dans un bloc à côté.
             ℹ️ `ctx` = contexte niveau-LIGNE pour un expert qui lit une grandeur NON-TF.
             ⭐ `slopeD1Live` AJOUTÉ LE 31/07 : le ZScore choisit sa colonne de barème selon le régime
             de pente journalière (`NAISSANT` / `MÛR`), qui n'appartient à aucun timeframe. Sans lui,
             la page afficherait `NAISSANT` partout et divergerait SILENCIEUSEMENT du moteur sur
             toutes les barres en pente forte — le piège `derived_dataset_computed_3x`. */}
      {/* ══ CE QUE LE MOTEUR EN A FAIT ══════════════════════════════════════════════════════════
          La table ci-dessus dit ce qu'il VOIT ; ce bloc dit ce qu'il DÉCIDE, sur la même barre.
          Sans lui, un écart entre « les capteurs semblent bons » et « rien n'a tiré » n'a aucune
          explication accessible depuis cette page — et c'est justement l'écart qu'on vient
          diagnostiquer ici. */}
      {row && (() => {
        let det = null, err = null;
        try {
          det = detectOpportunity(row, asset, { decide: (c2, obs, gate, r) => decideFromScoring(r, gate, c2) });
        } catch (e) { err = e?.message ?? String(e); }
        const sel = det?.rawSelection ?? null;
        const sc = sel?.scoring ?? null;
        // ⚠ On affiche l'ERREUR plutôt que de rendre un bloc vide : une barre inévaluable et une
        //   panne d'appel produisent le même écran vide, et ce sont deux choses opposées.
        if (err) return (
          <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 14, paddingTop: 14, color: T.red, fontSize: 12 }}>
            décision indisponible — {err}
          </div>
        );
        const K = ({ l, v, c }) => (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0",
            borderBottom: `1px solid ${T.border}`, fontSize: 11.5 }}>
            <span style={{ color: T.ink3 }}>{l}</span>
            <span style={{ color: c ?? T.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{v}</span>
          </div>
        );
        const fired = sel?.side === "BUY" || sel?.side === "SELL";
        const mode = MODES[sel?.strategy];
        const rk = sel?.rank ?? null, ranks = sel?.ranks ?? [];
        const rgd = sc?.regDir ?? null;
        const col = rk === "EXH" ? T.amber : rk === "PB" ? T.cyan : rk === "CONT" ? T.blue : T.ink3;
        return (
          <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 14, paddingTop: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: T.ink3, marginBottom: 9 }}>
              Décision du moteur sur cette barre
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "0 26px" }}>
              <div>
                <K l="verdict" c={fired ? T.green : T.red}
                   v={fired ? `${mode?.label ?? sel.strategy} ${sel.side}` : `DROP · ${sel?.waitNature ?? "?"}`} />
                <K l="rang qui a décidé" v={rk ?? "—"} c={col} />
                {/* ⭐ La PAIRE rang/rangs : elle seule distingue « rang JAMAIS ATTEINT » (donc non
                    câblé) de « rang atteint et REFUSÉ » (donc sévère). */}
                <K l="rangs traversés" v={ranks.join(" › ") || "aucun"} c={ranks.length ? undefined : T.red} />
                <K l="régime (regDir)" c={rgd == null ? T.red : rgd > 0 ? T.green : T.red}
                   v={rgd == null ? "aucun — fail-closed" : rgd > 0 ? "+1 haussier" : "−1 baissier"} />
                {/* Le côté de CHAQUE rang se déduit du régime : c'est la table dictée, rendue lisible. */}
                <K l="côtés imposés" v={rgd == null ? "—" : rgd > 0 ? "① SELL · ②③ BUY" : "① BUY · ②③ SELL"} />
              </div>
              <div>
                <K l="score ① EXHAUSTE" v={sc?.exhRaw == null ? "—" : `${sc.exh} / ${MIN_EXH}`} />
                <K l="bande de veto ①" v={`[${MIN_PRES} · ${MIN_EXH}[ → DROP`} c={T.amber} />
                <K l="score ② PULLBACK" v={sc?.pbConviction == null ? "—" : `${sc.pbConviction} / ${MIN_PB}`} />
                <K l="score ③ CONTINUE" v={sc?.cont == null ? "—" : `${sc.cont} / ${MIN_CONT}`} />
                {sc?.yieldedBy && <K l="① a cédé par" c={T.amber}
                                     v={sc.yieldedBy === "veto" ? "VETO (les portes)" : "SCORE (le barème)"} />}
                {sc?.pbYieldedBy && <K l="② a cédé par" c={T.amber}
                                       v={sc.pbYieldedBy === "veto" ? "VETO (les portes)" : "SCORE (le barème)"} />}
              </div>
            </div>
            {/* ⭐⭐ `kind` DÉCIDE DU ROUTAGE depuis le 05/08 : `timing` (M15/M5) TUE la barre — personne
                ne trade — tandis que `structure` PASSE LA MAIN au rang suivant. Voir l'`id` d'un veto
                sans voir son `kind`, c'est voir qu'il a mordu sans savoir ce qu'il a fait. */}
            {(sel?.vetoed ?? []).length > 0 && (
              <div style={{ marginTop: 10 }}>
                {(sel.vetoed ?? []).map((v, i) => (
                  <K key={i} l={`veto ${v.strategy} ${v.side}`} c={T.amber}
                     v={(v.hits ?? []).map((h) => `${h.id}[${h.tf}·${h.kind === "timing" ? "TUE" : "route"}]`).join(" + ") || "—"} />
                ))}
              </div>
            )}
            {(sel?.reasons ?? []).map((r, i) => (
              <div key={i} style={{ fontSize: 11, color: T.ink2, paddingTop: 7, lineHeight: 1.55 }}>{r}</div>
            ))}
          </div>
        );
      })()}

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
        <ScoringTable lines={lines} ctx={{ symbol: asset, slopeD1Live: row?.slope_d1_s0 }} />
      </div>
    </Panel>
  );
}
