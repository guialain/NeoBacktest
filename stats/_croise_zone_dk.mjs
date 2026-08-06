// _croise_zone_dk.mjs — CROISE zone %K H1 × vitesse ΔK (orientée par le côté).
// ⚠ Les deux axes sont lus DANS LE REPERE DU FADE : la zone est nommée par l'extreme d'ou l'on
//   revient (`X` = celui qu'on fade), et `_UP` = le %K va dans le sens d'ou l'on fade.
//   Sans ca, un BUY et un SELL tombent dans des cases opposees et chaque case est un demi-echantillon.
import { dedupeEpisodes } from "./_episodes.mjs";
const SPREAD = String(process.env.CHARGE_SPREAD ?? "true") !== "false";
const API = "http://localhost:3001/api/matrix";
const A = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of A) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2&chargeSpread=${SPREAD}`)).json();
  for (const s of (j.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const MB = { EXPLOSIVE_DOWN:"EXPLOSIVE_UP", FAST_DOWN:"FAST_UP", SOFT_DOWN:"SOFT_UP", FLAT:"FLAT",
             SOFT_UP:"SOFT_DOWN", FAST_UP:"FAST_DOWN", EXPLOSIVE_UP:"EXPLOSIVE_DOWN" };
const MZ = { EXTREME_HAUTE:"EXTREME_BASSE", HAUTE:"BASSE", MID:"MID", BASSE:"HAUTE", EXTREME_BASSE:"EXTREME_HAUTE" };
const ep = dedupeEpisodes(all, (s) => s.asset)
  .filter((s) => s.outcome === "WIN" || s.outcome === "LOSS")
  .map((s) => ({ ...s,
    z: s.side === "BUY" ? (MZ[s.zoneH1] ?? s.zoneH1) : s.zoneH1,     // zone orientée
    k: s.side === "BUY" ? (MB[s.dKBandH1] ?? s.dKBandH1) : s.dKBandH1 }));
const ZO = ["EXTREME_HAUTE","HAUTE","MID","BASSE","EXTREME_BASSE"];
const KO = ["FLAT","SOFT_UP","FAST_UP","EXPLOSIVE_UP","SOFT_DOWN","FAST_DOWN","EXPLOSIVE_DOWN"];
const st = (t) => { const w = t.filter((x)=>x.outcome==="WIN").length, n=t.length;
  const R = t.reduce((a,b)=>a+(b.R||0),0), s0 = n?Math.sqrt(.75*.25/n)*100:NaN;
  return { n, wr: n?100*w/n:NaN, R, sig:(100*w/n-75)/s0 }; };
const cell = (t) => t.length ? `${String(t.length).padStart(3)} ${st(t).wr.toFixed(0).padStart(3)}%` : "     ·";
console.log(SPREAD ? "[spread FACTURÉ]" : "[HORS SPREAD]");
console.log(`\nzone (orientée)  ` + KO.map((k)=>k.slice(0,9).padStart(10)).join("") + "        TOTAL");
for (const z of ZO) {
  const v = ep.filter((s)=>s.z===z); if (!v.length) continue;
  const s = st(v);
  console.log(z.padEnd(16) + KO.map((k)=>cell(v.filter((x)=>x.k===k)).padStart(10)).join("") +
    `   ${String(s.n).padStart(4)} ${s.wr.toFixed(1)}% ${(s.sig>=0?"+":"")+s.sig.toFixed(2)}σ R${(s.R>=0?"+":"")+s.R.toFixed(1)}`);
}
console.log("\n── LIGNE PAR LIGNE (détail des cases ≥ 15 ép) ──");
for (const z of ZO) for (const k of KO) {
  const v = ep.filter((s)=>s.z===z&&s.k===k); if (v.length<15) continue;
  const s = st(v);
  console.log(`  ${z.padEnd(15)}${k.padEnd(15)} n=${String(s.n).padStart(3)}  WR ${s.wr.toFixed(1).padStart(5)} %  ${(s.sig>=0?"+":"")+s.sig.toFixed(2)} σ${Math.abs(s.sig)>=2?" ⭐":"  "}  R ${(s.R>=0?"+":"")+s.R.toFixed(1)}`);
}
