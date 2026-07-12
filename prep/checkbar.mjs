import fs from "fs";
import { getTickFlowConfig, computeMeanTick5s } from "../../Matrix-Revolution/src/config/TickFlowConfig.js";
import GlobalMarketHours from "../../Matrix-Revolution/src/components/robot/engines/trading/GlobalMarketHours.js";
const [sym,target]=[process.argv[2],process.argv[3]];
const L=fs.readFileSync(`./data/matrix/${sym}.csv`,"utf8").split(/\r?\n/).filter(Boolean);
const h=L[0].split(";");const rows=L.slice(1).map(l=>{const v=l.split(";");const o={};h.forEach((k,i)=>o[k]=v[i]);return o;});
const r=rows.find(x=>String(x.timestamp).startsWith(target));
if(!r){console.log("introuvable");process.exit(1);}
const mkt={FX:"FX",INDEX:"INDEX",CRYPTO:"CRYPTO",METAL:"METAL",ENERGY:"ENERGY",OIL_GAS:"ENERGY",GAS:"ENERGY",AGRI:"AGRI",SOFT:"AGRI"}[String(r.assetclass).toUpperCase()]??null;
const m5=computeMeanTick5s(r), p20=getTickFlowConfig(sym,r.assetclass)?.tf_5s?.p20;
const hrs=GlobalMarketHours.check(mkt,new Date(r.ts_utc??r.timestamp),sym);
console.log(`${sym} ${r.timestamp}  class=${r.assetclass}→${mkt}  ts_utc=${r.ts_utc}`);
console.log(`  HEURES: allowed=${hrs.allowed} (hour=${hrs.hour?.toFixed?.(2)} market=${hrs.market})`);
console.log(`  TICK  : mean5s=${m5} p20=${p20} → ${m5!==null&&m5<p20?"BLOQUÉ tick_low":"ok"}`);
