// _deadband_whichadx.mjs — QUEL champ du signal est l'ADX que lit la porte ?
// La porte teste `gate.adx.adxClose` ∈ [40,50). Le champ `adx` du signal ne colle pas (158/1624).
// On cherche empiriquement : pour la cohorte `adx-deadband`, le bon champ doit être DANS la bande
// sur ~100 % des trades. Diagnostic avant toute décomposition — décomposer sur le mauvais capteur
// produirait une table entière qui ne veut rien dire.
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();

const db = [], temoin = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of j.signals || []) {
    if (typeof s.R !== "number" || s.type === "EXHAUSTION") continue;
    (s.exhRef?.by === "adx-deadband" ? db : temoin).push(s);
  }
}
console.log(`cohorte adx-deadband : ${db.length} trades · témoin (reste CONT) : ${temoin.length}\n`);

// tous les champs numériques du signal dont le nom évoque l'ADX ou les DI
const champs = [...new Set(db.flatMap((s) => Object.keys(s)))]
  .filter((k) => /adx|Adx|di|Di/.test(k) && db.some((s) => Number.isFinite(s[k])));

console.log(`champ                  dans [40,50) ?   médiane   min → max`);
for (const k of champs) {
  const v = db.map((s) => s[k]).filter(Number.isFinite);
  if (!v.length) continue;
  const dans = v.filter((x) => x >= 40 && x < 50).length / v.length * 100;
  const tri = [...v].sort((a, b) => a - b);
  console.log(`${k.padEnd(22)} ${dans.toFixed(1).padStart(6)} %   `
    + `${tri[Math.floor(tri.length / 2)].toFixed(1).padStart(7)}   `
    + `${tri[0].toFixed(1)} → ${tri[tri.length - 1].toFixed(1)}`
    + `${dans > 95 ? "   ⭐ C'EST LUI" : ""}`);
}

// contrôle en miroir : sur le témoin, le bon champ doit être HORS bande presque partout
console.log(`\ncontrôle miroir — part dans [40,50) sur le RESTE de la CONT (doit être faible) :`);
for (const k of champs) {
  const v = temoin.map((s) => s[k]).filter(Number.isFinite);
  if (!v.length) continue;
  const dans = v.filter((x) => x >= 40 && x < 50).length / v.length * 100;
  console.log(`${k.padEnd(22)} ${dans.toFixed(1).padStart(6)} %`);
}
