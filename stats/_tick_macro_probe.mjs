// _tick_macro_probe.mjs — `tick_count_15s` est-il utilisable comme brique d'une couche MACRO ?
// Trois questions, dans l'ordre où elles peuvent tuer l'idée :
//   1. le champ est-il REMPLI ? (un rebuild vide des colonnes en silence, cf. dataset_rebuild_recipe)
//   2. l'échelle est-elle comparable d'un actif à l'autre ? (si non : normaliser AVANT d'agréger)
//   3. 🔴 LA QUESTION QUI DÉCIDE : combien de sa variance est de la SAISONNALITÉ HORAIRE ?
//      Une couche macro lue toutes les 30 min et bâtie sur un capteur saisonnier mesurerait
//      L'HEURE QU'IL EST, avec une belle confiance. C'est le mode d'échec à écarter en premier.
import fs from "fs";
import path from "path";
const DIR = "data/matrix";
const COL = "tick_count_15s_s0";

const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
const parAsset = {};
for (const f of files) {
  const asset = f.replace(/\.csv$/i, "");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/);
  const h = L[0].split(";");
  const iT = h.indexOf(COL), iTs = h.indexOf("ts_utc");
  if (iT < 0) { console.log(`${asset} : colonne absente`); continue; }
  const vals = [], parHeure = Array.from({ length: 24 }, () => []);
  let vides = 0, total = 0;
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    total++;
    const raw = c[iT];
    // ⚠ `num("")=0` : une cellule VIDE lue 0 ferait passer un capteur absent pour un marché mort.
    if (raw === "" || raw == null) { vides++; continue; }
    const v = Number(raw); if (!Number.isFinite(v)) { vides++; continue; }
    vals.push(v);
    const hh = Number(String(c[iTs]).slice(11, 13));
    if (Number.isFinite(hh)) parHeure[hh].push(v);
  }
  parAsset[asset] = { vals, parHeure, vides, total };
}

const moy = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

console.log(`\n=== (1) REMPLISSAGE ET (2) ÉCHELLE — ${COL} ===`);
console.log(`actif           vide %   médiane   moyenne   p90`);
const meds = [];
for (const [a, d] of Object.entries(parAsset)) {
  const s = [...d.vals].sort((x, y) => x - y);
  const p90 = s.length ? s[Math.floor(s.length * 0.9)] : 0;
  meds.push([a, med(d.vals)]);
  console.log(`${a.padEnd(14)} ${(100 * d.vides / d.total).toFixed(1).padStart(6)}   `
    + `${med(d.vals).toFixed(2).padStart(7)}   ${moy(d.vals).toFixed(2).padStart(7)}   ${String(p90).padStart(5)}`);
}
const nz = meds.filter(([, m]) => m > 0).map(([, m]) => m);
if (nz.length) console.log(`\n⇒ rapport d'échelle max/min entre actifs : ${(Math.max(...nz) / Math.min(...nz)).toFixed(0)}×`
  + `  — agréger des comptes BRUTS entre actifs n'a aucun sens.`);

// ── (3) LA SAISONNALITÉ ──────────────────────────────────────────────────────────────────────
// Part de la variance expliquée par l'heure UTC seule (rapport de corrélation η² : variance
// INTER-heures / variance totale). Proche de 1 = le capteur EST l'horloge.
console.log(`\n=== (3) 🔴 SAISONNALITÉ HORAIRE — η² = part de variance expliquée par l'HEURE seule ===`);
console.log(`actif           η²      lecture`);
const etas = [];
for (const [a, d] of Object.entries(parAsset)) {
  if (d.vals.length < 500) continue;
  const gm = moy(d.vals);
  let inter = 0, tot = 0;
  for (const v of d.vals) tot += (v - gm) ** 2;
  for (const grp of d.parHeure) { if (!grp.length) continue; inter += grp.length * (moy(grp) - gm) ** 2; }
  const eta = tot > 0 ? inter / tot : 0;
  etas.push(eta);
  console.log(`${a.padEnd(14)} ${eta.toFixed(3).padStart(6)}   `
    + (eta > 0.5 ? "🔴 le capteur est surtout une HORLOGE" : eta > 0.2 ? "⚠ saisonnalité forte, à retirer" : "✅ peu saisonnier"));
}
if (etas.length) console.log(`\n⇒ η² médian sur l'univers : ${med(etas).toFixed(3)}`);

// Profil horaire moyen, normalisé par actif (chaque actif compte pour 1 — sinon US_TECH100 écrase).
console.log(`\n=== PROFIL HORAIRE (moyenne des ratios heure/médiane-actif, 1 voix par actif) ===`);
for (let hh = 0; hh < 24; hh++) {
  const r = [];
  for (const d of Object.values(parAsset)) {
    const m = med(d.vals);
    if (m > 0 && d.parHeure[hh].length > 20) r.push(moy(d.parHeure[hh]) / m);
  }
  if (!r.length) continue;
  const v = moy(r);
  console.log(`${String(hh).padStart(2)}h  ${v.toFixed(2).padStart(5)}×  ${"█".repeat(Math.min(60, Math.round(v * 12)))}`);
}
