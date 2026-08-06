# Trouvailles — session du 2026-08-06

Dataset **28 jours** (24 juillet + 4 août), 19 actifs, spread facturé sauf mention.
Point mort **75 %**. σ calculé contre le point mort.

---

## 1. Le dataset de juillet était une base surajustée

| fenêtre | ép | WR | R | maxDD | R/DD |
|---|--:|--:|--:|--:|--:|
| 24 j (juillet) | 3 066 | 77,17 % | 87,9 | 34,1 | **2,57** |
| 25 j | 3 168 | 77,02 % | 84,5 | 38,2 | 2,21 |
| 26 j | 3 267 | 76,71 % | 73,5 | 48,5 | 1,51 |
| 27 j | 3 361 | 76,20 % | 52,8 | 70,9 | 0,75 |
| **28 j** | 3 488 | 75,92 % | 41,7 | 80,4 | **0,52** |

Chaque jour d'août est déficitaire **séparément** (−0,03 / −0,11 / −0,22 / −0,09 R par épisode)
⇒ changement de régime, pas artefact de fin de fenêtre.

Le WR ne perd que 1,25 pt mais le **maxDD double** : les pertes se groupent.

**Par rang, sur 28 j** : ① EXH −30,4 · ② PB **+41,6** · ③ CONT +30,5.
→ le **PULLBACK est le seul rang à traverser août**, et il porte à lui seul plus que le total.

---

## 2. La figure H1 (la trouvaille)

```
zone H1 EXTRÊME du côté fadé   (%K ≥ 88 en SELL, ≤ 12 en BUY)
kdCur = DIVERGING              l'écart K/D s'ouvre
K/D orienté dans le sens du fade
```

| | facturé | hors spread |
|---|--:|--:|
| **168 ép** | **79,8 %** (+1,43 σ) | **82,1 %** (+2,14 σ) |
| R | +10,6 | +16,0 |

**Trois contrôles passés :**
- symétrique — SELL 80,2 % (91 ép) · BUY 79,2 % (77 ép)
- stable — P1 78,5 % · P2 80,9 % (**P2 contient août**)
- robuste au comptage — 79,8 % par épisode · 79,4 % par tir

⚠ **Non tradable en l'état** : n'existe que via un contournement de la table d'admission, qui exige
`K<D` pour un SELL. Cette relation est ce qui rend les deux côtés mutuellement exclusifs.
→ obstacle de conception, pas de mesure.

### Croisement par ΔK

| bande (orientée) | n | WR | R |
|---|--:|--:|--:|
| SOFT_UP | 69 | 78,3 % | +3,0 |
| **FAST_UP** | 51 | **86,3 %** (+2,18 σ hors spread) | **+7,7** |
| EXPLOSIVE_UP | 37 | 73,0 % | −1,0 |

Cloche : sommet sur l'accélération franche, chute sur l'explosive.
→ même doctrine que le moteur applique déjà ailleurs (« un blow-off est ce que le fade prend, pas
ce qu'il subit »), retrouvée ici indépendamment.

### Raffinement `|kdH1| < 20`
136 ép · 81,6 % · R +12,0. Motif : on ne fade pas un blow-off.
Confirmé par **GERMANY_40 02/07** — deux SELL à 48 min d'écart, `kdH1` 26,2 puis **28,15**
(l'écart s'ouvre encore entre les deux), %K 88 → 91, les deux au SL.

🔴 Borne basse à 5 **rejetée** : meilleur chiffre (+2,45 σ) mais aucun motif. Et 6 fenêtres testées
sur la même population ⇒ le σ de la meilleure est optimiste.

---

## 2 bis. Ce n'est pas la vitesse qui décide, c'est **vitesse × niveau**

Carte zone %K H1 × ΔK, les deux axes orientés par le côté, veto `h4-leg-still-pushing` coupé.

| zone (orientée) | SOFT_UP | FAST_UP | EXPLOSIVE_UP | total |
|---|---|---|---|---|
| **EXTREME_HAUTE** | 60 · 73 % | **40 · 88 %** | **24 · 88 %** | 133 · 80,5 % · R **+9,6** |
| HAUTE | 173 · 71 % | 187 · 74 % | **178 · 65 %** | 562 · 69,8 % (−2,87 σ) · R **−39,5** |
| MID | 79 · 61 % | 107 · 70 % | 45 · 71 % | 240 · 67,9 % (−2,53 σ) · R −22,7 |
| BASSE | 42 · 69 % | 14 · 64 % | — | 62 · 69,4 % · R −4,7 |

**Le même `EXPLOSIVE_UP` vaut 91,7 % en zone extrême et 65,7 % en zone HAUTE** (hors spread).
26 points d'écart sur la même vitesse.

Et l'inversion est propre :
- zone **extrême** — plus le %K accélère, mieux c'est : 74,6 → 89,5 → **91,7 %**
- zone **HAUTE** — l'inverse : 73,9 → **65,7 %**

→ à saturation, une accélération explosive est un **épuisement** (on fade la fin).
→ à mi-course, la même accélération est un **mouvement qui s'installe** (on se met en travers).

Les trois écarts significatifs tiennent dans les deux modes de spread :

| case | facturé | hors spread |
|---|--:|--:|
| EXTREME_HAUTE · FAST_UP | 87,5 % (+1,83 σ) | **89,5 %** (+2,06 σ) |
| **HAUTE · EXPLOSIVE_UP** | **64,6 %** (−3,20 σ) | **65,7 %** (−2,84 σ) |
| MID · SOFT_UP | 60,8 % (−2,92 σ) | 62,0 % (−2,66 σ) |

⚠ **Correction** : `EXPLOSIVE_UP` n'est PAS la mauvaise classe de la figure. Les 73,0 % annoncés
plus haut venaient de la figure **amputée** par `h4-leg-still-pushing`, actif par défaut. Sur la
figure nue, elle fait 87,5 %.

⇒ **`HAUTE × EXPLOSIVE_UP` est le meilleur candidat veto de la session** : 178 ép, −3,20 σ,
R −24,7 (63 % du déficit de la zone), motif clair, et il ne dépend pas de la figure H1 — il
vaudrait pour tout fade.

---

## 3. Réfuté par la mesure

| test | résultat |
|---|---|
| `+CONVERGING` ajouté à la figure | 311 ép · 73,3 % · R −7,1 — les 220 ép ajoutés font ~70 % |
| `H1 zone EXTREME_HAUTE` + K>D | 4 ép — population inexistante |
| échelle de relâchement `KD ≠ RISING` | 1 013 ép · 72,3 % · **−2,01 σ** |
| `K>D + CONVERGING|CONTACT` H4 | 533 ép · 70,5 % · **−2,38 σ** |
| `drsiH4S0` comme discriminant | plat sous toutes ses formes (signe, tranches, tir, épisode) |

La doctrine écrite « les lignes qui se rapprochent ANNONCENT le retournement, elles ne le
CONSTATENT pas » est **confirmée** par la mesure.

---

## 4. Pièges de mesure rencontrés

**Bandes signées non orientées** — `FAST_DOWN` sortait à `100 % sur 21 ép (+2,65 σ)`.
C'était un demi-échantillon (côté BUY seul). Regroupé avec son reflet : **86,3 % sur 51**.
→ toute bande signée doit être orientée par le côté dès que le miroir est actif.
→ une magnitude (`kdDist`, `|kd|`) ne s'oriente pas : elle n'a pas de côté.

**Trop de sous-périodes** — en 4 fenêtres, P1 sortait à **−2,80 σ** ; en 2 fenêtres, −0,98 σ.
Découper trop fin ne fait pas qu'ajouter du bruit, ça **fabrique des faux significatifs**.
→ 2 fenêtres tant que la population est sous ~200 ép.

**Comptage par tir** — écart jusqu'à 5,5 pts avec le comptage par épisode, et ça inverse des
conclusions (80,2 % / R +6,3 par épisode → 74,7 % / R −1,1 par tir sur la même population).

**Post-traitement manquant au rebuild** — `mergeSigmaH1` (4ᵉ, absent de la recette).
Sans lui `middle_h1_s1` tombe de 96,5 % à 0 % ⇒ le fade bascule sur une autre échelle,
sans lever d'erreur. Trouvé par comparaison du remplissage colonne par colonne, ancien vs nouveau.

**Archives** — rotation 30 jours sur le VPS ; les jours antérieurs ne sont récupérables nulle part.
Un `tar` interrompu laisse un fichier tronqué que « le fichier existe » ne détecte pas
(28,6 Mo reçus pour 70,4 Mo attendus).

---

## Point ouvert — le barème K/D EXH n'a pas l'axe de nos trouvailles

`KD_EXH_BUY`/`_SELL` croisent **transition K/D (`prev → cur`) × zone %K**, 16 lignes × 4 niveaux.
Nos mesures portent sur **zone %K × ΔK**. Le seul axe commun est la zone — **`dKBand` n'entre
nulle part dans le barème**.

Ce que la table ne sait pas dire aujourd'hui, en `EXTREME_HIGH` :

| | mesuré (hors spread) | table |
|---|--:|--:|
| SOFT_UP | 74,6 % | +10 |
| FAST_UP | 89,5 % | +10 |
| EXPLOSIVE_UP | 91,7 % | +10 |

Cinq transitions différentes valent **+10 en `EXTREME_HIGH`**. La table est plate là où la mesure
sépare 17 points.

⚠ À trancher avant d'écrire quoi que ce soit — ce n'est pas un réglage, c'est un choix d'axe :
- ajouter `dKBand` comme **3ᵉ axe** ⇒ 16 × 4 × 7 = 448 cases, invérifiable et indictable ;
- **remplacer** un axe existant ⇒ il faut d'abord mesurer lequel de `kdCur` ou `dKBand` trie le
  mieux, seul ;
- porter la vitesse sur l'expert **`gap`** plutôt que sur le K/D, puisque c'est lui qui croise
  déjà zone × dynamique en EXH ;
- ou laisser le barème et traiter ces figures par **veto** — les deux mécanismes ne sont pas
  antagonistes : le barème ORDONNE, le veto REFUSE et ROUTE.

⚠ Et quel que soit le choix : la carte a été mesurée **toutes périodes confondues**, sur un
système qui passe de **+3,07 σ (P1)** à **−1,42 σ (P2)**. Vérifier quelles cases tiennent sur P2
avant d'en écrire une seule en dur.

---

## À faire ensuite

0. **Le barème K/D EXH doit intégrer les trouvailles zone × ΔK** — voir le point ouvert ci-dessus.
1. **Hors-échantillon** sur la figure H1 avant de la câbler.
2. Résoudre l'**admissibilité** — la rendre légale sans casser l'exclusivité des côtés.
3. Creuser le **PULLBACK**, seul rang positif sur 28 jours.
4. `middle_h4_s1` / `sigma_h4_s1` sont arrivées au rebuild ⇒ étendre le gap au H4.
