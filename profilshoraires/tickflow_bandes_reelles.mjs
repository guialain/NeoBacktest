// tickflow_bandes_reelles.mjs — QUE DÉCLENCHE RÉELLEMENT `classifyTickflow` AUJOURD'HUI ?
//
// `classifyTickflow(meanTick5s, tf5)` compare une MOYENNE DE 5 à des percentiles calculés sur des
// ticks_5s INDIVIDUELS. On ne discute pas de la gravité : on compte.
//   (a) bandes obtenues avec les seuils EN PLACE (tf_5s de TICKFLOW_CONFIG)
//   (b) bandes obtenues avec les MÊMES règles, mais des seuils pris sur la distribution de la
//       moyenne elle-même — c'est-à-dire les percentiles que les étiquettes PRÉTENDENT être.
// L'écart (a)−(b) est la distorsion. Une étiquette « p99 » qui déclenche 0,1 % au lieu de 1 % rend
// la bande BURST dix fois plus rare que son nom ne le dit.
//
// ⚠ On ne touche à RIEN : lecture seule, la fonction du moteur est appelée telle quelle.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { computeMeanTick5s, classifyTickflow, getTickFlowConfig }
  from "../../Matrix-Revolution/src/config/TickFlowConfig.js";

const DIR = "data/matrix";
const OUT = path.dirname(fileURLToPath(import.meta.url));
const H_DEB = 8 * 60, H_FIN = 20 * 60;
const BANDES = ["DEAD", "OFF", "OK", "HIGH", "HOT", "BURST", "UNKNOWN"];
const quant = (t, p) => t.length ? t[Math.min(t.length - 1, Math.floor(t.length * p))] : null;

const assets = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"))
  .map((f) => f.replace(/\.csv$/i, "")).sort();

const lignes = [];
for (const sym of assets) {
  const L = fs.readFileSync(path.join(DIR, `${sym}.csv`), "utf8").split(/\r?\n/);
  const head = L[0].split(";");
  const iU = head.indexOf("ts_utc");
  const idx = [0, 1, 2, 3, 4].map((k) => head.indexOf(`tick_count_5s_s${k}`));
  const moy = [], heures = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < head.length) continue;
    const d = new Date(c[iU]); if (Number.isNaN(d.getTime())) continue;
    const js = d.getUTCDay(); if (js === 0 || js === 6) continue;
    const min = d.getUTCHours() * 60 + d.getUTCMinutes();
    if (min < H_DEB || min >= H_FIN) continue;
    const row = {}; for (let k = 0; k < 5; k++) row[`tick_count_5s_s${k}`] = c[idx[k]];
    const m = computeMeanTick5s(row);
    if (m != null && Number.isFinite(m)) { moy.push(m); heures.push(d.getUTCHours()); }
  }
  const tri = [...moy].sort((a, b) => a - b);
  const tf5 = getTickFlowConfig(sym)?.tf_5s;
  // seuils « honnêtes » : les mêmes percentiles, mais pris sur la distribution de la MOYENNE
  const juste = { p25: quant(tri, .25), p30: quant(tri, .30), p50: quant(tri, .50),
                  p95: quant(tri, .95), p99: quant(tri, .99) };

  const cA = Object.fromEntries(BANDES.map((b) => [b, 0]));
  const cB = Object.fromEntries(BANDES.map((b) => [b, 0]));
  for (const m of moy) { cA[classifyTickflow(m, tf5)]++; cB[classifyTickflow(m, juste)]++; }
  const pc = (c) => BANDES.map((b) => c[b] / moy.length * 100);

  // Pour la détection d'ÉVÉNEMENT : la part de BURST tombe-t-elle toujours aux mêmes heures ?
  const burstParH = {};
  for (let i = 0; i < moy.length; i++) {
    if (classifyTickflow(moy[i], tf5) === "BURST") burstParH[heures[i]] = (burstParH[heures[i]] ?? 0) + 1;
  }
  const totBurst = Object.values(burstParH).reduce((a, b) => a + b, 0);
  const topH = Object.entries(burstParH).sort((a, b) => b[1] - a[1]).slice(0, 3);

  lignes.push({ sym, n: moy.length, a: pc(cA), b: pc(cB), tf5, juste,
                concentr: totBurst ? topH.reduce((a, x) => a + x[1], 0) / totBurst * 100 : null,
                topH: topH.map(([h, k]) => `${h}h(${(100 * k / (totBurst || 1)).toFixed(0)}%)`).join(" ") });
}

const f = (v) => v.toFixed(1).padStart(6);
console.log(`=== (a) BANDES AVEC LES SEUILS EN PLACE — % des barres, 08-20h UTC, 24 j ouvrés ===`);
console.log(`${"actif".padEnd(12)}${BANDES.slice(0, 6).map((b) => b.padStart(7)).join("")}`);
for (const l of lignes) console.log(`${l.sym.padEnd(12)}${l.a.slice(0, 6).map(f).join("")}`);

console.log(`\n=== (b) LES MÊMES RÈGLES, SEUILS PRIS SUR LA MOYENNE (ce que les étiquettes annoncent) ===`);
console.log(`${"actif".padEnd(12)}${BANDES.slice(0, 6).map((b) => b.padStart(7)).join("")}`);
for (const l of lignes) console.log(`${l.sym.padEnd(12)}${l.b.slice(0, 6).map(f).join("")}`);

console.log(`\n=== DISTORSION (a) − (b), en points de %  —  ce que la mauvaise échelle coûte ===`);
console.log(`${"actif".padEnd(12)}${BANDES.slice(0, 6).map((b) => b.padStart(7)).join("")}`);
const moyDist = BANDES.slice(0, 6).map((_, i) => 0);
for (const l of lignes) {
  const d = l.a.slice(0, 6).map((v, i) => v - l.b[i]);
  d.forEach((v, i) => moyDist[i] += v / lignes.length);
  console.log(`${l.sym.padEnd(12)}${d.map((v) => ((v >= 0 ? "+" : "") + v.toFixed(1)).padStart(7)).join("")}`);
}
console.log(`${"MOYENNE".padEnd(12)}${moyDist.map((v) => ((v >= 0 ? "+" : "") + v.toFixed(1)).padStart(7)).join("")}`);

console.log(`\n=== ⭐ BURST EST-IL UN ÉVÉNEMENT OU UNE HEURE ? (concentration sur les 3 heures les plus fournies) ===`);
for (const l of lignes) console.log(`${l.sym.padEnd(12)} ${String(l.concentr == null ? "—" : l.concentr.toFixed(0) + " %").padStart(6)} du BURST  ·  ${l.topH}`);

const csv = [`Actif;n;${BANDES.slice(0,6).map(b=>`${b}_actuel`).join(";")};${BANDES.slice(0,6).map(b=>`${b}_corrige`).join(";")};burst_concentration_3h`];
for (const l of lignes) csv.push(`${l.sym};${l.n};${l.a.slice(0,6).map(v=>v.toFixed(2).replace(".",",")).join(";")};`
  + `${l.b.slice(0,6).map(v=>v.toFixed(2).replace(".",",")).join(";")};${l.concentr==null?"":l.concentr.toFixed(1).replace(".",",")}`);
fs.writeFileSync(path.join(OUT, "tickflow_bandes_reelles.csv"), csv.join("\r\n") + "\r\n", "utf8");
console.log(`\nÉcrit : tickflow_bandes_reelles.csv`);
