import MatrixBacktest from "./components/MatrixBacktest";

// V8R legacy découplé (robots/* absents ; son SignalFilters = le trio, déjà dans le moteur Matrix).
// Le backtest tourne désormais sur le moteur Matrix prod (SSOT), page dédiée.
export default function App() {
  return <MatrixBacktest />;
}
