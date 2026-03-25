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

    return Math.round(lot * 100) / 100;
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

      <div className="neo-params-columns">

        {/* ================= LEFT — MARKET ================= */}
        <div className="neo-params-col">
          <div className="neo-section-title">Market</div>

          <div className="neo-field">
            <span className="neo-field-label">Data File</span>
            <select className="neo-select" value={selectedFile} onChange={e => setSelectedFile(e.target.value)}>
              {files.map(file => <option key={file} value={file}>{file}</option>)}
            </select>
          </div>

          <div className="neo-field">
            <span className="neo-field-label">Symbol</span>
            <span className="neo-field-value">{symbol || "—"}</span>
          </div>

          <div className="neo-field">
            <span className="neo-field-label">Asset Class</span>
            <span className="neo-field-value">{assetclass || "—"}</span>
          </div>

          <div className="neo-field">
            <span className="neo-field-label">Period Start</span>
            <input className="neo-input" type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
          </div>

          <div className="neo-field">
            <span className="neo-field-label">Period End</span>
            <input className="neo-input" type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
          </div>
        </div>

        {/* ================= RIGHT — RISK ================= */}
        <div className="neo-params-col">
          <div className="neo-section-title">Risk Management</div>

          <div className="neo-field">
            <span className="neo-field-label">Initial Capital</span>
            <input className="neo-input" type="number" min="100" step="1000" value={initialEquity} onChange={e => setInitialEquity(Number(e.target.value))} />
          </div>

          <div className="neo-field">
            <span className="neo-field-label">Max Open</span>
            <input className="neo-input" type="number" min="1" step="1" value={maxOpenTrades} onChange={e => setMaxOpenTrades(Number(e.target.value))} />
          </div>

          <div className="neo-field">
            <span className="neo-field-label">Levg Max</span>
            <input className="neo-input" type="number" step="0.5" min="1" value={usedLeverageMax} onChange={e => setUsedLeverageMax(Number(e.target.value))} />
          </div>

          <div className="neo-field">
            <span className="neo-field-label">Min Spacing (min)</span>
            <input className="neo-input" type="number" min="0" step="5" value={minTradeSpacingMinutes} onChange={e => setMinTradeSpacingMinutes(Number(e.target.value))} />
          </div>

          <div className="neo-field">
            <span className="neo-field-label">Levier/Trade</span>
            <span className="neo-field-value">{levDisplay !== null ? `${levDisplay}×` : "—"}</span>
          </div>

          <div className="neo-field">
            <span className="neo-field-label">Lot estimé</span>
            <span className="neo-field-value">{estLot !== null ? estLot.toFixed(3) : "—"}</span>
          </div>

          <div className="neo-field">
            <span className="neo-field-label">TP (ATR ×)</span>
            <span className="neo-field-value">{tpDisplay !== null ? `${tpDisplay.toFixed(2)}×` : "—"}</span>
          </div>

          <div className="neo-field">
            <span className="neo-field-label">SL (ATR ×)</span>
            <span className="neo-field-value">{slDisplay !== null ? `${slDisplay.toFixed(2)}×` : "—"}</span>
          </div>

          <div className="neo-field">
            <span className="neo-field-label">Ratio TP/SL</span>
            <span className="neo-field-value">{tpDisplay && slDisplay ? (tpDisplay / slDisplay).toFixed(2) : "—"}</span>
          </div>
        </div>

      </div>

    </div>
  );
}
