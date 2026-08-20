// _vetos_ce_quils_coutent.mjs — CE QUE CHAQUE VETO DU RANG ① **COUTE**, pas ce qu'il evite.
// ============================================================================================
// 🎯 LA QUESTION (owner, 20/08) : « sauver aussi les BONS trades que les vetos bloquent en ce
//   moment ». Un veto se juge d'habitude sur ce qu'il EVITE ; ici on lit l'autre moitie — ce qu'il
//   REFUSE alors que ca aurait gagne.
//
// ⭐ POPULATION : `ghostAllExh` — toutes les barres ou la these de fade a un avis (`exh ≠ 0`),
//   tirees ou non. C'est la BONNE population pour juger un veto du rang ① : hors d'elle, le veto
//   n'a rien a bloquer. Le cote vient du SIGNE du score, pas d'un choix de la sonde.
// ⚠⚠ LE `R` D'UNE BARRE VETOEE EST CE QU'ELLE AURAIT FAIT SI ON L'AVAIT PRISE — a capacite infinie,
//   sans spacing, sans concurrence. Retirer un veto en vrai ne rendrait PAS ce R : les tirs se
//   remplacent. ⇒ ce tableau CLASSE les vetos par cout potentiel, il ne chiffre pas un gain.
// ⚠⚠ RAFALES : une figure vraie 30 minutes compte 30 fois en lignes. On rend donc les EPISODES et
//   les GRAPPES a cote. Un veto dont le cout est concentre sur 2 grappes n'est pas un veto cher,
//   c'est un veto qui a eu tort DEUX FOIS.
// ⭐ `R net` : somme des R de ce qui est bloque. POSITIF = le veto bloque du GAGNANT (il coute).
//   NEGATIF = il bloque du perdant (il rapporte). C'est la colonne qui repond a la question.
// ⚙ Usage : `node stats/_vetos_ce_quils_coutent.mjs`  ·  `NMIN=20`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes } from "./_episodes.mjs";

const _num = (k, def) => { const r = process.env[k]; if (r === undefined || String(r).trim() === "") return def;
  const v = Number(r); return Number.isFinite(v) ? v : def; };
const NMIN = _num("NMIN", 20);
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";

const E = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllExh: true, chargeSpread: true });
  for (const c of (p.ghosts ?? []).filter((x) => x.ghost === "exh-all")) {
    const r = p.walk(c);
    if (r && typeof r.R === "number") E.push({ ...c, asset, R: r.R, outcome: r.outcome });
  }
}
const BE = 75;
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => (v.n ? 100 * v.g / v.n : NaN);
const jour = (x) => `${x.asset}|${String(x.tsMT ?? "").slice(0, 10)}`;
const grappes = (a) => new Set(a.map(jour)).size;
const eps = (a) => agg(dedupeEpisodes(a.map((x) => ({ ...x }))));

// 🔴🔥⭐⭐⭐ ON LIT `vetoedBySide[cote du fantome]`, PAS `vetoed` (corrige le 20/08).
//   `scoringDecision` empile les vetos des DEUX cotes ; un seul est admis au rang ① (`−regDir`).
//   Un veto qui touche le cote NON retenu n'a RIEN bloque. La 1re version de cette sonde aplatissait
//   les deux et pretait 1 577 barres exclusives a `exh-gap-no-room-ahead` — dont 992 au-dessus de
//   `MIN_EXH`. PREUVE QUE C'ETAIT FAUX : `VETO_GAP_AHEAD=off` rend un carnet IDENTIQUE AU BIT PRES.
//   ⭐⭐ « seul veto sur la barre » ne voulait meme pas dire « veto sur le bon cote ».
const vetosDe = (x) => ((x.vetoedBySide ?? {})[x.side] ?? []);
const tous = E, bloques = E.filter((x) => vetosDe(x).length), tires = E.filter((x) => x.fired);
console.log(`\n══ CE QUE CHAQUE VETO BLOQUE — population « la these de fade a un avis » ══`);
console.log(`   ${tous.length} barres scorees · ${tires.length} ont tire · ${bloques.length} portent au moins un veto`);
console.log(`   ⚠ le R d'une barre bloquee est ce qu'elle AURAIT fait, a capacite infinie. Les tirs se`);
console.log(`     remplacent : ce tableau CLASSE les vetos, il ne chiffre pas un gain recuperable.`);
console.log(`   ⚠ point mort ${BE},00 % — au-dessus, le veto bloque de l'ARGENT.`);

const ids = new Map();
for (const x of bloques) for (const id of new Set(vetosDe(x))) (ids.get(id) ?? ids.set(id, []).get(id)).push(x);
const lignes = [...ids.entries()].map(([id, a]) => ({ id, a, v: agg(a), e: eps(a), g: grappes(a) }))
  .filter((r) => r.v.n >= NMIN).sort((x, y) => y.v.R - x.v.R);

console.log(`\n   ${ids.size} vetos distincts · ${lignes.length} avec ≥ ${NMIN} barres`);
console.log(`\n   ${"veto".padEnd(36)}${"barres".padStart(7)}${"WR".padStart(9)}${"R net".padStart(9)}${"R/barre".padStart(9)}   ${"episodes".padStart(16)}${"grappes".padStart(9)}`);
console.log(`   ── CEUX QUI BLOQUENT DU GAGNANT (R net POSITIF = ils coutent) ──`);
for (const r of lignes.filter((x) => x.v.R > 0))
  console.log(`   ${r.id.padEnd(36)}${String(r.v.n).padStart(7)}${wr(r.v).toFixed(2).padStart(8)} %${r.v.R.toFixed(1).padStart(9)}${(r.v.R / r.v.n).toFixed(4).padStart(9)}   ${`${r.e.n} / ${wr(r.e).toFixed(1)} % / ${r.e.R.toFixed(1)} R`.padStart(16)}${String(r.g).padStart(9)}`);
console.log(`   ── CEUX QUI BLOQUENT DU PERDANT (R net NEGATIF = ils rapportent) ──`);
for (const r of lignes.filter((x) => x.v.R <= 0))
  console.log(`   ${r.id.padEnd(36)}${String(r.v.n).padStart(7)}${wr(r.v).toFixed(2).padStart(8)} %${r.v.R.toFixed(1).padStart(9)}${(r.v.R / r.v.n).toFixed(4).padStart(9)}   ${`${r.e.n} / ${wr(r.e).toFixed(1)} % / ${r.e.R.toFixed(1)} R`.padStart(16)}${String(r.g).padStart(9)}`);

// ⭐⭐⭐ LE VETO SEUL — la part qu'AUCUN autre veto ne bloque. C'est la SEULE part qu'on
//   recupererait en le retirant : si un autre veto couvre les memes barres, le retirer ne rend rien.
console.log(`\n   ── LA PART **EXCLUSIVE** DE CHAQUE VETO (aucun autre veto sur la barre) ──`);
console.log(`   ${"veto".padEnd(36)}${"exclusif".padStart(9)}${"WR".padStart(9)}${"R net".padStart(9)}${"grappes".padStart(9)}`);
for (const r of lignes) {
  // ⚠ « exclusif » = SEUL veto DU COTE ADMIS. Et meme ca ne suffit pas a dire « liberable » : la
  //   barre peut etre sous `MIN_EXH`, perdre au routeur, ou etre mangee par le spacing. La seule
  //   preuve d'un gain recuperable reste le carnet RE-COURU avec le levier `off`.
  const seul = r.a.filter((x) => new Set(vetosDe(x)).size === 1);
  if (!seul.length) { console.log(`   ${r.id.padEnd(36)}${"0".padStart(9)}`); continue; }
  const v = agg(seul);
  console.log(`   ${r.id.padEnd(36)}${String(v.n).padStart(9)}${wr(v).toFixed(2).padStart(8)} %${v.R.toFixed(1).padStart(9)}${String(grappes(seul)).padStart(9)}`);
}
console.log("");
