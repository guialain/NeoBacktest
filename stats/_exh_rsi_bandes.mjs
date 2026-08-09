// _exh_rsi_bandes.mjs — WR DU FADE PAR PLAGE DE RSI H1 **CLÔTURÉ**, ORIENTÉE PAR LE CÔTÉ,
//   et ventilée par Δ RSI H1 LIVE. Plages dictées owner 09/08 : 68-73 · 73-78 · 78-83 · 83-88 ·
//   88-93 · 93-98, et leur MIROIR côté BUY (32-27 · 27-22 · 22-17 · 17-12 · 12-7 · 7-2).
//
// ⭐⭐⭐ ORIENTATION : on ne lit pas « RSI haut » mais « RSI À L'EXTRÊME QUE CE FADE PREND À
//   CONTRE-PIED ». `rsiOriente = SELL ? rsi : 100 − rsi`. Les deux côtés se superposent alors sur la
//   MÊME échelle et une plage veut dire la même chose des deux bords. Sans ça, chaque plage est un
//   demi-échantillon et le miroir n'est pas vérifiable.
//
// 🔴🔥 SÉLECTEUR = `rsi_h1` (forme NUE = la CLÔTURE), Δ = `drsi_h1_s0` (LIVE).
//   `rsi_s0 = rsi_h1 + Δ` : sélectionner sur le LIVE et ventiler par le Δ croise une grandeur avec
//   une de ses PROPRES COMPOSANTES — sur le %K ça FABRIQUAIT deux classes entières et inversait
//   l'ordre. ⚠ `rsi_h1_s1` est la MÊME série que `rsi_h1` (0,0 % de désaccord) mais ABSENTE sur
//   55,7 % des barres : s'en servir amputerait la population en silence.
//
// 🔴 POPULATION : `SOCLE=1` (`TOUT_ADMETTRE` + spacing off) par DÉFAUT ici. Le Δ RSI H1 est devenu
//   la 7ᵉ entrée du barème le 09/08 — mesurer son axe sur les tirs que ce barème a sélectionnés est
//   un COLLIDER. `SOCLE=0` pour voir la population prod, en sachant ce qu'on regarde.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
process.env.TOUT_ADMETTRE = String(process.env.SOCLE ?? "1") === "1" ? "1" : "0";
const SOCLE = process.env.TOUT_ADMETTRE === "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { rsiDeltaCol } =
  await import("../../Matrix-Revolution/src/components/robot/engines/scoring/experts/rsiExpert.js");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const OPTS = SOCLE ? { spacing: false, maxOpen: 100000, cadenceMin: 2, chargeSpread: true }
                   : { maxOpen: 30, cadenceMin: 2, chargeSpread: true };
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), OPTS);
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const EXH = all.filter((s) => s.strategy === "EXH");
const ep = dedupeEpisodes(EXH).filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function grappes(t) {
  const g = new Map();
  for (const s of t) {
    const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++;
  }
  const v = [...g.values()];
  return { g: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN };
}
const BE = 75;
function line(lbl, t, ind = "  ") {
  if (!t.length) { console.log(ind + lbl.padEnd(26) + "—"); return; }
  const w = t.filter((x) => x.outcome === "WIN").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const wr = 100 * w / t.length, sig = (wr - BE) / (Math.sqrt(0.75 * 0.25 / t.length) * 100);
  const gr = grappes(t);
  console.log(ind + lbl.padEnd(26) +
    `ép=${String(t.length).padStart(3)}  WR ${wr.toFixed(1).padStart(5)} %  ` +
    `${(sig >= 0 ? "+" : "") + sig.toFixed(2)} σ${Math.abs(sig) >= 2 ? " ⭐" : "  "} ` +
    `R ${(R >= 0 ? "+" : "") + R.toFixed(1).padStart(5)}  ` +
    `| ${String(gr.g).padStart(3)} gr. ${gr.wr.toFixed(1).padStart(5)} %`);
}

// RSI ORIENTÉ : « à quel point le marché est allé LOIN dans le sens que ce fade contrarie ».
const rsiOr = (s) => (Number.isFinite(s.rsiH1) ? (s.side === "SELL" ? s.rsiH1 : 100 - s.rsiH1) : null);
// ⭐ `_UP` orienté = le RSI POUSSE ENCORE dans le sens fadé (il monte pour un SELL, descend pour un BUY).
const MIROIR = { EXPLOSIVE_DOWN: "EXPLOSIVE_UP", FAST_DOWN: "FAST_UP", SOFT_DOWN: "SOFT_UP", FLAT: "FLAT",
                 SOFT_UP: "SOFT_DOWN", FAST_UP: "FAST_DOWN", EXPLOSIVE_UP: "EXPLOSIVE_DOWN" };
const colOr = (s) => { const c = rsiDeltaCol(s.dRsiH1Live); return c == null ? null
                       : (s.side === "BUY" ? (MIROIR[c] ?? c) : c); };

// ⚠ LES DEUX QUEUES SONT IMPRIMÉES (`< 68` et `≥ 98`) : une plage dictée qui commence à 68 laisse
//   hors-champ 60 % du carnet, et une table qui ne montrerait que les 6 plages ferait croire que
//   tout est là. On ne cache pas ce qu'on n'a pas mesuré.
// ⭐ COUPURES PARAMÉTRABLES (`COUPES=72,75,78,83,88,93`) — le découpage est une DICTÉE owner, il a
//   déjà changé deux fois en une soirée (68/73/78/83/88/93 puis 72/75/78/83/88/93). Le figer en dur
//   obligeait à rééditer le script à chaque passe, et un script réédité à la main finit par ne plus
//   mesurer la même chose que la fois d'avant.
const COUPES = String(process.env.COUPES ?? "72,75,78,83,88,93").split(",").map(Number);
const PLAGES = [[0, COUPES[0]], ...COUPES.map((c, i) => [c, COUPES[i + 1] ?? 101])];
const BAS = COUPES[0];
const lbl = ([lo, hi]) => lo === 0 ? `< ${BAS} (hors champ)` : hi === 101 ? `≥ ${lo}` : `${lo}-${hi}`;
const mir = ([lo, hi]) => lo === 0 ? `> ${100 - BAS}` : hi === 101 ? `≤ ${100 - lo}` : `${100 - hi}-${100 - lo}`;

// ⭐⭐ COMBIEN DE BARRES EXISTENT DANS CHAQUE PLAGE, INDÉPENDAMMENT DU MOTEUR ? Sans ce comptage,
//   une plage vide a DEUX explications — « la figure n'existe pas » ou « le moteur la bloque » — et
//   on ne sait pas laquelle. C'est la doctrine de `_cond_count`.
// ⚠ `Number("")` vaut 0 et il est FINI : une chaîne vide est une ABSENCE, jamais un zéro.
{
  const cnt = new Array(PLAGES.length).fill(0); let tot = 0;
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
    const L = fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/);
    const h = L[0].split(";"); const j = h.indexOf("rsi_h1");
    for (let i = 1; i < L.length; i++) {
      const c = L[i].split(";"); if (c.length < h.length) continue;
      const b = String(c[j]).trim(); if (b === "") continue;
      const v = Number(b); if (!Number.isFinite(v)) continue;
      tot++;
      // On compte la MAGNITUDE d'extrême des DEUX bords, comme l'orientation le fera ensuite.
      const o = Math.max(v, 100 - v);
      const k = PLAGES.findIndex(([lo, hi]) => o >= lo && o < hi);
      if (k >= 0) cnt[k]++;
    }
  }
  console.log("══ ⓪ CE QUI EXISTE DANS LE DATASET (barres, extrême des deux bords) ══");
  PLAGES.forEach((p, k) => console.log(`  ${lbl(p).padEnd(18)} ${String(cnt[k]).padStart(7)}  ${(100 * cnt[k] / tot).toFixed(2)} %`));
  console.log(`  total ${tot}\n`);
}

console.log(`${SOCLE ? "[SOCLE — population NON triée par le barème]" : "[POP PROD]"} ` +
  `[spread FACTURÉ] [par ÉPISODE] · sélecteur \`rsi_h1\` CLÔTURÉ · Δ LIVE · σ contre 75 %\n`);
line("EXH — TOUS", ep);
line("  BUY", ep.filter((s) => s.side === "BUY"));
line("  SELL", ep.filter((s) => s.side === "SELL"));

console.log("\n══ PAR PLAGE DE RSI H1 CLÔTURÉ, ORIENTÉE (SELL = rsi · BUY = 100−rsi) ══");
console.log("   plage        (miroir BUY)");
for (const p of PLAGES) {
  const t = ep.filter((s) => { const v = rsiOr(s); return v != null && v >= p[0] && v < p[1]; });
  console.log(`\n  ── ${lbl(p).padEnd(18)} ${("BUY " + mir(p)).padEnd(12)} ──`);
  line("les 2 côtés", t, "    ");
  line("SELL", t.filter((s) => s.side === "SELL"), "      ");
  line("BUY", t.filter((s) => s.side === "BUY"), "      ");
  line("· pousse encore", t.filter((s) => String(colOr(s)).endsWith("_UP")), "      ");
  line("· FLAT", t.filter((s) => colOr(s) === "FLAT"), "      ");
  line("· ralentit", t.filter((s) => String(colOr(s)).endsWith("_DOWN")), "      ");
  // ⭐ LE DÉTAIL DES 7 COLONNES, avec le côté — demandé owner 09/08. Les 3 groupes ci-dessus
  //   MOYENNENT ; or la table dictée du barème n'est PAS monotone (`EXPLOSIVE_UP` redescend), donc
  //   c'est justement dans le détail que la forme se voit ou se dément.
  // ⚠ `_UP` = le RSI POUSSE ENCORE dans le sens fadé. Les colonnes sont dans l'ordre du moteur.
  if (t.length >= 10) {
    console.log("      ── détail des 7 colonnes ──");
    for (const c of ["EXPLOSIVE_DOWN", "FAST_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"]) {
      const u = t.filter((s) => colOr(s) === c);
      if (!u.length) { console.log("        " + c.padEnd(24) + "—"); continue; }
      line(c, u, "        ");
      const S = u.filter((s) => s.side === "SELL"), B = u.filter((s) => s.side === "BUY");
      if (S.length && B.length) { line("· SELL", S, "          "); line("· BUY", B, "          "); }
    }
  }
}

// ⭐⭐⭐ SYNTHÈSE — LE Δ NE TRIE QU'À PARTIR D'UNE CERTAINE PROFONDEUR. Les plages le montrent une
//   par une ; ici on regroupe pour que la frontière se lise d'un coup. Les coupures testées sont
//   celles des plages dictées, pas des percentiles refaits.
console.log("\n══ SYNTHÈSE — À PARTIR DE QUELLE PROFONDEUR LE Δ TRIE-T-IL ? ══");
for (const seuil of COUPES) {
  const t = ep.filter((s) => { const v = rsiOr(s); return v != null && v >= seuil; });
  console.log(`\n  ── RSI orienté ≥ ${seuil}  (SELL rsi ≥ ${seuil} · BUY rsi ≤ ${100 - seuil}) ──`);
  line("population", t, "    ");
  line("· pousse encore", t.filter((s) => String(colOr(s)).endsWith("_UP")), "      ");
  line("   dont SELL", t.filter((s) => String(colOr(s)).endsWith("_UP") && s.side === "SELL"), "      ");
  line("   dont BUY", t.filter((s) => String(colOr(s)).endsWith("_UP") && s.side === "BUY"), "      ");
  line("· FLAT", t.filter((s) => colOr(s) === "FLAT"), "      ");
  line("· ralentit", t.filter((s) => String(colOr(s)).endsWith("_DOWN")), "      ");
}
