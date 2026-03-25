import "../styles/performance.css";

export default function Performance({ data, trades = [] }) {

  if (!data) return null;

  // =========================
  // FORMATTERS
  // =========================

  const fmtMoney = (v) => {
    if (!Number.isFinite(v)) return "0";
    return Math.round(v).toLocaleString("fr-FR");
  };

  const fmtPct = (v) => {
    if (!Number.isFinite(v)) return "0";
    return `${Math.round(v)} %`;
  };

  const positive = (v) => (v >= 0 ? "positive" : "negative");

  // Avg Hold (minutes)
  const avgHold = (() => {
    if (!trades.length) return null;
    let sum = 0, count = 0;
    for (const t of trades) {
      if (!t.timestamp || !t.closeTime) continue;
      const parse = (ts) => {
        if (typeof ts !== "string") return NaN;
        const [d, tm] = ts.trim().split(" ");
        if (!d || !tm) return NaN;
        return new Date(`${d.replace(/\./g, "-")}T${tm.length === 5 ? tm + ":00" : tm}`).getTime();
      };
      const diff = parse(t.closeTime) - parse(t.timestamp);
      if (Number.isFinite(diff) && diff >= 0) { sum += diff; count++; }
    }
    return count ? sum / count / 60000 : null;
  })();

  const fmtHold = (min) => {
    if (min == null) return "—";
    if (min >= 60) return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
    return `${Math.round(min)}m`;
  };

  return (
    <div className="neo-card">

      <h3>Performance</h3>

      <div style={{ display: "flex", gap: 32, alignItems: "stretch" }}>

        {/* ================= LEFT — GLOBAL METRICS + TYPE ================= */}
        <div style={{ flex: 1, paddingRight: 32, borderRight: "1px solid #333" }}>
          <div className="neo-performance-grid">
            <Stat label="Initial Equity" value={`${fmtMoney(data.initialEquity)} €`} />
            <Stat label="Final Equity" value={`${fmtMoney(data.finalEquity)} €`} className={positive(data.finalEquity - data.initialEquity)} />
            <Stat label="Performance" value={fmtPct(data.performancePct)} className={positive(data.performancePct)} />
            <Stat label="Total Trades" value={data.totalTrades ?? (data.totalWin + data.totalLose)} />
            <Stat label="Win Rate" value={fmtPct(data.successRate)} />
            <Stat label="Profit Factor" value={data.profitFactor ? data.profitFactor.toFixed(2) : "—"} />
            <Stat label="Expectancy" value={`${fmtMoney(data.expectancy || 0)} €`} className={positive(data.expectancy || 0)} />
            <Stat label="Avg Win" value={`${fmtMoney(data.avgWin || 0)} €`} className="positive" />
            <Stat label="Avg Loss" value={`${fmtMoney(data.avgLoss || 0)} €`} className="negative" />
            <Stat label="Max Drawdown" value={`${fmtMoney(data.maxDrawdown || 0)} €`} className="negative" />
            <Stat label="Avg Hold" value={fmtHold(avgHold)} />
            <Stat label="Total PnL" value={`${fmtMoney(data.totalPnl)} €`} className={positive(data.totalPnl)} />
          </div>
          {trades.length > 0 && (
            <div style={{ borderTop: "1px solid #2d3f55", marginTop: 12, paddingTop: 12 }}>
              <TypeBreakdown trades={trades} />
            </div>
          )}
        </div>

        {/* ================= RIGHT — STATS BY ROUTE ================= */}
        <div style={{ flex: 1, paddingLeft: 8 }}>
          {trades.length > 0 && <RouteBreakdown trades={trades} />}
        </div>

      </div>

    </div>
  );
}

/* =========================
   HELPERS
========================= */

function wrColor(wr) {
  if (wr >= 80) return "#6bcf7f";
  if (wr >= 50) return "#f59e42";
  return "#ef6b6b";
}

function pnlColor(v) {
  if (v > 0) return "#6bcf7f";
  if (v < 0) return "#ef6b6b";
  return "#ddd";
}

function fmtPnl(v) {
  if (!Number.isFinite(v)) return "0";
  return Math.round(v).toLocaleString("fr-FR");
}

function buildGroups(trades, keyFn) {
  const groups = {};
  for (const t of trades) {
    const key = keyFn(t);
    if (!key) continue;
    if (!groups[key]) groups[key] = { total: 0, win: 0, loss: 0, pnl: 0 };
    groups[key].total++;
    groups[key].pnl += (t.pnl ?? 0);
    if (t.pnl >= 0) groups[key].win++;
    else groups[key].loss++;
  }
  return groups;
}

function StatsTable({ title, rows }) {
  if (!rows.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ color: "#ccc", marginBottom: 8, fontSize: "0.95em" }}>{title}</h4>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85em" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={thStyle}>Label</th>
            <th style={thStyle}>Total</th>
            <th style={thStyle}>Win</th>
            <th style={thStyle}>Loss</th>
            <th style={thStyle}>WR%</th>
            <th style={thStyle}>PnL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const wr = r.total > 0 ? (r.win / r.total) * 100 : 0;
            return (
              <tr key={r.label} style={{ borderBottom: "1px solid #222" }}>
                <td style={tdStyle}>{r.label}</td>
                <td style={tdStyleCenter}>{r.total}</td>
                <td style={tdStyleCenter}>{r.win}</td>
                <td style={tdStyleCenter}>{r.loss}</td>
                <td style={{ ...tdStyleCenter, color: wrColor(wr), fontWeight: 600 }}>
                  {wr.toFixed(1)}%
                </td>
                <td style={{ ...tdStyleCenter, color: pnlColor(r.pnl), fontWeight: 600 }}>
                  {fmtPnl(r.pnl)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* =========================
   ROUTE BREAKDOWN
========================= */

function RouteBreakdown({ trades }) {
  const groups = buildGroups(trades, t => t.route ?? null);

  const routeOrder = [
    "BUY-R-[0-25]", "BUY-R-[25-30]", "BUY-R-[30-35]",
    "SELL-C-[30-35]",
    "BUY-C-[35-50]", "SELL-C-[35-50]",
    "BUY-C-[50-65]", "SELL-C-[50-65]",
    "BUY-C-[65-70]",
    "SELL-R-[65-70]", "SELL-R-[70-75]", "SELL-R-[75-100]",
  ];

  const rows = routeOrder
    .filter(k => groups[k])
    .map(k => ({ label: k, ...groups[k] }));

  // Add any unlisted routes
  for (const k of Object.keys(groups)) {
    if (!routeOrder.includes(k)) rows.push({ label: k, ...groups[k] });
  }

  return <StatsTable title="Stats by Route" rows={rows} />;
}

/* =========================
   TYPE BREAKDOWN (REV / CONT)
========================= */

function TypeBreakdown({ trades }) {
  const groups = buildGroups(trades, t => {
    const type = String(t.type ?? "").toUpperCase();
    const side = t.side ?? "";
    return type && side ? `${type}_${side}` : null;
  });

  const order = ["REVERSAL_BUY", "REVERSAL_SELL", "CONTINUATION_BUY", "CONTINUATION_SELL"];
  const rows = order
    .filter(k => groups[k])
    .map(k => ({ label: k, ...groups[k] }));

  for (const k of Object.keys(groups)) {
    if (!order.includes(k)) rows.push({ label: k, ...groups[k] });
  }

  return <StatsTable title="Stats by Type" rows={rows} />;
}

const thStyle = { textAlign: "left", padding: "4px 8px", color: "#888", fontWeight: 500 };
const tdStyle = { padding: "4px 8px", color: "#ddd" };
const tdStyleCenter = { padding: "4px 8px", color: "#ddd", textAlign: "center" };

/* =========================
   SMALL STAT COMPONENT
========================= */

function Stat({ label, value, className = "" }) {
  return (
    <div className="neo-stat-block">
      <div className="stat-row">
        <span className="stat-label">{label}:</span>
        <span className={`stat-value ${className}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
