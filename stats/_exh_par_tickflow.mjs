// WR des fades par RÉGIME DE TICKFLOW. (owner 2026-08-02)
//
// ⚠⚠ DEUX ÉCHELLES, ET C'EST TOUT LE SUJET DE LA CORRECTION DE CE MATIN.
//   `classifyTickflow(meanTick5s, tf5)` compare une MOYENNE DE 5 à des percentiles de ticks
//   INDIVIDUELS (`TICKFLOW_CONFIG`) — c'est le défaut d'échelle corrigé sur les 3 portes admission,
//   mais PAS dans ce classifieur, laissé intact volontairement.
//   ⇒ On calcule les DEUX : la version telle qu'elle est câblée, et la même grille appliquée à
//   `REGIME_BASELINE_TICKFLOW_MEANT5` (percentiles de la MOYENNE, la bonne échelle). Si les deux
//   racontent la même histoire, la conclusion tient quelle que soit l'échelle.
// ⭐ JOINTURE : `signal.i` est l'index 0-based de la ligne de données ⇒ ligne CSV = i + 1. Vérifié
//   sur trois signaux (i=2 → ts 09:03 ≡ tsMT 09:03:43).
import fs from "fs";
import { getTickFlowConfig, computeMeanTick5s, classifyTickflow,
         REGIME_BASELINE_TICKFLOW_MEANT5 } from "../../Matrix-Revolution/src/config/TickFlowConfig.js";
const API = "http://localhost:3001/api/matrix";
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const ORD = ["DEAD", "OFF", "OK", "HIGH", "HOT", "BURST", "UNKNOWN"];

const assets = await (await fetch(`${API}/assets`)).json();
const rows = [];
for (const a of assets) {
  const p = `data/matrix/${a}.csv`; if (!fs.existsSync(p)) continue;
  const L = fs.readFileSync(p, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const tf5 = getTickFlowConfig(a)?.tf_5s;                // percentiles de ticks INDIVIDUELS
  const m5 = REGIME_BASELINE_TICKFLOW_MEANT5[a] ?? null;  // percentiles de la MOYENNE
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) {
    if (s.type !== "EXHAUSTION" || typeof s.R !== "number" || !Number.isFinite(s.i)) continue;
    const c = (L[s.i + 1] || "").split(";"); if (c.length < h.length) continue;
    const row = {}; for (let k = 0; k < 5; k++) row[`tick_count_5s_s${k}`] = num(c[I[`tick_count_5s_s${k}`]]);
    const mean = computeMeanTick5s(row);
    if (mean === null) continue;
    rows.push({ R: s.R, out: s.outcome, mean,
      cable: classifyTickflow(mean, tf5),
      juste: m5 ? classifyTickflow(mean, m5) : "UNKNOWN" });
  }
}
const wr = (t) => { const w = t.filter((x) => x.out === "WIN").length, l = t.filter((x) => x.out === "LOSS").length; return (w + l) ? w / (w + l) * 100 : NaN; };
const rt = (t) => t.reduce((a, b) => a + b.R, 0) / t.length;
const se = (t) => { const p = wr(t) / 100; return t.length ? Math.sqrt(p * (1 - p) / t.length) * 100 : NaN; };
const bloc = (key, titre) => {
  console.log(`\n=== ${titre} ===`);
  console.log(`${"régime".padEnd(10)}${"n".padStart(7)}${"part".padStart(8)}${"WR".padStart(9)}${"±ET".padStart(7)}${"marge".padStart(8)}${"R/tr".padStart(9)}`);
  for (const r of ORD) {
    const t = rows.filter((x) => x[key] === r); if (!t.length) continue;
    console.log(`${r.padEnd(10)}${String(t.length).padStart(7)}${(t.length / rows.length * 100).toFixed(1).padStart(7)}%`
      + `${wr(t).toFixed(2).padStart(8)}%${se(t).toFixed(2).padStart(7)}${(wr(t) - 75).toFixed(2).padStart(8)}${rt(t).toFixed(4).padStart(9)}`
      + (t.length < 150 ? "  (n<150)" : wr(t) < 75 ? "  🔴" : ""));
  }
};
console.log(`fades appariés à leur barre : ${rows.length}`);
bloc("cable", "AVANT LA CORRECTION DU 02/08 — moyenne de 5 contre percentiles de ticks INDIVIDUELS");
bloc("juste", "TEL QUE CÂBLÉ AUJOURD'HUI — getMeanTick5sBaseline, la bonne échelle");
