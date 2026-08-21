import fs from 'fs';
const API="http://localhost:3001/api/matrix";
const assets=await(await fetch(`${API}/assets`)).json();
const T=[];  // {side, mk0, tight, R, out}
for(const a of assets){
  const j=await(await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const soft=(j.signals||[]).filter(s=>(s.profile==="Soft Bull"||s.profile==="Soft Bear")&&typeof s.R==="number");
  if(!soft.length)continue;
  // index CSV par tsMT
  const raw=fs.readFileSync(`./data/matrix/${a}.csv`,'utf8').split(/\r?\n/).filter(l=>l.trim());
  const H=raw[0].split(';').map(h=>h.trim());const idx={};
  const ik=['s0','s1','s2'].map(s=>H.indexOf('stoch_k_m15_'+s)), id=['s0','s1','s2'].map(s=>H.indexOf('stoch_d_m15_'+s));
  for(let i=1;i<raw.length;i++){const v=raw[i].split(';');idx[v[0]]=v;}
  for(const s of soft){const v=idx[s.tsMT];if(!v)continue;
    const seq=[0,1,2].map(n=>{const k=+v[ik[n]],d=+v[id[n]];return (Number.isFinite(k)&&Number.isFinite(d))?k-d:null;});
    if(seq.some(x=>x==null))continue;
    const tight=Math.abs(seq[0])<Math.abs(seq[1])&&Math.abs(seq[1])<Math.abs(seq[2]);
    T.push({side:s.side,mk0:+v[ik[0]],tight,R:s.R,out:s.out??s.outcome});}
}
const st=arr=>{const w=arr.filter(x=>x.out==="WIN").length,l=arr.filter(x=>x.out==="LOSS").length,R=arr.reduce((a,x)=>a+x.R,0);return {n:arr.length,wr:w+l?100*w/(w+l):0,R,avg:arr.length?R/arr.length:0};};
console.log(`Soft capturé (pincement OFF) : n=${T.length}\n`);
console.log("zone Z : BLOQUÉ (ces trades) vs SURVIVANTS");
for(const Z of [15,20,25,30,35,40]){
  const blocked=T.filter(s=>s.tight&&(s.side==="SELL"?s.mk0<Z:s.mk0>100-Z));
  const surv=T.filter(s=>!(s.tight&&(s.side==="SELL"?s.mk0<Z:s.mk0>100-Z)));
  const b=st(blocked),v=st(surv);
  console.log(`Z=${Z}: bloqué WR ${b.wr.toFixed(0)}% n${b.n} avgR ${b.avg.toFixed(3)} R${(b.R>=0?"+":"")+b.R.toFixed(0)}  |  survivants WR ${v.wr.toFixed(1)}% n${v.n} avgR ${v.avg.toFixed(3)} R${(v.R>=0?"+":"")+v.R.toFixed(0)}`);
}
console.log(`\nbaseline (aucun pincement) : ${(()=>{const x=st(T);return `WR ${x.wr.toFixed(1)}% avgR ${x.avg.toFixed(3)} R+${x.R.toFixed(0)}`;})()}`);
