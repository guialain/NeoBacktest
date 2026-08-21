// add_features_v2.mjs — regenere stats/data avec le config MOTEUR (SSOT, 24 mois) :
//   intraday_level / intraday_force (corriges, ancien mirror perime)  +  theta_deg / theta_level (dé-confondé)  +  is_active.
// theta = arctan( (intraday_change / p50) / frac_du_jour ) deg ; bandes |25/45/65| -> -3..+3 (ThetaConfig moteur).
import fs from 'fs';
import path from 'path';
import { INTRADAY_CONFIG } from 'C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/IntradayConfig.js';

const SRC = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const OUT = 'C:/Users/Public/Neo-Backtest/stats/data';
const HOUR_LO = 7, HOUR_HI = 20, THETA_EARLY_H = 1.5;
const THETA_BANDS = { t1: 25, t2: 45, t3: 65 };

function getIntradayLevel(val, cfg) {
  if (!Number.isFinite(val)) return 'NEUTRE';
  if (val >  cfg.spikeUp)       return 'SPIKE_UP';
  if (val >= cfg.explosiveUp)   return 'EXPLOSIVE_UP';
  if (val >= cfg.strongUp)      return 'STRONG_UP';
  if (val >= cfg.softUp)        return 'SOFT_UP';
  if (val >  cfg.softDown)      return 'NEUTRE';
  if (val >  cfg.strongDown)    return 'SOFT_DOWN';
  if (val >  cfg.explosiveDown) return 'STRONG_DOWN';
  if (val >  cfg.spikeDown)     return 'EXPLOSIVE_DOWN';
  return 'SPIKE_DOWN';
}
const FORCE = { SPIKE_DOWN:-4, EXPLOSIVE_DOWN:-3, STRONG_DOWN:-2, SOFT_DOWN:-1, NEUTRE:0, SOFT_UP:1, STRONG_UP:2, EXPLOSIVE_UP:3, SPIKE_UP:4 };

function fracOfDay(ts){ const m=/(\d{2}):(\d{2})/.exec(String(ts).split(' ')[1]||''); return m?(Number(m[1])+Number(m[2])/60)/24:null; }
function thetaDeg(ic,p50,frac){ return (ic==null||!(p50>0)||!(frac>0))?null:Math.atan((ic/p50)/frac)*180/Math.PI; }
function thetaLevel(t){ if(t==null)return null; const a=Math.abs(t),s=Math.sign(t); const m=a>=THETA_BANDS.t3?3:a>=THETA_BANDS.t2?2:a>=THETA_BANDS.t1?1:0; return m===0?0:s*m; }
function isActive(ts){ const [dp,tp]=String(ts).split(' '); if(!dp||!tp)return 1; const [y,mo,d]=dp.split('.').map(Number); const H=+tp.split(':')[0]; const wd=new Date(y,mo-1,d).getDay(); if(wd===0||wd===6)return 0; return (H>=HOUR_LO&&H<HOUR_HI)?1:0; }

const files = fs.readdirSync(SRC).filter(f => /^hist_.+_(M15|H1|H4)\.csv$/.test(f));
const FAILED=[]; let usedDefault=new Set(); const dist={};
for (const f of files) {
  const sym = f.match(/^hist_(.+)_(M15|H1|H4)\.csv$/)[1];
  const cfg = INTRADAY_CONFIG[sym] ?? INTRADAY_CONFIG.default;
  if (!INTRADAY_CONFIG[sym]) usedDefault.add(sym);
  const p50 = cfg.p50 ?? INTRADAY_CONFIG.default.p50;
  const L = fs.readFileSync(path.join(SRC, f), 'utf8').split(/\r?\n/);
  const header = L[0].split(';'); const ic=header.indexOf('intraday_change'), it=header.indexOf('time');
  const out=[header.concat(['intraday_level','intraday_force','theta_deg','theta_level','is_active']).join(';')];
  dist[sym]=dist[sym]||{};
  for (let i=1;i<L.length;i++){ if(!L[i].trim())continue; const c=L[i].split(';');
    const v=Number(c[ic]); const lvl=getIntradayLevel(v,cfg); dist[sym][lvl]=(dist[sym][lvl]||0)+1;
    const frac=fracOfDay(c[it]); const early=frac!=null&&frac*24<THETA_EARLY_H;
    const td=early?null:thetaDeg(v,p50,frac); const tl=thetaLevel(td);
    out.push(L[i]+';'+lvl+';'+FORCE[lvl]+';'+(td==null?'':Math.round(td*10)/10)+';'+(tl==null?'':tl)+';'+isActive(c[it]));
  }
  try { fs.writeFileSync(path.join(OUT,f), out.join('\n'), 'utf8'); }
  catch(e){ if(e.code==='EBUSY'||e.code==='EPERM')FAILED.push(f); else throw e; }
}
console.log(`OK — ${files.length-FAILED.length}/${files.length} regeneres (config MOTEUR 24mois + theta) -> ${OUT}`);
if(FAILED.length)console.log(`⚠ verrouilles: ${FAILED.join(', ')}`);
if(usedDefault.size)console.log(`⚠ default: ${[...usedDefault].join(', ')}`); else console.log(`(tous actifs calibres, COCOA inclus)`);

const LEVELS=['SPIKE_DOWN','EXPLOSIVE_DOWN','STRONG_DOWN','SOFT_DOWN','NEUTRE','SOFT_UP','STRONG_UP','EXPLOSIVE_UP','SPIKE_UP'];
const agg={};let tot=0; for(const s of Object.keys(dist))for(const[lv,n]of Object.entries(dist[s])){agg[lv]=(agg[lv]||0)+n;tot+=n;}
console.log('\nDistribution intraday_level CORRIGEE (config 24mois, tous TF) :');
for(const lv of LEVELS)console.log(`  ${lv.padEnd(15)} ${((100*(agg[lv]||0)/tot).toFixed(1)+'%').padStart(6)}`);
