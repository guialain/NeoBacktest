// ============================================================================================
// cont_adx_tails.mjs — HYPOTHÈSE OWNER : « arrêter le CONT quand l'ADX est en EXTRÊME BAS ou
//   EXTRÊME HAUT **ET** qu'il a TOURNÉ ».
// --------------------------------------------------------------------------------------------
// POURQUOI SUR L'ADX BRUT ET PAS SUR `dominance` : les bandes du moteur (LOW <21 · MEDIUM 21–26,5
//   · HIGH 26,5–34 · EXTREME >34) découpent mal le bas. Les exemples owner (COCOA : 20,1 · 21,0 ·
//   22,8) tombent À CHEVAL sur LOW/MEDIUM — une grille par bande ne peut PAS voir la forme qu'il
//   décrit. ⭐ Mesurer sur la variable CONTINUE avant de conclure qu'une bande est en cause.
//
// CE QU'ON CHERCHE : une forme en U (les deux queues mauvaises, le milieu bon) QUAND l'ADX a tourné.
//   Si le U n'apparaît que d'un côté, l'hypothèse est à moitié vraie — et c'est utile de le savoir.
//
// TURNED = TURN_DOWN ou TURN_UP (l'ADX vient de PIVOTER). Comparé à STABLE (RISING/FALLING/FLAT).
//
// Usage : node --max-old-space-size=12288 stats/cont_adx_tails.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const mk = () => ({ n: 0, w: 0, l: 0, R: 0 });
const bump = (o, s) => { o.n++; o.R += s.R; if (s.outcome === "WIN") o.w++; else if (s.outcome === "LOSS") o.l++; };
// bornes ADX brut — resserrées dans le bas, où se trouvent les exemples owner
const EDGES = [0, 15, 18, 20, 22, 25, 30, 35, 45, 60, 999];
const lab = (a) => { for (let i = 0; i < EDGES.length - 1; i++) if (a < EDGES[i + 1]) return `${EDGES[i]}–${EDGES[i + 1]}`; return "60+"; };
const G = {};
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (typeof s.R !== "number" || s.type === "EXHAUSTION") continue;   // CONT seul
    if (!Number.isFinite(s.adx)) continue;
    const t = s.dominanceTurn;
    const grp = (t === "TURN_DOWN" || t === "TURN_UP") ? "TOURNÉ" : (t == null ? "(null)" : "STABLE");
    const k = `${lab(s.adx)}|${grp}`;
    G[k] = G[k] || mk(); bump(G[k], s);
  }
const f3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
const wr = (o) => (o.w + o.l) ? (o.w / (o.w + o.l) * 100).toFixed(0) + "%" : "—";
console.log("CONT — avgR / n / WR, par ADX H1 brut\n");
console.log("  ADX H1        TOURNÉ (TURN_UP|DOWN)        STABLE (RISING|FALLING|FLAT)");
for (let i = 0; i < EDGES.length - 1; i++) {
  const L = `${EDGES[i]}–${EDGES[i + 1]}`;
  const a = G[`${L}|TOURNÉ`], b = G[`${L}|STABLE`];
  if (!a && !b) continue;
  const c = (o) => o ? `${f3(o.R / o.n)} / ${String(o.n).padStart(4)} / ${wr(o).padStart(3)}` : "—".padStart(18);
  console.log(`  ${L.padEnd(10)}  ${c(a).padEnd(28)} ${c(b)}`);
}
// totaux des queues, pour chiffrer une porte
const sum = (pred) => Object.entries(G).reduce((acc, [k, o]) => { const [L, g] = k.split("|"); if (pred(L, g)) { acc.n += o.n; acc.R += o.R; } return acc; }, { n: 0, R: 0 });
const lowT = sum((L, g) => g === "TOURNÉ" && ["0–15", "15–18", "18–20", "20–22"].includes(L));
const hiT  = sum((L, g) => g === "TOURNÉ" && ["45–60", "60–999"].includes(L));
const hiT2 = sum((L, g) => g === "TOURNÉ" && ["35–45", "45–60", "60–999"].includes(L));
console.log(`\nqueue BASSE (<22) & TOURNÉ  : n=${lowT.n} · totalR ${lowT.R.toFixed(1)} · avgR ${(lowT.R / lowT.n).toFixed(3)}`);
console.log(`queue HAUTE (>45) & TOURNÉ  : n=${hiT.n} · totalR ${hiT.R.toFixed(1)} · avgR ${(hiT.R / hiT.n).toFixed(3)}`);
console.log(`queue HAUTE (>35) & TOURNÉ  : n=${hiT2.n} · totalR ${hiT2.R.toFixed(1)} · avgR ${(hiT2.R / hiT2.n).toFixed(3)}`);
