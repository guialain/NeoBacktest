// WR par SCORE EXH — le score trie-t-il ? (owner 2026-08-02)
// ⚠ On lit la MONOTONIE, pas le niveau. Déciles = effectifs égaux, aucune case creuse.
// ⚠ CONTRÔLE RACCOURCIS : un tas d'observations sur une valeur ronde n'est pas un barème, c'est un
//   chemin qui court-circuite le barème. Il faut le sortir avant de conclure que le score trie.
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || []))
    if (s.type === "EXHAUSTION" && typeof s.R === "number" && Number.isFinite(Number(s.score)))
      all.push({ sc: Math.abs(Number(s.score)), R: s.R, out: s.outcome, cut: !!s.shortcut });
}
const wr = (t) => { const w = t.filter(x => x.out === "WIN").length, l = t.filter(x => x.out === "LOSS").length; return (w + l) ? w / (w + l) * 100 : NaN; };
const rt = (t) => t.reduce((a, b) => a + b.R, 0) / t.length;
const se = (t) => { const p = wr(t) / 100; return t.length ? Math.sqrt(p * (1 - p) / t.length) * 100 : NaN; };

const cut = all.filter(x => x.cut), sc100 = all.filter(x => x.sc === 100);
console.log(`EXH n=${all.length} · WR ${wr(all).toFixed(2)}%`);
console.log(`raccourcis : n=${cut.length}  WR ${wr(cut).toFixed(2)}%  R/tr ${rt(cut).toFixed(4)}`);
console.log(`score = 100 pile : n=${sc100.length}  dont raccourcis ${sc100.filter(x=>x.cut).length}\n`);

const deciles = (t, nom) => {
  t = [...t].sort((a, b) => a.sc - b.sc);
  console.log(`=== ${nom} (n=${t.length}) ===`);
  console.log(`${"décile".padEnd(8)}${"plage".padStart(14)}${"n".padStart(7)}${"WR".padStart(9)}${"±ET".padStart(7)}${"R/tr".padStart(9)}`);
  for (let d = 0; d < 10; d++) {
    const g = t.slice(Math.floor(t.length * d / 10), Math.floor(t.length * (d + 1) / 10));
    console.log(`D${String(d + 1).padEnd(7)}${(g[0].sc + "–" + g[g.length-1].sc).padStart(14)}${String(g.length).padStart(7)}`
      + `${wr(g).toFixed(2).padStart(8)}%${se(g).toFixed(2).padStart(7)}${rt(g).toFixed(4).padStart(9)}`);
  }
  const T = [t.slice(0, Math.floor(t.length*.4)), t.slice(Math.floor(t.length*.4), Math.floor(t.length*.8)), t.slice(Math.floor(t.length*.8))];
  console.log(`  ⇒ bas 40 % ${wr(T[0]).toFixed(2)}% (R/tr ${rt(T[0]).toFixed(4)})  |  milieu 40 % ${wr(T[1]).toFixed(2)}% (${rt(T[1]).toFixed(4)})  |  haut 20 % ${wr(T[2]).toFixed(2)}% (${rt(T[2]).toFixed(4)})`);
  const d1 = wr(T[0]) - wr(T[2]), s1 = Math.sqrt(se(T[0])**2 + se(T[2])**2);
  console.log(`  ⇒ écart haut−bas ${(-d1).toFixed(2)} pt pour ±${s1.toFixed(2)} d'erreur-type  →  ${Math.abs(d1/s1).toFixed(1)} ET\n`);
};
deciles(all, "TOUS LES FADES");
deciles(all.filter(x => !x.cut), "HORS RACCOURCIS");
