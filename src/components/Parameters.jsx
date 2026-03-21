import { useState, useEffect } from "react";
import "../styles/parameters.css";
import { getRiskConfig } from "./config/RiskConfig";

export default function Parameters({ onRun }) {

  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [symbol, setSymbol] = useState(null);
  const [assetclass, setAssetclass] = useState(null);

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const [loading, setLoading] = useState(false);

const [lastClose, setLastClose] = useState(null);
const [tickSize, setTickSize] = useState(null);
const [tickValue, setTickValue] = useState(null);

  const [maxOpenTrades, setMaxOpenTrades] = useState(30);
  const [usedLeverageMax, setUsedLeverageMax] = useState(100);
  const [initialEquity, setInitialEquity] = useState(20000);
  const [minTradeSpacingMinutes, setMinTradeSpacingMinutes] = useState(5);

  // =========================
  // TP / SL — depuis AssetConfig (par SYMBOL)
  // =========================

  const assetCfg = symbol ? getRiskConfig(symbol) : null;

  const tpDisplay  = assetCfg?.tpAtr ?? null;
  const slDisplay  = assetCfg?.slAtr ?? null;
  const levDisplay = assetCfg?.targetLeveragePerTrade ?? null;

const estLot = (() => {
  const lev = assetCfg?.targetLeveragePerTrade;
  const price = Number(lastClose);
  const ts = Number(tickSize);
  const tv = Number(tickValue);

  if (!lev || !Number.isFinite(price) || !Number.isFinite(ts) || !Number.isFinite(tv))
    return null;

  const eurPerLot = (price / ts) * tv;
  const lot = (initialEquity * lev) / eurPerLot;

  return Math.round(lot * 100) / 100; // GOLD step 0.01
})();

  // =========================
  // LOAD FILE LIST
  // =========================

  useEffect(() => {
    fetch("http://localhost:3001/api/backtest-files")
      .then(res => res.json())
      .then(data => {
        const list = data.files || [];
        setFiles(list);
        if (list.length > 0) setSelectedFile(list[0]);
      })
      .catch(err => console.error("File list error:", err));
  }, []);

  // =========================
  // LOAD META
  // =========================

  useEffect(() => {
    if (!selectedFile) return;

    fetch(`http://localhost:3001/api/backtest-meta/${selectedFile}`)
      .then(res => {
        if (!res.ok) throw new Error("Meta fetch failed");
        return res.json();
      })
      .then(data => {
        setSymbol(data.symbol || null);
        setAssetclass(data.assetclass || null);
        setLastClose(data.lastClose ?? null);
  setTickSize(data.tickSize ?? null);
  setTickValue(data.tickValue ?? null);

        if (data.periodStart)
          setPeriodStart(
            data.periodStart.split(" ")[0].replace(/\./g, "-")
          );

        if (data.periodEnd)
          setPeriodEnd(
            data.periodEnd.split(" ")[0].replace(/\./g, "-")
          );

      })
      .catch(err => console.error("Meta load error:", err));
  }, [selectedFile]);

  // =========================
  // RUN BACKTEST
  // =========================

  const handleRun = async () => {
    if (!selectedFile) {
      alert("Please select a data file.");
      return;
    }

    const config = {
      fileName: selectedFile,
      periodStart,
      periodEnd,
      maxOpenTrades,
      minTradeSpacingMinutes,
      usedLeverageMax,
      initialEquity,
    };
    setLoading(true);
    try {
      await onRun(config);
    } catch (err) {
      console.error("Backtest error:", err);
    }
    setLoading(false);
  };

  return (
    <div className="neo-card">

      <div className="neo-card-header">
        <h3>Input Parameters</h3>
        <button
          className="neo-button"
          onClick={handleRun}
          disabled={loading || !selectedFile}
        >
          {loading ? "Running..." : "Run Backtest"}
        </button>
      </div>

      {/* ================= MARKET ================= */}

      <div className="neo-section">
        <div className="neo-section-title">Market</div>

        <div className="neo-inline-row">

          <div className="neo-input-group">
            <label>Data File</label>
            <select
              value={selectedFile}
              onChange={e => setSelectedFile(e.target.value)}
            >
              {files.map(file => (
                <option key={file} value={file}>{file}</option>
              ))}
            </select>
          </div>

          <div className="neo-input-group">
            <label>Symbol</label>
            <div className="neo-readonly">{symbol || "—"}</div>
          </div>

          <div className="neo-input-group">
            <label>Asset Class</label>
            <div className="neo-readonly">{assetclass || "—"}</div>
          </div>

        </div>

        <div className="neo-input-row">
          <div className="neo-input-group">
            <label>Period Start</label>
            <input
              type="date"
              value={periodStart}
              onChange={e => setPeriodStart(e.target.value)}
            />
          </div>

          <div className="neo-input-group">
            <label>Period End</label>
            <input
              type="date"
              value={periodEnd}
              onChange={e => setPeriodEnd(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ================= RISK ================= */}

      <div className="neo-section">
        <div className="neo-section-title">Risk Management</div>

        <div className="neo-risk-row">

          <div className="neo-risk-item">
            <label>Levier/Trade</label>
            <div className="neo-readonly">
              {levDisplay !== null ? `${levDisplay}×` : "—"}
            </div>
          </div>

          <div className="neo-risk-item">
            <label>Lot estimé</label>
            <div className="neo-readonly">
              {estLot !== null ? estLot.toFixed(3) : "—"}
            </div>
          </div>

          <div className="neo-risk-item">
            <label>Max Open</label>
            <input
              type="number"
              min="1"
              step="1"
              value={maxOpenTrades}
              onChange={e => setMaxOpenTrades(Number(e.target.value))}
            />
          </div>

          <div className="neo-risk-item">
            <label>Levg Max</label>
            <input
              type="number"
              step="0.5"
              min="1"
              value={usedLeverageMax}
              onChange={e => setUsedLeverageMax(Number(e.target.value))}
            />
          </div>

          <div className="neo-risk-item">
            <label>Min Timing (min)</label>
            <input
              type="number"
              min="0"
              step="5"
              value={minTradeSpacingMinutes}
              onChange={e => setMinTradeSpacingMinutes(Number(e.target.value))}
            />
          </div>

        </div>

        {/* === TP/SL FROM ASSET CONFIG === */}

        <div className="neo-risk-row" style={{ marginTop: "8px", opacity: 0.75 }}>

          <div className="neo-risk-item">
            <label>TP (ATR ×)</label>
            <div className="neo-readonly">
              {tpDisplay !== null ? `${tpDisplay.toFixed(2)}×` : "—"}
            </div>
          </div>

          <div className="neo-risk-item">
            <label>SL (ATR ×)</label>
            <div className="neo-readonly">
              {slDisplay !== null ? `${slDisplay.toFixed(2)}×` : "—"}
            </div>
          </div>

          <div className="neo-risk-item">
            <label>Ratio TP/SL</label>
            <div className="neo-readonly">
              {tpDisplay && slDisplay
                ? `${(tpDisplay / slDisplay).toFixed(2)}`
                : "—"}
            </div>
          </div>



          <div className="neo-risk-item">
            <label>Initial Capital</label>
            <input
              type="number"
              min="100"
              step="1000"
              value={initialEquity}
              onChange={e => setInitialEquity(Number(e.target.value))}
            />
          </div>

        </div>

      </div>

    </div>
  );
}