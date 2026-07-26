// kdExpert.js — K/D EXPERT (owner 2026-07-26). 🚧 BARÈME EN COURS DE SAISIE.
// --------------------------------------------------------------------------------------------
// LA QUESTION : **où en est le cycle dans sa ROTATION, et cette rotation accélère-t-elle ?**
//   Le Cycle Expert lit la MATURITÉ (%K) et la VITESSE (ΔK). Celui-ci lit la GÉOMÉTRIE des deux
//   lignes — est-ce que K et D s'écartent, se referment, se touchent — et le CHEMIN par lequel on y
//   est arrivé. Ce n'est pas la même question, et la mesure le confirme : Cramér's V de
//   `kdCycleState` contre `K level` = 0,165 (quasi indépendants) et contre `ΔK` = 0,342, quand le
//   couple que le Cycle croise déjà (`ΔK` × `K level`) vaut 0,232.
//
// DEUX ENTRÉES → une transition × une zone
//   • TRANSITION  `kdCycleState(s1)` → `kdCycleState(s0)`, soit d'où l'on vient et où l'on est.
//   • ZONE        `stochZone(%K s0)` — 5 niveaux, la même échelle que le Cycle Expert.
//
// ⚠ `CROSS` EST ORIGINE, JAMAIS DESTINATION (owner). Une barre dont l'état COURANT est `CROSS`
//   ne reçoit AUCUN score — l'expert se tait (`null`, pas 0) et le cross sera traité en VETO c3.
//   Coût : 21 % des barres muettes. Comme ORIGINE il reste de l'information (« on vient de croiser,
//   maintenant ça s'écarte ») et il est conservé.
//   ⭐ `CROSS` et `CONTACT` ne font PAS double emploi mais ils sont à un cheveu : `CROSS` = le signe
//   de K−D a basculé sur la dernière barre (c'est FAIT) · `CONTACT` = l'écart est sous 2,1 sans
//   bascule (c'est PAS FAIT). Un `CONTACT` devient `CROSS` à la barre suivante **74 % du temps**.
//   Les fusionner était tentant ; ce qui l'interdit, c'est qu'ils portent des `sign(K−D)` OPPOSÉS
//   pour le même événement physique — le contact est du côté qu'on quitte, le cross du côté où on
//   arrive. Une case commune contiendrait deux orientations contraires.
//
// ⭐ LE SIGNE VIENT DE `sign(K−D)`, PAS DE LA TABLE. `kdCycleState` est NON SIGNÉ (il lit `|gap|`),
//   exactement comme `diGapDynamics`. La table est donc écrite pour le seul cas **K > D**, et
//   l'autre sens se DÉRIVE :
//       score(zone, t | K < D)  =  − KD_TABLE[t][miroir(zone)]
//   ⇒ le miroir est STRUCTUREL, pas une convention à vérifier après coup : il est impossible
//     d'écrire une table asymétrique. C'est la leçon du bug v2 du Cycle, résolue par construction
//     plutôt que par un test.
//   ✅ Appuyé par la mesure, pas seulement par la doctrine — les effectifs des deux côtés se
//     répondent case à case sur la famille des fermetures :
//       `DIVERGING→CONVERGING`  K>D HIGH 227 / XHIGH 85   ↔   K<D LOW 267 / XLOW 84
//       `CONVERGING→CONTACT`    K>D HIGH  59 / XHIGH 54   ↔   K<D LOW  59 / XLOW 64
//
// ⚠ EFFECTIF D'UNE CASE = `K>D(zone)` + `K<D(zone miroir)`. Une case vide côté K>D peut être très
//   peuplée côté K<D — `CROSS→CONTACT` en `XLOW` ne voit rien en montée mais 76 cas au total.
//   41 cases dépassent 25 observations, sur 100 nominales.
//
// 🔴 CE BARÈME EST DE LA CONNAISSANCE OWNER. Comme pour le DI, la validation case par case contre le
//   prix ne tranche pas — c'est la CONJONCTION qui se mesure, une fois l'archi en place, en
//   comparant la part d'une condition dans les PERTES à sa part dans l'ENSEMBLE.
import { weightedGlobal } from "./aggregate.js";

// Zone moteur (français) → clé du barème. Même traduction que le Cycle Expert, à la frontière.
const ZONE_TO_LEVEL = {
  EXTREME_BASSE: "EXTREME_LOW",
  BASSE: "LOW",
  MID: "MID",
  HAUTE: "HIGH",
  EXTREME_HAUTE: "EXTREME_HIGH",
};

const MIRROR = {
  EXTREME_LOW: "EXTREME_HIGH",
  LOW: "HIGH",
  MID: "MID",
  HIGH: "LOW",
  EXTREME_HIGH: "EXTREME_LOW",
};

// ── LA TABLE — écrite pour K > D. Zone absente d'une ligne ⇒ pas d'avis. ───────────────────────
//   Effectifs EFFECTIFS (les deux côtés réunis) en commentaire, n=5 644 barres scorables H1.
//   🚧 Lignes non encore renseignées par l'owner : laissées absentes ⇒ `null`.
export const KD_TABLE = {
  // ── LE CYCLE S'OUVRE ────────────────────────────────────────────────────────────────────────
  // Le cross vient d'avoir lieu et l'écart se creuse : le cycle s'allume. Il vaut d'autant plus
  //   qu'il reste du chemin devant — d'où la pente décroissante en montant dans la zone, et le 0
  //   en `EXTREME_HIGH` où un allumage haussier n'a plus de place. Même logique de PLACE RESTANTE
  //   que le `WIDENING` du DI Expert, appliquée ici à la maturité et non à la conviction.
  "CROSS→DIVERGING":     { LOW: +10, MID: +8, HIGH: +5, EXTREME_HIGH: 0 },   // 385 · 365 · 371 · 36

  // Le cross a eu lieu puis les lignes se re-touchent aussitôt : l'allumage est CONTESTÉ. Même
  //   sens que l'écartement franc — on suit le cross — mais un cran en dessous partout
  //   (+8 · +5 · +3 contre +10 · +8 · +5). Et la pente reste décroissante avec la maturité.
  //   ⚠ `EXTREME_LOW` (76) est nourri presque entièrement par le MIROIR : 68 des cas sont des
  //   `K < D` en `EXTREME_HIGH`, soit un cross baissier en excès haussier qui se fait rattraper.
  //   C'est la case la plus peuplée de la ligne et elle ne se voit pas côté montée.
  "CROSS→CONTACT":       { EXTREME_LOW: +8, LOW: +5, HIGH: +3 },             //  76 ·  37 ·  35

  // Le cross a eu lieu puis plus rien ne bouge : l'allumage a CALÉ. Encore un cran en dessous du
  //   contact (+5 · +3 · +2). ⭐ Les trois lignes issues de `CROSS` forment ainsi une échelle de
  //   CONFIRMATION à trois barreaux — s'écarte > se re-touche > stagne — à maturité égale.
  "CROSS→STABLE":        { LOW: +5, MID: +3, HIGH: +2 },                     // 113 ·  86 · 101

  // L'écartement DURE — deuxième barre consécutive. Identique au cross frais en bas et au milieu
  //   (+10 · +8), mais il DÉCROCHE plus vite en haut : +3 contre +5. ⭐ Deux barres d'écartement
  //   consomment plus de cycle qu'une seule, donc à zone égale il reste moins de chemin. La
  //   PERSISTANCE n'ajoute rien tant qu'on est jeune, elle COÛTE dès qu'on est mûr.
  "DIVERGING→DIVERGING": { LOW: +10, MID: +8, HIGH: +3 },                    //  60 · 261 · 301

  // L'écartement REPART après une pause. Aligné sur le cross frais (+8 · +5) et non sur
  //   l'écartement qui dure : ⭐ une pause REMET LE COMPTEUR À ZÉRO. Ce qui use le cycle, c'est
  //   d'écarter sans discontinuer, pas le temps qui passe.
  "STABLE→DIVERGING":    { MID: +8, HIGH: +5 },                              //  66 ·  32

  // ── LE CYCLE SE REFERME ─────────────────────────────────────────────────────────────────────
  // ⭐🔥 PREMIÈRE INVERSION DE SIGNE DE LA TABLE, et elle est INTERNE À LA LIGNE : +3 · −5 · −10.
  //   La même géométrie — l'écart se referme — vaut un repli sain au milieu du cycle et un
  //   RETOURNEMENT au sommet. Ce n'est donc pas la transition qui porte le sens, c'est son
  //   croisement avec la maturité : exactement ce que le croisement des deux axes devait produire,
  //   et ce qu'aucun des deux capteurs ne dit seul.
  //   ⚠ `HIGH` (494) est la case la plus peuplée de toute la table.
  "DIVERGING→CONVERGING": { MID: +3, HIGH: -5, EXTREME_HIGH: -10 },          // 117 · 494 · 169

  // Identique, case pour case, à la fermeture venue de l'écartement.
  "STABLE→CONVERGING":   { MID: +3, HIGH: -5, EXTREME_HIGH: -10 },           //  75 · 276 · 143

  // La fermeture DURE — deuxième barre consécutive. Elle mord plus fort en `HIGH` (−8 contre −5)
  //   et plafonne déjà en `EXTREME_HIGH`.
  "CONVERGING→CONVERGING": { MID: +3, HIGH: -8, EXTREME_HIGH: -10 },         //  36 · 156 · 121

  // La fermeture ABOUTIT : les lignes se touchent. Aligné case pour case sur la fermeture qui
  //   dure. ⭐ `CONTACT` et `CONVERGING` sont donc la MÊME DESTINATION vue à deux distances : le
  //   contact n'est pas un cran de plus, c'est la convergence arrivée au bout. Le cran de plus,
  //   c'est le `CROSS` — et il est justement sorti de la table (veto c3).
  "CONVERGING→CONTACT":  { MID: +3, HIGH: -8, EXTREME_HIGH: -10 },           //  27 · 118 · 118

  // Les lignes restent collées. ⚠ EXCEPTION À LA RÈGLE DE RÉPÉTITION : la persistance n'aggrave
  //   PAS ici (−8, comme `CONVERGING→CONTACT`). Cohérent avec ce qui précède — `CONTACT` est déjà
  //   le bout de la course, il n'y a plus rien à consommer. La règle « la répétition pousse au
  //   retournement » vaut pour les états de MOUVEMENT (écartement, resserrement), pas pour l'état
  //   TERMINAL.
  "CONTACT→CONTACT":     { HIGH: -8 },                                       //  25

  // ── LE CYCLE MARQUE LE PAS ──────────────────────────────────────────────────────────────────
  // L'écartement CALE. La ligne traverse le zéro : +5 · +3 · 0 · −5. Un temps mort ne dit rien au
  //   milieu d'un cycle et devient un AVERTISSEMENT au sommet.
  //   ⚠ Le `0` en `HIGH` est une OPINION (« ça ne penche plus d'aucun côté »), pas une absence —
  //   une case non renseignée rend `null` et l'expert se tait. Ne jamais confondre les deux :
  //   c'est le bug `num("")=0`, déjà payé deux fois sur ce projet.
  "DIVERGING→STABLE":    { LOW: +5, MID: +3, HIGH: 0, EXTREME_HIGH: -5 },    //  50 · 181 · 250 ·  68

  // La fermeture CALE. Elle garde son signe (+3 · −5 · −8) mais RELÂCHE au sommet : −8 au lieu du
  //   −10 de toutes les autres fermetures. ⭐ Une pause ADOUCIT dans les deux familles — elle rend
  //   une ouverture moins bonne et une fermeture moins mauvaise. Elle ne retire pas le sens, elle
  //   retire l'URGENCE.
  "CONVERGING→STABLE":   { MID: +3, HIGH: -5, EXTREME_HIGH: -8 },            //  26 ·  42 ·  36

  // Les lignes se touchent après une pause : +5 · −5. ⭐ En `HIGH` elle vaut −5 quand
  //   `CONVERGING→CONTACT` vaut −8 — et la règle de répétition tient toujours, à condition de
  //   compter `CONVERGING` et `CONTACT` comme UN SEUL état (ce que les scores ont déjà établi).
  //   Vu ainsi, `CONVERGING→CONTACT` EST une répétition (d'où −8) et `STABLE→CONTACT` une
  //   fermeture fraîche (d'où −5).
  "STABLE→CONTACT":      { LOW: +5, HIGH: -5 },                              //  37 ·  52

  // Rien ne bouge, deux barres de suite. ⭐ LA SEULE LIGNE PUREMENT MONOTONE DE LA TABLE :
  //   +3 · 0 · −3 · −5, un gradient de maturité et rien d'autre. Quand la géométrie ne dit rien,
  //   il ne reste que la ZONE — et son barème dégénère en « plus on est haut, moins on achète ».
  //   C'est le témoin de la table : il montre ce que le second axe ajoute partout ailleurs.
  "STABLE→STABLE":       { LOW: +3, MID: 0, HIGH: -3, EXTREME_HIGH: -5 },    //  72 ·  48 ·  88 ·  32
};

// ⭐🔥 LA RÈGLE QUE LES SIX PREMIÈRES LIGNES ENCODENT — L'ORIGINE NE PARLE QUE SI ELLE RÉPÈTE
//   L'ÉTAT COURANT. Venir d'un `CROSS` ou d'un `STABLE` donne exactement le même score :
//     ouverture  `CROSS→DIVERGING` = `STABLE→DIVERGING`   (+8 · +5 en MID/HIGH)
//     fermeture  `DIVERGING→CONVERGING` = `STABLE→CONVERGING`  (+3 · −5 · −10)
//   Seule la RÉPÉTITION change quelque chose, et elle pousse TOUJOURS DANS LE SENS DU
//   RETOURNEMENT — elle ÉRODE une ouverture et AGGRAVE une fermeture :
//     `DIVERGING→DIVERGING`   en HIGH : +5 → **+3**
//     `CONVERGING→CONVERGING` en HIGH : −5 → **−8**
//   ⇒ le chemin n'est pas 20 transitions indépendantes mais 4 destinations × un bit « ça dure ».
//   ⚠ Cette compression est une LECTURE du barème owner, pas une contrainte imposée : les lignes
//   restent écrites une par une, et une future ligne peut la démentir sans rien casser.

// H1 principal · H4 valide le swing · D1 le contexte · M15 la réactivité — le stochastique est
//   exporté sur les 4 TF. ⚠ Poids repris du Cycle POUR L'INSTANT : c'est le même capteur de base.
export const KD_TF_WEIGHTS = { h1: 0.40, h4: 0.30, d1: 0.15, m15: 0.15 };

export const KD_MIN = -10;
export const KD_MAX = +10;

// Score d'UN timeframe. `null` = pas d'avis (jamais 0) : capteur absent, état courant `CROSS`,
//   transition hors table, ou zone non renseignée sur la ligne.
export function kdScore({ zone, prevState, curState, gap }) {
  if (!prevState || !curState) return null;
  if (curState === "CROSS") return null;            // veto c3 — l'expert ne se prononce pas
  if (gap == null || gap === 0) return null;        // pas de côté ⇒ pas d'orientation possible
  const level = ZONE_TO_LEVEL[zone];
  if (!level) return null;
  const row = KD_TABLE[`${prevState}→${curState}`];
  if (!row) return null;
  const s = gap > 0 ? row[level] : row[MIRROR[level]];
  if (!Number.isFinite(s)) return null;
  return gap > 0 ? s : -s;
}

export const kdGlobal = (perTf) => weightedGlobal(perTf, KD_TF_WEIGHTS);
