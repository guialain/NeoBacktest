// _rsi_level_by_side_0804.mjs — LES LIGNES BASSES DE LA TABLE RSI EXH SELL SONT-ELLES ATTEIGNABLES ?
// Question owner : avec les conditions d'admission (table zone × K/D du 04/08), un EXH SELL
// peut-il se produire avec le RSI H1 en EXTREME_LOW (<=15) ou STRONG_LOW (16-30) ?
// ⚠ Par ÉPISODE. `rsiH1` = forme nue = CLÔTURE (convention du dépôt).
import { dedupeEpisodes } from "./_episodes.mjs";

const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) all.push({ ...s, asset: a });
}
const ep = dedupeEpisodes(all, (s) => s.asset);

// `rsiLevel` du moteur : bande sur |rsi-50|, coupes [20,35]. Ici en version SIDE-EXPLICITE.
const lvl = (r) => {
  if (r == null || !Number.isFinite(r)) return null;
  const m = Math.abs(r - 50);
  const band = m < 20 ? "SOFT" : m < 35 ? "STRONG" : "EXTREME";
  return `${band}_${r < 50 ? "LOW" : "HIGH"}`;
};
const ORDER = ["EXTREME_LOW", "STRONG_LOW", "SOFT_LOW", "SOFT_HIGH", "STRONG_HIGH", "EXTREME_HIGH"];

const exh = ep.filter((s) => s.type === "EXHAUSTION");
for (const side of ["SELL", "BUY"]) {
  const g = exh.filter((s) => s.side === side);
  const by = {};
  for (const s of g) { const k = lvl(s.rsiH1) ?? "SANS_RSI"; (by[k] ??= []).push(s); }
  console.log(`\n=== EXH ${side} — ${g.length} épisodes, par niveau RSI H1 (clôturé) ===`);
  for (const k of [...ORDER, "SANS_RSI"]) {
    const v = by[k]; if (!v) { console.log(`  ${k.padEnd(13)}      0`); continue; }
    const w = v.filter((x) => x.outcome === "WIN").length, l = v.filter((x) => x.outcome === "LOSS").length;
    const R = v.reduce((a, x) => a + (typeof x.R === "number" ? x.R : 0), 0);
    console.log(`  ${k.padEnd(13)} ${String(v.length).padStart(6)}  ${((v.length / g.length) * 100).toFixed(1).padStart(5)} %  WR ${(w + l ? (w / (w + l)) * 100 : 0).toFixed(1).padStart(5)} %  R ${R.toFixed(1).padStart(7)}`);
  }
  const low = g.filter((s) => ["EXTREME_LOW", "STRONG_LOW"].includes(lvl(s.rsiH1)));
  console.log(`  --> rsi <= 30 : ${low.length} épisode(s) (${((low.length / g.length) * 100).toFixed(2)} %)`);
  if (low.length && low.length <= 12)
    for (const s of low) console.log(`      ${s.asset} ${s.tsMT} rsiH1=${s.rsiH1} zoneH1=${s.zoneH1} kd=${s.crossState} R=${s.R}`);
}
