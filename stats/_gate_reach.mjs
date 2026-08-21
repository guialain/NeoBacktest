import fs from 'fs';
const dir='C:/Users/Public/Neo-Backtest/data/matrix';
let tot=0, sig=0, perAsset={};
for (const f of fs.readdirSync(dir).filter(x=>x.endsWith('.csv'))) {
  const raw=fs.readFileSync(`${dir}/${f}`,'utf8').split(/\r?\n/).filter(l=>l.trim());
  const H=raw[0].split(';').map(h=>h.trim());
  const I=n=>H.indexOf(n);
  const iK0=I('stoch_k_h1_s0'),iK1=I('stoch_k_h1_s1'),iK2=I('stoch_k_h1_s2'),iK3=I('stoch_k_h1_s3');
  const seen=new Set();
  for(let i=1;i<raw.length;i++){const v=raw[i].split(';');
    const hk=f+'|'+String(v[1]??'').slice(0,13); if(seen.has(hk))continue; seen.add(hk);   // 1/barre H1
    const k0=+v[iK0],k1=+v[iK1],k2=+v[iK2],k3=+v[iK3];
    if([k0,k1,k2,k3].some(x=>!Number.isFinite(x)))continue; tot++;
    const prevMin=Math.min(k1,k2,k3);
    if(prevMin<20 && (k0-k1)>3){sig++; perAsset[f]=(perAsset[f]||0)+1;}
  }
}
console.log(`Signature « préc.min<20 & kS0−kS1>3 » : ${sig} / ${tot} barres H1 (${(100*sig/tot).toFixed(1)}%)`);
console.log('par actif (top):', Object.entries(perAsset).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([a,n])=>`${a.replace('.csv','')}:${n}`).join(' '));
