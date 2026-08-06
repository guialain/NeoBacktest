// _diff_ep.mjs — LA COHORTE QUI DIFFERE entre deux configurations, jugee sur SON PROPRE WR.
//   usage : node stats/_diff_ep.mjs base.json variante.json
// ⭐⭐ POURQUOI CE SCRIPT EXISTE : un ecart d'agregat de 0,07 pt sur 3 100 episodes vaut 0,1 σ — il
//   ne dit rien. Mais si la variante n'ajoute que 12 episodes, ces 12-la ont une taille d'effet
//   LISIBLE. On juge la regle sur ce qu'elle DEPLACE, pas sur ce qu'elle laisse en place.
// ⚠ Le point mort est a ~75 % (spread facture) : une cohorte AJOUTEE au-dessus est un gain, en
//   dessous une perte. Hors spread le point mort descend, mais le R total dit la meme chose.
import { readFileSync } from "node:fs";

const [fa, fb] = process.argv.slice(2);
const A = JSON.parse(readFileSync(fa, "utf8"));
const B = JSON.parse(readFileSync(fb, "utf8"));
const mA = new Map(A.map((e) => [e.k, e])), mB = new Map(B.map((e) => [e.k, e]));

const only = (src, other) => [...src.values()].filter((e) => !other.has(e.k));
const retires = only(mA, mB);        // presents dans la base, absents de la variante
const ajoutes = only(mB, mA);        // presents dans la variante seulement

const stat = (t) => {
  const w = t.filter((x) => x.outcome === "WIN").length;
  const l = t.filter((x) => x.outcome === "LOSS").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const n = w + l, p = n ? w / n : NaN;
  const se = n ? Math.sqrt(p * (1 - p) / n) * 100 : NaN;
  return { n: t.length, w, l, wr: p * 100, R, rt: t.length ? R / t.length : NaN, se };
};
const show = (lbl, t) => {
  if (!t.length) { console.log(`${lbl} : AUCUN episode`); return; }
  const s = stat(t);
  console.log(`${lbl} : n=${s.n}  W=${s.w} L=${s.l}  WR ${s.wr.toFixed(1)} % (±${s.se.toFixed(1)})  ` +
              `R ${s.R >= 0 ? "+" : ""}${s.R.toFixed(1)}  R/ep ${s.rt.toFixed(3)}`);
  const par = {};
  for (const e of t) (par[e.strategy] ??= []).push(e);
  for (const [k, v] of Object.entries(par).sort()) {
    const q = stat(v);
    console.log(`     ${k.padEnd(5)} n=${String(q.n).padStart(3)}  W=${q.w} L=${q.l}  ` +
                `WR ${Number.isFinite(q.wr) ? q.wr.toFixed(1) + " %" : "—"}  R ${q.R >= 0 ? "+" : ""}${q.R.toFixed(1)}`);
  }
};

console.log(`base    ${fa} : ${A.length} episodes`);
console.log(`variante ${fb} : ${B.length} episodes\n`);
show("RETIRES par la variante", retires);
console.log();
show("AJOUTES par la variante", ajoutes);
console.log(`\ncommuns : ${A.length - retires.length} episodes (inchanges, ils ne peuvent pas expliquer un delta)`);
