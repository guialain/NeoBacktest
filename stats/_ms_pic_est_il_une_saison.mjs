// _ms_pic_est_il_une_saison.mjs — LE PIC `p[90·95[` EST-IL LE CHOC PETROLIER DE JUILLET ?
//
// 🎯 OBJECTION owner 22/08, et elle vise EXACTEMENT ce qui a justifie la rampe : les donnees sont
//   concentrees sur juillet, marque par un CHOC HAUSSIER DU PETROLE. Dans ce contexte, un
//   `meanSlopeH1` tres positif a pu correspondre a un mouvement exceptionnellement PERSISTANT —
//   donc le pic mesure a `p[90·95[` (91,2 % / +38,3 R) serait un fait de SAISON, pas une regle.
//
// ⭐⭐⭐ CE QUI REND L'OBJECTION REDOUTABLE, ET QU'IL FAUT ECRIRE : la CALIBRATION des percentiles
//   est sur 12 MOIS (bonne), mais le CARNET est sur ~28 jours ouvres de juillet-aout. Un
//   `p > 90` veut donc dire « dans les 10 % les plus forts de l'ANNEE » — et si un actif a passe
//   juillet en rallye persistant, ces barres ne sont pas dispersees : elles s'AGGLUTINENT sur
//   quelques actifs et quelques jours. Une echelle annuelle ne protege PAS d'un carnet saisonnier.
//
// ⭐⭐ LE CRIBLE DU DEPOT, APPLIQUE ICI : « une regle candidate doit survivre au RETRAIT DE SA PIRE
//   GRAPPE ». Pour un PIC on retire au contraire sa MEILLEURE grappe, et son meilleur ACTIF, et
//   son meilleur JOUR. Cinq candidats ont deja ete tues par ce crible (« cinq fois une JOURNEE »).
//
// ⚠ `MIN_CONT = 1` : on mesure la FORME, pas le carnet. Capacite SATUREE ⇒ survivants.
// ⚠ Point mort 75,0 %. WR par GRAPPE (actif|jour), sigma sur les grappes.
//   usage : node stats/_ms_pic_est_il_une_saison.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s));
const st = (t) => {
  if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const parts = [...g.values()].map((o) => o.w / o.n);
  const wrg = parts.reduce((a, b) => a + b, 0) / parts.length;
  const va = parts.length > 1 ? parts.reduce((a, b) => a + (b - wrg) ** 2, 0) / (parts.length - 1) : null;
  return { n: t.length, gr: parts.length, wrg: 100 * wrg,
           sig: va === null ? null : 100 * Math.sqrt(va / parts.length),
           R: t.reduce((a, b) => a + (b.R || 0), 0) };
};
const L = (lbl, s, w = 22) => console.log("  " + lbl.padEnd(w) + (s ? String(s.n).padStart(7) + String(s.gr).padStart(6)
  + (s.wrg.toFixed(1) + "%").padStart(9) + (s.sig === null ? "—" : "±" + s.sig.toFixed(1)).padStart(8)
  + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9) + (s.gr < 20 ? "  ⚠ <20 grap" : (s.wrg < 75 ? "  🔴" : "")) : "      —"));
const H = (w = 22) => { console.log("  " + "".padEnd(w) + "tirs".padStart(7) + "grap".padStart(6) + "WR/grap".padStart(9) + "sigma".padStart(8) + "R".padStart(9));
  console.log("  " + "─".repeat(w + 39)); };
const pOri = (s) => s.sc?.msPctOri;
const tranche = (lo, hi) => CONT.filter((s) => Number.isFinite(pOri(s)) && pOri(s) >= lo && pOri(s) < hi);

const jours = [...new Set(CONT.map(jour))].sort();
console.log(`\n═══ LE PIC \`p[90·95[\` EST-IL UNE SAISON ? ═══  [MIN_CONT=${process.env.MIN_CONT}]`);
console.log(`  carnet ③ : ${CONT.length} tirs · ${jours.length} jours · du ${jours[0]} au ${jours[jours.length - 1]}`);
const ref = st(CONT);
console.log(`  reference : ${ref.wrg.toFixed(1)} % ±${ref.sig.toFixed(1)} · ${(ref.R >= 0 ? "+" : "") + ref.R.toFixed(1)} R\n`);

// ── ① QUI COMPOSE LE HAUT DE L'ECHELLE ? ────────────────────────────────────────────────────
for (const [lo, hi] of [[90, 95], [95, 100]]) {
  const T = tranche(lo, hi);
  console.log(`  ── ① VENTILATION DE \`p[${lo}·${hi}[\` PAR ACTIF (${T.length} tirs) ──`);
  H(22);
  const parA = new Map();
  for (const s of T) parA.set(s.asset, [...(parA.get(s.asset) ?? []), s]);
  for (const [a, t] of [...parA.entries()].sort((x, y) => y[1].length - x[1].length)) L(a, st(t));
  // ⭐ LA PART DU COMPLEXE ENERGIE — c'est l'objet meme de l'objection owner.
  const NRJ = ["CrudeOIL", "BRENT_OIL", "GASOLINE"];
  const e = T.filter((s) => NRJ.includes(s.asset));
  console.log("  " + "─".repeat(61));
  console.log(`  ⭐ complexe ENERGIE : ${e.length}/${T.length} tirs (${(100 * e.length / T.length).toFixed(1)} %)`);
  console.log("");
}

// ── ② LE PIC TIENT-IL SANS SON MEILLEUR ACTIF / SA MEILLEURE GRAPPE / SON MEILLEUR JOUR ? ──
const P = tranche(90, 95);
console.log(`  ── ② LE CRIBLE : LE PIC SURVIT-IL AU RETRAIT DE SON MEILLEUR CONTRIBUTEUR ? ──`);
H(26);
L("pic complet", st(P), 26);
{
  const parA = new Map();
  for (const s of P) parA.set(s.asset, [...(parA.get(s.asset) ?? []), s]);
  const best = [...parA.entries()].sort((x, y) => (st(y[1])?.R ?? 0) - (st(x[1])?.R ?? 0))[0];
  L(`sans ${best[0]} (meilleur R)`, st(P.filter((s) => s.asset !== best[0])), 26);
  const NRJ = ["CrudeOIL", "BRENT_OIL", "GASOLINE"];
  L("sans le complexe ENERGIE", st(P.filter((s) => !NRJ.includes(s.asset))), 26);
  const parG = new Map();
  for (const s of P) { const k = s.asset + "|" + jour(s); parG.set(k, [...(parG.get(k) ?? []), s]); }
  const bg = [...parG.entries()].sort((x, y) => (st(y[1])?.R ?? 0) - (st(x[1])?.R ?? 0))[0];
  L(`sans la grappe ${bg[0]}`, st(P.filter((s) => s.asset + "|" + jour(s) !== bg[0])), 26);
  const parJ = new Map();
  for (const s of P) parJ.set(jour(s), [...(parJ.get(jour(s)) ?? []), s]);
  const bj = [...parJ.entries()].sort((x, y) => (st(y[1])?.R ?? 0) - (st(x[1])?.R ?? 0))[0];
  L(`sans le jour ${bj[0]}`, st(P.filter((s) => jour(s) !== bj[0])), 26);
  console.log(`\n  📐 le pic s'etale sur ${parJ.size} jours distincts et ${parG.size} grappes.`);
}

// ── ③ LA FORME COMPLETE, SANS LE COMPLEXE ENERGIE ───────────────────────────────────────────
console.log(`\n  ── ③ LA FORME ENTIERE, COMPLEXE ENERGIE RETIRE — le pic tient-il ? ──`);
const NRJ = ["CrudeOIL", "BRENT_OIL", "GASOLINE"];
const SANS = CONT.filter((s) => !NRJ.includes(s.asset));
const rs = st(SANS);
console.log(`  ${SANS.length} tirs · reference sans energie : ${rs.wrg.toFixed(1)} % ±${rs.sig.toFixed(1)}`);
H(22);
for (let lo = 55; lo < 100; lo += 5)
  L(`p [${lo} · ${lo + 5}[`, st(SANS.filter((s) => Number.isFinite(pOri(s)) && pOri(s) >= lo && pOri(s) < lo + 5)));
console.log("");
