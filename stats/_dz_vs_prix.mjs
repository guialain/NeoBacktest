// _dz_vs_prix.mjs — QUE FAIT LE PRIX, DANS CHAQUE CASE DE L'AXE Δz ?
//
// 🔴 LA QUESTION (owner 2026-08-02) : `Δz = 0` ne veut PAS dire « le prix n'a pas bougé », mais
//   « le prix est resté à la même DISTANCE de la moyenne ». Or z = (P − M)/σ et les trois termes
//   bougent :
//        Δz = (ΔP − ΔM)/σ − z·(Δσ/σ)      ⇒      Δz = 0  ⟺  ΔP = ΔM + z·Δσ
//   Pour tenir z immobile le prix doit avancer d'exactement le rattrapage de la moyenne PLUS
//   l'élargissement de σ multiplié par z. Ce terme GRANDIT AVEC z. Exemple owner : z = 2,1 constant
//   pendant que le prix va de 100 à 105.
//   ⇒ Corollaire jamais tiré : si `FLAT` cache une avance, `SOFT_DOWN` en cache une aussi — un prix
//   qui monte MOINS VITE que le rattrapage produit un `_DOWN`. Et le flanc `_DOWN` est exactement là
//   où ZSCORE_EXH_TABLE vote pour FADER.
//
// CE QU'ON MESURE : par case (niveau × colonne), le déplacement de prix RÉEL sur la MÊME fenêtre que
//   le Δz, orienté dans le sens où le fade gagne.
//     fenêtre    : depuis la dernière clôture H1 (zscore_h1 = clôture, zscore_h1_s0 = live)
//     départ     : close_h1_s1     arrivée : price (≡ close_h1_s0, vérifié 100 %)
//     orienté    : dP = −signe(z) × (price − close_h1_s1) / atr_h1
//                  > 0 = le prix est allé DANS le sens du fade · < 0 = CONTRE lui
// ⭐ En ATR H1 pour que les 19 actifs soient sommables.
// ⭐ SSOT : `zLevel` et `zDeltaCol` viennent du moteur — mesurer l'axe avec une recopie de l'axe
//   ne prouverait rien.
import fs from "fs";
import path from "path";
import { zLevel, zDeltaCol, Z_DELTA_COLS, Z_LEVELS, zSlopeRegime }
  from "../../Matrix-Revolution/src/components/robot/engines/scoring/experts/zscoreExpert.js";
import { ZSCORE_EXH_TABLE } from "../../Matrix-Revolution/src/components/robot/engines/scoring/exhaustionScorer.js";

const DIR = "data/matrix";
const LIGNES = Z_LEVELS.filter((l) => l !== "NO_TENSION");
const cellules = new Map();   // `${level}|${col}|${regime}` -> tableau de dP orientés
const push = (k, v) => (cellules.get(k) ?? cellules.set(k, []).get(k)).push(v);

let nTot = 0, nUtil = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const sym = f.replace(/\.csv$/i, "");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const need = ["ts_utc", "price", "close_h1_s1", "zscore_h1", "zscore_h1_s0", "atr_h1", "slope_d1"];
  if (need.some((k) => I[k] == null && k !== "slope_d1")) { console.log(`${sym}: colonnes manquantes`); continue; }
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const d = new Date(c[I.ts_utc]); if (Number.isNaN(d.getTime())) continue;
    const js = d.getUTCDay(); if (js === 0 || js === 6) continue;      // week-end = flux gelé
    nTot++;
    const zC = Number(c[I.zscore_h1]), z0 = Number(c[I.zscore_h1_s0]);
    const p = Number(c[I.price]), p0 = Number(c[I.close_h1_s1]), atr = Number(c[I.atr_h1]);
    if (![zC, z0, p, p0, atr].every(Number.isFinite) || !(atr > 0) || zC === 0) continue;
    const dZ = z0 - zC;
    const level = zLevel(zC); if (!level || level === "NO_TENSION") continue;
    const col = zDeltaCol(dZ * Math.sign(zC), level); if (!col) continue;
    // ⭐ dP ORIENTÉ : positif = le prix est allé dans le sens que le fade espère.
    const dP = -Math.sign(zC) * (p - p0) / atr;
    const reg = I.slope_d1 != null ? zSlopeRegime(c[I.slope_d1], sym) : "?";
    nUtil++;
    push(`${level}|${col}|TOUT`, dP);
    push(`${level}|${col}|${reg}`, dP);
  }
}
console.log(`${nUtil} barres exploitables sur ${nTot} (jours ouvrés, |z| ≥ 0,30)\n`);

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const contre = (a) => a.length ? a.filter((v) => v < 0).length / a.length * 100 : null;

const bloc = (regime, titre) => {
  console.log(`\n${"=".repeat(96)}\n=== ${titre}\n`
    + `=== médiane du déplacement de prix ORIENTÉ (ATR H1) · >0 = dans le sens du fade\n${"=".repeat(96)}`);
  console.log(`${"niveau".padEnd(12)}${Z_DELTA_COLS.map((c) => c.replace("EXPLOSIVE", "EXPL").replace("_DOWN", "_DN").padStart(12)).join("")}`);
  for (const lv of LIGNES) {
    let ligne = lv.padEnd(12), tbl = "".padEnd(12);
    for (const col of Z_DELTA_COLS) {
      const a = cellules.get(`${lv}|${col}|${regime}`) ?? [];
      ligne += (a.length < 200 ? "·" : (med(a) >= 0 ? "+" : "") + med(a).toFixed(3)).padStart(12);
      const s = ZSCORE_EXH_TABLE[lv]?.[col];
      tbl += (s == null ? "—" : String(s)).padStart(12);
    }
    console.log(ligne);
    if (regime === "MUR") console.log(`${"  ⤷ table EXH".padEnd(12)}${tbl.trim().padStart(84)}`);
  }
  console.log(`\n${"niveau".padEnd(12)}${Z_DELTA_COLS.map((c) => c.replace("EXPLOSIVE", "EXPL").replace("_DOWN", "_DN").padStart(12)).join("")}   ← % de barres CONTRE le fade`);
  for (const lv of LIGNES) {
    let l = lv.padEnd(12);
    for (const col of Z_DELTA_COLS) {
      const a = cellules.get(`${lv}|${col}|${regime}`) ?? [];
      l += (a.length < 200 ? "·" : contre(a).toFixed(0) + " %").padStart(12);
    }
    console.log(l);
  }
  console.log(`\n${"niveau".padEnd(12)}${Z_DELTA_COLS.map((c) => c.replace("EXPLOSIVE", "EXPL").replace("_DOWN", "_DN").padStart(12)).join("")}   ← effectifs`);
  for (const lv of LIGNES) {
    let l = lv.padEnd(12);
    for (const col of Z_DELTA_COLS) l += String((cellules.get(`${lv}|${col}|${regime}`) ?? []).length).padStart(12);
    console.log(l);
  }
};

bloc("TOUT", "TOUTES PENTES");
bloc("MUR", "RÉGIME MÛR SEULEMENT — la population que ZSCORE_EXH_TABLE lit réellement");
