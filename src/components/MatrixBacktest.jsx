import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
// Tokens + primitives : SOURCE UNIQUE dans ui.jsx (partagés avec SignalsPage — cf note d'extraction).
import { T, Panel, Chip, pos, empty, N } from "./ui.jsx";
// ⭐ Les poids sont lus À LA SOURCE, cross-dépôt, jamais recopiés : une valeur d'UI recopiée ment au
//   premier chiffre modifié dans le moteur — et c'est précisément un chiffre qu'on va faire bouger.
import { SCORING_WEIGHT } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js";
// ⭐ L'ORDRE DES RANGS VIENT DU MOTEUR, PAS D'UNE LISTE RECOPIÉE ICI (phase C). Deux ordres écrits
//   dans deux dépôts, c'est le même motif que les deux palettes : le début de la fin.
import { MODE_ORDER } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/modes.js";
import SignalsPage from "./SignalsPage.jsx";
import IndicatorsPage from "./IndicatorsPage.jsx";

const API = "http://localhost:3001/api/matrix";
const money = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—");
const MONTHS = { "01": "jan", "02": "fév", "03": "mars", "04": "avr", "05": "mai", "06": "juin", "07": "juil", "08": "août", "09": "sep", "10": "oct", "11": "nov", "12": "déc" };

// Détail par RÉGIME (couche 2) × side.
// ⚠ DÉRIVÉ DES TRADES, pas d'une liste en dur (owner 2026-07-17). L'ancienne liste de 10 lignes fixes avait
//   silencieusement pourri : elle gardait "Range" (SUPPRIMÉ le 13/07 → 2 lignes mortes à zéro) et ignorait
//   "Transitioning" (ajouté le 16/07 → ~26 % des trades INVISIBLES). Une liste en dur ne signale pas qu'elle
//   est périmée — elle affiche juste un total faux. Dériver = la table suit le moteur sans intervention.
// ORDER = ordre d'affichage seulement (spectre bear→bull du moteur, cf PROFILES de MarketProfileKnowledge).
//   Un régime inconnu de cette liste n'est PAS masqué : il tombe en fin de table. C'est le point.
//   ⛔ "Transitioning" RETIRÉ le 2026-07-20 : la famille est supprimée du moteur (Matrix `1f798c9`)
//   — le profil n'est plus PRODUCTIBLE. Le retirer d'ORDER ne masque rien (cf. ligne au-dessus) :
//   s'il réapparaissait, il s'afficherait en fin de table au lieu d'être silencieusement absent.
//
// 🔴🔥 RÉPARÉ LE 2026-07-28 — ET C'EST EXACTEMENT LE PIÈGE QUE LE COMMENTAIRE CI-DESSUS DÉCRIT, EN PIRE.
//   Cette table groupait sur `sig.profile`. Jusqu'à la refonte c3 (Matrix 27/07), `profile` PORTAIT le
//   régime couche 2 — d'où le nom. Depuis, `decideFromScoring` y met la THÈSE GAGNANTE :
//   "Continuation" / "Exhaustion". La table affichait donc deux lignes au lieu de sept régimes, sans
//   rien casser et sans qu'aucun total ne soit faux — juste une autre question, sous le même titre.
//   ⭐ La leçon N'EST PAS « dériver protège » : on dérivait déjà. C'est qu'un champ qui CHANGE DE SENS
//   est invisible pour tout ce qui le lit — plus dangereux qu'un champ supprimé, qui casse bruyamment.
//   ⇒ On lit maintenant `sig.regime`, produit par la couche 2 et qui ne veut dire QUE ça.
const PROFILE_ORDER = ["Sell-off", "Strong Bear", "Soft Bear", "Exhaustion", "Soft Bull", "Strong Bull", "Rally"];
// ⭐🔥 GROUPÉ PAR régime × THÈSE × côté DEPUIS LE 29/07 (owner). Avant : régime × côté, avec la
//   répartition des thèses reléguée dans deux colonnes (`cont · exh` et `R cont / R exh`).
//   CE QUE CETTE FORME NE POUVAIT PAS DIRE, ET C'EST LE POINT : le **WR** et l'**avg R** restaient
//   MÉLANGÉS. On voyait qu'un régime contenait 40 cont et 60 exh, et combien chacun rapportait — mais
//   pas lequel des deux GAGNAIT ses paris. Un `WR 74 %` sur une ligne mixte peut cacher un fade à
//   83 % et une continuation à 61 %, et c'est exactement l'écart qu'on cherche depuis que les deux
//   thèses concourent sur chaque barre.
//   ⇒ Chaque ligne porte maintenant UNE thèse et UN côté : `exh buy`, `exh sell`, `cont buy`,
//   `cont sell`. Les colonnes `cont · exh` / `R cont` / `R exh` disparaissent — elles étaient la
//   compensation d'un regroupement trop grossier, elles font double emploi avec les lignes.
// ── LA THÈSE TELLE QU'ON L'AFFICHE (2026-07-30) ────────────────────────────────────────────────
// ⭐⭐ UNE SEULE DÉRIVATION, DEUX LECTEURS. Le regroupement de la table ET le prédicat du filtre
//   doivent produire la MÊME clé, sinon cliquer une ligne ne rend aucun trade. Les recopier serait
//   la faute `derived_dataset_computed_3x` sur trois lignes de UI — d'où cette fonction, appelée
//   des deux côtés et de nulle part ailleurs.
// ⭐ POURQUOI LE RACCOURCI MÉRITE SA PROPRE LIGNE : il porte `strategy: "EXH"` (c'est bien un fade),
//   mais il n'a pas été produit par le même mécanisme — aucun score n'a été calculé sur ces barres,
//   un événement H4 a décidé seul. Le fondre dans l'EXH scoré rendrait sa cohorte invisible, et une
//   cohorte invisible ne se mesure pas. C'est exactement le défaut d'affichage qui a masqué l'EXH
//   pendant cinq jours après qu'il soit devenu la moitié du livre.
// ⚠ NON EXPORTÉ À DESSEIN : un export non-composant depuis un fichier de composant casse le Fast
//   Refresh de Vite (rechargement complet à chaque frappe). Ses deux lecteurs sont dans ce fichier.
const thesisOf = (x) => (x?.shortcut ? "EXH-SC" : (x?.strategy ?? "—"));

// ⭐⭐ PHASE C — UNE COULEUR PAR RANG, ET `PB` DOIT SE DISTINGUER DE `CONT`.
//   Avant : `EXH` ambre, `EXH-SC` violet, **tout le reste bleu**. Un PULLBACK tombait donc dans le
//   « reste » et s'affichait EXACTEMENT comme une continuation — même couleur, libellé voisin. Le
//   rang le plus neuf du moteur était le seul illisible dans la seule fenêtre qui sert à le juger.
// ⚠ Le vert est réservé aux issues FIRE_ et le rouge aux pertes : le cyan est la seule teinte libre
//   qui reste franchement distincte du bleu de la continuation sur ce fond.
const MODE_COLOR = (T, s) => (s === "EXH-SC" ? T.violet : s === "EXH" ? T.amber : s === "PB" ? T.cyan : T.blue);
const MODE_LABEL = (s) => (s === "EXH-SC" ? "exh·sc" : s === "PB" ? "pullback" : String(s).toLowerCase());

// ── LES SIX EXPERTS QUI VOTENT (2026-07-30) ────────────────────────────────────────────────────
// 🔴 `range` MANQUAIT. Il vote depuis le 29/07 et n'apparaissait dans aucune colonne : un expert qu'on
//    ne voit pas est un expert qu'on ne peut pas mettre en cause quand un score surprend. Il pèse
//    pourtant 15,1 % de l'influence en CONT et 19,9 % en EXH.
// ⚠ `rsi` AJOUTÉ LE 30/07 EN MÊME TEMPS QUE L'EXPERT — pas après coup. C'est le défaut que ce
//   tableau existe pour ne plus reproduire : le Range a voté pendant 24 h sans colonne.
// ⚠ `slope` AJOUTÉ (2026-08-05) : il est expert du FADE et n'apparaissait dans AUCUNE colonne, donc
//   un sixième du barème d'exhaustion était invisible. À l'inverse `energy` et `range` ne scorent
//   QUE la continuation — ils restent affichés parce que `wLabel` dit explicitement `0.2/–`, et
//   « absent de cette thèse » n'est pas la même chose qu'un poids nul.
// 🔴 RAPPEL DES JEUX RÉELS, à revérifier avant d'ajouter une colonne (ils ne sont PAS symétriques) :
//       CONT  di · zscore · kd · energy · rsi                    (5) — `range` et `k` retirés 05/08
//       EXH   di · zscore · kd · rsi · slope                     (5) — ni energy, ni range, ni k
const EXPERT_COLS = [
  // ⛔ `%K` (Cycle) retiré 05/08 : il ne score plus aucune thèse, comme `range`.
  { id: "di", label: "DI" }, { id: "zscore", label: "Z" },
  { id: "kd", label: "K/D" }, { id: "slope", label: "Slope" },
  { id: "energy", label: "Energy" },   // ⛔ `range` retiré 05/08 : il ne score plus AUCUNE thèse
  { id: "rsi", label: "RSI" },
];

// ⭐⭐ LE RANG N'EST PAS LA THÈSE, et les confondre rend un `undefined` qui MENT. `SCORING_WEIGHT` est
//   indexé par THÈSE (`CONT` / `EXH`) ; le rang ② PULLBACK lit le barème du FADE, donc ses poids sont
//   ceux d'`EXH`. Sans cette table, `SCORING_WEIGHT["PB"]` vaut `undefined` et l'infobulle annonçait
//   « cet expert n'existe pas dans la thèse PB » sur les SIX experts du pullback — un rang entier
//   déclaré vide alors qu'il est le plus rentable des trois.
const THESIS_OF = { EXH: "EXH", PB: "EXH", CONT: "CONT" };

// ⭐ LE POIDS DANS L'EN-TÊTE — LISIBLE PARCE QUE LA NORMALISATION A DISPARU. Tant que le moteur
//    divisait chaque expert par sa dispersion, les globals affichés et le total étaient sur DEUX
//    échelles et rien ne permettait de refaire le calcul de tête. Depuis `0534dde` le total est la
//    moyenne pondérée de ces colonnes-là : le poids affiché rend la ligne VÉRIFIABLE À L'ŒIL.
// ⚠ `c/e` QUAND LES DEUX THÈSES DIVERGENT — dérivé, jamais écrit en dur. Les colonnes sont identiques
//    aujourd'hui ; le jour où le poids EXH du Cycle sera abaissé (candidat annoncé), l'en-tête le dira
//    tout seul au lieu d'afficher un chiffre devenu faux pour la moitié des lignes.
// ⚠ UN EXPERT PEUT N'EXISTER QUE DANS UNE THÈSE (le RSI est CONT-only). `–` dit « absent de cette
//   thèse », ce qui n'est pas la même chose qu'un poids nul — et sûrement pas `undefined` à l'écran.
const wLabel = (id) => {
  const c = SCORING_WEIGHT.CONT?.[id], e = SCORING_WEIGHT.EXH?.[id];
  return c === e ? String(c) : `${c ?? "–"}/${e ?? "–"}`;
};

function regimeStats(signals) {
  // Triplets (régime × thèse × côté) RÉELLEMENT produits. Groupés par Map imbriquées : PAS de
  //   clé-chaîne concaténée — les noms de régime contiennent des espaces ("Strong Bull"), toute
  //   re-séparation serait un piège.
  const groups = new Map();
  for (const x of signals) {
    // ⚠ PAS DE `continue` SUR UN RÉGIME ABSENT : un trade sans régime doit se VOIR (ligne « — » en fin de
    //   table), sinon la somme des lignes ne fait plus le total et l'écart est muet. Même règle pour
    //   une thèse absente — `strategy` vient du moteur, un jour où il changerait de nom on veut le voir.
    const regime = x.regime ?? "—";
    const strategy = thesisOf(x);
    if (!groups.has(regime)) groups.set(regime, new Map());
    const byStrat = groups.get(regime);
    if (!byStrat.has(strategy)) byStrat.set(strategy, {});
    const bySide = byStrat.get(strategy);
    (bySide[x.side] ??= []).push(x);
  }
  const rank = (p) => { const i = PROFILE_ORDER.indexOf(p); return i === -1 ? PROFILE_ORDER.length : i; };
  // CONT avant EXH : ordre stable et lisible. ⚠ Ce n'est PAS l'ordre de l'arbitrage (l'EXH décide en
  //   premier depuis le 29/07) — un ordre d'affichage ne doit rien prétendre sur la mécanique.
  // ⚠ Le raccourci se range APRÈS l'EXH scoré, donc en bas du groupe : c'est un ordre d'affichage
  //   stable, il ne prétend rien sur la mécanique (le raccourci décide AVANT tout le reste).
  // ⭐ PHASE C — L'ORDRE DES RANGS VIENT DU MOTEUR (`MODE_ORDER` : EXHAUSTE › PULLBACK › CONTINUE).
  //   L'ancien classement était écrit à la main et plaçait `CONT` en tête ; il datait d'un moteur où
  //   la continuation décidait la première. Depuis le 27/07 c'est l'inverse, et depuis le 05/08 il y
  //   a TROIS rangs — un `s === ... ? ... : 3` rangeait donc `PB` dans le seau « autre », à côté des
  //   inconnus. ⚠ Un tri qui se trompe ne lève rien : il produit un tableau plausible.
  const sRank = (s) => { const i = MODE_ORDER.indexOf(s); return i >= 0 ? i : MODE_ORDER.length; };
  const rows = [];
  for (const [regime, byStrat] of groups)
    for (const [strategy, bySide] of byStrat)
      for (const side of Object.keys(bySide)) rows.push({ regime, strategy, side });
  rows.sort((a, b) => (rank(a.regime) - rank(b.regime)) || a.regime.localeCompare(b.regime)
    || (sRank(a.strategy) - sRank(b.strategy)) || a.side.localeCompare(b.side));
  return rows.map(({ regime, strategy, side }) => {
    const g = groups.get(regime).get(strategy)[side];
    const n = g.length;
    const wins = g.filter((x) => x.outcome === "WIN").length;
    const losses = g.filter((x) => x.outcome === "LOSS").length;
    const dec = wins + losses;   // outcome binaire (WIN|LOSS) → dec = tous les trades ; WR = wins/dec
    const totalR = g.reduce((a, x) => a + x.R, 0);
    return { regime, strategy, side, n,
             wr: dec ? +(100 * wins / dec).toFixed(1) : null,
             avgR: n ? +(totalR / n).toFixed(3) : null, totalR: +totalR.toFixed(2) };
  });
}
// Cascade : runs de ≥3 trades consécutifs, même SIDE, tous LOSS (scan séquentiel, ordre d'ouverture).
function cascadeFlags(signals) {
  const f = new Array(signals.length).fill(false);
  let i = 0;
  while (i < signals.length) {
    if (signals[i].outcome !== "LOSS") { i++; continue; }
    let j = i + 1;
    while (j < signals.length && signals[j].outcome === "LOSS" && signals[j].side === signals[i].side) j++;
    if (j - i >= 3) for (let k = i; k < j; k++) f[k] = true;
    i = j;
  }
  return f;
}

/**
 * TpSlBadge — affiche le couple TP/SL RÉELLEMENT UTILISÉ par le dernier run, pas celui de la config.
 *
 * ⚠ Pourquoi cette distinction (owner 2026-07-17, cas vécu) : une saisie de `0.065` au lieu de `0.65`
 *   dans le champ TP a tourné pendant que le badge affichait sereinement « défaut · 0.65/1.95 ». Toute la
 *   liste de trades était fausse (TP 10× trop proche → sorties immédiates → le cap de concurrence se libère
 *   → des candidats passent qui seraient recalés) et RIEN à l'écran ne le disait. Un badge qui montre la
 *   config plutôt que l'effectif ne rassure que sur le papier : il ment dès qu'on l'écrase.
 *
 * Trois états : OVERRIDE (rouge, le run diffère de la config) · config actif (ambre) · défaut (gris).
 * `dirty` = les champs ont bougé depuis le run → le badge décrit le passé, on le signale.
 */
function TpSlBadge({ cfg, res, p, asset }) {
  if (!cfg) return null;
  const used = res?.params;                                   // ce qui a VRAIMENT tourné
  const tp = used ? Number(used.tpAtr) : Number(p.tpAtr);
  const sl = used ? Number(used.slAtr) : Number(p.slAtr);
  if (!Number.isFinite(tp) || !Number.isFinite(sl)) return null;
  const override = tp !== cfg.tp || sl !== cfg.sl;
  const dirty = used && (Number(p.tpAtr) !== tp || Number(p.slAtr) !== sl);
  const col = override ? T.red : cfg.source === "asset" ? T.amber : T.ink3;
  const lbl = override ? "OVERRIDE" : cfg.source === "asset" ? `config ${asset}` : "défaut";
  const title = override
    ? `Le run a tourné avec ${tp}/${sl} — la config dit ${cfg.tp}/${cfg.sl}. Vide les champs ou remets ${cfg.tp}/${cfg.sl} pour revenir à la config.`
    : (cfg.why || "couple par défaut de l'univers");
  return (
    <span title={title} style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: col + "1e", color: col }}>
      {!used && "à lancer · "}TP/SL {lbl} · {tp}/{sl} · be {(100 * sl / (sl + tp)).toFixed(0)}%
      {override && ` (config ${cfg.tp}/${cfg.sl})`}
      {dirty && " · champs modifiés"}
    </span>
  );
}

function Tile({ label, value, color, sub }) {
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 12px", flex: "1 1 110px", minWidth: 108 }}>
      <div style={{ fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase", color: T.ink3, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 650, color: color || T.ink, marginTop: 3, lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.ink2, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}


export default function MatrixBacktest() {
  const [tab, setTab] = useState("bt");        // "bt" = dashboard | "sig" = page Signaux (même run, pas de re-run)
  // ⭐ SAUT SIGNAL → INDICATEURS (owner 2026-07-29). Cliquer un trade ouvre la page Indicateurs SUR SA
  //   BARRE. Jusqu'ici, expliquer un tir demandait de recopier son horodatage à la main dans les
  //   sélecteurs — donc on ne le faisait presque jamais, et les six scores d'un trade restaient une
  //   ligne de chiffres qu'on ne pouvait pas remonter jusqu'aux capteurs.
  //   ⚠ `n` est un compteur : recliquer le MÊME signal doit recharger, or `ts` seul ne changerait pas.
  const [jump, setJump] = useState(null);
  const jumpTo = (sig) => {
    const m = String(sig?.tsMT ?? "").match(/(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return;                            // horodatage illisible ⇒ on ne navigue pas à l'aveugle
    setJump((j) => ({ ts: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`, n: (j?.n ?? 0) + 1 }));
    setTab("ind");
  };
  const [assets, setAssets] = useState([]);
  const [asset, setAsset] = useState("");
  // ⭐ `chargeSpread` DÉFAUT FALSE, ET C'EST UN CHOIX : toute la littérature du dépôt (9 058 tr ·
  //   81,1 % · 0,0832) est HORS spread. Ouvrir l'UI sur un mode qui ne reproduit aucune mesure
  //   publiée rendrait chaque comparaison fausse en silence. `URLSearchParams` sérialise `false`,
  //   et le serveur n'active que sur la chaîne "true" — donc OFF passe explicitement.
  const [p, setP] = useState({ tpAtr: 0.65, slAtr: 1.95, maxOpen: 30, cadenceMin: 2, initialEquity: 10000, riskPct: 1, admission: true, chargeSpread: false });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  // Filtre catégorie (frontend, un seul actif) : {kind:'profile',profile,side,sig} | {kind:'cascade'} | null
  const [filter, setFilter] = useState(null);
  const [outcomeFilter, setOutcomeFilter] = useState(null);   // null | 'WIN' | 'LOSS' | 'TIMEOUT' (compose avec filter)
  // ⚗️ Défaut posé le 24/07 pour un focus Strong Bull/Bear : il MASQUAIT les fires EXH de TOUT
  //   l'affichage (détail par régime, tuiles, equity, liste des signaux, page Signaux).
  // 🔴🔥 REMIS À VISIBLE (owner 2026-07-29) — LE DÉFAUT ÉTAIT DEVENU UN MENSONGE DE LECTURE. L'EXH
  //   était le repli quand ce défaut a été posé ; depuis l'arbitrage du 29/07 il passe DEVANT le CONT
  //   et pèse 7 192 trades sur 14 448 mesurés. On cachait donc la moitié du livre, et la moitié qui
  //   décide. Le bouton reste — c'est un outil de focus, pas un état de repos.
  //   ⭐ Un défaut d'affichage posé pour une expérience survit à l'expérience : rien ne le rappelle,
  //   et les chiffres qu'il montre restent parfaitement cohérents entre eux. Même famille que la
  //   table « Détail par régime » qui groupait sur un champ ayant changé de sens.
  const [hideExh, setHideExh] = useState(false);   // Display-only : le backtest reste complet dans les deux cas.
  // filtre PLAGE (frontend, sans re-run) — mois/jour en menus déroulants, année 2026 par défaut
  const [fromM, setFromM] = useState(""); const [fromD, setFromD] = useState("");
  const [toM, setToM] = useState(""); const [toD, setToD] = useState("");

  const [tpSlCfg, setTpSlCfg] = useState(null);   // couple de l'actif selon TpSlConfig (SSOT moteur)

  useEffect(() => {
    fetch(`${API}/assets`).then((r) => r.json()).then((a) => { setAssets(a); if (a[0]) setAsset(a[0]); }).catch((e) => setErr(String(e)));
  }, []);

  // Au changement d'actif : PRÉREMPLIR tp/sl depuis TpSlConfig (SSOT). Sans ça l'UI enverrait son
  //   0,65/1,95 en dur à chaque run et écraserait la config par actif — COCOA tournerait au défaut
  //   sans que rien ne le signale. L'utilisateur peut toujours écraser à la main dans les champs.
  useEffect(() => {
    if (!asset) return;
    fetch(`${API}/tpsl/${asset}`).then((r) => r.json())
      .then((c) => { setTpSlCfg(c); setP((s) => ({ ...s, tpAtr: c.tp, slAtr: c.sl })); })
      .catch(() => setTpSlCfg(null));
  }, [asset]);

  const run = async () => {
    if (!asset) return;
    setLoading(true); setErr(null);
    try {
      const q = new URLSearchParams(p).toString();
      const r = await fetch(`${API}/run/${asset}?${q}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setRes(j); setFilter(null); setOutcomeFilter(null);
    } catch (e) { setErr(String(e.message || e)); }
    setLoading(false);
  };

  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const s = res?.summary;

  // ── Filtre PLAGE (frontend) : menus mois/jour (année 2026) → dates "2026-MM-DD" comparées à tsMT ──
  const YEAR = "2026";
  const dateFrom = (fromM && fromD) ? `${YEAR}-${fromM}-${fromD}` : "";
  const dateTo = (toM && toD) ? `${YEAR}-${toM}-${toD}` : "";
  // mois/jours DISPO dans les signaux chargés (tirés du CSV)
  const dateInfo = useMemo(() => {
    if (!res) return { months: [], daysByMonth: {} };
    const set = {};
    for (const sig of res.signals) { const pp = String(sig.tsMT).slice(0, 10).split("."); const m = pp[1], d = pp[2]; if (!m || !d) continue; (set[m] = set[m] || new Set()).add(d); }
    const months = Object.keys(set).sort();
    const daysByMonth = {}; for (const m of months) daysByMonth[m] = [...set[m]].sort();
    return { months, daysByMonth };
  }, [res]);
  const clearRange = () => { setFromM(""); setFromD(""); setToM(""); setToD(""); };
  const inRange = (ts) => { const d = String(ts).slice(0, 10).replace(/\./g, "-"); return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo); };
  const rangeActive = !!(dateFrom || dateTo);
  const sigs = res ? res.signals.filter((x) => inRange(x.tsMT) && !(hideExh && x.strategy === "EXH")) : [];   // base = signaux DANS la plage (EXH masqué si focus SB/SB)

  // dérivés frontend (recalculés sur la plage)
  const profs = res ? regimeStats(sigs) : [];
  const overall = res ? (() => {
    const g = sigs, n = g.length, wins = g.filter((x) => x.outcome === "WIN").length, losses = g.filter((x) => x.outcome === "LOSS").length, dec = wins + losses, totalR = g.reduce((a, x) => a + x.R, 0);
    return { n, wr: dec ? +(100 * wins / dec).toFixed(1) : null, avgR: n ? +(totalR / n).toFixed(3) : null, totalR: +totalR.toFixed(2) };
  })() : null;
  const casc = res ? cascadeFlags(sigs) : [];
  const be = res ? 100 * res.params.slAtr / (res.params.slAtr + res.params.tpAtr) : 75;   // breakeven WR pour ce R:R
  const wrColor = (wr) => (wr == null ? T.ink3 : wr >= be ? T.green : wr >= be - 12 ? T.amber : T.red);
  // Marge au seuil : juste au-dessus = ambre (le tir tient à peu de chose), large = vert.
  //   ⚠ On compare |score|/10 au seuil de la thèse RETENUE — les deux n'ont pas le même (mesuré :
  //   le même 4 vaut p90 en CONT et p77 en EXH).
  const scoreColor = (sig) => {
    const m = sig?.sc?.min, v = Math.abs((sig?.score ?? 0) / 10);
    if (!m) return T.ink3;
    return v >= m + 2 ? T.green : v >= m + 0.5 ? T.amber : T.ink2;
  };

  // ── Filtre : clic ligne profil (toggle) / clic cascade (remplace le filtre profil) → liste Signaux filtrée ──
  const profFilter = filter?.kind === "profile" ? filter : null;
  // ⚠ LA THÈSE ENTRE DANS LE FILTRE (29/07), sinon cliquer « exh buy » rendrait aussi les cont buy du
  //   même régime — la liste ne montrerait pas la ligne qu'on vient de cliquer.
  const clickProfile = (c) => { if (c.n > 0) setFilter((f) => (f && f.kind === "profile" && f.regime === c.regime && f.strategy === c.strategy && f.side === c.side) ? null : { kind: "profile", regime: c.regime, strategy: c.strategy, side: c.side, sig: `${c.regime} · ${c.strategy.toLowerCase()} ${c.side.toLowerCase()}` }); };
  const clickCascade = () => setFilter((f) => (f && f.kind === "cascade") ? null : { kind: "cascade" });
  const allRows = res ? sigs.map((sig, idx) => ({ sig, idx, casc: casc[idx] })) : [];
  let shownRows = allRows;
  // ⚠ `(r.sig.regime ?? "—")` / `(r.sig.strategy ?? "—")` : le filtre doit matcher LES MÊMES clés que
  //   la table (cf. `regimeStats`), sinon cliquer la ligne « — » ne rendrait aucun trade.
  if (filter) shownRows = filter.kind === "cascade" ? shownRows.filter((r) => r.casc)
    : shownRows.filter((r) => (r.sig.regime ?? "—") === filter.regime
        && thesisOf(r.sig) === filter.strategy && r.sig.side === filter.side);
  if (outcomeFilter) shownRows = shownRows.filter((r) => (outcomeFilter === "WIN" || outcomeFilter === "LOSS") ? r.sig.outcome === outcomeFilter : r.sig.reason === outcomeFilter);

  // ── DIAGNOSTIC ADX (console) : dump la SÉLECTION COURANTE (tous filtres appliqués) → « je lance COCOA,
  //   je clique Loss, je vois à quel niveau d'ADX ces trades ont tiré ». Table + histogramme par bande de 5.
  //   Lecture seule : n'influence ni la décision ni l'affichage.
  useEffect(() => {
    if (!res || !shownRows.length) return;
    const rows = shownRows.map(({ sig }) => sig);
    const vals = rows.map((x) => x.adx).filter((v) => v != null).sort((a, b) => a - b);
    const q = (p) => (vals.length ? +vals[Math.min(vals.length - 1, Math.floor(p * vals.length))].toFixed(1) : null);
    const label = [res.asset, filter ? (filter.kind === "cascade" ? "cascade" : `${filter.regime}·${filter.strategy}·${filter.side}`) : null, outcomeFilter]
      .filter(Boolean).join(" · ");
    console.groupCollapsed(`%cADX — ${label} · ${rows.length} trades (${vals.length} avec ADX)`, "color:#4a9eff;font-weight:600");
    if (!vals.length) {
      console.warn("Aucun ADX sur cette sélection — colonnes adx14_h1_* absentes du CSV de cet actif ?");
    } else {
      console.log(`médiane ${q(0.5)} · P10 ${q(0.1)} · P25 ${q(0.25)} · P75 ${q(0.75)} · P90 ${q(0.9)} · min ${vals[0].toFixed(1)} · max ${vals[vals.length - 1].toFixed(1)}`);
      // histogramme par bande de 5 → où se concentrent ces trades, pas juste leur moyenne
      const hist = {};
      vals.forEach((v) => { const b = Math.floor(v / 5) * 5; hist[`${b}-${b + 5}`] = (hist[`${b}-${b + 5}`] ?? 0) + 1; });
      console.table(Object.entries(hist).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([bande, n]) => ({ bande, n, pct: `${(100 * n / vals.length).toFixed(1)}%` })));
      console.table(rows.map((x) => ({ ts: x.tsMT, side: x.side, type: x.type, regime: x.regime, profile: x.profile, adx: x.adx, dAdx: x.dAdx, R: x.R, outcome: x.outcome })));
    }
    console.groupEnd();
  }, [res, filter, outcomeFilter, dateFrom, dateTo]);

  let domain = ["auto", "auto"], accent = T.green, curveData = [];
  if (res && (rangeActive || hideExh) && sigs.length > 0) {
    // Plage active OU EXH masqué : reconstruit la courbe = equity cumulée (initialEquity + Σ pnl) sur les trades affichés.
    let eqv = s.initialEquity; curveData = [{ i: -1, equity: eqv }];
    sigs.forEach((sig, i) => { eqv += Number(sig.pnl ?? 0); curveData.push({ i, equity: +eqv.toFixed(2) }); });
    const eq = curveData.map((e) => e.equity), lo = Math.min(...eq), hi = Math.max(...eq), pad = (hi - lo) * 0.12 || hi * 0.01;
    domain = [Math.floor(lo - pad), Math.ceil(hi + pad)];
    accent = eqv >= s.initialEquity ? T.green : T.red;
  } else if (res?.equityCurve?.length > 1) {
    const eq = res.equityCurve.map((e) => e.equity);
    const lo = Math.min(...eq), hi = Math.max(...eq), pad = (hi - lo) * 0.12 || hi * 0.01;
    domain = [Math.floor(lo - pad), Math.ceil(hi + pad)];
    accent = s.finalEquity >= s.initialEquity ? T.green : T.red;
    curveData = res.equityCurve.map((e, i) => ({ i, equity: e.equity }));
  }

  // ── SUMMARY VIEW : quand EXH est masqué, recalcule les métriques d'affichage sur `sigs` (SB/SB only) ──
  //   pour que les tuiles KPI + la synthèse ne montrent PAS les stats dominées par l'Exhaustion (1275 fires).
  //   Champs OPÉRATIONNELS (fires/cap/admission/rows/évals) gardés du summary serveur (mécanique de run, pas
  //   par-stratégie). Sans masquage, sv === s (le summary serveur brut).
  const sv = (res && s && hideExh) ? (() => {
    const wins = sigs.filter((x) => x.outcome === "WIN").length, losses = sigs.filter((x) => x.outcome === "LOSS").length;
    const netPnL = sigs.reduce((a, x) => a + (x.pnl || 0), 0);
    const gain = sigs.filter((x) => (x.pnl || 0) > 0).reduce((a, x) => a + x.pnl, 0);
    const lossSum = Math.abs(sigs.filter((x) => (x.pnl || 0) < 0).reduce((a, x) => a + x.pnl, 0));
    const init = s.initialEquity || 0;
    let peak = init, maxDD = 0; for (const pt of curveData) { peak = Math.max(peak, pt.equity); maxDD = Math.max(maxDD, peak - pt.equity); }
    const byType = {}, byReason = {}, bySide = { BUY: 0, SELL: 0 };
    for (const x of sigs) { byType[x.type] = (byType[x.type] || 0) + 1; byReason[x.reason] = (byReason[x.reason] || 0) + 1; if (x.side) bySide[x.side] = (bySide[x.side] || 0) + 1; }
    return { ...s, returnPct: init ? +(100 * netPnL / init).toFixed(2) : 0, netPnL: +netPnL.toFixed(2),
      finalEquity: +(init + netPnL).toFixed(2), winRate: overall.wr ?? 0, wins, losses,
      maxDrawdown: +maxDD.toFixed(2), maxDrawdownPct: peak > 0 ? +(100 * maxDD / peak).toFixed(2) : 0,
      profitFactor: lossSum ? +(gain / lossSum).toFixed(2) : 0, avgR: overall.avgR ?? 0, totalR: overall.totalR,
      opened: sigs.length, byType, byReason, bySide };
  })() : s;

  // ⚠ APPELÉ EN FONCTION `{field(...)}`, PAS `<field/>`. Défini dans le composant, il capture une
  //   nouvelle identité à chaque render : en tant qu'ÉLÉMENT JSX, React démonterait/remonterait l'input
  //   à chaque frappe (setP re-render) → focus perdu après 1 caractère. Appelé en fonction, les <input>
  //   sont réconciliés par position dans le parent → même instance, focus conservé.
  const field = ({ label, k, w }) => (
    <div className="field" style={{ width: w }} key={k}>
      <div style={{ fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase", color: T.ink3, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap" }}>{label}</div>
      {k === "_asset"
        ? <select value={asset} onChange={(e) => setAsset(e.target.value)}>{assets.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        : <input type="text" inputMode="decimal" spellCheck={false} value={p[k]} onChange={set(k)}
            onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (e.key === "Enter" && !loading) run(); }} />}
    </div>
  );

  return (
    <div className="mx" style={{ background: T.bg, height: "100vh", color: T.ink, display: "flex", flexDirection: "column", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", overflow: "hidden" }}>
      <style>{`
        body { margin: 0; background: ${T.bg}; }
        .mx { -webkit-font-smoothing: antialiased; }
        .mx .field input, .mx .field select { width: 100%; box-sizing: border-box; background: ${T.bg}; border: 1px solid ${T.border}; color: ${T.ink}; border-radius: 7px; padding: 8px 10px; font-size: 13px; font-family: inherit; font-variant-numeric: tabular-nums; transition: border-color .12s; }
        .mx .field input:focus, .mx .field select:focus { outline: none; border-color: ${T.blue}; box-shadow: 0 0 0 3px rgba(68,147,248,.15); }
        .mx .field select { cursor: pointer; }
        .mx .run { width: 100%; background: ${T.blue}; color: #fff; border: 0; border-radius: 7px; padding: 10px; font-weight: 600; font-size: 13px; cursor: pointer; transition: filter .12s, transform .06s; }
        .mx .run:hover { filter: brightness(1.08); } .mx .run:active { transform: translateY(1px); } .mx .run:disabled { opacity: .55; cursor: default; }
        .mx table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .mx thead th { position: sticky; top: 0; background: ${T.surface}; color: ${T.ink3}; text-align: left; font-weight: 600; font-size: 10px; letter-spacing: .4px; text-transform: uppercase; padding: 8px 11px; border-bottom: 1px solid ${T.border}; z-index: 1; }
        .mx tbody td { padding: 6px 11px; border-bottom: 1px solid #1a2029; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .mx tbody tr:hover td { background: #1c2330; }
        .mx tbody tr.casc td { background: #f851491f; }
        .mx tbody tr.casc:hover td { background: #f8514930; }
        .mx .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .mx ::-webkit-scrollbar { width: 9px; height: 9px; }
        .mx ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 6px; border: 2px solid ${T.surface}; }
        .mx ::-webkit-scrollbar-thumb:hover { background: ${T.borderHi}; }
        .mx .cat td { padding: 6px 11px; font-size: 12px; }
        /* ATTENTION : on est DANS un template literal — jamais de backtick dans ce bloc, il fermerait
           la chaine et le reste serait lu comme du JS (crash "is not a function", vecu le 29/07).
           La classe cat a ete RETIREE du selecteur : la table des SIGNAUX est un table nu, ses lignes
           cliquables n'auraient eu ni curseur ni survol — une affordance invisible n'existe pas. */
        .mx tbody tr.click { cursor: pointer; }
        .mx tbody tr.click:hover td { background: #1c2330; }
        .mx .cat tbody tr.active td { background: #4493f81f; }
        .mx .casclink:hover { text-decoration: underline; }
      `}</style>

      {/* Header + onglets. Les deux pages partagent le MÊME run (`res`) : basculer ne relance rien. */}
      <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 11, padding: "14px 20px" }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>Matrix Backtest</h1>
        <span style={{ fontSize: 12.5, color: T.ink2 }}>moteur prod (SSOT) · par actif · timestamps MT</span>
        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {[["Backtest", "bt"], ["Signaux", "sig"], ["Indicateurs", "ind"]].map(([lbl, id]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              style={{ background: tab === id ? T.blue + "22" : "transparent", color: tab === id ? T.blue : T.ink3,
                border: `1px solid ${tab === id ? T.blue + "66" : T.border}`, borderRadius: 7, padding: "4px 12px",
                fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>{lbl}</button>
          ))}
        </div>
        {err && <span style={{ marginLeft: "auto", color: T.red, fontSize: 12.5 }}>{err}</span>}
      </div>

      {tab === "ind" ? (
        /* Page Indicateurs : lit une LIGNE du dataset via /api/matrix/row — indépendante du run. */
        <div style={{ flex: 1, minHeight: 0, padding: "0 20px 20px", display: "flex" }}>
          <IndicatorsPage asset={res?.asset ?? asset} jump={jump} />
        </div>
      ) : tab === "sig" ? (
        <div style={{ flex: 1, minHeight: 0, padding: "0 20px 20px" }}>
          <SignalsPage res={res} asset={res?.asset ?? asset} hideExh={hideExh} onPick={jumpTo} />
        </div>
      ) : (
      /* Grille 2×2 — 40% / 60% */
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, padding: "0 20px 20px" }}>

        {/* Colonne gauche 40% : Paramètres (auto) / Résultats (reste) */}
        <div style={{ flex: "40 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel title="Paramètres" flex="20 1 0"
            extra={<TpSlBadge cfg={tpSlCfg} res={res} p={p} asset={asset} />}
            bodyStyle={{ overflow: "auto" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", padding: 14 }}>
              {field({ label: "Actif", k: "_asset", w: 138 })}
              {field({ label: "TP ×ATR", k: "tpAtr", w: 62 })}
              {field({ label: "SL ×ATR", k: "slAtr", w: 62 })}
              {field({ label: "Max open", k: "maxOpen", w: 62 })}
              {field({ label: "Cadence", k: "cadenceMin", w: 62 })}
              {field({ label: "Equity €", k: "initialEquity", w: 76 })}
              {field({ label: "Risque %", k: "riskPct", w: 62 })}
              <div className="field" style={{ width: 92 }}>
                <div style={{ fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase", color: T.ink3, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap" }}>Admission</div>
                <button type="button" onClick={() => setP({ ...p, admission: !p.admission })} title="Gates heures + tick_low (marché mort / hors séance) — comme le live"
                  style={{ width: "100%", padding: "7px 0", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                    border: `1px solid ${p.admission ? T.green : T.borderHi}`, background: p.admission ? "rgba(63,185,80,0.14)" : T.bg,
                    color: p.admission ? T.green : T.ink3 }}>
                  {p.admission ? "ON" : "OFF"}
                </button>
              </div>
              {/* ⭐🔥 SPREAD — EN AMBRE, PAS EN VERT, ET LA COULEUR EST L'INFORMATION. Les autres
                  bascules disent « une protection est active » (vert = rassurant). Celle-ci dit
                  « les chiffres affichés ne sont plus ceux de la référence » : coût réel facturé,
                  BUY rempli à l'ASK, SELL au BID, SL/TP recalculés depuis le remplissage. Mesuré :
                  81,1 → 78,3 % de WR, R/tr −45 %, maxDD 39,4 → 64,6, six actifs négatifs.
                  ⚠ Un run ON n'est comparable à AUCUN chiffre publié du dépôt. */}
              <div className="field" style={{ width: 92 }}>
                <div style={{ fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase", color: T.ink3, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap" }}>Spread</div>
                <button type="button" onClick={() => setP({ ...p, chargeSpread: !p.chargeSpread })}
                  title="Facture le spread HISTORIQUE de la barre — BUY rempli à l'ASK, SELL au BID, SL/TP recalculés depuis le remplissage (Neo_TradeExecutor). OFF = référence du dépôt (hors spread)."
                  style={{ width: "100%", padding: "7px 0", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                    border: `1px solid ${p.chargeSpread ? T.amber : T.borderHi}`, background: p.chargeSpread ? "rgba(210,153,34,0.16)" : T.bg,
                    color: p.chargeSpread ? T.amber : T.ink3 }}>
                  {p.chargeSpread ? "FACTURÉ" : "OFF"}
                </button>
              </div>
              <div className="field" style={{ width: 92 }}>
                <div style={{ fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase", color: T.ink3, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap" }}>EXH</div>
                <button type="button" onClick={() => setHideExh((v) => !v)} title="Masquer les fires Exhaustion (repli) de l'affichage — focus Strong Bull/Bear. Display-only."
                  style={{ width: "100%", padding: "7px 0", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                    border: `1px solid ${hideExh ? T.borderHi : T.green}`, background: hideExh ? T.bg : "rgba(63,185,80,0.14)",
                    color: hideExh ? T.ink3 : T.green }}>
                  {hideExh ? "MASQUÉ" : "VISIBLE"}
                </button>
              </div>
              <div className="field" style={{ width: 356 }}>
                <div style={{ fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase", color: T.ink3, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap" }}>
                  Plage 2026 <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· filtre visuel</span>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ color: T.ink3, fontSize: 11, flex: "none" }}>du</span>
                  <select value={fromM} onChange={(e) => { setFromM(e.target.value); setFromD(""); }} style={{ flex: 1, minWidth: 0, padding: "8px 4px" }}>
                    <option value="">mois</option>{dateInfo.months.map((m) => <option key={m} value={m}>{MONTHS[m] || m}</option>)}
                  </select>
                  <select value={fromD} onChange={(e) => setFromD(e.target.value)} disabled={!fromM} style={{ flex: 1, minWidth: 0, padding: "8px 4px" }}>
                    <option value="">jr</option>{(dateInfo.daysByMonth[fromM] || []).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span style={{ color: T.ink3, fontSize: 11, flex: "none" }}>au</span>
                  <select value={toM} onChange={(e) => { setToM(e.target.value); setToD(""); }} style={{ flex: 1, minWidth: 0, padding: "8px 4px" }}>
                    <option value="">mois</option>{dateInfo.months.map((m) => <option key={m} value={m}>{MONTHS[m] || m}</option>)}
                  </select>
                  <select value={toD} onChange={(e) => setToD(e.target.value)} disabled={!toM} style={{ flex: 1, minWidth: 0, padding: "8px 4px" }}>
                    <option value="">jr</option>{(dateInfo.daysByMonth[toM] || []).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {rangeActive && <button type="button" onClick={clearRange} title="effacer la plage"
                    style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.ink2, borderRadius: 6, padding: "4px 6px", cursor: "pointer", fontSize: 12, flex: "none" }}>✕</button>}
                </div>
              </div>
              <button className="run" style={{ width: "auto", padding: "8px 24px" }} onClick={run} disabled={loading}>{loading ? "…" : "Run"}</button>
            </div>
          </Panel>

          <Panel title="Résultats" flex="80 1 0" extra={s ? <span style={{ fontSize: 11.5, color: T.ink2 }}>{res.asset}</span> : null}>
            {!s ? <div style={empty}>—</div> : (
              <div style={{ padding: 14 }}>
                {/* Métriques globales (inchangées) */}
                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                  <Tile label="Return" value={`${sv.returnPct >= 0 ? "+" : ""}${N(sv.returnPct)}%`} color={pos(sv.returnPct)} sub={`${sv.netPnL >= 0 ? "+" : ""}${money(sv.netPnL)} €`} />
                  <Tile label="Equity" value={`${money(sv.finalEquity)} €`} color={sv.finalEquity >= sv.initialEquity ? T.green : T.red} sub={`départ ${money(sv.initialEquity)}`} />
                  {/* ⭐🔥 LE WR SE LIT EN ÉCART AU BREAKEVEN, PAS DANS L'ABSOLU (owner 2026-07-31).
                      Avec tp 0,65 / sl 1,95, le point mort est à sl/(tp+sl) = **75,0 %** — un WR de
                      74 % PERD de l'argent. Afficher « 74 % » en couleur neutre laissait lire une
                      quasi-réussite. La tuile porte donc le Δ au point mort, et sa couleur en dépend.
                      ⚠ Le breakeven est CALCULÉ depuis les params du run, jamais écrit en dur : il
                      dépend du couple TP/SL, qui est par actif (`TpSlConfig`) et surchargeable. */}
                  {(() => {
                    const tp = res.params.tpAtr, sl = res.params.slAtr;
                    const be = (tp > 0 && sl > 0) ? 100 * sl / (tp + sl) : null;
                    const d = be == null ? null : sv.winRate - be;
                    return <Tile label="Win rate" value={`${N(sv.winRate)}%`}
                      color={d == null ? undefined : d >= 0 ? T.green : T.red}
                      sub={be == null ? `${sv.wins}W · ${sv.losses}L`
                        : `${d >= 0 ? "+" : ""}${d.toFixed(2)} pt vs be ${be.toFixed(1)}% · ${sv.wins}W·${sv.losses}L`} />;
                  })()}
                  <Tile label="Max DD" value={`−${N(sv.maxDrawdownPct)}%`} color={T.amber} sub={`−${money(sv.maxDrawdown)} €`} />
                  <Tile label="Profit factor" value={N(sv.profitFactor)} color={sv.profitFactor >= 1 ? T.green : T.red} sub={`avg R ${N(sv.avgR)}`} />
                  <Tile label="Trades" value={sv.opened} sub={`${sv.fires} fires·${sv.rejectedCap} cap${hideExh ? " · EXH masqué" : ""}`} />
                  <Tile label="Admission" value={res.params.admission === false ? "OFF" : (s.admBlocked ?? 0)} color={res.params.admission === false ? T.ink3 : T.amber}
                    sub={res.params.admission === false ? "gates désactivés" : `${s.admTick ?? 0} tick·${s.admHours ?? 0} hrs écartés`} />
                  {/* ⭐ LA COHORTE DU CIRCUIT COURT, EN FACE DES AUTRES. ⚠ Rendue `null` quand elle est
                      vide plutôt qu'affichée à zéro : une tuile à 0 sur un actif où l'événement H4 ne
                      s'est jamais produit se lit comme une panne, pas comme une absence. */}
                  {(() => {
                    const sc = sigs.filter((x) => x.shortcut && typeof x.R === "number");
                    if (!sc.length) return null;
                    const w = sc.filter((x) => x.outcome === "WIN").length;
                    const R = sc.reduce((a, x) => a + x.R, 0);
                    return <Tile label="Raccourci" value={sc.length} color={T.violet}
                      sub={`${(100 * w / sc.length).toFixed(1)}% · avg R ${(R / sc.length).toFixed(3)}`} />;
                  })()}
                </div>

                {/* Détail par RÉGIME (couche 2) × thèse × side */}
                <div style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: T.ink3, fontWeight: 600, margin: "18px 0 8px" }}>
                  Détail par régime <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· couche 2 × thèse × côté · chaque ligne a SON WR · WR vs breakeven {be.toFixed(0)}%</span>
                </div>
                <table className="cat">
                  <thead><tr>{["Régime", "Thèse", "Côté", "N", "WR", "Avg R", "Total R"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {/* Le nom du régime n'est écrit qu'une fois par groupe, et un filet sépare les groupes :
                        les quatre lignes d'un même régime se lisent ENSEMBLE — l'écart cont/exh et
                        l'écart BUY/SELL à l'intérieur d'un régime sont le vrai signal.
                        ⚠ Le nom de la THÈSE se répète à chaque ligne, lui : il porte la couleur et
                        c'est la colonne qu'on balaye du regard pour comparer deux WR. */}
                    {profs.map((c, i) => (
                      <tr key={c.regime + c.strategy + c.side}
                        className={(c.n > 0 ? "click" : "") + (profFilter && profFilter.regime === c.regime && profFilter.strategy === c.strategy && profFilter.side === c.side ? " active" : "")}
                        onClick={() => clickProfile(c)}
                        style={i > 0 && profs[i - 1].regime !== c.regime ? { borderTop: `1px solid ${T.border}` } : undefined}>
                        <td style={{ color: T.ink, fontWeight: 600 }}>{i > 0 && profs[i - 1].regime === c.regime ? "" : c.regime}</td>
                        <td><span style={{ color: MODE_COLOR(T, c.strategy), fontWeight: 600 }}>
                          {MODE_LABEL(c.strategy)}</span></td>
                        <td><span style={{ color: c.side === "BUY" ? T.green : T.red, fontWeight: 600 }}>{c.side.toLowerCase()}</span></td>
                        <td style={{ color: c.n ? T.ink : T.ink3 }}>{c.n || "—"}</td>
                        <td style={{ color: wrColor(c.wr), fontWeight: 600 }}>{c.wr == null ? "—" : `${c.wr}%`}</td>
                        <td style={{ color: c.avgR == null ? T.ink3 : pos(c.avgR) }}>{c.avgR == null ? "—" : c.avgR}</td>
                        <td style={{ color: c.n ? pos(c.totalR) : T.ink3, fontWeight: 600 }}>{c.n ? c.totalR : "—"}</td>
                      </tr>
                    ))}
                    <tr className={"click" + (!filter ? " active" : "")} onClick={() => setFilter(null)} style={{ borderTop: `2px solid ${T.border}` }}>
                      <td colSpan={3} style={{ color: T.ink, fontWeight: 700, textTransform: "uppercase", fontSize: 11, letterSpacing: 0.4 }}>Overall</td>
                      <td style={{ color: T.ink, fontWeight: 700 }}>{overall.n}</td>
                      <td style={{ color: wrColor(overall.wr), fontWeight: 700 }}>{overall.wr == null ? "—" : `${overall.wr}%`}</td>
                      <td style={{ color: overall.avgR == null ? T.ink3 : pos(overall.avgR), fontWeight: 700 }}>{overall.avgR == null ? "—" : overall.avgR}</td>
                      {/* ⚠ Plus de `<td colSpan={2} />` : la table est passée de 9 à 7 colonnes
                          (`cont · exh`, `R cont`, `R exh` retirées, `Thèse` ajoutée). Un colSpan
                          résiduel décale la ligne de total sans rien casser visiblement. */}
                      <td style={{ color: pos(overall.totalR), fontWeight: 700 }}>{overall.totalR}</td>
                    </tr>
                  </tbody>
                </table>

                {/* ⚠ BANDEAU DE MODE — il ne s'affiche QUE quand le spread est facturé, parce qu'un
                    run facturé ne se compare à aucun chiffre publié. Sans lui, deux captures d'écran
                    identiques raconteraient deux moteurs différents. */}
                {res.params?.chargeSpread && (
                  <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 7, fontSize: 11.5, lineHeight: 1.6,
                    border: `1px solid ${T.amber}`, background: "rgba(210,153,34,0.10)", color: T.amber }}>
                    <b>SPREAD FACTURÉ</b> — BUY rempli à l'ASK, SELL au BID, SL/TP recalculés depuis le
                    remplissage. Ces chiffres <b>ne sont pas comparables</b> à la référence du dépôt
                    (9 058 tr · 81,1 % · R/tr 0,0832), qui est hors spread.
                  </div>
                )}
                {/* Synthèse (conservée) */}
                <div style={{ fontSize: 11.5, color: T.ink2, marginTop: 14, lineHeight: 1.9 }}>
                  {Object.entries(sv.byType).map(([k, v]) => <span key={k} style={{ marginRight: 12 }}><b style={{ color: T.ink }}>{v}</b> {k.toLowerCase()}</span>)}
                  &nbsp;·&nbsp; total R <b style={{ color: pos(sv.totalR) }}>{N(sv.totalR)}</b>
                  &nbsp;·&nbsp; sortie <b style={{ color: T.green }}>{sv.byReason?.TP ?? 0}</b> TP · <b style={{ color: T.red }}>{sv.byReason?.SL ?? 0}</b> SL · <b style={{ color: T.amber }}>{sv.byReason?.TIMEOUT ?? 0}</b> timeout
                  <br />
                  <b style={{ color: T.green }}>{sv.bySide.BUY}</b> buy · <b style={{ color: T.red }}>{sv.bySide.SELL}</b> sell &nbsp;·&nbsp; {sv.rows} rows · {sv.evals} évals · {res.params.admission === false ? <b style={{ color: T.ink3 }}>admission OFF</b> : <><b style={{ color: T.amber }}>{sv.admBlocked ?? 0}</b> écartés admission (marché mort / hors séance)</>}
                </div>

                {/* ⭐⭐⭐ LES ISSUES PAR RANG (2026-08-05) — LE RANG ② ÉTAIT INVISIBLE PARTOUT.
                    Tous les agrégats de cette page groupaient sur `x.type`, or `PB.type` vaut
                    `CONTINUATION` (héritage TP/SL assumé) : le pullback était donc fondu dans la
                    continuation dans CHAQUE total, alors que c'est le rang le plus rentable des trois.
                    On groupe désormais sur `strategy`, la seule clé qui distingue les trois rangs.
                    ⭐⭐ ET ON MONTRE LE R **PAR ISSUE**, pas seulement le WR : c'est la seule mesure
                    qui départage « le seuil admet des figures qui n'en sont pas » (trop de SL) de
                    « le couple TP/SL sabote un WR pourtant correct » (WR haut, R plat). Le rang ①
                    rend R≈0 pour un WR de 75 % — sans le détail par issue, cette phrase est un
                    mystère ; avec lui, c'est un diagnostic. */}
                {(() => {
                  const RANKS = [["EXH", "① EXHAUSTE", T.amber], ["PB", "② PULLBACK", T.cyan], ["CONT", "③ CONTINUE", T.blue]];
                  const rows = RANKS.map(([k, lab, col]) => {
                    const g = sigs.filter((x) => (x.strategy ?? x.sc?.rank) === k);
                    const w = g.filter((x) => x.outcome === "WIN").length, l = g.filter((x) => x.outcome === "LOSS").length;
                    const R = g.reduce((a, x) => a + (x.R || 0), 0);
                    const iss = (r) => { const q = g.filter((x) => x.reason === r); return { n: q.length, R: q.reduce((a, x) => a + (x.R || 0), 0) }; };
                    return { k, lab, col, n: g.length, wr: (w + l) ? 100 * w / (w + l) : null, R,
                             rt: g.length ? R / g.length : null, tp: iss("TP"), sl: iss("SL"), to: iss("TIMEOUT") };
                  }).filter((r) => r.n > 0);
                  if (!rows.length) return null;
                  const cell = (v, d = 1) => (v == null ? "—" : v.toFixed(d));
                  return (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: T.ink3, marginBottom: 8 }}>
                        Issues par rang · R par sortie
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
                        <thead>
                          <tr style={{ color: T.ink3 }}>
                            {["rang", "n", "WR", "R", "R/tr", "TP", "R(TP)", "SL", "R(SL)", "timeout", "R(TO)"].map((h) => (
                              <th key={h} style={{ textAlign: h === "rang" ? "left" : "right", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.k}>
                              <td style={{ padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: r.col, fontWeight: 600 }}>{r.lab}</td>
                              <td style={{ textAlign: "right", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.ink }}>{r.n}</td>
                              <td style={{ textAlign: "right", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.ink }}>{cell(r.wr)}%</td>
                              <td style={{ textAlign: "right", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: pos(r.R), fontWeight: 600 }}>{cell(r.R)}</td>
                              <td style={{ textAlign: "right", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: pos(r.rt) }}>{r.rt == null ? "—" : r.rt.toFixed(4)}</td>
                              <td style={{ textAlign: "right", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.ink2 }}>{r.tp.n}</td>
                              <td style={{ textAlign: "right", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.green }}>{cell(r.tp.R)}</td>
                              <td style={{ textAlign: "right", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.ink2 }}>{r.sl.n}</td>
                              <td style={{ textAlign: "right", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.red }}>{cell(r.sl.R)}</td>
                              <td style={{ textAlign: "right", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.ink2 }}>{r.to.n}</td>
                              <td style={{ textAlign: "right", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.amber }}>{cell(r.to.R)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ fontSize: 10.5, color: T.ink3, marginTop: 7, lineHeight: 1.6 }}>
                        ⚠ Comptage <b>par tir</b>, pas par épisode — un même figure H1 tire plusieurs fois.
                        Pour un chiffre comparable à la référence du dépôt, passer par <code>_ep_univ_0804.mjs</code> (dédup 15 min).
                      </div>
                    </div>
                  );
                })()}

                {/* ⭐🔥 LE FUNNEL DE DÉCISION (2026-07-31). L'admission et le spacing étaient comptés,
                    la DÉCISION ne l'était pas — on ne savait pas ce que devient une barre où le fade
                    est refusé : WAIT, ou la CONT la ramasse ? La mesure qui a suivi l'instrumentation :
                    100 % des refus EXH sont STRUCTURELS et 100 % finissent en FIRE_CONT, donc la chaîne
                    `wait-exh` — écrite le 29/07 — ne s'armait JAMAIS par cette voie.
                    ⚠ Affiché SEULEMENT si le serveur l'envoie : un run lancé contre une version
                    antérieure n'a pas la clé, et une section vide vaut mieux qu'un zéro inventé. */}
                {s.dec && Object.keys(s.dec).length > 0 && (() => {
                  const issues = Object.entries(s.dec).filter(([k]) => k.startsWith("FIRE_") || k.startsWith("WAIT_"));
                  const refus = Object.entries(s.dec).filter(([k]) => k.startsWith("exh_refuse")).sort((a, b) => b[1] - a[1]);
                  const tot = issues.reduce((a, [, v]) => a + v, 0) || 1;
                  // ⚠ ORDRE DES TESTS SIGNIFIANT : `FIRE_PB` doit être testé AVANT le `FIRE_` générique, sinon il
                  //   tombe dans le vert des « autres tirs » et redevient indiscernable d'un FIRE_CONT.
                  const col = (k) => k.startsWith("FIRE_EXH") ? T.violet : k.startsWith("FIRE_PB") ? T.cyan
                                   : k.startsWith("FIRE_") ? T.green : T.amber;
                  return (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase", color: T.ink3, fontWeight: 600, marginBottom: 7 }}>
                        Décision — {tot} barres évaluées
                      </div>
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: refus.length ? 10 : 0 }}>
                        {issues.sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                          <div key={k} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 9px" }}>
                            <span style={{ color: col(k), fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                            <span style={{ color: T.ink3, fontSize: 10.5 }}> {k.replace("FIRE_", "→ ").replace("WAIT_", "wait ")}</span>
                            <span style={{ color: T.ink3, fontSize: 10 }}> ({(100 * v / tot).toFixed(1)}%)</span>
                          </div>
                        ))}
                      </div>
                      {refus.length > 0 && (
                        <div style={{ fontSize: 11, color: T.ink2, lineHeight: 1.8 }}>
                          <span style={{ color: T.ink3 }}>parcours des barres où le fade est refusé :</span><br />
                          {refus.map(([k, v]) => (
                            <span key={k} style={{ marginRight: 14 }}>
                              <b style={{ color: T.ink }}>{v}</b> {k.replace("exh_refuse", "").replace(" -> ", " → ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </Panel>
        </div>

        {/* Colonne droite 60% : Signaux 70% / Equity 30% */}
        <div style={{ flex: "60 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel title="Signaux" flex="70 1 0"
            extra={res ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  {[["Tous", null], ["Win", "WIN"], ["Loss", "LOSS"]].map(([lbl, val]) => {
                    const on = outcomeFilter === val;
                    const col = val === "WIN" ? T.green : val === "LOSS" ? T.red : T.blue;
                    return <button key={lbl} onClick={() => setOutcomeFilter(val)} style={{ background: on ? col + "22" : "transparent", color: on ? col : T.ink3, border: `1px solid ${on ? col + "66" : T.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer", outline: "none" }}>{lbl}</button>;
                  })}
                  <span style={{ width: 1, height: 16, background: T.border, margin: "0 2px" }} />
                  {[["TP", "TP"], ["SL", "SL"], ["TO", "TIMEOUT"]].map(([lbl, val]) => {
                    const on = outcomeFilter === val;
                    const col = val === "TP" ? T.green : val === "SL" ? T.red : T.amber;
                    return <button key={lbl} onClick={() => setOutcomeFilter(val)} style={{ background: on ? col + "22" : "transparent", color: on ? col : T.ink3, border: `1px solid ${on ? col + "66" : T.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer", outline: "none" }}>{lbl}</button>;
                  })}
                </div>
                <span style={{ fontSize: 11.5, color: T.ink2 }}>
                  {rangeActive && <span style={{ color: T.blue, marginRight: 4 }}>plage {dateFrom || "…"}→{dateTo || "…"} ·</span>}
                  {(filter || outcomeFilter) ? `${shownRows.length} / ${sigs.length}` : sigs.length}{rangeActive ? ` / ${res.signals.length}` : ""} trades
                  {casc.some(Boolean) ? <span className="casclink" onClick={clickCascade} style={{ color: filter?.kind === "cascade" ? T.blue : T.red, cursor: "pointer", marginLeft: 4 }}> · cascade détectée</span> : null}
                </span>
              </div>
            ) : null}
            banner={filter ? (
              <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", background: T.blue + "12", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
                <span style={{ color: T.ink2 }}>Filtre actif :</span>
                <b style={{ color: T.ink }}>{filter.kind === "cascade" ? "cascades (≥3 LOSS consécutifs)" : filter.sig}</b>
                <span style={{ color: T.ink3 }}>({shownRows.length})</span>
                <button onClick={() => setFilter(null)} style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${T.border}`, color: T.ink2, borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>effacer ✕</button>
              </div>
            ) : null}
            bodyStyle={{ overflow: "auto" }}>
            {!res ? <div style={empty}>Lance un backtest</div> : (
              <table>
                <thead><tr>{["Timestamp (MT)", "Side", "Type", "Score / seuil",
                  ...EXPERT_COLS.map((c) => `${c.label} ·${wLabel(c.id)}`),
                  "ADX", "ΔADX", "Entry", "TP", "SL", "Exit", "Outcome", "Reason", "R", "PnL €", "min"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {shownRows.length === 0
                    ? <tr><td colSpan={20} style={{ color: T.ink3, textAlign: "center", padding: 30 }}>aucun trade pour ce filtre</td></tr>
                    : shownRows.map(({ sig, idx, casc: cflag }) => (
                      /* ⭐ LIGNE CLIQUABLE → page Indicateurs SUR CETTE BARRE (owner 2026-07-29).
                         Un trade cesse d'être une ligne de chiffres : on remonte du R jusqu'aux
                         capteurs qui l'ont produit, sans recopier l'horodatage à la main. */
                      <tr key={idx} className={(cflag ? "casc " : "") + "click"}
                        onClick={() => jumpTo(sig)}
                        title="Ouvrir cette barre dans la page Indicateurs">
                        <td className="mono" style={{ color: T.ink2 }}>{sig.tsMT}</td>
                        <td style={{ color: sig.side === "BUY" ? T.green : T.red, fontWeight: 600 }}>{sig.side}</td>
                        {/* ⭐ Le raccourci se NOMME dans la colonne Type. Sans ça, un fade décidé par un
                            événement H4 est indiscernable d'un fade scoré — même `type`, même côté —
                            alors que sa colonne « Score / seuil » est vide POUR UNE RAISON (aucun score
                            n'a été calculé). Sans le nom, cette case vide se lit comme un capteur cassé. */}
                        <td style={{ color: sig.shortcut ? T.violet : T.ink2, fontWeight: sig.shortcut ? 600 : 400 }}
                            title={sig.shortcut ?? undefined}>
                          {sig.type}{sig.shortcut ? " ·sc" : ""}</td>
                        {/* ⭐ SCORE vs SEUIL (owner 2026-07-28) — la MARGE, pas la valeur seule. Un tir à
                            4,1 sur un seuil de 4 et un tir à 9 ne se lisent pas pareil, et jusqu'ici
                            rien à l'écran ne les distinguait. Teinte = distance au seuil.
                            🔴 SIGNÉ DEPUIS LE 29/07 — la valeur était affichée en ABSOLU. Sur un
                            `SELL EXHAUSTION` à −4,35 la colonne montrait `4.3`, soit un score
                            apparemment POSITIF à côté de cinq globals d'experts négatifs (BRENT_OIL
                            08/07 12:18, relevé owner). Le côté était bien dans la colonne voisine,
                            mais deux conventions de signe cohabitaient sur la même ligne : c'est
                            exactement le genre d'écart qui fait douter du moteur alors qu'il a raison. */}
                        <td className="mono" style={{ fontWeight: 600, color: scoreColor(sig) }}>
                          {sig.sc ? <>{(sig.score > 0 ? "+" : "") + (sig.score / 10).toFixed(1)}<span style={{ color: T.ink3, fontWeight: 400 }}> / {sig.sc.min}</span></> : "—"}
                        </td>
                        {/* Le détail par expert, thèse RETENUE. `—` = l'expert s'est TU (null), ce qui
                            n'est pas 0 : il a été retiré de la moyenne, pas compté comme neutre. */}
                        {EXPERT_COLS.map(({ id }) => {
                          const v = sig.sc?.exp?.[id];
                          const th = THESIS_OF[sig.strategy] ?? sig.strategy;
                          const w = SCORING_WEIGHT[th]?.[id];
                          return <td key={id} className="mono"
                            title={w == null ? `cet expert n'existe pas dans le barème ${th}`
                                 : v == null ? "l'expert s'est TU (null) — retiré de la moyenne"
                                 : `${v} × ${w} (poids ${th})`}
                            style={{ color: v == null ? T.ink3 : pos(v), opacity: v == null ? 0.5 : 1 }}>{v == null ? "—" : v}</td>;
                        })}
                        {/* ADX au moment du fire — diagnostic. ΔADX teinté par SIGNE (c'est lui qui décide l'exh). */}
                        <td className="mono" style={{ color: sig.adx == null ? T.ink3 : T.ink2 }}>{sig.adx == null ? "—" : sig.adx.toFixed(1)}</td>
                        <td className="mono" style={{ color: sig.dAdx == null ? T.ink3 : sig.dAdx > 0 ? T.green : T.red, opacity: 0.85 }}>{sig.dAdx == null ? "—" : (sig.dAdx > 0 ? "+" : "") + sig.dAdx.toFixed(1)}</td>
                        <td className="mono">{sig.entry}</td>
                        <td className="mono" style={{ color: T.green, opacity: 0.85 }}>{sig.tp}</td>
                        <td className="mono" style={{ color: T.red, opacity: 0.85 }}>{sig.sl}</td>
                        <td className="mono" style={{ color: T.ink2 }}>{sig.exit}</td>
                        <td><span style={{ fontWeight: 600, fontSize: 10.5, padding: "2px 7px", borderRadius: 5, background: (sig.outcome === "WIN" ? T.green : T.red) + "1e", color: sig.outcome === "WIN" ? T.green : T.red }}>{sig.outcome}</span></td>
                        <td style={{ color: sig.reason === "TP" ? T.green : sig.reason === "SL" ? T.red : T.amber, fontWeight: 600, fontSize: 11 }}>{sig.reason}</td>
                        <td style={{ color: pos(sig.R) }}>{sig.R}</td>
                        <td style={{ color: pos(sig.pnl ?? 0), fontWeight: 600 }}>{(sig.pnl ?? 0) >= 0 ? "+" : ""}{sig.pnl ?? "—"}</td>
                        <td style={{ color: T.ink3 }}>{sig.barsHeld}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Equity curve" flex="30 1 0" bodyStyle={{ overflow: "hidden", padding: "8px 8px 4px 0" }}>
            {curveData.length < 2 ? <div style={empty}>—</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curveData} margin={{ top: 8, right: 16, bottom: 4, left: 6 }}>
                  <defs>
                    <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={accent} stopOpacity={0.015} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={T.border} vertical={false} />
                  <XAxis dataKey="i" tick={{ fill: T.ink3, fontSize: 10 }} tickLine={false} axisLine={{ stroke: T.border }} minTickGap={44} />
                  <YAxis domain={domain} tick={{ fill: T.ink3, fontSize: 10 }} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => money(v)} />
                  <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.borderHi}`, borderRadius: 8, color: T.ink, fontSize: 12 }} labelStyle={{ color: T.ink3 }} cursor={{ stroke: T.borderHi, strokeDasharray: "3 3" }} labelFormatter={(v) => `trade #${v}`} formatter={(v) => [`${money(v)} €`, "equity"]} />
                  <ReferenceLine y={s.initialEquity} stroke={T.ink3} strokeDasharray="4 4" strokeOpacity={0.6} />
                  <Area type="monotone" dataKey="equity" stroke={accent} strokeWidth={2} fill="url(#eqfill)" isAnimationActive={false} activeDot={{ r: 4, stroke: T.bg, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>
      </div>
      )}
    </div>
  );
}
