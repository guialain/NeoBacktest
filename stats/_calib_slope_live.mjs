// _calib_slope_live.mjs — REGÉNÈRE `SLOPE_CONFIG` SUR LA VARIABLE QUE LE MOTEUR LIRA.
//
// 🔴 POURQUOI. Le bloc en place (18/03) a été calibré sur les CLÔTURES H1 (~6043 barres). La pente
//   qu'un expert lit est `slope_h1_s0`, échantillonnée toutes les 2 min. Deux populations sous les
//   mêmes bornes : le P97 mesuré en live vaut 0,79× le seuil déclaré, donc `extreme` capterait ~6 %
//   des barres au lieu de 3 % — jusqu'à 2× trop sur BRENT_OIL, USDCHF, USDJPY, COCOA.
//   ⚠ MÊME DÉFAUT que l'ADX (bornes H1, porte M15) et que le tickflow (percentiles de ticks
//   individuels appliqués à une moyenne de 5). Troisième fois en une semaine : **un seuil se périme
//   avec son CAPTEUR, pas seulement avec le temps.**
//
// ⭐ ON NE CHANGE QU'UNE CHOSE : LA POPULATION. Même schéma de percentiles, mêmes 7 classes signées,
//   mêmes noms. Changer le découpage EN PLUS rendrait tout écart inattribuable.
//     flat = [P40, P60] · weak = jusqu'à P20/P80 · strong = jusqu'à P3/P97 · extreme au-delà
//
// ⚠ 19 ACTIFS, la whitelist entière. L'ancien bloc en couvrait 17 : COCOA, USDCAD et USDCHF
//   retombaient sur `default` — et USDCHF est justement celui qui s'en écarte le plus.
//   FRANCE_40 est retiré : plus tradé, plus de données, donc rien à calibrer.
// ⚠ `default` = distribution POOLÉE des 19, pas une moyenne de bornes : c'est le repli d'un actif
//   inconnu, il doit décrire un marché, pas une moyenne d'étalons.
// 🎯 REJOUER À CHAQUE REBUILD — calibrage d'ÉCHELLE, il se périme avec les données.
import fs from "fs";

const DIR = "data/matrix";
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null;
const r4 = (v) => Math.round(v * 10000) / 10000;

const parActif = {}; const pool = []; const jours = new Set();
for (const f of fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const sym = f.replace(/\.csv$/i, "");
  const L = fs.readFileSync(`${DIR}/${f}`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  if (I.slope_h1_s0 == null) { console.log(`${sym}: colonne slope_h1_s0 absente`); continue; }
  const v = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const d = new Date(c[I.ts_utc]); const js = d.getUTCDay();
    if (js === 0 || js === 6) continue;            // ⚠ week-end = flux gelé, pas du marché
    const s = num(c[I.slope_h1_s0]); if (s === null) continue;
    v.push(s); pool.push(s); jours.add(c[I.ts_utc].slice(0, 10));
  }
  v.sort((a, b) => a - b); parActif[sym] = v;
}
pool.sort((a, b) => a - b);

const bornes = (v) => ({ p3: q(v,.03), p20: q(v,.20), p40: q(v,.40), p60: q(v,.60), p80: q(v,.80), p97: q(v,.97) });
const bloc = (sym, v) => {
  const b = bornes(v);
  return `  ${(sym + ":").padEnd(13)}{\n`
    + `    flat:         { min: ${r4(b.p40).toFixed(4).padStart(9)}, max: ${r4(b.p60).toFixed(4).padStart(9)} },\n`
    + `    up_weak:      { min: ${r4(b.p60).toFixed(4).padStart(9)}, max: ${r4(b.p80).toFixed(4).padStart(9)} },\n`
    + `    up_strong:    { min: ${r4(b.p80).toFixed(4).padStart(9)}, max: ${r4(b.p97).toFixed(4).padStart(9)} },\n`
    + `    up_extreme:   { min: ${r4(b.p97).toFixed(4).padStart(9)}, max:  Infinity },\n`
    + `    down_weak:    { min: ${r4(b.p20).toFixed(4).padStart(9)}, max: ${r4(b.p40).toFixed(4).padStart(9)} },\n`
    + `    down_strong:  { min: ${r4(b.p3 ).toFixed(4).padStart(9)}, max: ${r4(b.p20).toFixed(4).padStart(9)} },\n`
    + `    down_extreme: { min: -Infinity, max: ${r4(b.p3).toFixed(4).padStart(9)} },\n  },`;
};

// ⚠ CONTRÔLE DE DÉGÉNÉRESCENCE — une bande dont les deux bornes se confondent est INATTEIGNABLE, et
//   elle le serait EN SILENCE (`getSlopeClass` rendrait 'unknown'). C'est ce qui était arrivé à la
//   bande LOW du tickflow de COCOA (p30 = 0). On refuse, on ne signale pas.
const mauvais = [];
const syms = Object.keys(parActif).sort();
for (const s of syms) {
  const b = bornes(parActif[s]); const o = [b.p3, b.p20, b.p40, b.p60, b.p80, b.p97];
  for (let i = 1; i < o.length; i++) if (!(o[i] > o[i - 1])) mauvais.push(`${s}: percentiles non strictement croissants (${o.map(x=>x.toFixed(3)).join(" < ")})`);
  if (parActif[s].length < 5000) mauvais.push(`${s}: n=${parActif[s].length} < 5000`);
}

const lj = [...jours].sort();
console.log(`Fenêtre ${lj[0]} → ${lj[lj.length-1]} · ${lj.length} jours ouvrés · ${pool.length} lignes · ${syms.length} actifs`);
console.log(`\n${"actif".padEnd(12)}${"n".padStart(8)}${"P3".padStart(9)}${"P20".padStart(8)}${"P40".padStart(8)}${"P60".padStart(8)}${"P80".padStart(8)}${"P97".padStart(8)}`);
for (const s of syms) { const b = bornes(parActif[s]);
  console.log(`${s.padEnd(12)}${String(parActif[s].length).padStart(8)}`
    + [b.p3,b.p20,b.p40,b.p60,b.p80,b.p97].map((x,i)=>x.toFixed(i===0?2:2).padStart(i===0?9:8)).join("")); }
const bp = bornes(pool);
console.log(`${"default".padEnd(12)}${String(pool.length).padStart(8)}`
  + [bp.p3,bp.p20,bp.p40,bp.p60,bp.p80,bp.p97].map((x,i)=>x.toFixed(2).padStart(i===0?9:8)).join(""));

if (mauvais.length) { console.log(`\n🔴 DÉGÉNÉRESCENCE — rien écrit :`); mauvais.forEach(m => console.log("   " + m)); process.exit(1); }

const out = [
  `// ⚠ GÉNÉRÉ — ne pas éditer à la main. Script : Neo-Backtest/stats/_calib_slope_live.mjs`,
  `// Calibré le 2026-08-02 sur \`slope_h1_s0\` (LIVE, échantillonné par ligne ≈ 2 min), ${lj.length} jours`,
  `// ouvrés (${lj[0]} → ${lj[lj.length-1]}), week-ends exclus, ${pool.length} lignes, ${syms.length} actifs.`,
  `// 🔴 LA POPULATION EST LE LIVE, PAS LA CLÔTURE — c'est la seule chose qui change par rapport au bloc`,
  `//    du 18/03 (mêmes 7 classes, même schéma P40/P60 · P20/P80 · P3/P97). Le précédent était calibré`,
  `//    sur ~6043 CLÔTURES H1 et son P97 valait 1,27× le P97 réel du live : \`extreme\` capturait ~6 %`,
  `//    des barres au lieu de 3 %, et jusqu'à 2× trop sur BRENT_OIL, USDCHF, USDJPY, COCOA.`,
  `// ⭐ 19 actifs — l'ancien bloc en couvrait 17 (COCOA, USDCAD, USDCHF retombaient sur \`default\`).`,
  `//    FRANCE_40 retiré : plus tradé, plus de données. Il retombe sur \`default\`, ce qui est correct.`,
  `// ⭐ \`default\` = distribution POOLÉE des 19, pas une moyenne de bornes : le repli d'un actif inconnu`,
  `//    doit décrire un marché, pas une moyenne d'étalons.`,
  `// 🎯 REJOUER À CHAQUE REBUILD.`,
  `export const SLOPE_CONFIG = {`,
  ...syms.map((s) => bloc(s, parActif[s])),
  bloc("default", pool),
  `};`,
].join("\n");
fs.writeFileSync("stats/slope_config.generated.js", out + "\n", "utf8");
console.log(`\nÉcrit : stats/slope_config.generated.js`);
