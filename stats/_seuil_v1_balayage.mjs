// _seuil_v1_balayage.mjs — QUE VAUT CHAQUE VALEUR DU SEUIL, MAINTENANT QUE LES TABLES ONT CHANGÉ ?
//   Owner 09/08 : « balaie le seuil ». Après trois corrections de tables (② refaite, ④ en 2D, ⑤
//   corrigée), la distribution du score a GLISSÉ VERS LE BAS — le volume est tombé de 1 788 à 752
//   tirs sans qu'aucun seuil n'ait bougé. Le point de fonctionnement doit être re-choisi.
//
// 🔴🔥🔥 UN SEUIL NE SE BALAIE **PAS** EN POST-TRAITEMENT, ET C'EST TOUT L'INTÉRÊT DE CE SCRIPT.
//   Filtrer `sc.exh >= s` sur un run unique donnerait une réponse FAUSSE : la capacité de prod
//   (`maxOpen`, `spacing`) réalloue. Une barre refusée LIBÈRE une place que prend une AUTRE barre,
//   qui n'existait pas dans le run de référence. ⇒ « les vetos ne soustraient pas, ils REMPLACENT »,
//   et un seuil non plus. Mesuré ce soir : le veto `place devant` retirait 38 tirs en isolation et
//   n'en a coûté que 27 au carnet, en changeant le R dans l'autre sens.
//   ⇒ **UN PROCESSUS ENFANT PAR SEUIL**, moteur rejoué en entier. `MIN_EXH` est lu par
//   `_envNum("MIN_EXH", SEUIL_V1)` au CHARGEMENT du module : un même processus ne peut pas en
//   essayer deux (Node cache les modules ES).
//
// ⚠ On imprime le WR PAR GRAPPE en premier — les tirs ne sont pas indépendants. Et le nombre de
//   grappes SOUS LE POINT MORT, qui dit si le gain vient d'un tri ou d'une poignée de journées.
// ⚠ `tirs/actif/jour` est rappelé à côté : la cible owner est **5-10**, et c'est une contrainte
//   d'exploitation, pas une métrique de qualité. Un seuil qui maximise le R/tir en tirant deux fois
//   par semaine ne répond pas à la question posée.
//
//   usage : node stats/_seuil_v1_balayage.mjs   ·   SEUILS=0,5,10,15 node …
import { execFileSync } from "node:child_process";
import path from "node:path";

const SEUILS = String(process.env.SEUILS ?? "0,3,5,8,10,13").split(",").map(Number);
// ⚠ `file://` OBLIGATOIRE : sur Windows un chemin absolu (`C:/...`) est refusé par le chargeur ESM,
//   qui y lit un protocole `c:`. Le script parent, lui, s'en tire avec des imports relatifs — d'où
//   un piège qui n'apparaît QUE dans l'enfant.
const ICI = path.resolve(import.meta.dirname);
const url = (p) => "file:///" + path.resolve(ICI, p).replace(/\\/g, "/");

// ⭐ L'ENFANT EST ÉCRIT ICI, PAS DANS UN FICHIER À CÔTÉ : il doit rester rigoureusement identique
//   d'un seuil à l'autre, et un second fichier finirait par diverger de celui-ci.
const ENFANT = `
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from ${JSON.stringify(url("_episodes.mjs"))};
process.env.NO_TRIO = "1";
const { runMatrixBacktest } = await import(${JSON.stringify(url("../src/components/simulations/matrixBacktest.mjs"))});
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const T = all.filter((s) => s.strategy === "EXH" && (s.outcome === "WIN" || s.outcome === "LOSS"));
const EP = dedupeEpisodes(all.filter((s) => s.strategy === "EXH")).filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");
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
  return { tirs: t.length, wr: t.length ? 100 * t.filter((x) => x.outcome === "WIN").length / t.length : NaN,
           R: t.reduce((a, b) => a + (b.R || 0), 0), gr: g.n, wrg: g.wr, bas: g.bas }; };
// ⭐ La QUEUE d'exposition, pas la moyenne : c'est elle que la cible owner 5-10 vise.
const parJour = new Map();
for (const s of T) { const k = s.asset + "|" + jour(s); parJour.set(k, (parJour.get(k) ?? 0) + 1); }
const q = [...parJour.values()].sort((a, b) => a - b);
const p90 = q.length ? q[Math.floor(0.9 * (q.length - 1))] : 0;
console.log(JSON.stringify({
  tous: bloc(T), buy: bloc(T.filter((s) => s.side === "BUY")), sell: bloc(T.filter((s) => s.side === "SELL")),
  ep: EP.length, parJour: q.length ? q.reduce((a, b) => a + b, 0) / q.length : 0, p90, maxJour: q.length ? q[q.length - 1] : 0,
}));
`;

const L = (o, n) => String(o).padStart(n);
console.log(`\n═══ BALAYAGE DE \`SEUIL_V1\` (via \`MIN_EXH\`) · pop PROD · spread FACTURÉ · NO_TRIO · point mort 75,0 % ═══`);
console.log(`    ⚠ un processus par seuil — la capacité RÉALLOUE, un filtre post-hoc mentirait\n`);
console.log(`  seuil │ tirs  ép  │ BUY  tirs  WR/gr   R    <BE │ SELL tirs  WR/gr   R    <BE │ R/tir  tirs/a/j  p90  max`);
for (const s of SEUILS) {
  let out;
  try {
    out = execFileSync(process.execPath, ["--input-type=module", "-e", ENFANT],
      { env: { ...process.env, MIN_EXH: String(s) }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    // ⚠ L'ERREUR DE L'ENFANT DOIT REMONTER EN ENTIER. Un `stdio: "ignore"` sur stderr rendait le
    //   diagnostic impossible : on lisait « Command failed » sans savoir POURQUOI, six fois.
    console.log(`  ${L(s, 5)} │ ERREUR`);
    console.log(String(e.stderr ?? e.message).split("\n").slice(0, 8).map((x) => "        " + x).join("\n"));
    continue;
  }
  const j = JSON.parse(out.trim().split("\n").filter((x) => x.startsWith("{")).pop());
  const rt = j.tous.tirs ? j.tous.R / j.tous.tirs : NaN;
  console.log(`  ${L(s, 5)} │ ${L(j.tous.tirs, 4)} ${L(j.ep, 4)} │ ` +
    `${L(j.buy.tirs, 9)} ${L(j.buy.wrg.toFixed(1), 6)} ${L(j.buy.R.toFixed(0), 5)} ${L(j.buy.bas, 4)} │ ` +
    `${L(j.sell.tirs, 9)} ${L(j.sell.wrg.toFixed(1), 6)} ${L(j.sell.R.toFixed(0), 5)} ${L(j.sell.bas, 4)} │ ` +
    `${L(rt.toFixed(3), 6)} ${L(j.parJour.toFixed(1), 8)} ${L(j.p90, 4)} ${L(j.maxJour, 4)}`);
}
console.log(`\n  ⚠ `+"`tirs/a/j` = MOYENNE par grappe actif×jour ; `p90`/`max` disent la QUEUE — c'est elle qui fait mal.");
