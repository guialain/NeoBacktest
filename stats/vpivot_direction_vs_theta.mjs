// vpivot_direction_vs_theta.mjs — sens du V-pivot (sell/buy) x ANGLE du jour (theta_level, dé-confondé).
// Compare aussi avec intraday_force (cumul, corrige config 24mois). V-pivot profond >5, session.
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/Public/Neo-Backtest/stats/data';
const VTHR = 5;
const files = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f));
const assets = files.map(f => f.replace(/^hist_/, '').replace(/_H1\.csv$/, '')).sort();
const THETA_LBL = {'-3':'VERTICAL_DOWN','-2':'STEEP_DOWN','-1':'MILD_DOWN','0':'FLAT','1':'MILD_UP','2':'STEEP_UP','3':'VERTICAL_UP'};
const TL = ['-3','-2','-1','0','1','2','3'];

const thetaAgg = {}, forceAgg = {};
for (const t of TL) thetaAgg[t] = { sell:0, buy:0 };
for (let fo=-4; fo<=4; fo++) forceAgg[fo] = { sell:0, buy:0 };
const gold = { theta:{}, }; for (const t of TL) gold.theta[t]={sell:0,buy:0};

for (const a of assets) {
  const fp = path.join(DIR, `hist_${a}_H1.csv`); if (!fs.existsSync(fp)) continue;
  const L = fs.readFileSync(fp, 'utf8').split(/\r?\n/); const h = L[0].split(';');
  const it=h.indexOf('time'), iK=h.indexOf('stoch_k'), iD=h.indexOf('stoch_d'), iFo=h.indexOf('intraday_force'), iTl=h.indexOf('theta_level'), iAc=h.indexOf('is_active');
  const rows=[];
  for (let i=1;i<L.length;i++){ const c=L[i].split(';'); if(c.length<h.length)continue;
    const k=+c[iK],d=+c[iD]; if(!Number.isFinite(k)||!Number.isFinite(d))continue;
    rows.push({date:String(c[it]).split(' ')[0],kd:k-d,force:c[iFo]===''?null:+c[iFo],theta:c[iTl]===''?null:+c[iTl],active:c[iAc]==='1'}); }
  rows.reverse();
  for (let i=2;i<rows.length-2;i++){
    const p=rows[i-1],c=rows[i];
    if(p.kd===0||!c.active||!p.active||c.date!==p.date)continue;
    if(Math.sign(c.kd)===Math.sign(p.kd))continue;
    const before=Math.max(Math.abs(rows[i-2].kd),Math.abs(rows[i-1].kd));
    const after=Math.max(Math.abs(rows[i+1].kd),Math.abs(rows[i+2].kd));
    if(!(before>VTHR&&after>VTHR))continue;
    const sell=c.kd<0?'sell':'buy';
    if(c.theta!=null){thetaAgg[String(c.theta)][sell]++; if(a==='GOLD')gold.theta[String(c.theta)][sell]++;}
    if(c.force!=null){forceAgg[c.force][sell]++;}
  }
}

function line(lbl,o){const t=o.sell+o.buy; if(!t)return `  ${lbl.padEnd(15)} (0)`;
  return `  ${lbl.padEnd(15)} sell ${String(o.sell).padStart(4)} / buy ${String(o.buy).padStart(4)}  sell%=${(100*o.sell/t).toFixed(0).padStart(3)}%  (n=${t})`;}

console.log('=== V-pivot direction x ANGLE du jour (theta_level, dé-confondé) — agrégat univers ===');
for (const t of TL) console.log(line(THETA_LBL[t], thetaAgg[t]));
// against/with par signe de theta
let ag=0,wi=0; for(const t of TL){const s=+t; if(s>0){ag+=thetaAgg[t].sell;wi+=thetaAgg[t].buy;} else if(s<0){ag+=thetaAgg[t].buy;wi+=thetaAgg[t].sell;}}
console.log(`\n  Hors FLAT : AGAINST-angle ${ag} vs WITH-angle ${wi} -> ${(100*ag/(ag+wi)).toFixed(0)}% contre l'angle`);

console.log('\n=== Comparaison : par intraday_force (CUMUL, corrige 24mois) ===');
for (let fo=4; fo>=-4; fo--) console.log(line('force '+(fo>0?'+':'')+fo, forceAgg[fo]));

console.log('\n=== GOLD par angle ===');
for (const t of TL) console.log(line(THETA_LBL[t], gold.theta[t]));
