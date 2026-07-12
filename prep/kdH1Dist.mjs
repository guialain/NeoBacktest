// Distribution de K−D H1 sur les fires (SELL/BUY), splittée WIN vs LOSS. Pour caler le veto H1.
// node prep/kdH1Dist.mjs   (tourne sur le moteur local — stash le veto avant pour capturer tous les fires)
import fs from "fs";
import { detectOpportunity } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const TP = 0.65, SL = 1.95, CAD = 2;
const ASSETS = fs.readdirSync("./data/matrix").filter((f) => f.endsWith(".csv")).map((f) => f.replace(".csv", ""));

function loadRows(a) {
  const L = fs.readFileSync(`./data/matrix/${a}.csv`, "utf8").split(/\r?\n/).filter(Boolean);
  const h = L[0].split(";");
  return L.slice(1).map((l) => { const v = l.split(";"); const o = {}; h.forEach((k, i) => o[k] = v[i]); return o; });
}
function outcome(series, i, side, atr) {
  const p0 = series[i].price, day = series[i].day, sgn = side === "BUY" ? 1 : -1;
  if (p0 == null || !(atr > 0)) return null;
  const tp = p0 + sgn * TP * atr, sl = p0 - sgn * SL * atr;
  for (let j = i + 1; j < series.length && series[j].day === day; j++) {
    const px = series[j].price; if (px == null) continue;
    if (sgn > 0 ? px >= tp : px <= tp) return "WIN";
    if (sgn > 0 ? px <= sl : px >= sl) return "LOSS";
  }
  return "TO";
}

// buckets : { SELL:{WIN:[kd...],LOSS:[...]}, BUY:{...} }
const B = { SELL: { WIN: [], LOSS: [] }, BUY: { WIN: [], LOSS: [] } };
for (const a of ASSETS) {
  const rows = loadRows(a);
  const series = rows.map((r) => ({ price: num(r.price), atr: num(r.atr_h1), day: String(r.ts_utc ?? r.timestamp).slice(0, 10), ep: Math.round(Date.parse(r.ts_utc ?? r.timestamp) / 60000) }));
  let lastEp = -1e9;
  for (let i = 0; i < rows.length; i++) {
    if (series[i].ep < lastEp + CAD) continue; lastEp = series[i].ep;
    let det; try { det = detectOpportunity(rows[i], a); } catch { continue; }
    const side = det.selection?.side; if (side !== "SELL" && side !== "BUY") continue;
    const k = num(rows[i].stoch_k_h1_s0), d = num(rows[i].stoch_d_h1_s0); if (k == null || d == null) continue;
    const out = outcome(series, i, side, series[i].atr); if (out !== "WIN" && out !== "LOSS") continue;
    B[side][out].push(k - d);
  }
}
const pct = (arr, p) => { if (!arr.length) return "—"; const s = [...arr].sort((a, b) => a - b); return s[Math.floor(p / 100 * (s.length - 1))].toFixed(1); };
const stat = (arr) => `n=${String(arr.length).padStart(4)}  p10=${pct(arr, 10).padStart(6)} p25=${pct(arr, 25).padStart(6)} p50=${pct(arr, 50).padStart(6)} p75=${pct(arr, 75).padStart(6)} p90=${pct(arr, 90).padStart(6)}`;

console.log(`\n=== Distribution K−D H1 au fire (${ASSETS.length} actifs, cadence ${CAD}min, exit ${TP}/${SL}) ===`);
for (const side of ["SELL", "BUY"]) {
  console.log(`\n── ${side} ──`);
  console.log(`  WIN   ${stat(B[side].WIN)}`);
  console.log(`  LOSS  ${stat(B[side].LOSS)}`);
}
// Pour SELL : le veto voudra bloquer les LOSS à K−D haut (proche 0). Balayage d'un seuil : SELL bloqué si K−D > seuil.
console.log(`\n── SELL : si on VETO « K−D > seuil » (bloque les sell pas assez down) : combien de WIN/LOSS coupés ? ──`);
for (const s of [0, -1, -2, -3, -4, -5]) {
  const wCut = B.SELL.WIN.filter((x) => x > s).length, lCut = B.SELL.LOSS.filter((x) => x > s).length;
  console.log(`  seuil ${String(s).padStart(3)} : coupe ${wCut}/${B.SELL.WIN.length} WIN (${(100 * wCut / B.SELL.WIN.length).toFixed(0)}%) · ${lCut}/${B.SELL.LOSS.length} LOSS (${(100 * lCut / B.SELL.LOSS.length).toFixed(0)}%)`);
}
