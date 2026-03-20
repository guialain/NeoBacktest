import "../styles/pagelayout.css";
import Header from "./Header";
import Parameters from "./Parameters";
import Results from "./Results";
import Performance from "./Performance";

export default function PageLayout({ trades, performance, onRun, structureTF }) {
  return (
    <div className="neo-page">
      <Header />

      <div className="neo-row two-cols">
        <Parameters 
  onRun={onRun}
  structureTF={structureTF}
/>

      <Results 
  trades={trades} 
  initialEquity={performance?.initialEquity ?? 0}
/>
      </div>

      <div className="neo-row">
        <Performance data={performance} trades={trades} />
      </div>
    </div>
  );
}

