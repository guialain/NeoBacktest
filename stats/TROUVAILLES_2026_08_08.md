# Trouvailles du 08/08 — le veto EXH : de la DUREE a l'ALIMENTATION

Session ouverte sur une these de l'owner : **« veto EXH quand la tendance est trop forte — le %K et
le RSI saturent et tardent longtemps dans les extremes »**, cas de depart US_TECH100 du 04/08.
Rien n'a ete cable. Tout ce qui suit est mesure sur le dataset 28 j, 19 actifs, spread facture.

⚠ **Population**: sauf mention contraire, tout est en **NON CONTRAINT** (`spacing=false&maxOpen=100000`,
7 048 tirs EXH) et non en config prod (2 602). La capacite supprime ~82 % des tirs : sur la population
prod on compte la frequence du **passage au carnet**, pas celle de la **figure**.

⚠ **Metrique** : WR, pas R. Le R depend du nombre de trades, il ne dit rien de la precision du signal.
Et toujours **deux WR** — par tir et par grappe actif×jour : les tirs ne sont pas independants, et
l'ecart entre les deux colonnes EST l'information.

---

## 1. Saturer, c'est une DUREE — et il y a un PLAFOND
`_persistance_extreme.mjs`

```
  EXH SELL · persistance %K H4      tirs   WR/tir  WR/grappe  grappes  <75%
    pas a l'extreme                 2176   80,6 %    78,6 %      124     31
    < 30 min                         632   69,8 %    77,7 %       58     15
    30-60 min                        286   75,9 %    73,4 %       39     12
    1-2 h                            242   78,9 %    79,3 %       34      8
    2-4 h                            297   66,7 %    79,4 %       22      5
    4-8 h                            178   41,6 %    69,2 %       10      4   <-- le creux
    > 8 h                             77   93,5 %    94,0 %        3      0   <-- MEILLEURE bande SELL
```

- **La courbe est en U, et le plafond est la regle** (owner) : extreme FRAIS = epuisement · **2-8 h =
  la tendance chevauche l'extreme** · > 8 h = le mouvement est fini. `> 8 h` bat meme « pas a
  l'extreme », avec **zero grappe sous le point mort**.
- **La duree bat le compte de criteres de 26 points** : sur la meme population, « 3/3 satures a
  l'instant » (`%K H1>=90 · %K H4>=90 · RSI M15>=80`) = 62,2 % ; `%K H4` depuis 4-8 h = 36,2 %.
  Un instantane melange les trois ages de la figure.
- **Le miroir dit l'inverse, proprement** : `EXH BUY · %K H4 · 2-4 h` = **100,0 %** sur 88 tirs et
  **11 grappes**, 0 sous le point mort. Meme figure geometrique, memes seuils.
- Le `%K H1` a la meme fenetre, decalee : creux **1-4 h** (2-4 h : 56,8 %/tir, 68,5 %/grappe,
  16 grappes, 7 sous le point mort), retour a **79,1 %** au-dela.

### Ce que la colonne WR/grappe revele
`SELL 4-8 h` : **41,6 % par tir mais 69,2 % par grappe** — 28 points d'ecart. La figure n'est pas
mauvaise en moyenne, elle est mauvaise **quand elle se repete** : 6 grappes sur 10 tiennent le point
mort, les 4 autres tirent des dizaines de fois et perdent tout.
Et la reference dit la meme chose : **cellule SELL = 80,9 % par grappe contre 75,8 % par tir**
(140 grappes, 34 sous le point mort). **Par FIGURE le SELL est au-dessus du point mort ; c'est
l'EXPOSITION qui le fait passer dessous.**

### La figure n'est pas rare — c'etait son arrivee au carnet qui l'etait
Taux de base sur toutes les barres : **100 episodes** de `%K H4` a l'extreme >= 2 h, sur **28 journees
de calendrier / 28** et les **19 actifs**, 1 a 11 actifs par jour.
⚠⚠ J'avais d'abord conclu « 11 grappes, donc une seule journee » en mesurant sur la population prod.
C'etait la frequence du passage au carnet. **Compter des OCCURRENCES exige la population non contrainte.**

---

## 2. « On ne fade pas un extreme encore ALIMENTE »
`_alimentation_extreme.mjs`

These owner ecrite **avant** les chiffres : tant que (a) le prix chevauche sa bande et (b) les bandes
s'ouvrent, la tendance se nourrit — peu importe depuis 20 minutes ou 6 heures.

Definition orientee, miroir : `zB >= 2` **ET** `dBBW > 0`.
Zero colonne a ajouter : `zscore_h1_s0 = (price − middle_h1)/sigma_h1` a **100 %** (n=22 876, ecart
median 0,0000) et `bbw = 4σ/M` ⇒ bandes a ±2σ ⇒ **`%B >= 1` s'ecrit exactement `z >= 2`**.
⛔ Pas de BBW H4 dans le dataset : `(b)` n'existe qu'en H1.
Occupation : **5,9 %** de toutes les barres, **18,6 %** des barres extremes.

```
                          tirs   WR/tir  WR/grappe  grap  <75%
  SELL reference          3888   75,8 %    80,9 %    140    34
    (a) prix hors bande   1937   74,1 %    82,0 %    113    26
    (b) bandes s'ouvrent  2876   75,0 %    81,7 %    137    33
    ALIMENTE (a ET b)     1593   74,1 %    82,7 %    112    24   <-- AU-DESSUS de la reference
    duree >= 2 h           552   62,3 %    80,7 %     29     8
    CONJONCTION            265   48,7 %    67,4 %     13     6   <-- le discriminant
  BUY  ALIMENTE           1314   90,5 %    91,3 %    103    10   <-- au-dessus de la reference (89,8)
  BUY  CONJONCTION          32  100,0 %   100,0 %      3     0   (contre 98 tirs pour la duree seule)
```

- **L'alimente SEUL ne trie pas** — il retire une population **meilleure que la moyenne par grappe**,
  des deux cotes. Ni `(a)` ni `(b)` seuls ne trient non plus.
- **Le discriminant est l'INTERSECTION** : « alimente seul » = 79,1 % (au-dessus du point mort, bloque
  a tort) · « duree seule » = 74,9 % (neutre) · **« les deux » = 48,7 %**.
  ⇒ **La duree n'etait PAS qu'un proxy** : les deux axes portent de l'information distincte.

### Robustesse (Δ WR de la cellule, memes decoupes)
```
  decoupe            cote | avant  | CONJONCTION | ALIMENTE | DUREE >= 2 h
  tel quel           SELL | 75,8 % |   +2,0      |  +1,2    |  +2,2
  sans le 04/08      SELL | 79,9 % |   +0,7      |  +1,0    |  +0,6
  sans indices US    SELL | 81,0 % |   +0,2      |  -0,4 !  |  +0,0
  juillet seul       SELL | 81,5 % |   +0,5      |  +1,3    |  -0,0
  aout seul          SELL | 51,0 % |   +4,2      |  +1,7    |  +5,1
  BUY (les 5)             | 89-94% |  -0,1 partout | jusqu'a -1,1 | jusqu'a -0,4
```
**Seule la conjonction est strictement positive cote SELL dans les 5 decoupes, et son cout BUY est
plafonne a -0,1 pt partout.** A `T = 240` elle retire 142 SELL a 40,8 % et **zero tir BUY**.

### Verif de coherence de la these — elle passe, mais elle n'explique pas tout
Taux d'alimentation par bande de persistance, SELL :
```
  pas a l'extreme 43,1 % · <30min 34,0 % · 30-60 31,8 % · 1-2 h 34,7 %
  2-4 h 41,4 % · 4-8 h 62,4 % <-- · > 8 h 40,3 %
```
L'alimentation **culmine exactement dans le creux** et retombe au `> 8 h`. Cote BUY, `4-8 h` et
`> 8 h` sont a **0,0 %** alimente pour 100 % de WR (n=8 et 2).
⚠ **Mais elle n'explique pas tout le U** : `2-4 h` (66,7 % WR) et `> 8 h` (93,5 % WR) ont le **meme**
taux (~41 %) pour 27 points d'ecart. Il reste un facteur non capture entre les deux.

### Le prix reste reel
Les 13 grappes SELL retirees par la conjonction : **6 sous le point mort** (US_500 03/08 0 % ·
US_TECH100 29/06 0 % · US_500 04/08 24 % · US_TECH100 04/08 32 % · GERMANY_40 02/07 49 % ·
GOLD 05/08 71 %) et **7 grappes a 100 % detruites**. Et « sans indices US » ne laisse que +0,2 pt.

---

## 3. Le danger est TOUJOURS au MILIEU — quatre capteurs
```
  ADX H1 live            creux 30-49 (68-69 %)   bon >= 50 (88 %)
  dailyForce             creux HIGH (72,0 %)     bon EXTREME (77,8 %) · MEDIUM 79,6 · LOW 79,2
  diPour (DI du trade)   creux 6-15 (70-75 %)    bon < 6 (84,7 %)
  persistance %K H4      creux 2-8 h             bon < 1 h ET > 8 h
```
Generalise `vitesse_x_niveau` (06/08). Consequence directe : **tout veto de la forme « bloquer quand
la tendance est trop forte » vise un cran trop loin** — a l'endroit vise, le fade gagne.
⚠ Et rien de tout ca n'est miroir : `diPour < 6` est la **meilleure** bande en SELL (84,7 %) et la
**pire** en BUY (77,9 %).

---

## 4. Le barème v1 trie le BUY et ZIGZAGUE en SELL
`_wr_par_score_v1.mjs`

```
  EXH SELL, |score|   10-14 75,4 · 15-19 76,2 · 20-24 71,7 · 25-29 83,6 · 30-34 57,9
                      35-39 79,3 · 40-44 90,7 · 45-49 82,2 · 50-54 66,7 · 55 41,4
  EXH BUY  cumulatif  89,8 → 89,8 → 90,1 → 92,6 → 93,7 → 93,9   (seuils 10→35)
  EXH SELL cumulatif  75,8 → 75,8 → 75,8 → 77,5 → 76,0 → 80,6
```
Deux bandes **adjacentes** ecartees de **33 points** cote SELL, cinq bandes sur dix sous le point mort.
Cote BUY aucune bande n'y descend et la pente est propre.
⇒ C'est la precision qui manquait a « `sExh` ne trie pas sa propre figure » : **il trie, mais d'un
seul cote**. Et cote SELL, le seuil ne fait rien jusqu'a 30 puis gagne 4,8 pts d'un coup a 35 — en
jetant 67 % des tirs.
⚠ `55 (plafond)` = **2 grappes** de chaque cote : ce n'est pas une population.

---

## 5. Δ DI < 0 est INERTE — et le pas n'est pas additif
`_delta_di_calib.mjs`

Teste a la demande de l'owner (« veto : `DI < 5` **et** delta DI negatif »). La regle ne peut pas
exister sous cette forme :
```
  diPour < 5           BUY 122 · SELL 138
  … ET Δ < 0           BUY 122 · SELL 138
  … ET Δ >= 0          BUY   0 · SELL   0     <-- cette population N'EXISTE PAS
```
Parce que `Δ DI / DI_precedent` vaut **-0,1333 a TOUS les niveaux** (p10 = p25 = p50, n=839 300, 8
bandes de niveau) et que **56,7 % des barres sont EXACTEMENT dessus** : c'est la decroissance de
l'EMA Wilder quand rien n'entre. `Δ < 0` ne dit pas « moins d'acheteurs », il dit « l'horloge a tourne ».

- **Un pas absolu n'a aucun sens** : la decroissance vaut -0,42 a DI 1-5 et -5,35 a DI 40+. Une bande
  morte a ±1,5 declare « plat » tout ce qui est sous DI 11 et ne mord jamais au-dessus de DI 20.
- ✅ **La constante est deja celle du moteur** : `ADX_EMA_ALPHA = 2/15` et `diDeltaLive` /
  `diGapDeltaLive` la soustraient (owner 26/07). Mesure independante : 13,33 %. **Pas de bug.**
  ⚠ Mais `diDeltaLive` (le DI **par camp**) n'a **aucun appelant dans le scoring** — seul l'ECART est
  corrige.
- ⚠⚠ **La lecture live `s0 − c1` est biaisee sur n'importe quelle barre** : +DI 70,9 % de negatifs,
  -DI 72,0 %, **ADX 48,8 %** (lui n'a pas le biais), close a close 56,0 %.
  🔴 **Tout resultat obtenu sur `s0 − c1` nu est a refaire close a close.** Vecu ici : « les 4 % de
  tirs SELL ou le -DI remonte portent 100 % du R (56 tirs, 92,9 %) » — refait proprement (144 tirs),
  **l'effet s'inverse a 72,2 %**.
- L'echelle propre, si on veut s'en servir : `e = Δ + 13,33 % × DI_prec` est un **interrupteur**, pas
  une pente — 56,8 % a `e = 0`, quasi rien entre 0 et 0,43, puis une bosse large. Coupes sur le non
  nul : `0,43 · 1,80 · 3,97 · 7,13 · 9,67 · 11,44`.

---

## 6. Les gels de flux — trouves en ouvrant les cas
`_gel_flux.mjs`

Le 04/08, **226 lignes IDENTIQUES de 10:25 a 14:10 UTC sur les 19 actifs** — prix et tous les
capteurs figes. Pas un marche fige (3 h 45 un mardi) : le scan a repete sa derniere ligne.
- US_TECH100 tire son 1er SELL EXH a **14:11**, une minute apres la reprise.
- SILVER tire a **14:15**, sur la barre de reprise elle-meme : prix +2,0 %, `z` 0,64 → 1,90,
  `%K H1` 22 → 86, `+DI` 14 → 24, `-DI` 14 → 8, en **un tick de scan**. Le moteur n'a pas vu la
  montee, il en a vu le resultat — et l'a lue comme un epuisement. 5 echecs sur 6 entre 14 h et 15 h.
- ⚠⚠ **Ca gonfle toute mesure de duree** : la persistance lue au 1er tir du 04/08 valait 281 min dont
  **225 de gel** — reelle ~56 min.

**254 gels >= 30 min** dans le dataset, avec des journees a 19 actifs simultanes (30/06 · 10/07 ·
13/07 · 14/07 · 23/07 · 24/07 · **04/08**).

WR selon le delai depuis la reprise :
```
                      SELL                          BUY
  < 15 min      49 · 55,1 %              40 · 100,0 %
  15-30 min     47 · 53,2 %              50 · 100,0 %
  30-60 min    101 · 50,5 %              71 · 100,0 %
  1-2 h        213 · 56,8 %             127 ·  90,6 %
  2-6 h        535 · 79,6 %             262 ·  92,0 %
  > 6 h       2784 · 79,7 %            2583 ·  88,8 %
```
Les **deux premieres heures apres une reprise : 410 tirs SELL a ~54 %**, puis bascule nette a 79,6 %.
Cote BUY, la meme fenetre est a **100 % sur 161 tirs / 14 grappes**.

⚠⚠ **Trois reserves avant d'en faire quoi que ce soit** :
1. Le detecteur **confond** fermeture normale (week-end, overnight indices, session COCOA — les gels
   de 3 467 min du 31/07 sont ca) et **panne de scan marche ouvert** (04/08). Le premier est
   legitime, le second est un bug.
2. Du coup « delai depuis le gel » mesure surtout **« minutes depuis l'ouverture de session »** —
   variable causale et gratuite, mais ce n'est pas la these de la panne.
3. Separer les deux demande de croiser avec les heures declarees par actif. **Pas fait.**

---

## Etat au 08/08 au soir
- **Rien n'est cable.** Le moteur (`Matrix-Revolution`) n'a pas ete touche de la session.
- **Candidat n°1** : veto miroir `%K H4 a l'extreme depuis >= 2 h` **ET** `encore alimente`.
  Le seul de la session positif dans les 5 decoupes SELL, cout BUY plafonne a -0,1 pt.
- **Candidat n°2** (second) : la duree seule a `>= 2 h`. A `>= 4 h` elle redevient un detecteur du 04/08.
- **Ce qui bloque les deux** : le gain reste adosse aux indices US et a aout, et **l'OOS n'a jamais
  ete fait**. C'est le troisieme candidat de suite qui bute exactement la.
- Hors cadre mais sorti par la meme mesure : **cellule EXH SELL, aout seul = 51,0 % de WR** contre
  81,5 % en juillet. Le veto la remonte a 56,1 %, ce qui reste tres en dessous du point mort.
