// _cont_kd_h4_cross.mjs — CONT : CROISEMENT K/D en H4 x `%K H4 live` dans [35 . 65], BUY et SELL.
//
// DEFINITION DU CROISEMENT — la seule qui ne se devine pas, donc elle est ECRITE :
//   croisement <=> `signe(K - D)` CHANGE entre la derniere barre H4 CLOTUREE (`_s1`) et le LIVE
//   (`_s0`). C est un evenement de BARRE EN FORMATION : il peut se defaire avant la cloture.
//   ⚠ CE N EST PAS `CONTACT`. Le depot a deja une bande morte `STOCHDYN_CONTACT = 2,1` qui dit
//     « K et D sont colles » -- un ETAT. Un croisement est une TRANSITION. On mesure les DEUX, parce
//     que confondre les deux est exactement le genre d ecart qui rend une table plausible et fausse.
//
// ⭐ ET ON L ORIENTE, sinon la mesure ne peut rien prouver :
//     AVEC le pari   = BUY : K passe AU-DESSUS de D   ·   SELL : K passe SOUS D
//     CONTRE le pari = le miroir exact.
//   Un croisement « tous sens confondus » melange deux evenements de sens oppose ; c est « un chiffre
//   agrege ne decrit pas une population qui a deux moities », applique a un evenement.
//
// ⚠ WR par GRAPPE (actif|jour) -- les tirs ne sont pas independants. Point mort 75,0 %.
//   usage : node --max-old-space-size=8192 stats/_cont_kd_h4_cross.mjs
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const CONTACT = 2.1;                       // STOCHDYN_CONTACT, la bande morte du depot

const all = [];
const H4 = new Map();

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";");
  const iT = h.indexOf("timestamp");
  const iK0 = h.indexOf("stoch_k_h4_s0"), iD0 = h.indexOf("stoch_d_h4_s0");
  const iK1 = h.indexOf("stoch_k_h4_s1"), iD1 = h.indexOf("stoch_d_h4_s1");
  if (iT >= 0 && iK0 >= 0 && iD0 >= 0 && iK1 >= 0 && iD1 >= 0) {
    for (const l of L.slice(1)) {
      const c = l.split(";");
      const k0 = Number(c[iK0]), d0 = Number(c[iD0]), k1 = Number(c[iK1]), d1 = Number(c[iD1]);
      if (![k0, d0, k1, d1].every((v) => Number.isFinite(v) && c[iK0] !== "")) continue;
      H4.set(a + "|" + c[iT], { k0, g0: k0 - d0, g1: k1 - d1 });
    }
  }
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}

const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const D = (s) => H4.get(s.asset + "|" + String(s.tsMT ?? ""));

const cross = (s) => { const d = D(s); return d && Math.sign(d.g0) !== Math.sign(d.g1) && d.g0 !== 0; };
// oriente : le croisement va-t-il DANS le sens du pari ?
const crossAvec = (s) => { const d = D(s); if (!cross(s)) return false; return s.side === "BUY" ? d.g0 > 0 : d.g0 < 0; };
const contact = (s) => { const d = D(s); return d && Math.abs(d.g0) <= CONTACT; };
const milieu = (s) => { const d = D(s); return d && d.k0 >= 35 && d.k0 <= 65; };

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
  const v = p.length > 1 ? p.reduce((x, y) => x + (y - m) ** 2, 0) / (p.length - 1) : null;
  return {
    gr: p.length, wr: 100 * m, R: t.reduce((x, y) => x + (y.R || 0), 0),
    sig: v === null ? null : 100 * Math.sqrt(v / p.length),
  };
};
const cel = (t) => {
  const s = st(t);
  if (!s) return "     0    —       —       ";
  return String(t.length).padStart(6) + String(s.gr).padStart(5)
    + (s.wr.toFixed(1) + "%").padStart(8) + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8)
    + (s.gr < 20 ? " ⚠ " : s.wr < 75 ? " 🔴" : "   ");
};
const ligne = (lbl, fn) => console.log("  " + lbl.padEnd(34)
  + cel(BUY.filter(fn)) + "  " + cel(SELL.filter(fn)));

const CONT = all.filter((s) => s.strategy === "CONT" && fini(s) && D(s));
const BUY = CONT.filter((s) => s.side === "BUY");
const SELL = CONT.filter((s) => s.side === "SELL");
const ent = (t) => { const s = st(t); return `${String(t.length).padStart(4)} tirs · ${s.wr.toFixed(1)} % ±${s.sig.toFixed(1)} · ${(s.R >= 0 ? "+" : "") + s.R.toFixed(1)} R`; };

console.log(`\n  BUY  ${ent(BUY)}\n  SELL ${ent(SELL)}`);
console.log(`  colonnes : tirs / grappes / WR-grappe / R    ⚠ = moins de 20 grappes    point mort 75,0 %`);
console.log("\n  " + " ".repeat(34) + "BUY".padStart(12) + "SELL".padStart(26));
console.log("  " + "─".repeat(76));

console.log("  ① LE CROISEMENT K/D H4 SEUL");
ligne("pas de croisement", (s) => !cross(s));
ligne("croisement (tous sens)", (s) => cross(s));
ligne("  dont AVEC le pari", (s) => crossAvec(s));
ligne("  dont CONTRE le pari", (s) => cross(s) && !crossAvec(s));
console.log("  " + "─".repeat(76));

console.log("  ② `%K H4 live` SEUL");
ligne("hors [35 · 65]", (s) => !milieu(s));
ligne("dans [35 · 65]", (s) => milieu(s));
console.log("  " + "─".repeat(76));

console.log("  ③ ⭐ LES DEUX");
ligne("croisement ET %K dans [35 · 65]", (s) => cross(s) && milieu(s));
ligne("  dont AVEC le pari", (s) => crossAvec(s) && milieu(s));
ligne("  dont CONTRE le pari", (s) => cross(s) && !crossAvec(s) && milieu(s));
ligne("croisement ET %K hors [35 · 65]", (s) => cross(s) && !milieu(s));
console.log("  " + "─".repeat(76));

console.log("  ④ POUR COMPARER — `CONTACT` (|K−D| ≤ 2,1), un ETAT et non une TRANSITION");
ligne("contact ET %K dans [35 · 65]", (s) => contact(s) && milieu(s));
ligne("contact (tous)", (s) => contact(s));
console.log("");
