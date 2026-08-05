# Audit — l'UI backtest peut-elle diagnostiquer le scoring ? — 05/08/2026

> **Rapport seul, aucun code modifié.** Objet : ce qu'il manque à l'UI backtest pour diagnostiquer
> le scoring, maintenant que le moteur tourne en trois rangs. Contexte : le rang ① EXHAUSTE rend
> **R = −0,8 sur 1 021 épisodes pour un maxDD de 28,1** — et l'UI, en l'état, **ne permet pas de
> savoir pourquoi**.

## Verdict en une ligne

L'UI affiche bien le score, mais **elle ne sait pas encore qu'il y a trois rangs**. Trois défauts la
rendent activement trompeuse sur le rang ② et sur le fade, et six champs déjà produits ne sont
affichés nulle part.

---

## 1. 🔴 TROIS DÉFAUTS QUI FONT MENTIR L'AFFICHAGE

Ce ne sont pas des manques : ce sont des écrans qui montrent une valeur fausse sans le dire.

### 1.1 Le détail par expert du FADE est cassé — tout apparaît « muet »

`matrixBacktest.mjs:589` et `:687` aplatissent `g.exhExperts` comme une map plate `{id → {global}}` :

```js
for (const [id, e] of Object.entries(g.exhExperts ?? {})) exp[id] = e?.global ?? null;
```

Or depuis la refonte, `exhExperts` porte `exh.expertsBySide`, c'est-à-dire **`{BUY:{…}, SELL:{…}}`**.
**Vérifié à l'exécution** :

```
cles de g.exhExperts : ["BUY","SELL"]
ce que l'UI en fait  : { "BUY": null, "SELL": null }
```

⇒ Le panneau « Par expert » du fade affiche **deux lignes nommées BUY et SELL, toutes deux `muet`**.
Les six experts réels (`k · di · zscore · kd · rsi · slope`) ne sont **jamais** visibles.
⚠ **C'est exactement l'écran qu'il faudrait pour répondre à « pourquoi l'EXH rend zéro », et c'est
le seul qui soit hors service.**

### 1.2 Le rang ② PULLBACK affiche les experts de la CONTINUATION

`matrixBacktest.mjs:686` :

```js
const src = sel.strategy === "EXH" ? g.exhExperts : g.contExperts;
```

Le ternaire ne connaît que deux rangs. `strategy === "PB"` tombe dans le `else` et reçoit
`contExperts` — alors que **le pullback est scoré par les experts du FADE** (`sExhBySide[+regDir]`,
le même barème lu sur l'autre côté). Le panneau montre donc des chiffres qui n'ont **aucun lien**
avec la décision affichée.
⭐ Même motif que les deux bugs corrigés en phase C (`STRAT[...]`, `min: ... ? ... : ...`) : **un
ternaire ne peut pas avoir trois issues, et il n'échoue pas quand on lui en demande une troisième —
il en rend une fausse.** C'est la troisième occurrence, dans le même fichier.

### 1.3 Le bloc « fade écarté » est du code mort

`SignalsPage.jsx:408` affiche `t.exhRef` avec son `kind`. Mais `exhRef` vient de
`sel.exhRefused` (`matrixBacktest.mjs:661`), et **`exhRefused` n'existe plus** dans la sortie de
`decideFromScoring` — vérifié : `'exhRefused' in selection → false`.
⇒ Le bloc ne s'affiche jamais. Ironie : c'était le seul endroit de l'UI qui montrait un `kind`.

---

## 2. 🟠 SIX CHAMPS PRODUITS ET JAMAIS AFFICHÉS

Câblés dans le simulateur en phase C, consommés par **zéro** composant. C'est un défaut de mon
propre travail : je les ai plombés jusqu'au simulateur et je me suis arrêté là.

| champ | ce qu'il répond | état |
|---|---|---|
| `rank` | quel rang a produit le verdict | émis, **non affiché** |
| `ranks` | quels rangs ont été TRAVERSÉS | émis, **non affiché** |
| `regDir` | le sens du régime — **qui fixe le côté des 3 rangs** | émis, **non affiché** |
| `pbConviction` | ce que valait le pullback quand il n'a pas tiré | émis, **non affiché** |
| `pbYieldedBy` | le rang ② a-t-il cédé par VETO ou par SCORE | émis, **non affiché** |
| `exhYieldedBy` | idem rang ① | émis, **non affiché** |

⭐ **`ranks` est le plus important des six**, et c'est celui dont l'absence coûte le plus cher : il
distingue « rang **jamais atteint** » de « rang atteint et **refusé** ». Sans lui, un rang inerte est
indiscernable d'un rang sévère — le motif que ce dépôt a payé cinq fois.

⭐⭐ **`exhYieldedBy` / `pbYieldedBy` sont la clé du diagnostic en cours.** « Le rang ① rend zéro »
a deux causes possibles, et ces champs les séparent : cède-t-il par **score** (le barème ne voit rien)
ou par **veto** (les portes le retirent) ? La réponse oriente vers deux chantiers opposés.

---

## 3. 🟡 CE QUI N'EST PRODUIT NULLE PART — et qu'il faudrait

### 3.1 Le `kind` de chaque veto touché

`SignalsPage.jsx:410` affiche `${h.id}[${h.tf}]`. Depuis `c17cfa1`, **`kind` décide du routage** :
`timing` tue la barre, `structure` passe la main. On voit donc QUEL veto a mordu, mais pas s'il a
**tué ou routé** — c'est-à-dire la seule chose qui compte désormais.
⚠ Le champ EXISTE sur chaque hit (posé à la source dans `vetoGate`), il suffit de l'afficher.

### 3.2 `MIN_PRES` — la frontière DROP / repli du rang ①

`c.min` affiche le seuil du rang retenu. Mais le rang ① a **deux** seuils : `MIN_EXH` (tire) et
`MIN_PRES` (en dessous → repli, au-dessus → **DROP** « épuisement présent mais faible »). La bande
`[MIN_PRES · MIN_EXH[` est invisible, alors que c'est **une contrainte de risque assumée** (la rendre
à la continuation doublait le maxDD).

### 3.3 Le régime de silence en vigueur

Le score n'est pas interprétable sans savoir comment les muets ont été traités —
`SILENCE_COUNTS` / `SILENCE_PENALTY`, soit trois régimes possibles (**amplifie · dilue · pénalise**)
qui déplacent le volume de 100 % à 36 %. Un score de 2,1 ne veut pas dire la même chose selon le
régime, et rien à l'écran ne dit lequel tourne.

### 3.4 La décomposition des issues PAR RANG

`MatrixBacktest.jsx:361` agrège par `x.type` — or `PB.type === "CONTINUATION"`, donc **le rang ② est
invisible dans tous les agrégats de la page**. Et pour la question du moment, il faut le **R par
issue** (TP / SL / TIMEOUT) **par rang** : c'est ce qui départage « `MIN_EXH` trop bas » de « le
couple TP/SL sabote un WR pourtant correct ». Le WR seul ne peut pas le dire.

### 3.5 Les DROP ne sont pas inspectables barre à barre

La table Signaux liste les **tirs**. Les refus n'existent que comme compteurs agrégés (`FIRE_*` /
`WAIT_*`). Or la population non biaisée pour juger un expert ou un veto, **c'est justement celle des
refus** — c'est la raison pour laquelle les deux scorers tournent toujours, et la raison pour
laquelle le pré-gate a été retiré (le score existe désormais sur les barres refusées).
⇒ **On produit maintenant cette information et on ne peut pas la regarder.**

---

## 4. ✅ CE QUI MARCHE ET N'EST PAS À TOUCHER

- **`ScoringTable.jsx`** — descripteur pur, aucun nombre en dur, lit `MIN_CONT` du moteur.
- Le triptyque **brut / bonus / total** avec les `bonusHits` : c'est ce qui permet de refaire la
  soustraction, et c'est correct.
- Les **12 observables** et le panneau « pourquoi il a tiré ».
- **Les couleurs et l'ordre des rangs** (phase C) : `pullback` en cyan, `MODE_ORDER` du moteur.
- Le **seuil appliqué** `c.min`, désormais correct sur les trois rangs.

---

## 5. Ordre de traitement proposé

| # | quoi | pourquoi d'abord |
|---|---|---|
| 1 | **§1.1** aplatissement `exhExperts` | l'écran qui répondrait à la question du moment est le seul en panne |
| 2 | **§1.2** ternaire à deux issues pour `exp` | affiche des chiffres sans lien avec la décision — pire qu'un vide |
| 3 | **§2** afficher `ranks` + `*YieldedBy` | sépare « cède par score » de « cède par veto » : c'est le diagnostic |
| 4 | **§3.4** issues par RANG (et non par `type`) | le rang ② est invisible dans tous les agrégats |
| 5 | **§3.1** `kind` sur chaque veto | on voit quel veto mord, pas s'il tue ou route |
| 6 | **§1.3** retirer le bloc `exhRef` mort | un affichage qui ne s'affiche jamais est un commentaire |
| 7 | **§3.5** rendre les DROP inspectables | le plus gros lift, et le plus rentable à terme |
| 8 | **§3.2 / §3.3** `MIN_PRES` et régime de silence | deux lignes, contexte de lecture |

⭐ **Les points 1 et 2 sont des RÉGRESSIONS de la refonte**, pas des manques d'origine : les deux
écrans marchaient quand le moteur avait deux thèses et un `exhExperts` plat. Ils sont devenus faux
sans qu'aucune erreur ne soit levée — troisième et quatrième occurrence du même motif dans ce
fichier, après `STRAT[...]` et le ternaire des seuils corrigés en phase C.
⇒ 🎯 **La vraie leçon n'est pas « corriger ces deux-là » mais « ce fichier convertit toute évolution
du moteur en affichage faux et silencieux ».** Un invariant de démarrage — les clés de `exp`
appartiennent-elles à `SCORING_WEIGHT[thèse]` ? — attraperait les quatre d'un coup, et les suivants.
