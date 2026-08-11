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
// ⚠⚠ CE QUE LA TRACE NE PORTE PAS, ET QU'ON N'INVENTE PAS : `sc.boxes.exh` n'expose que
//   `{side, conviction, blocked, vetoIds, verdict}` — **AUCUNE décomposition**. Le barème EXH a sept
//   entrées, elles ne sont pas dans le payload. La page l'écrit noir sur blanc plutôt que d'afficher
//   `sc.exp` (`di/gap/kd/rsi`) à la place : ces quatre-là sont des experts de TRACE SEULE depuis le
//   07/08, ils ne composent PAS la conviction du rang ①. Les afficher comme « les composantes »
//   serait exactement le mirage que ce dépôt paie le plus cher.
//
// ⚠ LES SEUILS VIENNENT DE `sc.min` / `sc.minPres`, JAMAIS D'UN IMPORT. `MIN_PB` & co sont lus par
//   `_envNum` via `process.env`, absent du navigateur ⇒ tout import client retombe sur le défaut
//   (`1000`) pendant que le serveur tourne avec autre chose. `sc.min` est écrit PAR LE MOTEUR au
//   moment de la décision : c'est le seul seuil qui a réellement servi.
import { T } from "./ui.jsx";
// ⭐ Les AMPLITUDES sont de vraies constantes de module (pas de lecture d'env) : elles traversent le
//   navigateur sans mentir. Elles disent la PORTÉE de chaque entrée — donc ce que « +5 » vaut.
import { PB_Z_AMPLITUDE, PB_K_AMPLITUDE } from "../../../Matrix-Revolution/src/components/robot/engines/scoring/pbScoringV1.js";

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
    { cle: "z", titre: "⑴ `z` H1", note: P.z, reach: PB_Z_AMPLITUDE,
      mesure: `z clôturé (orienté) ${f2(P.u)}`, case_: `${P.niveau ?? "—"} × ${P.colZ ?? "—"}`,
      detail: `Δz live (orienté) ${f2(P.du)}` },
    { cle: "k", titre: "⑵ `%K` H1", note: P.k, reach: PB_K_AMPLITUDE,
      mesure: `%K clôturé (orienté) ${P.kOr == null ? "—" : Number(P.kOr).toFixed(2)}`, case_: `${P.colK ?? "—"}`,
      detail: "ΔK live replié en 3 colonnes" },
  ] : [];

  // 🔴🔥 LE CONTRÔLE : la somme des notes PRÉSENTES doit valoir la conviction de la boîte. `null` ne
  //   contribue pas (entrée MUETTE) — il ne vaut PAS `0`, qui serait le verdict « relais ».
  const presentes = ENTREES_PB.filter((e) => e.note != null);
  const somme = presentes.length ? presentes.reduce((a, e) => a + e.note, 0) : null;
  const convPb = boxes.pb?.conviction ?? null;
  const ecart = somme != null && convPb != null ? +(somme - convPb).toFixed(6) : null;
  const sommeOk = ecart != null && Math.abs(ecart) < 1e-9;

  const Ligne = ({ k, v, c }) => (
    <div style={{ display: "flex", gap: 10, fontSize: 12.5, padding: "2px 0" }}>
      <span style={{ color: T.ink3, minWidth: 132 }}>{k}</span>
      <span style={{ color: c || T.ink2, fontWeight: 600 }}>{v}</span>
    </div>
  );

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

      {/* ── LA DÉCOMPOSITION ─────────────────────────────────────────────────────────────── */}
      {P ? (
        <Card titre="Décomposition — barème PB" accent={sommeOk ? T.border : T.red}
          sous={`Deux entrées depuis le 11/08 (l'ADX est sorti du barème) ⇒ échelle [−${PB_Z_AMPLITUDE + PB_K_AMPLITUDE} · +${PB_Z_AMPLITUDE + PB_K_AMPLITUDE}].`}>
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
        <Card titre="Décomposition" accent={T.amber}>
          <span style={{ color: T.amber, fontSize: 12.5 }}>⚠ `sc.boxes.pb.parts` absent de ce signal — rien à décomposer sans inventer.</span>
        </Card>
      )}

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
        {/* ⚠⚠ L'AVEU, ÉCRIT À L'ÉCRAN — voir l'en-tête du fichier. */}
        <div style={{ marginTop: 10, fontSize: 11.5, color: T.amber, lineHeight: 1.6 }}>
          ⚠ <b>Seule la boîte ② est décomposable.</b> `sc.boxes.exh` ne porte que sa conviction et ses
          vetos — les sept entrées du barème EXH ne sont pas dans la trace. Les experts `di/gap/kd/rsi`
          de `sc.exp` sont de <b>TRACE SEULE</b> depuis le 07/08 : ils ne composent pas la conviction du
          rang ①, et les afficher ici comme « les composantes » serait faux.
        </div>
      </Card>

      {/* ── CE QUI A CHANGÉ LA DÉCISION AUTOUR DU SCORE ──────────────────────────────────── */}
      <Card titre="Autour du score">
        <Ligne k="rang qui a tiré" v={BOITE[rang] ?? rang ?? "—"} c={T.blue} />
        <Ligne k="EXH a cédé par" v={sc.exhYieldedBy ?? "—"} c={sc.exhYieldedBy ? T.amber : T.ink3} />
        <Ligne k="PB a cédé par" v={sc.pbYieldedBy ?? "—"} c={sc.pbYieldedBy ? T.amber : T.ink3} />
        <Ligne k="raccourci" v={sig.shortcut ?? "—"} />
        <Ligne k="profil / régime" v={`${sig.profile ?? "—"} · ${sig.regime ?? "—"}`} />
        {(sc.contBonusHits?.length > 0 || sc.exhBonusHits?.length > 0) && (
          <div style={{ marginTop: 9, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: T.ink3, marginBottom: 4 }}>
              Bonus — ⚠ ils s'ajoutent au score du rang ③ (`contRaw` → `cont`), <b>pas</b> à la conviction PB.
            </div>
            {[...(sc.exhBonusHits ?? []), ...(sc.contBonusHits ?? [])].map((h, i) => (
              <div key={i} style={{ fontSize: 11.5, color: T.ink2, padding: "2px 0" }}>
                <b style={{ color: col(h.value) }}>{fN(h.value)}</b>{" "}
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>{h.id}</span>
                <span style={{ color: T.ink3 }}> — {h.why}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
