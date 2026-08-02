const API = "http://localhost:3001/api/matrix";
import { TRADABLE_SYMBOLS } from "../../Matrix-Revolution/src/config/allowedSymbols.js";
const assets = await (await fetch(`${API}/assets`)).json();
const out = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const t = (j.signals || []).filter((s) => typeof s.R === "number");
  const w = t.filter((x) => x.outcome === "WIN").length, l = t.filter((x) => x.outcome === "LOSS").length;
  out.push({ a, n: t.length, wr: (w + l) ? w / (w + l) * 100 : NaN, rt: t.reduce((x, y) => x + y.R, 0) / (t.length || 1),
             R: t.reduce((x, y) => x + y.R, 0), tr: TRADABLE_SYMBOLS.includes(a) });
}
out.sort((x, y) => x.rt - y.rt);
console.log(`${"actif".padEnd(12)}${"n".padStart(7)}${"WR".padStart(9)}${"R/tr".padStart(9)}   tradable`);
for (const o of out) console.log(`${o.a.padEnd(12)}${String(o.n).padStart(7)}${o.wr.toFixed(2).padStart(8)}%${o.rt.toFixed(4).padStart(9)}   ${o.tr ? "" : "🔴 NON"}`);
const grp = (f) => { const g = out.filter(f); const n = g.reduce((a,b)=>a+b.n,0), R = g.reduce((a,b)=>a+b.R,0);
  return `n=${String(n).padStart(6)}  R/tr ${(R/n).toFixed(4)}`; };
console.log(`\ntradables (16)      ${grp(o => o.tr)}`);
console.log(`NON tradables (3)   ${grp(o => !o.tr)}   <- COCOA, GASOLINE, USDCAD`);
console.log(`USDJPY seul         ${grp(o => o.a === "USDJPY")}`);
console.log(`si on retire les 4  ${grp(o => o.tr && o.a !== "USDJPY")}`);
