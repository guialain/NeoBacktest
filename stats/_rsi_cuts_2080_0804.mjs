// _rsi_cuts_2080_0804.mjs — DÉPLACER LA BORNE D'EXTRÊME DE 15/85 À 20/80 : QUI CHANGE DE LIGNE ?
// ⚠ Un seuil ne se juge pas sur son étiquette mais sur CE QU'IL DÉPLACE. On compare les deux
//   découpages sur la MÊME population de tirs, par ÉPISODE.
import { dedupeEpisodes } from "./_episodes.mjs";

const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) all.push({ ...s, asset: a });
}
const ep = dedupeEpisodes(all, (s) => s.asset);
const exh = ep.filter((s) => s.type === "EXHAUSTION");

// cuts = [softMax, strongMax] sur |rsi-50|. Actuel [20,35] => EXTREME a rsi<=15 / >=85.
//                                            Propose [20,30] => EXTREME a rsi<=20 / >=80.
const lvl = (r, cuts) => {
  if (r == null || !Number.isFinite(r)) return null;
  const m = Math.abs(r - 50);
  const band = m < cuts[0] ? "SOFT" : m < cuts[1] ? "STRONG" : "EXTREME";
  return `${band}_${r < 50 ? "LOW" : "HIGH"}`;
};
const ORDER = ["EXTREME_LOW", "STRONG_LOW", "SOFT_LOW", "SOFT_HIGH", "STRONG_HIGH", "EXTREME_HIGH"];
const st = (v) => {
  const w = v.filter((x) => x.outcome === "WIN").length, l = v.filter((x) => x.outcome === "LOSS").length;
  const R = v.reduce((a, x) => a + (typeof x.R === "number" ? x.R : 0), 0);
  return { n: v.length, wr: w + l ? (w / (w + l)) * 100 : 0, R };
};

for (const [name, cuts] of [["ACTUEL  [20,35] -> extreme 15/85", [20, 35]], ["PROPOSE [20,30] -> extreme 20/80", [20, 30]]]) {
  console.log(`\n######## ${name} ########`);
  for (const side of ["SELL", "BUY"]) {
    const g = exh.filter((s) => s.side === side);
    const by = {};
    for (const s of g) { const k = lvl(s.rsiH1, cuts) ?? "SANS_RSI"; (by[k] ??= []).push(s); }
    console.log(`  EXH ${side} — ${g.length} ép.`);
    for (const k of ORDER) {
      const v = by[k]; if (!v) { console.log(`    ${k.padEnd(13)}      0`); continue; }
      const s = st(v);
      console.log(`    ${k.padEnd(13)} ${String(s.n).padStart(5)}  ${((s.n / g.length) * 100).toFixed(1).padStart(5)} %  WR ${s.wr.toFixed(1).padStart(5)} %  R ${s.R.toFixed(1).padStart(6)}`);
    }
  }
}

// Qui bascule exactement ? Les tirs dont le niveau CHANGE entre les deux découpages.
console.log("\n######## CE QUE LE DÉPLACEMENT DÉPLACE ########");
for (const side of ["SELL", "BUY"]) {
  const g = exh.filter((s) => s.side === side);
  const moved = g.filter((s) => lvl(s.rsiH1, [20, 35]) !== lvl(s.rsiH1, [20, 30]));
  const s = st(moved);
  console.log(`  EXH ${side} : ${s.n} ép. changent de ligne (${((s.n / g.length) * 100).toFixed(1)} %) — WR ${s.wr.toFixed(1)} % · R ${s.R.toFixed(1)}`);
  const from = {};
  for (const x of moved) { const k = `${lvl(x.rsiH1, [20, 35])} -> ${lvl(x.rsiH1, [20, 30])}`; (from[k] ??= []).push(x); }
  for (const [k, v] of Object.entries(from)) { const t = st(v); console.log(`      ${k.padEnd(30)} ${String(t.n).padStart(4)}  WR ${t.wr.toFixed(1)} %  R ${t.R.toFixed(1)}`); }
}

// La distribution BRUTE du rsi H1 sur les fades, pour voir où est la masse.
console.log("\n######## rsi H1 des fades — décilage brut ########");
const rs = exh.map((s) => s.rsiH1).filter((r) => Number.isFinite(r)).sort((a, b) => a - b);
const q = (p) => rs[Math.floor(p * (rs.length - 1))];
console.log(`  n=${rs.length}  min ${rs[0].toFixed(1)}  p1 ${q(0.01).toFixed(1)}  p5 ${q(0.05).toFixed(1)}  p50 ${q(0.5).toFixed(1)}  p95 ${q(0.95).toFixed(1)}  p99 ${q(0.99).toFixed(1)}  max ${rs[rs.length - 1].toFixed(1)}`);
for (const b of [15, 20, 25, 30, 70, 75, 80, 85])
  console.log(`  rsi ${b < 50 ? "<=" : ">="} ${String(b).padStart(2)} : ${String(b < 50 ? rs.filter((r) => r <= b).length : rs.filter((r) => r >= b).length).padStart(5)}`);
