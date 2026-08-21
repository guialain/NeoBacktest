import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let sb=[];
for(const a of assets){
  const lines=fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const h=lines[0].split(";"); const iKh=h.indexOf("stoch_k_h1_s0"),iDh=h.indexOf("stoch_d_h1_s0"),iC1=h.indexOf("adx14_h1_c1"),iZ=h.indexOf("zscore_h1_s0");
  const rows=lines.slice(1).map(l=>l.split(";"));
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(s.profile==="Strong Bull"&&typeof s.R==="number"){
    const r=rows[s.i]; if(r){const kh=parseFloat(r[iKh]),dh=parseFloat(r[iDh]),c1=parseFloat(r[iC1]),z=parseFloat(r[iZ]);
      s._kd=(isNaN(kh)||isNaN(dh))?null:kh-dh; s._adx=isNaN(c1)?null:c1; s._z=isNaN(z)?null:z;}
    sb.push(s);}
}
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(16)} n     0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(16)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1).padStart(5)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0)}`);};
console.log(`═══ STRONG BULL CONT (à plat) n=${sb.length} ═══`);
st(sb,"GLOBAL");
console.log("par stage :"); for(const x of ["EARLY","MID","LATE_BUY","LATE_SELL","EXHAUSTED_SELL","EXHAUSTED_BUY"]) st(sb.filter(s=>s.obs?.stage===x||s.stage===x),x);
console.log("par K−D H1 :"); for(const[lo,hi,l]of[[-999,-14,"<−14"],[-14,-7,"−14..−7"],[-7,7,"−7..+7"],[7,14,"+7..+14"],[14,999,">+14"]]) st(sb.filter(s=>s._kd!=null&&s._kd>=lo&&s._kd<hi),l);
console.log("par ADX (c1) :"); for(const[lo,hi,l]of[[0,20,"<20"],[20,30,"20-30"],[30,40,"30-40"],[40,999,"≥40"]]) st(sb.filter(s=>s._adx!=null&&s._adx>=lo&&s._adx<hi),l);
console.log("par zscore :"); for(const[lo,hi,l]of[[-999,0,"z<0"],[0,1,"0..1"],[1,2,"1..2"],[2,999,">2"]]) st(sb.filter(s=>s._z!=null&&s._z>=lo&&s._z<hi),l);
