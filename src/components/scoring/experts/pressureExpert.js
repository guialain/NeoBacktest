// pressureExpert.js — PRESSURE EXPERT (ADX), barème v1 (owner 2026-07-26).
// --------------------------------------------------------------------------------------------
// MODULE NEUF, VOLONTAIREMENT SÉPARÉ de `scoringScales.js` (owner) : les classificateurs bandés
//   génériques et les experts de scoring ne se mélangent pas. Un expert = un fichier, sa table et
//   rien d'autre.
//
// CE QU'IL FAIT / CE QU'IL NE FAIT PAS
//   L'ADX mesure la pression directionnelle, RIEN D'AUTRE. Cet expert ne décide ni CONT, ni WAIT,
//   ni EXH : il rend un `PressureScore` borné [−10, +10]. La décision est ailleurs.
//
// TROIS ENTRÉES, TOUTES DE LA FAMILLE ADX — l'expert est désormais AUTONOME
//   • diGapBand     `diGapBand` (moteur) — QUI MÈNE et de combien. Donne le SENS **et** la porte.
//   • ADX level     `adxLevelBand` (moteur) — 5 bandes [16 · 24 · 33 · 55]. Donne la MAGNITUDE.
//   • dominanceTurn `adxTurnBand` (moteur) — RISING · TURN_UP · FLAT · TURN_DOWN · FALLING,
//                   sur les CLOSES (delta1 = c1−c2, delta2 = c2−c3), bande morte 1,0. L'ÉVOLUTION.
//
// ⭐🔥 ORIENTÉ PAR LE DI, PLUS PAR L'IC (owner 2026-07-26). L'`intraday_change` servait à donner le
//   côté que l'ADX, magnitude non signée, ne porte pas. Mais c'était un PROXY : mesuré, **le signe de
//   l'IC ne coïncide avec le camp qui mène que 74,0 % du temps** (n=48 057). Le DI le donne
//   EXACTEMENT, et il était déjà dans le jeu de données.
//   ⭐ LA PORTE ET L'ORIENTATION VIENNENT MAINTENANT DU MÊME CAPTEUR, et c'est ce qui rend l'expert
//   cohérent : `BALANCED` ne peut pas orienter un score — il l'annule, ce qu'il faisait déjà.
//   ⭐ EFFET DE BORD : l'expert ne lit plus AUCUNE grandeur de prix. Il devient purement de la famille
//   ADX (niveau + dynamique + camp), donc réellement indépendant comme la spec le revendiquait —
//   l'IC était le seul intrus. Aligne Pressure sur Cycle et ZScore, tous deux déjà sans IC.
//   ℹ️ DISPARAÎT AVEC L'IC : les deux tables IC>0 / IC<0, et le piège de prose qui allait avec (les
//   interprétations owner des bandes basses en IC<0 étaient miroitées MOT À MOT — « une pression
//   haussière apparaît contre le mouvement baissier » — alors que l'ADX n'est pas signé et que le
//   miroir correct est « la pression BAISSIÈRE renaît »).
//   ⚠ LA MAGNITUDE DU GAP N'EST PAS UTILISÉE : `BUY` et `EXTREME_BUY` orientent pareil. La magnitude
//   est déjà portée par l'ADX ; s'en servir deux fois la compterait double.
//
// ⚠ NOMMAGE : l'owner écrit « EXTREME » pour la bande haute ; le moteur la nomme `EXTREME_HIGH`
//   (depuis le recoupage 5 bandes miroir du 25/07, où `EXTREME_LOW` est apparu en face). La table
//   ci-dessous emploie les noms DU MOTEUR — c'est lui qui produit la valeur.
//
// ⭐ `TURN_DOWN` EN BANDE BASSE — complété par l'owner (2026-07-26), les deux cases manquaient.
//   « TURN_DOWN en EXTREME_LOW annonce un changement de tendance PROCHE » : en zone de compression
//   le mouvement en cours est sur le point de céder, donc le score va CONTRE le sens de l'IC.
//   Valeur −5 dans les deux bandes basses, alignée sur `FALLING` : ici l'AMORCE vaut la
//   PERSISTANCE. C'est la même entorse que `TURN_UP = RISING = +10` en `EXTREME_LOW` — dans les
//   bandes basses on ne divise pas l'amorce par deux, contrairement à `HIGH` où l'échelle est une
//   règle parfaitement symétrique (+10/+5/0/−5/−10).
import { weightedGlobal } from "./aggregate.js";

// ── LA TABLE, CÔTÉ ACHETEUR ────────────────────────────────────────────────────────────────────
//   Lecture : PRESSURE_TABLE[bande ADX][dominanceTurn] → score, LU COMME SI LES ACHETEURS MENAIENT.
//   Si ce sont les vendeurs (`SELL`/`EXTREME_SELL`), le score est NIÉ — voir `pressureScore`. On ne
//   duplique pas la table : deux tables jumelles finissent toujours par diverger d'une case.
//   ⚠ Les scores restent en convention `+ = intérêt LONG / − = intérêt SHORT`, comme le Cycle et le
//   ZScore. Une pression vendeuse qui se renforce donne donc un score NÉGATIF.
export const PRESSURE_TABLE = {
  // Après une forte compression, la pression renaît. Zone de NAISSANCE de tendance.
  EXTREME_LOW:  { RISING: +10, TURN_UP: +10, FLAT: 0, TURN_DOWN:   -5, FALLING:  -5 },
  // La pression commence à se construire.
  LOW:          { RISING: +10, TURN_UP:  +5, FLAT: 0, TURN_DOWN:   -5, FALLING:  -5 },
  // ⭐🔥 MEDIUM N'EST PAS UN ÉTAT, C'EST UNE ZONE DE PASSAGE (owner 2026-07-26, remplace « tout à 0 »).
  //   Le NIVEAU n'y porte aucune conviction — un ADX entre 24 et 33 n'est ni faible ni fort. Mais le
  //   TURN, lui, n'est pas ambigu : un ADX à 28 qui MONTE depuis 20 est une tendance qui NAÎT et se
  //   dirige vers `HIGH` ; à 28 en DESCENDANT de 40, c'est une tendance qui MEURT. Deux situations
  //   opposées, qui recevaient le même score.
  //   ⭐ LE RENVERSEMENT : ailleurs le niveau porte le sens et le turn le module ; ici le niveau ne
  //   porte rien, donc le turn doit porter TOUT. C'est la bande où la dynamique compte le PLUS.
  //   Barème = la MOITIÉ de `HIGH` : même forme antisymétrique, amplitude divisée parce que le niveau
  //   n'ajoute aucune conviction. Mesuré : 58,3 % des barres MEDIUM ont un turn non-FLAT (RISING 25,7 %
  //   · FALLING 25,3 % · TURN_DOWN 5,3 % · TURN_UP 2,0 %) — autant de barres rendues à la parole.
  //   ⚠ `FLAT` = **null et non 0** : c'est la SEULE case où le niveau ET la dynamique se taisent, donc
  //   la seule absence d'avis réelle. Ailleurs (`HIGH`/`FLAT` p.ex.) le 0 reste juste — le niveau dit
  //   quelque chose, seule la direction manque. « Aucune information exploitable » = null, pas 0 ;
  //   un 0 est une OPINION qui tire l'agrégat vers zéro (mesuré : 15 % des barres ont un TF en MEDIUM
  //   pendant que l'autre a un vrai avis, et le voyaient dilué). Cf. num("")=0.
  MEDIUM:       { RISING:  +5, TURN_UP:  +2, FLAT: null, TURN_DOWN: -2, FALLING:  -5 },
  // La pression est installée. Zone optimale de développement.
  HIGH:         { RISING: +10, TURN_UP:  +5, FLAT: 0, TURN_DOWN:   -5, FALLING: -10 },
  // Pression maximale : poursuivre n'informe plus, toute perte de pression est un fort signal
  //   d'essoufflement — d'où l'asymétrie voulue (+5 en haut, −10 en bas).
  EXTREME_HIGH: { RISING:  +5, TURN_UP:   0, FLAT: 0, TURN_DOWN:  -10, FALLING: -10 },
};

// ── AGRÉGATION MULTI-TF ────────────────────────────────────────────────────────────────────────
//   H1 est le TF de RÉFÉRENCE, M15 n'apporte que la RÉACTIVITÉ.
//   ⚠ L'ADX n'est exporté qu'en H1 et M15 — la question du D1/H4 ne se pose donc pas ici.
export const PRESSURE_TF_WEIGHTS = { h1: 0.65, m15: 0.35 };

export const PRESSURE_MIN = -10;
export const PRESSURE_MAX = +10;

// ❌ NON RETENU — LE MODULATEUR DE CONTRADICTION RETARDÉ/AVANCÉ (essayé puis retiré, 2026-07-26).
//   L'idée : l'ADX est le lissage du DX, donc l'indicateur RETARDÉ de sa famille, et l'écart des DI
//   en est l'AVANCÉ. Quand le turn dit que la pression se construit pendant que l'écart se referme,
//   la lecture retardée serait périmée ⇒ on divisait la conviction par deux au-delà de |Δécart| ≥ 3.
//
//   ⭐🔥 POURQUOI IL A ÉTÉ RETIRÉ — J'AVAIS CALIBRÉ CONTRE LA MAUVAISE CIBLE. Le seuil 3 vient de
//   « l'ADX tourne-t-il à la bougie suivante » : ×2,02 sur 1 378 barres `RISING` (29,8 % contre
//   14,7 % de base). Mais le retournement de l'ADX est un ÉVÉNEMENT INTERNE À L'INDICATEUR. Sur la
//   seule cible qui compte — LE PRIX — l'effet change de signe selon l'horizon :
//       écart qui se referme ≥3 pts :  1 bougie −0,039 % (42 % fav.) · 3 b +0,056 % · 6 b +0,115 %
//       écart qui se creuse  ≥1 pt  :  1 bougie +0,020 % (52 % fav.) · 3 b +0,014 % · 6 b +0,073 %
//   Un effet qui s'inverse entre 1 et 6 bougies n'est pas un effet.
//   ⭐ AU PASSAGE : `ADX RISING` + un camp qui mène n'a AUCUN avantage directionnel mesurable —
//   49 % de favorable à tous les horizons, moyennes dans le bruit à ±0,1 %. À garder en tête avant
//   de bâtir quoi que ce soit sur cette configuration.
//   ⚠ Mesure faite sur un hold sec de N bougies, sans TP/SL et expert ISOLÉ — donc indicative, pas
//   un verdict sur l'expert dans le moteur complet.
//   ℹ️ Les primitives restent au moteur (`diGapDelta`, seuil paramétrable de `diGapDynamics`) : la
//   mesure est refaisable sans les réécrire.

// ⭐🔥 PORTE `BALANCED` — L'ÉCART DES DI ANNULE LE SCORE (owner 2026-07-26).
//   « DI+ et DI− trop proches ne donnent pas d'info directionnelle » : quand `diGapBand` vaut
//   `BALANCED` (|DI+−DI−| < 5,5 ⇒ **30 % des barres**), l'ADX ne mesure plus une pression exploitable
//   et son score tombe à 0. Le trou visé est chiffré : en bande ADX `HIGH`, 8,5 % des barres ont les
//   DI à moins de 4,5 points et recevaient pourtant jusqu'à ±10.
//   ⭐ DEPUIS L'ORIENTATION PAR LE DI, LA PORTE EST UNE CONSÉQUENCE ET NON PLUS UNE RÈGLE AJOUTÉE :
//   `BALANCED` signifie littéralement « aucun camp ne mène », donc il n'y a pas de côté vers lequel
//   orienter le score. On ne peut pas signer ce qui n'a pas de signe.
//   ⚠ ZÉRO ET NON `null`, ET C'EST VOULU : `BALANCED` est une CONSTATATION (« on a regardé, aucun
//   camp ne mène »), pas une absence de donnée. Un `null` ferait renormaliser l'agrégat et laisserait
//   l'autre TF décider seul ; un 0 dit « ce TF n'a rien à dire » et pèse son poids.
//
// Score d'UN timeframe. `null` = pas d'avis (et jamais 0) dans TOUS les cas d'absence : DI absents
//   (donc pas de camp), ADX absent (D1/H4), dominanceTurn absent (il faut 3 closes), ou case `null`
//   du barème (`MEDIUM`/`FLAT`).
export function pressureScore({ adxBand, turn, gapBand }) {
  if (adxBand == null || turn == null || gapBand == null) return null;
  const row = PRESSURE_TABLE[adxBand];
  if (!row) return null;
  const s = row[turn];
  if (!Number.isFinite(s)) return null;      // case `null` du barème → pas d'avis
  if (gapBand === "BALANCED") return 0;      // aucun camp ne mène → rien à orienter
  const buyersLead = gapBand === "BUY" || gapBand === "EXTREME_BUY";
  return buyersLead ? s : -s;                // table lue côté acheteur ; vendeurs = miroir exact
}

// Score global pondéré — règle d'agrégation PARTAGÉE (cf. `aggregate.js`), y compris la
//   renormalisation sur les TF réellement présents : si M15 manque, H1 vaut le score entier plutôt
//   que 65 % de lui-même, car un TF absent ne doit pas peser comme un TF à 0.
export const pressureGlobal = (perTf) => weightedGlobal(perTf, PRESSURE_TF_WEIGHTS);
