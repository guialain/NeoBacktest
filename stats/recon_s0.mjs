import fs from "fs";
// ── Wilder ADX(14) — reproduit iADX MT5. État = {atr, pdm, ndm, adx, dxSeed[], n} ──
function makeADX(P=14){
  let atr=0,pdm=0,ndm=0,adx=null,dxs=[],n=0,ph=null,pl=null,pc=null;
  // step(h,l,c, commit) : commit=true fige l'état (bougie close) ; false = lecture provisoire (forming)
  return { val(h,l,c){
    if(ph==null){ return null; } // besoin d'une barre précédente
    const up=h-ph, dn=pl-l;
    const pDM=(up>dn&&up>0)?up:0, nDM=(dn>up&&dn>0)?dn:0;
    const tr=Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc));
    // smoothing provisoire (sans muter l'état)
    let _atr,_pdm,_ndm;
    if(n<P){ _atr=atr+tr; _pdm=pdm+pDM; _ndm=ndm+nDM; if(n+1<P) return null; }
    else { _atr=atr-atr/P+tr; _pdm=pdm-pdm/P+pDM; _ndm=ndm-ndm/P+nDM; }
    const pDI=100*_pdm/_atr, nDI=100*_ndm/_atr;
    const dx=(pDI+nDI)===0?0:100*Math.abs(pDI-nDI)/(pDI+nDI);
    let _adx;
    if(adx==null){ const seed=[...dxs,dx]; if(seed.length<P) _adx=null; else _adx=seed.reduce((a,b)=>a+b,0)/P; }
    else _adx=(adx*(P-1)+dx)/P;
    return _adx;
  }, commit(h,l,c){
    if(ph!=null){
      const up=h-ph, dn=pl-l;
      const pDM=(up>dn&&up>0)?up:0, nDM=(dn>up&&dn>0)?dn:0;
      const tr=Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc));
      if(n<P){ atr+=tr; pdm+=pDM; ndm+=nDM; }
      else { atr=atr-atr/P+tr; pdm=pdm-pdm/P+pDM; ndm=ndm-ndm/P+nDM; }
      if(n>=P-1){
        const pDI=100*pdm/atr,nDI=100*ndm/atr;
        const dx=(pDI+nDI)===0?0:100*Math.abs(pDI-nDI)/(pDI+nDI);
        if(adx==null){ dxs.push(dx); if(dxs.length>=P) adx=dxs.reduce((a,b)=>a+b,0)/P; }
        else adx=(adx*(P-1)+dx)/P;
      }
      n++;
    }
    ph=h;pl=l;pc=c;
  } };
}
const a="GERMANY_40";
const L=fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>5);
const h=L[0].split(";"); const I=n=>h.indexOf(n);
const cols={ts:I("timestamp"),oh:I("open_h1_s1"),hh:I("high_h1_s1"),lh:I("low_h1_s1"),ch:I("close_h1_s1"),
  o0:I("open_h1_s0"),h0:I("high_h1_s0"),l0:I("low_h1_s0"),c0:I("close_h1_s0"),
  c1:I("adx14_h1_c1"),s0:I("adx14_h1_s0")};
const eng=makeADX(14);
let prevHour=null, errC1=[], errS0=[], nC1=0,nS0=0;
for(const line of L.slice(1)){
  const r=line.split(";"); const hour=r[cols.ts].slice(0,13);
  // nouvelle heure → committer la bougie qui vient de clôturer (s1 de CETTE row)
  if(prevHour!==null && hour!==prevHour){
    const O=+r[cols.oh],H=+r[cols.hh],Lo=+r[cols.lh],C=+r[cols.ch];
    if([H,Lo,C].every(Number.isFinite)){
      const my=eng.val(H,Lo,C); eng.commit(H,Lo,C);
      const rec=+r[cols.c1];
      if(my!=null&&Number.isFinite(rec)){ errC1.push(Math.abs(my-rec)); nC1++; }
    }
  }
  prevHour=hour;
  // forming s0 : lecture provisoire
  const H=+r[cols.h0],Lo=+r[cols.l0],C=+r[cols.c0], recS0=+r[cols.s0];
  if([H,Lo,C].every(Number.isFinite) && Number.isFinite(recS0)){
    const my=eng.val(H,Lo,C);
    if(my!=null){ errS0.push(Math.abs(my-recS0)); nS0++; }
  }
}
const stat=(e)=>e.length?`n=${e.length} · err moy ${(e.reduce((a,b)=>a+b,0)/e.length).toFixed(3)} · p95 ${e.sort((x,y)=>x-y)[Math.floor(e.length*0.95)].toFixed(3)} · max ${Math.max(...e).toFixed(3)}`:"n=0";
console.log(`VALIDATION ${a}:`);
console.log(`  ADX(closes) vs adx14_h1_c1 enregistré : ${stat(errC1)}`);
console.log(`  ADX(forming s0) vs adx14_h1_s0 réel   : ${stat(errS0)}`);
