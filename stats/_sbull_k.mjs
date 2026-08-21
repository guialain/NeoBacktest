const API="http://localhost:3001/api/matrix";
const assets=await(await fetch(`${API}/assets`)).json();
for(const a of assets){const j=await(await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])){if(s.profile!=="Strong Bull"||typeof s.R!=="number")continue;
    console.log(`${a} ${s.tsMT.slice(5,16)} ${s.obs?.stage} zone=${s.zoneH1} %K_H1=${s.kH1} z=${s.zscoreH1} → ${s.outcome}`);}}
