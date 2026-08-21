// profile_intraday_btcusd.mjs — profil comportemental du capteur INTRADAY sur BTCUSD (H1, heures actives).
// (1) distribution des regimes  (2) profil par heure serveur  (3) persistance/dwell  (4) transitions.
import fs from 'fs';

const FP = 'C:/Users/Public/Neo-Backtest/stats/data/hist_BTCUSD_H1.csv';
const L = fs.readFileSync(FP, 'utf8').split(/\r?\n/);
const h = L[0].split(';');
const I = n => h.indexOf(n);
const it = I('time'), iic = I('intraday_change'), ilv = I('intraday_level'), ifo = I('intraday_force'), iac = I('is_active');

const rows = [];
for (let i = 1; i < L.length; i++) {
  const c = L[i].split(';'); if (c.length < h.length) continue;
  rows.push({ time: c[it], ic: +c[iic], lvl: c[ilv], force: +c[ifo], active: c[iac] === '1', hour: +String(c[it]).split(' ')[1].split(':')[0] });
}
rows.reverse(); // chronologique
const LEVELS = ['SPIKE_DOWN','EXPLOSIVE_DOWN','STRONG_DOWN','SOFT_DOWN','NEUTRE','SOFT_UP','STRONG_UP','EXPLOSIVE_UP','SPIKE_UP'];
const act = rows.filter(r => r.active);

console.log(`=== BTCUSD H1 — profil intraday (heures actives 7-20h) ===`);
console.log(`barres totales ${rows.length}, actives ${act.length} (${(100*act.length/rows.length).toFixed(0)}%)\n`);

// (1) distribution regimes : actif vs brut
console.log('(1) Distribution des regimes  [actif | brut]');
const cnt = arr => { const m = {}; for (const r of arr) m[r.lvl] = (m[r.lvl]||0)+1; return m; };
const ca = cnt(act), cf = cnt(rows);
for (const lv of LEVELS) {
  const pa = 100*(ca[lv]||0)/act.length, pf = 100*(cf[lv]||0)/rows.length;
  console.log(`  ${lv.padEnd(15)} ${pa.toFixed(1).padStart(5)}% | ${pf.toFixed(1).padStart(5)}%`);
}

// (2) profil par heure (serveur) : mean |force| et % barres "fortes" (|force|>=2)
console.log('\n(2) Profil par heure serveur (toutes barres) : mean|force| et % fort (|force|>=2)');
for (let H = 0; H < 24; H++) {
  const hh = rows.filter(r => r.hour === H); if (!hh.length) continue;
  const mAbs = hh.reduce((s,r)=>s+Math.abs(r.force),0)/hh.length;
  const strong = 100*hh.filter(r=>Math.abs(r.force)>=2).length/hh.length;
  const bar = '#'.repeat(Math.round(mAbs*10));
  const tag = (H>=7&&H<20)?'ACT':'   ';
  console.log(`  ${String(H).padStart(2)}h ${tag}  mean|f|=${mAbs.toFixed(2)}  fort=${strong.toFixed(0).padStart(3)}%  ${bar}`);
}

// (3) persistance / dwell (heures actives, chrono continu)
console.log('\n(3) Persistance (heures actives)');
// autocorrelation lag-1 de force
const f = act.map(r=>r.force); const mean=f.reduce((a,b)=>a+b,0)/f.length;
let num=0,den=0; for(let i=0;i<f.length;i++){den+=(f[i]-mean)**2; if(i>0)num+=(f[i]-mean)*(f[i-1]-mean);}
console.log(`  autocorr lag-1 de force : ${(num/den).toFixed(3)}  (0=aucune memoire, 1=tres persistant)`);
// dwell moyen : longueur de run ou le signe de force reste constant (!=0)
let runs=[], cur=0, sign=0;
for(const r of act){ const s=Math.sign(r.force); if(s!==0 && s===sign){cur++;} else { if(cur>0)runs.push(cur); cur=(s!==0)?1:0; sign=s; } }
if(cur>0)runs.push(cur);
const avgRun = runs.length? runs.reduce((a,b)=>a+b,0)/runs.length : 0;
console.log(`  run moyen meme signe (force!=0) : ${avgRun.toFixed(1)} barres  (max ${Math.max(...runs)})`);
// % du temps en NEUTRE
console.log(`  % temps en NEUTRE : ${(100*act.filter(r=>r.force===0).length/act.length).toFixed(0)}%`);

// (4) transitions : depuis chaque niveau de force, que fait la barre suivante ?
console.log('\n(4) Transitions barre->barre (heures actives) : depuis un |force|, la suivante...');
console.log('  from        n   ESCALADE  STABLE  DECROIT  FLIP(signe)');
for (const lv of [1,2,3,4]) {
  for (const sgn of [1,-1]) {
    const from = [];
    for (let i=0;i<act.length-1;i++){ if(act[i].force===sgn*lv) from.push(act[i+1].force); }
    if(from.length<20) continue;
    const esc=100*from.filter(v=>Math.sign(v)===sgn && Math.abs(v)>lv).length/from.length;
    const sta=100*from.filter(v=>v===sgn*lv).length/from.length;
    const dec=100*from.filter(v=>Math.sign(v)===sgn && Math.abs(v)<lv).length/from.length; // vers neutre, meme signe (inclut 0? non: sign 0 exclu)
    const dec2=100*from.filter(v=>(Math.sign(v)===sgn && Math.abs(v)<lv) || v===0).length/from.length;
    const flip=100*from.filter(v=>Math.sign(v)===-sgn).length/from.length;
    const nm = (sgn>0?'+':'-')+lv;
    console.log(`  ${nm.padEnd(6)} ${String(from.length).padStart(6)}   ${esc.toFixed(0).padStart(6)}%  ${sta.toFixed(0).padStart(5)}%  ${dec2.toFixed(0).padStart(6)}%  ${flip.toFixed(0).padStart(6)}%`);
  }
}
