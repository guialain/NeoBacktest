// _persistance_extreme.mjs — SATURER, C'EST UNE DUREE (owner 2026-08-08).
//   « Sature pour moi c'est pas 3/3, c'est dans le temps : il faut que les valeurs extremes
//     des oscillateurs perdurent. » Et : « le plafond, c'est lui qui fait la regle. »
//
// ⭐⭐⭐ CE QUE LE SCRIPT MESURE : depuis combien de MINUTES SANS INTERRUPTION l'oscillateur est-il
//   a l'extreme au moment du tir, et ce que vaut le tir selon cette duree. Miroir : SELL -> haut,
//   BUY -> bas, MEMES seuils.
//
// ⚠⚠ POPULATION NON CONTRAINTE (`spacing=false, maxOpen=100000`). Sur la population PROD on compte
//   la frequence du PASSAGE AU CARNET, pas celle de la FIGURE — la capacite supprime ~82 % des tirs.
//   Erreur vecue le 08/08 : « 11 grappes, donc une seule journee » etait faux ; en non contraint la
//   meme figure revient sur 28 journees / 28.
//
// ⚠ La persistance se compte en MINUTES sur `ts_utc`, jamais en nombre de lignes. Et un FLUX GELE
//   la gonfle : cf. `_gel_flux.mjs` (le 04/08 lisait 281 min dont 225 de gel).
//
//   usage : node stats/_persistance_extreme.mjs        (SEUIL_K / SEUIL_RSI / PROD en env)
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(import.meta.dirname, "../data/matrix");
const SEUIL_K = Number(process.env.SEUIL_K ?? 90);        // miroir : 100 - SEUIL_K en bas
const PROD = String(process.env.PROD ?? "false") === "true";
const OPTS = PROD ? { chargeSpread: true } : { chargeSpread: true, spacing: false, maxOpen: 100000 };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const F = [];
for (const a of readdirSync(DIR).filter((f) => f.endsWith(".csv")).map((f) => f.slice(0, -4))) {
  const lines = readFileSync(`${DIR}/${a}.csv`, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 5);
  const H = lines[0].split(";").map((s) => s.trim());
  const ci = Object.fromEntries(H.map((h, i) => [h, i]));
  const N = lines.length - 1;
  const ts = new Array(N), kh4 = new Array(N), kh1 = new Array(N), row = new Array(N);
  for (let i = 0; i < N; i++) {
    const c = lines[i + 1].split(";"); row[i] = c; ts[i] = Date.parse(c[ci.ts_utc]);
    kh4[i] = num(c[ci.stoch_k_h4_s0]); kh1[i] = num(c[ci.stoch_k_h1_s0]);
  }
  // ⭐ persistance = minutes depuis le DEBUT de la serie ininterrompue en cours ; -1 = pas a l'extreme
  const per = (arr, ok) => {
    const P = new Array(N).fill(-1); let deb = null;
    for (let i = 0; i < N; i++) { const v = arr[i];
      if (v !== null && ok(v)) { if (deb === null) deb = ts[i]; P[i] = (ts[i] - deb) / 60000; } else deb = null; }
    return P;
  };
  const H4h = per(kh4, (v) => v >= SEUIL_K), H4b = per(kh4, (v) => v <= 100 - SEUIL_K);
  const H1h = per(kh1, (v) => v >= SEUIL_K), H1b = per(kh1, (v) => v <= 100 - SEUIL_K);
  const idx = new Map(); for (let i = 0; i < N; i++) idx.set(row[i][ci.timestamp], i);

  let r; try { r = runMatrixBacktest(`${DIR}/${a}.csv`, OPTS); } catch { continue; }
  for (const s of r.signals ?? []) {
    if (s.strategy !== "EXH" || typeof s.R !== "number") continue;
    const i = idx.get(s.tsMT); if (i === undefined) continue;
    F.push({ a, d: String(s.tsMT).slice(0, 10), side: s.side, win: s.R > 0, R: s.R,
      pH4: s.side === "SELL" ? H4h[i] : H4b[i], pH1: s.side === "SELL" ? H1h[i] : H1b[i] });
  }
}

// ⭐⭐⭐ DEUX WR, TOUJOURS : par TIR et par GRAPPE actif x jour. Les tirs ne sont pas independants ;
//   l'ecart entre les deux colonnes EST l'information (une figure mauvaise « en moyenne » contre une
//   figure mauvaise « quand elle se repete »).
const key = (x) => `${x.a}|${x.d}`;
const st = (rs) => {
  const n = rs.length; if (!n) return null;
  const G = {}; for (const x of rs) { (G[key(x)] ??= { n: 0, w: 0 }); G[key(x)].n++; G[key(x)].w += x.win ? 1 : 0; }
  const gs = Object.values(G);
  return { n, wr: 100 * rs.filter((x) => x.win).length / n, R: rs.reduce((a, x) => a + x.R, 0),
    g: gs.length, wrg: 100 * gs.reduce((a, o) => a + o.w / o.n, 0) / gs.length,
    gBas: gs.filter((o) => o.w / o.n < 0.75).length };   // 0,75 = le point mort, spread facture
};
const L = (l, o) => o
  ? `${l.padEnd(26)} ${String(o.n).padStart(5)} ${o.wr.toFixed(1).padStart(6)}%  ${o.wrg.toFixed(1).padStart(6)}%  ${String(o.g).padStart(4)} ${String(o.gBas).padStart(5)} ${o.R.toFixed(1).padStart(7)}`
  : `${l.padEnd(26)}     0`;
const HDR = `${"".padEnd(26)}  tirs   WR/tir  WR/grap  grap  <75%       R`;
const BD = [["pas a l'extreme", (v) => v < 0], ["< 30 min", (v) => v >= 0 && v < 30],
  ["30-60 min", (v) => v >= 30 && v < 60], ["1-2 h", (v) => v >= 60 && v < 120],
  ["2-4 h", (v) => v >= 120 && v < 240], ["4-8 h", (v) => v >= 240 && v < 480], ["> 8 h", (v) => v >= 480]];

console.log(`${F.length} tirs EXH · seuil %K ${SEUIL_K} (miroir ${100 - SEUIL_K}) · ${PROD ? "PROD" : "NON CONTRAINTE"}\n`);
for (const [nom, k] of [["%K H4", "pH4"], ["%K H1", "pH1"]]) {
  for (const side of ["SELL", "BUY"]) {
    console.log(`======== ${side} — persistance ${nom} ========`); console.log(HDR);
    const S = F.filter((x) => x.side === side);
    console.log(L("TOUT", st(S)));
    for (const [l, f] of BD) console.log(L("  " + l, st(S.filter((x) => f(x[k])))));
    console.log("");
  }
}

// ⚠ LE VETO SE JUGE PAR COTE, ET SUR LES MEMES DECOUPES. Un veto positif « tel quel » mais negatif
//   des qu'on retire une journee est un detecteur de cette journee, pas une regle.
console.log("######## VETO MIROIR : bloquer si %K H4 a l'extreme depuis >= T ########");
console.log("   T    | RETIRE (tirs · WR/tir · WR/grap · grap) | RESTE");
for (const T of [60, 120, 180, 240, 300, 480]) {
  const out = [];
  for (const side of ["SELL", "BUY"]) {
    const S = F.filter((x) => x.side === side);
    const o = st(S.filter((x) => x.pH4 >= T)), r = st(S.filter((x) => x.pH4 < T));
    out.push(`${side} ${o ? `${String(o.n).padStart(4)} ${o.wr.toFixed(1)}% ${o.wrg.toFixed(1)}% ${String(o.g).padStart(3)}g` : "  —"} -> ${r.wr.toFixed(1)}%`);
  }
  console.log(`  ${String(T).padStart(3)}min | ${out[0].padEnd(42)} | ${out[1]}`);
}
console.log("\n######## ROBUSTESSE (Δ WR de la cellule) ########");
console.log("  decoupe              cote |  avant  | T>=120  | T>=240");
for (const side of ["SELL", "BUY"]) {
  for (const [lbl, ex] of [["tel quel", () => false], ["sans le 04/08", (x) => x.d === "2026.08.04"],
    ["sans indices US", (x) => ["US_30", "US_500", "US_TECH100"].includes(x.a)],
    ["juillet seul", (x) => x.d >= "2026.08.01"], ["aout seul", (x) => x.d < "2026.08.01"]]) {
    const P = F.filter((x) => x.side === side && !ex(x)); const av = st(P);
    const f = (T) => { const o = st(P.filter((x) => x.pH4 < T)); return `${o.wr.toFixed(1).padStart(5)}% (${(o.wr - av.wr >= 0 ? "+" : "")}${(o.wr - av.wr).toFixed(1)})`; };
    console.log(`  ${lbl.padEnd(18)} ${side.padEnd(5)} | ${av.wr.toFixed(1).padStart(5)}% | ${f(120)} | ${f(240)}`);
  }
}
