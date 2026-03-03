// ============================================================================
// diag_funnel.mjs — Entonnoir complet : génération → SignalFilters → simulator
// Usage: node diag_funnel.mjs
// ============================================================================

import { readFileSync } from "fs";

const CSV_PATH =
  "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/EURGBP_5min.csv";

// ── Configs (copie des valeurs actuelles) ─────────────────────────────────
const CFG_REV = {
  rsiWindowH1: 5, rsiBuyMax: 27, rsiSellMin: 73,
  dbbzBuyMin: 0.10, dbbzSellMax: -0.10,
  flipSlopeMin: 1.0, flipDslopeMin: 1.0,
  earlyScoreBonus: 20,
};
const CFG_CONT = {
  slopeH1Min: 0.2, rsiBuyMin: 43, rsiBuyMax: 68,
  rsiSellMin: 32, rsiSellMax: 57,
  dslopeH1MaxAbs: 6.0, dslopeH1DirMin: -0.5, dslopeH1DirMax: 0.5,
  dslopeH1BuyMin: 0.15,
  zscoreH1BuyMin: 0.0, zscoreH1BuyMax: 1.5,
  zscoreH1SellMax: 0.0, zscoreH1SellMin: -1.5,
  dzH1BuyMax: 0.8, dzH1SellMin: -0.8, dzH1RepliMin: 0.01,
};
const CFG_FILT_REV = {
  rsiStalenessMargin: 16,
  slopeH1MaxAbs: 6.0, slopeH1BuyMin: 0.5, slopeH1SellMax: -0.5,
  dslopeH1OverextendedAbs: 5.0, dslopeH1AgainstAbs: 0.5,
};
const TM5 = {
  rsiBuyMax: 60, rsiSellMin: 40, slopeMin: 0.05, dslopeMin: 0.05,
  contrary: { rsiBuyMax:60, rsiSellMin:40, slopeVeto:0,
              dslopeBuyMin:-0.10, dslopeSellMax:0.10,
              drsiBuyMin:-0.1, drsiSellMax:0.1, drsiVetoBuy:-1.0, drsiVetoSell:1.0 },
  overextended: { slopeAbs:6.0, dslopeAbs:4.0, drsiAbs:6.0 },
  momentumFloor: 0.01,
};
const TM1 = {
  rsiBuyMax: 55, rsiSellMin: 45,
  contrary: { drsiAbs: 2.0 },
  overextended: { slopeAbs:6.0, dslopeAbs:6.0, drsiAbs:8.0 },
};
const WEEKEND_FRIDAY_HOUR = 15;

// ── ATR volatility config EURGBP ─────────────────────────────────────────
const VOL_EURGBP = { minRatio: 0.00010, maxRatio: 0.00200 };

// ── Parse ──────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(";").map(s => s.trim());
  return lines.slice(1).map(l => {
    const cols = l.split(";");
    const o = {};
    header.forEach((k, j) => {
      const r = (cols[j] ?? "").trim(), n = Number(r);
      o[k] = r === "" ? null : (Number.isFinite(n) ? n : r);
    });
    return o;
  });
}
const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

// ── H1 RSI window ──────────────────────────────────────────────────────────
function getMinMaxRSI(rows, idx, w) {
  let count=0, min=Infinity, max=-Infinity, cur=null, lastHour=null;
  for (let k=idx; k>=0; k--) {
    const hour = rows[k]?.timestamp?.slice(0,13);
    if (!hour || hour===lastHour) continue;
    lastHour=hour;
    const rsi=num(rows[k]?.rsi_h1);
    if (rsi===null) return null;
    if (cur===null) cur=rsi;
    if (rsi<min) min=rsi; if (rsi>max) max=rsi;
    if (++count>=w) break;
  }
  return count<w ? null : { minRSI:min, maxRSI:max, currentRSI:cur };
}

// ── Weekend filter ────────────────────────────────────────────────────────
function isWeekend(ts) {
  if (!ts) return false;
  const [dp,tp] = ts.split(" "); if (!dp||!tp) return false;
  const d = new Date(`${dp.replace(/\./g,"-")}T${tp}:00`);
  if (isNaN(d)) return false;
  const day=d.getDay(), h=d.getHours();
  return day===6||day===0||(day===5&&h>=WEEKEND_FRIDAY_HOUR);
}

// ── Vol filter ────────────────────────────────────────────────────────────
function isUntradableVol(atr, close) {
  const r = (num(atr)&&num(close)&&close>0) ? atr/close : null;
  if (!r) return false;
  return r < VOL_EURGBP.minRatio || r > VOL_EURGBP.maxRatio;
}

// ── Signal filters (inline) ────────────────────────────────────────────────
function isM5Contrary(o, side) {
  const slope=num(o.slope_m5), dslope=num(o.dslope_m5), drsi=num(o.drsi_m5), rsi=num(o.rsi_m5);
  if (slope==null||dslope==null||drsi==null||rsi==null) return true;
  const c=TM5.contrary;
  if (side==="BUY")  { if(rsi>c.rsiBuyMax) return true; if(slope<c.slopeVeto) return true; if(dslope<c.dslopeBuyMin&&drsi<c.drsiBuyMin) return true; if(drsi<c.drsiVetoBuy) return true; }
  if (side==="SELL") { if(rsi<c.rsiSellMin) return true; if(slope>c.slopeVeto) return true; if(dslope>c.dslopeSellMax&&drsi>c.drsiSellMax) return true; if(drsi>c.drsiVetoSell) return true; }
  return false;
}
function isM5Overextended(o, side) {
  const slope=num(o.slope_m5), dslope=num(o.dslope_m5), drsi=num(o.drsi_m5);
  if (slope===null||dslope===null||drsi===null) return false;
  const oe=TM5.overextended;
  if (side==="SELL"&&(slope<-oe.slopeAbs||dslope<-oe.dslopeAbs||drsi<-oe.drsiAbs)) return true;
  if (side==="BUY" &&(slope>oe.slopeAbs||dslope>oe.dslopeAbs||drsi>oe.drsiAbs)) return true;
  return false;
}
function isM5WeakMomentum(o, side) {
  const slope=num(o.slope_m5), dslope=num(o.dslope_m5);
  if (slope==null||dslope==null) return true;
  const f=TM5.momentumFloor;
  if (side==="BUY"  && (slope< f||dslope< f)) return true;
  if (side==="SELL" && (slope>-f||dslope>-f)) return true;
  return false;
}
function isM1Contrary(o, side) {
  const slope=num(o.slope_m1), drsi=num(o.drsi_m1);
  if (slope===null||drsi===null) return false;
  const t=TM1.contrary.drsiAbs;
  if (side==="BUY"  && (slope<0||drsi<-t)) return true;
  if (side==="SELL" && (slope>0||drsi>t))  return true;
  return false;
}
function isM1Overextended(o, side) {
  const slope=num(o.slope_m1), dslope=num(o.dslope_m1), drsi=num(o.drsi_m1);
  if (slope===null||dslope===null||drsi===null) return false;
  const oe=TM1.overextended;
  if (side==="SELL"&&(slope<-oe.slopeAbs||dslope<-oe.dslopeAbs||drsi<-oe.drsiAbs)) return true;
  if (side==="BUY" &&(slope>oe.slopeAbs||dslope>oe.dslopeAbs||drsi>oe.drsiAbs)) return true;
  return false;
}
function isStaleH1(o, side) {
  const rsi=num(o.rsi_h1); if(rsi===null) return false;
  const m=CFG_FILT_REV.rsiStalenessMargin;
  if (side==="BUY"  && rsi > CFG_REV.rsiBuyMax  + m) return true;
  if (side==="SELL" && rsi < CFG_REV.rsiSellMin  - m) return true;
  return false;
}
function isH1TrendExtreme(o, side) {
  const s=num(o.slope_h1); if(s===null) return false;
  const mx=CFG_FILT_REV.slopeH1MaxAbs;
  if (side==="BUY"  && s < -mx) return true;
  if (side==="SELL" && s >  mx) return true;
  return false;
}
function isH1SlopeAgainst(o, side) {
  const s=num(o.slope_h1); if(s===null) return false;
  if (side==="BUY"  && s < CFG_FILT_REV.slopeH1BuyMin)  return true;
  if (side==="SELL" && s > CFG_FILT_REV.slopeH1SellMax) return true;
  return false;
}
function isH1MomentumOverextended(o, side) {
  const d=num(o.dslope_h1); if(d===null) return false;
  const mx=CFG_FILT_REV.dslopeH1OverextendedAbs;
  if (side==="BUY"  && d >  mx) return true;
  if (side==="SELL" && d < -mx) return true;
  return false;
}
function isH1MomentumAgainst(o, side) {
  const d=num(o.dslope_h1); if(d===null) return false;
  const t=CFG_FILT_REV.dslopeH1AgainstAbs;
  if (side==="BUY"  && d <= -t) return true;
  if (side==="SELL" && d >=  t) return true;
  return false;
}

// ============================================================================
// MAIN
// ============================================================================
const rows = parseCSV(readFileSync(CSV_PATH, "utf8"));
rows.forEach((r,i) => r._idx = i);

// ── STEP 1 : Génération reversal ──────────────────────────────────────────
const revSignals = [];
for (let i=0; i<rows.length; i++) {
  const row=rows[i];
  if (!row.timestamp) continue;
  const rs=getMinMaxRSI(rows, i, CFG_REV.rsiWindowH1);
  if (!rs) continue;
  const dbbz=num(row.dz_h1); if(dbbz===null) continue;

  let side=null, signalType=null;
  if (rs.minRSI <= CFG_REV.rsiBuyMax && dbbz >= CFG_REV.dbbzBuyMin)
    { side="BUY"; signalType="reversal"; }
  else if (rs.maxRSI >= CFG_REV.rsiSellMin && dbbz <= CFG_REV.dbbzSellMax)
    { side="SELL"; signalType="reversal"; }
  if (!side) continue;

  // M1 RSI timing (inside reversal.js)
  const r1=num(row.rsi_m1);
  if (side==="BUY"  && r1!==null && r1>TM1.rsiBuyMax)  continue;
  if (side==="SELL" && r1!==null && r1<TM1.rsiSellMin) continue;

  revSignals.push({ ...row, side, type:"reversal",
    rsi_h1: rs.currentRSI, minrsi_h1: rs.minRSI, maxrsi_h1: rs.maxRSI });
}

// ── STEP 2 : Génération continuation ──────────────────────────────────────
const contSignals = [];
for (const row of rows) {
  if (!row.timestamp) continue;
  const sh=num(row.slope_h1),dsh=num(row.dslope_h1),rh=num(row.rsi_h1),
        rm=num(row.rsi_m5),r1=num(row.rsi_m1),sm=num(row.slope_m5),
        dm=num(row.dslope_m5),z=num(row.zscore_h1),dz=num(row.dz_h1);
  if (sh===null||dsh===null||rh===null||rm===null||sm===null||dm===null) continue;
  let side=null;
  if (sh>=CFG_CONT.slopeH1Min&&rh>=CFG_CONT.rsiBuyMin&&rh<=CFG_CONT.rsiBuyMax
      &&rm<=TM5.rsiBuyMax&&(r1===null||r1<=TM1.rsiBuyMax)
      &&dsh>=CFG_CONT.dslopeH1DirMin&&Math.abs(dsh)<=CFG_CONT.dslopeH1MaxAbs
      &&dsh>=CFG_CONT.dslopeH1BuyMin&&sm>TM5.slopeMin&&dm>TM5.dslopeMin
      &&(z===null||z>=CFG_CONT.zscoreH1BuyMin)&&(z===null||z<=CFG_CONT.zscoreH1BuyMax)
      &&(dz===null||dz<=CFG_CONT.dzH1BuyMax)
      &&!(z!==null&&dz!==null&&z<CFG_CONT.zscoreH1BuyMax&&dz<CFG_CONT.dzH1RepliMin))
    side="BUY";
  else if (sh<=-CFG_CONT.slopeH1Min&&rh>=CFG_CONT.rsiSellMin&&rh<=CFG_CONT.rsiSellMax
      &&rm>=TM5.rsiSellMin&&(r1===null||r1>=TM1.rsiSellMin)
      &&dsh<=CFG_CONT.dslopeH1DirMax&&Math.abs(dsh)<=CFG_CONT.dslopeH1MaxAbs
      &&dsh<=-CFG_CONT.dslopeH1BuyMin&&sm<-TM5.slopeMin&&dm<-TM5.dslopeMin
      &&(z===null||z<=CFG_CONT.zscoreH1SellMax)&&(z===null||z>=CFG_CONT.zscoreH1SellMin)
      &&(dz===null||dz>=CFG_CONT.dzH1SellMin)
      &&!(z!==null&&dz!==null&&z>CFG_CONT.zscoreH1SellMin&&dz>-CFG_CONT.dzH1RepliMin))
    side="SELL";
  if (side) contSignals.push({ ...row, side, type:"continuation" });
}

const allSignals = [...revSignals, ...contSignals].sort((a,b)=>a._idx-b._idx);

console.log(`\n${"=".repeat(72)}`);
console.log(`FUNNEL COMPLET EURGBP — ${rows.length} barres`);
console.log("=".repeat(72));
console.log(`\n── STEP 1-2: GÉNÉRATION ─────────────────────────────────────────────`);
console.log(`  Reversal   : ${revSignals.length}  (BUY=${revSignals.filter(s=>s.side==="BUY").length}  SELL=${revSignals.filter(s=>s.side==="SELL").length})`);
console.log(`  Continuation: ${contSignals.length}  (BUY=${contSignals.filter(s=>s.side==="BUY").length}  SELL=${contSignals.filter(s=>s.side==="SELL").length})`);
console.log(`  TOTAL      : ${allSignals.length}`);

// ── STEP 3 : SignalFilters — entonnoir séquentiel avec comptage ────────────
console.log(`\n── STEP 3: SIGNAL FILTERS ────────────────────────────────────────────`);

const wait = {};
const inc = k => wait[k]=(wait[k]??0)+1;
let remaining = [...allSignals];

// Filtre communs
remaining = remaining.filter(o => {
  if (isWeekend(o.timestamp)) { inc("WAIT_WEEKEND"); return false; }
  return true;
});
const afterWeekend = remaining.length;

remaining = remaining.filter(o => {
  if (isUntradableVol(o.atr_m15, o.close)) { inc("WAIT_VOL"); return false; }
  return true;
});
const afterVol = remaining.length;

// Filtres par type
const valid = [];
for (const o of remaining) {
  const side = o.side;
  if (o.type === "continuation") {
    if (isM5Overextended(o,side))  { inc("WAIT_M5_OVEREXTENDED"); continue; }
    if (isM1Overextended(o,side))  { inc("WAIT_M1_OVEREXTENDED"); continue; }
  } else {
    if (isM5Contrary(o,side))      { inc("WAIT_MICRO");          continue; }
    if (isM5Overextended(o,side))  { inc("WAIT_M5_OVEREXTENDED"); continue; }
    if (isStaleH1(o,side))         { inc("WAIT_STALE_RSI");      continue; }
    if (isH1TrendExtreme(o,side))  { inc("WAIT_H1_EXTREME");     continue; }
    if (isH1SlopeAgainst(o,side))  { inc("WAIT_H1_SLOPE");       continue; }
    if (isH1MomentumOverextended(o,side)) { inc("WAIT_H1_OVEREXTENDED"); continue; }
    if (isH1MomentumAgainst(o,side))      { inc("WAIT_H1_MOMENTUM");     continue; }
    if (isM5WeakMomentum(o,side))  { inc("WAIT_WEAK_M5");        continue; }
    if (isM1Contrary(o,side))      { inc("WAIT_M1_CONTRARY");    continue; }
    if (isM1Overextended(o,side))  { inc("WAIT_M1_OVEREXTENDED"); continue; }
  }
  valid.push({ ...o, state:"VALID" });
}

// Affichage entonnoir
const total0 = allSignals.length;
console.log(`  Total initial            : ${total0}`);
console.log(`  Après WAIT_WEEKEND       : ${afterWeekend.toString().padStart(5)}  [-${total0-afterWeekend}]`);
console.log(`  Après WAIT_VOL           : ${afterVol.toString().padStart(5)}  [-${afterWeekend-afterVol}]`);
console.log(`\n  Filtres reversal (bloquages totaux) :`);
const filterOrder = [
  "WAIT_MICRO","WAIT_M5_OVEREXTENDED","WAIT_STALE_RSI","WAIT_H1_EXTREME",
  "WAIT_H1_SLOPE","WAIT_H1_OVEREXTENDED","WAIT_H1_MOMENTUM","WAIT_WEAK_M5",
  "WAIT_M1_CONTRARY","WAIT_M1_OVEREXTENDED"
];
for (const k of filterOrder) {
  if (wait[k]) console.log(`    ${k.padEnd(28)}: ${String(wait[k]).padStart(5)}`);
}
console.log(`  ── Total bloqués filtres spécifiques: ${Object.values(wait).reduce((s,v)=>s+v,0)-(wait.WAIT_WEEKEND??0)-(wait.WAIT_VOL??0)}`);
console.log(`\n  VALID après SignalFilters: ${valid.length}  (BUY=${valid.filter(s=>s.side==="BUY").length}  SELL=${valid.filter(s=>s.side==="SELL").length})`);
console.log(`    dont reversal   : ${valid.filter(s=>s.type==="reversal").length}`);
console.log(`    dont continuation: ${valid.filter(s=>s.type==="continuation").length}`);

// ── STEP 4 : Simulator filters ────────────────────────────────────────────
console.log(`\n── STEP 4: SIMULATOR FILTERS ────────────────────────────────────────`);

// Simuler uniquement les bloquages de fréquence (spacing, cooldown)
// sans PnL — juste compter les entrées potentielles
const MIN_SPACING = 5;
const LOSS_COOLDOWN = 15;
const MAX_OPEN = 10;

function parseTs(ts) {
  if (!ts) return NaN;
  const [d,t] = ts.split(" ");
  return new Date(`${d.replace(/\./g,"-")}T${t}:00`).getTime();
}

let lastEntry = null;
let simEntered=0, simSpacing=0, simMaxOpen=0, simCooldown=0;
// Pour cooldown simplifié : track dernière perte (on ne peut pas faire ça sans PnL donc on skip)
const openMock = []; // track du nb d'opens mock (sans fermetures)

// Simple spacing + maxOpen simulation
let simValid=0;
let lastEntryMs=null;
const entryTimes = [];

for (const sig of valid) {
  const ms = parseTs(sig.timestamp);
  if (!Number.isFinite(ms)) continue;
  simValid++;

  // min spacing
  if (lastEntryMs && MIN_SPACING>0 && (ms-lastEntryMs)/60000 < MIN_SPACING) {
    simSpacing++;
    continue;
  }
  simEntered++;
  lastEntryMs = ms;
  entryTimes.push(ms);
}

console.log(`  Signaux VALID à traiter   : ${simValid}`);
console.log(`  Bloqués min spacing (${MIN_SPACING}min): ${simSpacing}`);
console.log(`  Entrées potentielles      : ${simEntered}`);
console.log(`  (+ LOSS_COOLDOWN_MIN=${LOSS_COOLDOWN}min et MAX_OPEN=${MAX_OPEN} s'appliquent en plus)`);

// ── Distribution temporelle des signaux valides ───────────────────────────
console.log(`\n── STEP 5: DENSITÉ TEMPORELLE (signaux VALID) ────────────────────────`);
const byDay = {};
for (const sig of valid) {
  const day = sig.timestamp?.slice(0,10).replace(/\./g,"-");
  if (day) byDay[day] = (byDay[day]??0)+1;
}
const days = Object.keys(byDay).sort();
const signalsPerDay = Object.values(byDay);
const avgPerDay = signalsPerDay.reduce((s,v)=>s+v,0)/signalsPerDay.length;
const maxPerDay  = Math.max(...signalsPerDay);
const minPerDay  = Math.min(...signalsPerDay);
console.log(`  Jours avec signaux: ${days.length}`);
console.log(`  Signaux/jour: avg=${avgPerDay.toFixed(1)}  min=${minPerDay}  max=${maxPerDay}`);
console.log(`  → Trades exécutés attendus (1 toutes les ~${MIN_SPACING}min): ~${Math.round(simEntered)} max`);

// Top/bottom 5 days
console.log(`  Top 5 jours (plus de signaux):`);
Object.entries(byDay).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([d,n])=>console.log(`    ${d}: ${n}`));

// ── Analyse WAIT_H1_SLOPE (gros bloqueur reversal) ────────────────────────
console.log(`\n── STEP 6: ANALYSE WAIT_H1_SLOPE (filtre dominant) ──────────────────`);
// Pour les reversal signals bloqués par H1_SLOPE, quelle est la distrib de slope_h1?
let revAfterBasic = revSignals.filter(o => !isWeekend(o.timestamp) && !isUntradableVol(o.atr_m15,o.close));
const buyRevAfterBasic  = revAfterBasic.filter(o=>o.side==="BUY");
const sellRevAfterBasic = revAfterBasic.filter(o=>o.side==="SELL");

// Après les filtres antérieurs à H1_SLOPE
function passesBeforeH1Slope(o) {
  const side=o.side;
  if (isM5Contrary(o,side)) return false;
  if (isM5Overextended(o,side)) return false;
  if (isStaleH1(o,side)) return false;
  if (isH1TrendExtreme(o,side)) return false;
  return true;
}
const revBeforeH1Slope = revAfterBasic.filter(passesBeforeH1Slope);
const blockedByH1Slope  = revBeforeH1Slope.filter(o=>isH1SlopeAgainst(o,o.side));
const passH1Slope       = revBeforeH1Slope.filter(o=>!isH1SlopeAgainst(o,o.side));

console.log(`  Reversal après filtres communs+micro+stale+extreme : ${revBeforeH1Slope.length}`);
console.log(`  Bloqués WAIT_H1_SLOPE  : ${blockedByH1Slope.length} (${(blockedByH1Slope.length/revBeforeH1Slope.length*100).toFixed(0)}%)`);
console.log(`  Passent WAIT_H1_SLOPE  : ${passH1Slope.length}`);

// Distribution de slope_h1 pour les signaux bloqués par H1_SLOPE
const slopes_blocked = blockedByH1Slope.map(o=>num(o.slope_h1)).filter(v=>v!==null);
const pct = (arr,p) => { const s=[...arr].sort((a,b)=>a-b); return s[Math.min(Math.floor(p/100*s.length),s.length-1)]; };
if (slopes_blocked.length) {
  console.log(`  slope_h1 des signaux bloqués (min→max):`);
  console.log(`    p5=${pct(slopes_blocked,5).toFixed(2)}  p25=${pct(slopes_blocked,25).toFixed(2)}  p50=${pct(slopes_blocked,50).toFixed(2)}  p75=${pct(slopes_blocked,75).toFixed(2)}  p95=${pct(slopes_blocked,95).toFixed(2)}`);
}

// ── Simulation avec H1_SLOPE relaxé ──────────────────────────────────────
console.log(`\n── STEP 7: SIMULATION AVEC H1_SLOPE RELAXÉ ──────────────────────────`);
function simWithSlopeMin(slopeMin) {
  const tmpCfg = { ...CFG_FILT_REV, slopeH1BuyMin: slopeMin, slopeH1SellMax: -slopeMin };
  const v = [];
  for (const o of [...revSignals, ...contSignals].sort((a,b)=>a._idx-b._idx)) {
    if (isWeekend(o.timestamp)) continue;
    if (isUntradableVol(o.atr_m15,o.close)) continue;
    const side=o.side;
    if (o.type==="continuation") {
      if (isM5Overextended(o,side)||isM1Overextended(o,side)) continue;
    } else {
      if (isM5Contrary(o,side)) continue;
      if (isM5Overextended(o,side)) continue;
      if (isStaleH1(o,side)) continue;
      if (isH1TrendExtreme(o,side)) continue;
      // H1 slope avec seuil modifié
      const s=num(o.slope_h1);
      if (s!==null && ((side==="BUY"&&s<tmpCfg.slopeH1BuyMin)||(side==="SELL"&&s>tmpCfg.slopeH1SellMax))) continue;
      if (isH1MomentumOverextended(o,side)) continue;
      if (isH1MomentumAgainst(o,side)) continue;
      if (isM5WeakMomentum(o,side)) continue;
      if (isM1Contrary(o,side)) continue;
      if (isM1Overextended(o,side)) continue;
    }
    v.push(o);
  }
  // spacing
  let entered=0, lastMs=null;
  for (const sig of v) {
    const ms=parseTs(sig.timestamp); if(!Number.isFinite(ms)) continue;
    if (lastMs&&(ms-lastMs)/60000<MIN_SPACING) continue;
    entered++; lastMs=ms;
  }
  return { valid:v.length, afterSpacing:entered };
}

const thresholds = [0.5, 0.3, 0.1, 0.0, -0.3, -0.5];
console.log(`  slopeH1BuyMin  | VALID signaux | Après spacing(${MIN_SPACING}min)`);
console.log("  " + "─".repeat(52));
for (const t of thresholds) {
  const r = simWithSlopeMin(t);
  const marker = t===0.5 ? " ← ACTUEL" : t===0.0 ? " ← slope neutre" : t<0 ? " ← permet tendance contre" : "";
  console.log(`  ${String(t).padEnd(6).padStart(14)} | ${String(r.valid).padStart(13)} | ${String(r.afterSpacing).padStart(16)}${marker}`);
}

console.log("\n" + "=".repeat(72) + "\n");
