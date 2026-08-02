// La CONT est-elle toxique quand le fade "se forme" ? Et JUSQU'OÙ ? (owner 2026-08-02)
//
// 🔴 POURQUOI. `wait-exh` supprime le candidat CONT dès que le score EXH est NON NUL mais sous
//   `SCORE_MIN_EXH` (`kind: "unripe"`). La zone de suppression est donc `]0 · SCORE_MIN_EXH[` — elle
//   s'élargit mécaniquement quand on relève le seuil, sans que personne ne l'ait décidé.
//   La mesure d'origine (31/07) ne couvrait que [0 · 0,5) et montrait une POCHE toxique sur
//   [0,1 · 0,3), pas une pente. On l'étend ici jusqu'à 2,0.
//
// ⚠ IL FAUT UN SEUIL BAS POUR MESURER : à 1,8 les CONT de la zone n'existent pas (supprimés).
//   Le serveur doit tourner avec `SCORE_MIN_EXH` bas — sinon on ne voit que ce qui a survécu.
//   Contrôle affiché : le `min` que le moteur rapporte dans `sc.min`.
// ⚠ ON LIT `sc.exh` = `sExhB` (score EXH bonus inclus), la QUANTITÉ QUE LE SEUIL COMPARE. Pas
//   `sc.exhRaw`, qui est d'avant bonus : ce n'est pas elle qui arme `wait-exh`.
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const cont = []; let mins = new Set();
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) {
    if (s.type === "EXHAUSTION" || typeof s.R !== "number") continue;
    if (s.sc?.min != null) mins.add(s.sc.min);
    const e = Number(s.sc?.exh);
    if (!Number.isFinite(e)) continue;
    cont.push({ e: Math.abs(e), R: s.R, out: s.outcome });
  }
}
const wr = (t) => { const w = t.filter((x) => x.out === "WIN").length, l = t.filter((x) => x.out === "LOSS").length; return (w + l) ? w / (w + l) * 100 : NaN; };
const rt = (t) => t.reduce((a, b) => a + b.R, 0) / t.length;
const se = (t) => { const p = wr(t) / 100; return t.length ? Math.sqrt(p * (1 - p) / t.length) * 100 : NaN; };

console.log(`SCORE_MIN_EXH rapporté par le moteur : ${[...mins].join(" / ")}   (doit être BAS)`);
console.log(`CONT avec score EXH lisible : ${cont.length}\n`);
const B = [0, 0.001, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 99];
console.log(`${"bande |score EXH|".padEnd(20)}${"n".padStart(7)}${"WR".padStart(9)}${"±ET".padStart(7)}${"marge".padStart(8)}${"R/tr".padStart(9)}`);
for (let i = 0; i < B.length - 1; i++) {
  const t = cont.filter((x) => x.e >= B[i] && x.e < B[i + 1]);
  if (!t.length) continue;
  const lab = i === 0 ? "= 0 (fade muet)" : `[${B[i]} · ${B[i + 1] === 99 ? "∞" : B[i + 1]})`;
  const flag = t.length < 150 ? "  (n<150)" : (wr(t) < 75 ? "   🔴 sous le point mort" : "");
  console.log(`${lab.padEnd(20)}${String(t.length).padStart(7)}${wr(t).toFixed(2).padStart(8)}%${se(t).toFixed(2).padStart(7)}`
    + `${(wr(t) - 75).toFixed(2).padStart(8)}${rt(t).toFixed(4).padStart(9)}${flag}`);
}
// ⭐ La question opérationnelle : que vaut la CONT DANS la zone actuellement supprimée ?
for (const seuil of [0.3, 0.8, 1.0, 1.8]) {
  const z = cont.filter((x) => x.e > 0 && x.e < seuil);
  if (z.length) console.log(`\nzone supprimée si seuil=${seuil} : n=${String(z.length).padStart(5)}  WR ${wr(z).toFixed(2)}%  marge ${(wr(z)-75).toFixed(2)}  R/tr ${rt(z).toFixed(4)}`);
}
