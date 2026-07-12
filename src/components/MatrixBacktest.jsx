import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";

const API = "http://localhost:3001/api/matrix";
const N = (v) => (Number.isFinite(Number(v)) ? Number(v) : "—");
const money = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—");

// ── Design tokens (sombre pro — Primer-like) ──
const T = {
  bg: "#0d1117", surface: "#161b22", border: "#21262d", borderHi: "#30363d",
  ink: "#e6edf3", ink2: "#8b949e", ink3: "#6e7681",
  blue: "#4493f8", green: "#3fb950", red: "#f85149", amber: "#d29922",
};
const pos = (v) => (Number(v) >= 0 ? T.green : T.red);

// Détail par PROFIL (régime couche-2 gagnant) × side — 10 lignes fixes (profil → type déterministe).
const PROFILE_ROWS = [
  ["Strong Bull", "BUY", "cont buy"], ["Soft Bull", "BUY", "cont buy"], ["Rally", "BUY", "cont buy"],
  ["Strong Bear", "SELL", "cont sell"], ["Soft Bear", "SELL", "cont sell"], ["Sell-off", "SELL", "cont sell"],
  ["Range", "BUY", "range buy"], ["Range", "SELL", "range sell"],
  ["Exhaustion", "BUY", "exh buy"], ["Exhaustion", "SELL", "exh sell"],
];
function profileStats(signals) {
  return PROFILE_ROWS.map(([profile, side, sig]) => {
    const g = signals.filter((x) => x.profile === profile && x.side === side);
    const n = g.length;
    const wins = g.filter((x) => x.outcome === "WIN").length;
    const losses = g.filter((x) => x.outcome === "LOSS").length;
    const dec = wins + losses;   // WR = wins/(wins+losses), timeouts exclus (cohérent avec la tuile Win rate)
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

function Panel({ title, extra, banner, children, flex, bodyStyle }) {
  return (
    <div style={{ flex, minHeight: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {title && (
        <div style={{ flex: "none", padding: "11px 16px 9px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", color: T.ink3, fontWeight: 600 }}>{title}</span>
          {extra}
        </div>
      )}
      {banner}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", ...bodyStyle }}>{children}</div>
    </div>
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

const empty = { color: T.ink3, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" };

export default function MatrixBacktest() {
  const [assets, setAssets] = useState([]);
  const [asset, setAsset] = useState("");
  const [p, setP] = useState({ tpAtr: 0.65, slAtr: 1.95, maxOpen: 30, cadenceMin: 2, initialEquity: 10000, riskPct: 1 });
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  // Filtre catégorie (frontend, un seul actif) : {kind:'profile',profile,side,sig} | {kind:'cascade'} | null
  const [filter, setFilter] = useState(null);
  const [outcomeFilter, setOutcomeFilter] = useState(null);   // null | 'WIN' | 'LOSS' | 'TIMEOUT' (compose avec filter)

  useEffect(() => {
    fetch(`${API}/assets`).then((r) => r.json()).then((a) => { setAssets(a); if (a[0]) setAsset(a[0]); }).catch((e) => setErr(String(e)));
  }, []);

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

  // dérivés frontend (recalculés à chaque run via res)
  const profs = res ? profileStats(res.signals) : [];
  const overall = res ? (() => {
    const g = res.signals, n = g.length, wins = g.filter((x) => x.outcome === "WIN").length, losses = g.filter((x) => x.outcome === "LOSS").length, dec = wins + losses, totalR = g.reduce((a, x) => a + x.R, 0);
    return { n, wr: dec ? +(100 * wins / dec).toFixed(1) : null, avgR: n ? +(totalR / n).toFixed(3) : null, totalR: +totalR.toFixed(2) };
  })() : null;
  const casc = res ? cascadeFlags(res.signals) : [];
  const be = res ? 100 * res.params.slAtr / (res.params.slAtr + res.params.tpAtr) : 75;   // breakeven WR pour ce R:R
  const wrColor = (wr) => (wr == null ? T.ink3 : wr >= be ? T.green : wr >= be - 12 ? T.amber : T.red);

  // ── Filtre : clic ligne profil (toggle) / clic cascade (remplace le filtre profil) → liste Signaux filtrée ──
  const profFilter = filter?.kind === "profile" ? filter : null;
  const clickProfile = (c) => { if (c.n > 0) setFilter((f) => (f && f.kind === "profile" && f.profile === c.profile && f.side === c.side) ? null : { kind: "profile", profile: c.profile, side: c.side, sig: c.sig }); };
  const clickCascade = () => setFilter((f) => (f && f.kind === "cascade") ? null : { kind: "cascade" });
  const allRows = res ? res.signals.map((sig, idx) => ({ sig, idx, casc: casc[idx] })) : [];
  let shownRows = allRows;
  if (filter) shownRows = filter.kind === "cascade" ? shownRows.filter((r) => r.casc) : shownRows.filter((r) => r.sig.profile === filter.profile && r.sig.side === filter.side);
  if (outcomeFilter) shownRows = shownRows.filter((r) => outcomeFilter === "TIMEOUT" ? String(r.sig.outcome).startsWith("TIMEOUT") : r.sig.outcome === outcomeFilter);

  let domain = ["auto", "auto"], accent = T.green, curveData = [];
  if (res?.equityCurve?.length > 1) {
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

      {/* Header */}
      <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 11, padding: "14px 20px" }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>Matrix Backtest</h1>
        <span style={{ fontSize: 12.5, color: T.ink2 }}>moteur prod (SSOT) · par actif · timestamps MT</span>
        {err && <span style={{ marginLeft: "auto", color: T.red, fontSize: 12.5 }}>{err}</span>}
      </div>

      {/* Grille 2×2 — 40% / 60% */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, padding: "0 20px 20px" }}>

        {/* Colonne gauche 40% : Paramètres (auto) / Résultats (reste) */}
        <div style={{ flex: "40 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel title="Paramètres" flex="20 1 0" bodyStyle={{ overflow: "auto" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", padding: 14 }}>
              <Field label="Actif" k="_asset" w={138} />
              <Field label="TP ×ATR" k="tpAtr" w={62} />
              <Field label="SL ×ATR" k="slAtr" w={62} />
              <Field label="Max open" k="maxOpen" w={62} />
              <Field label="Cadence" k="cadenceMin" w={62} />
              <Field label="Equity €" k="initialEquity" w={76} />
              <Field label="Risque %" k="riskPct" w={62} />
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
                  <Tile label="Win rate" value={`${N(s.winRate)}%`} sub={`${s.wins}W·${s.losses}L·${s.timeouts}TO`} />
                  <Tile label="Max DD" value={`−${N(s.maxDrawdownPct)}%`} color={T.amber} sub={`−${money(s.maxDrawdown)} €`} />
                  <Tile label="Profit factor" value={N(s.profitFactor)} color={s.profitFactor >= 1 ? T.green : T.red} sub={`avg R ${N(s.avgR)}`} />
                  <Tile label="Trades" value={s.opened} sub={`${s.fires} fires·${s.rejectedCap} cap`} />
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
                  <br />
                  <b style={{ color: T.green }}>{s.bySide.BUY}</b> buy · <b style={{ color: T.red }}>{s.bySide.SELL}</b> sell &nbsp;·&nbsp; {s.rows} rows · {s.evals} évals
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
                <div style={{ display: "flex", gap: 3 }}>
                  {[["Tous", null], ["Win", "WIN"], ["Loss", "LOSS"], ["TO", "TIMEOUT"]].map(([lbl, val]) => {
                    const on = outcomeFilter === val;
                    const col = val === "WIN" ? T.green : val === "LOSS" ? T.red : val === "TIMEOUT" ? T.amber : T.blue;
                    return <button key={lbl} onClick={() => setOutcomeFilter(val)} style={{ background: on ? col + "22" : "transparent", color: on ? col : T.ink3, border: `1px solid ${on ? col + "66" : T.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer", outline: "none" }}>{lbl}</button>;
                  })}
                </div>
                <span style={{ fontSize: 11.5, color: T.ink2 }}>
                  {(filter || outcomeFilter) ? `${shownRows.length} / ${res.signals.length}` : res.signals.length} trades
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
                <thead><tr>{["Timestamp (MT)", "Side", "Type", "Entry", "TP", "SL", "Exit", "Outcome", "R", "PnL €", "min"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {shownRows.length === 0
                    ? <tr><td colSpan={11} style={{ color: T.ink3, textAlign: "center", padding: 30 }}>aucun trade pour ce filtre</td></tr>
                    : shownRows.map(({ sig, idx, casc: cflag }) => (
                      <tr key={idx} className={cflag ? "casc" : undefined}>
                        <td className="mono" style={{ color: T.ink2 }}>{sig.tsMT}</td>
                        <td style={{ color: sig.side === "BUY" ? T.green : T.red, fontWeight: 600 }}>{sig.side}</td>
                        <td style={{ color: T.ink2 }}>{sig.type}</td>
                        <td className="mono">{sig.entry}</td>
                        <td className="mono" style={{ color: T.green, opacity: 0.85 }}>{sig.tp}</td>
                        <td className="mono" style={{ color: T.red, opacity: 0.85 }}>{sig.sl}</td>
                        <td className="mono" style={{ color: T.ink2 }}>{sig.exit}</td>
                        <td><span style={{ fontWeight: 600, fontSize: 10.5, padding: "2px 7px", borderRadius: 5, background: (sig.outcome === "WIN" ? T.green : sig.outcome === "LOSS" ? T.red : T.amber) + "1e", color: sig.outcome === "WIN" ? T.green : sig.outcome === "LOSS" ? T.red : T.amber }}>{sig.outcome}</span></td>
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
    </div>
  );
}
