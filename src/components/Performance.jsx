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

  return (
    <div className="neo-card">

      <h3>Performance</h3>

      <div style={{ display: "flex", gap: 32, alignItems: "stretch" }}>

        {/* ================= LEFT — GLOBAL METRICS ================= */}
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
            <Stat label="Total PnL" value={`${fmtMoney(data.totalPnl)} €`} className={positive(data.totalPnl)} />
          </div>
        </div>

        {/* ================= RIGHT — STATS BY SIGNAL TYPE ================= */}
        <div style={{ flex: 1, paddingLeft: 8 }}>
          {trades.length > 0 && <SignalBreakdown trades={trades} />}
        </div>

      </div>

    </div>
  );
}

/* =========================
   SIGNAL BREAKDOWN TABLE
========================= */

function getGroupKey(trade) {
  if (trade.signalType === "BUY_ZMID")  return "BUY_ZMID";
  if (trade.signalType === "SELL_ZMID") return "SELL_ZMID";
  if (trade.signalType === "BUY_EARLY" ||
      trade.signalType === "SELL_EARLY") return "REVERSAL_" + trade.side + "_EARLY";
  return trade.type + "_" + trade.side;
}

function wrColor(wr) {
  if (wr >= 80) return "#6bcf7f";
  if (wr >= 50) return "#f59e42";
  return "#ef6b6b";
}

function SignalBreakdown({ trades }) {
  const groups = {};

  for (const t of trades) {
    const label = getGroupKey(t);
    if (!groups[label]) groups[label] = { total: 0, win: 0, loss: 0 };
    groups[label].total++;
    if (t.pnl >= 0) groups[label].win++;
    else groups[label].loss++;
  }

  const order = ["REVERSAL_BUY", "REVERSAL_BUY_EARLY", "REVERSAL_SELL", "REVERSAL_SELL_EARLY", "BUY_ZMID", "SELL_ZMID", "CONTINUATION_BUY", "CONTINUATION_SELL"];
  const rows = order.filter(k => groups[k]).map(k => ({ label: k, ...groups[k] }));

  // Add any unlisted groups
  for (const k of Object.keys(groups)) {
    if (!order.includes(k)) rows.push({ label: k, ...groups[k] });
  }

  if (!rows.length) return null;

  return (
    <div>
      <h4 style={{ color: "#ccc", marginBottom: 8, fontSize: "0.95em" }}>Stats by Signal Type</h4>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "0.85em",
      }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={thStyle}>Signal</th>
            <th style={thStyle}>Total</th>
            <th style={thStyle}>Win</th>
            <th style={thStyle}>Loss</th>
            <th style={thStyle}>WR%</th>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
