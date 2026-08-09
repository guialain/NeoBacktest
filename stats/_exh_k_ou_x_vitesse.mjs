// _exh_k_ou_x_vitesse.mjs — QUI INQUIÈTE : LA PLACE QUI RESTE, OU LA VIOLENCE DE LA CHUTE ?
//   Owner 09/08 : « en quoi la chute violente devrait inquiéter plus que le live qui n'est pas
//   encore arrivé à son plancher ? »
//
// 🔴🔥 LA QUESTION NE PEUT PAS SE TRANCHER PAR LE RAISONNEMENT, PARCE QUE LES TROIS GRANDEURS N'EN
//   FONT QUE DEUX : `K_live = K_clôturé + ΔK`. « La place qui reste » (`K_live`) n'est donc PAS un
//   axe indépendant de la violence — c'est une DIAGONALE dans le plan `(K_clôturé, ΔK)`.
//   ⇒ On imprime le PLAN. Si le déficit suit les colonnes, c'est la vitesse qui parle ; s'il suit
//   les lignes, c'est le niveau de départ ; s'il suit une diagonale, l'owner a raison et c'est bien
//   la place restante.
// ⭐ LES DEUX AXES CHOISIS SONT LES SEULS SANS TERME COMMUN : `K(s1)` est ce qui est ÉTABLI, `ΔK`
//   est ce qui se passe MAINTENANT. Croiser `K_live` avec `ΔK` serait croiser une grandeur avec une
//   de ses composantes — l'erreur documentée dans `matrixBacktest` et mesurée le 09/08.
// ⭐ La MOYENNE de `K_live` est imprimée dans chaque case : c'est là qu'on LIT la diagonale.
//
// ⚠ Population = EXH avec le fade ENGAGÉ (`K<D` + `DIVERGING`), c'est-à-dire la base de la figure
//   de l'owner, débarrassée de ses deux briques de niveau/vitesse. `BASE=0` pour tout l'EXH.
// ⚠ ORIENTÉ : tout est lu côté BUY, le SELL est replié (`100−K`, bandes de vitesse échangées).
// ⚠ Épisodes + une voix par grappe. Point mort 75,0 %.
//
//   usage : SOCLE=1 node stats/_exh_k_ou_x_vitesse.mjs
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
const SOCLE = String(process.env.SOCLE ?? "0") === "1";
if (SOCLE) process.env.TOUT_ADMETTRE = "1";
const BASE = String(process.env.BASE ?? "1") === "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const OPTS = SOCLE ? { spacing: false, maxOpen: 100000, cadenceMin: 2, chargeSpread: true }
                   : { maxOpen: 30, cadenceMin: 2, chargeSpread: true };
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), OPTS).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
let ep = dedupeEpisodes(all.filter((s) => s.strategy === "EXH"))
  .filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const gapOr = (s) => (Number.isFinite(s.kdGapH1) ? (s.side === "BUY" ? s.kdGapH1 : -s.kdGapH1) : null);
if (BASE) ep = ep.filter((s) => gapOr(s) != null && gapOr(s) < 0 && s.kdCycleH1 === "DIVERGING");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
const grp = (t) => {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN;
};
const wr = (t) => (t.length ? 100 * t.filter((x) => x.outcome === "WIN").length / t.length : NaN);
const somR = (t) => t.reduce((a, b) => a + (b.R || 0), 0);

// ── LES DEUX AXES LIBRES, ORIENTÉS CÔTÉ BUY ───────────────────────────────────────────────────
const kClos = (s) => (Number.isFinite(s.kH1S1) ? (s.side === "BUY" ? s.kH1S1 : 100 - s.kH1S1) : null);
const kLive = (s) => (Number.isFinite(s.kH1) ? (s.side === "BUY" ? s.kH1 : 100 - s.kH1) : null);
const MIR = { EXPLOSIVE_UP: "EXPLOSIVE_DOWN", FAST_UP: "FAST_DOWN", SOFT_UP: "SOFT_DOWN", FLAT: "FLAT",
              SOFT_DOWN: "SOFT_UP", FAST_DOWN: "FAST_UP", EXPLOSIVE_DOWN: "EXPLOSIVE_UP" };
const vit = (s) => { const b = s.dKBandH1; if (b == null) return null;
  return s.side === "BUY" ? b : MIR[b] ?? b; };          // orienté : `_DOWN` = la baisse pousse

const NIV = [[0, 30], [30, 40], [40, 50], [50, 100]];
const VIT = ["SOFT_DOWN", "FAST_DOWN", "EXPLOSIVE_DOWN"];

const cel = (t) => {
  if (!t.length) return "     —          ";
  const kl = t.map(kLive).filter(Number.isFinite);
  const m = kl.length ? kl.reduce((a, b) => a + b, 0) / kl.length : NaN;
  return `${String(t.length).padStart(3)}ép ${grp(t).toFixed(0).padStart(3)}%g K̄l ${m.toFixed(0).padStart(2)}`;
};

for (const cote of ["BUY", "SELL"]) {
  const pop = ep.filter((s) => s.side === cote);
  console.log(`\n═══ EXH ${cote} · ${SOCLE ? "SOCLE" : "PROD"}${BASE ? " · base K<D + DIVERGING" : ""} · ` +
    `réf ${pop.length} ép ${wr(pop).toFixed(1)} % (${grp(pop).toFixed(1)} %/gr) · point mort 75 % ═══`);
  console.log("  K CLÔTURÉ │" + VIT.map((v) => ` ${v.replace("_DOWN", "").padEnd(9)}     `).join("│") + "│ toute la ligne");
  for (const [lo, hi] of NIV) {
    const L = pop.filter((s) => { const v = kClos(s); return v != null && v >= lo && v < hi; });
    console.log(`  ${`${lo}-${hi}`.padEnd(9)} │` +
      VIT.map((v) => ` ${cel(L.filter((s) => vit(s) === v))}`).join("│") + `│ ${cel(L)}`);
  }
  const col = (v) => pop.filter((s) => vit(s) === v);
  console.log(`  ${"toute la col".padEnd(9)} │` + VIT.map((v) => ` ${cel(col(v))}`).join("│") + `│ ${cel(pop)}`);

  // ⭐ LA DIAGONALE, ISOLÉE : à VITESSE ÉGALE, la place restante trie-t-elle encore ?
  console.log(`  ── à vitesse ÉGALE, la place restante (K live) trie-t-elle ? ──`);
  for (const v of VIT) {
    const c = col(v);
    const hautK = c.filter((s) => kLive(s) > 30), basK = c.filter((s) => kLive(s) != null && kLive(s) <= 30);
    console.log(`     ${v.replace("_DOWN", "").padEnd(10)} K live > 30 : ${cel(hautK)}   │  K live ≤ 30 : ${cel(basK)}`);
  }
  // ⭐ ET SON SYMÉTRIQUE : à PLACE ÉGALE, la vitesse trie-t-elle ?
  console.log(`  ── à place ÉGALE (K live > 30), la vitesse trie-t-elle ? ──`);
  const place = pop.filter((s) => kLive(s) > 30);
  for (const v of VIT) console.log(`     ${v.replace("_DOWN", "").padEnd(10)} ${cel(place.filter((s) => vit(s) === v))}`);
}
