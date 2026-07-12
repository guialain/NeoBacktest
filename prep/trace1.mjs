import fs from "fs";
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";
const sym="US_TECH100", target="2026.07.08 17:54";
const r=runMatrixBacktest(`./data/matrix/${sym}.csv`,{});
const sig=r.signals.find(s=>String(s.tsMT).startsWith(target));
console.log("=== trade backtest ===");
console.log(sig?`${sig.tsMT} ${sig.side} ${sig.type} entry=${sig.entry} tp=${sig.tp} sl=${sig.sl} exit=${sig.exit} → ${sig.outcome}/${sig.reason} R=${sig.R} (${sig.barsHeld}min) exitTs=${sig.exitTs}`:"(pas dans les signaux — filtré cap/cadence ?)");
// trajectoire prix : min/max après l'entrée, par jour
const L=fs.readFileSync(`./data/matrix/${sym}.csv`,"utf8").split(/\r?\n/).filter(Boolean);
const h=L[0].split(";");const rows=L.slice(1).map(l=>{const v=l.split(";");const o={};h.forEach((k,i)=>o[k]=v[i]);return o;});
const ti=rows.findIndex(x=>String(x.timestamp).startsWith(target));
const entry=Number(rows[ti].price), atr=Number(rows[ti].atr_h1);
console.log(`\nentry=${entry} atr_h1=${atr}  SELL → TP=${(entry-0.65*atr).toFixed(1)} SL=${(entry+1.95*atr).toFixed(1)}`);
console.log("\n=== extrêmes prix APRÈS l'entrée, par jour (US_TECH100) ===");
const byDay={};
for(let i=ti+1;i<rows.length;i++){const d=String(rows[i].ts_utc??rows[i].timestamp).slice(0,10);const p=Number(rows[i].price);if(!p)continue;(byDay[d]??={min:1e9,max:-1e9,last:0,first:p});byDay[d].min=Math.min(byDay[d].min,p);byDay[d].max=Math.max(byDay[d].max,p);byDay[d].last=p;}
for(const [d,v] of Object.entries(byDay)) console.log(`${d}: min=${v.min} max=${v.max} close=${v.last}  (SL touché si max≥${(entry+1.95*atr).toFixed(0)}, TP si min≤${(entry-0.65*atr).toFixed(0)})`);
