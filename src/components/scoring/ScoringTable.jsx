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
import { T, TH, TD } from "../ui.jsx";
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
import { combinedScore } from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js";
import { SCORE_MIN_CONT } from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js";

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

export default function ScoringTable({ lines, ctx }) {
  const pending = SCORERS.filter((s) => !isScored(s)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase",
          color: T.ink3, fontWeight: 600 }}>Scoring</span>
        {pending > 0 && (
          <span style={{ fontSize: 12, color: T.amber, background: T.amber + "1a",
            border: `1px solid ${T.amber}44`, borderRadius: 6, padding: "3px 10px" }}>
            barèmes non définis — {pending} colonne{pending > 1 ? "s" : ""} en attente
          </span>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <TH w={54} dense>TF</TH>
              {SCORERS.map((s) => <TH key={s.id} dense>{s.label}</TH>)}
              <TH dense>Σ conjonction</TH>
            </tr>
          </thead>
          <tbody>
            {lines.map((L) => (
              <tr key={L.tf.id}>
                <TD dense>
                  <span style={{ fontWeight: 700, color: T.ink, fontSize: 15, letterSpacing: 0.3 }}>
                    {L.tf.label}
                  </span>
                </TD>
                {SCORERS.map((s) => (
                  <TD key={s.id}><Score v={scoreOf(s, L, ctx)} scorer={s} /></TD>
                ))}
                {/* ⚠ VIDE PAR TF, ET C'EST EXACT : le moteur agrège d'abord CHAQUE expert sur ses
                    TF, puis moyenne les globals. Une « conjonction du H4 » n'existe pas dans la
                    décision — l'afficher laisserait croire à une étape qui n'a jamais lieu. */}
                <TD />
              </tr>
            ))}

            {/* ── TOTAL — une ligne SOUS M15 : le cumul se lit par INDICATEUR, sur les 4 TF.
                ⚠ Somme des contributeurs RÉELS par défaut — un capteur absent (l'ADX en D1/H4)
                   ne doit pas se lire comme un 0. Un expert peut imposer SA propre agrégation :
                   le Pressure Expert pondère 0,65 H1 / 0,35 M15 au lieu de sommer. */}
            <tr>
              <TD dense>
                <span style={{ fontWeight: 700, color: T.ink2, fontSize: 12, letterSpacing: 0.6,
                  textTransform: "uppercase" }}>total</span>
              </TD>
              {SCORERS.map((s) => {
                const perTf = Object.fromEntries(lines.map((L) => [L.tf.id, scoreOf(s, L, ctx)]));
                return <TD key={s.id}><Score v={totalOf(s, perTf)} scorer={s} big /></TD>;
              })}
              {/* Σ = ce que la couche 3 compare au seuil : moyenne PONDÉRÉE des globals BRUTS, les
                  experts muets RETIRÉS — la division se fait sur la somme des poids PRÉSENTS, donc un
                  muet ne tire pas le score vers zéro. Plus de normalisation d'amplitude (`0534dde`). */}
              <TD>{(() => {
                const experts = {};
                for (const s of SCORERS) {
                  const perTf = Object.fromEntries(lines.map((L) => [L.tf.id, scoreOf(s, L, ctx)]));
                  experts[s.id] = { global: totalOf(s, perTf) };
                }
                const v = combinedScore(experts, "CONT");
                if (v == null) return null;
                const pass = Math.abs(v) >= SCORE_MIN_CONT;
                const c = pass ? (v > 0 ? T.green : T.red) : T.ink3;
                return (
                  <span style={{ color: c, background: c + "22", border: `1px solid ${c}66`,
                    borderRadius: 6, padding: "3px 12px", fontSize: 16, fontWeight: 700,
                    fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {(v > 0 ? "+" : "") + v.toFixed(1)}
                    <span style={{ color: T.ink3, fontWeight: 500, fontSize: 12 }}> / {SCORE_MIN_CONT}</span>
                  </span>
                );
              })()}</TD>
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
