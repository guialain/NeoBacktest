// _actif_germany_profil.mjs — GERMANY_40 : le profil, et surtout LES RAFALES.
//
// 🎯 POURQUOI CETTE SONDE EXISTE. Le soupcon owner est « un peu cher + des retournements
//   inexplicables ». La moitie PEAGE est deja REFUTEE par le depot (GERMANY_40 = l actif le MOINS
//   cher des 19 : `spread/atr_h1` p70 = 0,02907, `atr_h1/spread` p50 = 39,7, la meilleure
//   couverture citee). ⇒ Il ne reste que la moitie COMPORTEMENT, et c est elle qu on mesure ici.
//
// ⭐⭐⭐ « RETOURNEMENT INEXPLICABLE » N EST PAS UNE GRANDEUR. La forme MESURABLE que ce depot a
//   deja nommee est LA RAFALE : plusieurs tirs sur le meme actif dans une fenetre courte, qui ne
//   sont pas N observations mais UN SEUL pari. C est ce motif exact qui a condamne AUDUSD
//   (14 tirs en 88 min a 7,1 % pour −12,7 R). Et le depot porte un chantier ouvert dessus
//   (`US_30 · 29/07` : 7 pertes en 26 min sur la MEME barre H1).
//   ⇒ On mesure : taille des rafales, leur WR, et le signe `WR/grappe − WR/tir`.
//   /!\ `WR/grappe < WR/tir` = LE SIGNAL SE TROMPE EN SERIE : les grappes les plus fournies sont
//     les perdantes. C est la signature d un probleme de REPLIQUE, pas de barème.
//
// ⛔ CE QUE CETTE SONDE NE PEUT PAS FAIRE, ET IL FAUT LE DIRE AVANT DE LA LIRE :
//   elle ne chiffre PAS le retrait de l actif. « UNE SOUSTRACTION SUR LA LISTE DES TRADES N EST PAS
//   UN A/B » -- retirer un tir en LIBERE d autres (capacite, spacing). Seul le carnet RE-COURU
//   sans l actif chiffre le geste. Ici on etablit seulement s il y a un CAS.
// ⚠ WR par GRAPPE (actif|jour). Point mort 75,0 %.
//   usage : node --max-old-space-size=8192 stats/_actif_germany_profil.mjs
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const CIBLE = "GERMANY_40";
const RAFALE_MIN = 60 * 60000;   // fenetre d une heure
const RAFALE_N = 4;              // 4 tirs ou plus dans l heure = rafale

const all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const ts = (s) => Date.parse(String(s.tsMT || "").slice(0, 19).replace(/\./g, "-").replace(" ", "T") + "Z");
const T = all.filter(fini);

const st = (t) => {
  if (!t.length) return null;
  const g = new Map();
  for (const x of t) {
    const k = x.asset + "|" + jour(x);
    if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++;
  }
  const p = [...g.values()].map((o) => o.w / o.n);
  const m = p.reduce((x, y) => x + y, 0) / p.length;
  const w = t.filter((x) => x.outcome === "WIN").length;
  return { n: t.length, gr: p.length, wrT: 100 * w / t.length, wrG: 100 * m,
           R: t.reduce((x, y) => x + (y.R || 0), 0) };
};

// ── ① OU SE SITUE L ACTIF DANS LE PARC ──
console.log(`\n═══ ① LE PARC, CLASSE PAR WR/GRAPPE ═══   moteur du jour · spread FACTURE`);
const G = st(T);
console.log(`  carnet entier : ${G.n} tirs · WR/tir ${G.wrT.toFixed(1)} % · WR/grappe ${G.wrG.toFixed(1)} % · ${(G.R >= 0 ? "+" : "") + G.R.toFixed(1)} R`);
console.log("  " + "actif".padEnd(14) + "tirs".padStart(6) + "grap".padStart(6) + "WR/tir".padStart(9)
  + "WR/grap".padStart(9) + "R".padStart(9) + "   R/tir");
const parc = [...new Set(T.map((s) => s.asset))].map((a) => ({ a, s: st(T.filter((x) => x.asset === a)) }))
  .filter((x) => x.s).sort((x, y) => x.s.wrG - y.s.wrG);
for (const { a, s } of parc) {
  console.log("  " + (a === CIBLE ? "⭐ " : "   ") + a.padEnd(11) + String(s.n).padStart(6) + String(s.gr).padStart(6)
    + (s.wrT.toFixed(1) + "%").padStart(9) + (s.wrG.toFixed(1) + "%").padStart(9)
    + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9)
    + ("  " + (s.R / s.n).toFixed(3)).padStart(9) + (s.wrG < 75 ? "  🔴" : ""));
}

// ── ② LES RAFALES, sur TOUT le parc puis sur la cible ──
const marque = (t) => {
  const byA = new Map();
  for (const x of t) { if (!byA.has(x.asset)) byA.set(x.asset, []); byA.get(x.asset).push(x); }
  const out = new Map();
  for (const [, arr] of byA) {
    arr.sort((p, q) => ts(p) - ts(q));
    for (let i = 0; i < arr.length; i++) {
      let n = 0;
      for (let j = i; j < arr.length && ts(arr[j]) - ts(arr[i]) <= RAFALE_MIN; j++) n++;
      for (let j = i; j < arr.length && ts(arr[j]) - ts(arr[i]) <= RAFALE_MIN; j++)
        out.set(arr[j], Math.max(out.get(arr[j]) ?? 1, n));
    }
  }
  return out;
};
const RAF = marque(T);
const enRafale = (s) => (RAF.get(s) ?? 1) >= RAFALE_N;
const l2 = (lbl, t) => { const s = st(t);
  console.log("  " + lbl.padEnd(30) + (s ? String(s.n).padStart(6) + String(s.gr).padStart(6)
    + (s.wrT.toFixed(1) + "%").padStart(9) + (s.wrG.toFixed(1) + "%").padStart(9)
    + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9) + (s.gr < 20 ? "  ⚠" : s.wrG < 75 ? "  🔴" : "") : "  vide")); };

console.log(`\n═══ ② LES RAFALES — ${RAFALE_N} tirs ou plus sur le meme actif en 60 min ═══`);
console.log("  " + "population".padEnd(30) + "tirs".padStart(6) + "grap".padStart(6) + "WR/tir".padStart(9) + "WR/grap".padStart(9) + "R".padStart(9));
l2("PARC · hors rafale", T.filter((s) => !enRafale(s)));
l2("PARC · EN RAFALE", T.filter((s) => enRafale(s)));
const C = T.filter((s) => s.asset === CIBLE);
l2(CIBLE + " · hors rafale", C.filter((s) => !enRafale(s)));
l2(CIBLE + " · EN RAFALE", C.filter((s) => enRafale(s)));
const partP = 100 * T.filter(enRafale).length / T.length;
const partC = 100 * C.filter(enRafale).length / (C.length || 1);
console.log(`\n  part des tirs EN RAFALE :  parc ${partP.toFixed(1)} %  ·  ${CIBLE} ${partC.toFixed(1)} %`);

// ── ③ LE SIGNE `WR/grappe − WR/tir` : le signal se trompe-t-il EN SERIE ? ──
console.log(`\n═══ ③ « LE SIGNAL SE TROMPE-T-IL EN SERIE ? »  (WR/grappe − WR/tir) ═══`);
console.log(`  ⭐ NEGATIF = les grappes les mieux fournies sont les PERDANTES = probleme de REPLIQUE.`);
for (const { a, s } of parc.map((x) => x).sort((x, y) => (x.s.wrG - x.s.wrT) - (y.s.wrG - y.s.wrT)).slice(0, 6))
  console.log("  " + (a === CIBLE ? "⭐ " : "   ") + a.padEnd(13) + ((s.wrG - s.wrT >= 0 ? "+" : "") + (s.wrG - s.wrT).toFixed(1) + " pt").padStart(9)
    + `   (grappe ${s.wrG.toFixed(1)} · tir ${s.wrT.toFixed(1)})`);

// ── ④ LES PIRES JOURNEES DE LA CIBLE ──
console.log(`\n═══ ④ ${CIBLE} — LES JOURNEES, PAR R ═══`);
const jm = new Map();
for (const x of C) { const k = jour(x); if (!jm.has(k)) jm.set(k, []); jm.get(k).push(x); }
const jrs = [...jm.entries()].map(([k, v]) => ({ k, n: v.length, w: v.filter((x) => x.outcome === "WIN").length,
  R: v.reduce((a, b) => a + (b.R || 0), 0) })).sort((a, b) => a.R - b.R);
for (const j of jrs.slice(0, 6))
  console.log(`  ${j.k}   ${String(j.n).padStart(3)} tirs · ${String(j.w).padStart(3)} W · ${(100 * j.w / j.n).toFixed(1).padStart(5)} % · ${((j.R >= 0 ? "+" : "") + j.R.toFixed(1)).padStart(7)} R`);
console.log(`  ...`);
for (const j of jrs.slice(-2))
  console.log(`  ${j.k}   ${String(j.n).padStart(3)} tirs · ${String(j.w).padStart(3)} W · ${(100 * j.w / j.n).toFixed(1).padStart(5)} % · ${((j.R >= 0 ? "+" : "") + j.R.toFixed(1)).padStart(7)} R`);
const S = st(C);
const pire = jrs[0];
const sans = st(C.filter((x) => jour(x) !== pire.k));
console.log(`\n  ⭐ LE CRIBLE DU DEPOT — ${CIBLE} survit-il au RETRAIT DE SA PIRE JOURNEE ?`);
console.log(`     avec  : ${S.n} tirs · WR/grappe ${S.wrG.toFixed(1)} % · ${(S.R >= 0 ? "+" : "") + S.R.toFixed(1)} R`);
console.log(`     sans ${pire.k} : ${sans.n} tirs · WR/grappe ${sans.wrG.toFixed(1)} % · ${(sans.R >= 0 ? "+" : "") + sans.R.toFixed(1)} R`);
console.log("");
