// _pop.mjs — LE RESUME D'UNE POPULATION, une ligne par comptage. Pour comparer des VARIANTES de
//   condition sans relire trois pages de sortie.
import { dedupeEpisodes } from "./_episodes.mjs";
const LBL = process.argv[2] ?? "";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const st = (t, lbl) => {
  const w = t.filter((x) => x.outcome === "WIN").length;
  const l = t.filter((x) => x.outcome === "LOSS").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const n = w + l, p = n ? w / n : NaN;
  // σ contre le point mort 75 % — valable par EPISODE. Par tir le WR est biaise (clones), on
  //   n'affiche donc pas de σ dans ce mode : un σ faux est pire qu'un σ absent.
  const s0 = n ? Math.sqrt(0.75 * 0.25 / n) * 100 : NaN;
  return `${lbl.padEnd(12)} n=${String(n).padStart(4)}  W=${String(w).padStart(3)} L=${String(l).padStart(3)}  ` +
         `WR ${(n ? (100 * p).toFixed(1) : "—").padStart(5)} %  ` +
         (lbl.startsWith("tirs") ? "        " : `${((100 * p - 75) / s0 >= 0 ? "+" : "") + (((100 * p - 75) / s0) || 0).toFixed(2)} σ  `) +
         `R ${(R >= 0 ? "+" : "") + R.toFixed(1)}`;
};
for (const SP of [true, false]) {
  let all = [];
  for (const a of assets) {
    const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2&chargeSpread=${SP}`)).json();
    for (const s of (j.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
  }
  const fini = all.filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");
  const ep = dedupeEpisodes(all, (s) => s.asset).filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");
  const tag = SP ? "spread FACTURÉ" : "HORS SPREAD  ";
  console.log(`${LBL.padEnd(10)} [${tag}]  ${st(ep, "épisodes")}`);
  console.log(`${" ".padEnd(10)} [${tag}]  ${st(fini, "tirs")}`);
}
