// _cont_tirs_apres_gap.mjs — LES TIRS DONT LA FENETRE FRANCHIT UNE COUPURE (week-end, seance).
//
// 🎯 OWNER 22/08 : « les gaps d ouverture doivent etre traites, ceux du week ».
//
// ⭐⭐⭐ POURQUOI CA COMPTE ICI PRECISEMENT — l identite verifiee ce matin a 3,11e-10 :
//        meanSlopeH1 = ( prix − cloture_H1[i−19] ) / 20 / atrP50
//   Ce n est PAS une pente locale : c est le DEPLACEMENT DU PRIX SUR 20 BARRES. Apres un week-end,
//   ces 20 barres ne couvrent plus 20 heures mais 68 ou 90 — **le meme capteur mesure une autre
//   duree**, et la valeur explose (mesure : jusqu a 36x le P99). Le percentile qu on en tire est
//   alors lu sur une echelle calibree pour 20 heures. Il ne veut rien dire.
//   ⚠ Et ca ne touche pas que `meanSlope` : toute grandeur qui compare deux clotures (ΔK, K−D, Δz,
//   ΔDI) porte le meme defaut sur la 1ʳᵉ barre d apres coupure.
//
// ⭐ LA COUPURE EST LUE SUR LES SERIES MT5 12 MOIS (`MeanSlopeRaw/<SYM>_H1.csv`), pas devinee : une
//   barre est APRES-GAP si sa precedente n est pas a −1 h. Deux marquages :
//     · `GAP_1`  la barre du tir suit immediatement une coupure ;
//     · `GAP_20` la fenetre de 20 barres qui nourrit `meanSlope` en contient une.
//   ⚠ `GAP_20` est le bon perimetre pour `meanSlope`, `GAP_1` pour les deltas d une barre.
//
// ⚠ WR par GRAPPE. Point mort 75,0 %.
//   usage : node stats/_cont_tirs_apres_gap.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const H1DIR = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/MeanSlopeRaw";
const H = 3600000;
let all = [];
const GAP1 = new Map(), GAP20 = new Map();   // "actif" -> Set(debut d heure ms)
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  // ── les coupures, depuis la serie MT5 12 mois ──
  const p1 = path.join(H1DIR, a + "_H1.csv");
  if (fs.existsSync(p1)) {
    const L = fs.readFileSync(p1, "utf8").trim().split(/\r?\n/);
    const h = L[0].split(";"); const iT = h.indexOf("time_utc");
    const t = [];
    for (const l of L.slice(1)) { const c = l.split(";");
      const v = Date.parse(c[iT].replace(" ", "T") + "Z"); if (Number.isFinite(v)) t.push(v); }
    const g1 = new Set(), g20 = new Set();
    for (let i = 1; i < t.length; i++) if (t[i] - t[i - 1] !== H) g1.add(t[i]);
    // ⭐ La FENETRE : la barre en formation `i+1` lit les clotures `i−19 … i`. Une coupure DANS
    //   cette fenetre suffit a fausser `meanSlope`, meme si la barre courante est contigue.
    for (let i = 19; i < t.length; i++) {
      let coupe = false;
      for (let k = i - 18; k <= i; k++) if (t[k] - t[k - 1] !== H) { coupe = true; break; }
      if (coupe) g20.add(t[i] + H);                  // la barre EN FORMATION qui suit la cloture i
    }
    GAP1.set(a, g1); GAP20.set(a, g20);
  }
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s));
// ⚠ `tsMT` est en heure BROKER, et l export MT5 aussi (`gmt_offset_sec = 0` sur les 19 fichiers,
//   verifie ce matin). Les deux horloges coincident donc — c est ce qui rend la jointure legitime.
const heure = (s) => { const t = Date.parse(String(s.tsMT ?? "").slice(0, 19).replace(/\./g, "-").replace(" ", "T") + "Z");
  return Number.isFinite(t) ? Math.floor(t / H) * H : null; };
const marque = (M) => (s) => { const h = heure(s); const g = M.get(s.asset); return h !== null && g ? g.has(h) : false; };
const apres1 = marque(GAP1), apres20 = marque(GAP20);
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const p = [...g.values()].map((o) => o.w / o.n);
  const m = p.reduce((a, b) => a + b, 0) / p.length;
  const v = p.length > 1 ? p.reduce((a, b) => a + (b - m) ** 2, 0) / (p.length - 1) : null;
  return { n: t.length, gr: p.length, wr: 100 * m, sig: v === null ? null : 100 * Math.sqrt(v / p.length),
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const L = (lbl, t, w = 30) => { const s = st(t);
  console.log("  " + lbl.padEnd(w) + String(t.length).padStart(7) + (s ? String(s.gr).padStart(6) : "     0")
    + (s ? (s.wr.toFixed(1) + "%").padStart(9) : "        —")
    + (s && s.sig !== null ? ("±" + s.sig.toFixed(1)).padStart(8) : "       —")
    + (s ? ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9) : "        —")
    + (s && s.gr < 20 ? "  ⚠ <20 grap" : (s && s.wr < 75 ? "  🔴" : ""))); };
const T = st(CONT);
console.log(`\n═══ LES TIRS ③ APRES UNE COUPURE ═══  ${CONT.length} tirs · reference ${T.wr.toFixed(1)} % · ${(T.R>=0?"+":"")+T.R.toFixed(1)} R`);
console.log("  " + "population".padEnd(30) + "tirs".padStart(7) + "grap".padStart(6) + "WR/grap".padStart(9) + "sigma".padStart(8) + "R".padStart(9));
console.log("  " + "─".repeat(69));
L("TOUS", CONT);
L("barre APRES coupure (GAP_1)", CONT.filter(apres1));
L("fenetre 20 barres coupee", CONT.filter(apres20));
L("fenetre PROPRE", CONT.filter((s) => !apres20(s)));
console.log("\n  ── par cote ──");
for (const c of ["BUY", "SELL"]) {
  const P = CONT.filter((s) => s.side === c);
  L(`${c} · fenetre coupee`, P.filter(apres20));
  L(`${c} · fenetre propre`, P.filter((s) => !apres20(s)));
}
console.log("\n  ── ce que `meanSlope` vaut dans les deux populations ──");
const ms = (t) => { const v = t.map((s) => s.sc?.meanSlopeH1).filter(Number.isFinite).map(Math.abs).sort((a, b) => a - b);
  return v.length ? `median ${v[Math.floor(v.length/2)].toFixed(3)} · p95 ${v[Math.floor(.95*v.length)].toFixed(3)} · max ${v[v.length-1].toFixed(3)}` : "—"; };
console.log("     fenetre coupee : " + ms(CONT.filter(apres20)));
console.log("     fenetre propre : " + ms(CONT.filter((s) => !apres20(s))));
console.log("");
