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

  const formatPrice = v =>
    Number.isFinite(v) ? Number(v).toFixed(2) : "—";

  const formatPnl = v =>
    Number.isFinite(v) ? Number(v).toFixed(0) : "0";

  const formatEquity = v =>
    Number.isFinite(v) ? Number(v).toFixed(0) : "—";

  return (
    <div className="neo-card">
      <h3>Detailed Results</h3>

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
              {sortedTrades.map((t, index) => (
                <tr
                  key={t.ticket ?? index}
                  className={t.pnl >= 0 ? "trade-win" : "trade-loss"}
                >
                  <td>{index + 1}</td>
                  <td>{t.timestamp}</td>
                  <td>{t.symbol}</td>
                  <td>{t.side}</td>
                  <td>{t.size}</td>
                  <td>{formatPrice(t.open)}</td>
                  <td>{formatPrice(t.close)}</td>
                  <td>{formatPrice(t.tp)}</td>
                  <td>{formatPrice(t.sl)}</td>
                  <td>
                    {t.durationHours != null
                      ? t.durationHours.toFixed(1) + " h"
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