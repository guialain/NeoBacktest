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
  return `${lbl.padEnd(20)} n=${String(n).padStart(4)}  W=${String(w).padStart(3)} L=${String(l).padStart(3)}  ` +
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
  // ⭐⭐ SOUS-PERIODES DE DUREE EGALE — LE JUGE DE STABILITE (owner 06/08). Remplace le split
  //   juillet/aout, qui avait deux defauts : la frontiere calendaire est ARBITRAIRE, et aout ne pese
  //   que ~13 % du dataset donc son echantillon etait toujours minuscule.
  // ⭐ DECOUPAGE SUR LE TEMPS, PAS SUR LE NOMBRE D'EPISODES, et les bornes viennent du DATASET et non
  //   de la population : deux conditions differentes produisent ainsi LES MEMES fenetres, donc des
  //   colonnes comparables. Un decoupage par effectifs egaux masquerait au contraire une periode ou
  //   la figure ne tire presque jamais — c'est justement ce qu'on veut voir.
  // ⚠ Frontieres sur `ep` (minutes epoch UTC), jamais sur `tsMT` qui retarde jusqu'a ~13 h.
  // ⚠ LIRE LE SENS, PAS LE CHIFFRE : sur une population de ~90 episodes et 4 fenetres, chaque case
  //   pese ~22 episodes (σ ≈ 9 pt). Une fenetre a 65 % n'est pas une refutation ; QUATRE fenetres
  //   qui descendent regulierement, si.
  const NP = Number(process.env.PERIODES ?? 4);
  const D0 = Math.floor(Date.UTC(2026, 5, 29) / 60000);     // 1er jour du dataset
  const D1 = Math.floor(Date.UTC(2026, 7, 6) / 60000);      // lendemain du dernier
  const pas = (D1 - D0) / NP;
  const jour = (e) => new Date(e * 60000).toISOString().slice(5, 10);
  for (let k = 0; k < NP; k++) {
    const a = D0 + k * pas, b = k === NP - 1 ? D1 : D0 + (k + 1) * pas;
    const v = ep.filter((s) => Number.isFinite(s.ep) && s.ep >= a && s.ep < b);
    console.log(`${" ".padEnd(10)} [${tag}]  ${st(v, `  P${k + 1} ${jour(a)}→${jour(b - 1)}`)}`);
  }
}
