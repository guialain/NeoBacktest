// add_zscore_d1.mjs — JOINT `zscore_d1` (zscore D1 sur la DERNIÈRE CLOSE, shift 1) aux rows data/matrix.
// --------------------------------------------------------------------------------------------
// POURQUOI : l'EA n'émet ce champ que depuis la v8.39 (2026-07-25 18:22). Les données historiques
//   ne l'ont pas. Il est RECONSTRUCTIBLE depuis les closes D1 — même démarche que add_adx.mjs pour
//   l'ADX natif : le dataset d'étude complète ce que le scan ne portait pas encore.
//
// ✅ RECONSTRUCTION VALIDÉE CONTRE L'EA (2026-07-25) : écart moyen 0,000022 · max 0,00005 sur 19/19
//   actifs — c'est l'arrondi à 4 décimales du CSV, rien d'autre.
//   Définition : Bollinger(20) sur les closes, écart-type de POPULATION (ddof=0),
//   z = (close − moyenne20) / sigma20.
//
// ⚠ JOINTURE POSITIONNELLE, PAS ARITHMÉTIQUE. `shift` chez MT5 est un INDEX dans la série de barres,
//   pas un décalage de calendrier : un samedi, l'index 0 est la barre de VENDREDI et le shift 1 est
//   celle de JEUDI. Un « jour − 1 » naïf donnerait vendredi et serait FAUX tous les week-ends et
//   jours fériés. On cherche donc la dernière barre dont l'ouverture ≤ timestamp de la ligne (= shift 0),
//   puis on prend celle d'AVANT (= shift 1).
//
// ⚠ Comme add_adx.mjs : STRIP PAR NOM puis ré-ajout en fin de ligne ⇒ idempotent, quel que soit
//   l'état de départ du fichier.
import fs from "fs";
import path from "path";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const HIST = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files";
const COL = "zscore_d1";
const N = 20;

// "2026.07.25 12:43:00" ou "2026.07.25 00:00" → epoch minutes (heure BROKER des deux côtés)
const em = (ts) => { const m = /(\d{4})\.(\d{2})\.(\d{2})(?:\s+(\d{2}):(\d{2}))?/.exec(String(ts)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)) / 60000 : null; };

// hist_<name>_D1.csv → { times[], z[] } triés croissant. z[i] = zscore de la barre i.
function loadD1(name) {
  const fp = path.join(HIST, `hist_${name}_D1.csv`);
  if (!fs.existsSync(fp)) return null;
  const L = fs.readFileSync(fp, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const it = h.indexOf("time"), ic = h.indexOf("close");
  const bars = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const t = em(c[it]), cl = Number(c[ic]);
    if (t == null || !Number.isFinite(cl) || cl <= 0) continue;
    bars.push([t, cl]);
  }
  bars.sort((a, b) => a[0] - b[0]);
  const times = bars.map((b) => b[0]), z = new Array(bars.length).fill(null);
  for (let i = N - 1; i < bars.length; i++) {
    const w = bars.slice(i - N + 1, i + 1).map((b) => b[1]);
    const m = w.reduce((s, x) => s + x, 0) / N;
    const sd = Math.sqrt(w.reduce((s, x) => s + (x - m) ** 2, 0) / N);
    if (sd > 0) z[i] = (bars[i][1] - m) / sd;
  }
  return { times, z };
}

// index de la dernière barre dont l'ouverture ≤ t (= shift 0), ou -1
function idxAtOrBefore(times, t) {
  let lo = 0, hi = times.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return r;
}

// map nom matrix → nom hist (casse), depuis les fichiers présents
const histName = {};
for (const f of fs.readdirSync(HIST).filter((f) => /^hist_.+_D1\.csv$/.test(f))) {
  const a = f.replace(/^hist_/, "").replace(/_D1\.csv$/, "");
  histName[a.toUpperCase()] = a;
}

const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv"));
const report = [];
for (const f of files) {
  const asset = f.replace(/\.csv$/i, "");
  const hn = histName[asset.toUpperCase()];
  if (!hn) { report.push(`${asset}: pas de hist_*_D1, skip`); continue; }
  const D = loadD1(hn);
  if (!D) { report.push(`${asset}: hist illisible, skip`); continue; }

  const fp = path.join(MATRIX, f);
  const raw = fs.readFileSync(fp, "utf8");
  const nl = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(nl);
  const hdr = lines[0].split(";");
  const keep = hdr.map((c, i) => [c, i]).filter(([c]) => c !== COL).map(([, i]) => i);   // strip par nom
  const out = [keep.map((i) => hdr[i]).concat(COL).join(";")];

  let filled = 0, empty = 0;
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line || line.length < 5) { out.push(line); continue; }
    const p = line.split(";");
    const base = keep.map((i) => p[i] ?? "").join(";");
    const T = em(p[0]);                                   // colonne 0 = timestamp MT
    let v = "";
    if (T != null) {
      const i0 = idxAtOrBefore(D.times, T);                // shift 0
      const i1 = i0 - 1;                                   // shift 1 = la barre d'AVANT
      if (i1 >= 0 && D.z[i1] != null) v = (Math.round(D.z[i1] * 10000) / 10000).toString();
    }
    if (v === "") empty++; else filled++;
    out.push(base + ";" + v);
  }
  fs.writeFileSync(fp, out.join(nl));
  report.push(`${asset.padEnd(12)} ${String(filled).padStart(6)} remplis · ${String(empty).padStart(4)} vides`);
}
console.log(report.join("\n"));
