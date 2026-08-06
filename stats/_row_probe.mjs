// _row_probe.mjs — SORTIR LES OBSERVABLES D'UNE BARRE PRÉCISE, LUES CHEZ LE MOTEUR.
//   usage : node stats/_row_probe.mjs BRENT_OIL 2026-07-06T16:26:00Z
// ⭐ Les états dérivés viennent de `tfInputs`, pas d'un calcul local : c'est la seule façon de
//   montrer ce que le scoreur A REÇU. Une redérivation ici serait `derived_dataset_computed_3x`.
import fs from "fs";
import { tfInputs } from "../../Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js";
import { stochZone, kdCycleState, kdDistanceBand }
  from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";

const [sym, want] = process.argv.slice(2);
const L = fs.readFileSync(`data/matrix/${sym}.csv`, "utf8").split(/\r?\n/);
const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));

// ⚠ On cherche sur `ts_utc` ET sur `timestamp` (heure MT) : les deux circulent dans ce dépôt et
//   confondre les deux fait sortir la barre d'à côté sans que rien ne le signale.
let hit = null, mode = null;
for (let i = 1; i < L.length; i++) {
  const c = L[i].split(";"); if (c.length < h.length) continue;
  const u = String(c[I["ts_utc"]] ?? ""), m = String(c[I["timestamp"]] ?? "");
  if (u.startsWith(want.replace(/Z$/, "").slice(0, 16))) { hit = c; mode = `ts_utc=${u}`; break; }
  if (!hit && m.replace(/\./g, "-").startsWith(want.replace("T", " ").replace(/Z$/, "").slice(0, 16))) {
    hit = c; mode = `timestamp(MT)=${m}`;
  }
}
if (!hit) { console.log("barre introuvable"); process.exit(1); }

const row = Object.fromEntries(h.map((c, i) => [c, hit[i]]));
const n = (v) => (v === "" || v == null ? null : Number(v));
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");

console.log(`\n${sym}  ${mode}   ts_utc=${row.ts_utc}  MT=${row.timestamp}  price=${row.price}\n`);
console.log(`intraday_change   ${row.intraday_change === "" ? "(vide)" : row.intraday_change}`);

console.log(`\n── STOCHASTIQUE H4 (brut du scan) ──`);
for (const s of ["s0", "s1", "s2", "s3"]) {
  const k = n(row[`stoch_k_h4_${s}`]), d = n(row[`stoch_d_h4_${s}`]);
  console.log(`  ${s}   %K ${f(k, 2).padStart(7)}   %D ${f(d, 2).padStart(7)}   ` +
              `K−D ${f(k != null && d != null ? k - d : null, 2).padStart(7)}   ` +
              `zone ${stochZone(k) ?? "—"}`);
}

// ── CE QUE LE MOTEUR REÇOIT, sans redérivation ────────────────────────────────────────────────
const Ih4 = tfInputs(row, "h4");
console.log(`\n── STOCHDYN H4 — ce que \`tfInputs(row,"h4")\` passe aux scoreurs ──`);
console.log(`  zone        ${Ih4.zone ?? "—"}          (live, s0)`);
console.log(`  zoneClosed  ${Ih4.zoneClosed ?? "—"}          (clôture, s1 — lue par les VETOS)`);
console.log(`  kLive       ${f(Ih4.kLive, 2)}`);
console.log(`  kdGap       ${f(Ih4.kdGap, 4)}   kdDist ${Ih4.kdDist ?? "—"}`);
console.log(`  kdGapClosed ${f(Ih4.kdGapClosed, 4)}   kdDistClosed ${Ih4.kdDistClosed ?? "—"}`);
console.log(`  dKBand      ${Ih4.dKBand ?? "—"}`);
console.log(`  ⭐ STOCHDYN : kdPrev ${Ih4.kdPrev ?? "—"}  →  kdCur ${Ih4.kdCur ?? "—"}`);
console.log(`     (kdPrev lu sur (s1,s2) · kdCur sur (s0,s1) — deux fenêtres GLISSANTES d'une barre)`);
