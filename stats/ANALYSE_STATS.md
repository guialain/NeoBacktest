# Analyse statistique EXH — récap

> Étude **indépendante du moteur/backtest** sur données brutes 6 mois.
> But : quelles conditions BRUTES séparent un fade d'exhaustion **gagnant** (le prix se retourne) d'un **perdant** (il continue) — et par extension, quand une continuation (CONT) est un piège.
> Ce fichier est le fil directeur : on **ajoute chaque résultat** au fur et à mesure, on s'appuie dessus.

---

## Dataset
- **Source** : `ExportHistFeatures.mq5` → `$MT5_DIR/MQL5/Files/hist_<ASSET>_<TF>.csv`
- **Couverture** : 19 actifs × {M15, H1, H4} = **57 fichiers**, ~300k barres, **2026.01.14 → 2026.07.14** (6 mois)
- **Colonnes** : `time;open;high;low;close;adx14;plus_di;minus_di;stoch_k;stoch_d;intraday_change`
  - ADX(14) + DI **natifs broker** · stoch **5/3/3 SMA LOWHIGH** (= params EA exacts) · intraday_change = (close−openD1)/openD1×100
- **Actifs** : AUDUSD BRENT_OIL BTCUSD COCOA CrudeOIL ETHUSD EURUSD GASOLINE GBPUSD GERMANY_40 GOLD SILVER UK_100 USDCAD USDCHF USDJPY US_30 US_500 US_TECH100
- **Barres par TF** : M15 4,2k–17,4k · H1 1,2k–4,4k · H4 378–1091 (⚠ H4 = petit échantillon, tails instables)
- **Dataset augmenté** : `stats/data/hist_*.csv` = source + `intraday_level` (9 régimes) + `intraday_force` (−4..+4) + `is_active` (1 si 7-20h jours ouvrés, sinon 0). Via `getIntradayLevel` + `IntradayConfig.js` (bornes percentiles par actif). ⚠ COCOA = config `default` (non calibré). ⚠ heures mortes = ~46% FX / ~61% crypto → **filtrer `is_active=1`** pour toute analyse intraday (elles figent intraday_change, gonflent NEUTRE). Distribution régimes ≈ design (NEUTRE 43%). (hist_ETHUSD_M15 : is_active à finir, fichier verrouillé au moment du run.)

## Scripts & sorties (dossier `stats/`)
| script | sortie | contenu |
|---|---|---|
| `kd_distribution.mjs` | `kd_distribution.xls` | distribution k−d par actif × TF, percentiles P1..P99 (+ miroir) |
| `test_contact_event_vs_21.mjs` | (console) | capture cross + rendement fade forward, contact-event vs contact-2,1 |
| `test_exh_adx_di_buckets.mjs` | (console) | rendement fade à l'exhaustion bucketé ADX × (AVEC/CONTRE DI dominant) |
| `kd_individual_distribution.mjs` | `stoch_kd_individual.xls` | distribution stoch_K et stoch_D séparément, P1..P99, par actif × TF |
| `test_k_perasset_stability.mjs` | (console) | stabilité temporelle de la distribution K par actif (2 moitiés) |
| `test_k_byclass.mjs` | (console) | distribution K par classe + drift temporel + dispersion intra-classe |
| `test_exh_intraday_velocity.mjs` | (console) | rendement fade à l'exhaustion bucketé par vitesse intraday (z-score) |
| `adx_distribution.mjs` | `adx_distribution.xls` | distribution adx14 par actif × TF, P1..P99 |
| `add_intraday_level.mjs` | `stats/data/*.csv` | dataset augmenté : + `intraday_level` + `intraday_force` (−4..+4) + `is_active` (7-20h) via IntradayConfig moteur |
| `intraday_dist_active_hours.mjs` | `intraday_active_hours.xls` | distribution intraday_change par actif, heures actives 7-20h (montre le biais des heures mortes) |

---

## RÉSULTAT #1 — Distribution de k−d (stoch_k − stoch_d)  ✅
**Question** : à quoi ressemble la distribution du gap k−d, et varie-t-elle par actif ?

**Percentiles retenus** : P1 P5 P10 P15 P20 P30 P40 **P50** P60 P70 P80 P85 P90 P95 P99 (P50 = pivot, le reste symétrique par miroir).

**Constat** :
- Distribution **centrée sur 0** (P50 ≈ 0 ±0,3) et **symétrique**.
- Repères universels (moyenne des 19, ~identiques tous actifs) :
  - **P20/P80 ≈ ∓9** · **P90/P10 ≈ ±14,5** · **P95/P5 ≈ ±18,5** · **P99/P1 ≈ ±25**
- **k−d est ASSET-AGNOSTIC** : écart-type inter-actifs = 0,2–0,5 pt sur le cœur (valeurs ~9–15), 0,6–1,6 pt sur les tails (valeurs ~24). La dispersion des tails **monte avec le TF** (H4>H1>M15) mais c'est surtout du **bruit d'échantillonnage** (H4 = peu de barres), pas une vraie différence d'actif.

**Pourquoi** : k et d sont des stochastiques bornés [0,100] déjà normalisés par le range récent → leur différence efface l'échelle de prix et la volatilité. C'est une **grandeur standardisée**.

**→ Conséquence design** :
- Un **seuil |k−d| universel** est légitime pour tous les actifs / TF (cohérent avec « aucune logique par actif »).
- On peut traduire un seuil en **rareté** (percentile) : ex. |k−d|=9 → P20/P80, |k−d|=18 → P95/P5.
- k−d **revient toujours à 0** (mean-reverting par construction). Un k−d extrême = le gap **va se refermer** aux barres suivantes → K va décélérer vers D.

---

## RÉSULTAT #2 — Le "pas" de k−d & la notion de contact  ✅
**Question** : peut-on fonder statistiquement un seuil de significativité (un "pas" de k−d) pour verrouiller la notion de **contact** (`|k−d|` petit = K colle à D) ?

**Constat — le pas naturel (`|Δ(k−d)|` par barre)** :
- Médian ≈ **6**, moyenne ≈ **7**, et **TF-universel** (M15≈H1≈H4, comme la distribution).
- Plancher de bruit = P10 ≈ **1,1** (en dessous, le gap n'a quasi pas bougé).
- `|k−d|` médian (7,3) ≈ son pas médian (6) → **k−d se re-randomise quasi à chaque barre**, très peu de persistance bar-à-bar → un cross sur **une seule barre est bruité**.

**Constat — le seuil actuel `contact = |k−d| ≤ 2,1`** :
- 2,1 = **P17** de |k−d| (fire ~17 % des barres) **et ~1/3 d'un pas** (6) → plus petit qu'une barre de mouvement.
- Conséquence : **les cross rapides sautent par-dessus la bande**. Le `|k−d|` de la barre juste avant un cross a une médiane de **~4** puis flippe de signe en une barre → passe de +4 à −X **sans tomber dans ±2,1**. Donc contact-2,1 **rate les cross rapides**, ne capte que ceux qui résolvent lentement.

**Seuil de significativité universel retenu** (tous actifs / TF) :
| unité | valeur | usage |
|---|---|---|
| bruit (P10 du pas) | **~1,1** | Δ(k−d) en dessous = rien ne s'est passé |
| **1 pas** (P50 du pas) | **~6** | une barre de mouvement réel = grain de significativité |
| pré-cross typique | **~4** (P50 de \|k−d\| avant flip) | d'où viennent les cross → une bande contact doit couvrir ~4–8, pas 2,1 |

**→ Conséquence design** : le bon contact n'est **pas** une bande fine autour de 0, c'est un **ÉVÉNEMENT** relatif au pas :
- **(A, recommandé)** contact = `sign(k−d)` flippe **ou** `|k−d|` s'effondre de ≥ ~1 pas (~6) vers 0 → attrape les cross rapides.
- **(B)** garder une bande statique mais la dimensionner à ~1 pas (|k−d| ≤ ~5-6) → fire ~40 % des barres, trop lâche.

---

## RÉSULTAT #3 — Contact-événement vs contact-2,1  ✅
**Question** : lequel capte mieux les cross K/D, et lequel prédit mieux le retournement (fade) ?
**Script** : `test_contact_event_vs_21.mjs` (horizon 4 barres, extrême %K 80/20, rendement fade en ATR).

**Recadrage conceptuel** : au lieu de *chasser* le contact (état « K près de D », raté quand ça va vite), on constate s'il a **eu lieu** via le **changement de signe de k−d** (événement « K est passé de l'autre côté de D »). Impossible à rater quelle que soit la vitesse.

**Volet 1 — capture des cross** :
- `contact-2,1` (bande |k−d| ≤ 2,1) ne capte que **~29 %** des cross → en **rate ~71 %** (tous TF). Raison : k−d bouge ~6/barre (le pas, Résultat #2) → les cross rapides *franchissent* la bande d'un bond sans y poser le pied.
- `contact-event` (flip de signe) capte **100 %** par construction (un cross = un flip de signe).
- **→ Sur la capture, l'événement gagne à plat de couture.**

**Volet 2 — prédiction du retournement** (rendement fade forward en ATR) :
| TF | SLOW (\|k-d\|≤2,1) | FAST (>2,1) | TOUS (event) |
|---|---|---|---|
| M15 | +0,012 · 50,7% | −0,006 · 49,6% | ~0 · 50,0% |
| H1 | −0,036 · 50,2% | −0,020 · 49,6% | −0,025 · 49,8% |
| H4 | +0,130 · 54,1% (n=499) | +0,021 · 51,5% | +0,058 · 52,4% |

- **Le cross d'exhaustion nu ≈ pile ou face** (mean ≈ 0, hit ≈ 50 %) ; à H1 légèrement négatif. Résultat propre, pas un bug : sur 4 barres en ATR un signal sans edge donne exactement ça.
- `contact-2,1` ne **sélectionne pas** mieux les fades (SLOW pas consistment > FAST : M15 un peu mieux, H1 pire, H4 mieux). Basculer 2,1 → event change le **rappel**, pas la **précision**.

**→ Conclusions** :
1. **Contact = ÉVÉNEMENT (flip de signe), pas bande statique.** Plus robuste et sémantiquement juste (ce qui compte = K *repasse* de l'autre côté, pas qu'il *frôle*).
2. **Ajouter un pas minimal** (flip venant de |k−d| ≥ ~1 pas, ~4-6) comme **filtre de significativité** — le signe seul est bruité (k−d se re-randomise chaque barre, Résultat #2) → éviter les micro-flips +0,3→−0,2.
3. **L'edge n'est PAS dans la définition du contact.** Le signal nu est plat → il est dans le **CONTEXTE** (ADX/DI, vitesse intraday, profondeur stoch) qui sépare le cross gagnant du perdant. **C'est la Tâche #1** (forward-return bucketé par dimension).

**Brique du bas fondée stat** = `flip de signe + pas minimal` ; le contexte se pose par-dessus.

⚠ Réserves : horizon figé 4 barres, extrême 80/20, **inconditionnel** (tous régimes mélangés) — l'edge vit probablement dans les sous-buckets, non encore ouverts.

---

## RÉSULTAT #4 — Distribution de K & D individuels / zones extrêmes  ✅
**Question** : où K et D se posent vraiment, pour caler les zones extrêmes (au lieu de supposer 80/20) ?
**Script** : `kd_individual_distribution.mjs` → `stoch_kd_individual.xls` (6 onglets K/D × TF).

**Distribution stoch_K (agrégat inter-actifs, TF-invariant)** :
| | P5 | P10 | P20 | **P50** | P80 | P90 | P95 |
|---|---|---|---|---|---|---|---|
| M15 | 12 | 17 | 26 | **52** | 78 | 85 | 90 |
| H1 | 13 | 18 | 27 | **53** | 78 | 85 | 89 |
| H4 | 13 | 19 | 28 | **54** | 79 | 86 | 90 |
stoch_D (lissé, queues resserrées) : D≥80 ~14 %, D≤20 ~10 %.

**Constats** :
1. **Médiane K ≈ 52-53, pas 50** → K **biaisé vers le haut** (période 6 mois à drift haussier).
2. **80/20 est asymétrique en rareté** : `K≥80` = **~17 %** des barres (≈P83), `K≤20` = **~13 %** (≈P13). L'extrême haut est 1,3× plus fréquent → **gonfle structurellement les sell-exh** (indépendamment du marché).
3. **K seul est MOINS asset-agnostic que k−d** : médiane K varie 47,4→61,2 selon l'actif (std 3,1), vs std ~0,15 pour k−d. La **différence** k−d annule le biais de niveau ; K brut le garde. Spread modéré à P90 (std 2,2) → seuil universel jouable mais pas pristine.

**Options zones extrêmes universelles (tous TF)** :
| objectif | seuils K | fréquence/côté |
|---|---|---|
| actuel | 80 / 20 | 17 % / 13 % (asymétrique) |
| ~10 % symétrique | **85 / 17** (≈P90/P10) | ~10 % / ~10 % |
| ~15 % symétrique | 82 / 23 | ~15 % / ~15 % |
| top/bottom 5 % | 90 / 13 (≈P95/P5) | ~5 % / ~5 % |

**→ Conséquences design** :
- Passer à **85/17** (ou recentrer) pour **rééquilibrer buy-exh/sell-exh** (enlève le biais haussier structurel).
- Recentrer K par sa médiane propre corrigerait le biais par actif mais = **logique par actif (interdit)** → on ne le fait pas.
- **k−d reste la primitive du cross** (asset-agnostic) ; la **zone extrême K = contexte grossier**, pas un déclencheur de précision.

---

## RÉSULTAT #5 — Config K par actif OU par classe : NON justifié  ✅
**Question** : vu la disparité de la médiane K (47→61 selon l'actif), faut-il un config K par actif / par classe ?
**Scripts** : `test_k_perasset_stability.mjs` (2 moitiés chrono), `test_k_byclass.mjs`.

**Test décisif** : la disparité est-elle une **signature stable** (→ config justifié) ou l'empreinte du **régime** de la période (→ config = overfit) ? On coupe les 6 mois en 2 moitiés et on compare.

**Par ACTIF** :
- Drift temporel intra-actif de la médiane K : **|Δ| moyen 3,3, max 7,4**. Spread inter-actifs : std 1,9. **Ratio drift/spread = 1,69**.
- → la médiane K d'un actif **bouge plus dans le temps qu'elle ne diffère d'un actif à l'autre**.
- Cas parlants : GOLD 55,7→48,4 (−7,3), SILVER 56,4→49,0 (−7,4), USDJPY 54,1→59,9 (+5,8). Les métaux « à médiane haute » n'étaient hauts que pendant leur rally janv-avril.

**Par CLASSE** (FX/INDEX/CRYPTO/METAL/ENERGY/AGRI) :
- Spread INTER-classes : médianes **49,7→53,2, std 1,4** → les classes sont **quasi interchangeables** sur K.
- Drift temporel par classe : moyen 3,1, **max 7,3** (METAL −7,3, ENERGY −4,8) → **écrase** le spread inter-classes (ratio ~2,2).
- Dispersion INTRA-classe faible (std 0,8) MAIS ≈ dispersion inter-classes → pas de vrai signal de classe. Tout le monde vit à ~52 / P90~85.
- Dans une même classe, comportements opposés (FX : USDJPY 57 vs EURUSD 49) → la disparité n'est **pas** structurée par classe.

**→ Conclusions** :
1. **Config K statique par actif = overfit régime** (drift > spread). Encoderait « Gold vit à 56 » — vrai 3 mois, faux ensuite.
2. **Config K par classe = pire encore** : classes quasi identiques (peu à gagner) mais dérivent quand même (tout le risque). L'analyse **valide** la règle « aucune logique par actif/classe ».
3. La disparité K est **idiosyncratique (actif) + temporelle (régime)**, jamais structurelle → **rester universel**.
4. Bon design : **k−d = cœur** (régime-neutre, annule le biais de niveau) + zone extrême K **universelle** (85/17). Si absorber le régime : **percentile K glissant/adaptatif** (règle universelle, pas table figée) — jamais un config statique.

---

## RÉSULTAT #6 — Vitesse intraday sur le cross d'exhaustion  ✅ (plat)
**Question** : la tension/vitesse intraday (`intraday_change`) sépare-t-elle les fades gagnants des perdants ?
**Script** : `test_exh_intraday_velocity.mjs`. **Normalisation** : z-score par actif (`intraday_change / std_actif`), tension **dans le sens qu'on fade** (sell-exh +ic ; buy-exh −ic). Métrique = fade forward ATR, horizon 4.

**Résultat — quasi plat, pas de séparation monotone** :
| bucket | M15 | H1 | H4 |
|---|---|---|---|
| z≤0 | −0,030·48% | −0,058·49% | +0,095·54% |
| z 0-1 | −0,003·51% | −0,002·49% | −0,046·46% |
| z 1-2 | −0,035·49% | −0,099·52% | −0,130·48% |
| **z≥2 (très étiré)** | −0,042·**52,5%** | +0,123·**55,2%** | +0,080·**60%** |

**Seul indice (faible)** : le bucket le plus étiré (z≥2) a un **hit-rate plus haut partout** (52-60%) → les jours très tendus reversent un peu plus **souvent**. MAIS le **mean reste incohérent** (M15 z≥2 négatif malgré 52,5% hits) → *petit gain fréquent, grosse perte occasionnelle* (journée-tendance qui continue), net ≈ nul. n modeste dans l'extrême.

**→** Vitesse intraday = 3e dimension plate (après contact-def et ADX/DI). Confirme : **pas de contexte 1-D qui débloque le cross nu à horizon 4.**

---

## RÉSULTAT #7 — Distribution ADX(14) / seuils manuel non-sélectifs  ✅
**Question** : où se situe ADX, et les seuils usuels 20/25/40 sont-ils sélectifs ?
**Script** : `adx_distribution.mjs` → `adx_distribution.xls`.

**Distribution (agrégat, TF-invariant)** : P10~18 · P25~22 · **P50~28** · P75~37 · P90~47 · P95~54.

**Constats** :
1. **ADX tourne CHAUD** (médiane ~28, pas 20-25). Seuils manuel **non-sélectifs** : `≥20` = **81 %** des barres (filtre inutile), `≥25` = **61 %**, `≥40` = **19 %** (le vrai « trend fort », top 1/5).
2. **ADX asset-agnostic** (médiane std 0,6 M15 / 1,2 H1) — bien plus universel que K brut (std 3,1) → **seuil ADX universel légitime**.
3. **TF-invariant** (28 partout).

**→** Pour utiliser ADX comme contexte, bucketer par **percentile réel** (`<28 · 28-37 · 37-47 · 47+`), pas par les 20/25 du manuel.

---

## RÉSULTAT #8 — ADX/DI sur le cross d'exhaustion : NE débloque PAS  ✅ (négatif confirmé ×2)
**Question** : fader AVEC vs CONTRE le DI dominant, modulé par ADX, sépare-t-il gagnants/perdants ?
**Script** : `test_exh_adx_di_buckets.mjs`. Direction : sell-exh AVEC si `mdi>pdi` (downtrend) ; buy-exh AVEC si `pdi>mdi`. Métrique = fade forward ATR, horizon 4, min-pas 3.

**Fait structurel** : les fades d'exhaustion sont **massivement CONTRE le DI dominant** (M15 : 11810 CONTRE vs 2323 AVEC) — mécanique : %K≥80 s'atteint après une montée → pdi dominant → fade bas = contre. L'exhaustion **est** contre-tendance par nature.

**Résultat — plat, testé 2× (buckets manuel 20/25/40 PUIS recalibrés 28/37/47)** :
- AVEC & CONTRE ≈ pile/face partout (mean ±0,05, hit ~50%). Aucun bucket bien peuplé avec edge.
- Positifs uniquement en **tiny-n** (H4 ADX≥47 n=7 +1,55 ; H1 n=15) = **bruit**.
- Seul signal lisible & cohérent : **fade AVEC le DI en trend fort (ADX≥37) = perdant** M15/H1 (−0,18 à −0,20) → « ne pas fader dans le sens d'un trend fort ». Gate négatif faible, pas un edge.

**→ CONCLUSION** : la piste ADX/DI de l'owner, **testée 2×**, ne débloque pas le cross d'exhaustion sur 6 mois. Dimension plate comme les autres. (Réserve commune : horizon figé 4 barres, close-to-close — cf reco horizon/MFE-MAE.)

**MÉTA (Résultats #3/#6/#8)** : contact-def, vitesse intraday, ADX/DI → **3 dimensions 1-D plates**. Soupçon fort : l'edge est masqué par la **métrique** (net-4-barres lave un retournement rapide ; l'engine sort sur contact M5, pas à 4 barres fixes). **Prochain test décisif = sweep horizon (1/2/3/4/6/8) + MFE/MAE.**

---

## HYPOTHÈSE EN ATTENTE DE PREUVE — gate CONT sur k−d extrême  🟡
**Idée (owner)** : si à un instant **k−d au-delà d'un percentile extrême EN SENS** (long : k−d > P95/P80 ; short : k−d < P5/P20) → **stop CONT** (ne pas entrer en continuation).

**Fondé mécaniquement** : entrer CONT à k−d extrême = miser sur une vitesse qui est **sur le point de décélérer** (le gap se referme). Pire timing d'entrée.

**⚠ Le piège à trancher** : « k−d se referme » **≠** « le prix se retourne ». K peut retomber vers D pendant que le **prix continue**. Donc k−d extrême prédit avec certitude le rétrécissement du gap, **PAS** la perte de la position CONT.

**Test décisif (à faire)** : **rendement forward moyen conditionné à « k−d > P95/P80 en sens »**, en ATR (engine-independent), sur horizons 2/4/8/12 barres. Si négatif ou nul → gate prouvé. Sinon → c'est juste de la peur.

**Notes** :
- Gate **directionnel** (P95 long ↔ P5 short) → d'où le besoin des percentiles + miroir.
- Signal de **vitesse du cross** (magnitude du gap), **distinct** des gates zone %K existants (position dans l'extrême) → complémentaire, pas redondant.

---

## TODO / prochaines analyses
- [ ] Forward-return conditionné k−d extrême (test de l'hypothèse ci-dessus) — ATR, horizons multiples.
- [ ] Distribution de **|k−d| au moment des cross K/D** (contact réel à l'exhaustion) vs distribution globale.
- [ ] Distribution **profondeur stoch %K** aux extrêmes (position) — croiser avec k−d (vitesse).
- [ ] Piste **ADX/DI** (owner) : fade AVEC vs CONTRE le DI dominant, bucketé par ADX(14).
- [ ] 3 choix de design à trancher (owner) : TF détection · horizon forward · métrique de succès.
