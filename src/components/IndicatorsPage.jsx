// IndicatorsPage.jsx — lecture des capteurs pour UNE ligne du dataset, sur les 4 TF (owner 2026-07-25).
// --------------------------------------------------------------------------------------------
// But : voir ce que le moteur VOIT sur une barre donnée, avant de brancher les nouveaux classificateurs.
//
// ⭐ RÈGLE : les bandes viennent des FONCTIONS DU MOTEUR importées cross-repo (SSOT), JAMAIS d'une
//   recopie locale. Un jour où l'UI recalculait un dérivé de son côté, elle a divergé du moteur en
//   silence (cf. `derived_dataset_computed_3x`). Ici `zscoreBand` / `stochZone` / `kdDistanceBand` /
//   `kdCycleState` / `adxLevelBand` sont ceux d'OpportunityDetector.js.
//
// ⚠ ADX : l'EA n'exporte `adx14_*` QUE pour h1 et m15. D1/H4 affichent « non exporté » — un tiret
//   silencieux laisserait croire à une valeur nulle, ce qui est exactement le piège `num("")=0`.
import { useEffect, useState } from "react";
import { T, Panel, N, TH, TD } from "./ui.jsx";
import ScoringTable from "./scoring/ScoringTable.jsx";
import {
  zscoreBand, stochZone, kdDistanceBand, kdCycleState, adxLevelBand,
  deltaKBand, deltaZBand, adxTurnBand, diGapBand, diGapDynamics, diLevelBand,
} from "../../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";

const TFS = [
  { id: "d1", label: "D1", adx: false },
  { id: "h4", label: "H4", adx: false },
  { id: "h1", label: "H1", adx: true },
  { id: "m15", label: "M15", adx: true },
];

// "" / null → null (JAMAIS 0 : un capteur absent lu 0 a déjà coûté deux bugs majeurs).
const num = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const f = (v, d = 2) => (v == null ? "—" : v.toFixed(d));

// Couleur par famille de bande : froid = bas/serré, chaud = haut/étendu, gris = neutre/absent.
const BAND_COLOR = {
  EXTREME_LOW: "#4493f8", EXTREME_LOWER: "#4493f8", EXTREME_BASSE: "#4493f8",
  LOW: "#5fa8d3", LOWER: "#5fa8d3", BASSE: "#5fa8d3",
  MEDIUM: "#8b949e", NEUTRAL: "#8b949e", MID: "#8b949e", STABLE: "#8b949e",
  HIGH: "#d29922", UPPER: "#d29922", HAUTE: "#d29922", DIVERGING: "#d29922",
  EXTREME_HIGH: "#f85149", EXTREME_UPPER: "#f85149", EXTREME_HAUTE: "#f85149", EXTREME: "#f85149",
  CONTACT: "#3fb950", CONVERGING: "#5fa8d3", CROSS: "#f85149",
  // écart DI (signé, même convention froid→chaud que zone/zscore) et sa dynamique
  EXTREME_SELL: "#4493f8", SELL: "#5fa8d3", BALANCED: "#8b949e", BUY: "#d29922", EXTREME_BUY: "#f85149",
  NARROWING: "#5fa8d3", WIDENING: "#d29922",
  // dominanceTurn — vert = la pression se renforce, rouge = elle s'érode (non signé : c'est la MAGNITUDE)
  RISING: "#3fb950", TURN_UP: "#8dc891", TURN_DOWN: "#e08b7d", FALLING: "#f85149",
  // échelle de VITESSE signée (deltaKBand / deltaZBand) — froid = baisse, chaud = hausse, gris = flat
  EXPLOSIVE_DOWN: "#4493f8", FAST_DOWN: "#5fa8d3", SOFT_DOWN: "#7fa8bd",
  FLAT: "#8b949e",
  SOFT_UP: "#bfa05e", FAST_UP: "#d29922", EXPLOSIVE_UP: "#f85149",
};

// ⚠ COMPACT (owner 2026-07-26) : 14 colonnes doivent tenir sans défilement horizontal. Les pastilles
//   sont le poste le plus large — police et padding réduits, sans toucher aux LIBELLÉS : abréger
//   `EXTREME_LOW` en `EX_LO` ferait gagner de la place au prix de la lisibilité.
function Band({ v }) {
  if (!v) return <span style={{ color: T.ink3, fontSize: 13 }}>—</span>;
  const c = BAND_COLOR[v] ?? T.ink2;
  return (
    <span style={{ color: c, background: c + "1f", border: `1px solid ${c}55`, borderRadius: 5,
      padding: "1px 5px", fontSize: 10.5, fontWeight: 600, letterSpacing: 0.1, whiteSpace: "nowrap" }}>{v}</span>
  );
}

// 🔴 PLACEHOLDER — un delta dont la BANDE n'est pas encore calibrée. On montre la valeur (elle est
//   exacte) et on DIT que la classification manque, plutôt que d'inventer des seuils ou de laisser
//   croire que la colonne est finie. Même parti pris que le bandeau « barèmes non définis ».
const DeltaTBD = ({ v, on }) => {
  if (!on) return <span style={{ color: T.ink3, fontSize: 12, fontStyle: "italic" }}>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 550,
        color: v == null ? T.ink3 : v >= 0 ? T.green : T.red }}>
        {v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}`}
      </span>
      <span style={{ color: T.amber, fontSize: 9.5, opacity: 0.7, fontStyle: "italic" }}>à calibrer</span>
    </span>
  );
};

const Val = ({ children, dim }) => (
  <span style={{ fontVariantNumeric: "tabular-nums", color: dim ? T.ink3 : T.ink,
    marginRight: 5, fontSize: 13, fontWeight: 550 }}>{children}</span>
);

export default function IndicatorsPage({ asset }) {
  const [data, setData] = useState(null);
  const [idx, setIdx] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // `q` = querystring déjà formée ("" = dernière ligne, "?i=" index, "?ts=" horodatage).
  const fetchRow = (q) => {
    if (!asset) return;
    setBusy(true); setErr("");
    fetch(`http://localhost:3001/api/matrix/row/${asset}${q}`)
      .then((r) => r.json())
      .then((j) => { if (j.error) throw new Error(j.error); setData(j); setIdx(j.index); })
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setBusy(false));
  };
  const load = (i) => fetchRow(i == null ? "" : `?i=${i}`);
  // Saut par horodatage : le serveur prend la 1re ligne >= à la valeur demandée (le scan n'a pas
  //   forcément une ligne à la minute exacte — marché fermé, trou de collecte).
  const goTo = (date, hh, mm) => fetchRow(`?ts=${encodeURIComponent(`${date}T${hh}:${mm}:00Z`)}`);

  useEffect(() => { setData(null); load(null); /* eslint-disable-next-line */ }, [asset]);

  const row = data?.row;
  const total = data?.total ?? 0;

  // Les sélecteurs SUIVENT la ligne chargée (pas d'état parallèle qui dériverait de l'affichage).
  const cur = row?.ts_utc ? String(row.ts_utc) : null;
  const selDate = cur ? cur.slice(0, 10) : "";
  const selHH = cur ? cur.slice(11, 13) : "00";
  const selMM = cur ? cur.slice(14, 16) : "00";
  const minDate = data?.firstTs ? String(data.firstTs).slice(0, 10) : undefined;
  const maxDate = data?.lastTs ? String(data.lastTs).slice(0, 10) : undefined;
  const pad2 = (n) => String(n).padStart(2, "0");

  // Une ligne de table par TF. Tout passe par les classificateurs du moteur.
  const lines = TFS.map((tf) => {
    const open = num(row?.[`open_${tf.id}_s0`]);
    const close = num(row?.[`close_${tf.id}_s0`]);
    const chg = (open != null && close != null) ? close - open : null;
    const chgPct = (chg != null && open) ? (chg / open) * 100 : null;

    const z = num(row?.[`zscore_${tf.id}_s0`]);
    const k = num(row?.[`stoch_k_${tf.id}_s0`]);
    const d = num(row?.[`stoch_d_${tf.id}_s0`]);
    const k1 = num(row?.[`stoch_k_${tf.id}_s1`]);
    const d1 = num(row?.[`stoch_d_${tf.id}_s1`]);
    const k2 = num(row?.[`stoch_k_${tf.id}_s2`]);
    const d2 = num(row?.[`stoch_d_${tf.id}_s2`]);
    const kd = (k != null && d != null) ? k - d : null;
    const kdPrev = (k1 != null && d1 != null) ? k1 - d1 : null;
    // s2 sert UNIQUEMENT à dater l'état de la barre précédente : kdCycleState compare deux barres,
    //   donc l'état EN s1 se lit sur le couple (s1, s2). Ça donne la TRANSITION s1 → s0.
    const kd2 = (k2 != null && d2 != null) ? k2 - d2 : null;

    // ΔK = s0 − s1 (`stoch_k_*_s1` existe sur les 4 TF).
    const dK = (k != null && k1 != null) ? k - k1 : null;
    // Δz = s0 − s1. ⭐ La forme NUE `zscore_{tf}` EST le shift 1 — exactement ce que `_s1` désigne
    //   pour le stochastique (même shift chez l'EA). Le D1 était le seul TF sans elle : comblé par
    //   l'EA v8.39 côté live, et par `stats/add_zscore_d1.mjs` côté historique (reconstruction
    //   Bollinger(20) validée contre l'EA à 0,00005 près, 19/19 actifs).
    const zPrev = num(row?.[`zscore_${tf.id}`]);
    const dZ = (z != null && zPrev != null) ? z - zPrev : null;
    const hasDz = zPrev != null;

    // s0 = bougie EN FORMATION (EA v8.37, présent à partir du 18/07 seulement). Avant, le moteur
    //   est structurellement aveugle à la bougie en cours pendant toute sa durée.
    const a0 = tf.adx ? num(row?.[`adx14_${tf.id}_s0`]) : null;
    const a1 = tf.adx ? num(row?.[`adx14_${tf.id}_c1`]) : null;
    const a2 = tf.adx ? num(row?.[`adx14_${tf.id}_c2`]) : null;
    // 3e close : `dominanceTurn` compare DEUX deltas (c1−c2 et c2−c3), il en faut donc trois.
    const a3 = tf.adx ? num(row?.[`adx14_${tf.id}_c3`]) : null;
    const dAdx = (a1 != null && a2 != null) ? a1 - a2 : null;
    const dAdx2 = (a2 != null && a3 != null) ? a2 - a3 : null;

    // DI — exportés sur les mêmes TF que l'ADX (h1/m15). Le c2 sert la dynamique de l'écart.
    // s0 = bougie EN FORMATION. Sert le NIVEAU ; l'écart et sa dynamique restent sur les closes.
    const dp0 = tf.adx ? num(row?.[`plus_di_${tf.id}_s0`]) : null;
    const dm0 = tf.adx ? num(row?.[`minus_di_${tf.id}_s0`]) : null;
    const dp1 = tf.adx ? num(row?.[`plus_di_${tf.id}_c1`]) : null;
    const dm1 = tf.adx ? num(row?.[`minus_di_${tf.id}_c1`]) : null;
    const dp2 = tf.adx ? num(row?.[`plus_di_${tf.id}_c2`]) : null;
    const dm2 = tf.adx ? num(row?.[`minus_di_${tf.id}_c2`]) : null;
    // c3 : sert UNIQUEMENT à dater l'état PRÉCÉDENT. `diGapDynamics` compare deux barres, donc
    //   l'état EN c2 se lit sur le couple (c2, c3). On obtient la SÉQUENCE c2 → c1.
    const dp3 = tf.adx ? num(row?.[`plus_di_${tf.id}_c3`]) : null;
    const dm3 = tf.adx ? num(row?.[`minus_di_${tf.id}_c3`]) : null;

    return {
      tf, chg, chgPct, z, k, kd, kdPrev, a0, a1, dAdx, dK, dZ, hasDz,
      turn: adxTurnBand(dAdx, dAdx2),   // bande morte 1,0 — fonction du MOTEUR, pas une recopie
      gap: (dp1 != null && dm1 != null) ? +(dp1 - dm1).toFixed(2) : null,
      gapBand: diGapBand(dp1, dm1),                       // 5 bandes signées [−23 · −5,5 · +5,5 · +23]
      gapDyn: diGapDynamics(dp1, dm1, dp2, dm2),          // état EN c1  (couple c1/c2)
      gapDynPrev: diGapDynamics(dp2, dm2, dp3, dm3),      // état EN c2  (couple c2/c3) → séquence
      // ── LA FAMILLE DI, camp par camp ────────────────────────────────────────────────────────
      //   ⭐ `diLevelBand` sert les DEUX camps : leurs distributions sont identiques (p35 15,1
      //   contre 15,0 · p95 32,9 contre 32,4), donc une seule échelle [7 · 15 · 21 · 33].
      //   🔴 Les DELTAS n'ont PAS de classificateur : on affiche la valeur brute, la bande reste
      //   à calibrer sur distribution comme les autres. Placeholder assumé, pas un oubli.
      // ⭐ NIVEAU lu en LIVE (`_s0`), repli sur la close — même politique que l'ADX. Les bandes
      //   `[7 · 14,5 · 20,5 · 32]` sont calibrées SUR LE LIVE : les DI décroissent de 13,3 % à chaque
      //   ouverture, ce qui décale toute la distribution live de ~0,7 pt vers le bas.
      //   ⚠ L'ÉCART reste sur les closes et garde ses seuils : la contraction touche les deux DI
      //   pareillement et s'annule presque dans leur différence.
      diPlus: dp0 ?? dp1, diMinus: dm0 ?? dm1,
      diPlusBand: diLevelBand(dp0 ?? dp1), diMinusBand: diLevelBand(dm0 ?? dm1),
      diLive: dp0 != null && dm0 != null,
      dDiPlus:  (dp1 != null && dp2 != null) ? +(dp1 - dp2).toFixed(2) : null,
      dDiMinus: (dm1 != null && dm2 != null) ? +(dm1 - dm2).toFixed(2) : null,
      zBand: zscoreBand(z), kBand: stochZone(k),
      kdBand: kdDistanceBand(kd),
      dKBand: deltaKBand(dK), dZBand: deltaZBand(dZ),   // les deux deltas sont bien des s0 − s1
      kdDyn: kdCycleState(kd, kdPrev),          // état EN s0  (couple s0/s1)
      kdDynPrev: kdCycleState(kdPrev, kd2),     // état EN s1  (couple s1/s2)
      // ⭐🔥 NIVEAU LU SUR LE LIVE (owner 2026-07-26). À 11h52 on ne qualifie pas la pression avec
      //   l'ADX d'une bougie terminée depuis 52 minutes — on lit la bougie EN COURS.
      //   ⚠ Le moteur affirme en commentaire que « l'ADX d'une bougie en formation ne suit pas la
      //   même distribution » : MESURÉ FAUX sur 107 335 lignes (19→25/07). p5/p35/p50/p65/p95 =
      //   15,7/24,6/28,5/33,0/53,8 en s0 contre 15,8/24,7/28,4/33,0/53,0 en c1 — identiques au
      //   dixième. Les bandes [16·24·33·55] valent pour les deux, aucune recalibration.
      //   La BANDE change tout de même sur 17,5 % des barres (8,8 % plus haut, 8,8 % plus bas).
      //   🔴 REPLI SUR c1 quand s0 est absent — c'est le cas AVANT LE 18/07, soit l'essentiel de la
      //   fenêtre de backtest : l'effet de ce changement n'y est pas mesurable.
      adxBand: tf.adx ? adxLevelBand(a0 ?? a1) : null,
      adxBandClose: tf.adx ? adxLevelBand(a1) : null,   // référence, pour comparer à l'écran
    };
  });

  // ⚠ TH/TD viennent de `ui.jsx` (2026-07-26) : la table de scoring doit avoir EXACTEMENT la même
  //   géométrie, et deux jeux de styles copiés divergent toujours.

  // Horodatage : « 2026-07-23T03:16:00Z » → date et heure séparées, pour un affichage lisible de loin.
  const tsUtc = row?.ts_utc ? String(row.ts_utc) : null;
  const tsDate = tsUtc ? tsUtc.slice(0, 10) : null;
  const tsTime = tsUtc ? tsUtc.slice(11, 19) : null;

  return (
    <Panel
      title={`Indicateurs — ${asset ?? "—"}`}
      extra={<span style={{ fontSize: 13, color: T.ink3, fontVariantNumeric: "tabular-nums" }}>
        {idx == null ? "—" : `ligne ${idx + 1} / ${total}`}</span>}
      flex={1}
      bodyStyle={{ padding: 18, overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}
    >
      {/* ── HORODATAGE — l'information de repère la plus consultée : on la met en gros, pas en coin ── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap",
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 15, color: T.ink2, fontVariantNumeric: "tabular-nums" }}>{tsDate ?? "—"}</span>
          <span style={{ fontSize: 30, fontWeight: 700, color: T.ink, letterSpacing: -0.5,
            fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{tsTime ?? "—"}</span>
          <span style={{ fontSize: 13, color: T.ink3, letterSpacing: 0.4 }}>UTC</span>
        </div>
        {row?.timestamp && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, paddingLeft: 18,
            borderLeft: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.6 }}>heure MT5</span>
            <span style={{ fontSize: 17, color: T.ink2, fontVariantNumeric: "tabular-nums" }}>{row.timestamp}</span>
          </div>
        )}
        <div style={{ marginLeft: "auto", fontSize: 13, color: T.ink3, fontVariantNumeric: "tabular-nums" }}>
          {idx == null ? "" : `${idx + 1} / ${total}`}
        </div>
      </div>

      {/* ── ALLER À une date / heure / minute (UTC) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px" }}>
        <span style={{ fontSize: 12, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.6 }}>aller à</span>

        <input type="date" value={selDate} min={minDate} max={maxDate} disabled={busy || !total}
          onChange={(e) => e.target.value && goTo(e.target.value, selHH, selMM)}
          style={{ background: T.surface, color: T.ink, border: `1px solid ${T.borderHi}`, borderRadius: 8,
            padding: "8px 12px", fontSize: 15, fontFamily: "inherit", colorScheme: "dark" }} />

        <select value={selHH} disabled={busy || !selDate}
          onChange={(e) => goTo(selDate, e.target.value, selMM)}
          style={{ background: T.surface, color: T.ink, border: `1px solid ${T.borderHi}`, borderRadius: 8,
            padding: "8px 10px", fontSize: 15, fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={pad2(h)}>{pad2(h)}</option>)}
        </select>
        <span style={{ color: T.ink3, fontSize: 17, marginLeft: -4, marginRight: -4 }}>:</span>
        <select value={selMM} disabled={busy || !selDate}
          onChange={(e) => goTo(selDate, selHH, e.target.value)}
          style={{ background: T.surface, color: T.ink, border: `1px solid ${T.borderHi}`, borderRadius: 8,
            padding: "8px 10px", fontSize: 15, fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}>
          {Array.from({ length: 60 }, (_, m) => <option key={m} value={pad2(m)}>{pad2(m)}</option>)}
        </select>

        <span style={{ fontSize: 13, color: T.ink3 }}>
          {minDate && maxDate ? `dataset ${minDate} → ${maxDate}` : ""}
        </span>
      </div>

      {/* Navigation dans le dataset */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {[["⏮ −100", -100], ["← −1", -1], ["+1 →", 1], ["+100 ⏭", 100]].map(([lbl, step]) => (
          <button key={lbl} type="button" disabled={busy || idx == null}
            onClick={() => load(Math.max(0, Math.min(total - 1, idx + step)))}
            style={{ background: "transparent", color: T.ink2, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: "7px 14px", fontSize: 14, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>{lbl}</button>
        ))}
        <button type="button" onClick={() => load(null)} disabled={busy}
          style={{ background: "transparent", color: T.ink2, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: "7px 14px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>dernière</button>
        <input type="range" min={0} max={Math.max(0, total - 1)} value={idx ?? 0} disabled={!total}
          onChange={(e) => setIdx(Number(e.target.value))}
          onMouseUp={(e) => load(Number(e.target.value))}
          onTouchEnd={(e) => load(Number(e.target.value))}
          style={{ flex: 1, minWidth: 200, accentColor: T.blue, height: 22 }} />
      </div>

      {err && <div style={{ color: T.red, fontSize: 14 }}>{err}</div>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <TH w={40} dense>TF</TH>
              <TH dense>change</TH>
              <TH dense>zscore</TH>
              <TH dense>Δz <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0−s1</span></TH>
              <TH dense>K level</TH>
              <TH dense>ΔK <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0−s1</span></TH>
              <TH dense>K/D gap signé</TH>
              <TH dense>K/D dynamique <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s1 → s0</span></TH>
              {/* ❌ COLONNES ADX RETIRÉES (owner 2026-07-26) : `ADX live`, `ADX c1`, `ΔADX`, `Δ live`.
                  Le pivot est assumé — on suit les DI, pas l'ADX. ⚠ Le Pressure Expert LIT ENCORE
                  `adxBand` et `turn` : son score reste calculé, seul l'affichage disparaît.
                  `dominanceTurn` est gardé, c'est la dernière visibilité sur ce que l'expert consomme. */}
              <TH dense>DI+ level <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>s0 · [7·14,5·20,5·32]</span></TH>
              <TH dense>ΔDI+ <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>c1−c2</span></TH>
              <TH dense>DI− level <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>même échelle</span></TH>
              <TH dense>ΔDI− <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>c1−c2</span></TH>
              <TH dense>Gap DI <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>DI+ − DI−</span></TH>
              <TH dense>Dynamic Gap DI <span style={{ textTransform: "none", letterSpacing: 0, opacity: .65 }}>Δ|écart| · c2 → c1</span></TH>
            </tr>
          </thead>
          <tbody>
            {lines.map((L) => (
              <tr key={L.tf.id}>
                <TD dense><span style={{ fontWeight: 700, color: T.ink, fontSize: 14, letterSpacing: 0.2 }}>{L.tf.label}</span></TD>

                <TD dense>
                  <Val>{L.chgPct == null ? "—" : `${L.chgPct >= 0 ? "+" : ""}${f(L.chgPct)} %`}</Val>
                  <span style={{ color: T.ink3, fontSize: 11 }}>{L.chg == null ? "" : `(${L.chg >= 0 ? "+" : ""}${f(L.chg, 5)})`}</span>
                </TD>

                <TD dense><Val>{f(L.z)}</Val><Band v={L.zBand} /></TD>

                <TD dense>
                  {L.hasDz
                    ? <><span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 550,
                        color: L.dZ == null ? T.ink3 : L.dZ >= 0 ? T.green : T.red, marginRight: 9 }}>
                        {L.dZ == null ? "—" : `${L.dZ >= 0 ? "+" : ""}${f(L.dZ)}`}
                      </span><Band v={L.dZBand} /></>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>pas de s1</span>}
                </TD>

                <TD dense><Val>{f(L.k, 1)}</Val><Band v={L.kBand} /></TD>

                <TD dense>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 550,
                    color: L.dK == null ? T.ink3 : L.dK >= 0 ? T.green : T.red, marginRight: 9 }}>
                    {L.dK == null ? "—" : `${L.dK >= 0 ? "+" : ""}${f(L.dK, 1)}`}
                  </span>
                  <Band v={L.dKBand} />
                </TD>

                <TD dense>
                  <Val>{L.kd == null ? "—" : `${L.kd >= 0 ? "+" : ""}${f(L.kd)}`}</Val>
                  <Band v={L.kdBand} />
                </TD>

                <TD dense>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span style={{ opacity: L.kdDynPrev && L.kdDynPrev !== L.kdDyn ? 0.85 : 0.45 }}>
                      <Band v={L.kdDynPrev} />
                    </span>
                    <span style={{ color: L.kdDynPrev && L.kdDyn && L.kdDynPrev !== L.kdDyn ? T.amber : T.ink3,
                      fontSize: 13, fontWeight: 700 }}>→</span>
                    <Band v={L.kdDyn} />
                  </span>
                </TD>

                {/* ── FAMILLE DI — niveau de chaque camp, puis leur écart ──────────────────── */}
                <TD dense>
                  {L.tf.adx
                    ? <><Val>{f(L.diPlus, 1)}</Val><Band v={L.diPlusBand} /></>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>non exporté</span>}
                </TD>

                {/* 🔴 PLACEHOLDER : valeur brute, bande non calibrée. */}
                <TD dense><DeltaTBD v={L.dDiPlus} on={L.tf.adx} /></TD>

                <TD dense>
                  {L.tf.adx
                    ? <><Val>{f(L.diMinus, 1)}</Val><Band v={L.diMinusBand} /></>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>non exporté</span>}
                </TD>

                <TD dense><DeltaTBD v={L.dDiMinus} on={L.tf.adx} /></TD>

                <TD dense>
                  {L.tf.adx
                    ? <><Val>{L.gap == null ? "—" : `${L.gap >= 0 ? "+" : ""}${f(L.gap, 1)}`}</Val><Band v={L.gapBand} /></>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>non exporté</span>}
                </TD>

                {/* SÉQUENCE c2 → c1, même présentation que `K/D dynamique` : la flèche passe en
                    ambre quand l'état CHANGE — c'est là que l'écart s'inverse. */}
                <TD dense>
                  {L.tf.adx
                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ opacity: L.gapDynPrev && L.gapDynPrev !== L.gapDyn ? 0.85 : 0.45 }}>
                          <Band v={L.gapDynPrev} />
                        </span>
                        <span style={{ color: L.gapDynPrev && L.gapDyn && L.gapDynPrev !== L.gapDyn ? T.amber : T.ink3,
                          fontSize: 13, fontWeight: 700 }}>→</span>
                        <Band v={L.gapDyn} />
                      </span>
                    : <span style={{ color: T.ink3, fontSize: 11, fontStyle: "italic" }}>—</span>}
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── SCORING — même géométrie, sous la table des indicateurs (owner 2026-07-26).
             UNE SEULE table : les experts entrent dans leur colonne, pas dans un bloc à côté.
             ℹ️ `ctx` = contexte niveau-LIGNE pour un expert qui lirait une grandeur non-TF. Aucun
             n'en a besoin depuis que Pressure est orienté par le DI et non plus par l'IC. */}
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
        <ScoringTable lines={lines} />
      </div>
    </Panel>
  );
}
