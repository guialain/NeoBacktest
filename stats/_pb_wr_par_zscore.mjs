// _pb_wr_par_zscore.mjs — LE `z` DIT-IL ENCORE QUELQUE CHOSE AU RANG ②, MAINTENANT QU'IL EN EST SORTI ?
//
// ⭐⭐⭐ LA QUESTION, ET POURQUOI ELLE EST LEGITIME MAINTENANT. Le `z` etait l'entree ⑴ du bareme PB
//   jusqu'au 11/08 au soir ; il a ete REMPLACE par `gapAtr` (table 12x7 dictee par l'owner). Les deux
//   capteurs ne sont PAS le meme : `(P-M)/sigma` contre `(P-M)/ATR_p50`, **45,6 % de desaccord**
//   mesures le 06/08. Le `z` normalise par la volatilite de la BANDE, le `gap` par celle de l'ACTIF.
//   ⇒ Il reste donc une vraie question : ce que le `z` triait, le `gap` le trie-t-il aussi ?
//
// 🔴🔥⭐⭐⭐ ET C'EST UNE MESURE **HORS BAREME**, DONC PLUS SURE QUE QUAND IL Y ETAIT. Tant que le `z`
//   NOTAIT, le mesurer sur les TIRS etait un COLLIDER : la population etait selectionnee PAR le `z`
//   lui-meme (via `MIN_PB`), donc ses bandes extremes n'existaient qu'accompagnees d'un `%K` qui les
//   compensait. Depuis qu'il est sorti, la selection ne passe plus par lui — on lit enfin une
//   variable LIBRE sur une population qu'elle n'a pas choisie.
//   ⚠ Elle n'est pas INDEPENDANTE pour autant : `z` et `gap` partagent leur numerateur `P - M`. Le
//   `gap` selectionne donc encore le `z` INDIRECTEMENT. C'est une attenuation du collider, pas sa
//   disparition — a lire comme telle.
//
// ⭐⭐ ORIENTE PAR LE COTE (`u = z x sens`), PAS BRUT — sinon les deux colonnes ne se comparent pas.
//   Un pullback BUY veut un prix revenu SOUS sa moyenne (z negatif), un SELL veut l'inverse. En brut,
//   la meme bande decrirait deux figures opposees et l'ecart BUY/SELL serait un artefact de lecture.
//   C'est la regle du depot : on ORIENTE LES BANDES PAR LE COTE.
// ⚠ NIVEAU A LA **CLOTURE** (`zscore_h1` nue — convention de nommage : la nue est la cloture, `_s0`
//   est le live ; l'exception `sigma`/`middle` ne s'applique PAS au zscore). C'est l'instant que le
//   rang ② lit pour ses NIVEAUX, et celui sur lequel les barreaux ont ete calibres.
//
// ⚠ BORNES : celles de `zLevel`, PARTAGEES (`0,30 · 1,05 · 1,55 · 2,15`) — aucune coupe inventee pour
//   l'occasion. Un second jeu de bornes sur la MEME grandeur est la faute `derived_dataset_computed_3x`.
// ⚠ AUCUNE CASE ECARTEE PAR EFFECTIF (owner 11/08) : les bandes extremes sont peu peuplees PAR
//   CONSTRUCTION, les jeter serait une selection CORRELEE a la variable testee. Les effectifs sont
//   AFFICHES, et l'ecart n'est COMMENTE qu'au-dela de 20 grappes de chaque cote.
// ⚠ Une voix par grappe actif x jour — les tirs ne sont pas independants (sigma gonfle x9).
// ⚠ Point mort 75,0 % (spread facture) : sous cette barre c'est une PERTE, pas une petite marge.
//
//   usage : MIN_EXH=10 node stats/_pb_wr_par_zscore.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.PB_ISOLE = "1";                                   // on mesure le BAREME, pas le routage
process.env.MIN_PB = process.env.MIN_PB ?? "-21";             // population large, seuil quasi neutre
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { indexRows } = await import("./_pb_entrees.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const PB = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv"), CSV = path.join(DIR, f);
  const rows = indexRows(CSV, fs);
  for (const s of (runMatrixBacktest(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || [])) {
    if (s.strategy !== "PB" || (s.outcome !== "WIN" && s.outcome !== "LOSS")) continue;
    const row = rows.get(s.tsMT); if (!row) continue;
    const zC = num(row.zscore_h1);
    if (zC == null) continue;
    // ⚠ `u` ORIENTE : c'est lui qui rend les deux colonnes comparables.
    PB.push({ ...s, asset: a, u: zC * (s.side === "BUY" ? 1 : -1), zBrut: zC,
              gap: s.sc?.boxes?.pb?.parts?.gap ?? null, ligneGap: s.sc?.boxes?.pb?.parts?.ligneGap ?? null });
  }
}
const BUY = PB.filter((s) => s.side === "BUY"), SELL = PB.filter((s) => s.side === "SELL");
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()], R = t.reduce((a, b) => a + (b.R || 0), 0);
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length, R }; };
const cell = (s) => s ? String(s.n).padStart(5) + String(s.gr).padStart(5) + s.wrg.toFixed(1).padStart(8) + "%"
                        + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8) : "    —    —        —       —";
// 🔴🔥⭐⭐⭐ DEUX TABLES SEPAREES, SUR LE `z` **BRUT** (owner 11/08 : « c koi ? on peut pas faire buy
//   sell separes ? »). La premiere version affichait `u = z x sens` sous le titre « z » : cote SELL
//   la bande annoncee `+1,55 … +2,15` designait en realite un `z` entre `−2,15` et `−1,55`, prix
//   SOUS sa moyenne. **On annoncait un z et on montrait son oppose.**
//   ⭐⭐⭐ C'est la 5ᵉ fois que ce depot paie exactement ca — `_cas_barre` le documente sur le meme
//   capteur, mot pour mot : « un ecart de lecture entre l'operateur et la fiche coute plus cher
//   qu'une colonne en plus ; on croit debattre du modele alors qu'on ne regarde meme pas le meme
//   nombre ». L'orientation est un OUTIL DE BAREME, pas un repere de lecture.
//   ⚠ CE QU'ON PERD EN SEPARANT, ET C'EST ASSUME : la colonne « ecart » disparait. Un ecart entre
//   deux tables brutes n'aurait aucun sens — la meme bande de `z` decrit deux figures OPPOSEES selon
//   le cote. Le test de miroir se fait en LISANT LES DEUX TABLES EN SYMETRIE (bande `+x` du BUY
//   contre bande `−x` du SELL), pas en soustrayant deux nombres.
const bloc = (titre, POP, bandes, extra) => {
  console.log(`\n  ── ${titre} ──`);
  console.log("  bande z (brute)   tirs grap  WR/grap       R");
  console.log("  " + "─".repeat(18) + "─".repeat(26));
  for (const [lo, hi, nom] of bandes) {
    const s = st(POP.filter((x) => x.zBrut >= lo && x.zBrut < hi && (!extra || extra(x))));
    console.log("  " + nom.padEnd(16) + (s ? cell(s) : "    —    —        —       —"));
  }
};

const sb = st(BUY), ss = st(SELL);
console.log(`\n═══ PB · WR PAR \`z\` H1 (CLOTURE, ORIENTE), PAR COTE ═══  [PB_ISOLE=1 · MIN_PB=${process.env.MIN_PB} · spread FACTURE]`);
console.log(`  ${PB.length} tirs · BUY ${sb.n} (${sb.gr} grap) · SELL ${ss.n} (${ss.gr} grap) · point mort 75,0 %`);
console.log(`  ⭐ le \`z\` N'EST PLUS dans le bareme depuis le 11/08 au soir — on lit ce qu'il dit ENCORE.\n`);

// ⚠ Les bornes de `zLevel`, symetrisees. `z` BRUT : negatif = prix SOUS sa moyenne.
const BANDES = [
  [-Infinity, -2.15, "z < −2,15"], [-2.15, -1.55, "−2,15 … −1,55"], [-1.55, -1.05, "−1,55 … −1,05"],
  [-1.05, -0.30, "−1,05 … −0,30"], [-0.30, +0.30, "−0,30 … +0,30"], [+0.30, +1.05, "+0,30 … +1,05"],
  [+1.05, +1.55, "+1,05 … +1,55"], [+1.55, +2.15, "+1,55 … +2,15"], [+2.15, Infinity, "z > +2,15"],
];
console.log("  ⭐ `z` BRUT : negatif = prix SOUS sa moyenne H1. Aucune orientation, aucun retournement.");
console.log("  ⚠ UN PB BUY cherche un prix REVENU VERS LE BAS, un PB SELL vers le HAUT — les deux");
console.log("     tables ne se lisent donc PAS dans le meme sens. Le miroir se teste en comparant la");
console.log("     bande `+x` de l'une a la bande `−x` de l'autre.");
bloc("① BUY  ·  z H1 CLOTURE, BRUT", BUY, BANDES);
bloc("① SELL ·  z H1 CLOTURE, BRUT", SELL, BANDES);

// ⭐⭐⭐ LA QUESTION QUI DECIDE : le `z` AJOUTE-T-IL, ou REDIT-IL le `gap` ? Une variable qui trie
//   SEULE mais dont le tri disparait A `gap` FIXE ne fait que repeter l'entree deja en place.
//   ⚠ On coupe le `gap` en DEUX (note ≥ 0 / < 0) et pas en douze : sur 6 500 tirs, croiser 12 lignes
//   x 9 bandes FABRIQUERAIT des sigma. Grossier et lisible plutot que fin et faux.
const GROS = [[-Infinity, -1.55, "z < −1,55"], [-1.55, -0.30, "−1,55 … −0,30"],
              [-0.30, +0.30, "−0,30 … +0,30"], [+0.30, +1.55, "+0,30 … +1,55"], [+1.55, Infinity, "z > +1,55"]];
console.log("\n\n  ══ ② LE `z` AJOUTE-T-IL, OU REDIT-IL LE `gap` ? (`z` DANS chaque moitie de note gap) ══");
for (const [cote, POP] of [["BUY", BUY], ["SELL", SELL]])
  for (const [lbl, fg] of [["note gap ≥ 0", (x) => Number.isFinite(x.gap) && x.gap >= 0],
                           ["note gap < 0", (x) => Number.isFinite(x.gap) && x.gap < 0]])
    bloc(`${cote}  ·  ${lbl}`, POP, GROS, fg);
console.log("\n  ⭐⭐⭐ SI LE TRI DISPARAIT DANS LES DEUX MOITIES, le `z` ne fait que redire le `gap` et");
console.log("     son retrait ne coute rien. S'il SURVIT, il porte une information que `gapAtr` n'a pas.");
console.log("  ⚠⚠ CECI EST UNE TRANCHE D'UN SEUL RUN, PAS UN BALAYAGE : les tirs sont CONCURRENTS");
console.log("     (`maxOpen 30`). Aucun R lu ici ne survit tel quel a un re-run par seuil.\n");
