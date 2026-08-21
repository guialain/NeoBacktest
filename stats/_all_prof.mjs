const API="http://localhost:3001/api/matrix";
const assets=await(await fetch(`${API}/assets`)).json();
const acc={};
for(const a of assets){const j=await(await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of(j.signals||[])){if(typeof s.R!=="number")continue;const k=s.profile||"?";(acc[k]??={n:0,w:0,l:0,R:0});acc[k].n++;acc[k].R+=s.R;if(s.outcome==="WIN")acc[k].w++;else if(s.outcome==="LOSS")acc[k].l++;}}
for(const [k,a] of Object.entries(acc).sort((x,y)=>y[1].n-x[1].n)){const wl=a.w+a.l;console.log(`${k.padEnd(14)} n=${String(a.n).padStart(4)} WR ${(wl?100*a.w/wl:0).toFixed(0)}% W${a.w}/L${a.l} R ${(a.R>=0?"+":"")+a.R.toFixed(1)}`);}
