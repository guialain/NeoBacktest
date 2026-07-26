// zscoreExpert.js — ZSCORE EXPERT, barème v2 (owner 2026-07-26). 🚧 EN COURS DE SAISIE.
// --------------------------------------------------------------------------------------------
// LA QUESTION : **l'élastique est-il tendu, et se tend-il encore ou se relâche-t-il ?**
//
// ⚠⚠ LA v1 EST ABANDONNÉE, PAS RETOUCHÉE. Trois défauts indépendants, tous mesurés :
//   1. ELLE S'APPUYAIT SUR L'AXE REDONDANT. `zscoreBand` signé × `%K` : Cramér's V **0,363**, plus
//      associé que le couple que le Cycle croise DÉJÀ en interne (ΔK × K level = 0,232), et
//      `corr(z, %K) = 0,733`. Le NIVEAU SIGNÉ du zscore, c'est %K sous un autre nom.
//      ⭐ En prenant la MAGNITUDE `|z|` au lieu du niveau signé, la redondance tombe à 0,399.
//      Et l'axe informatif, lui, n'était partagé avec personne : `corr(Δz, ΔK) = 0,188`,
//      `corr(étirement, ΔK×signe(%K−50)) = 0,107`. La v1 maximisait le doublon et gaspillait le neuf.
//   2. LA MOITIÉ DE LA MASSE TOMBAIT SUR DES ZÉROS. 53 % des barres atterrissaient dans une colonne
//      `FLAT`, scorée 0 dans les trois lignes centrales. Les deux cases ★ à ±10 tiraient 2,8 % du
//      temps, et 16 cases sur 35 étaient sous 50 observations.
//   3. ELLE ÉTAIT UNE TRANSPOSITION DE LA TABLE DU CYCLE. `UPPER` = `−3 +4 +7 0 −6 −4 −1` contre
//      `−3 +5 +8 0 −6 −4 −1` pour `HIGH`. Or son propre en-tête annonçait l'inverse. C'est la faute
//      déjà réfutée sur les DI : on miroite ce qui DÉCRIT, on n'aligne pas ce qui MESURE.
//
// ⭐🔥 LE FAIT QUI COMMANDE TOUT LE BARÈME — LE FAUX RELÂCHEMENT
//   `z = (prix − MM20) / σ`. TROIS choses bougent, pas une : le prix, la moyenne qui monte vers lui,
//   et **σ qui s'élargit après un grand mouvement** — et σ est au DÉNOMINATEUR. Donc à forte tension,
//   z peut revenir vers zéro **sans que le prix revienne**. Mesuré (H1, barre par barre, sans horizon) :
//       |z| ≥ 1,05                              z relâche 79 %   dont le PRIX revient   30 %
//       |z| ≥ 1,05 · camp DI net · WIDENING     z relâche 82 %   dont le PRIX revient   13 %
//       |z| ≥ 2,15                              z relâche 76 %   dont le PRIX revient    2 %
//   ⇒ **à |z| ≥ 2,15, 97 % des relâchements sont MÉCANIQUES.** Scorer contrarian-positif un
//   relâchement en zone extrême, c'est acheter σ qui s'élargit. C'est le cas GERMANY_40 08/07 08:15
//   relevé par l'owner : la v1 sortait `+10` pendant que le DI disait `STRONG_SELL / WIDENING` et
//   que le prix cassait sous la bande basse.
//   ⭐ COROLLAIRE QUI RETOURNE UNE RÈGLE : à |z| extrême, si le prix s'arrêtait vraiment, z
//   relâcherait TOUT SEUL. Donc un `FLAT` en zone extrême ne dit pas « le prix se calme » — il dit
//   que **le prix pousse encore assez fort pour compenser la mécanique**. `FLAT` aux extrêmes ne
//   précède pas le retournement, il masque une continuation.
//
// ⛔ POURQUOI PAS D'AXE ADX/DI DANS CETTE TABLE (owner l'a proposé, mesuré, écarté)
//   • à |z| ≥ 1,05 le camp dominant est ALIGNÉ avec l'étirement dans **96 %** des cas (3412/3562) :
//     un axe DI y serait quasi constant — un axe qui ne varie pas ne discrimine pas, il dilue.
//   • le DI Expert vote DÉJÀ, séparément. La conjonction est la SOMME PONDÉRÉE, pas une troisième
//     dimension. L'y remettre le compterait deux fois.
//   • et la mesure ne le soutient pas : à 2 bougies en unités d'ATR (l'horizon réel des trades),
//     `camp net · WIDENING` donne +3 points de continuation… contre +5 pour le témoin `|z| < 0,30`.
import { weightedGlobal } from "./aggregate.js";

// ── AXE 1 : LA TENSION `|z|` — 6 barreaux, coupés sur le COMPORTEMENT ─────────────────────────
//   Le critère n'est pas la population mais le RAPPEL ESPÉRÉ PAR BARRE (fréquence × amplitude du
//   relâchement, en σ). Mesuré sur M15+H1+H4, n=23 769 :
//       |z|            relâche   force médiane   rappel espéré
//       0,00–0,30        52 %        0,159            0,083     ⟵ pile ou face : AUCUN élastique
//       0,30–1,05        58 %        0,127            0,074
//       1,05–1,55        68 %        0,160            0,108     ⟵ la fréquence casse ici
//       1,55–2,15        71 %        0,259            0,183     ⟵ la FORCE casse ici
//       2,15–2,60        67 %        0,450            0,302     ⟵ 4× le mou
//       ≥ 2,60           28 %        0,585            0,165     ⟵ le rappel S'INVERSE
//   ⭐ LA FRÉQUENCE SATURE À ~70 %, C'EST L'AMPLITUDE QUI CONTINUE DE CROÎTRE. Lire la seule
//   fréquence fait conclure que l'extrême ne se distingue pas — c'est faux, il frappe 3× plus fort.
//   ⭐ `2,60` : le rappel tombe à 28 % et RÉPLIQUE sur 3 TF (M15 25 %, H4 25 %, D1 29 %) — H1 fait
//   exception (57 %, n=83). Ce n'est plus un étirement, c'est une sortie de régime : l'élastique a
//   cédé. Bande conservée mais mince (1,4 %).
//   ❌ Les coupures du moteur (`0,65` · `2,15`) ne survivent qu'à moitié : `2,15` est une vraie
//   frontière, `0,65` n'en est pas une (60 % avant, 57 % après).
export const Z_LEVEL_BANDS = [0.30, 1.05, 1.55, 2.15, 2.60];
export const Z_LEVELS = ["NO_TENSION", "SLACK", "TENSE", "TENSE_HIGH", "EXTREME", "SNAPPED"];

export function zLevel(z) {
  if (z == null || !Number.isFinite(z)) return null;
  const a = Math.abs(z);
  for (let i = 0; i < Z_LEVEL_BANDS.length; i++) if (a < Z_LEVEL_BANDS[i]) return Z_LEVELS[i];
  return Z_LEVELS[Z_LEVELS.length - 1];
}

// ── AXE 2 : LA VITESSE `Δz = s0 − s1` — 7 bandes, CALIBRÉES PAR NIVEAU ────────────────────────
// ⭐🔥 C'EST LE CORRECTIF LE PLUS IMPORTANT DE LA v2, ET IL VIENT D'UNE QUESTION DE L'OWNER :
//   « deltaz n'est pas calibré par niveau ? » Non — `DELTA_Z_BANDS = [0,18 · 0,58 · 1,12]` sont des
//   coupures FIXES. Or la médiane de |Δz| TRIPLE avec la tension (0,180 → 0,707), donc la bande
//   morte vaut 1,0× la médiane en `SLACK` et 0,3× en `SNAPPED`. Résultat mesuré : `FLAT` attrapait
//   **50 %** des barres en bas et **16 %** en haut, pour une cible annoncée à 30 %.
//   ⇒ le MÊME MOT décrivait deux choses selon la ligne. C'est ça qui rendait la table illisible,
//     plus encore que le barème.
//   ✅ Correctif : couper à un MULTIPLE de la médiane |Δz| PROPRE À LA LIGNE. `FLAT` retombe à
//     23-32 % partout.
//   ⚠ POURQUOI PAS DES QUANTILES PAR LIGNE : ils égaliseraient les populations et EFFACERAIENT le
//   signal. Normaliser l'ÉCHELLE laisse les populations libres de différer — c'est ainsi qu'on voit
//   encore `TENSE`/`EXTREME` pencher vers le relâchement et `SNAPPED` pencher vers l'étirement
//   (`SOFT_UP` 36 %). Normaliser le RANG l'aurait détruit. Échelle ≠ rang.
export const Z_DELTA_MEDIAN = {
  NO_TENSION: 0.195, SLACK: 0.180, TENSE: 0.181,
  TENSE_HIGH: 0.265, EXTREME: 0.443, SNAPPED: 0.707,
};
// Multiplicateurs universels (× la médiane de la ligne), profil visé 5/10/20/30/20/10/5.
// ⚠ SYMÉTRISÉS (moyenne des deux côtés), comme `DELTA_K_BANDS` / `DELTA_Z_BANDS` du moteur. Les
//   bruts sortaient à `−3,15 · −1,62 · −0,76 · +0,24 · +1,77 · +4,13` — ils importaient l'asymétrie
//   relâche/étire DANS LES SEUILS, ce qui rendait `NO_TENSION` non symétrique (−10 d'un côté, −8 de
//   l'autre pour le même |Δz|) alors que cette ligne n'a pas d'élastique et ne doit rien pencher.
//   ⭐ SEUILS ≠ POPULATIONS : symétriser les COUPURES n'efface pas le comportement, il reste
//   entièrement visible dans les populations, qui elles restent libres :
//       ligne         EXPL↓ FAST↓ SOFT↓  FLAT  SOFT↑ FAST↑ EXPL↑
//       NO_TENSION      5%    9%   21%   28%    19%   10%    7%   ⟵ équilibré : pas d'élastique
//       SLACK           4%   11%   23%   28%    16%   10%    7%
//       TENSE           4%   12%   35%   24%    11%    7%    6%   ⟵ penche à GAUCHE : relâche
//       TENSE_HIGH      1%   10%   43%   22%    11%    8%    5%
//       EXTREME         0%    5%   42%   22%    15%   14%    2%
//       SNAPPED         0%    0%   19%   26%    30%   22%    3%   ⟵ penche à DROITE : s'étire encore
//   Le profil d'une ligne raconte donc son régime à lui seul.
export const Z_DELTA_MULT = [-3.64, -1.70, -0.50, 0.50, 1.70, 3.64];
export const Z_DELTA_COLS = [
  "EXPLOSIVE_DOWN", "FAST_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP",
];

// ⚠ `d` est le Δz ORIENTÉ (`Δz × signe(z)`) : `_UP` = l'élastique se TEND davantage, `_DOWN` = il se
//   RELÂCHE. Sans cette orientation la case serait ambiguë — `Δz = +0,5` décrit aussi bien z passant
//   de +2,3 à +2,8 (tend) que de −2,3 à −1,8 (relâche), deux situations opposées.
export function zDeltaCol(d, level) {
  const m = Z_DELTA_MEDIAN[level];
  if (d == null || !Number.isFinite(d) || !m) return null;
  for (let i = 0; i < Z_DELTA_MULT.length; i++) if (d < Z_DELTA_MULT[i] * m) return Z_DELTA_COLS[i];
  return Z_DELTA_COLS[6];
}

// ── LA TABLE — écrite pour `z > 0`. 🚧 Lignes non encore dictées : absentes ⇒ `null`. ──────────
export const ZSCORE_TABLE = {
  // Pas d'élastique : `|z| < 0,30` relâche 52 % du temps, soit pile ou face. Il n'y a rien à fader,
  //   donc la ligne est du MOMENTUM PUR — on suit la direction, symétriquement.
  //   ⭐ Cette ligne est la seule où `signe(z)` ne doit rien changer, et l'antisymétrie le garantit
  //   toute seule : près de la moyenne le signe de z est instable, mais le double retournement
  //   (colonne + score) rend le résultat identique des deux côtés. C'est un invariant, pas un choix.
  NO_TENSION: {
    EXPLOSIVE_DOWN: -10, FAST_DOWN: -8, SOFT_DOWN: -5,
    FLAT: 0,
    SOFT_UP: +5, FAST_UP: +8, EXPLOSIVE_UP: +10,
  },

  // ⭐🔥 À PARTIR D'ICI, LA LIGNE NE CHANGE PLUS DE SIGNE. Le prix est INSTALLÉ d'un côté de la
  //   bande et il y reste ; Δz module l'AMPLITUDE, jamais le signe. Rupture assumée avec les trois
  //   autres experts, dont chaque ligne bascule en son milieu.
  //   ✅ Mesuré, et c'est le chiffre qui tranche : quand Δz va CONTRE le côté (le prix remonte vers
  //   la moyenne), la probabilité de rester du même côté à +1h est **95 % en TENSE, 97 % en
  //   TENSE_HIGH et en EXTREME** — soit exactement les inconditionnels. Δz ne dit RIEN sur la
  //   traversée. Il ne peut donc pas porter le signe.
  //
  // `SLACK` — installé, mais pas encore fermement : persistance 77 % à 2 bougies (contre 67 % en
  //   `NO_TENSION`, 89 % en `TENSE`). D'où un plafond à +10 et non au maximum de la table.
  //   ⭐ LA LIGNE A DEUX BOSSES ET UN CREUX AU MILIEU : +8 en `SOFT_DOWN` et +10 en `FAST_UP`,
  //   mais seulement +5 en `FLAT`. Un repli doux comme une poussée saine sont deux bons points
  //   d'entrée ; l'immobilité n'en est pas un — elle n'est pas un risque, juste un non-événement.
  //   ⚠ Les deux extrémités RETOMBENT, pour deux raisons opposées :
  //     `EXPLOSIVE_DOWN` +3 — c'est le seul cas où la traversée devient plausible (« sauf cas de
  //       cross clair », owner). On ne paye pas pour un côté qu'on risque de quitter.
  //     `EXPLOSIVE_UP`   +8 — logique de PLACE RESTANTE, déjà posée chez le DI : un mouvement
  //       violent vers le haut a moins de chemin devant lui. On n'achète pas l'euphorie.
  SLACK: {
    EXPLOSIVE_DOWN: +3, FAST_DOWN: +5, SOFT_DOWN: +8,
    FLAT: +5,
    SOFT_UP: +8, FAST_UP: +10, EXPLOSIVE_UP: +8,
  },

  // `TENSE` — installé fermement : persistance 89 % à 2 bougies. Le creux central de `SLACK`
  //   DISPARAÎT (`FLAT` +5 → +8) et le sommet se déplace de `FAST_UP` vers les deux `SOFT` (+10).
  //   ⭐ LA LIGNE DEVIENT QUASI SYMÉTRIQUE AUTOUR DE `FLAT` : ce n'est plus le SENS de Δz qui
  //   compte, c'est sa VIOLENCE. Le calme paye, l'agitation décote des deux côtés — ce qui est la
  //   traduction directe du fait mesuré : Δz ne dit rien sur la traversée, donc rien sur le côté.
  //   ⚠ La décote reste PLUS FORTE À GAUCHE (+5/+3) qu'à droite (+8/+5) : à droite on ne perd que
  //   de la place restante, à gauche on risque le côté lui-même.
  TENSE: {
    EXPLOSIVE_DOWN: +3, FAST_DOWN: +5, SOFT_DOWN: +10,
    FLAT: +8,
    SOFT_UP: +10, FAST_UP: +8, EXPLOSIVE_UP: +5,
  },

  // `TENSE_HIGH` — persistance 94 % à 2 bougies. ⭐ LE SOMMET BASCULE À GAUCHE : le plateau +10
  //   couvre désormais `SOFT_DOWN` et `FLAT`, et tout le flanc droit décroche (+10→+8, +8→+5,
  //   +5→+3). La place restante devient le facteur dominant : plus le prix est haut dans la bande,
  //   moins il est payant qu'il monte encore, et plus il est payant qu'il souffle.
  //   ⚠ `FLAT` passe de +8 à +10 alors qu'il ne vaut que +5 en `SLACK` : le même mot vaut le
  //   maximum ici et un non-événement là-bas. C'est exactement pour ça que la bande morte devait
  //   être calibrée PAR NIVEAU — avec les coupures fixes du moteur, `FLAT` mélangeait les deux.
  TENSE_HIGH: {
    EXPLOSIVE_DOWN: +3, FAST_DOWN: +5, SOFT_DOWN: +10,
    FLAT: +10,
    SOFT_UP: +8, FAST_UP: +5, EXPLOSIVE_UP: +3,
  },

  // `EXTREME` — persistance 95 % à 2 bougies, la plus haute de la table. Le plateau gauche ne bouge
  //   plus (+10 sur `SOFT_DOWN` et `FLAT`) mais le flanc droit s'effondre jusqu'à **0**.
  //   ⭐ CE `0` EST LE VERDICT DU FAUX RELÂCHEMENT, PRIS PAR L'AUTRE BOUT. À |z| ≥ 2,15 le prix
  //   pousse encore dans 97 % des cas où z relâche ; un `EXPLOSIVE_UP` y est donc une poussée réelle
  //   et massive, sans place devant elle. On ne la suit pas, et on ne la fade pas non plus — d'où
  //   `0`, une OPINION (« aucun intérêt à entrer »), pas une absence.
  //   ⚠ `EXPLOSIVE_DOWN` (0 % de population) et `EXPLOSIVE_UP` (2 %) sont renseignés par l'owner
  //   bien qu'ils ne tirent presque jamais. Ils ne coûtent rien : ce sont les seules cases de la
  //   ligne qui ne pèsent pas.
  EXTREME: {
    EXPLOSIVE_DOWN: +3, FAST_DOWN: +5, SOFT_DOWN: +10,
    FLAT: +10,
    SOFT_UP: +5, FAST_UP: +3, EXPLOSIVE_UP: 0,
  },

  // ⭐🔥 `SNAPPED` — LA LIGNE SE RETOURNE. Le sommet repasse à DROITE (+10 sur `SOFT_UP` et
  //   `FAST_UP`) et le plateau gauche redescend à +8. Inversion complète du flanc droit par rapport
  //   à `EXTREME`, qui y tombait à +5/+3/0.
  //   ✅ Ce n'est pas une intuition isolée : la population de la ligne penche déjà à droite
  //   (`SOFT_UP` 30 % + `FAST_UP` 22 % contre `SOFT_DOWN` 19 %), le taux de relâchement s'effondre
  //   à **28 %** — contre 67-71 % partout ailleurs — et il RÉPLIQUE sur 3 TF (M15 25 %, H4 25 %,
  //   D1 29 %). Au-delà de 2,60σ ce n'est plus un étirement, c'est une SORTIE DE RÉGIME : la logique
  //   de place restante ne s'applique plus, il n'y a plus de bande à laquelle se référer.
  //   ⚠ H1 fait exception (57 %, n=83) et la ligne entière ne pèse que 1,4 % (n=455). C'est la
  //   ligne la moins solide de la table — à remesurer quand le jeu de données s'allongera.
  //   ⚠ `EXPLOSIVE_DOWN` et `FAST_DOWN` sont à 0 % de population ici : renseignés, jamais tirés.
  SNAPPED: {
    EXPLOSIVE_DOWN: +3, FAST_DOWN: +5, SOFT_DOWN: +8,
    FLAT: +8,
    SOFT_UP: +10, FAST_UP: +10, EXPLOSIVE_UP: +8,
  },
};

// ── AGRÉGATION MULTI-TF ────────────────────────────────────────────────────────────────────────
//   🔴 PROVISOIRE — poids du Cycle repris tels quels (owner : « on ajustera »). Constante SÉPARÉE et
//   non un import : les deux coïncident par défaut, pas par nature.
export const ZSCORE_TF_WEIGHTS = { h1: 0.40, h4: 0.30, d1: 0.15, m15: 0.15 };

export const ZSCORE_MIN = -10;
export const ZSCORE_MAX = +10;

// Score d'UN timeframe, depuis les valeurs BRUTES (l'expert bande lui-même : ses deux axes ne sont
//   pas ceux du moteur — `|z|` en 6 barreaux et `Δz` calibré par niveau n'existent pas ailleurs).
//   `null` = pas d'avis (jamais 0) : valeur absente, ou case non renseignée.
export function zscoreExpertScore({ z, dZ }) {
  if (z == null || dZ == null || !Number.isFinite(z) || !Number.isFinite(dZ)) return null;
  if (z === 0) return null;                       // pas de côté ⇒ pas d'orientation possible
  const level = zLevel(z);
  const col = zDeltaCol(dZ * Math.sign(z), level);
  if (!level || !col) return null;
  const row = ZSCORE_TABLE[level];
  if (!row) return null;
  const s = row[col];
  if (!Number.isFinite(s)) return null;
  return z > 0 ? s : -s;                          // miroir STRUCTUREL : colonne déjà retournée
}

export const zscoreGlobal = (perTf) => weightedGlobal(perTf, ZSCORE_TF_WEIGHTS);
