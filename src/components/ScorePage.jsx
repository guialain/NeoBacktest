// ScorePage.jsx — LE SCORE D'UN TIR, COMPOSANTE PAR COMPOSANTE (owner 2026-08-11).
// --------------------------------------------------------------------------------------------
// ⭐⭐⭐ CETTE PAGE NE CALCULE RIEN. Elle lit `sig.sc`, c'est-à-dire la trace que `decideFromScoring`
//   a produite SUR CETTE BARRE. Même règle que `ScoringTable`, et pour le même motif : trois
//   divergences page↔moteur en une journée sont sorties d'une table qui redérivait les entrées.
//   **Un chiffre qu'on n'a pas calculé ne peut pas diverger.**
//
// ⭐⭐ CE QU'ELLE RÉPARE : jusqu'ici la conviction d'un tir était UN NOMBRE. On voyait `−3` sans
//   pouvoir dire d'où il venait, donc on ne pouvait ni contester une case ni repérer une entrée
//   muette. La décomposition existait dans `sc.boxes.pb.parts` — elle n'était affichée NULLE PART.
//
// 🔴🔥 LE CONTRÔLE DE SOMME EST LE CŒUR DE LA PAGE, PAS UNE DÉCORATION. Si `z + k ≠ conviction`, la
//   page le DIT en rouge au lieu d'afficher joliment deux nombres qui ne se rejoignent pas. Une
//   décomposition qui ne se referme pas est un bug du moteur ou de la trace — jamais un détail
//   d'affichage. ⭐ C'est le seul endroit du dépôt où les deux peuvent être confrontés à l'œil.
//
// ⭐⭐⭐ LES DEUX RANGS SONT DÉCOMPOSÉS, ET C'EST LE RANG QUI A TIRÉ QUI VIENT EN PREMIER
//   (owner 2026-08-12). `sc.boxes.exh` porte `parts`/`familles`/`muets` depuis le 11/08 au soir, donc
//   les deux cartes existent — mais elles étaient rendues dans un ordre FIXE, PB puis EXH. Sur un tir
//   ②, la carte du bas s'intitulait « barème EXH (rang ①) » et se lisait comme LA décomposition du
//   tir. ⭐⭐ **Le titre était juste, la PLACE était fausse** — variante d'écran du motif que ce dépôt
//   paie le plus cher : une valeur légitime lue pour ce qu'elle n'est pas, donc rien ne peut lever.
//   ⇒ ordre piloté par `sc.rank`, et CHAQUE carte porte sa marque (« le barème qui a décidé » /
//   « n'a pas décidé ce tir — pour contexte »). L'autre rang n'est jamais retiré : sur un tir ②, la
//   conviction du rang ① est exactement ce qui dit POURQUOI il a cédé.
//
// ⚠⚠ CE QU'ON N'AFFICHE TOUJOURS PAS, ET QU'ON N'INVENTE PAS : `sc.exp` (`di/gap/kd/rsi`). Ces
//   quatre-là sont des experts de TRACE SEULE depuis le 07/08, ils ne composent la conviction
//   d'AUCUN rang. Les montrer comme « les composantes » serait le mirage d'origine.
//
// ⚠ LES SEUILS VIENNENT DE `sc.min` / `sc.minPres`, JAMAIS D'UN IMPORT. `MIN_PB` & co sont lus par
//   `_envNum` via `process.env`, absent du navigateur ⇒ tout import client retombe sur le défaut
//   (`1000`) pendant que le serveur tourne avec autre chose. `sc.min` est écrit PAR LE MOTEUR au
//   moment de la décision : c'est le seul seuil qui a réellement servi.
import { T } from "./ui.jsx";
// ⭐ Les AMPLITUDES sont de vraies constantes de module (pas de lecture d'env) : elles traversent le
//   navigateur sans mentir. Elles disent la PORTÉE de chaque entrée — donc ce que « +5 » vaut.
import { PB_GAP_AMPLITUDE, PB_K_AMPLITUDE, PB_RSI_AMPLITUDE } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/pbScoringV1.js";
// ⚠ AMPLITUDES IMPORTÉES, JAMAIS RECOPIÉES : elles bougent (celle de ⑷ est passée à `[−3 · +10]` le
//   12/08 au soir). Une constante recopiée ici afficherait une jauge fausse sans que rien ne lève.
// 🔄 19/08 — `CONT_KH1_FACTEUR_MAX` ET `CONT_ECHELLE` EN PLUS. Depuis le 16/08 `kH1` n'est plus une
//   note mais un FACTEUR `{0·1·2}` appliqué à `kH4` ⇒ la part `kH4` porte le PRODUIT (`±20`), et le
//   nombre de familles vit dans `CONT_ECHELLE`, que le moteur CONTRÔLE au chargement.
import { CONT_RSI_AMPLITUDE, CONT_DI_AMPLITUDE, CONT_KH4_AMPLITUDE, CONT_GAPKD_AMPLITUDE,
         CONT_KH1_FACTEUR_MAX, CONT_ECHELLE,
         // ⭐ 19/08 — LES NOMS DES DEUX DERNIÈRES FAMILLES SUIVENT LE LEVIER (`gapDz`/`gapKd` ·
         //   `zdzH4`/`gapKdH4`) : une clé écrite en dur ici s'afficherait « muette » à CHAQUE barre.
         CONT_GAPDZ_FAMILLE, CONT_ZDZ_FAMILLE }
  from "../../../Matrix-Revolution/src/components/robot/engines/scoring/contScoringV1.js";
// ⭐ LA LISTE DES FAMILLES DU RANG ① VIENT DE LA TABLE QUI DÉCIDE — elle a bougé trois fois en six
//   jours (`gapH4` le 15/08, `kdTurn` ajoutée PUIS retirée le 18/08). Un compte à la main ici ment.
// ⭐ `EXH_FAMILLE_MODE` AJOUTÉ LE 19/08 : il rend l'échelle DÉRIVABLE (voir `_echelleExh`).
import { EXH_FAMILLES_POIDS, EXH_FAMILLES, EXH_FAMILLE_MODE }
  from "../../../Matrix-Revolution/src/components/robot/engines/scoring/exhScoringV1.js";

// ══ 🔄🔴🔥⭐⭐⭐ 19/08 (soir) — L'ÉCHELLE DU RANG ① N'EST PLUS ÉCRITE, ELLE EST DÉRIVÉE ══════════
// ⚠⚠ CETTE CARTE ANNONÇAIT `[0 · +60]` EN DUR, ET C'EST FAUX DEPUIS CE SOIR : `gapM15` est sortie
//   du barème, la famille `gap` retombe de `±30` à `±20`, donc l'échelle est **`[0 · +50]`**.
//   C'est la QUATRIÈME fois en six jours que ce littéral se périme (`[0·40]` → `[0·50]` → `[0·60]`
//   → `[0·50]`) — et à chaque fois il a menti quelques heures avant qu'on s'en aperçoive.
// ⭐⭐⭐ LA CAUSE ÉTAIT NOMMÉE JUSTE ICI : « l'ÉCHELLE reste littérale : `FAMILLE_MODE` n'est pas
//   exporté par le moteur, donc `gap` = ±30 ne se dérive pas d'ici sans le recopier ». **Le moteur
//   l'exporte depuis le 19/08** (`EXH_FAMILLE_MODE`) ⇒ l'excuse est levée, le littéral part.
//   ⚠ Un commentaire qui explique POURQUOI un chiffre est écrit à la main est une DETTE, pas une
//   justification : le jour où la cause disparaît, personne ne revient lire le commentaire.
const _echelleExh = (reach) => Object.entries(EXH_FAMILLES_POIDS).reduce((tot, [nom, poids]) => {
  const ids = Object.keys(poids);
  const num = ids.reduce((a, id) => a + poids[id] * (reach[id] ?? 0), 0);
  // ⚠ `somme` ADDITIONNE les horloges (seul cas du dépôt, la famille `gap`), `moyenne` PONDÈRE —
  //   donc ajouter une horloge à une famille en moyenne ne change PAS l'échelle. C'est le MODE qui
  //   décide, pas le nombre d'entrées : le confondre est ce qui a produit les trois erreurs ci-dessus.
  const den = ids.reduce((a, id) => a + poids[id], 0);
  return tot + (EXH_FAMILLE_MODE[nom] === "somme" ? num : den ? num / den : 0);
}, 0);


const f2 = (v) => (v == null || !Number.isFinite(v) ? "—" : (v > 0 ? "+" : "") + Number(v).toFixed(2));
const fN = (v) => (v == null || !Number.isFinite(v) ? "—" : (v > 0 ? "+" : "") + v);
const col = (v) => (v == null ? T.ink3 : v > 0 ? T.green : v < 0 ? T.red : T.ink2);

/** Pastille de note : l'intensité est |note| / AMPLITUDE DE L'ENTRÉE — aucune borne écrite ici, sinon
 *  elle se périmerait le jour où une amplitude change (le barème PB est passé de 3 à 2 entrées). */
function Note({ v, reach }) {
  if (v == null) return <span style={{ color: T.ink3, fontSize: 11.5, fontStyle: "italic" }}>muet</span>;
  const w = Math.min(1, Math.abs(v) / (Math.abs(reach) || 1));
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <b style={{ color: col(v), fontVariantNumeric: "tabular-nums", minWidth: 30, textAlign: "right" }}>{fN(v)}</b>
      <span style={{ width: 46, height: 5, borderRadius: 3, background: T.border, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${w * 100}%`, background: col(v) }} />
      </span>
    </span>
  );
}

const Card = ({ titre, sous, children, accent }) => (
  <div style={{ border: `1px solid ${accent || T.border}`, borderRadius: 9, padding: "12px 14px", background: T.surface, marginBottom: 14 }}>
    <div style={{ fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase", color: accent || T.ink3, fontWeight: 700, marginBottom: sous ? 2 : 9 }}>{titre}</div>
    {sous && <div style={{ fontSize: 11, color: T.ink3, marginBottom: 9 }}>{sous}</div>}
    {children}
  </div>
);

const TD = { padding: "5px 10px 5px 0", fontSize: 12.5, color: T.ink2, verticalAlign: "middle" };
const TH = { ...TD, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: T.ink3, fontWeight: 700, borderBottom: `1px solid ${T.border}`, paddingBottom: 5 };

export default function ScorePage({ sig, onBack }) {
  if (!sig) return (
    <div style={{ color: T.ink3, fontSize: 13, padding: 40, textAlign: "center" }}>
      Aucun tir sélectionné — ouvrir la page <b style={{ color: T.ink2 }}>Signaux</b> et cliquer une ligne.
    </div>
  );
  const sc = sig.sc ?? {};
  const boxes = sc.boxes ?? {};
  const rang = sc.rank ?? sig.strategy;
  const BOITE = { EXH: "① EXHAUSTE", PB: "② PULLBACK", CONT: "③ CONTINUE" };
  const boite = boxes[String(rang).toLowerCase()] ?? null;

  // ⭐⭐⭐ LES DEUX ENTRÉES DU BARÈME PB, ET SEULEMENT ELLES. `domi` est présent dans `parts` mais
  //   N'EST PLUS UNE NOTE depuis le 11/08 (l'ADX est sorti du barème) — il est affiché plus bas,
  //   dans la trace, PAS dans la somme. Le mettre ici referait entrer par l'œil ce qu'on a retiré
  //   du code.
  const P = boxes.pb?.parts ?? null;
  const ENTREES_PB = P ? [
    // 🔄 11/08 SOIR — l'entrée ⑴ est passée de `z` à `gapAtr` (table 12 × 7 dictée par l'owner).
    // ⚠ La LIGNE est un COUPLE `installation × tension`, pas un niveau ordonné : on affiche
    //   `ligneGap` telle que le moteur l'a lue, jamais recomposée ici — une seconde recomposition
    //   dans la vue finirait par diverger du moteur sans que rien ne le dise.
    { cle: "gap", titre: "⑴ `gapAtr` H1", note: P.gap, reach: PB_GAP_AMPLITUDE,
      mesure: `gap clôturé — ${P.ligneGap ?? "—"}`, case_: `${P.ligneGap ?? "—"} × ${P.colGap ?? "—"}`,
      detail: "niveau + installation CLÔTURE · vitesse LIVE (sens brut)" },
    { cle: "k", titre: "⑵ `%K` H1", note: P.k, reach: PB_K_AMPLITUDE,
      mesure: `%K clôturé (orienté) ${P.kOr == null ? "—" : Number(P.kOr).toFixed(2)}`, case_: `${P.colK ?? "—"}`,
      detail: "ΔK live replié en 3 colonnes" },
    // 🔄 12/08 — ⑶ `RSI`, DEUX HORLOGES PONDÉRÉES `2·H1 + 1·M15` sur la MÊME grille.
    // ⚠ La colonne « mesure » montre les DEUX notes d'horloge, pas seulement leur moyenne : sans
    //   elles on lit un nombre qu'on ne peut pas décomposer, et on ne sait pas laquelle parle — or
    //   c'est la question ouverte sur cette entrée (le H1 a 83 % de sa population dans une ligne).
    { cle: "rsi", titre: "⑶ `RSI` zone × rang/3", note: P.rsi, reach: PB_RSI_AMPLITUDE,
      mesure: `H1 ${P.rsiH1 ?? "—"} (×2) · M15 ${P.rsiM15 ?? "—"} (×1)`,
      case_: `(2·H1 + M15) / 3`,
      detail: "zone à la CLÔTURE · rang du live dans ses 3 barres" },
  ] : [];

  // 🔴🔥 LE CONTRÔLE : la somme des notes PRÉSENTES doit valoir la conviction de la boîte. `null` ne
  //   contribue pas (entrée MUETTE) — il ne vaut PAS `0`, qui serait le verdict « relais ».
  const presentes = ENTREES_PB.filter((e) => e.note != null);
  const somme = presentes.length ? presentes.reduce((a, e) => a + e.note, 0) : null;
  const convPb = boxes.pb?.conviction ?? null;
  const ecart = somme != null && convPb != null ? +(somme - convPb).toFixed(6) : null;
  const sommeOk = ecart != null && Math.abs(ecart) < 1e-9;

  // ⛔ `Ligne` SUPPRIMÉ LE 13/08 avec la carte « Autour du score », son unique lecteur.
  //   ⭐ Supprimé et non gardé « au cas où » : un helper de rendu orphelin ressemble encore à
  //   l'endroit où l'on va écrire, et c'est comme ça qu'une carte morte se fait ressusciter par
  //   inadvertance. Le fichier applique déjà cette règle à ses tables côté moteur.

  // ⭐⭐⭐ QUEL BARÈME A DÉCIDÉ CE TIR (owner 2026-08-12). Les deux cartes s'affichaient dans un ordre
  //   FIXE — PB puis EXH — quel que soit le rang qui avait tiré. Sur un tir ②, la dernière carte lue
  //   s'intitulait donc « Décomposition — barème EXH (rang ①) », et c'est elle qu'on retenait comme
  //   « la » décomposition du tir. Le titre était juste, la PLACE était fausse.
  // ⭐⭐ ON NE SUPPRIME PAS LA CARTE DE L'AUTRE RANG, ON LA DÉCLASSE. Sur un tir ②, la conviction du
  //   rang ① est ce qui explique POURQUOI il a cédé — c'est la moitié de la lecture d'un pullback,
  //   et la retirer rendrait la page muette sur la cascade qu'elle est censée montrer.
  //   ⇒ le rang qui a tiré passe EN PREMIER et se dit « LE BARÈME QUI A DÉCIDÉ » ; l'autre suit,
  //   marqué « n'a pas décidé ce tir ».
  const RANG = String(rang ?? "").toUpperCase();
  const estPrincipal = (k) => RANG === k;
  const marque = (k) => (estPrincipal(k)
    ? { txt: "◀ LE BARÈME QUI A DÉCIDÉ CE TIR", col: T.blue }
    : { txt: "n'a pas décidé ce tir — pour contexte", col: T.ink3 });
  const Marque = ({ k }) => {
    const m = marque(k);
    return <span style={{ marginLeft: 8, fontSize: 10, letterSpacing: 0.3, fontWeight: 700, color: m.col }}>{m.txt}</span>;
  };

  // ── CARTE ② PULLBACK — le barème du rang ② ────────────────────────────────────────────────
  const blocPB = P ? (
    <Card titre="Décomposition — barème PB (rang ②)" accent={sommeOk ? T.border : T.red}
      sous={<>Trois entrées depuis le 12/08 (le <code>RSI</code> s'ajoute) ⇒ échelle [−{PB_GAP_AMPLITUDE + PB_K_AMPLITUDE + PB_RSI_AMPLITUDE} · +{PB_GAP_AMPLITUDE + PB_K_AMPLITUDE + PB_RSI_AMPLITUDE}] — ⚠ <code>MIN_PB</code> est à RE-BALAYER.<Marque k="PB" /></>}>
      {P.appartient === false && (
        <div style={{ marginBottom: 10, padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.amber}`, background: "rgba(210,153,34,0.10)", color: T.amber, fontSize: 12 }}>
          ⚠ <b>Critère d'appartenance NON satisfait</b> — repli {P.repli == null ? "—" : (100 * P.repli).toFixed(1) + " %"} hors bande.
          La barre n'est pas un pullback : le barème ne l'évalue pas, la conviction est `null`.
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={TH}>entrée</th><th style={TH}>mesure</th><th style={TH}>case</th><th style={TH}>note</th></tr></thead>
        <tbody>
          {ENTREES_PB.map((e) => (
            <tr key={e.cle}>
              <td style={{ ...TD, color: T.ink, fontWeight: 600, whiteSpace: "nowrap" }}>{e.titre}</td>
              <td style={{ ...TD, fontVariantNumeric: "tabular-nums" }}>{e.mesure}
                <div style={{ fontSize: 11, color: T.ink3 }}>{e.detail}</div></td>
              <td style={{ ...TD, color: T.ink2, fontFamily: "monospace", fontSize: 11.5 }}>{e.case_}</td>
              <td style={TD}><Note v={e.note} reach={e.reach} /></td>
            </tr>
          ))}
          <tr>
            <td style={{ ...TD, borderTop: `1px solid ${T.borderHi}`, color: T.ink, fontWeight: 700 }}>Σ des présentes</td>
            <td style={{ ...TD, borderTop: `1px solid ${T.borderHi}`, color: T.ink3, fontSize: 11.5 }}>
              {presentes.length} entrée{presentes.length > 1 ? "s" : ""} sur {ENTREES_PB.length}
              {presentes.length < ENTREES_PB.length && " — une entrée MUETTE ne contribue pas (elle ne vaut pas 0)"}
            </td>
            <td style={{ ...TD, borderTop: `1px solid ${T.borderHi}` }} />
            <td style={{ ...TD, borderTop: `1px solid ${T.borderHi}` }}>
              <b style={{ color: col(somme), fontSize: 15 }}>{somme == null ? "—" : fN(somme)}</b>
            </td>
          </tr>
        </tbody>
      </table>
      {/* 🔴🔥 LE CONTRÔLE DE SOMME — voir l'en-tête du fichier. Il ne s'affiche pas « en vert
          discret » : s'il échoue il occupe l'écran, parce qu'une décomposition qui ne se referme
          pas invalide TOUT ce qui est au-dessus. */}
      <div style={{ marginTop: 10, padding: "7px 10px", borderRadius: 6, fontSize: 12,
        border: `1px solid ${sommeOk ? T.border : T.red}`, background: sommeOk ? "transparent" : "rgba(220,80,80,0.12)",
        color: sommeOk ? T.ink3 : T.red }}>
        {ecart == null
          ? <>Contrôle impossible — la somme ou la conviction est absente. <b>Ce n'est pas « tout va bien »</b>, c'est un contrôle qui ne tourne pas.</>
          : sommeOk
            ? <>✅ Σ des notes = conviction de la boîte ({fN(convPb)}) — la décomposition se referme.</>
            : <>🔴 <b>ÉCART {f2(ecart)}</b> entre Σ des notes ({fN(somme)}) et la conviction ({fN(convPb)}). La trace et le barème ne disent pas la même chose.</>}
      </div>
      {/* ⭐ La TRACE, hors somme — `domi` a survécu à la sortie de l'ADX du barème le 11/08. */}
      <div style={{ marginTop: 10, fontSize: 11.5, color: T.ink3 }}>
        <b style={{ color: T.ink2 }}>Trace, hors barème :</b> dominance ADX <b style={{ color: T.ink2 }}>{P.domi ?? "—"}</b>
        {" · "}repli <b style={{ color: T.ink2 }}>{P.repli == null ? "—" : (100 * P.repli).toFixed(1) + " %"}</b>
        {" · "}appartient <b style={{ color: P.appartient ? T.green : T.red }}>{String(P.appartient)}</b>
        <div style={{ marginTop: 3 }}>⚠ `domi` n'est PLUS une note depuis le 11/08 — il ne compte pas dans la somme, il est ici pour rouvrir la question un jour.</div>
      </div>
    </Card>
  ) : (
    // ⚠ LE MANQUE SE DIT MÊME QUAND LE PB N'A PAS TIRÉ : une carte absente se lit « il n'y avait
    //   rien à dire », une carte qui dit `parts` absent se lit « la trace ne le porte pas ».
    <Card titre="Décomposition — barème PB (rang ②)" accent={T.amber}
      sous={<><Marque k="PB" /></>}>
      <span style={{ color: T.amber, fontSize: 12.5 }}>⚠ `sc.boxes.pb.parts` absent de ce signal — rien à décomposer sans inventer.</span>
    </Card>
  );

  // ── CARTE ① EXHAUSTE — branchée le 11/08 ──────────────────────────────────────────────────
  // ⭐⭐⭐ CE BLOC REMPLACE UN AVEU. La page disait « seule la boîte ② est décomposable » parce
  //   que `sc.boxes.exh` ne portait que sa conviction. `scoringDecision` garde désormais le
  //   résultat COMPLET de `exhScoreV1` — le coût était nul, il construisait déjà ses `parts`.
  // 🔴🔥 ET LA CONVENTION DE SIGNE N'EST PAS LA MÊME QUE POUR LE PB, C'EST TOUT LE PIÈGE :
  //   les parts du barème ① sont SIGNÉES (`SELL = −BUY`), donc `Σ parts = total` et
  //   `conviction = orient(total, side)` — sur un SELL, sommer les notes donne l'OPPOSÉ de la
  //   conviction. Afficher la somme brute à côté de la conviction ferait crier un écart qui
  //   n'existe pas. On convertit ICI, et on le dit à l'écran.
  const blocEXH = (() => {
    const PE = boxes.exh?.parts ?? null;
    if (!PE) return null;
    const sideE = boxes.exh?.side;
    // 🔴🔥 DEPUIS LE 11/08 LA SOMME PASSE PAR LES **FAMILLES**, PAS PAR LES HUIT NOTES. Les
    //   entrees sont regroupees (`stoch H1` · `RSI` · `ADX` · `gap` · `stoch H4`), chaque famille
    //   rend la MOYENNE des siennes (entree absente = `0`), et le total somme les cinq.
    // ⚠⚠ CONTROLER `Σ parts` ICI AURAIT CRIE UN ECART A CHAQUE TIR — un rouge permanent sur une
    //   page dont le rouge est censee etre l'alarme. `parts` reste affiche parce que c'est le
    //   DIAGNOSTIC ; ce qui se somme, ce sont les familles.
    const FAM = boxes.exh?.familles ?? null;
    const notes = FAM ? Object.entries(FAM) : Object.entries(PE).filter(([, v]) => Number.isFinite(v));
    const sommeE = notes.length ? notes.reduce((a, [, v]) => a + v, 0) : null;
    // ⚠ `orient` : la somme des parts est SIGNÉE, la conviction est une QUALITÉ.
    const sommeOrientee = sommeE == null ? null : (sideE === "SELL" ? -sommeE : sommeE);
    const convE = boxes.exh?.conviction ?? null;
    const ecartE = sommeOrientee != null && convE != null ? +(sommeOrientee - convE).toFixed(6) : null;
    const okE = ecartE != null && Math.abs(ecartE) < 1e-9;
    // 🔄 12/08 — ⑺ `dRsi` (Δ RSI H1 bandé) REMPLACÉ par `rsiTrendH1` (zone × rang-sur-3).
    //   ⚠ La clé change EN MÊME TEMPS que le moteur : une étiquette laissée sur l'ancien nom
    //   afficherait « muette » sur toutes les barres — un capteur vivant lu comme un capteur mort.
    // 🔄 12/08 — `kH1` RETIRÉ (muet 37,06 % du temps) et l'entrée ⑴ refaite en `côté du prix ×
    //   niveau × K/D`. ⚠ LA NUMÉROTATION SE DÉCALE : ce qui était ⑸ devient ⑷. Une carte laissée
    //   avec l'ancien numéro n'aurait rien cassé — elle aurait juste MENTI, et c'est le motif que ce
    //   fichier a déjà payé le 11/08 en nommant encore `z` l'entrée ⑴.
    // 🔄 12/08 SOIR — `kdH1` RETIRÉ à son tour. La famille `stochH1` DISPARAÎT (ses deux membres
    //   sont partis le même jour) ⇒ l'échelle du rang ① passe de [−46,5 · +46,5] à [−36,5 · +36,5].
    // 🔄🔴🔥 13/08 — DEUX CHANGEMENTS MOTEUR QUI TOMBENT SUR CETTE CARTE, et c'est exactement le
    //   « retirer/ajouter une entrée = 4 endroits, dont les 2 cartes d'étiquettes UI » :
    //     ① PASSE **SANS PÉNALITÉ** : les quatre tables sont clippées à `0` du côté qui les
    //        contredit ⇒ une note ne peut plus pousser CONTRE le côté qu'elle sert. Conséquence
    //        directe pour cette carte : **le SIGNE d'une note dit désormais le CÔTÉ** (neg = SELL,
    //        pos = BUY), sans exception — un contrôle de chargement le garantit côté moteur.
    //     ② `di` **FUSIONNÉE dans `adx`** : son axe de niveau (camp fadé) est inerte sur la
    //        population du rang ① (le routeur a déjà trié les barres où un camp domine), et les deux
    //        entrées partageaient déjà l'axe dynamique. L'entrée `di` N'EXISTE PLUS ici ⇒ la laisser
    //        dans `LIB` l'aurait affichée « muette » sur TOUTES les barres : un capteur SUPPRIMÉ lu
    //        comme un capteur mort, la faute jumelle de celle payée le 12/08 sur `dRsi`.
    //   ⚠ LA NUMÉROTATION SE DÉCALE ENCORE (⑶⑷⑸⑹ → ⑵⑶⑷⑸). Une carte laissée sur l'ancien numéro
    //     n'aurait rien cassé — elle aurait juste MENTI.
    // ⚠ `adx` PASSE DE `5` À `10` DANS `REACH` : la table fusionnée porte l'amplitude PLEINE de la
    //   famille (`−10` introduit le 13/08). Laisser `5` aurait dessiné une barre à 200 % de sa portée.
    // ⚠ Échelle du rang ① : `[0 · +40]` en qualité (4 familles × ±10), ex `[−36,5 · +36,5]`.
    //   Les seuils, eux, restent lus dans `sc.min`/`sc.minPres` — jamais recopiés ici.
    // 🔄 14/08 — `gapM15` AJOUTÉE ICI AUSSI : elle décide depuis le 13/08 et cette carte ne l'a
    //   jamais affichée (absente de `REACH` **et** de `LIB`). « Clé ajoutée = JAMAIS affichée » —
    //   le bug est indépendant de la bascule H1, il est corrigé au passage.
    // 🔄 19/08 — `gapH4` MANQUAIT (moteur : 15/08). Troisième fois que cette carte rate un ajout
    //   d'entrée, et toujours le même symptôme : une entrée VIVE qui ne s'affiche NULLE PART, donc
    //   une décomposition qui se referme quand même (le contrôle porte sur les FAMILLES) et un
    //   lecteur qui croit voir tout le barème. ⚠ La famille `gap` a DEUX horloges depuis le 19/08 (soir) — `gapM15` est sortie de la somme.
    // 🔄 19/08 SOIR — `gapM15` SORT DU BARÈME mais RESTE CALCULÉE ET TRACÉE : elle garde sa
    //   ligne (la retirer ferait disparaître une note que la trace contient encore, et on
    //   lirait « capteur muet ») mais l'étiquette DOIT dire qu'elle ne compte plus. Même cas
    //   que `rsiM15` au rang ③ — les deux seuls du dépôt où une note VISIBLE est HORS SOMME.
    const REACH = { gap: 10, gapM15: 10, gapH4: 10, adx: 10, kH1: 10, rsiM15: 10, rsiTrendH1: 10 };
    const LIB = { gap: "⑴ `gap` côté prix × niveau × `K−D`",
                  adx: "⑵ `ADX` × dyn. DI  (`di` fusionnée le 13/08)",
                  gapM15: "⑴bis `gap` M15 · ⚠ TRACÉE, HORS SOMME depuis le 19/08 (soir)",
                  gapH4: "⑴ter `gap` H4 · même grille — SOMMÉE aussi (owner 15/08)",
                  kH1: "⑶ `%K` H1 × ΔK  (ex H4, bascule owner 14/08)",
                  // ⚠ ⑷ et ⑸ lisent la MÊME grille sur deux horloges — l'étiquette doit le dire,
                  //   sinon deux notes issues d'une seule table se lisent comme deux barèmes.
                  rsiM15: "⑷ `RSI` M15 live × rang/3",
                  rsiTrendH1: "⑸ `RSI` H1 live × rang/3" };
    const muetsE = boxes.exh?.muets ?? [];
    return (
      <Card titre="Décomposition — barème EXH (rang ①)" accent={okE ? T.border : T.red}
        sous={<>{Object.values(EXH_FAMILLES_POIDS).reduce((a, f) => a + Object.keys(f).length, 0)} entrées en <b>{EXH_FAMILLES.length} familles</b> ({EXH_FAMILLES.join(" · ")}) · notes <b>SIGNÉES</b> — et depuis la passe <b>sans pénalité</b> du 13/08 le <b>SIGNE dit le CÔTÉ</b> (neg = SELL, pos = BUY) : aucune note ne peut plus pousser contre le côté qu'elle sert. Échelle <code>[0 · +{_echelleExh(REACH)}]</code> en qualité, <b>DÉRIVÉE</b> des poids et du mode (plus de littéral : il s'est périmé quatre fois en six jours) — <code>gap</code> SOMME ses horloges, les trois autres familles moyennent (±10). Conviction = Σ des familles, ORIENTÉE par le côté {sideE ?? "—"}.<Marque k="EXH" /></>}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={TH}>entrée</th><th style={TH}>note (signée)</th></tr></thead>
          <tbody>
            {Object.keys(LIB).map((k) => {
              const v = PE[k];
              const absent = !Number.isFinite(v);
              return (
                <tr key={k}>
                  <td style={{ ...TD, color: absent ? T.ink3 : T.ink, fontWeight: absent ? 400 : 600, whiteSpace: "nowrap" }}>{LIB[k]}</td>
                  {/* 🔴🔥 CORRIGÉ LE 13/08 — CE LIBELLÉ DISAIT L'INVERSE DE CE QUE FAIT LE RANG ①.
                      Il annonçait « hors somme, elle AMPLIFIE les autres », qui est le comportement de
                      `combinedScore` (le muet SORT du dénominateur, donc les présents parlent plus
                      fort). Le rang ① a tranché l'AUTRE sens le 11/08 : **une entrée absente vaut `0`
                      dans sa famille ET GARDE SON POIDS AU DÉNOMINATEUR** — donc elle DILUE. Le dépôt
                      nomme les deux régimes : `null` AMPLIFIE, `0` DILUE. Afficher l'un pour l'autre
                      fait lire un score trop haut là où il est trop bas.
                      ⚠ La nuance qui reste vraie : une famille ENTIÈREMENT muette est ABSENTE (pas
                      `0`) — elle ne contribue simplement pas à la somme. */}
                  {/* 🔄 19/08 — CETTE ÉTIQUETTE DÉCRIVAIT UNE CONVENTION ABANDONNÉE LE 13/08, et
                      elle disait exactement l'INVERSE du code. Le rang ① filtre désormais les
                      entrées muettes AVANT de construire le dénominateur (`ids` ne garde que les
                      présentes) : l'horloge absente sort du numérateur ET du dénominateur, donc
                      l'autre parle à PLEINE amplitude — elle AMPLIFIE, elle ne dilue pas. C'est la
                      convention des rangs ② et ③, ralliée « une fois, pas deux ».
                      ⚠ SAUF `gap`, déclarée en mode SOMME : là un muet coûte vraiment sa part.
                      ⚠ Un commentaire du moteur dit encore « dénominateur NOMINAL » sur cette
                        ligne — c'est LUI qui est périmé, pas le code. Ne pas s'y fier en relisant. */}
                  <td style={TD}>{absent
                    ? <span style={{ color: T.amber, fontSize: 11.5, fontStyle: "italic" }}>
                        muette — <b>exclue</b> de sa famille (numérateur ET dénominateur) ⇒ l'autre horloge parle à pleine amplitude
                        {k.startsWith("gap") ? <> · ⚠ mais <code>gap</code> <b>SOMME</b> : ici elle coûte sa part</> : null}
                      </span>
                    : <Note v={v} reach={REACH[k]} />}</td>
                </tr>
              );
            })}
            {FAM && Object.entries(FAM).map(([f, v]) => (
              <tr key={"fam-" + f}>
                <td style={{ ...TD, color: T.blue, fontSize: 11.5, paddingLeft: 14 }}>famille · {f}</td>
                <td style={{ ...TD, color: col(v), fontWeight: 700 }}>{fN(v)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...TD, borderTop: `1px solid ${T.borderHi}`, color: T.ink, fontWeight: 700 }}>
                Σ des {FAM ? "FAMILLES" : "notes"} (signée){sideE === "SELL" ? " → orientée (×−1)" : ""}
              </td>
              <td style={{ ...TD, borderTop: `1px solid ${T.borderHi}` }}>
                <b style={{ color: col(sommeE), fontSize: 15 }}>{sommeE == null ? "—" : fN(sommeE)}</b>
                {sideE === "SELL" && <span style={{ color: T.ink3 }}> → <b style={{ color: col(sommeOrientee) }}>{fN(sommeOrientee)}</b></span>}
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 10, padding: "7px 10px", borderRadius: 6, fontSize: 12,
          border: `1px solid ${okE ? T.border : T.red}`, background: okE ? "transparent" : "rgba(220,80,80,0.12)",
          color: okE ? T.ink3 : T.red }}>
          {ecartE == null
            ? <>Contrôle impossible — somme ou conviction absente. <b>Ce n'est pas « tout va bien »</b>.</>
            : okE
              ? <>✅ Σ orientée = conviction ({fN(convE)}) — la décomposition se referme.</>
              : <>🔴 <b>ÉCART {f2(ecartE)}</b> entre Σ orientée ({fN(sommeOrientee)}) et la conviction ({fN(convE)}).</>}
        </div>
        {muetsE.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: T.amber }}>
            ⚠ <b>{muetsE.length} entrée{muetsE.length > 1 ? "s" : ""} muette{muetsE.length > 1 ? "s" : ""}</b> ({muetsE.join(", ")}) —
            elles sortent de la somme, elles ne valent pas `0`. Sur un barème à somme, un muet <b>amplifie</b> les présentes.
          </div>
        )}
      </Card>
    );
  })();

  // ── CARTE ③ CONTINUE — branchée le 12/08 au soir ─────────────────────────────────────────
  // ⭐⭐⭐ CE BLOC COMBLE UN TROU QUI SE DISAIT À L'ÉCRAN. La page affirmait encore : « le rang ③
  //   n'est pas décomposé ici : c'est un vote pondéré d'experts, pas une somme de notes ». C'était
  //   vrai jusqu'au 12/08 au matin ; depuis, `contScoringV1` a remplacé `combinedScore` et la boîte
  //   porte `parts`/`familles`/`muets`. La phrase était devenue une DÉSINFORMATION affichée — le
  //   pire état d'un commentaire, parce qu'il détourne activement de la donnée qui existe.
  // 🔴🔥 REPÈRE **QUALITÉ**, PAS SIGNÉ — c'est ce qui distingue cette carte de celle du rang ① :
  //   `Σ familles = conviction` DIRECTEMENT, sans conversion par le côté. Le rang ① somme des notes
  //   signées puis oriente ; le ③ produit déjà « soutient CE côté ». ⚠ Un `orient()` appliqué ici
  //   inverserait tout le côté vendeur — c'est le bug corrigé dans `scoringDecision` le 12/08 au
  //   soir, et cette carte est l'endroit où il se serait vu.
  const blocCONT = (() => {
    const PC = boxes.cont?.parts ?? null;
    if (!PC) return (
      <Card titre="Décomposition — barème CONT (rang ③)" accent={T.amber} sous={<><Marque k="CONT" /></>}>
        <span style={{ color: T.amber, fontSize: 12.5 }}>⚠ `sc.boxes.cont.parts` absent de ce signal — rien à décomposer sans inventer.</span>
      </Card>
    );
    const FC = boxes.cont?.familles ?? null;
    const sommeC = FC ? +Object.values(FC).reduce((a, v) => a + v, 0).toFixed(3) : null;
    const convC = boxes.cont?.convRaw ?? null;          // le BARÈME seul, hors bonus
    const ecartC = sommeC != null && convC != null ? +(sommeC - convC).toFixed(6) : null;
    const okC = ecartC != null && Math.abs(ecartC) < 1e-6;
    const bonusC = boxes.cont?.bonus ?? 0;
    const bonusOn = boxes.cont?.bonusApplique === true;
    // ══ 🔄 19/08 — QUATRE POINTS PÉRIMÉS SUR CETTE CARTE, ET LE PREMIER FAISAIT MENTIR UNE JAUGE ══
    //   ⑴ `kH4` PORTE UN PRODUIT depuis le 16/08 (`kH4 × facteur %K H1`, facteur ∈ {0·1·2}) ⇒ la
    //      part va jusqu'à ±20, et la jauge était tracée sur `CONT_KH4_AMPLITUDE = 10` : 200 % de sa
    //      portée dès que le facteur vaut 2. Le nombre était juste, le dessin faux.
    //   ⑵ `kH1` n'est plus une note NI une famille — c'est le FACTEUR de ⑶. Sans l'étiquette on
    //      cherche une entrée disparue au lieu de lire une modulation.
    //   ⑶ Les poids du `rsi` sont INVERSÉS depuis le 15/08 : **1·H1 + 2·M15**, et les deux horloges
    //      ont DEUX TABLES DISTINCTES (le H1 note la POUSSÉE, le M15 le NIVEAU). « même grille » est
    //      faux depuis quatre jours. ⚠ Et le lecteur d'axe est `rsiDir3` (SENS vs mid-3) depuis le
    //      17/08, plus `rsiRang3` (RANG) — deux partitions différentes sous le même vocabulaire.
    //   ⑷ « 4 familles » : il y en a CINQ (`gapKd` s'est scindée en `gapKd`/`gapKdH4` le 16/08).
    // 🔄🔴🔥 19/08 — `rsiM15` SORT DE LA FAMILLE (A/B : `CONT_RSI_POIDS=h1only`), **PAS DE LA TRACE**.
    //   ⚠ SEUL CAS DE CETTE CARTE OÙ UNE NOTE AFFICHÉE NE CONTRIBUE PAS AU TOTAL. Sans l'étiquette,
    //   le lecteur la somme mentalement et voit un écart qui n'existe pas — et le contrôle
    //   `Σ familles = barème` resterait VERT, donc rien ne le détromperait.
    const LIBC = { rsiH1: "⑴ `RSI` H1 · zone(clôt.) × sens/mid3 — PORTE la famille SEUL (19/08)",
                   rsiM15: "⑴bis `RSI` M15 · table propre — ⚠ TRACÉE, **HORS SOMME** depuis le 19/08",
                   // ⚠ LE RANG ③ GARDE SON `%K` **H4** — seul le rang ① a basculé en H1 le 14/08.
                   //   Les deux notes s'appellent presque pareil et vivent dans deux cartes voisines.
                   di: "⑵ `DI` camp PORTEUR × dyn.",
                   kH4: "⑶ `%K` H4 × ΔK  ×  facteur `%K` H1 {0·1·2} ⇒ ±20",
                   // 🔄 19/08 — ⑷ LIT LA COLONNE `Δz` H1 (±0,20 σ), plus `K−D` H1. Ligne inchangée.
                   //   ⚠ ⑸ garde le `K−D`, en H4 : ne plus lire les deux comme un couple d'horloges
                   //   du même capteur — ce sont désormais DEUX capteurs différents sur la même ligne.
                   [CONT_GAPDZ_FAMILLE]: "⑷ côté du prix × niveau × `Δz` H1 (±0,20 σ) — ex `K−D` H1",
                   // 🔄 19/08 — ⑸ REFAITE : `z H4` CLÔTURE × `Δz H4`, bandes owner 0,30/1,05/2,15/
                   //   2,50/3,00. Elle NE partage plus la ligne de ⑷ ⚠ sa ligne `[+1,05·+2,15[` est
                   //   EN CLOCHE (FLAT 83,3 % > UP 67,9 %) — non monotone, et c'est délibéré.
                   [CONT_ZDZ_FAMILLE]: "⑸ `z H4` clôt. × `Δz H4` — table propre, NON monotone" };
    // ⚠ LA PORTÉE DE ⑶ EST **DÉRIVÉE**, pas écrite : `10 × 2` recopié ici se périmerait au premier
    //   changement de `CONT_KH1_FACTEUR_MAX`, et la jauge mentirait sans que rien ne lève.
    const AMPC = { rsiH1: CONT_RSI_AMPLITUDE, rsiM15: CONT_RSI_AMPLITUDE, di: CONT_DI_AMPLITUDE,
                   kH4: CONT_KH4_AMPLITUDE * CONT_KH1_FACTEUR_MAX,
                   [CONT_GAPDZ_FAMILLE]: CONT_GAPKD_AMPLITUDE, [CONT_ZDZ_FAMILLE]: CONT_GAPKD_AMPLITUDE };
    const muetsC = boxes.cont?.muets ?? [];
    return (
      <Card titre="Décomposition — barème CONT (rang ③)" accent={okC ? T.border : T.red}
        sous={<>{Object.keys(LIBC).length} entrées en <b>{CONT_ECHELLE.familles.length} familles</b> ({CONT_ECHELLE.familles.join(" · ")}) · échelle <code>[{CONT_ECHELLE.min} · +{CONT_ECHELLE.max}]</code> — notes en <b>QUALITÉ</b> (positif = soutient le côté {boxes.cont?.side ?? "—"}) — la conviction est leur somme, <b>sans orientation</b>.<Marque k="CONT" /></>}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={TH}>entrée</th><th style={TH}>case lue</th><th style={TH}>note</th></tr></thead>
          <tbody>
            {Object.keys(LIBC).map((k) => {
              const v = PC[k];
              const absent = !Number.isFinite(v);
              // ⭐ LA CASE QUI A PRODUIT LA NOTE, pas seulement la note : sans elle, `di = +5` peut
              //   venir de deux lignes qui n'ont rien à voir. C'est le geste déjà fait au rang ②.
              // 🔴🔥 ⑶ EST UN **PRODUIT**, ET SES DEUX FACTEURS SONT DANS LA TRACE — les afficher
              //   n'est pas du confort : un `kH4 = 0` peut venir d'un `%K` H4 qui recule (note brute
              //   nulle) OU d'un `+10` ANNULÉ par un facteur `0`. Deux barres qui n'ont rien à voir,
              //   un seul zéro à l'écran. Le moteur trace `kH4Brut`/`facH1`/`facH1App` exactement
              //   pour ça, et cette carte ne les lisait pas.
              //   ⚠ `facH1 = null` avec `facH1App = 1` est la signature « capteur muet » — à NE PAS
              //     confondre avec une case dictée à `1`. Les deux donnent le même score.
              const cas = k === "kH4"
                        ? `${PC.kH4Brut ?? "—"} × ${PC.facH1 ?? "1 (muet)"}${PC.kH1Bande ? "  ·  %K H1 " + PC.kH1Bande + " × " + (PC.kH1Col ?? "—") : ""}`
                        : k === "di" ? `${PC.diNiveau ?? "—"} × ${PC.diDyn ?? "—"}`
                        // ⚠ La case ⑷ se lit `CÔTÉ_NIVEAU × colonne K−D` — le côté est celui du prix
                        //   RÉEL (`HAUT` = au-dessus de sa moyenne), jamais un côté orienté.
                        : k === CONT_GAPDZ_FAMILLE ? `${PC.gapCote ?? "—"}_${PC.gapNiveau ?? "—"} × ${PC.gapKdCol ?? "—"}`
                        // ⚠ ⑸ PARTAGE LA LIGNE DE ⑷ et n'en change que la colonne — l'afficher sans
                        //   sa propre colonne laisserait croire que les deux notes sortent de la
                        //   MÊME case, alors que c'est tout ce qui les distingue.
                        // ⚠ ⑸ NE PARTAGE PLUS LA LIGNE DE ⑷ : sa case est `bande z H4 × colonne Δz H4`.
                        : k === CONT_ZDZ_FAMILLE ? `${PC.zdzBande ?? "—"} × ${PC.zdzCol ?? "—"}`
                        : "";
              return (
                <tr key={k}>
                  <td style={{ ...TD, color: absent ? T.ink3 : T.ink, fontWeight: absent ? 400 : 600, whiteSpace: "nowrap" }}>{LIBC[k]}</td>
                  <td style={{ ...TD, color: T.ink2, fontFamily: "monospace", fontSize: 11.5 }}>{cas}</td>
                  <td style={TD}>{absent
                    ? <span style={{ color: T.amber, fontSize: 11.5, fontStyle: "italic" }}>muette — exclue de sa famille</span>
                    : <Note v={v} reach={AMPC[k]} />}</td>
                </tr>
              );
            })}
            {FC && Object.entries(FC).map(([f, v]) => (
              <tr key={"famc-" + f}>
                <td style={{ ...TD, color: T.blue, fontSize: 11.5, paddingLeft: 14 }}>famille · {f}</td>
                <td style={TD} />
                <td style={{ ...TD, color: col(v), fontWeight: 700 }}>{fN(v)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...TD, borderTop: `1px solid ${T.borderHi}`, color: T.ink, fontWeight: 700 }}>Σ des FAMILLES</td>
              <td style={{ ...TD, borderTop: `1px solid ${T.borderHi}`, color: T.ink3, fontSize: 11.5 }}>
                {FC ? Object.keys(FC).length : 0} famille(s) présente(s) sur {CONT_ECHELLE.familles.length}
              </td>
              <td style={{ ...TD, borderTop: `1px solid ${T.borderHi}` }}>
                <b style={{ color: col(sommeC), fontSize: 15 }}>{sommeC == null ? "—" : fN(sommeC)}</b>
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 10, padding: "7px 10px", borderRadius: 6, fontSize: 12,
          border: `1px solid ${okC ? T.border : T.red}`, background: okC ? "transparent" : "rgba(220,80,80,0.12)",
          color: okC ? T.ink3 : T.red }}>
          {ecartC == null
            ? <>Contrôle impossible — somme ou conviction absente. <b>Ce n'est pas « tout va bien »</b>.</>
            : okC
              ? <>✅ Σ des familles = barème seul ({fN(convC)}) — la décomposition se referme, <b>sans orientation</b>.</>
              : <>🔴 <b>ÉCART {f2(ecartC)}</b> entre Σ ({fN(sommeC)}) et le barème ({fN(convC)}).</>}
        </div>
        {/* ⚠ LE BONUS EST LE SEUL DES TROIS RANGS À ÊTRE AJOUTÉ — et il est DÉBRANCHÉ depuis le 12/08. */}
        <div style={{ marginTop: 8, fontSize: 11.5, color: bonusOn ? T.amber : T.ink3 }}>
          <b style={{ color: bonusOn ? T.amber : T.ink2 }}>Bonus {bonusOn ? "APPLIQUÉ" : "calculé, NON appliqué"}</b> : {fN(bonusC)}
          {bonusOn
            ? <> — la conviction affichée vaut <b>barème {fN(convC)} + bonus {fN(bonusC)}</b>.</>
            : <> — <code>BONUS_APPLIQUE = false</code> ⇒ la conviction <b>EST</b> le barème. ⚠ Ne pas additionner les deux.</>}
        </div>
        {muetsC.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 11.5, color: T.amber }}>
            ⚠ <b>{muetsC.length} entrée{muetsC.length > 1 ? "s" : ""} muette{muetsC.length > 1 ? "s" : ""}</b> ({muetsC.join(", ")}) —
            au rang ③ un muet sort du dénominateur de sa famille : l'autre horloge parle alors à pleine amplitude.
          </div>
        )}
        {/* 🔄 13/08 — la trace `zOr` a disparu AVEC la garde `z > −0,30` : l'entrée ⑷ ne lit plus le
            `z`, le côté du prix est devenu un AXE de sa table (`HAUT_*` / `BAS_*`). Laisser la ligne
            aurait affiché « se TAIT sous −0,30 » sur un barème qui ne connaît plus ce seuil. */}
      </Card>
    );
  })();

  return (
    <div style={{ height: "100%", overflow: "auto", paddingRight: 4 }}>
      {/* ── EN-TÊTE : de quel tir parle-t-on ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        {onBack && <button type="button" onClick={onBack}
          style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.ink2, borderRadius: 7, padding: "4px 11px", fontSize: 12, cursor: "pointer" }}>← Signaux</button>}
        <b style={{ fontSize: 15, color: T.ink }}>{sig.asset ?? ""} {sig.tsMT}</b>
        <span style={{ color: sig.side === "BUY" ? T.green : T.red, fontWeight: 700, fontSize: 13 }}>{sig.side}</span>
        <span style={{ color: T.blue, fontWeight: 700, fontSize: 13 }}>{BOITE[rang] ?? rang}</span>
        {sig.outcome && <span style={{ color: sig.outcome === "WIN" ? T.green : sig.outcome === "LOSS" ? T.red : T.amber, fontWeight: 700, fontSize: 13 }}>
          {sig.outcome} {sig.R == null ? "" : `· R ${f2(sig.R)}`}</span>}
      </div>

      {/* ── LE TOTAL, ET LE SEUIL QU'IL A DÛ FRANCHIR ────────────────────────────────────── */}
      <Card titre="Le total" accent={T.blue}
        sous="La conviction est ORIENTÉE : positive = bonne figure de SON côté, quel que soit BUY ou SELL.">
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: col(boite?.conviction), fontVariantNumeric: "tabular-nums" }}>
            {boite?.conviction == null ? "—" : fN(boite.conviction)}
          </span>
          <span style={{ fontSize: 12.5, color: T.ink3 }}>
            seuil du rang <b style={{ color: T.ink2 }}>{sc.min == null ? "—" : sc.min}</b>
            {" "}<span style={{ color: T.ink3 }}>(`sc.min`, écrit par le moteur — jamais un import client)</span>
          </span>
          <span style={{ fontSize: 12.5, color: T.ink3 }}>
            `MIN_PRES` <b style={{ color: T.ink2 }}>{sc.minPres == null ? "—" : sc.minPres}</b>
          </span>
          {sc.silence && <span style={{ fontSize: 12.5, color: T.ink3 }}>silence <b style={{ color: T.ink2 }}>{sc.silence}</b></span>}
        </div>
      </Card>

      {/* ── LES DEUX DÉCOMPOSITIONS, DANS L'ORDRE DU RANG QUI A TIRÉ ────────────────────── */}
      {/* ⭐⭐⭐ L'ORDRE EST L'INFORMATION (owner 2026-08-12). Les deux cartes étaient rendues dans un
          ordre FIXE — PB puis EXH — quel que soit le rang qui avait décidé. Sur un tir ②, la carte
          du bas s'intitulait « barème EXH (rang ① ) » et c'est elle qu'on lisait comme LA
          décomposition du tir : le titre était juste, la PLACE était fausse.
          ⭐⭐ L'AUTRE RANG N'EST PAS RETIRÉ, IL EST DÉCLASSÉ. Sur un tir ②, la conviction du rang ①
          est exactement ce qui explique pourquoi il a cédé — la moitié de la lecture d'un pullback.
          Chaque carte porte donc sa MARQUE : « le barème qui a décidé » ou « pour contexte ». */}
      {/* ⭐⭐⭐ L'ORDRE EST L'INFORMATION : le rang qui a DÉCIDÉ passe en premier, les deux autres
          suivent — ils ne sont pas retirés, ils expliquent POURQUOI ils ont cédé. */}
      {(RANG === "EXH" ? [blocEXH, blocPB, blocCONT]
        : RANG === "PB" ? [blocPB, blocEXH, blocCONT]
        : [blocCONT, blocEXH, blocPB]).map((b, i) => <div key={i}>{b}</div>)}

      {/* ── LES TROIS BOÎTES, EN PARALLÈLE ───────────────────────────────────────────────── */}
      <Card titre="Les trois boîtes sur cette barre"
        sous={`regDir ${sc.regDir ?? "—"} · rangs atteints : ${(sc.ranks ?? []).join(" › ") || "—"} · le rang qui a tiré est surligné.`}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={TH}>boîte</th><th style={TH}>côté</th><th style={TH}>conviction</th><th style={TH}>verdict</th><th style={TH}>vetos</th></tr></thead>
          <tbody>
            {["exh", "pb", "cont"].map((k) => {
              const b = boxes[k]; if (!b) return null;
              const actif = String(rang).toLowerCase() === k;
              const vetos = [...(b.vetoIds ?? []), ...(b.vetoIdsHerites ?? []).map((v) => v + " (hérité)")];
              return (
                <tr key={k} style={actif ? { background: T.blue + "14" } : undefined}>
                  <td style={{ ...TD, color: actif ? T.blue : T.ink2, fontWeight: 700, whiteSpace: "nowrap" }}>{BOITE[k.toUpperCase()]}</td>
                  <td style={{ ...TD, color: b.side === "BUY" ? T.green : T.red, fontWeight: 600 }}>{b.side ?? "—"}</td>
                  <td style={{ ...TD, color: col(b.conviction), fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fN(b.conviction)}</td>
                  <td style={{ ...TD, color: b.verdict === "deal" ? T.green : b.verdict === "veto" ? T.red : T.ink3, fontWeight: 600 }}>{b.verdict ?? "—"}</td>
                  <td style={{ ...TD, fontSize: 11, color: vetos.length ? T.red : T.ink3, fontFamily: "monospace" }}>{vetos.length ? vetos.join(", ") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* ⭐ L'AVEU DU 11/08 MATIN EST LEVÉ — les rangs ① et ② sont décomposés tous les deux. Ce qui
            reste vrai, et qui doit rester écrit : `sc.exp` n'est PAS la décomposition du rang ①. */}
        {/* 🔄 12/08 — CETTE NOTE DISAIT LE CONTRAIRE DE LA VÉRITÉ. Elle affirmait que le rang ③
            n'est pas décomposable (« vote pondéré d'experts ») alors que son barème existe depuis le
            matin même et que sa carte est juste au-dessus. Un commentaire périmé qui DIRIGE le lecteur
            ailleurs est pire qu'un commentaire absent. */}
        <div style={{ marginTop: 10, fontSize: 11.5, color: T.ink3, lineHeight: 1.6 }}>
          ⚠ Les experts <code>di/gap/kd/rsi</code> de <code>sc.exp</code> sont de <b>TRACE SEULE</b> depuis le 07/08 :
          ils ne composent la conviction d'aucun rang. Les afficher comme « les composantes » serait faux —
          les trois décompositions ci-dessus sont les seules qui se referment sur la conviction.
        </div>
      </Card>

      {/* ⛔ CARTE « AUTOUR DU SCORE » SUPPRIMÉE LE 13/08 (owner). Elle mélangeait quatre choses qui
          n'ont rien à voir — le rang retenu, les cessions, le raccourci, le profil/régime — et trois
          d'entre elles sont DÉJÀ affichées : le rang retenu est surligné dans « Les trois boîtes »,
          les rangs traversés sont dans son sous-titre (`sc.ranks`), et le régime pilote le côté
          affiché sur chaque décomposition. Une donnée montrée deux fois à deux endroits finit par
          diverger d'un endroit.
          ⚠ CE QUI DISPARAÎT VRAIMENT AVEC ELLE, écrit pour que ce soit un choix et pas une perte
          silencieuse : (a) `sc.exhYieldedBy` / `sc.pbYieldedBy` — POURQUOI un rang a cédé (veto ou
          score), la seule trace du désistement ; (b) `sig.shortcut` ; (c) le DÉTAIL des hits de
          bonus (`sc.exhBonusHits` / `sc.contBonusHits`). Le bonus lui-même reste lisible : la carte
          du rang ③ affiche sa valeur et son état `bonusApplique`. 🎯 Si le motif de cession redevient
          nécessaire, sa place est dans « Les trois boîtes », à côté du verdict de chaque boîte —
          pas dans une carte fourre-tout. */}
    </div>
  );
}
