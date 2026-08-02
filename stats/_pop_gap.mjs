import fs from "fs";
import { getATRConfig } from "../../Matrix-Revolution/src/components/robot/engines/config/ATRConfig.js";
import { GAP_LEVELS, gapLevel } from "../../Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const DIR="data/matrix", num=(v)=>(v===""||v==null)?null:(Number.isFinite(Number(v))?Number(v):null);
const c=Object.fromEntries(GAP_LEVELS.map(l=>[l,0])); let n=0;
for(const f of fs.readdirSync(DIR).filter(x=>x.toLowerCase().endsWith(".csv"))){
  const sym=f.replace(/\.csv$/i,""); const p50=getATRConfig(sym,"H1")?.p50; if(!p50) continue;
  const L=fs.readFileSync(`${DIR}/${f}`,"utf8").split(/\r?\n/); const h=L[0].split(";");
  const I=Object.fromEntries(h.map((x,i)=>[x,i])); if(I.middle_h1_s1==null) continue;
  for(let i=1;i<L.length;i++){ const r=L[i].split(";"); if(r.length<h.length) continue;
    const d=new Date(r[I.ts_utc]); const js=d.getUTCDay(); if(js===0||js===6) continue;
    const mP=num(r[I.middle_h1_s1]), pP=num(r[I.close_h1_s1]);
    if(mP===null||pP===null||!(mP>0)||!(pP>0)) continue;
    const lvl=gapLevel((pP-mP)/(p50/100000*pP),sym); if(!lvl) continue; c[lvl]++; n++; } }
console.log(`n=${n}`);
for(const l of GAP_LEVELS) console.log(`${l.padEnd(12)}${String(c[l]).padStart(9)}  ${(c[l]/n*100).toFixed(1)}%`);
