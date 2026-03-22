import { useState, useMemo } from "react";
import "../styles/results.css";

function computeDurationHours(openTs, closeTs) {
  if (!openTs || !closeTs) return null;

  function parse(ts) {
    if (typeof ts !== "string") return NaN;
    const [datePart, timePart] = ts.trim().split(" ");
    if (!datePart || !timePart) return NaN;

    const iso = `${datePart.replace(/\./g, "-")}T${
      timePart.length === 5 ? timePart + ":00" : timePart
    }`;

    return new Date(iso).getTime();
  }

  const diff = parse(closeTs) - parse(openTs);
  if (!Number.isFinite(diff) || diff < 0) return null;

  return diff / 3600000;
}

export default function Results({ trades = [], initialEquity = 0 }) {

  const [sortConfig, setSortConfig] = useState({
    key: "timestamp",
    direction: "desc"
  });

  const [filter, setFilter] = useState("all"); // "all" | "loss" | "win"

  function handleSort(key) {
    setSortConfig(prev => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc"
          ? "desc"
          : "asc"
    }));
  }

  function sortIcon(key) {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? " ↑" : " ↓";
  }

  // =========================
  // SORT + EQUITY REBUILD
  // =========================

  const sortedTrades = useMemo(() => {

    const chronological = [...trades].sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    let runningEquity = initialEquity;

    const withEquity = chronological.map(t => {
      runningEquity += Number(t.pnl) || 0;

      return {
        ...t,
        durationHours: computeDurationHours(t.timestamp, t.closeTime),
        equity: runningEquity
      };
    });

    if (!sortConfig.key) return withEquity;

    return [...withEquity].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (!isNaN(aVal) && !isNaN(bVal)) {
        return sortConfig.direction === "asc"
          ? Number(aVal) - Number(bVal)
          : Number(bVal) - Number(aVal);
      }

      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

  }, [trades, sortConfig, initialEquity]);

  const visibleTrades = useMemo(() => {
    if (filter === "loss") return sortedTrades.filter(t => t.pnl < 0);
    if (filter === "win")  return sortedTrades.filter(t => t.pnl >= 0);
    return sortedTrades;
  }, [sortedTrades, filter]);

  const formatPrice = v => {
    if (!Number.isFinite(v)) return "—";
    // 5 décimales pour forex (< 100), 2 décimales pour indices/matières premières
    return v < 100 ? Number(v).toFixed(5) : Number(v).toFixed(2);
  };

  const formatPnl = v =>
    Number.isFinite(v) ? Number(v).toFixed(0) : "0";

  const formatEquity = v =>
    Number.isFinite(v) ? Number(v).toFixed(0) : "—";

  const formatLot = v =>
    Number.isFinite(Number(v)) ? Number(v).toFixed(3) : "—";

  function getSignalLabel(trade) {
    if (trade.signalType === "BUY_ZMID")  return "ZMID.B";
    if (trade.signalType === "SELL_ZMID") return "ZMID.S";
    if (trade.signalType === "BUY_EARLY" ||
        trade.signalType === "SELL_EARLY") return "R." + trade.side + ".E";
    if (trade.type === "CONTINUATION") return "C." + trade.side;
    if (trade.type === "REVERSAL")     return "R." + trade.side;
    return trade.signalType;
  }

  function signalBadge(trade) {
    const label = getSignalLabel(trade);
    const st = String(trade.signalType ?? "").toUpperCase();
    const isCont = String(trade.type ?? "").toUpperCase() === "CONTINUATION";

    let color;
    if (st.includes("ZMID"))    color = trade.side === "BUY" ? "#4a9eff" : "#f59e42";
    else if (isCont)            color = trade.side === "BUY" ? "#6bcf7f" : "#ef6b6b";
    else                        color = trade.side === "BUY" ? "#4a9eff" : "#f59e42";

    return (
      <span style={{
        background: color,
        color: "#fff",
        borderRadius: 4,
        padding: "2px 6px",
        fontSize: "0.8em",
        fontWeight: 600,
      }}>
        {label}
      </span>
    );
  }

  return (
    <div className="neo-card">
      <div className="neo-results-header">
        <h3>Detailed Results</h3>
        <div className="neo-filter-btns">
          <button
            className={`neo-filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Tous ({trades.length})
          </button>
          <button
            className={`neo-filter-btn win ${filter === "win" ? "active" : ""}`}
            onClick={() => setFilter("win")}
          >
            Gains ({trades.filter(t => t.pnl >= 0).length})
          </button>
          <button
            className={`neo-filter-btn loss ${filter === "loss" ? "active" : ""}`}
            onClick={() => setFilter("loss")}
          >
            Pertes ({trades.filter(t => t.pnl < 0).length})
          </button>
        </div>
      </div>

      <div className="neo-table-wrapper">

        {trades.length === 0 ? (
          <div className="neo-empty">No trades executed.</div>
        ) : (

          <table className="neo-table">
            <thead>
              <tr>
                <th>#</th>
                <th onClick={() => handleSort("timestamp")}>
                  Timestamp{sortIcon("timestamp")}
                </th>
                <th onClick={() => handleSort("symbol")}>
                  Symbol{sortIcon("symbol")}
                </th>
                <th onClick={() => handleSort("side")}>
                  Side{sortIcon("side")}
                </th>
                <th onClick={() => handleSort("signalType")}>
                  Signal{sortIcon("signalType")}
                </th>
                <th onClick={() => handleSort("size")}>
                  Size{sortIcon("size")}
                </th>
                <th onClick={() => handleSort("open")}>
                  Open{sortIcon("open")}
                </th>
                <th onClick={() => handleSort("close")}>
                  Close{sortIcon("close")}
                </th>
                <th onClick={() => handleSort("tp")}>
                  TP{sortIcon("tp")}
                </th>
                <th onClick={() => handleSort("sl")}>
                  SL{sortIcon("sl")}
                </th>
                <th onClick={() => handleSort("durationHours")}>
                  Durée{sortIcon("durationHours")}
                </th>
                <th onClick={() => handleSort("pnl")}>
                  PnL €{sortIcon("pnl")}
                </th>
                <th onClick={() => handleSort("equity")}>
                  Equity{sortIcon("equity")}
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleTrades.map((t, index) => (
                <tr
                  key={t.ticket ?? index}
                  className={t.pnl >= 0 ? "trade-win" : "trade-loss"}
                >
                  <td>{index + 1}</td>
                  <td>{t.timestamp}</td>
                  <td>{t.symbol}</td>
                  <td>{t.side}</td>
                  <td>{signalBadge(t)}</td>
                  <td>{formatLot(t.size)}</td>
                  <td>{formatPrice(t.open)}</td>
                  <td>{formatPrice(t.close)}</td>
                  <td>{formatPrice(t.tp)}</td>
                  <td>{formatPrice(t.sl)}</td>
                  <td>
                    {t.durationHours != null
                      ? t.durationHours >= 1
                        ? Math.floor(t.durationHours) + "h " + Math.round((t.durationHours % 1) * 60) + "m"
                        : Math.round(t.durationHours * 60) + "m"
                      : "—"}
                  </td>
                  <td>{formatPnl(t.pnl)} €</td>
                  <td>{formatEquity(t.equity)} €</td>
                </tr>
              ))}
            </tbody>

          </table>

        )}
      </div>
    </div>
  );
}