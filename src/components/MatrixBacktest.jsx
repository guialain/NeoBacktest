import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
// Tokens + primitives : SOURCE UNIQUE dans ui.jsx (partagés avec SignalsPage — cf note d'extraction).
import { T, Panel, Chip, pos, empty, N } from "./ui.jsx";
import SignalsPage from "./SignalsPage.jsx";

const API = "http://localhost:3001/api/matrix";
const money = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—");
const MONTHS = { "01": "jan", "02": "fév", "03": "mars", "04": "avr", "05": "mai", "06": "juin", "07": "juil", "08": "août", "09": "sep", "10": "oct", "11": "nov", "12": "déc" };

// Détail par PROFIL (régime couche-2 gagnant) × side.
// ⚠ DÉRIVÉ DES TRADES, pas d'une liste en dur (owner 2026-07-17). L'ancienne liste de 10 lignes fixes avait
//   silencieusement pourri : elle gardait "Range" (SUPPRIMÉ le 13/07 → 2 lignes mortes à zéro) et ignorait
//   "Transitioning" (ajouté le 16/07 → ~26 % des trades INVISIBLES). Une liste en dur ne signale pas qu'elle
//   est périmée — elle affiche juste un total faux. Dériver = la table suit le moteur sans intervention.
// ORDER = ordre d'affichage seulement (spectre bear→bull du moteur, cf PROFILES de MarketProfileKnowledge).
//   Un profil inconnu de cette liste n'est PAS masqué : il tombe en fin de table. C'est le point.
const PROFILE_ORDER = ["Sell-off", "Strong Bear", "Soft Bear", "Exhaustion", "Transitioning", "Soft Bull", "Strong Bull", "Rally"];
const SIG_LABEL = { CONT: "cont", EXH: "exh", TRANS: "trans" };
function profileStats(signals) {
  // Couples (profil × side) RÉELLEMENT produits. Groupés par Map : PAS de clé-chaîne concaténée — les noms
  //   de profil contiennent des espaces ("Strong Bull"), toute re-séparation serait un piège.
  const groups = new Map();
  for (const x of signals) {
    if (!x.profile) continue;
    if (!groups.has(x.profile)) groups.set(x.profile, {});
    const bySide = groups.get(x.profile);
    (bySide[x.side] ??= []).push(x);
  }
  const rank = (p) => { const i = PROFILE_ORDER.indexOf(p); return i === -1 ? PROFILE_ORDER.length : i; };
  const rows = [];
  for (const [profile, bySide] of groups) for (const side of Object.keys(bySide)) rows.push({ profile, side });
  rows.sort((a, b) => (rank(a.profile) - rank(b.profile)) || a.profile.localeCompare(b.profile) || a.side.localeCompare(b.side));
  return rows.map(({ profile, side }) => {
    const g = groups.get(profile)[side];
    // sig = libellé famille, LU sur les trades (le moteur route TRANS en famille EXH → on garde la distinction)
    const sig = `${SIG_LABEL[g[0]?.type === "TRANS" ? "TRANS" : g[0]?.strategy] ?? "?"} ${side.toLowerCase()}`;
    const n = g.length;
    const wins = g.filter((x) => x.outcome === "WIN").length;
    const losses = g.filter((x) => x.outcome === "LOSS").length;
    const dec = wins + losses;   // outcome binaire (WIN|LOSS) → dec = tous les trades ; WR = wins/dec
    const totalR = g.reduce((a, x) => a + x.R, 0);
    return { profile, side, sig, n, wr: dec ? +(100 * wins / dec).toFixed(1) : null, avgR: n ? +(totalR / n).toFixed(3) : null, totalR: +totalR.toFixed(2) };
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
  const [assets, setAssets] = useState([]);
  const [asset, setAsset] = useState("");
  const [p, setP] = useState({ tpAtr: 0.65, slAtr: 1.95, maxOpen: 30, cadenceMin: 2, initialEquity: 10000, riskPct: 1, admission: true });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  // Filtre catégorie (frontend, un seul actif) : {kind:'profile',profile,side,sig} | {kind:'cascade'} | null
  const [filter, setFilter] = useState(null);
  const [outcomeFilter, setOutcomeFilter] = useState(null);   // null | 'WIN' | 'LOSS' | 'TIMEOUT' (compose avec filter)
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
  const sigs = res ? res.signals.filter((x) => inRange(x.tsMT)) : [];   // base = signaux DANS la plage

  // dérivés frontend (recalculés sur la plage)
  const profs = res ? profileStats(sigs) : [];
  const overall = res ? (() => {
    const g = sigs, n = g.length, wins = g.filter((x) => x.outcome === "WIN").length, losses = g.filter((x) => x.outcome === "LOSS").length, dec = wins + losses, totalR = g.reduce((a, x) => a + x.R, 0);
    return { n, wr: dec ? +(100 * wins / dec).toFixed(1) : null, avgR: n ? +(totalR / n).toFixed(3) : null, totalR: +totalR.toFixed(2) };
  })() : null;
  const casc = res ? cascadeFlags(sigs) : [];
  const be = res ? 100 * res.params.slAtr / (res.params.slAtr + res.params.tpAtr) : 75;   // breakeven WR pour ce R:R
  const wrColor = (wr) => (wr == null ? T.ink3 : wr >= be ? T.green : wr >= be - 12 ? T.amber : T.red);

  // ── Filtre : clic ligne profil (toggle) / clic cascade (remplace le filtre profil) → liste Signaux filtrée ──
  const profFilter = filter?.kind === "profile" ? filter : null;
  const clickProfile = (c) => { if (c.n > 0) setFilter((f) => (f && f.kind === "profile" && f.profile === c.profile && f.side === c.side) ? null : { kind: "profile", profile: c.profile, side: c.side, sig: c.sig }); };
  const clickCascade = () => setFilter((f) => (f && f.kind === "cascade") ? null : { kind: "cascade" });
  const allRows = res ? sigs.map((sig, idx) => ({ sig, idx, casc: casc[idx] })) : [];
  let shownRows = allRows;
  if (filter) shownRows = filter.kind === "cascade" ? shownRows.filter((r) => r.casc) : shownRows.filter((r) => r.sig.profile === filter.profile && r.sig.side === filter.side);
  if (outcomeFilter) shownRows = shownRows.filter((r) => (outcomeFilter === "WIN" || outcomeFilter === "LOSS") ? r.sig.outcome === outcomeFilter : r.sig.reason === outcomeFilter);

  // ── DIAGNOSTIC ADX (console) : dump la SÉLECTION COURANTE (tous filtres appliqués) → « je lance COCOA,
  //   je clique Loss, je vois à quel niveau d'ADX ces trades ont tiré ». Table + histogramme par bande de 5.
  //   Lecture seule : n'influence ni la décision ni l'affichage.
  useEffect(() => {
    if (!res || !shownRows.length) return;
    const rows = shownRows.map(({ sig }) => sig);
    const vals = rows.map((x) => x.adx).filter((v) => v != null).sort((a, b) => a - b);
    const q = (p) => (vals.length ? +vals[Math.min(vals.length - 1, Math.floor(p * vals.length))].toFixed(1) : null);
    const label = [res.asset, filter ? (filter.kind === "cascade" ? "cascade" : `${filter.profile}·${filter.side}`) : null, outcomeFilter]
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
      console.table(rows.map((x) => ({ ts: x.tsMT, side: x.side, type: x.type, profile: x.profile, adx: x.adx, dAdx: x.dAdx, R: x.R, outcome: x.outcome })));
    }
    console.groupEnd();
  }, [res, filter, outcomeFilter, dateFrom, dateTo]);

  let domain = ["auto", "auto"], accent = T.green, curveData = [];
  if (res && rangeActive && sigs.length > 0) {
    // Plage active : reconstruit la courbe = equity cumulée (initialEquity + Σ pnl) sur les trades de la plage.
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

  const Field = ({ label, k, w }) => (
    <div className="field" style={{ width: w }}>
      <div style={{ fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase", color: T.ink3, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap" }}>{label}</div>
      {k === "_asset"
        ? <select value={asset} onChange={(e) => setAsset(e.target.value)}>{assets.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        : <input value={p[k]} onChange={set(k)} />}
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
        .mx .cat tbody tr.click { cursor: pointer; }
        .mx .cat tbody tr.click:hover td { background: #1c2330; }
        .mx .cat tbody tr.active td { background: #4493f81f; }
        .mx .casclink:hover { text-decoration: underline; }
      `}</style>

      {/* Header + onglets. Les deux pages partagent le MÊME run (`res`) : basculer ne relance rien. */}
      <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 11, padding: "14px 20px" }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>Matrix Backtest</h1>
        <span style={{ fontSize: 12.5, color: T.ink2 }}>moteur prod (SSOT) · par actif · timestamps MT</span>
        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {[["Backtest", "bt"], ["Signaux", "sig"]].map(([lbl, id]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              style={{ background: tab === id ? T.blue + "22" : "transparent", color: tab === id ? T.blue : T.ink3,
                border: `1px solid ${tab === id ? T.blue + "66" : T.border}`, borderRadius: 7, padding: "4px 12px",
                fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>{lbl}</button>
          ))}
        </div>
        {err && <span style={{ marginLeft: "auto", color: T.red, fontSize: 12.5 }}>{err}</span>}
      </div>

      {tab === "sig" ? (
        <div style={{ flex: 1, minHeight: 0, padding: "0 20px 20px" }}>
          <SignalsPage res={res} asset={res?.asset ?? asset} />
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
              <Field label="Actif" k="_asset" w={138} />
              <Field label="TP ×ATR" k="tpAtr" w={62} />
              <Field label="SL ×ATR" k="slAtr" w={62} />
              <Field label="Max open" k="maxOpen" w={62} />
              <Field label="Cadence" k="cadenceMin" w={62} />
              <Field label="Equity €" k="initialEquity" w={76} />
              <Field label="Risque %" k="riskPct" w={62} />
              <div className="field" style={{ width: 92 }}>
                <div style={{ fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase", color: T.ink3, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap" }}>Admission</div>
                <button type="button" onClick={() => setP({ ...p, admission: !p.admission })} title="Gates heures + tick_low (marché mort / hors séance) — comme le live"
                  style={{ width: "100%", padding: "7px 0", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                    border: `1px solid ${p.admission ? T.green : T.borderHi}`, background: p.admission ? "rgba(63,185,80,0.14)" : T.bg,
                    color: p.admission ? T.green : T.ink3 }}>
                  {p.admission ? "ON" : "OFF"}
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
                  <Tile label="Return" value={`${s.returnPct >= 0 ? "+" : ""}${N(s.returnPct)}%`} color={pos(s.returnPct)} sub={`${s.netPnL >= 0 ? "+" : ""}${money(s.netPnL)} €`} />
                  <Tile label="Equity" value={`${money(s.finalEquity)} €`} color={s.finalEquity >= s.initialEquity ? T.green : T.red} sub={`départ ${money(s.initialEquity)}`} />
                  <Tile label="Win rate" value={`${N(s.winRate)}%`} sub={`${s.wins}W · ${s.losses}L`} />
                  <Tile label="Max DD" value={`−${N(s.maxDrawdownPct)}%`} color={T.amber} sub={`−${money(s.maxDrawdown)} €`} />
                  <Tile label="Profit factor" value={N(s.profitFactor)} color={s.profitFactor >= 1 ? T.green : T.red} sub={`avg R ${N(s.avgR)}`} />
                  <Tile label="Trades" value={s.opened} sub={`${s.fires} fires·${s.rejectedCap} cap`} />
                  <Tile label="Admission" value={res.params.admission === false ? "OFF" : (s.admBlocked ?? 0)} color={res.params.admission === false ? T.ink3 : T.amber}
                    sub={res.params.admission === false ? "gates désactivés" : `${s.admTick ?? 0} tick·${s.admHours ?? 0} hrs écartés`} />
                </div>

                {/* Détail par PROFIL × side */}
                <div style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: T.ink3, fontWeight: 600, margin: "18px 0 8px" }}>
                  Détail par profil <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· régime couche 2 × signal · WR vs breakeven {be.toFixed(0)}%</span>
                </div>
                <table className="cat">
                  <thead><tr>{["Profil", "Signal", "N", "WR", "Avg R", "Total R"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {profs.map((c) => (
                      <tr key={c.profile + c.side}
                        className={(c.n > 0 ? "click" : "") + (profFilter && profFilter.profile === c.profile && profFilter.side === c.side ? " active" : "")}
                        onClick={() => clickProfile(c)}>
                        <td><span style={{ color: c.side === "BUY" ? T.green : T.red, fontWeight: 600 }}>{c.profile}</span></td>
                        <td style={{ color: T.ink3 }}>{c.sig}</td>
                        <td style={{ color: c.n ? T.ink : T.ink3 }}>{c.n || "—"}</td>
                        <td style={{ color: wrColor(c.wr), fontWeight: 600 }}>{c.wr == null ? "—" : `${c.wr}%`}</td>
                        <td style={{ color: c.avgR == null ? T.ink3 : pos(c.avgR) }}>{c.avgR == null ? "—" : c.avgR}</td>
                        <td style={{ color: c.n ? pos(c.totalR) : T.ink3, fontWeight: 600 }}>{c.n ? c.totalR : "—"}</td>
                      </tr>
                    ))}
                    <tr className={"click" + (!filter ? " active" : "")} onClick={() => setFilter(null)} style={{ borderTop: `2px solid ${T.border}` }}>
                      <td colSpan={2} style={{ color: T.ink, fontWeight: 700, textTransform: "uppercase", fontSize: 11, letterSpacing: 0.4 }}>Overall</td>
                      <td style={{ color: T.ink, fontWeight: 700 }}>{overall.n}</td>
                      <td style={{ color: wrColor(overall.wr), fontWeight: 700 }}>{overall.wr == null ? "—" : `${overall.wr}%`}</td>
                      <td style={{ color: overall.avgR == null ? T.ink3 : pos(overall.avgR), fontWeight: 700 }}>{overall.avgR == null ? "—" : overall.avgR}</td>
                      <td style={{ color: pos(overall.totalR), fontWeight: 700 }}>{overall.totalR}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Synthèse (conservée) */}
                <div style={{ fontSize: 11.5, color: T.ink2, marginTop: 14, lineHeight: 1.9 }}>
                  {Object.entries(s.byType).map(([k, v]) => <span key={k} style={{ marginRight: 12 }}><b style={{ color: T.ink }}>{v}</b> {k.toLowerCase()}</span>)}
                  &nbsp;·&nbsp; total R <b style={{ color: pos(s.totalR) }}>{N(s.totalR)}</b>
                  &nbsp;·&nbsp; sortie <b style={{ color: T.green }}>{s.byReason?.TP ?? 0}</b> TP · <b style={{ color: T.red }}>{s.byReason?.SL ?? 0}</b> SL · <b style={{ color: T.amber }}>{s.byReason?.TIMEOUT ?? 0}</b> timeout
                  <br />
                  <b style={{ color: T.green }}>{s.bySide.BUY}</b> buy · <b style={{ color: T.red }}>{s.bySide.SELL}</b> sell &nbsp;·&nbsp; {s.rows} rows · {s.evals} évals · {res.params.admission === false ? <b style={{ color: T.ink3 }}>admission OFF</b> : <><b style={{ color: T.amber }}>{s.admBlocked ?? 0}</b> écartés admission (marché mort / hors séance)</>}
                </div>
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
                <b style={{ color: T.ink }}>{filter.kind === "cascade" ? "cascades (≥3 LOSS consécutifs)" : `${filter.profile} · ${filter.sig}`}</b>
                <span style={{ color: T.ink3 }}>({shownRows.length})</span>
                <button onClick={() => setFilter(null)} style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${T.border}`, color: T.ink2, borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>effacer ✕</button>
              </div>
            ) : null}
            bodyStyle={{ overflow: "auto" }}>
            {!res ? <div style={empty}>Lance un backtest</div> : (
              <table>
                <thead><tr>{["Timestamp (MT)", "Side", "Type", "ADX", "ΔADX", "Entry", "TP", "SL", "Exit", "Outcome", "Reason", "R", "PnL €", "min"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {shownRows.length === 0
                    ? <tr><td colSpan={14} style={{ color: T.ink3, textAlign: "center", padding: 30 }}>aucun trade pour ce filtre</td></tr>
                    : shownRows.map(({ sig, idx, casc: cflag }) => (
                      <tr key={idx} className={cflag ? "casc" : undefined}>
                        <td className="mono" style={{ color: T.ink2 }}>{sig.tsMT}</td>
                        <td style={{ color: sig.side === "BUY" ? T.green : T.red, fontWeight: 600 }}>{sig.side}</td>
                        <td style={{ color: T.ink2 }}>{sig.type}</td>
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
