// _pb_seuil_balayage.mjs — QUE VAUT CHAQUE VALEUR DE `MIN_PB`, MAINTENANT QUE L'ÉCHELLE A CHANGÉ ?
//
// 🎯 PRÉREQUIS NOMMÉ : l'entrée ⑶ `RSI` a été ajoutée au barème ② le 12/08 ⇒ l'échelle passe de
//   `[−20 · +20]` à **`[−30 · +30]`**. `MIN_PB = 2` avait été posé par l'owner le 11/08 SUR L'ANCIENNE
//   ÉCHELLE : il ne désigne plus le même point de fonctionnement. Une entrée de plus à `±10` gonfle
//   `|total|`, donc le même `2` coupe RELATIVEMENT plus bas à comportement de marché identique.
//   ⇒ « on n'a pas resserré le tri 3 fois, on a RELEVÉ LE SEUIL 3 fois sans le dire », à l'envers.
//
// 🔴🔥🔥 UN SEUIL NE SE BALAIE **PAS** EN POST-TRAITEMENT. Filtrer `pConv >= s` sur un run unique
//   donnerait une réponse FAUSSE : la capacité (`maxOpen 30`, `MAX_POSITIONS_PER_SYMBOL 8`,
//   `PositionSpacing`) RÉALLOUE. Une barre PB refusée LIBÈRE une place que prend une AUTRE barre —
//   d'un autre actif, d'un autre rang, d'un autre jour. « Les vetos ne soustraient pas, ils
//   REMPLACENT », et un seuil non plus.
//   ⇒ **UN PROCESSUS ENFANT PAR SEUIL**, moteur rejoué en entier. `MIN_PB` est lu par
//   `_envNum("MIN_PB", 2)` au CHARGEMENT du module : un même processus ne peut pas en essayer deux
//   (Node cache les modules ES).
//
// ⭐⭐⭐ ON IMPRIME LE CARNET ENTIER À CÔTÉ DU RANG ②, ET C'EST LE CŒUR DE CETTE SONDE. Monter
//   `MIN_PB` ne fait pas que retirer des tirs PB : il rend des créneaux aux rangs ① et ③. Lire la
//   seule colonne PB ferait passer une RÉALLOCATION pour un GAIN — c'est exactement la faute
//   `capacite_les_tirs_sont_concurrents`. Le `R` du livre est la grandeur qui décide ; celui du PB
//   dit seulement d'où il vient.
//
// ⚠ WR **PAR GRAPPE** en premier — les tirs ne sont pas indépendants (σ ×9). `<BE` = nombre de
//   grappes sous le point mort de 75,0 % : il dit si un gain vient d'un TRI ou d'une poignée de
//   journées.
// ⚠ `tirs/a/j` est une contrainte d'EXPLOITATION (cible owner 5-10), pas une métrique de qualité —
//   et c'est la QUEUE (`p90`/`max`) qui fait mal, pas la moyenne.
// ⚠ `PB_ISOLE` N'EST PAS FORCÉ : on mesure le moteur COMPLET, cascade comprise. L'isoler
//   répondrait à une autre question (« que vaut le barème seul »), pas à « où poser le seuil ».
//
//   usage : node stats/_pb_seuil_balayage.mjs   ·   SEUILS=0,3,6 node stats/_pb_seuil_balayage.mjs
import { execFileSync } from "node:child_process";
import path from "node:path";

// ⭐ La plage part SOUS zéro : sans un point bas, on ne voit pas si la courbe MONTE ou si on est
//   déjà sur son flanc descendant. Le `2` actuel est dedans pour que l'avant/après se lise.
const SEUILS = String(process.env.SEUILS ?? "-3,0,2,3,5,7,10").split(",").map(Number);
// ⚠ `file://` OBLIGATOIRE : sur Windows un chemin absolu (`C:/...`) est refusé par le chargeur ESM,
//   qui y lit un protocole `c:`. Piège qui n'apparaît QUE dans l'enfant.
const ICI = path.resolve(import.meta.dirname);
const url = (p) => "file:///" + path.resolve(ICI, p).replace(/\\/g, "/");

// ⭐ L'ENFANT EST ÉCRIT ICI, PAS DANS UN FICHIER À CÔTÉ : il doit rester rigoureusement identique
//   d'un seuil à l'autre, et un second fichier finirait par diverger de celui-ci.
const ENFANT = `
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from ${JSON.stringify(url("_episodes.mjs"))};
process.env.NO_TRIGGER = "1";
const { runMatrixBacktest } = await import(${JSON.stringify(url("../src/components/simulations/matrixBacktest.mjs"))});
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const decide = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const PB = all.filter((s) => s.strategy === "PB" && decide(s));
const EP = dedupeEpisodes(all.filter((s) => s.strategy === "PB")).filter(decide);
const jour = (s) => String(s.tsMT || "").slice(0, 10);
const grappes = (t) => {
  const g = new Map();
  for (const s of t) { const k = s.asset + "|" + jour(s);
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN,
           bas: v.filter((o) => o.w / o.n < 0.75).length };
};
const bloc = (t) => { const g = grappes(t);
  return { tirs: t.length, R: t.reduce((a, b) => a + (b.R || 0), 0), gr: g.n, wrg: g.wr, bas: g.bas }; };
// ⭐ LE LIVRE ENTIER — c'est lui qui dit si un tir PB retiré a été REPRIS par un autre rang.
const LIVRE = all.filter(decide);
const parRang = {};
for (const r of ["EXH", "PB", "CONT"]) parRang[r] = bloc(LIVRE.filter((s) => s.strategy === r));
const parJour = new Map();
for (const s of PB) { const k = s.asset + "|" + jour(s); parJour.set(k, (parJour.get(k) ?? 0) + 1); }
const q = [...parJour.values()].sort((a, b) => a - b);
console.log(JSON.stringify({
  pb: bloc(PB), buy: bloc(PB.filter((s) => s.side === "BUY")), sell: bloc(PB.filter((s) => s.side === "SELL")),
  ep: EP.length, livre: bloc(LIVRE), parRang,
  parJour: q.length ? q.reduce((a, b) => a + b, 0) / q.length : 0,
  p90: q.length ? q[Math.floor(0.9 * (q.length - 1))] : 0, maxJour: q.length ? q[q.length - 1] : 0,
}));
`;

const L = (o, n) => String(o).padStart(n);
console.log(`\n═══ BALAYAGE DE \`MIN_PB\` · échelle \`[−30 · +30]\` (3 entrées depuis le 12/08) ═══`);
console.log(`    pop PROD · spread FACTURÉ · NO_TRIGGER · point mort 75,0 % · maxOpen 30`);
console.log(`    ⚠ un processus par seuil — la capacité RÉALLOUE, un filtre post-hoc mentirait\n`);
// ⚠ `<BE` EST IMPRIMÉ AVEC SON DÉNOMINATEUR (`28/94`), jamais nu : « 28 grappes sous le point mort »
//   ne veut rien dire sans le nombre de grappes, et un compte nu BAISSE mécaniquement quand le seuil
//   monte — on lirait une amélioration là où il n'y a qu'une population plus petite.
console.log(`  seuil │ PB tirs  ép │ BUY  WR/gr    R   <BE/gr │ SELL WR/gr    R   <BE/gr │ R/tir │ LIVRE tirs    R  │ EXH   CONT │ a/j  p90`);
for (const s of SEUILS) {
  let out;
  try {
    out = execFileSync(process.execPath, ["--input-type=module", "-e", ENFANT],
      { env: { ...process.env, MIN_PB: String(s) }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    // ⚠ L'ERREUR DE L'ENFANT DOIT REMONTER EN ENTIER — un `stdio: "ignore"` sur stderr rend le
    //   diagnostic impossible : on lit « Command failed » sans savoir POURQUOI.
    console.log(`  ${L(s, 5)} │ ERREUR`);
    console.log(String(e.stderr ?? e.message).split("\n").slice(0, 8).map((x) => "        " + x).join("\n"));
    continue;
  }
  const j = JSON.parse(out.trim().split("\n").filter((x) => x.startsWith("{")).pop());
  const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");
  const rt = j.pb.tirs ? j.pb.R / j.pb.tirs : NaN;
  const be = (b) => `${b.bas}/${b.gr}`;
  console.log(`  ${L(s, 5)} │ ${L(j.pb.tirs, 7)} ${L(j.ep, 4)} │ ` +
    `${L(f1(j.buy.wrg), 8)} ${L(j.buy.R.toFixed(0), 5)} ${L(be(j.buy), 7)} │ ` +
    `${L(f1(j.sell.wrg), 9)} ${L(j.sell.R.toFixed(0), 5)} ${L(be(j.sell), 7)} │ ` +
    `${L(Number.isFinite(rt) ? rt.toFixed(3) : "—", 6)} │ ` +
    `${L(j.livre.tirs, 10)} ${L(j.livre.R.toFixed(0), 5)} │ ` +
    `${L(j.parRang.EXH.R.toFixed(0), 5)} ${L(j.parRang.CONT.R.toFixed(0), 5)} │ ` +
    `${L(j.parJour.toFixed(1), 4)} ${L(j.p90, 4)}`);
}
console.log(`\n  ⚠ `+"`LIVRE` est la grandeur qui DÉCIDE — la colonne PB dit seulement d'où le R vient.");
console.log(`  ⚠ `+"`<BE` = grappes sous 75,0 % : un gain porté par 2 journées n'est pas un tri.");
