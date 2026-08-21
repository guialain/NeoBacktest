import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let buy=[],sell=[];
for(const a of assets){
  const lines=fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const h=lines[0].split(";"); const iO=h.indexOf("open_h1_s0"),iC=h.indexOf("close_h1_s0"),iA=h.indexOf("atr_h1_s0");
  const rows=lines.slice(1).map(l=>l.split(";"));
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(s.type!=="EXHAUSTION"&&typeof s.R==="number"){
    const r=rows[s.i];if(!r)continue; const o=parseFloat(r[iO]),c=parseFloat(r[iC]),atr=parseFloat(r[iA]);
    if(isNaN(o)||isNaN(c))continue; s._body=c-o; s._bodyAtr=(atr>0)?(c-o)/atr:0;
    (s.side==="BUY"?buy:sell).push(s);}
}
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(24)} n     0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(24)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1).padStart(5)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0)}`);};
console.log(`CONT BUY n=${buy.length} — bougie H1 s0 (verte = close>open) :`);
st(buy.filter(s=>s._body>0),"VERTE (close>open)");
st(buy.filter(s=>s._body<0),"ROUGE (close<open)");
console.log("  ROUGE par magnitude (corps/ATR) :");
st(buy.filter(s=>s._bodyAtr<0&&s._bodyAtr>=-0.5),"  rouge léger [0,−0.5]");
st(buy.filter(s=>s._bodyAtr<-0.5&&s._bodyAtr>=-1),"  rouge moyen [−0.5,−1]");
st(buy.filter(s=>s._bodyAtr<-1),"  rouge VIOLENT <−1 ATR");
console.log(`\nCONT SELL n=${sell.length} — miroir (rouge = close<open) :`);
st(sell.filter(s=>s._body<0),"ROUGE (close<open)");
st(sell.filter(s=>s._body>0),"VERTE (close>open)");
st(sell.filter(s=>s._bodyAtr>1),"  vert VIOLENT >+1 ATR");
