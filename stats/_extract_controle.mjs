// _extract_controle.mjs — CONTROLE DE L'EXTRACTION `CollectMeanSlopeRaw` AVANT TOUT USAGE
//
// 🎯 On ne calibre RIEN sur un dataset qu'on n'a pas controle. Ce depot a deja paye
//   « un dataset court qui ne se signale pas » et « une colonne plausible et fausse ».
//   Quatre questions, dans l'ordre ou elles peuvent tuer la suite :
//     ① PROFONDEUR — a-t-on vraiment 12 mois, en H1 ET en M1 ?
//     ② COUVERTURE HORAIRE — la session asiatique est-elle la ? (le but affiche du 24h/24)
//     ③ CONTIGUITE H1 — combien de barres n'ont pas de precedente a -1h ?
//     ④ RESOLUTION — le gain de precision existe-t-il REELLEMENT ?
//
// 🔴 LE M1 NE SE CHARGE PAS EN OBJETS : 358 Mo et ~5 M de lignes une fois le plafond MT5 leve.
//   On le PARCOURT en flux pour n'en tirer que le compte, les bornes et les doublons de jointure,
//   puis on le relache. Garder les 19 series ferait exploser le tas — et un OOM au milieu d'un
//   controle rendrait un verdict PARTIEL qui aurait l'air complet.
//   usage : node --max-old-space-size=4096 stats/_extract_controle.mjs
import fs from "fs"; import path from "path";
const DIR = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/MeanSlopeRaw";
const lire = (f) => {
  const L = fs.readFileSync(f, "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";"); const iT = h.indexOf("time_utc"), iC = h.indexOf("close");
  const out = [];
  for (const l of L.slice(1)) { const c = l.split(";");
    const t = Date.parse(c[iT].replace(" ", "T") + "Z"), v = Number(c[iC]);
    if (Number.isFinite(t) && Number.isFinite(v) && v > 0) out.push({ t, v }); }
  return out;
};
// ⭐ Parcours en flux du M1 — aucune allocation par ligne.
const scanM1 = (f) => {
  const txt = fs.readFileSync(f, "utf8");
  let n = 0, first = null, last = null, dup = 0, prev = null;
  let i = txt.indexOf("\n") + 1;
  while (i > 0 && i < txt.length) {
    let j = txt.indexOf("\n", i);
    const ligne = txt.slice(i, j < 0 ? txt.length : j);
    i = j < 0 ? -1 : j + 1;
    const c1 = ligne.indexOf(";"); if (c1 < 0) continue;
    const c2 = ligne.indexOf(";", c1 + 1); if (c2 < 0) continue;
    const t = Date.parse(ligne.slice(c1 + 1, c2).replace(" ", "T") + "Z");
    if (!Number.isFinite(t)) continue;
    n++; if (first === null) first = t; last = t;
    // ⚠ Les tranches MENSUELLES du collecteur se chevauchent d'une barre aux jointures.
    //   On COMPTE les repetitions ici plutot que de les supposer negligeables.
    if (prev !== null && t <= prev) dup++;
    prev = t;
  }
  return { n, first, last, dup };
};
const jour = (ms) => new Date(ms).toISOString().slice(0, 10);
const mois = (a, b) => ((b - a) / 86400000 / 30.44).toFixed(1);
const actifs = [...new Set(fs.readdirSync(DIR).map((f) => f.replace(/_(H1|M1)\.csv$/, "")))].sort();
const info = {};

console.log("\n══ ① PROFONDEUR ══");
console.log("  " + "actif".padEnd(12) + "H1 lignes".padStart(10) + "   H1 du       au".padEnd(26) + "mois"
  + "M1 lignes".padStart(12) + "   M1 du       au".padEnd(26) + "mois");
console.log("  " + "─".repeat(104));
for (const a of actifs) {
  const H = lire(path.join(DIR, a + "_H1.csv"));
  const M = scanM1(path.join(DIR, a + "_M1.csv"));
  info[a] = { H, M };
  const moH = mois(H[0].t, H[H.length - 1].t), moM = mois(M.first, M.last);
  console.log("  " + a.padEnd(12) + String(H.length).padStart(10) + "   " + jour(H[0].t) + " " + jour(H[H.length - 1].t)
    + moH.padStart(7) + String(M.n).padStart(12) + "   " + jour(M.first) + " " + jour(M.last)
    + moM.padStart(7) + (Number(moM) < 11 ? "  🔴" : "  ✅") + (M.dup ? "  dup " + M.dup : ""));
}

console.log("\n══ ② COUVERTURE HORAIRE (H1, part des barres par tranche UTC) ══");
console.log("  ⭐ la matrice de prod ne couvre que 06:00-20:00 UTC. La question est : a-t-on le RESTE ?");
console.log("  " + "actif".padEnd(12) + "00-06h".padStart(9) + "06-20h".padStart(9) + "20-24h".padStart(9)
  + "   heures distinctes / 24");
console.log("  " + "─".repeat(66));
for (const a of actifs) {
  const H = info[a].H; const hh = new Array(24).fill(0);
  for (const r of H) hh[new Date(r.t).getUTCHours()]++;
  const s = (lo, hi) => 100 * hh.slice(lo, hi).reduce((x, y) => x + y, 0) / H.length;
  const nz = hh.filter((x) => x > 0).length;
  console.log("  " + a.padEnd(12) + (s(0, 6).toFixed(1) + " %").padStart(9) + (s(6, 20).toFixed(1) + " %").padStart(9)
    + (s(20, 24).toFixed(1) + " %").padStart(9) + String(nz).padStart(12) + (nz < 24 ? "   (marche ferme)" : "   ✅"));
}

console.log("\n══ ③ CONTIGUITE H1 (barres dont la precedente n'est PAS a -1h) ══");
console.log("  ⚠ C'est exactement la population ou `meanSlope` explose (jusqu'a 36x le P99 mesure).");
console.log("  " + "actif".padEnd(12) + "barres".padStart(9) + "non contigues".padStart(15) + "part".padStart(9) + "   plus grand trou");
console.log("  " + "─".repeat(70));
for (const a of actifs) {
  const H = info[a].H; let n = 0, max = 0;
  for (let i = 1; i < H.length; i++) { const d = (H[i].t - H[i - 1].t) / 3600000;
    if (d !== 1) { n++; if (d > max) max = d; } }
  console.log("  " + a.padEnd(12) + String(H.length).padStart(9) + String(n).padStart(15)
    + ((100 * n / H.length).toFixed(2) + " %").padStart(9) + ("  " + max.toFixed(0) + " h").padStart(18));
}

console.log("\n══ ④ RESOLUTION — LE GAIN EXISTE-T-IL VRAIMENT ? ══");
console.log("  SMA(20) des clotures H1 calculee en DOUBLE, puis niveaux distincts de `middle[i]-middle[i-1]`.");
console.log("  ⚠ La matrice tirait ses niveaux de ~22 800 valeurs ; ici on en a ~6 000. MOINS de donnees.");
console.log("  " + "actif".padEnd(12) + "valeurs".padStart(9) + "niveaux MATRICE".padStart(17)
  + "niveaux ICI".padStart(13) + "   gain");
console.log("  " + "─".repeat(70));
const MAT = { AUDUSD: 83, EURUSD: 114, GBPUSD: 137, USDCAD: 103, USDCHF: 114 };
for (const a of actifs) {
  const H = info[a].H; if (H.length < 25) continue;
  const mid = [];
  for (let i = 19; i < H.length; i++) { let s = 0; for (let k = i - 19; k <= i; k++) s += H[k].v; mid.push(s / 20); }
  const d = []; for (let i = 1; i < mid.length; i++) d.push(mid[i] - mid[i - 1]);
  // ⚠ Arrondi a 1e-12 relatif : on ne compte pas le bruit flottant comme des "niveaux".
  const ech = Math.max(...H.map((r) => r.v));
  const uniq = new Set(d.map((v) => Math.round(v / (ech * 1e-12)))).size;
  const m = MAT[a];
  console.log("  " + a.padEnd(12) + String(d.length).padStart(9) + (m ? String(m) : "—").padStart(17)
    + String(uniq).padStart(13) + (m ? ("   x" + Math.round(uniq / m)) : ""));
}
console.log("");
