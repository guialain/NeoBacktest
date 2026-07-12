// Portée du veto "IMPOSSIBLE sur définisseur de régime" (dailyDirection, force).
// Sur tous les fires (admission ON, cadence 2), combien ont le profil gagnant marqué IMPOSSIBLE
// par un définisseur ? Et que devient le winner si on disqualifie ces profils ?
// node prep/vetoScope.mjs
import fs from "fs";
import { detectOpportunity } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { observeProfile, _internals } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js";
import { PROFILES, KNOWLEDGE } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/MarketProfileKnowledge.js";
import { admissionBlock } from "../src/components/simulations/matrixBacktest.mjs";
const { OBS_WEIGHT, scoreOf } = _internals;
const OBS = Object.keys(OBS_WEIGHT);
const DEF = ["dailyDirection", "force"];               // définisseurs de régime
const SIDE = { "Sell-off": "SELL", "Strong Bear": "SELL", "Soft Bear": "SELL", "Soft Bull": "BUY", "Strong Bull": "BUY", "Rally": "BUY", "Range": "—", "Exhaustion": "—" };
const assets = fs.readdirSync("./data/matrix").filter(f => f.endsWith(".csv")).map(f => f.replace(".csv", ""));

function rawScores(obs, vetoDef) {
  const s = {};
  for (const p of PROFILES) {
    const pi = PROFILES.indexOf(p);
    let vetoed = false, sum = 0;
    for (const ax of OBS) {
      const row = KNOWLEDGE[ax]?.[obs[ax]]; if (!row) continue;
      const lvl = row[pi];
      if (vetoDef && DEF.includes(ax) && lvl === "IMPOSSIBLE") vetoed = true;
      sum += OBS_WEIGHT[ax] * scoreOf(lvl);
    }
    s[p] = vetoed ? -Infinity : sum;
  }
  return s;
}
const topOf = (s) => Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];

let fires = 0, defImp = { dailyDirection: 0, force: 0, any: 0 };
let flipSide = 0, toWait = 0, sameSideRelabel = 0, toRangeExh = 0;
const CAD = 2;
for (const a of assets) {
  const L = fs.readFileSync(`./data/matrix/${a}.csv`, "utf8").split(/\r?\n/).filter(Boolean);
  const h = L[0].split(";"); const rows = L.slice(1).map(l => { const v = l.split(";"); const o = {}; h.forEach((k, i) => o[k] = v[i]); return o; });
  const sym = String(rows[0].symbol || a).toUpperCase();
  let lastEp = -1e9;
  for (const r of rows) {
    const ep = Math.round(Date.parse(r.ts_utc ?? r.timestamp) / 60000);
    if (!Number.isFinite(ep) || ep < lastEp + CAD) continue; lastEp = ep;
    if (admissionBlock(r, sym)) continue;
    let det; try { det = detectOpportunity(r, sym); } catch { continue; }
    const sel = det.selection; if (sel?.side !== "BUY" && sel?.side !== "SELL") continue;
    fires++;
    const win = sel.profile ?? det.marketProfile?.profile; if (!win) continue;
    const obs = observeProfile(det); const pi = PROFILES.indexOf(win);
    const dImp = KNOWLEDGE.dailyDirection?.[obs.dailyDirection]?.[pi] === "IMPOSSIBLE";
    const fImp = KNOWLEDGE.force?.[obs.force]?.[pi] === "IMPOSSIBLE";
    if (dImp) defImp.dailyDirection++;
    if (fImp) defImp.force++;
    if (dImp || fImp) {
      defImp.any++;
      const newTop = topOf(rawScores(obs, true));
      const oldSide = sel.side, newSide = SIDE[newTop];
      if (newSide === "—") toRangeExh++;
      else if (newSide !== oldSide) flipSide++;
      else sameSideRelabel++;
    }
  }
}
const pct = (n) => (100 * n / fires).toFixed(1);
console.log(`\n=== Portée veto IMPOSSIBLE-définisseur (19 actifs, cad 2min, admission ON) ===`);
console.log(`Fires totaux : ${fires}`);
console.log(`\nProfil gagnant marqué IMPOSSIBLE par un définisseur :`);
console.log(`  dailyDirection : ${defImp.dailyDirection} (${pct(defImp.dailyDirection)}% des fires)`);
console.log(`  force          : ${defImp.force} (${pct(defImp.force)}%)`);
console.log(`  au moins un    : ${defImp.any} (${pct(defImp.any)}%)  ← fires revus par le veto`);
console.log(`\nParmi ces ${defImp.any} fires, le winner re-classé (veto appliqué) devient :`);
console.log(`  côté OPPOSÉ (bull↔bear)        : ${flipSide}   ← le fire s'inverse`);
console.log(`  Range/Exhaustion (côté = c3)   : ${toRangeExh}`);
console.log(`  même régime, profil relabelisé : ${sameSideRelabel}  ← fire probablement conservé`);
