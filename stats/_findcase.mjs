const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals||[])) {
    if (String(s.tsMT).startsWith("2026.06.22 11:25") && s.profile==="Strong Bull" && s.side==="BUY") {
      console.log(`>>> ${a} @ ${s.tsMT} · ${s.side} ${s.type} ${s.profile} · ${s.outcome} ${s.R}`);
      const keys=["crossState","crossoverState","crossAge","crossMat","crossoverMaturity","kdH1","kH1","dH1","kdSide","gap0","gap1","div0","zscoreH1","dominanceTurn","delta1","delta2","adx"];
      for(const k of keys) if(s[k]!==undefined) console.log(`    ${k} = ${JSON.stringify(s[k])}`);
    }
  }
}
console.log("(fini)");
