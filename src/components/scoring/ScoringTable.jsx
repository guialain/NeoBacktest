// ScoringTable.jsx — LA table de scoring, sous la table des indicateurs (owner 2026-07-26).
// --------------------------------------------------------------------------------------------
// UNE SEULE TABLE (owner) : les experts entrent dans leur colonne, on ne crée pas de table à côté.
//   Lignes D1 / H4 / H1 / M15 + une ligne `total` sous M15 ; une colonne par indicateur.
//
// ⚠ CASE VIDE QUAND IL N'Y A PAS DE VALEUR (owner) — capteur absent, barème non défini, ou case
//   non spécifiée : rien à l'écran. Surtout pas un 0, qui serait une opinion.
//
// ⚠ CE COMPOSANT NE CONTIENT AUCUN NOMBRE et ne classe rien : il reçoit les lignes déjà calculées
//   par IndicatorsPage (bandes issues des classificateurs du MOTEUR) et applique `scoreOf`.
//   Les barèmes vivent dans `scoringScales.js` et, pour un expert, dans son propre module.
import { T } from "../ui.jsx";
// ⭐ LE SCORING A DÉMÉNAGÉ DANS LE MOTEUR le 2026-07-27 (owner). Les barèmes vivaient ici alors que
//   leur SOURCE — les classificateurs bandés — vivait à Matrix-Revolution : la connaissance d'un côté,
//   ce qu'elle décrit de l'autre. Ce fichier reste le seul morceau de RENDU ; tout le reste est parti.
//   Même chemin cross-dépôt que `IndicatorsPage.jsx` pour `OpportunityDetector`.
import {
  SCORERS, scoreOf, totalOf, scaleRange, isScored,
} from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringScales.js";
// ⭐ LA CONJONCTION — le nombre que la couche 3 compare réellement au seuil. Les totaux par colonne
//   ne disent pas ce que le moteur décide : il décide sur leur moyenne PONDÉRÉE (`SCORING_WEIGHT`).
//   Sans cette dernière colonne, la page montrait tout sauf le chiffre qui tire.
// 🔴 CE COMMENTAIRE DISAIT « NORMALISÉE EN AMPLITUDE » — faux depuis `0534dde` : la normalisation est
//   RETIRÉE, chaque expert parle à sa magnitude brute et un poids ÉCRIT dose son influence. Un
//   commentaire qui dit le contraire du code envoie chercher un bug là où il n'y en a pas.
// ⭐ `SCORING_WEIGHT` EST LU, PAS RECOPIÉ (2026-08-05) : chaque en-tête de colonne porte le poids que
//   l'expert pèse dans le Σ. Sans lui, la dernière colonne est une moyenne dont on ne voit pas les
//   coefficients — et « pourquoi le total ne ressemble pas à la ligne du dessus » n'a pas de réponse
//   à l'écran. ⚠ La règle d'en-tête de ce fichier tient toujours : aucun NOMBRE écrit ici, ils
//   viennent tous du moteur. Un poids recopié se périmerait au premier arbitrage.
import { combinedScore, SCORING_WEIGHT } from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js";
import { MIN_CONT } from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js";

// Pastille de score — même grammaire visuelle que `Band` de la table du dessus.
//   Intensité proportionnelle à |score| / amplitude DE LA COLONNE : aucune borne codée ici.
function Score({ v, scorer, big }) {
  if (v == null) return null;                       // ⚠ case VIDE, pas un tiret ni un 0
  const { min, max, signed } = scaleRange(scorer);
  const span = Math.max(Math.abs(min), Math.abs(max)) || 1;
  const w = Math.min(1, Math.abs(v) / span);
  const c = !signed ? T.blue : v > 0 ? T.green : v < 0 ? T.red : T.ink2;
  const alpha = Math.round(24 + w * 40).toString(16).padStart(2, "0");
  return (
    <span style={{ color: v === 0 ? T.ink2 : c, background: c + alpha, border: `1px solid ${c}55`,
      borderRadius: 6, padding: big ? "3px 12px" : "2px 10px", fontSize: big ? 16 : 14,
      fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {/* ⚠ UNE DÉCIMALE PARTOUT (owner 2026-07-26) : les cellules sont entières, les totaux
             pondérés ne le sont pas — sans format commun la colonne saute (« +8 » puis « 2.25 »).
             Formatage à l'AFFICHAGE seulement, la valeur agrégée reste pleine précision. */}
      {(v > 0 ? "+" : "") + v.toFixed(1)}
    </span>
  );
}

// ── CELLULES LOCALES (2026-08-05) — POURQUOI ELLES NE VIENNENT PLUS DE `ui.jsx` ────────────────
// ⭐ `TH`/`TD` partagés sont CALÉS À GAUCHE, et c'est juste pour la table des indicateurs, dont les
//   cellules mêlent un nombre, une parenthèse grise et une pastille de largeur variable : les caler
//   à gauche est la seule façon de faire commencer les nombres au même endroit.
//   Ici chaque cellule ne contient QU'UNE pastille, de largeur variable elle aussi (`+8.0` · `−12.5`
//   · `+0.5`) — calée à gauche, la colonne devient un escalier. CENTRÉE, elle redevient une colonne.
// ⚠ On ne touche donc PAS `ui.jsx` : les deux tables ont des besoins opposés, et changer la
//   primitive partagée pour arranger celle-ci casserait l'autre en silence.
const SEP = { borderLeft: `2px solid ${T.borderHi}` };

const Th = ({ children, w, sep, sticky, align = "center" }) => (
  <th style={{
    textAlign: align, padding: "6px 10px", fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
    textTransform: "uppercase", color: T.ink3, borderBottom: `1px solid ${T.borderHi}`,
    width: w, whiteSpace: "nowrap", verticalAlign: "bottom",
    ...(sep ? SEP : null),
    // ⚠ La colonne TF reste visible quand la table défile : 5 experts + Σ dépassent souvent la
    //   largeur du panneau, et un score sans son TF ne veut rien dire.
    ...(sticky ? { position: "sticky", left: 0, zIndex: 2, background: T.surface } : null),
  }}>{children}</th>
);

const Td = ({ children, sep, sticky, align = "center", bg, total }) => (
  <td style={{
    textAlign: align, padding: total ? "9px 10px" : "6px 10px", fontSize: 13, whiteSpace: "nowrap",
    borderBottom: total ? "none" : `1px solid ${T.border}`,
    ...(total ? { borderTop: `2px solid ${T.borderHi}` } : null),
    ...(sep ? SEP : null),
    ...(bg ? { background: bg } : null),
    ...(sticky ? { position: "sticky", left: 0, zIndex: 1, background: bg ?? T.surface } : null),
  }}>{children}</td>
);

/** Sous-titre d'en-tête — même grammaire que la table des indicateurs : minuscules, atténué. */
const Sub = ({ children }) => (
  <span style={{ display: "block", textTransform: "none", letterSpacing: 0, opacity: 0.6,
    fontWeight: 500, fontSize: 10 }}>{children}</span>
);

export default function ScoringTable({ lines, ctx }) {
  const pending = SCORERS.filter((s) => !isScored(s)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ── BANDEAU DE TITRE — la table porte enfin sa thèse dans son titre, pas dans un en-tête de
             colonne à 40 caractères. C'est l'information la plus structurante de tout le bloc :
             ces cinq colonnes sont les experts de la CONTINUATION, et rien d'autre. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap",
        paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase",
          color: T.ink2, fontWeight: 700 }}>Scoring</span>
        <span style={{ fontSize: 11.5, color: T.blue, fontWeight: 600 }}>rang ③ CONTINUE</span>
        <span style={{ fontSize: 11, color: T.ink3 }}>
          les {SCORERS.length} experts de la continuation · un score par TF, agrégé en ligne
          <b style={{ color: T.ink2 }}> total</b>, puis moyenné en Σ
        </span>
        {pending > 0 && (
          <span style={{ fontSize: 11.5, color: T.amber, background: T.amber + "1a",
            border: `1px solid ${T.amber}44`, borderRadius: 6, padding: "2px 9px" }}>
            barèmes non définis — {pending} colonne{pending > 1 ? "s" : ""} en attente
          </span>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
          <thead>
            <tr>
              <Th w={62} sticky align="left">TF</Th>
              {/* ⭐ LE POIDS SOUS L'ÉTIQUETTE : le Σ est une moyenne PONDÉRÉE, et sans ses coefficients
                  à l'écran « le total ne ressemble pas aux colonnes » reste une énigme. Lu du moteur. */}
              {SCORERS.map((s) => (
                <Th key={s.id}>
                  {s.label}
                  <Sub>{SCORING_WEIGHT.CONT?.[s.id] == null
                    ? "hors thèse"
                    : `poids ${String(SCORING_WEIGHT.CONT[s.id]).replace(".", ",")}`}</Sub>
                </Th>
              ))}
              {/* ⚠ L'ÉTIQUETTE DIT SA THÈSE DEPUIS LE 05/08. Ce Σ est `combinedScore(experts,"CONT")`
                  comparé à `MIN_CONT` — c'est-à-dire le score du rang ③ SEUL. Sur une barre où le
                  moteur a tiré un FADE ou un PULLBACK, un « Σ » nu se lit comme LE score de la barre
                  et n'a aucun rapport avec la décision affichée à côté. Les deux autres rangs lisent
                  un AUTRE barème (celui du fade, sur deux côtés) que cette table ne calcule pas.
                  🎯 Les afficher demande de faire tourner les scorers de fade ici — chantier à part,
                  volontairement non fait plutôt que fait à moitié sous une étiquette ambiguë.
                  ⭐ SÉPARÉE PAR UN FILET (05/08) : cette colonne ne répond pas à la même question que
                  les cinq autres — elles décrivent un expert, elle décrit la DÉCISION. Le trait dit
                  qu'on change de nature, pas seulement de colonne. */}
              <Th sep>
                Σ conjonction
                <Sub>moyenne pondérée · vs {String(MIN_CONT).replace(".", ",")}</Sub>
              </Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((L) => (
              <tr key={L.tf.id}>
                <Td sticky align="left">
                  <span style={{ fontWeight: 700, color: T.ink, fontSize: 14, letterSpacing: 0.3 }}>
                    {L.tf.label}
                  </span>
                </Td>
                {SCORERS.map((s) => (
                  <Td key={s.id}><Score v={scoreOf(s, L, ctx)} scorer={s} /></Td>
                ))}
                {/* ⚠ VIDE PAR TF, ET C'EST EXACT : le moteur agrège d'abord CHAQUE expert sur ses
                    TF, puis moyenne les globals. Une « conjonction du H4 » n'existe pas dans la
                    décision — l'afficher laisserait croire à une étape qui n'a jamais lieu. */}
                <Td sep />
              </tr>
            ))}

            {/* ── TOTAL — une ligne SOUS M15 : le cumul se lit par INDICATEUR, sur les 4 TF.
                ⚠ Somme des contributeurs RÉELS par défaut — un capteur absent (l'ADX en D1/H4)
                   ne doit pas se lire comme un 0. Un expert peut imposer SA propre agrégation :
                   le Pressure Expert pondère 0,65 H1 / 0,35 M15 au lieu de sommer. */}
            {/* ⭐ LA LIGNE QUI COMPTE, ET ELLE SE VOIT ENFIN (05/08) : filet épais au-dessus, fond
                appuyé, pas de bordure en bas. Avant, elle portait le même trait fin que les quatre
                lignes de TF — c'est-à-dire que la seule ligne dont la valeur ENTRE dans la décision
                se lisait comme un cinquième timeframe. */}
            <tr>
              <Td sticky align="left" total bg={T.bg}>
                <span style={{ fontWeight: 700, color: T.ink, fontSize: 12, letterSpacing: 0.7,
                  textTransform: "uppercase" }}>total</span>
              </Td>
              {SCORERS.map((s) => {
                const perTf = Object.fromEntries(lines.map((L) => [L.tf.id, scoreOf(s, L, ctx)]));
                return <Td key={s.id} total bg={T.bg}><Score v={totalOf(s, perTf)} scorer={s} big /></Td>;
              })}
              {/* Σ = ce que la couche 3 compare au seuil : moyenne PONDÉRÉE des globals BRUTS, les
                  experts muets RETIRÉS — la division se fait sur la somme des poids PRÉSENTS, donc un
                  muet ne tire pas le score vers zéro. Plus de normalisation d'amplitude (`0534dde`). */}
              <Td sep total bg={T.bg}>{(() => {
                const experts = {};
                for (const s of SCORERS) {
                  const perTf = Object.fromEntries(lines.map((L) => [L.tf.id, scoreOf(s, L, ctx)]));
                  experts[s.id] = { global: totalOf(s, perTf) };
                }
                const v = combinedScore(experts, "CONT");
                if (v == null) return null;
                const pass = Math.abs(v) >= MIN_CONT;
                const c = pass ? (v > 0 ? T.green : T.red) : T.ink3;
                return (
                  // ⭐ LE VERDICT EN DEUX ÉTAGES : la valeur, puis ce qu'elle FAIT du seuil. « 2,1 »
                  //   seul ne dit pas s'il tire ; « franchi » / « sous le seuil » le dit sans que le
                  //   lecteur ait à comparer deux nombres de tête. La couleur portait déjà
                  //   l'information — elle était le SEUL support, donc invisible en gris sur gris.
                  <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span style={{ color: c, background: c + "22", border: `1px solid ${c}66`,
                      borderRadius: 6, padding: "3px 12px", fontSize: 16, fontWeight: 700,
                      fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {(v > 0 ? "+" : "") + v.toFixed(1)}
                      <span style={{ color: T.ink3, fontWeight: 500, fontSize: 12 }}>
                        {" / "}{String(MIN_CONT).replace(".", ",")}
                      </span>
                    </span>
                    <span style={{ fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase",
                      fontWeight: 600, color: pass ? c : T.ink3 }}>
                      {pass ? `franchi · ${v > 0 ? "BUY" : "SELL"}` : "sous le seuil"}
                    </span>
                  </span>
                );
              })()}</Td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ℹ️ Notes de bas de table retirées (owner 2026-07-26). Le raisonnement n'est pas perdu :
             il vit dans les modules — `experts/cycleExpert.js`, `pressureExpert.js`,
             `zscoreExpert.js` — au plus près des chiffres qu'il justifie. */}
    </div>
  );
}
