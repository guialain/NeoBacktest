// _exh_kd_engage.mjs — LA FIGURE « LE CREUX N'EST PAS FAIT : ÇA DESCEND ENCORE, ET IL RESTE DE LA
//   PLACE POUR DESCENDRE ». Owner 09/08, recadré : « c'est plutôt exh BUY quand K<D, kd divergent
//   et K>20 qu'il faut tester, et son miroir ».
//
// ⭐⭐⭐ LE SENS DE LA FIGURE — ET IL A FAILLI ÊTRE PRIS À L'ENVERS. Sur un **EXH BUY** on achète un
//   creux. `K < D` + `DIVERGING` + `ΔK` qui descend disent que la baisse POUSSE ENCORE, et `K > 20`
//   qu'il RESTE DE LA PLACE avant le plancher. Les quatre ensemble ne décrivent donc pas un fade
//   engagé, mais un fade **PRÉMATURÉ** ⇒ c'est un candidat **VETO**, pas un feu vert.
//   C'est exactement la forme de [[alimentation_de_l_extreme]] et des trois vetos câblés le 09/08 :
//   on ne fade pas un extrême encore ALIMENTÉ.
// 🔴 LA PREMIÈRE ÉCRITURE ORIENTAIT LES BRIQUES « dans le sens fadé », ce qui les retournait et
//   fabriquait la figure INVERSE. Ici l'orientation de référence est le **BUY, en lecture BRUTE**,
//   et le SELL en est le MIROIR — jamais l'inverse.
//
// ⭐⭐⭐ EN ENTONNOIR, PAS EN BLOC. `alimentation_de_l_extreme` : c'est la CONJONCTION qui trie, pas
//   les briques — mais on ne peut le DIRE qu'en montrant les briques seules à côté. Une brique qui
//   porte déjà tout le gain rend les trois autres décoratives ; une conjonction qui bat chacune de
//   ses briques est une vraie figure. Les deux se voient dans le même tableau, jamais séparément.
// ⭐ ET LE COMPLÉMENT EST IMPRIMÉ : une figure ne vaut que son CONTRASTE avec ce qu'elle laisse.
//
// ⭐ LE MIROIR EST DICTÉ, pas mesuré à part (`rules_symmetric_by_default`) :
//     BUY (référence, BRUT)                 SELL (image)
//     K < D            la baisse pousse     K > D
//     kdCycle DIVERGING                     idem — |K−D| est une DISTANCE, elle n'a PAS de côté
//     K > 20           place pour descendre K < 80
//     ΔK ∈ SOFT/FAST/EXPLOSIVE_DOWN         ΔK ∈ …_UP
//
// 🔴🔥 NIVEAU EN **LIVE** (`kH1`) — DÉCIDÉ PAR L'OWNER, ET LA COLONNE CLÔTURÉE EST GARDÉE À CÔTÉ.
//   Le live est ce que la règle LIRA : c'est la bonne colonne pour chiffrer un veto. Mais
//   `k(s0) = k(s1) + ΔK`, donc le croiser avec `dKBand` revient à croiser une grandeur avec une de
//   ses composantes — un ΔK fortement négatif POUSSE mécaniquement `k(s0)` sous le plancher, donc
//   la case « ça descend ET il reste de la place » est en partie FABRIQUÉE par l'algèbre. Ce n'est
//   pas une corrélation qu'on pourrait accepter, c'est une IDENTITÉ.
//   ⇒ On imprime les DEUX lectures de la même figure. L'écart entre elles EST la taille de
//   l'artefact — mesuré ce matin sur ce capteur exact : 32 ép à 93,8 % en live, **0** au clôturé.
//   Le chiffre à citer reste le LIVE ; le clôturé dit s'il est portable.
// ⚠ RÉSERVE ASSUMÉE : `kdGapH1` (K−D) est LIVE et partage donc `k(s0)` avec `dKBandH1`. C'est ce
//   que le moteur lit, et les deux grandeurs répondent à des questions différentes (position de K
//   par rapport à D · vitesse de K) — mais le terme commun existe, il est écrit ici.
//
// ⭐⭐ DEUX POPULATIONS (`socle_dit_si_vrai_prod_dit_si_utile`) — SOCLE dit si la figure est VRAIE,
//   PROD dit ce que la règle vaudrait. Point mort spread facturé = 75,0 %.
// ⚠ ÉPISODES, jamais les tirs, + une voix par grappe actif×jour.
//
//   usage : node stats/_exh_kd_engage.mjs        ·  SOCLE=1 TF=h4 node stats/_exh_kd_engage.mjs
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const SOCLE = String(process.env.SOCLE ?? "0") === "1";
if (SOCLE) process.env.TOUT_ADMETTRE = "1";
const TF = String(process.env.TF ?? "h1").toLowerCase();
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const CH = { h1: { gap: "kdGapH1", cyc: "kdCycleH1", dkb: "dKBandH1", niv: "kH1", nivC: "kH1S1" },
             h4: { gap: "kdGapH4", cyc: "kdCycleH4", dkb: "dKBandH4", niv: "kH4", nivC: "kH4S1" } }[TF];
if (!CH) throw new Error(`TF=${TF} — attendu h1 ou h4`);
const PLANCHER = Number(process.env.PLANCHER ?? 20);   // « K > 20 » côté SELL, `100−20` côté BUY

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
  return { n: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN,
           bas: v.filter((o) => o.w / o.n < 0.75).length };
};
const wr = (t) => (t.length ? 100 * t.filter((x) => x.outcome === "WIN").length / t.length : NaN);
const somR = (t) => t.reduce((a, b) => a + (b.R || 0), 0);
const cell = (t) => {
  if (!t.length) return "   —                                ";
  const g = grp(t);
  return `${String(t.length).padStart(4)} ép ${wr(t).toFixed(1).padStart(5)} % ` +
         `R ${(somR(t) >= 0 ? "+" : "") + somR(t).toFixed(1).padStart(6)} ${String(g.n).padStart(3)}gr ` +
         `${g.wr.toFixed(1).padStart(5)} % ${String(g.bas).padStart(3)}<BE`;
};

// ── LES QUATRE BRIQUES, ORIENTÉES ─────────────────────────────────────────────────────────────
const BAS = new Set(["SOFT_DOWN", "FAST_DOWN", "EXPLOSIVE_DOWN"]);
const HAUT = new Set(["SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"]);
const MIROIR = { EXPLOSIVE_UP: "EXPLOSIVE_DOWN", FAST_UP: "FAST_DOWN", SOFT_UP: "SOFT_DOWN",
                 FLAT: "FLAT",
                 SOFT_DOWN: "SOFT_UP", FAST_DOWN: "FAST_UP", EXPLOSIVE_DOWN: "EXPLOSIVE_UP" };

// ⭐ RÉFÉRENCE = BUY EN LECTURE BRUTE. Le SELL applique le miroir : signe de `K−D` inversé, niveau
//   replié autour de 50, bandes de vitesse échangées. Un seul jeu de prédicats, deux lectures.
const kMoinsD = (s) => { const v = s[CH.gap]; return Number.isFinite(v) ? (s.side === "BUY" ? v : -v) : null; };
const placeDevant = (s, p, champ) => {
  const v = s[champ]; if (!Number.isFinite(v)) return false;
  return s.side === "BUY" ? v > p : v < 100 - p;
};
const BRIQUES = [
  ["K sous D",          (s) => { const v = kMoinsD(s); return v != null && v < 0; }],
  ["kd DIVERGING",      (s) => s[CH.cyc] === "DIVERGING"],
  [`place devant (>${PLANCHER})`, (s) => placeDevant(s, PLANCHER, CH.niv)],
  ["ΔK pousse encore",  (s) => { const b = s[CH.dkb];
      return b == null ? false : (s.side === "BUY" ? BAS.has(b) : HAUT.has(b)); }],
];
// ⭐⭐ DEUX CONJONCTIONS, parce que l'owner a nommé TROIS briques cette fois et QUATRE la fois
//   d'avant. Les imprimer toutes les deux évite de trancher à sa place — et l'écart entre elles dit
//   si `ΔK` apporte quoi que ce soit une fois `K<D` et `DIVERGING` déjà posés.
const FIG3 = (s) => BRIQUES[0][1](s) && BRIQUES[1][1](s) && BRIQUES[2][1](s);
const FIGURE = (s) => BRIQUES.every(([, f]) => f(s));

const B = ep.filter((s) => s.side === "BUY"), S = ep.filter((s) => s.side === "SELL");
console.log(`\n═══ FIGURE « LE CREUX N'EST PAS FAIT » · %K/%D ${TF.toUpperCase()} · niveau LIVE · ` +
  `${SOCLE ? "SOCLE (tout admis)" : "POP PROD"} · spread FACTURÉ · point mort 75,0 % ═══`);
console.log(`    BUY : K<D · DIVERGING · K > ${PLANCHER} · ΔK ∈ {SOFT,FAST,EXPLOSIVE}_DOWN   —   SELL : l'image`);
console.log(`    ⇒ candidat VETO : plus la poche est MAUVAISE, plus la règle vaut.`);

for (const [cote, pop] of [["BUY", B], ["SELL", S]]) {
  const g = grp(pop);
  console.log(`\n══ EXH ${cote} · réf ${pop.length} ép · ${wr(pop).toFixed(1)} % · R ${somR(pop).toFixed(1)} · ${g.n} gr ${g.wr.toFixed(1)} %`);
  console.log("  ── chaque brique SEULE (le péage retourne le signe : nul seul ≠ inutile) ──");
  for (const [nom, f] of BRIQUES) console.log(`  ${nom.padEnd(20)} ${cell(pop.filter(f))}`);
  const dans = pop.filter(FIGURE), hors = pop.filter((s) => !FIGURE(s));
  const d3 = pop.filter(FIG3), h3 = pop.filter((s) => !FIG3(s));
  console.log("  ── LES CONJONCTIONS, ET CE QU'ELLES LAISSENT ──");
  console.log(`  ${"3 briques (sans ΔK)".padEnd(20)} ${cell(d3)}`);
  console.log(`  ${"  son reste".padEnd(20)} ${cell(h3)}`);
  console.log(`  ${"4 briques (avec ΔK)".padEnd(20)} ${cell(dans)}`);
  console.log(`  ${"  son reste".padEnd(20)} ${cell(hors)}`);
  // ⭐ LE MÊME FILTRE, NIVEAU LU À LA CLÔTURE — contrôle d'artefact, pas une seconde figure.
  const FIG_C = (s) => BRIQUES[0][1](s) && BRIQUES[1][1](s) && BRIQUES[3][1](s) && placeDevant(s, PLANCHER, CH.nivC);
  console.log(`  ${"  4 briques, K clôturé".padEnd(20)} ${cell(pop.filter(FIG_C))}   ⚠ contrôle d'artefact`);
  // ⭐ LE CONTRASTE EST LA SEULE LECTURE QUI VAUT — un veto se juge sur ce qu'il RETIRE contre ce
  //   qu'il LAISSE, jamais sur le WR de la poche seule.
  for (const [nom, d, h] of [["3 briques", d3, h3], ["4 briques", dans, hors]])
    if (d.length && h.length)
      console.log(`  → écart ${nom.padEnd(12)} ${(grp(d).wr - grp(h).wr >= 0 ? "+" : "") + (grp(d).wr - grp(h).wr).toFixed(1)} pt/grappe` +
                  `   (${(wr(d) - wr(h) >= 0 ? "+" : "") + (wr(d) - wr(h)).toFixed(1)} pt/épisode)`);
  // ⭐ LA VITESSE, DANS LA FIGURE — l'owner a nommé les trois bandes ensemble. Si l'une porte tout,
  //   les deux autres sont du remplissage ; si les trois se tiennent, la bande n'est pas le tri.
  // ⭐ La vitesse À L'INTÉRIEUR des 3 briques : si une seule bande porte le déficit, le veto doit
  //   la nommer ; si les trois se tiennent, `ΔK` n'est pas le tri et la 4ᵉ brique est du remplissage.
  console.log("  ── dans les 3 briques, par vitesse de %K (FLAT et sens inverse compris) ──");
  for (const b of ["EXPLOSIVE_DOWN", "FAST_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"]) {
    const cible = cote === "BUY" ? b : MIROIR[b];
    const t = d3.filter((s) => s[CH.dkb] === cible);
    if (t.length) console.log(`  ${("  " + b.toLowerCase()).padEnd(20)} ${cell(t)}`);
  }
}

// ⭐ LE PLANCHER EST-IL UNE FRONTIÈRE OU UN TIRAGE ? On rejoue la figure entière à plusieurs coupes.
//   Une figure qui n'existe qu'à 20 et disparaît à 15 et 25 n'est pas une borne, c'est un tirage.
console.log(`\n── LA BORNE « ${PLANCHER} » MISE À L'ÉPREUVE (figure complète, plancher variable) ──`);
for (const p of [0, 10, 15, 20, 25, 30, 40]) {
  const f = (s) => BRIQUES[0][1](s) && BRIQUES[1][1](s) && BRIQUES[3][1](s) && placeDevant(s, p, CH.niv);
  console.log(`  K > ${String(p).padEnd(3)} │ BUY ${cell(B.filter(f))} │ SELL ${cell(S.filter(f))}`);
}
