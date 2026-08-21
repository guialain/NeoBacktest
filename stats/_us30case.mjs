const j = await (await fetch("http://localhost:3001/api/matrix/run/US_30?maxOpen=30&cadenceMin=2")).json();
for (const s of (j.signals||[])) {
  if (String(s.tsMT).startsWith("2026.07.02 12:05") && s.type==="EXHAUSTION" && s.side==="SELL") {
    console.log(`>>> US_30 @ ${s.tsMT} · ${s.side} EXH · ${s.outcome} ${s.R} · barsHeld=${s.barsHeld}`);
    const keys=["crossState","crossoverState","crossAge","crossMat","crossoverMaturity","kH1","dH1","kdH1","zoneH1","obs","adx","dominanceTurn","delta1","delta2","zscoreH1","rsiH1","separation","gap0","div0"];
    for(const k of keys){ if(s[k]!==undefined) console.log(`    ${k} = ${JSON.stringify(s[k])}`); }
  }
}
console.log("(fini)");
