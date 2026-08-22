// _kd_zigzag_par_zone.mjs — LE ZIGZAG DE `K−D` : combien de fois change-t-il de signe, et OU ?
//
// 🎯 LA THESE OWNER, MOT POUR MOT : « les K croisent et decroisent en tres peu de temps dans les
//   zones MEDIANES, en H1 et H4 et meme M15 ». C est une affirmation de MECANISME, et elle est
//   directement mesurable : la matrice porte `stoch_k/d_<tf>_s0..s3`, soit QUATRE lectures
//   consecutives. On compte les CHANGEMENTS DE SIGNE de `K−D` sur ces quatre lectures (0 a 3).
//     0 = stable   ·   1 = un croisement franc   ·   2 ou 3 = ZIGZAG (croise puis decroise)
//
// ⭐⭐⭐ CE QUE CA TRANCHE, ET POURQUOI C EST PLUS QU UNE CURIOSITE : si le zigzag est concentre
//   dans la zone mediane, alors « croisement » N EST PAS LE MEME EVENEMENT selon l endroit --
//   au centre c est du bruit qui change de signe, aux extremes c est une transition. Un capteur
//   qui porte deux faits differents sous un seul nom est exactement ce que ce depot appelle un
//   seuil qui se perime avec son capteur, en pire : il ne s est jamais perime, il n a jamais ete un.
//   ⇒ Consequence directe sur le bareme : `kH1` et `kH4` lisent `K−D` / `ΔK` SANS regarder la zone.
//
// ⚠ LES QUATRE LECTURES NE COUVRENT PAS LA MEME DUREE SELON L HORLOGE : 4 barres = 1 h en M15,
//   4 h en H1, 16 h en H4. On ne compare donc PAS les taux entre horloges comme s ils mesuraient
//   la meme fenetre -- on lit CHAQUE horloge contre ELLE-MEME, zone contre zone. Melanger serait
//   le piege `bornes calibrees H1, lues M15` sous une autre forme.
// ⚠ `s0` est LIVE : le dernier segment `s1→s0` peut se defaire avant la cloture. C est voulu --
//   c est l instant ou le moteur decide.
// ⚠ Mesure sur TOUTE la population de barres (pas sur les tirs) pour la partie STRUCTURE, puis sur
//   les tirs pour la partie PERFORMANCE. ⛔ Ne jamais conclure une frequence sur les tirs seuls :
//   la cascade a deja selectionne dessus (collider).
//   usage : node --max-old-space-size=8192 stats/_kd_zigzag_par_zone.mjs
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const TFS = ["m15", "h1", "h4"];
const DUREE = { m15: "4 barres = 1 h", h1: "4 barres = 4 h", h4: "4 barres = 16 h" };

// zone de `%K` : le centre contre les deux extremes
const zone = (k) => (!Number.isFinite(k) ? null : k >= 35 && k <= 65 ? "MEDIANE [35·65]" : "EXTREMES");

const POP = { m15: new Map(), h1: new Map(), h4: new Map() };   // zone -> [n0, n1, n2, n3]
const SIG = new Map();                                          // "actif|ts" -> { m15:{f,z}, h1:.., h4:.. }
const all = [];

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";");
  const iT = h.indexOf("timestamp");
  const IDX = {};
  for (const tf of TFS) {
    IDX[tf] = [0, 1, 2, 3].map((s) => [h.indexOf(`stoch_k_${tf}_s${s}`), h.indexOf(`stoch_d_${tf}_s${s}`)]);
  }
  for (const l of L.slice(1)) {
    const c = l.split(";");
    const rec = {};
    for (const tf of TFS) {
      const g = IDX[tf].map(([ik, id]) => {
        if (ik < 0 || id < 0 || c[ik] === "" || c[id] === "") return null;
        const k = Number(c[ik]), d = Number(c[id]);
        return Number.isFinite(k) && Number.isFinite(d) ? { k, g: k - d } : null;
      });
      if (g.some((x) => x === null)) continue;
      // s0 est le plus RECENT : on parcourt s3 -> s0
      let flips = 0;
      for (let i = 3; i > 0; i--) if (Math.sign(g[i].g) !== Math.sign(g[i - 1].g)) flips++;
      const z = zone(g[0].k);
      if (!z) continue;
      if (!POP[tf].has(z)) POP[tf].set(z, [0, 0, 0, 0]);
      POP[tf].get(z)[flips]++;
      rec[tf] = { f: flips, z };
    }
    if (Object.keys(rec).length) SIG.set(a + "|" + c[iT], rec);
  }
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}

console.log(`\n═══ ① LA STRUCTURE — sur TOUTES les barres, pas sur les tirs ═══`);
console.log(`  « changements de signe de K−D sur les 4 dernieres lectures »  ·  2 ou 3 = ZIGZAG\n`);
for (const tf of TFS) {
  console.log(`  ── ${tf.toUpperCase()}  (${DUREE[tf]}) ──`);
  console.log("     " + "zone".padEnd(18) + "barres".padStart(9) + "0 flip".padStart(9) + "1".padStart(8)
    + "2".padStart(8) + "3".padStart(8) + "   ZIGZAG (2+)");
  for (const z of ["MEDIANE [35·65]", "EXTREMES"]) {
    const v = POP[tf].get(z); if (!v) continue;
    const n = v.reduce((a, b) => a + b, 0);
    const zz = 100 * (v[2] + v[3]) / n;
    console.log("     " + z.padEnd(18) + String(n).padStart(9)
      + v.map((x) => (100 * x / n).toFixed(1) + "%").map((s, i) => s.padStart(i === 0 ? 9 : 8)).join("")
      + "      " + zz.toFixed(1) + " %" + (z.startsWith("MED") ? "  ⭐" : ""));
  }
  console.log("");
}

// ── ② LA PERFORMANCE des tirs ③, par horloge x zigzag ──
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const D = (s) => SIG.get(s.asset + "|" + String(s.tsMT ?? ""));
const st = (t) => {
  if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const p = [...g.values()].map((o) => o.w / o.n);
  const m = p.reduce((x, y) => x + y, 0) / p.length;
  return { n: t.length, gr: p.length, wr: 100 * m, R: t.reduce((x, y) => x + (y.R || 0), 0) };
};
const cel = (t) => { const s = st(t); if (!s) return "     0    —       —      ";
  return String(s.n).padStart(6) + String(s.gr).padStart(5) + (s.wr.toFixed(1) + "%").padStart(8)
    + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8) + (s.gr < 20 ? " ⚠ " : s.wr < 75 ? " 🔴" : "   "); };

const CONT = all.filter((s) => s.strategy === "CONT" && fini(s) && D(s));
const BUY = CONT.filter((s) => s.side === "BUY"), SELL = CONT.filter((s) => s.side === "SELL");
console.log(`═══ ② LES TIRS ③ — le zigzag coute-t-il ? ═══   BUY ${BUY.length} · SELL ${SELL.length}`);
console.log("  " + " ".repeat(30) + "BUY".padStart(12) + "SELL".padStart(26));
for (const tf of TFS) {
  console.log(`  ── ${tf.toUpperCase()} ──`);
  for (const [lbl, fn] of [
    ["stable (0 flip)", (s) => D(s)[tf]?.f === 0],
    ["1 croisement", (s) => D(s)[tf]?.f === 1],
    ["ZIGZAG (2+)", (s) => D(s)[tf]?.f >= 2],
    ["  dont zone MEDIANE", (s) => D(s)[tf]?.f >= 2 && D(s)[tf]?.z.startsWith("MED")],
    ["  dont zone EXTREMES", (s) => D(s)[tf]?.f >= 2 && D(s)[tf]?.z === "EXTREMES"],
  ]) console.log("  " + lbl.padEnd(30) + cel(BUY.filter(fn)) + "  " + cel(SELL.filter(fn)));
}
console.log("");
