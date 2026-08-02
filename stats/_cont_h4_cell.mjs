// CONT : zone H4 extrême × ΔK FLAT × cycle CONVERGING × gap K/D LOW. (owner 2026-08-02)
// ⚠ ENTONNOIR : on ajoute UNE condition à la fois. Une case finale à 15 trades ne se lit pas — ce
//   qu'on veut voir, c'est À QUELLE ÉTAPE l'effectif meurt et laquelle des conditions porte l'effet.
// ⚠ Gap H4 = `kH4 − dH4` (SIGNÉ, live) passé à `kdDistanceBand` — qui bande sur |K−D|, le SENS étant
//   déjà porté par la zone. Bandes owner [2,1 · 7 · 14 · 18] : CONTACT/LOW/MEDIUM/HIGH/EXTREME.
// ⚠ CÔTÉS SÉPARÉS et ÉPISODES comptés (fenêtre 4 h = 240 min, `openEp` est en MINUTES).
import { kdDistanceBand } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const cont = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) {
    if (s.type === "EXHAUSTION" || typeof s.R !== "number") continue;
    const g = (Number.isFinite(s.kH4) && Number.isFinite(s.dH4)) ? s.kH4 - s.dH4 : null;
    cont.push({ a, side: s.side, R: s.R, out: s.outcome, ep: Number(s.openEp) || 0,
                z: s.zoneH4, dk: s.dKBandH4, cy: s.kdCycleH4, gb: kdDistanceBand(g) });
  }
}
const wr = (t) => { const w = t.filter((x) => x.out === "WIN").length, l = t.filter((x) => x.out === "LOSS").length; return (w + l) ? w / (w + l) * 100 : NaN; };
const rt = (t) => t.reduce((a, b) => a + b.R, 0) / t.length;
const se = (t) => { const p = wr(t) / 100; return t.length ? Math.sqrt(p * (1 - p) / t.length) * 100 : NaN; };
const eps = (t) => { const par = {}; for (const x of t) (par[x.a] ??= []).push(x.ep);
  let n = 0; for (const v of Object.values(par)) { v.sort((p, q) => p - q); let last = -1e18;
    for (const e of v) { if (e - last > 240) n++; last = e; } } return n; };
const L = (lab, t) => { const E = eps(t);
  console.log(`${lab.padEnd(48)}${String(t.length).padStart(6)}${String(E).padStart(7)}`
  + (t.length ? `${wr(t).toFixed(2).padStart(9)}%${se(t).toFixed(2).padStart(7)}${(wr(t) - 75).toFixed(2).padStart(8)}${rt(t).toFixed(4).padStart(9)}` : "")
  + (E && E < 20 ? "   ⚠ <20 épis." : "")); };

console.log(`${"".padEnd(48)}${"n".padStart(6)}${"épis.".padStart(7)}${"WR".padStart(10)}${"±ET".padStart(7)}${"marge".padStart(8)}${"R/tr".padStart(9)}`);
L("TOUTES LES CONT", cont);
console.log(`\n── ENTONNOIR, une condition à la fois ──`);
let t = cont;
t = t.filter((x) => x.z === "EXTREME_HAUTE");           L("+ zoneH4 = EXTREME_HAUTE", t);
const tA = t.filter((x) => x.dk === "FLAT");            L("  + ΔK H4 = FLAT", tA);
const tB = tA.filter((x) => x.cy === "CONVERGING");     L("    + cycle H4 = CONVERGING", tB);
const tC = tB.filter((x) => x.gb === "LOW");            L("      + gap K/D = LOW", tC);

console.log(`\n── ORDRE INVERSE : la même case, la conjonction la plus forte d'abord ──`);
let u = cont.filter((x) => x.z === "EXTREME_HAUTE" && x.cy === "CONVERGING"); L("EXTREME_HAUTE × CONVERGING", u);
L("  + gap K/D = LOW", u.filter((x) => x.gb === "LOW"));
L("  + ΔK FLAT", u.filter((x) => x.dk === "FLAT"));

console.log(`\n── le gap K/D seul, sur toutes les CONT ──`);
for (const b of ["CONTACT", "LOW", "MEDIUM", "HIGH", "EXTREME"]) L(b, cont.filter((x) => x.gb === b));
console.log(`\n── zoneH4 EXTREME_HAUTE × gap K/D ──`);
const eh = cont.filter((x) => x.z === "EXTREME_HAUTE");
for (const b of ["CONTACT", "LOW", "MEDIUM", "HIGH", "EXTREME"]) L(b, eh.filter((x) => x.gb === b));
