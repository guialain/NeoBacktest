// ============================================================================================
// buildAssetCSV.mjs — Archives Matrix (JSONL, photos 1-min) → 1 CSV par ACTIF (format Matrix).
// --------------------------------------------------------------------------------------------
// Reconstruit les snapshots de PRIX price_{tf}_sNmin (comme les replays Matrix), garde TOUS les
//   champs moteur, timestamp MT (pour croiser avec les charts MT5). Une passe = un dataset autonome
//   par actif que le backtest run row-par-row.
// Usage : node prep/buildAssetCSV.mjs --dir /opt/v10r/data/snapshots --days 20260708,20260709 --out ./out
//   (--days omis = tous les archive_*.jsonl du dossier ; --symbols pour filtrer)
// ============================================================================================
import fs from "fs";
import path from "path";
import readline from "readline";

const A = { dir: "/opt/v10r/data/snapshots", days: null, out: "./out", symbols: null };
for (let i = 2; i < process.argv.length; i++) {
  const t = process.argv[i];
  if (t === "--dir") A.dir = process.argv[++i];
  else if (t === "--days") A.days = String(process.argv[++i]).split(",");
  else if (t === "--out") A.out = process.argv[++i];
  else if (t === "--symbols") A.symbols = new Set(String(process.argv[++i]).toUpperCase().split(","));
}
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const OFFSETS = { d1: [15, 30, 45], h4: [10, 20, 30], h1: [5, 10, 15] };   // reconstruction sNmin (comme replays)
// Snapshots bbw H1 (bbw = 4·sigma_h1/middle_h1·100) reconstruits comme le prix. Le moteur lit `bbw_h1_s15min`
//   (ex-TriggerGate Δbbw — trio SUPPRIMÉ le 20/07 — + Energy bbwDynPct/BBW_DYN_SLOT.h1=15). m15/h4 NON reconstruits : l'archive n'a pas
//   sigma/middle m15/h4 (EA) → bbwOf(m15/h4)=null en live aussi, donc rien à combler.
const BBW_H1_OFFSETS = [5, 10, 15];

// perSymbol[sym] = { rows: [obj...], cols: Set }
const perSymbol = {};

async function processDay(file) {
  const minPrice = {};          // sym -> Map(minKey -> price)   (dans CE jour)
  const minBbwH1 = {};          // sym -> Map(minKey -> bbw_h1)  (4·sigma_h1/middle_h1·100)
  const dayRows = {};           // sym -> [obj...]
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    const sym = r.symbol && String(r.symbol).toUpperCase(); if (!sym) continue;
    if (A.symbols && !A.symbols.has(sym)) continue;
    const ep = Date.parse(r.ts_utc ?? r.timestamp) / 1000; if (!Number.isFinite(ep)) continue;
    r.__minKey = Math.round(ep / 60);
    (minPrice[sym] ??= new Map()).set(r.__minKey, num(r.price));
    const sig = num(r.sigma_h1), mid = num(r.middle_h1);
    (minBbwH1[sym] ??= new Map()).set(r.__minKey, (sig === null || mid === null || mid === 0) ? null : (4 * sig / mid) * 100);
    (dayRows[sym] ??= []).push(r);
  }
  // reconstruire sNmin + accumuler
  for (const sym in dayRows) {
    const mp = minPrice[sym], mb = minBbwH1[sym];
    const bucket = (perSymbol[sym] ??= { rows: [], cols: new Set() });
    for (const r of dayRows[sym]) {
      const at  = (k) => { const kk = r.__minKey - k; return mp.get(kk) ?? mp.get(kk - 1) ?? mp.get(kk + 1) ?? null; };
      const atB = (k) => { const kk = r.__minKey - k; return mb.get(kk) ?? mb.get(kk - 1) ?? mb.get(kk + 1) ?? null; };
      for (const tf of Object.keys(OFFSETS)) for (const N of OFFSETS[tf]) r[`price_${tf}_s${N}min`] = at(N);
      for (const N of BBW_H1_OFFSETS) r[`bbw_h1_s${N}min`] = atB(N);
      delete r.__minKey;
      for (const k of Object.keys(r)) bucket.cols.add(k);
      bucket.rows.push(r);
    }
  }
}

let files = fs.readdirSync(A.dir).filter((f) => /^archive_\d+\.jsonl$/.test(f)).sort();
if (A.days) files = files.filter((f) => A.days.some((d) => f.includes(d)));
console.error(`# ${files.length} archives -> ${A.out}`);
for (const f of files) { const t0 = Date.now(); await processDay(path.join(A.dir, f)); console.error(`  ${f} (${((Date.now() - t0) / 1000).toFixed(1)}s)`); }

fs.mkdirSync(A.out, { recursive: true });
const csvCell = (v) => (v == null ? "" : String(v));
for (const sym in perSymbol) {
  const { rows, cols } = perSymbol[sym];
  // ordre colonnes : timestamp, ts_utc, price, atr_h1 d'abord, puis le reste trié
  const first = ["timestamp", "ts_utc", "price", "atr_h1"].filter((c) => cols.has(c));
  const rest = [...cols].filter((c) => !first.includes(c)).sort();
  const header = [...first, ...rest];
  const out = [header.join(";")];
  for (const r of rows) out.push(header.map((c) => csvCell(r[c])).join(";"));
  const fp = path.join(A.out, `${sym}.csv`);
  fs.writeFileSync(fp, out.join("\n"));
  console.error(`  ${sym}: ${rows.length} rows, ${header.length} cols -> ${sym}.csv`);
}
console.error(`\nOK: ${Object.keys(perSymbol).length} actifs`);
