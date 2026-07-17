// add_adx.mjs — JOINT l'ADX(14)+DI NATIF MT5 (dataset d'étude hist_*) aux rows data/matrix, par heure.
//   (recalcul depuis M1 abandonné : warmup-starved → direction fausse. Le natif = ADX MT5 exact.)
// Barres CLOSES uniquement (s0 forming indispo sans look-ahead → viendra du scan live MQL5).
// Colonnes ajoutées : adx14_{h1,m15}_c1/c2/c3 et plus_di/minus_di_{h1,m15}_c1/c2/c3 (c1=dernière close).
//   17/07 : le DI passe de c1 seul à c1/c2/c3 — même traitement que l'ADX, pour pouvoir comparer les SIGNES
//   de Δ₁ et Δ₂ sur le DI aussi (les hist_* portaient déjà pdi/mdi par barre, on les jetait).
import fs from 'fs';
import path from 'path';

const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const HIST   = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';

function em(ts){ const m=/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/.exec(String(ts)); return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])/60000:null; }

// map nom matrix -> nom hist (casse), depuis les fichiers dispo
const histFiles = fs.readdirSync(HIST).filter(f=>/^hist_.+_H1\.csv$/.test(f));
const histName = {}; for(const f of histFiles){ const a=f.replace(/^hist_/,'').replace(/_H1\.csv$/,''); histName[a.toUpperCase()]=a; }

// charge hist_<name>_<TF>.csv → Map(openEpochMin -> {adx,pdi,mdi})
function loadHist(name, tf){
  const fp=path.join(HIST,`hist_${name}_${tf}.csv`); if(!fs.existsSync(fp)) return null;
  const L=fs.readFileSync(fp,'utf8').split(/\r?\n/); const h=L[0].split(';');
  const it=h.indexOf('time'),ia=h.indexOf('adx14'),ip=h.indexOf('plus_di'),im=h.indexOf('minus_di');
  const map=new Map();
  for(let i=1;i<L.length;i++){ const c=L[i].split(';'); if(c.length<h.length)continue; const t=em(c[it]); if(t==null)continue;
    map.set(t,{adx:+c[ia],pdi:+c[ip],mdi:+c[im]}); }
  return map;
}

const files=fs.readdirSync(MATRIX).filter(f=>f.toLowerCase().endsWith('.csv'));
let done=0, skipped=[];
for(const f of files){
  const asset=f.replace(/\.csv$/i,''); const hn=histName[asset.toUpperCase()];
  if(!hn){ skipped.push(asset); continue; }
  const h1=loadHist(hn,'H1'), m15=loadHist(hn,'M15');
  if(!h1||!m15){ skipped.push(asset); continue; }
  const get=(map,openMin)=>{ const v=map.get(openMin); return v?v:null; };

  const ML=fs.readFileSync(path.join(MATRIX,f),'utf8').split(/\r?\n/);
  const hdr=ML[0].split(';');
  // ⚠ STRIP PAR NOM, pas par position (owner 2026-07-17). L'ancienne version coupait « les N dernières
  //   colonnes » : dès qu'on ajoute une colonne à COLS, le garde-fou anti-double-ajout (`cols.every(...)`)
  //   passe à false sur un fichier DÉJÀ augmenté → l'ancien bloc n'est plus stripé → colonnes DUPLIQUÉES.
  //   Par nom, la migration d'un jeu de colonnes à l'autre est idempotente quelle que soit la forme d'avant.
  const MANAGED = new Set([
    'adx14_h1_c1','adx14_h1_c2','adx14_h1_c3','adx14_m15_c1','adx14_m15_c2','adx14_m15_c3',
    'plus_di_h1_c1','minus_di_h1_c1','plus_di_m15_c1','minus_di_m15_c1',
    // 17/07 : DI sur 3 closes, comme l'ADX → permet Δ₁/Δ₂ et la comparaison de SIGNE sur le DI aussi.
    //   Les hist_* portaient déjà pdi/mdi à chaque barre ; on les jetait, c'est tout.
    'plus_di_h1_c2','plus_di_h1_c3','minus_di_h1_c2','minus_di_h1_c3',
    'plus_di_m15_c2','plus_di_m15_c3','minus_di_m15_c2','minus_di_m15_c3',
  ]);
  const cols=['adx14_h1_c1','adx14_h1_c2','adx14_h1_c3','adx14_m15_c1','adx14_m15_c2','adx14_m15_c3',
    'plus_di_h1_c1','plus_di_h1_c2','plus_di_h1_c3','minus_di_h1_c1','minus_di_h1_c2','minus_di_h1_c3',
    'plus_di_m15_c1','plus_di_m15_c2','plus_di_m15_c3','minus_di_m15_c1','minus_di_m15_c2','minus_di_m15_c3'];
  const keep = hdr.map((c,i)=>[c,i]).filter(([c])=>!MANAGED.has(c)).map(([,i])=>i);
  const baseHdr = keep.map(i=>hdr[i]);
  const out=[baseHdr.concat(cols).join(';')];
  const r2=v=>v==null?'':Math.round(v*100)/100;
  for(let i=1;i<ML.length;i++){ if(!ML[i].trim())continue;
    const parts=ML[i].split(';');
    const line=keep.map(j=>parts[j]??'').join(';');
    const T=em(parts[0]);
    if(T==null){ out.push(line+';'+cols.map(()=>'').join(';')); continue; }
    // H1 : dernière close = heure floor(T,60)-60 ; c2 -120 ; c3 -180
    const hf=Math.floor(T/60)*60; const h_c1=get(h1,hf-60),h_c2=get(h1,hf-120),h_c3=get(h1,hf-180);
    const qf=Math.floor(T/15)*15; const m_c1=get(m15,qf-15),m_c2=get(m15,qf-30),m_c3=get(m15,qf-45);
    out.push([line, r2(h_c1?.adx),r2(h_c2?.adx),r2(h_c3?.adx), r2(m_c1?.adx),r2(m_c2?.adx),r2(m_c3?.adx),
      r2(h_c1?.pdi),r2(h_c2?.pdi),r2(h_c3?.pdi), r2(h_c1?.mdi),r2(h_c2?.mdi),r2(h_c3?.mdi),
      r2(m_c1?.pdi),r2(m_c2?.pdi),r2(m_c3?.pdi), r2(m_c1?.mdi),r2(m_c2?.mdi),r2(m_c3?.mdi)].join(';'));
  }
  fs.writeFileSync(path.join(MATRIX,f), out.join('\n'),'utf8'); done++;
}
console.log(`OK — ${done} matrix joints à l'ADX natif (H1+M15, closes c1/c2/c3). Skipped: ${skipped.join(',')||'aucun'}`);

// sanity GOLD : c1/c2/c3 H1 pour une row ~15:47
const gm=fs.readFileSync(path.join(MATRIX,'GOLD.csv'),'utf8').split(/\r?\n/);
const gh=gm[0].split(';'); const gi=n=>gh.indexOf(n);
for(const l of gm){ if(l.startsWith('2026.06.30 15:47')){ const v=l.split(';');
  console.log(`  GOLD 15:47 → H1 adx c1=${v[gi('adx14_h1_c1')]} c2=${v[gi('adx14_h1_c2')]} c3=${v[gi('adx14_h1_c3')]} | +DI=${v[gi('plus_di_h1_c1')]} -DI=${v[gi('minus_di_h1_c1')]}`);
  break; } }
