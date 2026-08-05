// ScoringTable.jsx — LES TROIS RANGS, sous la table des indicateurs (owner 2026-08-05).
// --------------------------------------------------------------------------------------------
// ⭐⭐⭐ CE COMPOSANT NE CALCULE PLUS AUCUN SCORE. Il AFFICHE la trace que `decideFromScoring` a
//   produite sur la barre : `scoring.contExperts`, `scoring.exhExperts.{BUY,SELL}`, leurs `perTf` et
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
  const raw = experts ? combinedScore(experts, thesis, thesis === "EXH" ? side : null) : null;
  const bonus = rank.bonus ?? 0;
  const conviction = thesis === "EXH"
    ? (raw == null ? null : +(orient(raw, side) + orient(bonus, side)).toFixed(2))
    : (raw == null ? null : +orient(raw + bonus, side).toFixed(2));
  const pass = conviction != null && conviction >= min;

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

      {!experts ? (
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
  // ⭐⭐ LES DEUX PREMIERS SONT LE MÊME BARÈME LU SUR LES DEUX CÔTÉS : `exhExperts.SELL` et
  //   `exhExperts.BUY`. C'est visible à l'écran une fois les deux tables côte à côte — le rang ② ne
  //   « ressemble » pas au rang ①, il EST le score qu'on jetait avant la refonte.
  const RANKS = [
    { code: "EXH", label: "① EXHAUSTE", thesis: "EXH", side: SIDE_EXH, min: MIN_EXH, col: T.amber,
      experts: sc.exhExperts?.[SIDE_EXH] ?? null, bonus: sc.exhBonus ?? 0,
      yieldedBy: sc.yieldedBy ?? null,
      note: "contre-tendance — le côté −regDir" },
    { code: "PB", label: "② PULLBACK", thesis: "EXH", side: SIDE_PRO, min: MIN_PB, col: T.cyan,
      experts: sc.exhExperts?.[SIDE_PRO] ?? null, bonus: sc.exhBonus ?? 0,
      yieldedBy: sc.pbYieldedBy ?? null,
      note: "le MÊME barème, sur l'autre côté" },
    { code: "CONT", label: "③ CONTINUE", thesis: "CONT", side: SIDE_PRO, min: MIN_CONT, col: T.blue,
      experts: sc.contExperts ?? null, bonus: sc.contBonus ?? 0,
      note: "le résidu — aucune figure exigée" },
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
