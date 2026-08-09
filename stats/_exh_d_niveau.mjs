// _exh_d_niveau.mjs — LE %D TRIE-T-IL L'EXH ? Niveau seul, puis NIVEAU × SIGNE DE Δ%D.
//   Owner 09/08 : « wr exh buy / sell selon niveau de %D, 0-10 10-20 20-30 pour exh buy et miroir
//   pour exh sell », puis « ajoute le signe de deltad, je suspecte que les meilleurs exh sell sont
//   ceux pour lesquels D est passé au-dessus de 80 avant de redescendre ».
//
// ⭐ LE MIROIR EST DANS LA LECTURE, PAS DANS DEUX TABLEAUX. Une ligne = une paire de cases MIROIR :
//   `BUY 0-10` en face de `SELL 90-100`. Les lire côte à côte est la seule façon de voir une
//   asymétrie — deux tableaux séparés obligent à chercher la ligne jumelle à la main.
//   ⇒ Tout est écrit en grandeurs ORIENTÉES : `niv` = saturation DANS LE SENS FADÉ (SELL : `D` ·
//   BUY : `100 − D`), `Δ` = pousse ENCORE dans ce sens (SELL : `+ΔD` · BUY : `−ΔD`).
//   Le « D repasse sous 80 en redescendant » de l'owner devient donc, des DEUX côtés : `niv ≥ 80`
//   ET `Δ orienté < 0`.
//
// 🔴🔥 NIVEAU **CLÔTURÉ** × Δ **LIVE**, ET PAS AUTREMENT. `D(s0) = D(s1) + ΔD` : croiser le niveau
//   LIVE avec son propre Δ, c'est croiser une grandeur avec une de ses composantes — la case
//   « haut ET redescend » serait en partie FABRIQUÉE par l'algèbre. Mesuré ce matin sur le %K :
//   32 épisodes à 93,8 % avec le sélecteur live, **0** avec le clôturé.
//   ⇒ La colonne LIVE est imprimée quand même, mais seulement pour montrer la TAILLE de l'artefact.
//
// ⭐⭐ DEUX POPULATIONS (`socle_dit_si_vrai_prod_dit_si_utile`) :
//     · SOCLE (`SOCLE=1`) — tout admis, spacing off, maxOpen ∞. Dit si la figure est VRAIE.
//     · PROD  (défaut)    — dit ce que la règle vaudrait ici et maintenant.
//
// ⚠ ÉPISODES, jamais les tirs, et une voix par grappe actif×jour à côté. Point mort = 75,0 %.
//
//   usage : node stats/_exh_d_niveau.mjs            (prod, H1)
//           SOCLE=1 TF=h4 node stats/_exh_d_niveau.mjs
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
const SOCLE = String(process.env.SOCLE ?? "0") === "1";
if (SOCLE) process.env.TOUT_ADMETTRE = "1";
const TF = String(process.env.TF ?? "h1").toLowerCase();
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const CH = { h1: { live: "dH1", clos: "dH1S1", dlt: "dDH1" },
             h4: { live: "dH4", clos: "dH4S1", dlt: "dDH4" } }[TF];
if (!CH) throw new Error(`TF=${TF} — attendu h1 ou h4`);

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
const ep = dedupeEpisodes(all.filter((s) => s.strategy === "EXH"))
  .filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
const grp = (t) => {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN };
};
const wr = (t) => (t.length ? 100 * t.filter((x) => x.outcome === "WIN").length / t.length : NaN);
const somR = (t) => t.reduce((a, b) => a + (b.R || 0), 0);
const cell = (t) => {
  if (!t.length) return "    —                       ";
  const g = grp(t);
  return `${String(t.length).padStart(4)} ép ${wr(t).toFixed(1).padStart(5)} % ` +
         `${(somR(t) >= 0 ? "+" : "") + somR(t).toFixed(1).padStart(6)} ${String(g.n).padStart(3)}gr ${g.wr.toFixed(1).padStart(5)} %`;
};

// ⭐ ORIENTATION — tout ce qui suit est lu DANS LE SENS FADÉ, des deux côtés.
const niv = (s, champ) => {
  const v = s[champ]; if (!Number.isFinite(v)) return null;
  return s.side === "SELL" ? v : 100 - v;                    // saturation dans le sens fadé
};
const dOr = (s) => {
  const v = s[CH.dlt]; if (!Number.isFinite(v)) return null;
  return s.side === "SELL" ? v : -v;                         // > 0 = pousse ENCORE dans le sens fadé
};

const B = ep.filter((s) => s.side === "BUY"), S = ep.filter((s) => s.side === "SELL");
console.log(`\n═══ %D ${TF.toUpperCase()} × EXH — ${SOCLE ? "SOCLE (tout admis)" : "POP PROD"} · spread FACTURÉ · point mort 75,0 % ═══`);
for (const [nom, t] of [["BUY", B], ["SELL", S]]) {
  const g = grp(t);
  console.log(`  réf EXH ${nom.padEnd(4)} : ${String(t.length).padStart(4)} ép · ${wr(t).toFixed(1)} % · R ${somR(t).toFixed(1)} · ${g.n} gr ${g.wr.toFixed(1)} %`);
}

// ── ① NIVEAU SEUL, en bandes de 10 ────────────────────────────────────────────────────────────
const BORNES = [0, 10, 20, 30, 40, 50];
for (const [lbl, champ] of [["CLÔTURÉ (_s1) — le niveau ÉTABLI", CH.clos],
                            ["LIVE (_s0) — la taille de l'artefact", CH.live]]) {
  console.log(`\n── ① NIVEAU SEUL · ${lbl} ──`);
  console.log("  BUY %D    épisodes    WR      R    grappes  │ SELL %D   épisodes    WR      R    grappes");
  for (let i = 0; i < BORNES.length - 1; i++) {
    // ⚠ `lo`/`hi` sont les bandes du %D BUY (lu par le bas) ; en ORIENTÉ leur image est `100−hi · 100−lo`.
    const lo = BORNES[i], hi = BORNES[i + 1];
    const sel = (pop) => pop.filter((s) => { const v = niv(s, champ); return v != null && v >= 100 - hi && v < 100 - lo; });
    console.log(`  ${`${lo}-${hi}`.padEnd(9)} ${cell(sel(B))} │ ${`${100 - hi}-${100 - lo}`.padEnd(9)} ${cell(sel(S))}`);
  }
  const reste = (pop) => pop.filter((s) => { const v = niv(s, champ); return v != null && v < 50; });
  console.log(`  ${"≥ 50".padEnd(9)} ${cell(reste(B))} │ ${"< 50".padEnd(9)} ${cell(reste(S))}`);
}

// ── ② NIVEAU CLÔTURÉ × SIGNE DE Δ%D LIVE ──────────────────────────────────────────────────────
//   ⭐ Trois colonnes et non deux : `Δ = 0` est SORTI. Le %D est une moyenne mobile, il stagne
//   souvent — noyer ce plat dans « revient » ou dans « pousse » ferait porter la conclusion par une
//   population qui ne fait NI l'un NI l'autre.
console.log(`\n── ② NIVEAU CLÔTURÉ × Δ%D LIVE ORIENTÉ (niveau lu dans le sens fadé) ──`);
console.log("  niveau    Δ<0 REVIENT                   Δ=0 plat                      Δ>0 POUSSE ENCORE");
const PALIERS = [[90, 101], [80, 90], [70, 80], [60, 70], [50, 60], [0, 50]];
for (const cote of ["SELL", "BUY"]) {
  const pop = cote === "SELL" ? S : B;
  const g = grp(pop);
  console.log(`  ═ EXH ${cote} · réf ${pop.length} ép ${wr(pop).toFixed(1)} % (${g.wr.toFixed(1)} %/gr)`);
  for (const [lo, hi] of PALIERS) {
    const d = pop.filter((s) => { const v = niv(s, CH.clos); return v != null && v >= lo && v < hi; });
    const r = d.filter((s) => dOr(s) < 0), p = d.filter((s) => dOr(s) === 0), u = d.filter((s) => dOr(s) > 0);
    console.log(`  ${(hi === 101 ? `≥ ${lo}` : `${lo}-${hi}`).padEnd(9)} ${cell(r)}  ${cell(p)}  ${cell(u)}`);
  }
}

// ── ③ LA QUESTION DE L'OWNER, DIRECTEMENT — ET SA BORNE ───────────────────────────────────────
//   ⭐⭐ LA COUPE `80` N'EST PAS DONNÉE, ELLE SE MESURE. On imprime 70/75/80/85/90 : si la figure
//   n'existe qu'à 80 et disparaît à 75 et 85, ce n'est pas une frontière, c'est un tirage.
//   ⚠ Le CONTRASTE est la seule lecture qui vaut : `revient` CONTRE `pousse encore`, à niveau égal.
console.log(`\n── ③ « SATURÉ PUIS QUI REDESCEND » — contraste à niveau égal, par coupe ──`);
console.log("  coupe    côté  REVIENT (Δ<0)                 POUSSE ENCORE (Δ≥0)           écart WR/gr");
for (const coupe of [70, 75, 80, 85, 90]) {
  for (const cote of ["SELL", "BUY"]) {
    const pop = (cote === "SELL" ? S : B).filter((s) => { const v = niv(s, CH.clos); return v != null && v >= coupe; });
    const r = pop.filter((s) => dOr(s) < 0), u = pop.filter((s) => dOr(s) >= 0);
    const e = (r.length && u.length) ? (grp(r).wr - grp(u).wr) : NaN;
    console.log(`  ≥ ${String(coupe).padEnd(6)} ${cote.padEnd(5)} ${cell(r)}  ${cell(u)}  ` +
      `${Number.isFinite(e) ? ((e >= 0 ? "+" : "") + e.toFixed(1)).padStart(6) : "     —"}`);
  }
}
