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
import { SCORERS, scoreOf, totalOf, scaleRange, isScored } from "./scoringScales.js";

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
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 12.5, color: T.ink3, lineHeight: 1.5 }}>
        Une colonne par indicateur, une ligne par TF. <strong style={{ color: T.ink2 }}>Case vide =
        pas de valeur</strong> (capteur absent, barème non défini) — jamais un 0.
        <br />
        <strong style={{ color: T.ink2 }}>%K = Cycle Expert</strong> (K level × ΔK band) — mesure
        l'<em>intérêt d'entrer maintenant</em>, pas la force : SOFT &gt; FAST &gt; EXPLOSIVE, on
        n'achète pas l'euphorie et on ne vend pas la panique. Total pondéré 0,40 H1 / 0,30 H4 /
        0,15 D1 / 0,15 M15.
        <br />
        <strong style={{ color: T.ink2 }}>ADX = Pressure Expert</strong> — <em>écart DI</em> ×{" "}
        <em>ADX level</em> × <em>dominanceTurn</em>. Le DI donne le <strong>camp qui mène</strong>,
        l'ADX la <strong>magnitude</strong>, le turn son <strong>évolution</strong>. Un écart{" "}
        <code>BALANCED</code> annule le score : aucun camp ne mène, il n'y a rien à orienter.
        Expert à <strong>2 TF</strong> (l'ADX n'est exporté qu'en H1 et M15), total pondéré 0,65 H1 /
        0,35 M15.
        <br />
        <strong style={{ color: T.amber }}>Le niveau est lu sur la bougie EN COURS</strong>{" "}
        (<code>s0</code>), pas sur la close — à 11h52 on ne qualifie pas la pression avec une bougie
        terminée depuis 52 minutes. Repli sur <code>c1</code> avant le 18/07, où l'EA n'exportait pas
        encore <code>s0</code>. Les deux distributions sont identiques au dixième (p5/p50/p95 =
        15,7/28,5/53,8 contre 15,8/28,4/53,0), donc mêmes bandes — mais la bande diffère sur{" "}
        <strong>17,5 %</strong> des barres. Le <code>dominanceTurn</code> reste sur les closes : un
        niveau est un <em>état</em> et gagne à être frais, un turn est un <em>événement</em> et exige
        des bougies comparables.
        <br />
        Les trois experts sont bornés [−10, +10] et <em>indépendants</em>. Barèmes :{" "}
        <code>src/components/scoring/experts/</code>.
      </div>
    </div>
  );
}
