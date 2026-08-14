// ScoringTable.jsx — LES TROIS RANGS, sous la table des indicateurs (owner 2026-08-05).
// --------------------------------------------------------------------------------------------
// ⭐⭐⭐ CE COMPOSANT NE CALCULE PLUS AUCUN SCORE. Il AFFICHE la trace que `decideFromScoring` a
//   produite sur la barre. 🔄 11/08 : `scoring.exhExperts` N'EXISTE PLUS (`exhaustionScorer` supprime,
//   « un seul exhScoring »). Les rangs ① et ② se lisent dans `scoring.boxes.{exh,pb}.parts` — des
//   BAREMES A SOMME ; seul le rang ③ garde un bundle d'experts (`contExperts`) avec ses `perTf` et
//   leurs `global`. C'est la fin d'une famille de bugs, pas une simplification de confort.
//
// 🔴🔥 CE QUE ÇA REMPLACE, ET POURQUOI. La table redérivait les entrées, les passait à des
//   descripteurs (`SCORERS`), et rappelait les experts. Trois divergences page↔moteur en une
//   journée en sont sorties — un commentaire périmé, un paramètre oublié, un arrondi — chacune
//   rendant un score PLAUSIBLE et FAUX. Le contrat + l'invariant du matin ont fermé la porte ;
//   afficher la trace la mure. **Un chiffre qu'on n'a pas calculé ne peut pas diverger.**
//
// 🔴🔥 ET ÇA FERME LE VRAI PIÈGE DE LECTURE, celui qui a fait remonter deux « divergences » qui n'en
//   étaient pas : la table ne montrait QUE le rang ③. Sur une barre où le fade tire, l'écran
//   affichait un `Σ +0,6` de continuation à côté d'un `SELL EXH` — deux nombres justes, deux thèses
//   différentes, et un lecteur qui conclut à une incohérence du moteur. Les mêmes noms d'experts y
//   portent des valeurs OPPOSÉES : `di` vaut +1,95 en continuation et −8 en fade sur la même barre,
//   parce que « le camp acheteur mène » se lit « on suit » d'un côté et « il est à bout » de l'autre.
//   ⇒ Les trois rangs sont désormais côte à côte, dans l'ordre de la cascade, et celui qui a décidé
//   est marqué. On ne peut plus prendre le score d'une thèse pour celui d'une autre.
//
// ⚠ `SCORERS` N'EST PLUS LU ICI. Les colonnes viennent de `SCORING_WEIGHT[thèse]` (l'ordre ET les
//   poids), l'amplitude des pastilles de `EXPERT_REACH[thèse]`. Deux tables du moteur, aucune liste
//   locale : une colonne apparaît ou disparaît quand un expert est branché ou retiré, sans toucher
//   ce fichier. C'est ce qui a manqué à `range`, `energy` et `%K`, retirés du moteur et restés à
//   l'écran des jours durant.
import { T } from "../ui.jsx";
import { combinedScore, SCORING_WEIGHT, EXPERT_REACH, REACH_TARGET }
  from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js";
import { MIN_EXH, MIN_PRES, MIN_PB, MIN_CONT }
  from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js";
// ⭐ AMPLITUDES DU RANG ③ **IMPORTÉES**, jamais recopiées (13/08) : une portée écrite en dur ici
//   deviendrait fausse au premier recalibrage, et la barre de remplissage mentirait sans erreur.
import { CONT_RSI_AMPLITUDE, CONT_DI_AMPLITUDE, CONT_KH4_AMPLITUDE, CONT_GAPKD_AMPLITUDE }
  from "../../../../Matrix-Revolution/src/components/robot/engines/scoring/contScoringV1.js";

/** Le score du moteur est SIGNÉ (positif = BUY) ; la conviction le projette sur le côté visé. */
const orient = (v, side) => (v == null ? null : side === "BUY" ? v : side === "SELL" ? -v : null);
const f1 = (v) => (v == null ? "—" : (v > 0 ? "+" : "") + Number(v).toFixed(1));
const f2 = (v) => (v == null ? "—" : (v > 0 ? "+" : "") + Number(v).toFixed(2));
const dec = (v) => String(v).replace(".", ",");
const TFS = ["d1", "h4", "h1", "m15"];

/** Pastille de score. Intensité = |v| / portée DE L'EXPERT — aucune borne écrite ici. */
function Score({ v, reach, big }) {
  if (v == null) return <span style={{ color: T.ink3, fontSize: 11 }}>muet</span>;
  const span = Math.abs(reach) || 1;
  const w = Math.min(1, Math.abs(v) / span);
  const c = v > 0 ? T.green : v < 0 ? T.red : T.ink2;
  const alpha = Math.round(24 + w * 40).toString(16).padStart(2, "0");
  return (
    <span style={{ color: v === 0 ? T.ink2 : c, background: c + alpha, border: `1px solid ${c}55`,
      borderRadius: 6, padding: big ? "3px 12px" : "2px 9px", fontSize: big ? 15 : 13.5,
      fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{f1(v)}</span>
  );
}

const SEP = { borderLeft: `2px solid ${T.borderHi}` };
const Th = ({ children, w, sep, sticky, align = "center" }) => (
  <th style={{ textAlign: align, padding: "6px 10px", fontSize: 10.5, fontWeight: 600,
    letterSpacing: 0.4, textTransform: "uppercase", color: T.ink3, width: w,
    borderBottom: `1px solid ${T.borderHi}`, whiteSpace: "nowrap", verticalAlign: "bottom",
    ...(sep ? SEP : null),
    ...(sticky ? { position: "sticky", left: 0, zIndex: 2, background: T.surface } : null) }}>{children}</th>
);
const Td = ({ children, sep, sticky, align = "center", bg, total }) => (
  <td style={{ textAlign: align, padding: total ? "9px 10px" : "6px 10px", fontSize: 13,
    whiteSpace: "nowrap", borderBottom: total ? "none" : `1px solid ${T.border}`,
    ...(total ? { borderTop: `2px solid ${T.borderHi}` } : null),
    ...(sep ? SEP : null), ...(bg ? { background: bg } : null),
    ...(sticky ? { position: "sticky", left: 0, zIndex: 1, background: bg ?? T.surface } : null) }}>{children}</td>
);
const Sub = ({ children }) => (
  <span style={{ display: "block", textTransform: "none", letterSpacing: 0, opacity: 0.6,
    fontWeight: 500, fontSize: 10 }}>{children}</span>
);

/** UN RANG = un bandeau + une table. Même géométrie pour les trois, seule la thèse change. */
/** ⭐⭐⭐ LE RENDU D'UN BARÈME À SOMME (rangs ① et ②) — il n'y a RIEN à recalculer : la conviction et
 *  les notes viennent de la trace. La seule opération est l'ORIENTATION, et elle est AFFICHÉE.
 *  ⚠ `signees` distingue les deux conventions du moteur, et ce n'est pas un détail d'affichage :
 *    rang ① — notes SIGNÉES (`SELL = −BUY`) ⇒ `Σ` vaut l'opposé de la conviction sur un SELL ;
 *    rang ② — notes en QUALITÉ (entrées déjà orientées) ⇒ `Σ` EST la conviction.
 *    Afficher la même somme pour les deux ferait crier un écart inexistant une fois sur deux. */
function BaremeParts({ rank }) {
  const { parts, muets, conviction, signees, side, ampl, lib } = rank;
  if (!parts) return <div style={{ fontSize: 11.5, color: T.ink3, fontStyle: "italic" }}>
    aucune décomposition sur cette barre — la boîte n'a pas été évaluée.</div>;
  // 🔴🔥 MEME CORRECTION QUE `ScorePage` (11/08) : au rang ①, ce qui se somme ce sont les FAMILLES
  //   (`stoch H1` · `RSI` · `ADX` · `gap` · `stoch H4`), pas les huit notes. Sommer `parts` ferait
  //   crier un ecart a chaque barre. ⚠ Le rang ② n'a pas de familles — il retombe sur ses notes.
  const fam = rank.familles ?? null;
  const notes = fam ? Object.entries(fam)
                    : Object.entries(parts).filter(([k, v]) => lib[k] && Number.isFinite(v));
  const somme = notes.length ? notes.reduce((a, [, v]) => a + v, 0) : null;
  const orientee = somme == null ? null : (signees && side === "SELL" ? -somme : somme);
  const ok = orientee != null && conviction != null && Math.abs(orientee - conviction) < 1e-9;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {Object.keys(lib).map((k) => {
        const v = parts[k];
        const absent = !Number.isFinite(v);
        const w = absent ? 0 : Math.min(1, Math.abs(v) / (ampl[k] || 10));
        const c = absent ? T.ink3 : v > 0 ? T.green : v < 0 ? T.red : T.ink2;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 11.5 }}>
            <span style={{ color: absent ? T.ink3 : T.ink2, minWidth: 186 }}>{lib[k]}</span>
            {absent
              ? <span style={{ color: T.amber, fontStyle: "italic" }}>muette — hors somme, elle ne vaut pas 0</span>
              : <>
                  <b style={{ color: c, minWidth: 26, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {(v > 0 ? "+" : "") + v}</b>
                  <span style={{ width: 44, height: 4, borderRadius: 2, background: T.border, overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${w * 100}%`, background: c }} />
                  </span>
                  <span style={{ color: T.ink3, fontSize: 10 }}>±{ampl[k]}</span>
                </>}
          </div>
        );
      })}
      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 11.5, marginTop: 3,
        paddingTop: 5, borderTop: `1px solid ${T.border}` }}>
        <span style={{ color: T.ink2, minWidth: 186, fontWeight: 600 }}>
          Σ {fam ? "des FAMILLES" : (signees ? "signée" : "des présentes")}{signees && side === "SELL" ? " → orientée" : ""}
        </span>
        <b style={{ color: somme == null ? T.ink3 : somme > 0 ? T.green : T.red }}>
          {somme == null ? "—" : (somme > 0 ? "+" : "") + somme}</b>
        {signees && side === "SELL" && <span style={{ color: T.ink3 }}>
          → <b style={{ color: orientee > 0 ? T.green : T.red }}>{(orientee > 0 ? "+" : "") + orientee}</b></span>}
        <span style={{ color: ok ? T.ink3 : T.red, fontSize: 10.5 }}>
          {conviction == null ? "· conviction absente" : ok ? "· = conviction ✓" : `· ≠ conviction (${conviction}) 🔴`}
        </span>
      </div>
      {muets?.length > 0 && (
        <div style={{ fontSize: 10.5, color: T.amber }}>
          ⚠ {muets.length} muette{muets.length > 1 ? "s" : ""} ({muets.join(", ")}) — sur un barème à SOMME,
          un muet réduit la magnitude ; il n'ajoute pas un `0`.
        </div>
      )}
    </div>
  );
}

function Rank({ rank, sc }) {
  const { code, label, thesis, side, min, col, fired, note, yieldedBy } = rank;
  const experts = rank.experts ?? null;
  const ids = Object.keys(SCORING_WEIGHT[thesis] ?? {});
  // ⭐ LE SCORE EST RECALCULÉ PAR LA FONCTION DU MOTEUR, sur les globals du moteur. Ce n'est pas une
  //   redérivation : `combinedScore` est CELLE que `decideFromScoring` appelle, et on lui donne
  //   exactement ce qu'elle a reçu. C'est la seule façon d'obtenir le score du rang ② quand c'est le
  //   rang ① qui a tiré — la trace ne porte que celui du rang décideur.
  // ⚠ LE CÔTÉ EST PASSÉ EN EXH ET PAS EN CONT, comme dans le moteur : c'est lui qui arme la pénalité
  //   du silence. L'oublier ferait retomber sur le score BRUT (muet retiré du dénominateur).
  // ⭐⭐⭐ DEUX NATURES, DEUX CHEMINS (11/08). Les rangs ① et ② portent des `parts` de BARÈME : leur
  //   conviction est LUE dans la trace, jamais recalculée. Seul le rang ③ passe encore par
  //   `combinedScore` — c'est un vote PONDÉRÉ, et le recalcul y reste la seule façon d'obtenir son
  //   score quand ce n'est pas lui qui a tiré (la trace ne porte que celui du rang décideur).
  const estBareme = rank.parts !== undefined;
  const raw = (!estBareme && experts) ? combinedScore(experts, thesis, thesis === "EXH" ? side : null) : null;
  const bonus = rank.bonus ?? 0;
  const conviction = estBareme
    ? (rank.conviction ?? null)
    : (raw == null ? null : +orient(raw + bonus, side).toFixed(2));
  // ⚠ `>` ET NON `>=` — c'est la convention du moteur (`conviction > MIN_EXH`). L'ancien `>=` faisait
  //   passer pour ADMISE une barre exactement au seuil, que le moteur DROPPE.
  const pass = conviction != null && conviction > min;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap",
        paddingBottom: 7, borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: col, letterSpacing: 0.3 }}>{label}</span>
        <span style={{ fontSize: 11, color: T.ink3 }}>
          barème <b style={{ color: T.ink2 }}>{thesis === "EXH" ? "FADE" : "CONTINUATION"}</b>
          {side ? <> · côté <b style={{ color: side === "BUY" ? T.green : T.red }}>{side}</b></> : null}
        </span>
        {/* ⭐ LE RANG QUI A DÉCIDÉ EST MARQUÉ. Sans ça, trois tables côte à côte se valent à l'œil et
            on retombe sur la confusion qu'on vient de fermer, d'un cran plus haut. */}
        {fired && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: col,
          background: col + "22", border: `1px solid ${col}66`, borderRadius: 5, padding: "1px 7px" }}>A DÉCIDÉ</span>}
        {/* 🔴🔥 UN RANG PEUT ÊTRE AU-DESSUS DE SON SEUIL ET N'AVOIR PAS DÉCIDÉ — c'est le VETO qui
            l'a écarté, pas le score. Vu sur AUDUSD 30/07 14:52 : rang ① à conviction 9,06 pour un
            seuil de 2,2, et pourtant c'est le rang ③ qui décide. Sans ce badge, « franchi » sur un
            rang qui n'a pas tiré rouvre exactement la confusion qu'on vient de fermer.
            ⚠ `structure` ROUTE (la main passe), `timing` TUE — le détail des hits est sur la page
            Signaux ; ici on dit seulement PAR QUOI le rang a cédé. */}
        {!fired && yieldedBy && (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
            color: yieldedBy === "veto" ? T.amber : T.ink3,
            background: (yieldedBy === "veto" ? T.amber : T.ink3) + "1a",
            border: `1px solid ${(yieldedBy === "veto" ? T.amber : T.ink3)}55`,
            borderRadius: 5, padding: "1px 7px" }}>
            CÉDÉ PAR {yieldedBy === "veto" ? "VETO" : "SCORE"}
          </span>
        )}
        {note && <span style={{ fontSize: 10.5, color: T.ink3, fontStyle: "italic" }}>{note}</span>}
      </div>

      {estBareme ? (
        /* ⭐ Rangs ① et ② : une SOMME DE NOTES, lue dans la trace. Pas de grille par TF — il n'y en a
           pas : chaque entrée du barème lit SON horloge, écrite dans son libellé. */
        <BaremeParts rank={rank} />
      ) : !experts ? (
        <div style={{ fontSize: 11.5, color: T.ink3, fontStyle: "italic", padding: "4px 0" }}>
          aucun panel — le moteur n'a pas scoré ce côté sur cette barre
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th w={62} sticky align="left">TF</Th>
                {ids.map((id) => (
                  <Th key={id}>{id}<Sub>poids {dec(SCORING_WEIGHT[thesis][id])}</Sub></Th>
                ))}
                <Th sep>Σ conjonction<Sub>conviction · vs {dec(min)}</Sub></Th>
              </tr>
            </thead>
            <tbody>
              {TFS.map((tf) => (
                <tr key={tf}>
                  <Td sticky align="left">
                    <span style={{ fontWeight: 700, color: T.ink, fontSize: 14 }}>{tf.toUpperCase()}</span>
                  </Td>
                  {ids.map((id) => {
                    const v = experts[id]?.perTf?.[tf];
                    return <Td key={id}>{v == null
                      ? <span style={{ color: T.ink3, fontSize: 12 }}>—</span>
                      : <Score v={v} reach={REACH_TARGET} />}</Td>;
                  })}
                  {/* ⚠ VIDE PAR TF, ET C'EST EXACT : le moteur agrège d'abord CHAQUE expert sur ses
                      TF, puis moyenne les globals. Une « conjonction du H4 » n'existe pas. */}
                  <Td sep />
                </tr>
              ))}
              <tr>
                <Td sticky align="left" total bg={T.bg}>
                  <span style={{ fontWeight: 700, color: T.ink, fontSize: 12, letterSpacing: 0.7,
                    textTransform: "uppercase" }}>global</span>
                </Td>
                {ids.map((id) => (
                  <Td key={id} total bg={T.bg}>
                    <Score v={experts[id]?.global ?? null} reach={EXPERT_REACH[thesis]?.[id] ?? REACH_TARGET} big />
                  </Td>
                ))}
                <Td sep total bg={T.bg}>
                  <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span style={{ color: pass ? col : T.ink3, background: (pass ? col : T.ink3) + "22",
                      border: `1px solid ${pass ? col : T.ink3}66`, borderRadius: 6, padding: "3px 12px",
                      fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {f2(conviction)}
                      <span style={{ color: T.ink3, fontWeight: 500, fontSize: 12 }}> / {dec(min)}</span>
                    </span>
                    <span style={{ fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase",
                      fontWeight: 600, color: pass ? col : T.ink3 }}>
                      {pass ? "franchi" : "sous le seuil"}
                    </span>
                  </span>
                </Td>
              </tr>
            </tbody>
          </table>
          {/* ⭐ BRUT / BONUS / CONVICTION SÉPARÉS : sans ça un Σ venu d'un accord des experts et un Σ
              retourné par un bonus se lisent pareil. La trace doit permettre de refaire la soustraction. */}
          <div style={{ fontSize: 11, color: T.ink3, marginTop: 6, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>score signé <b style={{ color: T.ink2 }}>{f2(raw)}</b></span>
            {bonus !== 0 && <span>bonus <b style={{ color: T.amber }}>{f2(bonus)}</b></span>}
            <span>orienté sur {side ?? "—"} ⇒ conviction <b style={{ color: T.ink2 }}>{f2(conviction)}</b></span>
            {code === "EXH" && <span>bande de veto <b style={{ color: T.amber }}>[{dec(MIN_PRES)} · {dec(MIN_EXH)}[</b> → DROP</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScoringTable({ sc, rank: firedRank, err }) {
  if (err) return <div style={{ color: T.red, fontSize: 12 }}>scoring indisponible — {err}</div>;
  if (!sc) return (
    <div style={{ fontSize: 11.5, color: T.ink3, fontStyle: "italic" }}>
      aucun scoring sur cette barre — la row n'était pas évaluable, ou aucun régime n'était exploitable
      (le moteur droppe AVANT de scorer dans ces deux cas).
    </div>
  );

  const regDir = sc.regDir ?? null;
  const SIDE_EXH = regDir > 0 ? "SELL" : regDir < 0 ? "BUY" : null;
  const SIDE_PRO = regDir > 0 ? "BUY" : regDir < 0 ? "SELL" : null;

  // ⭐ L'ORDRE EST CELUI DE LA CASCADE, et il n'y en a pas d'autre : ① EXHAUSTE › ② PULLBACK ›
  //   ③ CONTINUE. Chaque rang est le repli du précédent ; les lire dans un autre ordre effacerait
  //   la seule information que leur juxtaposition porte.
  // ══ 🔄 REFAIT LE 11/08 — LES RANGS ① ET ② N'ONT PLUS D'EXPERTS ═══════════════════════════════
  // ⛔ CE QUE CE BLOC DISAIT, ET QUI ÉTAIT FAUX DEPUIS LE 10/08 : « les deux premiers sont le MÊME
  //   barème lu sur les deux côtés (`exhExperts.SELL` / `exhExperts.BUY`) ». Le rang ② a SON barème
  //   (`pbScoringV1`) depuis le 10/08, et `exhaustionScorer` — d'où venait `exhExperts` — a été
  //   SUPPRIMÉ le 11/08. La table lisait donc un champ qui n'existe plus, en affichant un commentaire
  //   qui décrivait une architecture disparue. ⭐ Deux façons de mentir dans le même bloc.
  // ⭐⭐⭐ ET LE REMPLACEMENT EST MEILLEUR QUE L'ANCIEN : on ne RECALCULE plus rien. `combinedScore`
  //   était rappelé ici sur les globals du moteur — une redérivation, donc une divergence possible.
  //   Les rangs ① et ② lisent maintenant `sc.boxes.*.parts` et `sc.boxes.*.conviction`, c'est-à-dire
  //   **ce que le moteur a écrit**. Un chiffre qu'on n'a pas calculé ne peut pas diverger.
  // ⚠ Le rang ③ garde sa forme EXPERTS : `continuationScorer` existe toujours, et c'est un VOTE
  //   PONDÉRÉ, pas une somme de notes. Deux natures, deux rendus — les confondre serait la faute
  //   d'origine de cette table.
  // ⚠⚠ LES SEUILS AFFICHÉS ICI VIENNENT D'UN IMPORT CLIENT (`MIN_*`), donc des DÉFAUTS : `_envNum`
  //   lit `process.env`, absent du navigateur. C'est COHÉRENT sur cette page — `decideFromScoring` y
  //   tourne aussi dans le navigateur, avec les mêmes défauts — mais ça ne reproduit PAS le serveur.
  //   La page Signaux/Score, elle, lit `sc.min`, écrit par le moteur qui a réellement décidé.
  // 🔄 12/08 — ⑺ `dRsi` REMPLACÉ par `rsiTrendH1` (RSI H1 live × rang dans ses 3 dernières barres).
  //   ⚠ Les DEUX cartes d'étiquettes du dépôt (ici et `ScorePage`) doivent bouger dans le même
  //   commit que le moteur : une clé orpheline s'affiche « muette » sur toutes les barres, ce qui
  //   se lit « le capteur ne dit rien » au lieu de « la page ne sait plus où regarder ».
  // 🔄 12/08 — `kH1` RETIRÉ et ⑴ refaite (`côté du prix × niveau × K−D`, la vitesse `dz` est
  //   partie). ⚠ La numérotation se décale d'un cran à partir de ⑷. C'est la DEUXIÈME carte —
  //   l'autre est dans `ScorePage`, et le dépôt note qu'un retrait d'entrée se paie à 4 endroits.
  // 🔄 12/08 SOIR — `kdH1` RETIRÉ à son tour ⇒ la famille `stochH1` disparaît et l'échelle du rang ①
  //   passe à [−36,5 · +36,5]. C'est la DEUXIÈME carte d'étiquettes ; l'autre est dans `ScorePage`.
  // 🔄 13/08 — CETTE CARTE ÉTAIT PÉRIMÉE DEPUIS LE MATIN, ET DE TROIS FAÇONS À LA FOIS :
  //   ⑴ `di` a été FUSIONNÉ dans `adx` — la clé restait ici, donc elle s'affichait « muette » sur
  //      TOUTES les barres, ce qui se lit « le capteur ne dit rien » au lieu de « l'entrée n'existe
  //      plus ». C'est le motif que ce fichier documente deux blocs plus haut, repris une fois de plus.
  //   ⑵ `gapM15` a été AJOUTÉ (⑴bis, même grille que `gap`) et n'était nulle part ⇒ une entrée VIVE
  //      qui ne s'affichait pas. L'inverse de ⑴, aussi silencieux.
  //   ⑶ `adx` avait une portée de **5** alors que la table va à ±10 depuis la fusion — la barre de
  //      remplissage affichait donc jusqu'à 200 %.
  // ⚠ RAPPEL : les DEUX cartes du dépôt (ici et `ScorePage`) doivent bouger dans le MÊME commit que
  //   le moteur. `ScorePage` a été faite le matin, celle-ci non — d'où les trois écarts ci-dessus.
  const AMPL_EXH = { gap: 10, gapM15: 10, adx: 10, kH1: 10, rsiM15: 10, rsiTrendH1: 10 };
  // ⚠ ⑴ et ⑴bis = MÊME grille, deux horloges, et elles se **SOMMENT** (seul cas du dépôt : les
  //   familles se moyennent partout ailleurs). ⑸ et ⑹ = même grille aussi, mais en MOYENNE 2:1.
  //   L'étiquette le dit, sinon deux notes issues d'une seule table se lisent comme deux barèmes.
  const LIB_EXH = { gap: "⑴ gap H1 · côté prix × niveau × K−D",
                    gapM15: "⑴bis gap M15 · même grille — SOMMÉE avec ⑴",
                    adx: "⑵ ADX × dyn. DI (le `di` y est fusionné depuis le 13/08)",
                    kH1: "⑶ %K H1 × ΔK  (ex H4, bascule owner 14/08)",
                    rsiM15: "⑷ RSI M15 live × rang/3",
                    rsiTrendH1: "⑸ RSI H1 live × rang/3" };
  // 🔄 13/08 — LE RANG ③ N'AVAIT AUCUNE CARTE : il affichait encore `sc.contExperts`, le vote pondéré
  //   d'experts **RETIRÉ LE 12/08**, avec la note « pas une somme de notes ». Il a un BARÈME depuis,
  //   à 4 familles — et la page montrait l'organe mort à la place. « Un organe qui ne décide plus
  //   devient un LEURRE », et ici il était devenu un leurre D'AFFICHAGE.
  const AMPL_CONT = { rsiH1: CONT_RSI_AMPLITUDE, rsiM15: CONT_RSI_AMPLITUDE, di: CONT_DI_AMPLITUDE,
                      kH4: CONT_KH4_AMPLITUDE, gapKd: CONT_GAPKD_AMPLITUDE, gapKdH4: CONT_GAPKD_AMPLITUDE };
  const LIB_CONT = { rsiH1: "⑴ RSI H1 · zone(clôt.) × rang/3", rsiM15: "⑴bis RSI M15 · même grille (2·H1 + 1·M15)",
                     // ⚠ LE RANG ③ GARDE SON `%K` **H4** — seul le rang ① a basculé en H1 le 14/08.
                     di: "⑵ DI camp PORTEUR × dyn.", kH4: "⑶ %K H4 × ΔK",
                     gapKd: "⑷ côté prix × niveau × K−D H1",
                     gapKdH4: "⑸ même grille, colonne K−D H4 (moyenne 1:1 avec ⑷)" };
  // 🔴 CETTE CARTE ÉTAIT PÉRIMÉE DEPUIS LE 11/08 : elle nommait encore `z` l'entrée ⑴, remplacée
  //   par `gapAtr` ce jour-là. Une clé orpheline s'affiche « muette » sur toutes les barres — donc
  //   le panneau montrait le barème PB comme s'il ne parlait plus, et personne ne l'a vu.
  //   ⇒ Corrigée en même temps qu'on ajoute ⑶. ⚠ Les DEUX cartes du dépôt (ici et `ScorePage`)
  //   doivent bouger dans le même commit que le moteur.
  const AMPL_PB = { gap: 10, k: 10, rsi: 10 };
  const LIB_PB = { gap: "⑴ gapAtr H1 · niveau × installation × vitesse", k: "⑵ %K H1 × ΔK",
                   rsi: "⑶ RSI zone(clôt.) × rang/3 · 2·H1 + 1·M15" };
  const RANKS = [
    { code: "EXH", label: "① EXHAUSTE", side: SIDE_EXH, min: MIN_EXH, col: T.amber,
      parts: sc.boxes?.exh?.parts ?? null, muets: sc.boxes?.exh?.muets ?? null,
      familles: sc.boxes?.exh?.familles ?? null,
      conviction: sc.boxes?.exh?.conviction ?? null, verdict: sc.boxes?.exh?.verdict ?? null,
      // ⚠ SIGNÉES : `Σ parts = total`, et `conviction = orient(total, side)`. Sur un SELL la somme
      //   brute vaut l'OPPOSÉ de la conviction — la table le montre au lieu de le subir.
      signees: true, ampl: AMPL_EXH, lib: LIB_EXH,
      yieldedBy: sc.exhYieldedBy ?? null, note: "contre-tendance — le côté −regDir · 6 entrées en 4 familles · [0 · +50], aucune pénalité" },
    { code: "PB", label: "② PULLBACK", side: SIDE_PRO, min: MIN_PB, col: T.cyan,
      parts: sc.boxes?.pb?.parts ?? null, muets: sc.boxes?.pb?.muets ?? null,
      conviction: sc.boxes?.pb?.conviction ?? null, verdict: sc.boxes?.pb?.verdict ?? null,
      // ⚠ EN QUALITÉ, pas signées : les notes sont lues sur des entrées déjà orientées.
      signees: false, ampl: AMPL_PB, lib: LIB_PB,
      yieldedBy: sc.pbYieldedBy ?? null, note: "SON barème depuis le 10/08 — 3 entrées · SIGNÉ, garde ses pénalités" },
    { code: "CONT", label: "③ CONTINUE", thesis: "CONT", side: SIDE_PRO, min: MIN_CONT, col: T.blue,
      parts: sc.boxes?.cont?.parts ?? null, muets: sc.boxes?.cont?.muets ?? null,
      familles: sc.boxes?.cont?.familles ?? null,
      conviction: sc.boxes?.cont?.conviction ?? null, verdict: sc.boxes?.cont?.verdict ?? null,
      // ⚠ EN QUALITÉ comme le ②, PAS signées : `contScoreV1` rend « soutient CE côté-ci » et
      //   `scoringDecision` ne l'oriente PAS. Le lire comme le ① inverserait tout le vendeur —
      //   c'est la faute d'`orient()` du 12/08.
      signees: false, ampl: AMPL_CONT, lib: LIB_CONT,
      // ⚠ `contExperts` reste porté par le moteur en DIAGNOSTIC, mais il ne décide plus rien depuis
      //   le 12/08. On l'affiche encore à côté du barème pour ne pas perdre la trace, jamais à sa place.
      experts: sc.contExperts ?? null, bonus: sc.contBonus ?? 0,
      note: "le résidu — 6 entrées en 4 familles · [0 · +40], plus aucune case négative · veto `cont-mean-flat` depuis le 13/08" },
  ].map((r) => ({ ...r, fired: firedRank === r.code }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase",
          color: T.ink2, fontWeight: 700 }}>Scoring — les trois rangs</span>
        <span style={{ fontSize: 11, color: T.ink3 }}>
          régime <b style={{ color: regDir == null ? T.red : regDir > 0 ? T.green : T.red }}>
            {regDir == null ? "aucun" : regDir > 0 ? "+1 haussier" : "−1 baissier"}</b>
          {regDir != null && <> ⇒ ① {SIDE_EXH} · ②③ {SIDE_PRO}</>}
          {" "}· les valeurs sont celles de la trace du moteur, pas un recalcul
        </span>
      </div>
      {RANKS.map((r) => <Rank key={r.code} rank={r} sc={sc} />)}
    </div>
  );
}
