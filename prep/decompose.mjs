// Décompose le score c2 d'un bar : contribution par observable pour les profils du top.
// node prep/decompose.mjs US_TECH100 "2026.07.07 10:00"
import fs from "fs";
import { detectOpportunity } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { observeProfile, _internals } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js";
import { PROFILES, KNOWLEDGE } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/MarketProfileKnowledge.js";
const { OBS_WEIGHT, scoreOf } = _internals;
const [sym,target]=[process.argv[2],process.argv[3]];
const L=fs.readFileSync(`./data/matrix/${sym}.csv`,"utf8").split(/\r?\n/).filter(Boolean);
const h=L[0].split(";");const rows=L.slice(1).map(l=>{const v=l.split(";");const o={};h.forEach((k,i)=>o[k]=v[i]);return o;});
const r=rows.find(x=>String(x.timestamp).startsWith(target));
const det=detectOpportunity(r,sym); const obs=observeProfile(det);
const mp=det.marketProfile; const top=mp.ranking.slice(0,3).map(([n])=>n);
console.log(`\n${sym} ${r.timestamp}  → ${mp.profile} (top3: ${top.join(", ")})\n`);
const idx=(p)=>PROFILES.indexOf(p);
const OBS=Object.keys(OBS_WEIGHT);
console.log(`observable        valeur           w      ` + top.map(p=>p.padStart(14)).join(""));
for(const ax of OBS){
  const val=obs[ax]; const w=OBS_WEIGHT[ax];
  const row=KNOWLEDGE[ax]?.[val];
  const cells=top.map(p=>{ const lvl=row?row[idx(p)]:null; const c=w*scoreOf(lvl); return `${(lvl||"—").slice(0,8)} ${c>=0?"+":""}${c.toFixed(1)}`.padStart(14); });
  console.log(`${ax.padEnd(17)} ${String(val).padEnd(15)} ${w.toFixed(3)} ` + cells.join(""));
}
console.log("\nTOTAL (raw, avant normalisation) " + top.map(p=>{
  let s=0; for(const ax of OBS){const row=KNOWLEDGE[ax]?.[obs[ax]]; if(row) s+=OBS_WEIGHT[ax]*scoreOf(row[idx(p)]);} return `${p}=${s.toFixed(1)}`;
}).join("  "));
