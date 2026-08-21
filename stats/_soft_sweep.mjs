const API="http://localhost:3001/api/matrix";
const assets=await(await fetch(`${API}/assets`)).json();
const T=[];
for(const a of assets){const j=await(await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of(j.signals||[])){if((s.profile!=="Soft Bull"&&s.profile!=="Soft Bear")||typeof s.R!=="number")continue;
    T.push({side:s.side,k:s.kH1,kd:s.kdH1,R:s.R,out:s.outcome});}}
console.log(`superset Soft capturé : n=${T.length} (gate %K<65 & |K−D|>0)\n`);
const pass=(s,KMAX,KKD)=> s.k!=null&&s.kd!=null&&(s.side==="BUY"?(s.k<KMAX&&s.kd>KKD):(s.k>100-KMAX&&s.kd<-KKD));
const wr=arr=>{const w=arr.filter(x=>x.out==="WIN").length,l=arr.filter(x=>x.out==="LOSS").length,R=arr.reduce((a,x)=>a+x.R,0);return {n:arr.length,wr:w+l?100*w/(w+l):0,R,avg:arr.length?R/arr.length:0};};
console.log("K_MAX \ K_KD :  " + [1,2,3,5,8].map(k=>`KD>${k}`.padStart(20)).join(""));
for(const KMAX of [45,50,55,60,65]){
  let row=`K<${KMAX}`.padEnd(9);
  for(const KKD of [1,2,3,5,8]){const r=wr(T.filter(s=>pass(s,KMAX,KKD)));
    row+=`${r.wr.toFixed(0)}% n${r.n} ${(r.R>=0?"+":"")+r.R.toFixed(0)}`.padStart(20);}
  console.log(row);
}
console.log("\n(format WR% n=count R  · break-even 75%)");
