// _dump_ep.mjs — dump des EPISODES d'une configuration, pour comparer DEUX configurations sur la
//   COHORTE QUI DIFFERE et non sur l'agregat (methode du FANTOME).
// ⚠ Un ecart d'agregat de 0,1 σ ne dit RIEN ; la question est « que valent les N episodes que la
//   regle ajoute ou retire ? ». C'est la seule lecture qui a une taille d'effet lisible.
//   usage : CHARGE_SPREAD=false node stats/_dump_ep.mjs <fichier.json>
import { writeFileSync } from "node:fs";
import { dedupeEpisodes } from "./_episodes.mjs";

const SPREAD = String(process.env.CHARGE_SPREAD ?? "true") !== "false";
const OUT = process.argv[2];
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2&chargeSpread=${SPREAD}`)).json();
  for (const s of (j.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
// ⭐ CLE D'EPISODE : actif|cote|these|instant d'entree. C'est ce qui permet de dire « le meme
//   episode » d'une configuration a l'autre — sans elle on comparerait des populations, pas des cas.
const ep = dedupeEpisodes(all, (s) => s.asset).map((s) => ({
  k: `${s.asset}|${s.side}|${s.strategy}|${s.tsMT}`,
  asset: s.asset, side: s.side, strategy: s.strategy, tsMT: s.tsMT,
  R: s.R, outcome: s.outcome, score: s.score,
}));
writeFileSync(OUT, JSON.stringify(ep), "utf8");
console.log(`${OUT} : ${ep.length} episodes (spread ${SPREAD ? "FACTURE" : "HORS"})`);
