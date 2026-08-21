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
// ⭐⭐⭐ LE MOTEUR EST RAPPELÉ, ET POUR UNE AUTRE RAISON QUE CE MATIN (2026-08-05, soir). Le bloc
//   « Décision » avait été retiré parce qu'il rejouait un VERDICT déjà donné par la page Signaux —
//   deux réponses à la même question par deux chemins. Ici on appelle le moteur pour ses SCORES :
//   `scoring.contExperts` porte les `perTf` et les `global` des experts du rang ③ — le SEUL rang qui
//   en ait encore depuis le 11/08. ⚠ `scoring.exhExperts` a disparu avec `exhaustionScorer` ; les
//   rangs ① et ② sont des bareme a somme, lisibles dans `scoring.boxes.{exh,pb}.parts`. Les
//   TROIS rangs, et c'est exactement ce que la table du bas prétend montrer.
// ⇒ La table n'en calcule donc plus aucun. Un chiffre qu'on n'a pas calculé ne peut pas diverger —
//   et trois divergences page↔moteur en une journée ont montré que la vigilance ne suffisait pas.
// ⚠ ON PASSE PAR `detectOpportunity` ET NON PAR `decideFromScoring` DIRECTEMENT : c'est lui qui
//   construit `gate` et le ranking `c2` depuis la row. Les reconstruire ici serait la recopie locale
//   que l'en-tête de ce fichier interdit.
// ⚠ `decide` est REQUIS depuis la suppression de `decideSignal` : sans injection, l'appel lève. Voulu.
import { detectOpportunity } from "../../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { decideFromScoring } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js";
// ⛔ BLOC « DÉCISION DU MOTEUR SUR CETTE BARRE » — TOUJOURS RETIRÉ (owner). Il rejouait
//   `detectOpportunity` + `decideFromScoring` sur la row affichée pour rendre verdict / rangs /
//   seuils. Motif du retrait : cette page répond à « QUE VOIT LE MOTEUR », et le verdict se lit déjà
//   sur la page Signaux (tiroir de détail, section « Cascade »), qui le tient du RUN et non d'un
//   rejeu. Deux sites qui répondent à la même question sur deux chemins différents, c'est un écart
//   qui finit par arriver — et personne ne saurait lequel croire.
// ⚠ SI ÇA REVIENT UN JOUR : les imports `detectOpportunity` / `decideFromScoring` / `MIN_*` / `MODES`
//   partent AVEC le bloc, délibérément. Un import gardé « au cas où » est le premier étage d'une
//   machinerie morte, et ce dépôt en a déjà payé cinq.
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
// ⛔ COLONNE « RANGE s0 » RETIRÉE À SON TOUR LE 2026-08-05 : `range` a quitté le FADE le 03/08, puis
//   la CONTINUATION le 05/08 — il ne score donc PLUS AUCUNE THÈSE. Afficher son ratio sur une page
//   dont l'objet est « ce que le moteur VOIT » montrerait un capteur que le moteur N'ÉCOUTE PLUS.
//   ⚠ L'expert lui-même (`rangeExpert.js`) n'est pas supprimé : il n'est plus branché, c'est tout.
// ⚠ La justification d'origine est conservée ci-dessous — elle reste vraie du moment où elle a été
//   écrite (29/07). C'est le monde qui a changé, pas le raisonnement.
// ⭐ RANGE — `rangeRatio` (% du p75 d'ATR de l'ACTIF et du TF) et `bodyLevel` viennent de l'expert ;
//   `rangeExhLevel` vient du scorer de FADE, parce que depuis la refonte du 29/07 les deux thèses ne
//   découpent plus le même axe : la continuation garde les quintiles par TF (`rangeLevel`), le fade
//   a deux repères de marché absolus (p10 · p67 · p75) et DEUX DOMAINES selon que la bougie va avec
//   ou contre le camp. Afficher `rangeLevel` ici expliquerait le score du fade avec la bande d'un
//   autre expert — exactement la faute qui a fait supprimer `zscoreBand` de cette page.
// ⭐ RSI — le septième expert (30/07), affiché ici depuis le 31/07. `rsiZone` distingue les deux
//   côtés de 50 pour l'ŒIL ; le barème, lui, replie le haut sur le bas et ne connaît que la
//   magnitude. On montre donc la zone signée (ce que l'utilisateur lit sur un graphe) à côté d'un
//   score calculé sur l'axe replié — les deux disent la même chose, dans deux repères.
import { rsiZone, rsiDeltaCol } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/experts/rsiExpert.js";
// ⭐ LE DOMAINE DE TF VIENT DU MOTEUR (`SCORER_TFS`), pas d'un booléen local comme `tf.adx`. Ce
//   dernier décrit une contrainte d'EXPORT (l'EA ne sort l'ADX qu'en h1/m15) ; ici c'est un choix de
//   l'expert, et il doit pouvoir changer à un seul endroit.
import { SCORER_TFS, tfInputs } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js";
// ⭐⭐ L'AXE DU FADE (06/08) — le ZScore EXH ne lit PAS `zLevel(zClosed)` comme la continuation : son
//   niveau vient du GAP en ATR à la CLÔTURE (`gapLevel`), sa colonne de la PENTE du gap
//   (`gapDeltaCol`), et sa LIGNE d'un sélecteur `BEHIND`/`AHEAD` qui change d'estimateur avec le
//   niveau. Aucun de ces trois n'était visible sur cette page — on voyait le score du fade sans
//   pouvoir dire quelle case de la table l'avait produit.
// 🔴 `gapInstalled` EST IMPORTÉ, PAS RECOPIÉ : ses trois lignes sont exactement le genre de
//   dérivation qui a divergé trois fois sur cette page le 05/08. Le moteur l'expose pour cette raison.
// 🔄 11/08 — RENOMMÉ `gapExhInstalled` → `gapInstalled` ET DÉMÉNAGÉ dans `DeviationConfig` avec la
//   suppression de `exhaustionScorer`. ⭐⭐ La leçon vaut plus que le renommage : en portant la table
//   du `gap` dans `exhScoringV1`, ses trois lignes ont été RECOPIÉES dans `scoringDecision` pendant
//   que cette page continuait d'importer l'original — deux copies et un import mort en une heure,
//   sous un commentaire qui disait « PAS RECOPIÉ ». **La consigne ne protège pas une dérivation
//   unique ; ce qui la protège, c'est qu'il n'existe qu'UN domicile où aller la chercher.**
import { computeDeviation, gapDeltaCol, gapInstalled }
  from "../../../Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
import { zSlopeRegime } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/experts/zscoreExpert.js";
// ⭐ SLOPE — le 5ᵉ expert du fade (02/08), affiché ici depuis le 05/08. Les deux classificateurs
//   viennent du moteur, comme tout le reste de cette page.
// 🔴🔥 ILS NE SONT CALIBRÉS QU'EN H1, ET C'EST POURQUOI LA BANDE N'APPARAÎT QUE LÀ. `SLOPE_CONFIG`
//   (les 7 classes signées, par actif) et `SLOPE_DELTA_MEDIAN` (la médiane de |d| PAR NIVEAU) sont
//   mesurés sur H1 seul. Les appeler sur H4 ou D1 poserait des bornes sur une population qu'on n'a
//   jamais mesurée — c'est la faute qui a coûté six jours sur l'ADX, et un seuil se périme AVEC son
//   capteur. ⇒ Sur H4/D1 on montre les VALEURS (elles sont exactes) et on dit que la bande manque.
import { slopeLevel4, slopeDeltaCol }
  from "../../../Matrix-Revolution/src/components/robot/engines/config/SlopeConfig.js";

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
  // échelle de VITESSE signée (deltaKBand / deltaZBand / slopeDeltaCol) — froid = baisse, chaud =
  //   hausse, gris = flat. ⭐ `slopeDeltaCol` réutilise EXACTEMENT ces sept noms (`DELTA_COLS`), donc
  //   rien à ajouter pour elle : c'est la même grammaire de vitesse, appliquée à un autre capteur.
  EXPLOSIVE_DOWN: "#4493f8", FAST_DOWN: "#5fa8d3", SOFT_DOWN: "#7fa8bd",
  FLAT: "#8b949e",
  SOFT_UP: "#bfa05e", FAST_UP: "#d29922", EXPLOSIVE_UP: "#f85149",
  // ⭐⭐⭐ 21/08 — LA FAMILLE `Δz` A ÉTÉ RENOMMÉE `ÉCARTE` / `REFERME` (owner), ET ELLE SEULE.
  //   Motif : `UP`/`DOWN` ne parlaient pas du `z` mais de l'ÉLASTIQUE (`zDeltaCol` oriente par
  //   `signe(z)`), et l'owner s'est fait piéger DEUX FOIS dans la même soirée par ce mot.
  //   `ÉCARTE` = le prix s'éloigne de sa moyenne · `REFERME` = il y revient. Plus d'ambiguïté.
  // ⚠⚠ LES SEPT ANCIENS NOMS RESTENT AU-DESSUS, ET C'EST OBLIGATOIRE : `RSI_DELTA_COLS`,
  //   `slopeDeltaCol` et `deltaKBand` utilisent LES MÊMES CHAÎNES pour un sens DIFFÉRENT (chez eux
  //   `UP` veut bien dire « ça monte »). Renommer les deux familles ensemble aurait été FAUX.
  //   C'est justement cette collision de vocabulaire qui rendait la page illisible.
  EXPLO_REFERME: "#4493f8", FAST_REFERME: "#5fa8d3", SOFT_REFERME: "#7fa8bd",
  SOFT_ECARTE: "#bfa05e", FAST_ECARTE: "#d29922", EXPLO_ECARTE: "#f85149",
  // niveaux du Slope Expert (`SLOPE_LEVELS4`, magnitude NON signée : le côté est porté par le signe
  //   de la pente live, pas par la ligne). `FLAT` et `EXTREME` sont déjà définis plus haut et
  //   partagés — même rampe, aucun ton nouveau.
  WEAK: "#7fa8bd", STRONG: "#d29922",
  // ── LES 6 BARREAUX DE TENSION (`Z_LEVELS` / `GAP_LEVELS`) — AJOUTÉS LE 06/08 ────────────────
  // 🔴 ILS N'AVAIENT AUCUNE COULEUR, et ce n'était pas un choix : `Band` retombe sur `T.ink2`, donc
  //   la colonne `zscore` du tableau du bas affichait ses six barreaux dans le MÊME gris depuis le
  //   début. Un classificateur rendu invisible se lit comme une absence d'information.
  //   ⚠ `EXTREME` était déjà là (partagé avec les zones RSI/ADX) — c'est pour ça que le trou ne
  //   sautait pas aux yeux : un barreau sur six était colorié.
  NO_TENSION: "#8b949e", SLACK: "#7fa8bd", TENSE: "#bfa05e", TENSE_HIGH: "#d29922",
  SNAPPED: "#ff7b72",
  // ── AXE DU FADE (`gapExhScore`) — la ligne choisie et le régime qui l'autorise ───────────
  //   `BEHIND` = le prix est installé du côté d'où ce fade revient (la thèse du ballet) ;
  //   `AHEAD` = il est déjà de l'autre côté. `MUR` est le seul régime où le ZScore EXH parle.
  BEHIND: "#3fb950", AHEAD: "#d29922",
  NAISSANT: "#5fa8d3", MUR: "#f85149",
  BAS: "#4493f8", HAUT: "#f85149",
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
    // 🔴 ARRONDI À 4 DÉCIMALES, COMME `sub()` DANS `scoringInputs` (2026-08-05). Sans lui, `13,73`
    //   sortait ici en `13.730000000000004` et `kdCycleState` — qui compare l'écart à une bande morte
    //   de 2,1 — basculait d'un état sur les barres pile à la frontière : 4 barres sur 1 151 (0,35 %)
    //   affichaient `STABLE` là où le moteur lit `DIVERGING`, `CONTACT` ou `CONVERGING`.
    // ⚠ Une différence de 4·10⁻¹⁵ qui change un LIBELLÉ, donc une case de barème, donc un score. Le
    //   flottant ne se voit pas à l'écran : c'est le classificateur qui le rend visible, et seulement
    //   sur la frontière. ⇒ Deux dérivations d'une même grandeur doivent arrondir PAREIL, ou elles ne
    //   sont pas la même grandeur.
    const kd = (k != null && d != null) ? +(k - d).toFixed(4) : null;
    const kdPrev = (k1 != null && d1 != null) ? +(k1 - d1).toFixed(4) : null;
    // s2 sert UNIQUEMENT à dater l'état de la barre précédente : kdCycleState compare deux barres,
    //   donc l'état EN s1 se lit sur le couple (s1, s2). Ça donne la TRANSITION s1 → s0.
    const kd2 = (k2 != null && d2 != null) ? +(k2 - d2).toFixed(4) : null;

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

    // ── SLOPE (5ᵉ expert du fade, H1 seul) — LA PENTE DU RSI, ET SES **DEUX** DÉRIVÉES ───────────
    // ⚠⚠ ET C'EST TOUT L'INTÉRÊT DE LES METTRE CÔTE À CÔTE : `slopeExhScore` lit la dérivée **LIVE**
    //   (`slope_{tf}_s0 − slope_{tf}`, ce qui a bougé DANS l'heure), PAS `dslope_{tf}` (la variation
    //   d'une CLÔTURE à la suivante). Les deux sont exportés, portent des noms voisins, et **ne
    //   coïncident sur AUCUNE des 371 697 lignes du dataset** (p97 : 3,55 contre 4,52). Une seule
    //   des deux colonnes entre dans le barème ; l'autre est là pour qu'on cesse de les confondre.
    // 🔴 PIÈGE DE NOM, à ne jamais emprunter : `MatrixEngine` aliase `dslope_{tf}` → `dslope_{tf}_s0`
    //   quand la colonne manque. Ce nom-là désigne donc la dérivée live en prod et la variation de
    //   barre en backtest. On lit les deux formes NUES, jamais l'alias.
    const slopeClose = num(row?.[`slope_${tf.id}`]);
    const slopeLive = num(row?.[`slope_${tf.id}_s0`]);
    const dSlopeLive = (slopeLive != null && slopeClose != null) ? +(slopeLive - slopeClose).toFixed(4) : null;
    const dSlopeBar = num(row?.[`dslope_${tf.id}`]);
    // ⚠ LE NIVEAU EST UNE MAGNITUDE (`SLOPE_LEVELS4`), le CÔTÉ vient du signe de la pente LIVE — à
    //   `flat` le signe de la clôture est du bruit. Bandes calibrées en H1 SEUL, cf. l'import.
    const slopeLvl = (tf.id === "h1" && slopeClose != null) ? slopeLevel4(slopeClose, asset) : null;
    // ⚠ COLONNE EN SENS BRUT, sans orientation : depuis le dépliage en deux tables (03/08), c'est la
    //   TABLE qui porte le signe, plus la colonne. La borner par niveau est ce qui rend « vite »
    //   comparable d'un niveau à l'autre (la médiane de |d| va de ×2,3 à ×3,8 de `flat` à `extreme`).
    const slopeCol = (tf.id === "h1" && slopeLvl && dSlopeLive != null)
      ? slopeDeltaCol(dSlopeLive, slopeLvl, asset) : null;

    // ── RANGE, VERSION FADE (refonte owner 2026-07-29) ─────────────────────────────────────────
    // ⭐ On affiche ce que l'expert LIT VRAIMENT, dans son ordre de décision : le ratio au p75, le
    //   camp (`signe(zClosed)`), le sens de la bougie PAR RAPPORT au camp, puis le domaine qui en
    //   découle. Sans le camp à l'écran, « CTR » et « EXT » sur la même bougie sont indéchiffrables :
    //   c'est le camp qui décide lequel des deux domaines s'applique.
    // ⚠ `rangeRatio` a besoin de l'ACTIF (p75 d'ATR par actif × TF). Si `asset` manque, il rend
    //   `null` et la colonne dit « — » : jamais 0, ce serait lu comme « range nul ».
    // ⛔ `span` / `bodyPct` RETIRÉS avec la colonne « Range s0 » (05/08) : plus aucun lecteur. Un
    //   calcul qu'on garde « au cas où » est le premier étage d'une machinerie morte — et ce dépôt en
    //   a déjà payé cinq. Le corps de bougie reste calculable en trois lignes le jour où il resert.
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
      // ══ LES ENTRÉES DU MOTEUR, TRANSPORTÉES ET NON REDÉRIVÉES (2026-08-05) ═══════════════════
      // ⚠ `I` N'EST PLUS LU PAR LA TABLE DE SCORING depuis qu'elle affiche la trace du moteur. Il
      //   RESTE parce qu'il est la seule garantie que les colonnes AFFICHÉES au-dessus décrivent la
      //   même barre que les scores du bas — et parce que `scorerContractCheck` continue de vérifier
      //   que les descripteurs ne lisent que des noms de `tfInputs`. 🎯 Le jour où plus rien ne lit
      //   `SCORERS`, ce champ et le contrat partent ensemble ou pas du tout.
      // 🔴🔥 POURQUOI : la page redérivait chaque observable une seconde fois, et les deux
      //   dérivations ont divergé TROIS FOIS le 05/08, sans qu'aucune erreur ne soit levée —
      //   `gapDynClose` au lieu de `gapDyn: live ?? closes` (un commentaire vrai le jour où il a
      //   été écrit), `kLive` jamais passé à `kdScore` (13,8 % des barres scorées là où le moteur
      //   se TAIT), et l'écart K/D non arrondi (0,35 % des barres, un libellé de cycle qui bascule
      //   sur la frontière de la bande morte). Trois mécanismes sans rapport, une seule cause.
      // ⚠ `tf` EST AJOUTÉ ICI, et c'est le seul champ qui ne vient pas du moteur : `tfInputs` ne le
      //   porte pas et le RSI en a besoin pour sa porte de domaine. Il est déclaré dans
      //   `SCORER_INPUT_EXTRA` pour que `scorerContractCheck` ne le prenne pas pour un nom inventé.
      I: { ...tfInputs(row, tf.id), tf: tf.id },
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
      // 🔴🔥 `gapDyn` — CELLE QUI SCORE, ET ELLE N'ÉTAIT PAS CELLE QU'ON CROYAIT (AUDUSD 2026-07-14
      //   16:45). Le commentaire ci-dessous affirmait « la dynamique QUI SCORE est celle des CLOSES »
      //   et la page ne fournissait que `gapDynClose` au descripteur `di`. Or `tfInputs` (le moteur)
      //   écrit `gapDyn: live ?? diGapDynamics(c1, c2)` : il PRÉFÈRE la dynamique LIVE et ne retombe
      //   sur les closes que si `_s0` manque. Deux dérivations du même observable ⇒ deux scores.
      //   ⚠ MESURÉ SUR LA BARRE TÉMOIN, m15 : DI s0 24,51/15,15 · c1 28,28/17,48 · c2 19,17/20,17
      //       live  (s0 vs c1) = STABLE    → di m15 = 5   (moteur)
      //       close (c1 vs c2) = WIDENING  → di m15 = 3   (page)
      //     ⇒ global 3,7 contre 3,0, et le Σ affiché passait de 3,19 à 3,09. Un écart petit, une
      //     cause structurelle : c'est le piège `derived_dataset_computed_3x`, et il était REVENU.
      // ⭐⭐ LA LEÇON EST DANS LE COMMENTAIRE, PAS DANS LE CODE : la ligne était juste le jour où elle
      //   a été écrite, `diGapDynamicsLive` est arrivé après, et rien ne relit un commentaire. Un
      //   assertif (« celle du barème ») vieillit exactement comme un chiffre en dur.
      // 🎯 LE VRAI CORRECTIF SERAIT D'ALIMENTER LES DESCRIPTEURS DEPUIS `tfInputs` au lieu de
      //   redériver ici. Tant que cette page a sa propre dérivation, elle peut re-diverger au
      //   prochain ajout — et l'écart est trop petit pour se voir à l'œil.
      gapDynClose: diGapDynamics(dp1, dm1, dp2, dm2),     // c1 vs c2 — affichée dans la séquence
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
      // ⚠ `kLive` EST L'ALIAS DE `k` SOUS LE NOM DU MOTEUR, et ce n'est pas cosmétique : `kdScore`
      //   attend `kLive` (la bande morte [25 · 75] qui le fait taire sur un CROSS en milieu de
      //   course). La page le calculait depuis toujours sous le nom `k` et ne le passait pas — le
      //   descripteur scorait donc là où le moteur se tait, sur 13,8 % des barres. Publier la valeur
      //   sous LE nom de l'expert est ce qui permet de relire `scoringScales` et cette page côte à
      //   côte sans traduire, exactement comme `rsiClosed`/`dRsi` juste en dessous.
      zBand: zLevel(zPrev), kBand: stochZone(k),
      kdBand: kdDistanceBand(kd),
      // ⚠ `rsiClosed`/`dRsi` portent EXACTEMENT les noms des paramètres de `rsiExpertScore` — c'est
      //   ce qui permet de relire `scoringScales` et cette page côte à côte sans traduire. Le %K n'a
      //   pas eu cette chance (`kdBand` ici, `kdDist` chez l'expert) et ça a vidé sa colonne en
      //   silence le 31/07.
      rsiClosed, rsiLive, dRsi,
      rsiBand: rsiZone(rsiClosed),
      dRsiCol: rsiDeltaCol(dRsi),
      // ⚠ `slopeLvl` est rendu en minuscules par le moteur (`flat`/`weak`/`strong`/`extreme`) ; on
      //   MAJUSCULE pour l'affichage seul, parce que `BAND_COLOR` et `Band` parlent en majuscules
      //   partout ailleurs. La valeur du moteur n'est jamais réécrite, seulement rendue.
      slopeClose, slopeLive, dSlopeLive, dSlopeBar,
      slopeLvl: slopeLvl ? slopeLvl.toUpperCase() : null, slopeCol,
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
      // ⭐ 21/08 — `dZOr` SORTI ET EXPOSÉ : c'est la variation dans le repère de la BANDE, et c'est
      //   elle qu'on affiche. ⚠ `|| 1` là où il n'y avait rien : `Math.sign(0)` vaut `0`, donc un
      //   `zPrev` exactement nul annulait le Δz orienté et rendait `FLAT` par construction — un
      //   verdict fabriqué par l'arithmétique, pas par la mesure. Le site voisin avait déjà la garde.
      dZOr: dZ == null ? null : dZ * (Math.sign(zPrev || 0) || 1),
      dKBand: deltaKBand(dK), dZBand: zDeltaCol(dZ * (Math.sign(zPrev || 0) || 1), zLevel(zPrev)),
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
      camp, against,
      adxBand: tf.adx ? adxLevelBand(a0 ?? a1) : null,
      adxBandClose: tf.adx ? adxLevelBand(a1) : null,   // référence, pour comparer à l'écran
    };
  });

  // ══ L'AXE DU FADE — UNE SEULE DÉRIVATION, COMME AU SITE D'APPEL DU MOTEUR ═══════════════════
  // ⚠ `computeDeviation` EST APPELÉ UNE FOIS, en h1, exactement comme dans `exhaustionScorer`
  //   (`devH1`). Deux appels dans le même fichier seraient la faute `derived_dataset_computed_3x`.
  // 🔴 H1 SEUL, ET C'EST LE DOMAINE DE L'EXPERT, PAS UNE LIMITE D'AFFICHAGE : `GAP_EXH_TF_WEIGHTS`
  //   vaut `{ h1: 1.00 }`, et `middle_h4_s1` n'existe pas à l'export. Le moteur passe `null` sur les
  //   autres TF, donc leur jambe retombe sur `zLevel`/`zDeltaCol`. On écrit « h1 seul » dans les
  //   cases plutôt qu'un tiret : dire POURQUOI la case est vide, sinon on rouvre `num("")=0` à
  //   l'envers.
  const devH1 = row ? computeDeviation(row, asset, "h1") : null;
  // ⚠ MÊME SOURCE QUE LE MOTEUR (`row.slope_d1_s0`), même fonction. Le ZScore EXH est MUET hors
  //   `MUR` — c'est sa première porte, avant même la table, d'où sa présence dans ce tableau.
  const zExhRegime = row ? zSlopeRegime(row?.slope_d1_s0, asset) : null;
  // ⭐ LE SÉLECTEUR DE LIGNE, LU CHEZ LE MOTEUR. `installed` change d'ESTIMATEUR avec le niveau
  //   (`sign(meanSlope)` en bas, `sign(gapAtrClose)` au-dessus) : c'est l'entrée la plus difficile à
  //   reconstituer à l'œil, et celle qui décide `BEHIND`/`AHEAD` donc la LIGNE de la table.
  const exhInstalled = devH1
    ? gapInstalled(devH1.levelClose, devH1.gapAtrClose, devH1.meanSlope) : 0;
  const exhLowSel = devH1?.levelClose === "NO_TENSION" || devH1?.levelClose === "SLACK";

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

      {/* ══════════════════════════════════════════════════════════════════════════════════════
          ENTRÉES DU MOTEUR — LE NIVEAU DE CHAQUE VARIABLE QUI ENTRE DANS UN BARÈME (owner 06/08)
          ⭐⭐⭐ CE TABLEAU NE CALCULE RIEN. Il lit `L.I`, c'est-à-dire `tfInputs(row, tf)` — l'objet
            que les scorers reçoivent, à la clé près. Les seules fonctions appelées ici sont les
            CLASSIFICATEURS du moteur (`zLevel`, `zDeltaCol`, `rsiZone`, `rsiDeltaCol`,
            `gapDeltaCol`, `gapInstalled`), appliqués aux valeurs du moteur. Aucune
            arithmétique locale, donc rien qui puisse diverger comme les trois cas du 05/08.
          ⭐ POURQUOI EN HAUT ET SÉPARÉ DU GRAND TABLEAU : celui du dessous montre les MESURES (des
            nombres, avec leurs deux instants). Celui-ci montre ce que le barème en RETIENT — la
            case, pas la valeur. C'est la question « pourquoi ce score », et elle se lit avant.
          ⚠ LES BANDES DÉJÀ CALCULÉES PAR `tfInputs` SONT AFFICHÉES TELLES QUELLES (`zone`, `dKBand`,
            `kdPrev`/`kdCur`, `kdDist`, `gapBand`, `gapDyn`). Les re-dériver depuis les nombres
            serait exactement la faute que ce fichier a corrigée en transportant `tfInputs`.
          ══════════════════════════════════════════════════════════════════════════════════════ */}
      {/* 🔴🔥 `flexShrink: 0` N'EST PAS DE LA COSMÉTIQUE — SANS LUI CE BLOC A UNE HAUTEUR DE ZÉRO.
          Le corps du `Panel` est `display:flex · column · overflow:auto` à hauteur CONTRAINTE, et un
          élément flex dont `overflow` n'est pas `visible` PERD sa taille minimale automatique
          (`min-height:auto` → `0`). Il devient donc compressible jusqu'à disparaître.
          ⚠⚠ ET LE PIÈGE EST QU'IL EST LATENT : tant que le contenu tient dans la hauteur, rien ne se
          voit. Ajouter ce tableau a fait déborder le total, et le navigateur a écrasé les DEUX seuls
          enfants compressibles — celui-ci ET le grand tableau des mesures, qui n'avait pourtant pas
          changé d'une ligne. Un bloc ajouté a donc fait disparaître un bloc voisin, sans erreur.
          ⇒ TOUT enfant direct de ce `Panel` qui porte un `overflow` doit porter `flexShrink: 0`. */}
      <div style={{ overflowX: "auto", flexShrink: 0, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px 4px" }}>
        <div style={{ fontSize: 11, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.7,
          marginBottom: 8, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: T.ink2, fontWeight: 700 }}>entrées du moteur</span>
          <span style={{ textTransform: "none", letterSpacing: 0, opacity: 0.75 }}>
            le niveau retenu par chaque barème — <code>tfInputs</code> transporté, jamais redérivé
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <TH w={40} dense>TF</TH>
              <TH dense>%K zone <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0 · (s1)</span></TH>
              <TH dense>ΔK <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>dKBand</span></TH>
              <TH dense>K/D état <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s1 → s0</span></TH>
              <TH dense>K/D dist <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>kdDist · gap</span></TH>
              <TH dense>z niveau <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>CONT · zClosed</span></TH>
              <TH dense>Δz col <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>orienté · par niveau</span></TH>
              <TH dense>DI écart <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>gapBand</span></TH>
              <TH dense>DI dyn <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>gapDyn</span></TH>
              <TH dense>RSI zone <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>clôture</span></TH>
              <TH dense>ΔRSI col <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0−clôture</span></TH>
              <TH dense>BBW <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>bbw · Δ%</span></TH>
              {/* ⭐⭐ LES TROIS COLONNES DU FADE. Le ZScore EXH ne lit PAS `zLevel(zClosed)` : son
                  niveau vient du GAP en ATR à la CLÔTURE, sa colonne de la PENTE du gap, et sa
                  LIGNE du sélecteur `BEHIND`/`AHEAD`. Sans elles, la table du fade était une boîte
                  noire — on voyait le score sans pouvoir nommer la case. */}
              <TH dense>GAP niveau <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>FADE · gapAtrClose</span></TH>
              <TH dense>Δgap col <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>FADE · gapSlope</span></TH>
              <TH dense>installé <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>sélecteur de LIGNE</span></TH>
            </tr>
          </thead>
          <tbody>
            {lines.map((L) => {
              const I = L.I;
              // ⚠ Les classificateurs du moteur, appliqués aux valeurs du moteur. `zLevel` est calculé
              //   une fois et REPASSÉ à `zDeltaCol` : c'est le contrat de l'expert (la colonne est
              //   calibrée PAR NIVEAU), pas une commodité.
              const zLv = zLevel(I.zClosed);
              // ⭐⭐⭐ 21/08 — L'ORIENTATION EST SORTIE DANS SA PROPRE VARIABLE, ET ELLE EST AFFICHÉE.
              //   Motif : l'owner lit `Δz −0,85` étiqueté `EXPLOSIVE_UP` et dit « c'est pas
              //   cohérent ». Il avait raison de le dire : on affichait le Δz **BRUT** à côté d'une
              //   étiquette **ORIENTÉE**. `UP` ne veut pas dire « le z monte », ça veut dire
              //   « l'ÉTIREMENT GRANDIT » — quand `z < 0` le prix s'éloigne vers le BAS. Deux
              //   repères différents dans la même cellule, c'est illisible même quand c'est juste.
              //   ⇒ On affiche désormais la variation ORIENTÉE (celle que la bande décrit), et le
              //   brut passe en gris entre parenthèses. Rien n'est perdu, les deux ne mentent plus.
              const zSgn = Math.sign(I.zClosed || 0) || 1;
              const dzOr = I.dZ == null ? null : I.dZ * zSgn;
              const dzCol = (dzOr == null || !zLv) ? null : zDeltaCol(dzOr, zLv);
              const isH1 = L.tf.id === "h1";
              const OUT = <span style={{ color: T.ink3, fontSize: 10.5, fontStyle: "italic" }}>hors domaine</span>;
              const H1ONLY = <span style={{ color: T.ink3, fontSize: 10.5, fontStyle: "italic" }}>h1 seul</span>;
              return (
                <tr key={`in-${L.tf.id}`}>
                  <TD dense><span style={{ fontWeight: 700, color: T.ink, fontSize: 14, letterSpacing: 0.2 }}>{L.tf.label}</span></TD>

                  <TD dense>
                    <Band v={I.zone} />
                    <span style={{ color: T.ink3, fontSize: 10.5, marginLeft: 5 }}>
                      {I.kLive == null ? "" : f(I.kLive, 1)}
                    </span>
                  </TD>

                  <TD dense><Band v={I.dKBand} /></TD>

                  {/* Même grammaire que le tableau du bas : la flèche passe en ambre quand l'état
                      CHANGE — c'est la transition qui score, pas l'état seul. */}
                  <TD dense>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span style={{ opacity: I.kdPrev && I.kdPrev !== I.kdCur ? 0.85 : 0.45 }}>
                        <Band v={I.kdPrev} />
                      </span>
                      <span style={{ color: I.kdPrev && I.kdCur && I.kdPrev !== I.kdCur ? T.amber : T.ink3,
                        fontSize: 13, fontWeight: 700 }}>→</span>
                      <Band v={I.kdCur} />
                    </span>
                  </TD>

                  <TD dense>
                    <Band v={I.kdDist} />
                    <span style={{ color: T.ink3, fontSize: 10.5, marginLeft: 5 }}>
                      {I.kdGap == null ? "" : `${I.kdGap >= 0 ? "+" : ""}${f(I.kdGap)}`}
                    </span>
                  </TD>

                  <TD dense>
                    <Band v={zLv} />
                    <span style={{ color: T.ink3, fontSize: 10.5, marginLeft: 5 }}>{f(I.zClosed)}</span>
                  </TD>

                  {/* ⚠ LE NOMBRE AFFICHÉ EST LA VARIATION **ORIENTÉE** — le même repère que la bande.
                      Le brut suit en gris : `z<0` ⇒ les deux signes sont opposés, et c'est normal. */}
                  <TD dense>
                    <Band v={dzCol} />
                    <span title="variation ORIENTEE (Δz × signe du z) — la bande decrit celle-ci ; entre parentheses, le Δz brut"
                          style={{ color: dzOr == null ? T.ink3 : dzOr >= 0 ? T.green : T.red,
                                   fontSize: 10.5, marginLeft: 5, fontVariantNumeric: "tabular-nums" }}>
                      {dzOr == null ? "" : `${dzOr >= 0 ? "+" : ""}${f(dzOr)}`}
                    </span>
                    <span style={{ color: T.ink3, fontSize: 9.5, marginLeft: 4 }}>
                      {I.dZ == null || zSgn > 0 ? "" : `(brut ${I.dZ >= 0 ? "+" : ""}${f(I.dZ)})`}
                    </span>
                  </TD>

                  {/* ⚠ « non exporté » et pas « hors domaine » : l'EA ne sort l'ADX/DI qu'en h1/m15.
                      C'est une contrainte de DONNÉE, pas un choix d'expert — deux causes, deux mots. */}
                  <TD dense>
                    {SCORER_TFS.di.includes(L.tf.id)
                      ? <><Band v={I.gapBand} />
                          <span style={{ color: T.ink3, fontSize: 10.5, marginLeft: 5 }}>
                            {I.gap == null ? "" : `${I.gap >= 0 ? "+" : ""}${f(I.gap, 1)}`}
                          </span></>
                      : <span style={{ color: T.ink3, fontSize: 10.5, fontStyle: "italic" }}>non exporté</span>}
                  </TD>

                  <TD dense>
                    {SCORER_TFS.di.includes(L.tf.id)
                      ? <Band v={I.gapDyn} />
                      : <span style={{ color: T.ink3, fontSize: 10.5, fontStyle: "italic" }}>non exporté</span>}
                  </TD>

                  <TD dense>
                    {SCORER_TFS.rsi.includes(L.tf.id)
                      ? <><Band v={rsiZone(I.rsiClosed)} />
                          <span style={{ color: T.ink3, fontSize: 10.5, marginLeft: 5 }}>{f(I.rsiClosed, 1)}</span></>
                      : OUT}
                  </TD>

                  <TD dense>{SCORER_TFS.rsi.includes(L.tf.id) ? <Band v={rsiDeltaCol(I.dRsi)} /> : OUT}</TD>

                  {/* ⚠ BBW/ΔBBW N'ONT PAS DE CLASSIFICATEUR ICI, ET C'EST VOULU : `energyLevel` coupe
                      en fonction de l'ACTIF, chez l'expert. On montre les valeurs brutes — inventer
                      une bande d'affichage expliquerait le score avec une échelle qui n'est pas la
                      sienne, la faute qui a fait supprimer `zscoreBand` de cette page. */}
                  <TD dense>
                    {SCORER_TFS.energy.includes(L.tf.id)
                      ? <><Val>{f(I.bbw, 4)}</Val>
                          <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 11,
                            color: I.dBbw == null ? T.ink3 : I.dBbw >= 0 ? T.green : T.red }}>
                            {I.dBbw == null ? "" : `${I.dBbw >= 0 ? "+" : ""}${f(I.dBbw, 1)} %`}
                          </span></>
                      : OUT}
                  </TD>

                  {/* ── L'AXE DU FADE, H1 SEUL ─────────────────────────────────────────────────── */}
                  <TD dense>
                    {!isH1 ? H1ONLY
                      : <><Band v={devH1?.levelClose} />
                          <span style={{ color: T.ink3, fontSize: 10.5, marginLeft: 5 }}>
                            {devH1?.gapAtrClose == null ? "" : `${devH1.gapAtrClose >= 0 ? "+" : ""}${f(devH1.gapAtrClose)}`}
                          </span></>}
                  </TD>

                  <TD dense>
                    {!isH1 ? H1ONLY
                      : <><Band v={gapDeltaCol(devH1?.gapSlope ?? null, devH1?.levelClose, asset)} />
                          <span style={{ color: T.ink3, fontSize: 10.5, marginLeft: 5 }}>
                            {devH1?.gapSlope == null ? "" : `${devH1.gapSlope >= 0 ? "+" : ""}${f(devH1.gapSlope)}`}
                          </span></>}
                  </TD>

                  {/* ⭐⭐ LE SÉLECTEUR DE LIGNE, ET SON ESTIMATEUR. `installed === 0` ⇒ aucune ligne
                      choisissable ⇒ l'expert se TAIT (fail-closed) : on l'écrit, parce qu'un muet
                      AMPLIFIE les cinq autres au lieu de refuser — c'est l'inverse d'un tiret. */}
                  <TD dense>
                    {!isH1 ? H1ONLY
                      : exhInstalled === 0
                        ? <span style={{ color: T.amber, fontSize: 10.5, fontStyle: "italic" }}>muet (pas d'estimateur)</span>
                        : <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <Band v={exhInstalled < 0 ? "BAS" : "HAUT"} />
                            <span style={{ color: T.ink3, fontSize: 9.5, fontStyle: "italic" }}>
                              {exhLowSel ? "meanSlope" : "sign(gap)"}
                            </span>
                          </span>}
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── LA PORTE QUI PRÉCÈDE LA TABLE — elle décide si le ZScore EXH parle TOUT COURT ──────
            ⭐ `slopeRegime !== "MUR"` ⇒ muet, avant même de choisir une ligne. C'est la première
            chose à regarder quand la colonne `zscore` du fade est vide, et elle ne dépend d'aucun
            TF — d'où sa place hors du tableau plutôt qu'une colonne répétée quatre fois. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          marginTop: 6, paddingTop: 8, borderTop: `1px solid ${T.border}`, fontSize: 11 }}>
          <span style={{ color: T.ink3, textTransform: "uppercase", letterSpacing: 0.6 }}>régime de pente D1</span>
          <Band v={zExhRegime} />
          <span style={{ color: T.ink3 }}>
            {zExhRegime === "MUR"
              ? "le ZScore EXH peut parler"
              : "ZScore EXH MUET — l'excès est NAISSANT, il persiste, il ne s'épuise pas"}
          </span>
          <span style={{ marginLeft: "auto", color: T.ink3, fontVariantNumeric: "tabular-nums" }}>
            pente moyenne {devH1?.meanSlope == null ? "—" : `${devH1.meanSlope >= 0 ? "+" : ""}${f(devH1.meanSlope, 3)}`}
            {devH1?.meanSlopeBand ? <span style={{ marginLeft: 6 }}><Band v={devH1.meanSlopeBand} /></span> : null}
          </span>
        </div>
      </div>

      {/* ⚠ `flexShrink: 0` — MÊME RAISON QUE LE BLOC AU-DESSUS, et ce tableau-ci en a été la VICTIME :
          il n'avait pas changé d'une ligne et il a disparu le jour où on a ajouté un voisin. Voir la
          note complète sur le bloc « entrées du moteur ». */}
      <div style={{ overflowX: "auto", flexShrink: 0 }}>
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
              <TH dense>Δz <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>ORIENTÉ · s0−s1 × signe(z)</span></TH>
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
              {/* ── SLOPE (05/08) — TROIS colonnes, et la troisième existe pour LEVER UNE CONFUSION.
                  `slope` = le NIVEAU (la ligne du barème), `Δ live` = la VITESSE (sa colonne),
                  `dslope` = la variation de clôture à clôture, qui N'ENTRE PAS dans le barème et
                  qu'on affiche justement pour qu'on arrête de la prendre pour l'autre. */}
              <TH dense>slope <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>clôture · (s0)</span></TH>
              <TH dense>Δslope live <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0−clôture · CE QUI SCORE</span></TH>
              <TH dense>dslope <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>close→close · hors barème</span></TH>
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
                  {/* ⚠ ORIENTÉ, comme la bande. Le brut n'apparaît que quand il DIFFÈRE (`z < 0`). */}
                  {L.hasDz
                    ? <><span title="variation ORIENTEE (Δz × signe du z) — la bande decrit celle-ci"
                        style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 550,
                        color: L.dZOr == null ? T.ink3 : L.dZOr >= 0 ? T.green : T.red, marginRight: 9 }}>
                        {L.dZOr == null ? "—" : `${L.dZOr >= 0 ? "+" : ""}${f(L.dZOr)}`}
                      </span><Band v={L.dZBand} />
                      <span style={{ color: T.ink3, fontSize: 10, marginLeft: 6 }}>
                        {L.dZ == null || L.dZOr == null || L.dZOr === L.dZ
                          ? "" : `(brut ${L.dZ >= 0 ? "+" : ""}${f(L.dZ)})`}
                      </span></>
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

                {/* ── SLOPE · le NIVEAU (la ligne du barème) ────────────────────────────────────
                    ⚠ ON MONTRE LA VALEUR SUR LES 4 TF, LA BANDE SUR H1 SEUL. C'est le contraire du
                    parti pris « hors domaine » du RSI, et pour une raison précise : là-bas c'est
                    l'EXPERT qui ne lit pas le TF ; ici la valeur est parfaitement lisible, c'est la
                    CALIBRATION qui manque. Cacher le nombre laisserait croire qu'il n'existe pas. */}
                <TD dense>
                  <Val dim={L.tf.id !== "h1"}>{f(L.slopeClose, 3)}</Val>
                  <span style={{ color: T.ink3, fontSize: 11, marginRight: 9 }}>
                    {L.slopeLive == null ? "" : `(${f(L.slopeLive, 3)})`}
                  </span>
                  {L.tf.id === "h1"
                    ? <Band v={L.slopeLvl} />
                    : <span style={{ color: T.ink3, fontSize: 10, fontStyle: "italic" }}>non calibré</span>}
                </TD>

                {/* ── SLOPE · la VITESSE — L'AXE QUI SCORE ──────────────────────────────────────
                    ⭐ Coupures = multiplicateurs × médiane DU NIVEAU, donc « vite POUR CE NIVEAU ».
                    Sans le niveau à gauche, cette bande est illisible : la même valeur absolue est
                    `EXPLOSIVE` à `flat` et `FLAT` à `extreme`. */}
                <TD dense>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 550,
                    color: L.dSlopeLive == null ? T.ink3 : L.dSlopeLive >= 0 ? T.green : T.red, marginRight: 9 }}>
                    {L.dSlopeLive == null ? "—" : `${L.dSlopeLive >= 0 ? "+" : ""}${f(L.dSlopeLive, 3)}`}
                  </span>
                  {L.tf.id === "h1"
                    ? <Band v={L.slopeCol} />
                    : <span style={{ color: T.ink3, fontSize: 10, fontStyle: "italic" }}>non calibré</span>}
                </TD>

                {/* ── dslope — LA COLONNE TÉMOIN, ET ELLE N'EST PAS DÉCORATIVE.
                    Elle est grisée EXPRÈS : elle ressemble à la précédente, elle porte un nom plus
                    court, et elle n'entre dans AUCUN barème. Les deux ne coïncident sur aucune ligne
                    du dataset — c'est en les voyant côte à côte qu'on cesse de les confondre. */}
                <TD dense>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12.5, color: T.ink3 }}>
                    {L.dSlopeBar == null ? "—" : `${L.dSlopeBar >= 0 ? "+" : ""}${f(L.dSlopeBar, 3)}`}
                  </span>
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

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
        {(() => {
          // ⚠ L'ERREUR EST AFFICHÉE, PAS AVALÉE : une barre inévaluable et une panne d'appel
          //   produisent le même écran vide, et ce sont deux choses opposées.
          if (!row) return null;
          let det = null, err = null;
          try { det = detectOpportunity(row, asset, { decide: (c2, obs, gate, r) => decideFromScoring(r, gate, c2) }); }
          catch (e) { err = e?.message ?? String(e); }
          const sel = det?.rawSelection ?? null;
          return <ScoringTable sc={sel?.scoring ?? null} rank={sel?.rank ?? null} err={err} />;
        })()}
      </div>
    </Panel>
  );
}
