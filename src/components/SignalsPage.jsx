import { useState, useMemo } from "react";
import { T, Panel, Chip, pos, empty } from "./ui.jsx";

// SignalsPage — page « Signaux » : un trade = une ligne, avec la PHOTO des indicateurs au moment du tir
//   (cf fireSnapshot dans matrixBacktest.mjs). Objectif : répondre à « à quel ADX / RSI / theta ce trade
//   a-t-il tiré ? » sans rejouer la barre à la main.
//
// Lecture seule et 100 % frontend : elle consomme le run déjà chargé par MatrixBacktest (pas de re-run).

// ── Colonnes. group = bloc repliable ; fmt = rendu ; col = teinte optionnelle (v) => couleur.
const signed = (d = 1) => (v) => (v > 0 ? "+" : "") + v.toFixed(d);
/** Les trois boites, dans l'ordre de priorite du moteur. ⚠ Le rang est dans l'etiquette : sans lui,
 *  « PB » et « CONT » se lisent comme deux familles paralleles alors que l'une est le repli de l'autre. */
const BOITE   = { EXH: "① EXH", PB: "② PB", CONT: "③ CONT" };
const BOITE_C = { EXH: T.amber, PB: T.cyan, CONT: T.blue };
const COLS = [
  { k: "tsMT", lbl: "Timestamp", g: "Trade", w: 132, mono: true, fmt: (v) => v },
  { k: "side", lbl: "Side", g: "Trade", fmt: (v) => v, col: (v) => (v === "BUY" ? T.green : T.red), bold: true },
  // 🔴🔥⭐⭐⭐ LA BOITE SE LIT SUR `strategy`, JAMAIS SUR `type` (2026-08-10). `type` repond a
  //   « QUEL COUPLE TP/SL ? » et `MODES.PB.type === "CONTINUATION"` est une DECISION owner du 05/08
  //   (le pullback herite du TP/SL de la continuation). Affiche tel quel, il etiquetait tous les
  //   tirs PB « CONTINUATION » — et surtout le FILTRE groupait PB et CONT dans le MEME seau, donc
  //   les deux boites etaient INSEPARABLES dans le panneau.
  // ⭐⭐⭐ Le motif : un champ qui repond a une question etait affiche comme s'il repondait a une
  //   autre. Il n'etait pas FAUX — il etait juste lu pour ce qu'il n'est pas, et rien ne pouvait
  //   lever puisque la valeur est legitime.
  { k: "strategy", lbl: "Boîte", g: "Trade", w: 62, fmt: (v) => BOITE[v] ?? v ?? "—", col: (v) => BOITE_C[v] ?? T.ink3, bold: true },
  // ⚠ AFFICHE « ← CONT », PAS « CONTINUATION » : le mot seul se relit comme une CLASSIFICATION, et
  //   un tir PB y ressemblait a un tir CONT meme sous l'en-tete « TP/SL ». La fleche dit HERITAGE.
  { k: "type", lbl: "TP/SL", g: "Trade", w: 62, fmt: (v) => (v ? "← " + String(v).slice(0, 4) : "—"), col: () => T.ink3 },
  { k: "profile", lbl: "Profil", g: "Trade", w: 96, fmt: (v) => v },
  { k: "outcome", lbl: "Out", g: "Trade", fmt: (v) => v, col: (v) => (v === "WIN" ? T.green : T.red), bold: true },
  { k: "reason", lbl: "Exit", g: "Trade", fmt: (v) => v, col: (v) => (v === "TP" ? T.green : v === "SL" ? T.red : T.amber) },
  { k: "R", lbl: "R", g: "Trade", fmt: (v) => v.toFixed(2), col: pos, bold: true },

  { k: "confidence", lbl: "Conf", g: "Décision", fmt: (v) => v.toFixed(2) },
  { k: "gap", lbl: "Gap", g: "Décision", fmt: (v) => v.toFixed(2) },
  { k: "score", lbl: "Score", g: "Décision", fmt: (v) => v.toFixed(0) },
  { k: "override", lbl: "Override", g: "Décision", w: 120, fmt: (v) => v, col: () => T.amber },

  // ⭐ VÉRITÉ MOTEUR — c'est CETTE colonne qui explique un tir EXH, pas « Régime ADX » (bande morte
  //   différente, cf. plus bas). `dominance` (le NIVEAU) est EXCLU du score exh à dessein : l'ADX est
  //   très lent, son niveau décrit un état INSTALLÉ quand l'exhaustion est un ÉVÉNEMENT H1 local.
  //
  // ⚠️ COULEUR = LECTURE **EXH**, et elle a été CORRIGÉE le 2026-07-20 (elle mentait avant) :
  //   · FALLING (érosion INSTALLÉE)  → vert : TRES_ATTENDU, c'est le cas nominal du fade.
  //   · TURN_DOWN (inflexion FRAÎCHE) → grisé : RÉTROGRADÉ à NEUTRE, MESURÉ 7× moins rentable
  //     (avgR +0,008 vs +0,059 sur 573 trades) ⇒ il ne franchit plus le seuil de tir.
  //     L'ancienne version le peignait en VERT et le décrivait comme « une PORTE de l'exhaustion » —
  //     porte posée puis retirée le même jour. Une couleur périmée est un faux verdict silencieux.
  //   · RISING / TURN_UP → rouge : INCOMPATIBLE… mais INATTEIGNABLES après le gate (Δ₁ ≤ −1,8 et
  //     bande morte 1,0 ⇒ Δ₁ < 0 toujours). S'ils apparaissent sur une ligne EXH, c'est un BUG.
  //   ⚠️ EN CONT la lecture est INVERSE (mesuré : RISING et TURN_DOWN y sont les meilleurs, avgR
  //     +0,125 contre +0,053 pour FLAT). Ne pas lire ces couleurs sur une ligne CONT.
  { k: "dominance", lbl: "Dominance", g: "ADX", w: 96, fmt: (v) => v,
    col: (v) => (v === "EXTREME" ? T.red : v === "HIGH" ? T.green : v === "LOW" ? T.ink3 : T.ink2), bold: true },
  { k: "dominanceTurn", lbl: "Turn (moteur)", g: "ADX", w: 112, fmt: (v) => v,
    col: (v) => (v === "FALLING" ? T.green : (v === "RISING" || v === "TURN_UP") ? T.red : T.ink3), bold: true },
  { k: "adx", lbl: "ADX H1", g: "ADX", fmt: (v) => v.toFixed(1) },
  { k: "dAdx", lbl: "Δ₁ H1", g: "ADX", fmt: signed(1), col: pos },
  { k: "dAdx2", lbl: "Δ₂ H1", g: "ADX", fmt: signed(1), col: pos },
  { k: "adxAccel", lbl: "Δ₁−Δ₂", g: "ADX", fmt: signed(1), col: pos },
  // Régime = signe(Δ₁) vs signe(Δ₂) : même signe ⇒ force INSTALLÉE, signes opposés ⇒ INFLEXION fraîche.
  // ⚠️ DIAGNOSTIC BACKTEST, PAS LE VERDICT MOTEUR : bande morte 1,8 ici contre 1,0 dans le moteur
  //   (1,8 a été rejeté par le calibrage du 18/07 — « à 1,8 le signal est étouffé »). Les deux colonnes
  //   PEUVENT DONC SE CONTREDIRE sur la même ligne. Pour expliquer une décision → « Turn (moteur) ».
  //   ⚠️ Couleur laissée NEUTRE à dessein : cette colonne est un DIAGNOSTIC, pas un verdict — lui
  //   donner un vert/rouge lui prêterait l'autorité de « Turn (moteur) » juste à côté.
  { k: "adxRegime", lbl: "Régime ADX (diag 1,8)", g: "ADX", w: 128, fmt: (v) => v,
    col: () => T.ink2, bold: false },
  { k: "adxM15", lbl: "ADX M15", g: "ADX", fmt: (v) => v.toFixed(1) },
  { k: "dAdxM15", lbl: "ΔADX M15", g: "ADX", fmt: signed(1), col: pos },
  { k: "plusDi", lbl: "+DI", g: "DI", fmt: (v) => v.toFixed(1), col: () => T.green },
  { k: "dPlusDi", lbl: "Δ₁ +DI", g: "DI", fmt: signed(1), col: pos },
  { k: "dPlusDi2", lbl: "Δ₂ +DI", g: "DI", fmt: signed(1), col: pos },
  { k: "minusDi", lbl: "−DI", g: "DI", fmt: (v) => v.toFixed(1), col: () => T.red },
  { k: "dMinusDi", lbl: "Δ₁ −DI", g: "DI", fmt: signed(1), col: pos },
  { k: "dMinusDi2", lbl: "Δ₂ −DI", g: "DI", fmt: signed(1), col: pos },
  { k: "diDelta", lbl: "Spread", g: "DI", fmt: signed(1), col: pos },
  { k: "dSpread", lbl: "Δ₁ spread", g: "DI", fmt: signed(1), col: pos },
  { k: "dSpread2", lbl: "Δ₂ spread", g: "DI", fmt: signed(1), col: pos },
  // ⭐ La colonne qui porte le signal : le spread DI a un SENS → lu RELATIVEMENT au côté du trade.
  //   TURN_WITH = la pression directionnelle vient de basculer EN SENS (meilleure cohorte, toutes bandes).
  { k: "spreadRegimeRel", lbl: "DI vs trade", g: "DI", w: 116, fmt: (v) => v,
    col: (v) => (v === "TURN_WITH" ? T.green : v === "TURN_AGAINST" ? T.red : v === "FLAT" ? T.ink3 : T.ink2), bold: true },
  { k: "spreadRegime", lbl: "Régime spread", g: "DI", w: 112, fmt: (v) => v, col: () => T.ink3 },

  // ⭐⭐ LE JOUR N'EST PLUS DÉCRIT QU'UNE FOIS (Matrix `5f8fb9f`, 2026-07-20) :
  //   · la FORCE (`dailyForce`/`dailyDirection`) vient de `intraday_change` → bande IntradayConfig.
  //     C'est ELLE qui score en couche 2 et qui a DROIT DE VETO.
  //   · `θ jour` est sorti du CONTRAT (13 → 12 observables) : il ne SCORE plus et ne FILTRE plus
  //     (les 2 gates cont-vs-daily-angle / cont-needs-angle sont supprimés). DIAGNOSTIC PUR.
  //   ⚠️ L'incohérence signalée ici le 20/07 au matin est FERMÉE — mais θ et la force PEUVENT
  //   toujours diverger visuellement (ic faible + theta VERTICAL = matin : peu de distance,
  //   parcourue vite). C'était le cas sur 32,8 % des signaux. Ce n'est plus une contradiction de
  //   DÉCISION, juste deux lectures différentes du même jour — une seule décide.
  //   Ordre des colonnes : la CAUSE avant l'EFFET.
  { k: "intradayChange", lbl: "Intraday %", g: "Trend", fmt: signed(2), col: pos },
  { k: "forceRegime", lbl: "Régime ic (→ Force)", g: "Trend", w: 132, fmt: (v) => v, col: () => T.ink2, bold: true },
  { k: "forceScore", lbl: "Force", g: "Trend", fmt: (v) => v.toFixed(0), bold: true },
  { k: "thetaDayDeg", lbl: "θ jour (diagnostic)", g: "Trend", w: 122, fmt: signed(1), col: () => T.ink3 },
  { k: "dTheta", lbl: "Δθ", g: "Trend", fmt: signed(1), col: pos },
  { k: "thetaRotation", lbl: "Rotation", g: "Trend", w: 88, fmt: (v) => v },
  { k: "angleTheta", lbl: "Angle D1", g: "Trend", fmt: signed(1), col: pos },
  { k: "slopeD1", lbl: "Slope D1", g: "Trend", fmt: signed(2), col: pos },

  { k: "rsiH1", lbl: "RSI H1", g: "RSI", fmt: (v) => v.toFixed(1), col: (v) => (v >= 70 ? T.red : v <= 30 ? T.green : T.ink2) },
  { k: "rsiH4", lbl: "RSI H4", g: "RSI", fmt: (v) => v.toFixed(1), col: (v) => (v >= 70 ? T.red : v <= 30 ? T.green : T.ink2) },
  { k: "rsiM15", lbl: "RSI M15", g: "RSI", fmt: (v) => v.toFixed(1), col: (v) => (v >= 70 ? T.red : v <= 30 ? T.green : T.ink2) },
  { k: "rsiD1", lbl: "RSI D1", g: "RSI", fmt: (v) => v.toFixed(1) },
  { k: "dRsiH1", lbl: "ΔRSI H1", g: "RSI", fmt: signed(1), col: pos },
  // ⭐ H4 COMPLÉTÉ (2026-08-05) — `rsiH4S0`, `drsiH4` et `drsiH4S0` étaient PRODUITS par
  //   `fireSnapshot` et affichés NULLE PART. Le RSI est un expert h1+h4 : n'en montrer la dynamique
  //   que sur H1 laissait la moitié de sa lecture hors de l'écran.
  { k: "rsiH4S0", lbl: "RSI H4 s0", g: "RSI", fmt: (v) => v.toFixed(1) },
  { k: "drsiH4", lbl: "ΔRSI H4", g: "RSI", fmt: signed(2), col: pos },
  { k: "drsiH4S0", lbl: "ΔRSI H4 s0", g: "RSI", fmt: signed(2), col: pos },

  { k: "kH1", lbl: "%K H1", g: "Stoch", fmt: (v) => v.toFixed(1) },
  { k: "dH1", lbl: "%D H1", g: "Stoch", fmt: (v) => v.toFixed(1) },
  { k: "kdH1", lbl: "K−D H1", g: "Stoch", fmt: signed(1), col: pos },
  { k: "zoneH1", lbl: "Zone H1", g: "Stoch", w: 92, fmt: (v) => v },
  { k: "crossFreshH1", lbl: "Cross H1", g: "Stoch", fmt: (v) => (v ? "✓" : "·"), col: (v) => (v ? T.blue : T.ink3), bold: true },
  // ── GAP / DIV K/D H1 (expert Dynamique, spec 2026-07-21) — PHOTO PASSIVE, ne décide rien.
  //   crossState/Age/Mat pilotent l'arbre EXH ; gap/div (|k−d| et sa dérivée) sont en réserve/étude.
  //   ⭐ `div0<0` = convergence des lignes (couleur BLEU) · `div0>0` = divergence (grisé).
  { k: "crossState", lbl: "Cross", g: "GapDiv", w: 96, fmt: (v) => v ?? "—",
    col: (v) => (v === "CROSS_UP" ? T.green : v === "CROSS_DOWN" ? T.red : T.ink3), bold: true },
  { k: "crossAge", lbl: "Age", g: "GapDiv", w: 56, fmt: (v) => (v == null ? "—" : String(v)),
    col: (v) => (v === 1 ? T.red : v === 0 ? T.green : T.ink2), bold: true },
  { k: "crossMat", lbl: "Maturité", g: "GapDiv", w: 108, fmt: (v) => v ?? "—", col: () => T.ink2 },
  { k: "gap0", lbl: "gap0", g: "GapDiv", fmt: (v) => (v == null ? "—" : v.toFixed(1)) },
  { k: "div0", lbl: "div0", g: "GapDiv", fmt: signed(1), col: (v) => (v == null ? T.ink3 : v < 0 ? T.blue : T.ink3), bold: true },
  { k: "div1", lbl: "div1", g: "GapDiv", fmt: signed(1), col: (v) => (v == null ? T.ink3 : v < 0 ? T.blue : T.ink3) },
  { k: "kM15", lbl: "%K M15", g: "Stoch", fmt: (v) => v.toFixed(1), col: (v) => (v < 15 ? T.green : v > 85 ? T.red : T.ink2) },
  // Séquence K−D M15 (s0→s2) + resserrement = ce que lit le gate cont-kd-pinch (owner 2026-07-24).
  { k: "kdM15", lbl: "K−D M15 s0", g: "Stoch", fmt: signed(1), col: pos },
  { k: "m15Kd1", lbl: "K−D M15 s1", g: "Stoch", fmt: signed(1), col: pos },
  { k: "m15Kd2", lbl: "K−D M15 s2", g: "Stoch", fmt: signed(1), col: pos },
  { k: "m15Pinch", lbl: "Pincement M15", g: "Stoch", w: 108, fmt: (v) => (v ? "✓ resserre" : "·"), col: (v) => (v ? T.amber : T.ink3), bold: true },
  { k: "separation", lbl: "Sépar.", g: "Stoch", fmt: (v) => v.toFixed(1) },
  // ⭐⭐ H4 ET D1 REMIS (2026-08-05) — LE STOCHASTIQUE N'ÉTAIT VISIBLE QU'EN H1 ET M15 alors que
  //   `fireSnapshot` produit les quatre TF depuis toujours. Or c'est le H4 que lisent l'admission,
  //   `kdExhScore` (H1 pur mais calibré CONTRE lui) et les deux vetos `h4-*` — dont
  //   `h4-leg-still-pushing`, écrit ce matin sur `zoneH4` × `kdCycleH4` × `dKBandH4`. On jugeait
  //   donc une règle H4 sans jamais voir ses trois entrées.
  { k: "kH4", lbl: "%K H4", g: "Stoch", fmt: (v) => v.toFixed(1), col: (v) => (v < 15 ? T.green : v > 85 ? T.red : T.ink2) },
  { k: "dH4", lbl: "%D H4", g: "Stoch", fmt: (v) => v.toFixed(1) },
  { k: "kdH4", lbl: "K−D H4", g: "Stoch", fmt: signed(1), col: pos },
  { k: "zoneH4", lbl: "Zone H4", g: "Stoch", w: 92, fmt: (v) => v },
  { k: "kdCycleH4", lbl: "Cycle K/D H4", g: "Stoch", w: 104, fmt: (v) => v },
  { k: "dKBandH4", lbl: "ΔK H4", g: "Stoch", w: 104, fmt: (v) => v },
  { k: "dM15", lbl: "%D M15", g: "Stoch", fmt: (v) => v.toFixed(1) },
  { k: "m15KD", lbl: "K−D M15 (cross)", g: "Stoch", fmt: signed(2), col: pos },
  { k: "m15CrossAge", lbl: "Age cross M15", g: "Stoch", w: 96, fmt: (v) => String(v) },
  { k: "zoneD1", lbl: "Zone D1", g: "Stoch", w: 92, fmt: (v) => v },
  { k: "dKBandD1", lbl: "ΔK D1", g: "Stoch", w: 104, fmt: (v) => v },

  { k: "bbwH1", lbl: "BBW H1", g: "Energy", fmt: (v) => v.toFixed(1) },
  { k: "bbwM15", lbl: "BBW M15", g: "Energy", fmt: (v) => v.toFixed(1) },
  { k: "bbwDynH1", lbl: "BBW dyn", g: "Energy", w: 92, fmt: (v) => v },
  { k: "tick", lbl: "Tick", g: "Energy", fmt: (v) => v.toFixed(0) },
  // ⭐ LE ZSCORE SORT DE « Energy » ET PREND SON GROUPE (2026-08-05). Il y était logé faute de
  //   mieux, et surtout il n'y était visible QU'EN H1 — alors que `zscoreH1S0`, `zscoreH4`,
  //   `zscoreH4S0` et `zscoreD1S0` sont produits par `fireSnapshot`. C'est l'expert au plus fort
  //   poids du fade (0,20) et le plus souvent MUET (45 % des barres) : ne pas voir ses niveaux sur
  //   les autres TF, c'est ne pas pouvoir dire POURQUOI il se tait.
  // ⚠ NOMS EXPLICITES : la forme NUE est la CLÔTURE (c'est elle qui score), `s0` est le live.
  { k: "zscoreH1", lbl: "Z H1 clôt.", g: "Zscore", fmt: signed(2), col: pos },
  { k: "zscoreH1S0", lbl: "Z H1 s0", g: "Zscore", fmt: signed(2), col: pos },
  { k: "zscoreH4", lbl: "Z H4 clôt.", g: "Zscore", fmt: signed(2), col: pos },
  { k: "zscoreH4S0", lbl: "Z H4 s0", g: "Zscore", fmt: signed(2), col: pos },
  { k: "zscoreD1S0", lbl: "Z D1 s0", g: "Zscore", fmt: signed(2), col: pos },
  { k: "wrH1", lbl: "W%R H1", g: "Energy", fmt: (v) => v.toFixed(1) },
  { k: "maturityState", lbl: "Stage", g: "Energy", w: 104, fmt: (v) => v },
  { k: "maturityScore", lbl: "Mat.", g: "Energy", fmt: (v) => v.toFixed(0) },
];
const GROUPS = [...new Set(COLS.map((c) => c.g))];
// ⚠ `GROUPS` est DÉRIVÉ de `COLS` : un groupe neuf apparaît tout seul dans les filtres. Seule sa
//   TEINTE se déclare ici — et un groupe sans teinte retombe sur le bleu par défaut du `Chip`,
//   donc se confond avec « Décision » et « Stoch » sans que rien ne le signale.
const GROUP_COL = { Trade: T.ink2, Décision: T.blue, ADX: T.amber, DI: T.amber, Trend: T.green, RSI: T.red, Stoch: T.blue, Zscore: T.violet, Energy: T.ink2 };

// ── Stats : médiane + quartiles, WIN vs LOSS. C'est le vrai levier — « où vivent les perdants ».
const med = (a) => (a.length ? a[Math.floor(a.length / 2)] : null);
const quant = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null);

// ⭐ `onScore` (owner 2026-08-11) — le SIMPLE CLIC ouvre desormais la page Score du tir.
//   ⚠ Le tiroir de detail n'est PAS supprime : il passe sur le bouton `⋯` de la premiere colonne.
//     Retirer une fonction pour en brancher une autre serait une decision de perimetre qu'on n'a
//     pas prise — et un tiroir qu'on ne trouve plus se lit « il a disparu », pas « il a demenage ».
//   ⚠ Le DOUBLE-CLIC reste le saut vers Indicateurs (2026-07-29), inchange.
export default function SignalsPage({ res, asset, onPick, onScore }) {
  const [outcomeF, setOutcomeF] = useState(null);
  const [sideF, setSideF] = useState(null);
  const [typeF, setTypeF] = useState(null);
  const [profileF, setProfileF] = useState(null);
  const [groupsOn, setGroupsOn] = useState(() => new Set(["Trade", "ADX", "Trend", "RSI"]));
  const [sort, setSort] = useState({ k: "tsMT", dir: 1 });
  const [sel, setSel] = useState(null);      // trade ouvert dans le tiroir de détail
  const [statCol, setStatCol] = useState("adx");

  // ⭐⭐⭐ LA BASCULE TIRS ↔ REFUS (2026-08-05). La table ne montrait que les TIRS — or la population
  //   des REFUS est la seule non biaisée pour juger un expert ou un veto : au-dessus d'un seuil, les
  //   termes du score sont anti-corrélés (collider), donc un score élevé y signale un terme qui a
  //   COMPENSÉ, pas une meilleure barre. C'est pour produire cette population qu'on a retiré le
  //   pré-gate (le score existe désormais sur les barres refusées) — il manquait juste de quoi la
  //   regarder.
  // ⚠ Les DROP portent `plannedSide` et non `side` : un refus n'a pas de côté TRADÉ, il a un côté
  //   ENVISAGÉ. On le normalise ici pour que les filtres et le tri fonctionnent, sans jamais laisser
  //   croire qu'une position a existé — `outcome` et `R` restent vides.
  const [showDrops, setShowDrops] = useState(false);
  const dropRows = useMemo(() => (res?.drops ?? []).map((d) => ({
    ...d, side: d.plannedSide ?? null, strategy: d.sc?.rank ?? null, type: null,
    outcome: null, R: null, reason: d.nature, isDrop: true,
  })), [res]);
  const all = showDrops
    ? dropRows
    : (res?.signals ?? []);   // ⭐ plus de masquage d'affichage : le VOILE (`?only=`) le fait au MOTEUR
  const profiles = useMemo(() => [...new Set(all.map((x) => x.profile).filter(Boolean))].sort(), [all]);
  const boites = useMemo(() => ["EXH", "PB", "CONT"].filter((b) => all.some((x) => x.strategy === b)), [all]);

  const rows = useMemo(() => {
    let r = all;
    if (outcomeF) r = r.filter((x) => (outcomeF === "WIN" || outcomeF === "LOSS") ? x.outcome === outcomeF : x.reason === outcomeF);
    if (sideF) r = r.filter((x) => x.side === sideF);
    if (typeF) r = r.filter((x) => x.strategy === typeF);
    if (profileF) r = r.filter((x) => x.profile === profileF);
    const { k, dir } = sort;
    return [...r].sort((a, b) => {
      const va = a[k], vb = b[k];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;              // les trous toujours en bas, quel que soit le sens
      if (vb == null) return -1;
      return (typeof va === "number" && typeof vb === "number") ? (va - vb) * dir : String(va).localeCompare(String(vb)) * dir;
    });
  }, [all, outcomeF, sideF, typeF, profileF, sort]);

  const cols = COLS.filter((c) => groupsOn.has(c.g));
  const toggleGroup = (g) => setGroupsOn((s) => { const n = new Set(s); n.has(g) ? n.delete(g) : n.add(g); return n; });
  const clickSort = (k) => setSort((s) => (s.k === k ? { k, dir: -s.dir } : { k, dir: 1 }));
  const clearAll = () => { setOutcomeF(null); setSideF(null); setTypeF(null); setProfileF(null); };
  const anyFilter = outcomeF || sideF || typeF || profileF;

  // Comparaison WIN vs LOSS sur la colonne choisie, DANS la sélection courante (hors filtre outcome, sinon
  //   une des deux moitiés serait vide par construction).
  const cmp = useMemo(() => {
    let base = all;
    if (sideF) base = base.filter((x) => x.side === sideF);
    if (typeF) base = base.filter((x) => x.strategy === typeF);
    if (profileF) base = base.filter((x) => x.profile === profileF);
    const grab = (o) => base.filter((x) => x.outcome === o).map((x) => x[statCol]).filter((v) => typeof v === "number").sort((a, b) => a - b);
    const w = grab("WIN"), l = grab("LOSS");
    return { w, l, col: COLS.find((c) => c.k === statCol) };
  }, [all, sideF, typeF, profileF, statCol]);
  const numCols = COLS.filter((c) => c.g !== "Trade" && all.some((x) => typeof x[c.k] === "number"));

  const totR = rows.reduce((a, x) => a + (x.R ?? 0), 0);
  const wins = rows.filter((x) => x.outcome === "WIN").length;

  if (!res) return <div style={empty}>Lance un backtest pour voir les signaux</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%", minHeight: 0 }}>
      {/* ── Barre de filtres ── */}
      <Panel flex="none" bodyStyle={{ overflow: "visible", padding: "10px 14px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", fontSize: 11 }}>
          {/* ⭐ TIRS ↔ REFUS. Le plafond d'échantillonnage est AFFICHÉ à côté du compte : un
              plafond silencieux se lit comme une couverture complète. */}
          <FilterRow label="Population">
            <Chip on={!showDrops} col={T.green} onClick={() => setShowDrops(false)}>tirs</Chip>
            <Chip on={showDrops} col={T.amber} onClick={() => setShowDrops(true)}>refus</Chip>
            {showDrops && (() => {
              const om = Object.values(res?.summary?.dropsOmitted ?? {}).reduce((a, b) => a + b, 0);
              return <span style={{ color: T.ink3, marginLeft: 6 }}>
                {dropRows.length} échantillonnés{om > 0 ? ` · ${om} écartés (plafond ${res?.summary?.dropCap} par motif)` : ""}
              </span>;
            })()}
          </FilterRow>
          <FilterRow label="Résultat">
            {[["Tous", null, T.blue], ["Win", "WIN", T.green], ["Loss", "LOSS", T.red], ["TP", "TP", T.green], ["SL", "SL", T.red], ["TO", "TIMEOUT", T.amber]]
              .map(([l, v, c]) => <Chip key={l} on={outcomeF === v} col={c} onClick={() => setOutcomeF(v)}>{l}</Chip>)}
          </FilterRow>
          <FilterRow label="Side">
            {[["Tous", null, T.blue], ["BUY", "BUY", T.green], ["SELL", "SELL", T.red]]
              .map(([l, v, c]) => <Chip key={l} on={sideF === v} col={c} onClick={() => setSideF(v)}>{l}</Chip>)}
          </FilterRow>
          <FilterRow label="Boîte">
            <Chip on={!typeF} onClick={() => setTypeF(null)}>Toutes</Chip>
            {boites.map((t) => <Chip key={t} on={typeF === t} onClick={() => setTypeF(t)}>{BOITE[t]}</Chip>)}
          </FilterRow>
          <FilterRow label="Profil">
            <Chip on={!profileF} onClick={() => setProfileF(null)}>Tous</Chip>
            {profiles.map((p) => <Chip key={p} on={profileF === p} onClick={() => setProfileF(p)}>{p}</Chip>)}
          </FilterRow>
          {anyFilter && <Chip col={T.amber} on onClick={clearAll}>effacer ✕</Chip>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 9, paddingTop: 9, borderTop: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: T.ink3, fontWeight: 600 }}>Colonnes</span>
          {GROUPS.map((g) => <Chip key={g} on={groupsOn.has(g)} col={GROUP_COL[g]} onClick={() => toggleGroup(g)}>{g}</Chip>)}
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.ink2 }}>
            <b style={{ color: T.ink }}>{rows.length}</b> / {all.length} trades · WR{" "}
            <b style={{ color: rows.length && 100 * wins / rows.length >= 75 ? T.green : T.red }}>
              {rows.length ? (100 * wins / rows.length).toFixed(1) : "—"}%
            </b>{" "}
            · total R <b style={{ color: pos(totR) }}>{totR.toFixed(1)}</b>
            {" "}· avg R <b style={{ color: pos(totR) }}>{rows.length ? (totR / rows.length).toFixed(3) : "—"}</b>
          </span>
        </div>
      </Panel>

      {/* ── Comparaison WIN vs LOSS ── */}
      <Panel title={`Où vivent les perdants · ${asset ?? ""}`} flex="none"
        extra={<select value={statCol} onChange={(e) => setStatCol(e.target.value)}
          style={{ background: T.bg, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 11 }}>
          {numCols.map((c) => <option key={c.k} value={c.k}>{c.g} · {c.lbl}</option>)}
        </select>}
        bodyStyle={{ padding: "10px 14px" }}>
        <Compare cmp={cmp} />
      </Panel>

      {/* ── Table ── */}
      <Panel title="Signaux" flex="1 1 0" bodyStyle={{ overflow: "auto" }}>
        <table className="cat" style={{ fontSize: 11.5 }}>
          <thead>
            {/* ⚠ CETTE COLONNE VIDE EST OBLIGATOIRE : les lignes du corps portent une cellule `⋯` en
                tete. Sans son `<th>`, l'en-tete et le corps se decalent d'une colonne — un tableau
                PLAUSIBLE et FAUX, qui ne leve aucune erreur. Meme motif pour le `colSpan` ci-dessous. */}
            <tr><th style={{ width: 22, padding: 0 }} />{cols.map((c) => (
              <th key={c.k} onClick={() => clickSort(c.k)} title={`${c.g} · trier`}
                style={{ cursor: "pointer", whiteSpace: "nowrap", minWidth: c.w, color: sort.k === c.k ? T.blue : undefined,
                  borderBottom: `2px solid ${sort.k === c.k ? T.blue : "transparent"}` }}>
                {c.lbl}{sort.k === c.k ? (sort.dir > 0 ? " ↑" : " ↓") : ""}
              </th>))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={cols.length + 1} style={{ color: T.ink3, textAlign: "center", padding: 30 }}>aucun trade pour ce filtre</td></tr>
              : rows.map((t, i) => (
                /* ⭐ CLIC SIMPLE → page Score du tir (owner 2026-08-11).
                   ⭐ DOUBLE-CLIC → page Indicateurs sur la barre du trade (owner 2026-07-29).
                   ⭐ `⋯` → tiroir de détail, qui occupait le clic simple jusqu'au 11/08. */
                <tr key={i} onClick={() => onScore?.(t)} onDoubleClick={() => onPick?.(t)} className="click"
                  title="Clic : le SCORE de ce tir, composante par composante · Double-clic : cette barre dans Indicateurs · ⋯ : le tiroir de détail"
                  style={sel === t ? { background: T.blue + "18" } : undefined}>
                  {/* ⭐ Le tiroir garde son acces propre — `stopPropagation` sinon le clic de ligne
                      (page Score) l'emporterait et le tiroir deviendrait injoignable. */}
                  <td style={{ padding: 0, width: 22 }}>
                    <button type="button" title="Tiroir de détail" onClick={(e) => { e.stopPropagation(); setSel(t); }}
                      style={{ background: "transparent", border: "none", color: T.ink3, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "2px 4px" }}>⋯</button>
                  </td>
                  {cols.map((c) => {
                    const v = t[c.k];
                    // null ≠ 0 : un indicateur ABSENT s'affiche "—" (le piège num("")===0 a déjà coûté cher)
                    if (v == null || v === "") return <td key={c.k} style={{ color: T.ink3 }}>—</td>;
                    return <td key={c.k} className={c.mono ? "mono" : undefined}
                      style={{ color: c.col ? c.col(v) : T.ink2, fontWeight: c.bold ? 600 : undefined, whiteSpace: "nowrap" }}>
                      {c.fmt(v)}
                    </td>;
                  })}
                </tr>))}
          </tbody>
        </table>
      </Panel>

      {sel && <Detail t={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function FilterRow({ label, children }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: T.ink3, fontWeight: 600, marginRight: 2 }}>{label}</span>
      {children}
    </div>
  );
}

// Compare — médiane + P25/P75 WIN vs LOSS, avec l'écart. Deux barres alignées sur une échelle commune :
//   si les boîtes se chevauchent, l'indicateur ne sépare pas — c'est l'information utile.
function Compare({ cmp }) {
  const { w, l, col } = cmp;
  if (!w.length && !l.length) return <div style={{ color: T.ink3, fontSize: 12 }}>aucune donnée pour cet indicateur sur cette sélection</div>;
  const lo = Math.min(...[...w, ...l]), hi = Math.max(...[...w, ...l]);
  const span = hi - lo || 1;
  const f = (v) => (v == null ? "—" : v.toFixed(2));
  const bar = (a, color, lbl) => {
    if (!a.length) return <div style={{ color: T.ink3, fontSize: 11 }}>{lbl} : aucun</div>;
    const q1 = quant(a, 0.25), q3 = quant(a, 0.75), m = med(a);
    const x = (v) => `${(100 * (v - lo)) / span}%`;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "5px 0" }}>
        <span style={{ width: 42, fontSize: 11, fontWeight: 600, color }}>{lbl}</span>
        <span style={{ width: 34, fontSize: 10.5, color: T.ink3 }}>n={a.length}</span>
        <div style={{ position: "relative", flex: 1, height: 16, background: T.bg, borderRadius: 4, border: `1px solid ${T.border}` }}>
          <div style={{ position: "absolute", left: x(q1), width: `${(100 * (q3 - q1)) / span}%`, top: 3, bottom: 3, background: color + "44", borderRadius: 3 }} />
          <div style={{ position: "absolute", left: x(m), top: 0, bottom: 0, width: 2, background: color }} />
        </div>
        <span style={{ width: 116, fontSize: 11, color: T.ink2, textAlign: "right" }}>
          <b style={{ color }}>{f(m)}</b> <span style={{ color: T.ink3 }}>[{f(q1)}–{f(q3)}]</span>
        </span>
      </div>
    );
  };
  const mw = med(w), ml = med(l);
  const delta = (mw != null && ml != null) ? mw - ml : null;
  return (
    <div>
      {bar(w, T.green, "WIN")}
      {bar(l, T.red, "LOSS")}
      <div style={{ fontSize: 11, color: T.ink3, marginTop: 7, paddingTop: 7, borderTop: `1px solid ${T.border}` }}>
        {delta == null ? "—" : <>
          Écart des médianes sur <b style={{ color: T.ink2 }}>{col?.lbl}</b> :{" "}
          <b style={{ color: Math.abs(delta) > 0.001 ? T.ink : T.ink3 }}>{delta > 0 ? "+" : ""}{delta.toFixed(2)}</b>
          <span style={{ marginLeft: 8 }}>
            (échelle {lo.toFixed(1)} → {hi.toFixed(1)}). Boîtes = P25–P75 ; barre = médiane.
            Si elles se chevauchent largement, cet indicateur <b>ne sépare pas</b> gagnants et perdants.
          </span>
        </>}
      </div>
    </div>
  );
}

// Detail — tiroir : les 12 observables (ce que le moteur VOIT) + les raisons (pourquoi il a tiré).
function Detail({ t, onClose }) {
  const obs = t.obs ?? {};
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "92vw", background: T.surface, borderLeft: `1px solid ${T.borderHi}`, padding: 18, overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.side === "BUY" ? T.green : T.red }}>{t.side} {BOITE[t.strategy] ?? t.strategy ?? "—"}</div>
            <div className="mono" style={{ fontSize: 11, color: T.ink3 }}>{t.tsMT}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.ink2, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>✕</button>
        </div>

        <Kv label="Profil" v={t.profile} />
        <Kv label="Résultat" v={`${t.outcome} · ${t.reason} · R ${t.R}`} col={pos(t.R)} />
        <Kv label="Confiance / gap" v={`${t.confidence ?? "—"} / ${t.gap ?? "—"}`} />
        {t.override && <Kv label="Override" v={t.override} col={T.amber} />}
        {t.trans && <Kv label="Transition" v={JSON.stringify(t.trans)} />}

        <Section title="Les 12 observables · ce que le moteur VOIT" />
        {Object.entries(obs).map(([k, v]) => <Kv key={k} label={k} v={String(v)} />)}

        {/* ⭐🔥 LE SCORE, DÉCOMPOSÉ — brut, bonus, et QUELLE règle a poussé (2026-07-31).
            Quatre règles de bonus/veto ont été écrites ce jour-là et elles étaient INVISIBLES
            trade par trade : on voyait le score final, jamais ce qui l'avait produit. Or un
            `exh = +8` venu d'un accord des six experts et un `+8` venu d'un `−1,8` retourné par un
            bonus à +10 sont deux barres qui n'ont RIEN à voir. La trace doit permettre de refaire
            la soustraction — c'est la raison pour laquelle `exhRaw`/`exhBonus` existent dans le
            payload depuis le 29/07 ; ils n'étaient simplement affichés nulle part.
            ⚠ Tout est conditionnel : un raccourci n'a pas de `sc` (il court-circuite les scorers),
            un run ancien n'a pas les clés. Rien n'est affiché à zéro par défaut. */}
        {t.sc && (() => {
          const c = t.sc, hasB = (c.contBonus ?? 0) !== 0 || (c.exhBonus ?? 0) !== 0;
          const line = (lbl, raw, bonus, tot, hits) => {
            if (tot == null && raw == null) return null;
            return (
              <div key={lbl}>
                <Kv label={lbl} v={bonus ? `${fmtN(raw)} ${bonus > 0 ? "+" : "−"} ${Math.abs(bonus)} = ${fmtN(tot)}` : fmtN(tot)}
                  col={tot == null ? undefined : tot > 0 ? T.green : tot < 0 ? T.red : undefined} />
                {(hits ?? []).map((h, i) => (
                  <div key={i} style={{ fontSize: 10.5, color: T.violet, padding: "2px 0 2px 10px" }}>
                    ⤷ {h.id} <span style={{ color: T.ink3 }}>[{h.tf}] {h.side} {h.value > 0 ? "+" : ""}{h.value}</span>
                  </div>
                ))}
              </div>
            );
          };
          return (
            <>
              {/* ⭐⭐ LA CASCADE — CE QUE LA BARRE A TRAVERSÉ AVANT D'ATTERRIR ICI (2026-08-05).
                  Six champs étaient produits par le moteur et affichés NULLE PART. Le couple
                  `rank`/`ranks` est le plus important : il distingue « rang JAMAIS ATTEINT » (donc
                  non câblé) de « rang atteint et REFUSÉ » (donc sévère) — sans lui un rang inerte
                  est indiscernable d'un rang exigeant, le motif payé cinq fois par ce dépôt.
                  Et `*YieldedBy` répond à la question du moment : un rang cède-t-il par SCORE (le
                  barème ne voit rien) ou par VETO (les portes le retirent) ? Deux causes, deux
                  chantiers opposés — et c'est la seule chose qui les sépare. */}
              <Section title="Cascade — les rangs traversés" />
              <Kv label="rang qui a décidé" v={c.rank ?? "—"}
                  col={c.rank === "EXH" ? T.amber : c.rank === "PB" ? T.cyan : c.rank === "CONT" ? T.blue : T.ink3} />
              <Kv label="rangs traversés" v={(c.ranks ?? []).join(" › ") || "aucun"}
                  col={(c.ranks ?? []).length ? undefined : T.red} />
              <Kv label="régime (regDir)" v={c.regDir == null ? "—" : c.regDir > 0 ? "+1 haussier → EXH SELL · PB/CONT BUY"
                                                                                   : "−1 baissier → EXH BUY · PB/CONT SELL"}
                  col={c.regDir == null ? T.red : c.regDir > 0 ? T.green : T.red} />
              {c.exhYieldedBy && <Kv label="① EXHAUSTE a cédé par" v={c.exhYieldedBy === "veto" ? "VETO (les portes)" : "SCORE (le barème)"}
                                     col={c.exhYieldedBy === "veto" ? T.amber : T.ink2} />}
              {c.pbYieldedBy && <Kv label="② PULLBACK a cédé par" v={c.pbYieldedBy === "veto" ? "VETO (les portes)" : "SCORE (le barème)"}
                                    col={c.pbYieldedBy === "veto" ? T.amber : T.ink2} />}
              {c.pbConviction != null && <Kv label="② conviction pullback" v={fmtN(c.pbConviction)} />}

              <Section title={hasB ? "Score — brut, bonus, total" : "Score par thèse"} />
              {line("CONT", c.contRaw, c.contBonus, c.cont, c.contBonusHits)}
              {/* ⚠ La ligne « EXH » porte le score du RANG RETENU côté fade — c'est-à-dire celui du
                  PULLBACK quand c'est lui qui a tiré (même barème, autre côté). D'où le côté
                  explicite : sans lui on lit un nombre sans savoir de quel camp il parle. */}
              {line(c.rank === "PB" ? "PB (barème fade, côté pro-tendance)" : "EXH (barème fade, contre-tendance)",
                    c.exhRaw, c.exhBonus, c.exh, c.exhBonusHits)}
              {c.min != null && <Kv label="seuil appliqué" v={String(c.min)} />}
              {/* ⭐ LE RANG ① A DEUX SEUILS. Sous `MIN_PRES` il se DÉSISTE (la main passe au rang ②) ;
                  entre les deux il **DROP** — « épuisement présent mais faible », une contrainte de
                  risque assumée. Afficher le seul seuil de tir laissait croire à une frontière unique. */}
              {c.minPres != null && (c.rank === "EXH" || (c.ranks ?? []).includes("EXH")) && (
                <Kv label="bande de veto ①" v={`[${c.minPres} · ${c.rank === "EXH" ? c.min : "MinEXH"}[ → DROP`} col={T.amber} />
              )}
              {/* ⭐⭐ SANS LE RÉGIME DE SILENCE, DEUX RUNS INCOMPARABLES SE LISENT PAREIL : le même
                  score de 2,1 ne dit pas la même chose selon que les experts muets amplifient,
                  diluent ou pénalisent — les trois régimes déplacent le volume de 100 % à 36 %. */}
              {c.silence && <Kv label="régime du silence" v={c.silence}
                                col={c.silence === "amplifie" ? T.red : c.silence === "dilue" ? T.ink2 : T.amber} />}
              {c.exp && (
                <>
                  {/* ⭐ LE TITRE PORTE LA FAMILLE ET LE CÔTÉ. Le rang ② est scoré par les experts du
                      FADE, pas par ceux de la continuation — c'était le second défaut silencieux :
                      un ternaire à deux issues envoyait `PB` vers `contExperts`, donc l'écran
                      montrait des chiffres sans lien avec la décision affichée juste au-dessus. */}
                  <Section title={`Par expert · barème ${c.expFamily === "exh" ? "FADE" : "CONTINUATION"}${c.expSide ? ` · côté ${c.expSide}` : ""}`} />
                  {Object.entries(c.exp).map(([k, v]) => (
                    <Kv key={k} label={k} v={v == null ? "muet" : fmtN(v)}
                      col={v == null ? T.ink3 : v > 0 ? T.green : v < 0 ? T.red : undefined} />
                  ))}
                </>
              )}
            </>
          );
        })()}

        {/* ⭐ LES REFUS, MÊME QUAND UNE THÈSE A GAGNÉ. `vetoed` porte les vetos posés sur l'AUTRE
            thèse, et `exhRef` le motif par lequel le fade a été écarté — c'est ce dernier qui dit
            « le CONT tire ICI parce que la porte du fade a refusé le côté », le cas le plus
            fréquent du moteur (100 % des refus EXH finissent en FIRE_CONT, mesuré le 31/07). */}
        {/* ⛔ `t.exhRef` RETIRÉ (2026-08-05) : il lisait `sel.exhRefused`, qui n'existe plus dans la
            sortie de `decideFromScoring` — vérifié, `'exhRefused' in selection === false`. Le bloc ne
            s'affichait donc JAMAIS. Ironie : c'était le seul endroit de l'UI qui montrait un `kind`.
            ⭐⭐ `kind` EST MAINTENANT SUR CHAQUE HIT, et c'est désormais l'information qui compte :
            depuis la résurrection du tri, un refus `timing` (M15/M5) TUE la barre — personne ne
            trade — tandis qu'un refus `structure` (H4/H1/D1) PASSE LA MAIN au rang suivant. Voir
            l'`id` du veto sans voir son `kind`, c'est voir qu'il a mordu sans savoir ce qu'il a fait. */}
        {(t.vetoed ?? []).length > 0 && (
          <>
            <Section title="Refus posés sur cette barre" />
            {(t.vetoed ?? []).map((v, i) => (
              <Kv key={i} label={`veto ${v.strategy} ${v.side}`} col={T.amber}
                v={(v.hits ?? []).map((h) => `${h.id}[${h.tf}·${h.kind === "timing" ? "TUE" : "route"}]`).join(" + ") || "—"} />
            ))}
          </>
        )}

        <Section title="Pourquoi il a tiré" />
        {(t.reasons ?? []).map((r, i) => (
          <div key={i} style={{ fontSize: 11.5, color: T.ink2, padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>{r}</div>
        ))}
        {!(t.reasons ?? []).length && <div style={{ fontSize: 11.5, color: T.ink3 }}>—</div>}
      </div>
    </div>
  );
}
const fmtN = (v) => (v == null ? "—" : Number(v).toFixed(2));
const Section = ({ title }) => (
  <div style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: T.ink3, fontWeight: 600, margin: "16px 0 6px" }}>{title}</div>
);
const Kv = ({ label, v, col }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
    <span style={{ color: T.ink3 }}>{label}</span>
    <span style={{ color: col ?? T.ink2, fontWeight: 500, textAlign: "right" }}>{v ?? "—"}</span>
  </div>
);
