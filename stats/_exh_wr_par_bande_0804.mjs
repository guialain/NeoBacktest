// _exh_wr_par_bande_0804.mjs — LE SCORE EXH TRIE-T-IL ? 20 bandes de 5 percentiles.
// ⚠ 20 bandes et non 5 : un agrégat sur 5 paquets ne distingue pas « pas d'info » d'« info NON
//   MONOTONE ». Convention du dépôt depuis le 03/08.
// ⭐ LES DEUX COMPTAGES SONT SORTIS (owner 2026-08-04) : par ÉPISODE **et** par TIR. L'épisode reste
//   la référence — compter par tir est biaisé, le nombre de clones dépend de l'issue — mais le tir
//   dit le VOLUME réel du carnet, et l'écart entre les deux vues est lui-même une information.
import { dedupeEpisodes } from "./_episodes.mjs";

const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2&chargeSpread=true`)).json();
  for (const s of (j.signals || [])) all.push({ ...s, asset: a });
}
const conv = (s) => {
  const c = s?.sc?.exhConviction;
  return Number.isFinite(c) ? c : (Number.isFinite(s?.score) ? Math.abs(s.score) / 10 : null);
};
const prep = (list) => list
  .filter((s) => s.type === "EXHAUSTION")
  .map((s) => ({ c: conv(s), win: s.outcome === "WIN", loss: s.outcome === "LOSS", R: s.R }))
  .filter((r) => Number.isFinite(r.c) && (r.win || r.loss))
  .sort((a, b) => a.c - b.c);

const wr = (v) => { const w = v.filter((x) => x.win).length, l = v.filter((x) => x.loss).length; return (w + l) ? (w / (w + l)) * 100 : NaN; };
const sum = (v) => v.reduce((a, x) => a + (Number.isFinite(x.R) ? x.R : 0), 0);

function table(label, rows) {
  const N = rows.length, WR = wr(rows), P = WR / 100;
  console.log(`\n══ ${label} ══  n=${N} · WR global ${WR.toFixed(2)} % · R ${sum(rows).toFixed(1)}`);
  console.log("bande     conviction         n     WR      écart    σ       R");
  for (let i = 0; i < 20; i++) {
    const a = Math.floor((i * N) / 20), b = Math.floor(((i + 1) * N) / 20);
    const v = rows.slice(a, b); if (!v.length) continue;
    const w = wr(v), d = w - WR;
    const sd = Math.sqrt((P * (1 - P)) / v.length) * 100;
    const star = Math.abs(d / sd) >= 2 ? "  ⭐" : "";
    console.log(`P${String(i * 5).padStart(2)}-${String((i + 1) * 5).padStart(3)} ` +
      `[${v[0].c.toFixed(2)} · ${v[v.length - 1].c.toFixed(2)}]`.padEnd(18) +
      `${String(v.length).padStart(4)}  ${w.toFixed(1).padStart(5)} %  ${(d >= 0 ? "+" : "") + d.toFixed(1)}`.padStart(9) +
      `  ${(d / sd).toFixed(1).padStart(5)}  ${sum(v).toFixed(1).padStart(6)}${star}`);
  }
  // Mann-Whitney : le tri global, insensible au découpage en bandes.
  const nW = rows.filter((x) => x.win).length, nL = rows.length - nW;
  const sumRw = rows.reduce((a, x, i) => a + (x.win ? i : 0), 0);
  const U = sumRw - (nW * (nW - 1)) / 2;
  const sdU = Math.sqrt((nW * nL * (nW + nL + 1)) / 12);
  console.log(`AUC(conviction → GAIN) = ${(U / (nW * nL)).toFixed(4)}   z = ${((U - nW * nL / 2) / sdU).toFixed(2)}`);
  return { N, WR, R: sum(rows) };
}

const parEp  = table("PAR ÉPISODE (15 min · actif|côté|thèse)", prep(dedupeEpisodes(all, (s) => s.asset)));
const parTir = table("PAR TIR (toutes exécutions, clones compris)", prep(all));
console.log(`\nclones : ${(parTir.N / parEp.N).toFixed(2)} tirs par épisode ` +
            `· WR ${parEp.WR.toFixed(2)} % → ${parTir.WR.toFixed(2)} % ` +
            `· R ${parEp.R.toFixed(1)} → ${parTir.R.toFixed(1)}`);
