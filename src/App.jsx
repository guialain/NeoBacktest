import { useState } from "react";
import PageLayout from "./components/PageLayout";
import { runBacktest } from "./components/simulations/coreBacktest";

export default function App() {

  const [trades, setTrades] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [structureTF, setStructureTF] = useState("H1");


const handleRun = async (config) => {
  try {
    const result = await runBacktest(config);

    console.log("Backtest result:", result);

    const normalizedTrades = (result.trades || []).map((t, i) => ({
  ticket: i + 1,
  timestamp: t.timestamp ?? "",
  closeTime: t.closeTime ?? null,
  symbol: t.symbol ?? config.symbol,
  side: t.side,
  size: t.size ?? 1,
  open: t.open ?? 0,
  close: t.close ?? 0,
  tp: t.tp ?? 0,
  sl: t.sl ?? 0,
  pnl: t.pnl ?? 0,
nominalTrade: t.nominalTradeAtOpen ?? null,
nominalPortfolio: t.nominalPortfolioAtOpen ?? null,
usedLeverage: t.usedLeverageAtOpen ?? null,
portfolioLeverage: t.portfolioUsedLeverageAtOpen ?? null,
  score: t.score ?? null,   
  duration: calculateDuration(t.timestamp, t.closeTime)
}));

console.log("Trades returned:", result.trades);
console.log("Stats returned:", result.stats);


    setTrades(normalizedTrades);
    setPerformance(result.stats);

  } catch (err) {
    console.error("Backtest failed:", err);
  }
};

//======Calcul de la duree=====//
function calculateDuration(openTime, closeTime) {
  if (!openTime || !closeTime) return "—";

  const parse = (ts) => {
    const [datePart, timePart] = ts.split(" ");
    const [year, month, day] = datePart.split(".");
    const [hour, minute] = timePart.split(":");
    return new Date(year, month - 1, day, hour, minute);
  };

  const start = parse(openTime);
  const end   = parse(closeTime);

  const diffMs = end - start;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "—";

  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const mins  = minutes % 60;

  return `${hours}h ${mins}m`;
}

//====

  return (
    <PageLayout
      trades={trades}
      performance={performance}
      onRun={handleRun}
        structureTF={structureTF}
    />
  );
}
