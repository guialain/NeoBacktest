import "../styles/performance.css";

export default function Performance({ data }) {

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

  // =========================
  // EQUITY CURVE SVG
  // =========================

  const equityData = data.equityCurve || [];

  const width = 600;
  const height = 260;
  const padding = 30;

  let path = "";

  if (equityData.length > 1) {
    const values = equityData.map(p => p.equity);
    const min = Math.min(...values);
    const max = Math.max(...values);

    const xStep = (width - padding * 2) / (equityData.length - 1);

    path = equityData.map((point, i) => {

      const x = padding + i * xStep;

      const y =
        padding +
        ((max - point.equity) / (max - min || 1)) *
        (height - padding * 2);

      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  }

  return (
    <div className="neo-card">

      <h3>Performance</h3>

      <div className="neo-performance-wrapper">

        {/* ================= LEFT — STATS ================= */}

        <div className="neo-performance-left">

          <div className="neo-performance-grid">

            <Stat label="Initial Equity" value={`${fmtMoney(data.initialEquity)} €`} />

            <Stat
              label="Final Equity"
              value={`${fmtMoney(data.finalEquity)} €`}
              className={positive(data.finalEquity - data.initialEquity)}
            />

            <Stat
              label="Performance"
              value={fmtPct(data.performancePct)}
              className={positive(data.performancePct)}
            />

            <Stat
              label="Total Trades"
              value={data.totalTrades ?? (data.totalWin + data.totalLose)}
            />

            <Stat
              label="Win Rate"
              value={fmtPct(data.successRate)}
            />

            <Stat
              label="Profit Factor"
              value={data.profitFactor ? data.profitFactor.toFixed(2) : "—"}
            />

            <Stat
              label="Expectancy"
              value={`${fmtMoney(data.expectancy || 0)} €`}
              className={positive(data.expectancy || 0)}
            />

            <Stat
              label="Avg Win"
              value={`${fmtMoney(data.avgWin || 0)} €`}
              className="positive"
            />

            <Stat
              label="Avg Loss"
              value={`${fmtMoney(data.avgLoss || 0)} €`}
              className="negative"
            />

            <Stat
              label="Max Drawdown"
              value={`${fmtMoney(data.maxDrawdown || 0)} €`}
              className="negative"
            />

            <Stat
              label="Total PnL"
              value={`${fmtMoney(data.totalPnl)} €`}
              className={positive(data.totalPnl)}
            />

          </div>

        </div>

        {/* ================= RIGHT — EQUITY CURVE ================= */}

        <div className="neo-performance-right">

          <div className="neo-chart-title">
            Equity Curve
          </div>

          <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="neo-equity-chart"
          >
            <rect
              x="0"
              y="0"
              width={width}
              height={height}
              fill="none"
            />

            {path && (
              <path
                d={path}
                fill="none"
                stroke="#00e6a7"
                strokeWidth="2.5"
              />
            )}
          </svg>

        </div>

      </div>
    </div>
  );
}

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
