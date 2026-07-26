// add_adx_s0.mjs — reconstruit les colonnes LIVE de la famille ADX (owner 2026-07-26, v2).
// --------------------------------------------------------------------------------------------
// POURQUOI : l'EA n'exporte `*_s0` que depuis le 18/07. Vérifié sur les archives VPS — zéro champ
//   ADX/DI avant cette date (25/06 : 203 clés, aucune ; 18/07 : 270 clés, 18 champs adx/di). Les
//   archives ne peuvent donc PAS combler le trou : le passé intra-bougie se CALCULE, il ne se lit pas.
//
// ⭐🔥 v2 — CORRECTION D'UN BUG DE LA v1, TROUVÉ PAR L'OWNER SUR GOLD 09/07 19:00.
//   La v1 propageait SON PROPRE état d'indicateur sur une série H1 réagrégée depuis les M1, pendant
//   que `c1` venait de l'EA. **Deux séries, deux vérités** : dès qu'elles divergeaient (trou M1, bord
//   de séance), le `s0` reconstruit et le `c1` du fichier ne décrivaient plus le même instant, et
//   leur DIFFÉRENCE devenait du bruit — or c'est exactement ce que consomment `diDeltaLive` et
//   `diGapDynamicsLive`.
//   Symptôme mesurable : le lissage impose `DI_s0 >= DI_c1 × (1−α)` — un PLANCHER mécanique, le
//   ratio brut étant toujours >= 0. Violations relevées : **0 sur 42 914** valeurs mesurées par l'EA,
//   **4 492 sur 106 368** valeurs reconstruites (4,2 %). GOLD affichait 18,43 pour un plancher à 21,28.
//
//   ⇒ v2 : on ne propage PLUS d'état. Chaque `s0` est UN SEUL PAS d'EMA calculé À PARTIR DU `c1` DU
//   FICHIER. La cohérence avec `c1` est alors garantie PAR CONSTRUCTION, et le plancher ne peut plus
//   être franchi. ⭐ La leçon : quand une valeur dérivée doit être SOUSTRAITE d'une autre, les deux
//   doivent venir de la MÊME source — sinon la soustraction mesure l'écart entre les sources.
//
// SOURCES, une par rôle :
//   • état précédent (adx, DI)   ← les colonnes `_c1` DU FICHIER (= série MT5 via add_adx.mjs)
//   • OHLC de la bougie précédente ← `hist_<SYM>_<TF>.csv`, la série de bougies de MT5
//   • bougie PARTIELLE (high/low) ← `data/ohlc/ohlc_<SYM>_M1.csv`, agrégée depuis l'ouverture
//
// FORMULE — l'ADX « SIMPLE » de MetaTrader (`iADX`), PAS celui de Wilder :
//   DI bruts = 100·DM/TR (ratio PAR BARRE) · lissage EMA α = 2/(p+1) · DX puis ADX même EMA.
//   Vérifiée à 0,005 près sur 4 321 bougies. ⚠ Se tromper de variante coûte ~8 points d'ADX.
//
// ⚠ ON NE REMPLIT QUE LES CELLULES VIDES : les valeurs réelles de l'EA servent de JUGE.
// ⚠ ÉCRÊTAGE AU PLANCHER (owner) : si malgré tout une valeur passe dessous, on l'y ramène plutôt que
//   de laisser un trou. Sémantiquement propre — le plancher signifie « la bougie n'a rien apporté »,
//   et le delta corrigé y vaut exactement 0, donc un signal NEUTRE et non un signal FAUX.
//   🔴 MAIS ON COMPTE LES ÉCRÊTAGES : un écrêtage est le symptôme d'une entrée manquante, pas une
//   valeur normale. Si le compteur reste élevé, la cause n'est pas réglée — c'est ce compteur qui
//   m'a permis de trouver le bug, le masquer aurait supprimé l'alarme.
import fs from "fs";
import path from "path";

const P = 14, ALPHA = 2 / (P + 1), FLOOR = 1 - ALPHA;
const MATRIX = "data/matrix";
const OHLC = "data/ohlc";
const HIST = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files";
const STAGING = "data/_staging/adx_s0";
const INSTALL = process.argv.includes("--install");

// ⚠ JAMAIS `Number(v)` seul : `Number("") === 0` et 0 est fini (cf. num_empty_string_zero_bug).
const num = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

const barKey = (t, minutes) => {
  const d = t.slice(0, 11), hh = t.slice(11, 13), mm = +t.slice(14, 16);
  return minutes >= 60 ? `${d}${hh}:00` : `${d}${hh}:${String(Math.floor(mm / minutes) * minutes).padStart(2, "0")}`;
};

// UN pas de l'ADX simple, depuis un état DONNÉ (celui du fichier) et une bougie partielle.
function step(prev, cur, prevBar) {
  let up = cur.h - prevBar.h, dn = prevBar.l - cur.l;
  if (up < 0) up = 0; if (dn < 0) dn = 0;
  if (up > dn) dn = 0; else if (up < dn) up = 0; else { up = 0; dn = 0; }
  const tr = Math.max(Math.abs(cur.h - cur.l), Math.abs(cur.h - prevBar.c), Math.abs(cur.l - prevBar.c));
  const rp = tr ? 100 * up / tr : 0, rm = tr ? 100 * dn / tr : 0;
  const pdi = prev.pdi + (rp - prev.pdi) * ALPHA;
  const mdi = prev.mdi + (rm - prev.mdi) * ALPHA;
  const s = pdi + mdi, dx = s ? 100 * Math.abs(pdi - mdi) / s : 0;
  return { pdi, mdi, adx: prev.adx + (dx - prev.adx) * ALPHA };
}

function loadHist(sym, tf) {
  const p = `${HIST}/hist_${sym}_${tf}.csv`;
  if (!fs.existsSync(p)) return null;
  const map = new Map(), keys = [];
  for (const l of fs.readFileSync(p, "utf8").split("\n").slice(1)) {
    const c = l.split(";"); if (c.length < 5) continue;
    const t = c[0].trim(); if (!t) continue;
    const h = num(c[2]), lo = num(c[3]), cl = num(c[4]);
    if (h == null || lo == null || cl == null) continue;
    map.set(t, { h, l: lo, c: cl }); keys.push(t);
  }
  keys.sort();
  const prevOf = new Map();
  for (let i = 1; i < keys.length; i++) prevOf.set(keys[i], keys[i - 1]);
  return { map, prevOf };
}

const COLS = [
  { tf: "h1", TF: "H1", minutes: 60 },
  { tf: "m15", TF: "M15", minutes: 15 },
];

fs.mkdirSync(STAGING, { recursive: true });
const assets = fs.readdirSync(MATRIX).filter((f) => f.endsWith(".csv")).map((f) => f.slice(0, -4));
let totFilled = 0, totClamp = 0, totSkip = 0;
const report = [];

for (const sym of assets) {
  const m1p = path.join(OHLC, `ohlc_${sym}_M1.csv`);
  if (!fs.existsSync(m1p)) { console.log(`SKIP ${sym} : pas de M1`); continue; }

  // partielles cumulées, par TF et par bougie
  const partial = { h1: new Map(), m15: new Map() };
  for (const l of fs.readFileSync(m1p, "utf8").split("\n").slice(1)) {
    const c = l.split(";"); if (c.length < 5) continue;
    const t = c[0].trim(); if (!t) continue;
    const hi = num(c[2]), lo = num(c[3]), cl = num(c[4]);
    if (hi == null || lo == null || cl == null) continue;
    for (const C of COLS) {
      const k = barKey(t, C.minutes), arr = partial[C.tf].get(k);
      if (!arr) partial[C.tf].set(k, [{ t, h: hi, l: lo, c: cl }]);
      else { const q = arr[arr.length - 1]; arr.push({ t, h: Math.max(q.h, hi), l: Math.min(q.l, lo), c: cl }); }
    }
  }
  const hist = { h1: loadHist(sym, "H1"), m15: loadHist(sym, "M15") };

  const raw = fs.readFileSync(path.join(MATRIX, `${sym}.csv`), "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);
  const H = lines[0].split(";");
  const ix = (n) => H.indexOf(n);
  const tsIx = ix("ts_utc");
  const st = { filled: 0, clamp: 0, skip: 0, err: [] };

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const g = lines[i].split(";");
    const ts = g[tsIx]; if (!ts) continue;
    const mt = `${ts.slice(0, 10).replace(/-/g, ".")} ${ts.slice(11, 16)}`;
    let touched = false;

    for (const C of COLS) {
      const iA = ix(`adx14_${C.tf}_s0`), iP = ix(`plus_di_${C.tf}_s0`), iM = ix(`minus_di_${C.tf}_s0`);
      if (iA < 0) continue;
      const aC = num(g[ix(`adx14_${C.tf}_c1`)]);
      const pC = num(g[ix(`plus_di_${C.tf}_c1`)]);
      const mC = num(g[ix(`minus_di_${C.tf}_c1`)]);
      const real = num(g[iA]);
      if (aC == null || pC == null || mC == null) { if (real == null) st.skip++; continue; }

      const key = barKey(mt, C.minutes);
      const hh = hist[C.tf];
      const prevKey = hh?.prevOf.get(key);
      const prevBar = prevKey ? hh.map.get(prevKey) : null;
      const arr = partial[C.tf].get(key);
      if (!prevBar || !arr) { if (real == null) st.skip++; continue; }
      let pb = null; for (const x of arr) { if (x.t <= mt) pb = x; else break; }
      if (!pb) { if (real == null) st.skip++; continue; }

      const out = step({ pdi: pC, mdi: mC, adx: aC }, pb, prevBar);
      // 🔴 FILET : le plancher ne peut être franchi que si une entrée est douteuse.
      let clamped = false;
      for (const [k, base] of [["pdi", pC], ["mdi", mC], ["adx", aC]]) {
        const fl = base * FLOOR;
        if (out[k] < fl - 1e-9) { out[k] = fl; clamped = true; }
      }
      if (clamped) st.clamp++;

      if (real != null) { st.err.push(Math.abs(out.adx - real)); continue; }   // JUGE, on n'écrase pas
      g[iA] = out.adx.toFixed(2);
      if (iP >= 0 && num(g[iP]) == null) g[iP] = out.pdi.toFixed(2);
      if (iM >= 0 && num(g[iM]) == null) g[iM] = out.mdi.toFixed(2);
      st.filled++; touched = true;
    }
    if (touched) lines[i] = g.join(";");
  }

  fs.writeFileSync(path.join(STAGING, `${sym}.csv`), lines.join(eol), "utf8");
  const e = st.err.sort((a, b) => a - b);
  const q = (f) => (e.length ? e[Math.floor(f * (e.length - 1))] : NaN);
  const ok = e.length ? e.filter((x) => x < 0.5).length / e.length : null;
  report.push({ sym, ...st, med: q(0.5), ok });
  totFilled += st.filled; totClamp += st.clamp; totSkip += st.skip;
  console.log(`${sym.padEnd(12)} rempli ${String(st.filled).padStart(6)}  écrêté ${String(st.clamp).padStart(5)}` +
    `  sans entrée ${String(st.skip).padStart(5)}  |  jugé ${String(e.length).padStart(6)}  médiane ${q(0.5).toFixed(3)}` +
    `  <0,5 : ${ok == null ? "—" : (ok * 100).toFixed(1) + "%"}`);
}

const okAll = report.filter((r) => r.ok != null);
const worst = okAll.slice().sort((a, b) => a.ok - b.ok)[0];
console.log(`\nrempli ${totFilled}   écrêté ${totClamp} (${(totClamp * 100 / (totFilled || 1)).toFixed(2)} %)   sans entrée ${totSkip}`);
console.log(`pire actif : ${worst.sym} ${(worst.ok * 100).toFixed(1)} % sous 0,5`);
if (worst.ok < 0.85) { console.log("\n🔴 REFUS D'INSTALLER — un actif est sous 85 % de points à moins de 0,5."); process.exit(1); }
console.log(`\nstaging écrit dans ${STAGING}`);
if (INSTALL) {
  const bak = `${MATRIX}_pre_s0v2`;
  if (!fs.existsSync(bak)) fs.cpSync(MATRIX, bak, { recursive: true });
  for (const r of report) fs.copyFileSync(path.join(STAGING, `${r.sym}.csv`), path.join(MATRIX, `${r.sym}.csv`));
  console.log(`INSTALLÉ dans ${MATRIX}   (backup : ${bak})`);
} else {
  console.log("relancer avec --install pour installer (backup automatique).");
}
