// CONT à RSI M5 élevé. (owner 2026-08-02)
// ⚠ `rsi_m5` N'EST PAS SUR LE SIGNAL : jointure par `signal.i` (index 0-based de la ligne de
//   données ⇒ ligne CSV = i + 1). Vérifié plus tôt sur trois signaux.
// ⚠ LES DEUX FORMES : `rsi_m5` = CLÔTURE M5 · `rsi_m5_s0` = LIVE intra-barre (convention `_s0`).
//   L'owner n'a pas précisé — on montre les deux, elles ne décrivent pas le même instant.
// ⚠ CÔTÉS SÉPARÉS : à RSI M5 > 75 une CONT BUY poursuit un suracheté court, une CONT SELL reprend
//   la tendance après un retracement — deux thèses opposées sous le même filtre.
// ⚠ ÉPISODES (fenêtre 4 h, `openEp` en MINUTES). Plancher de lecture ≈ 20 épisodes.
import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const assets = await (await fetch(`${API}/assets`)).json();
const cont = [];
for (const a of assets) {
  const p = `data/matrix/${a}.csv`; if (!fs.existsSync(p)) continue;
  const L = fs.readFileSync(p, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) {
    if (s.type === "EXHAUSTION" || typeof s.R !== "number" || !Number.isFinite(s.i)) continue;
    const c = (L[s.i + 1] || "").split(";"); if (c.length < h.length) continue;
    cont.push({ a, side: s.side, R: s.R, out: s.outcome, ep: Number(s.openEp) || 0,
                live: num(c[I.rsi_m5_s0]), close: num(c[I.rsi_m5]) });
  }
}
const wr = (t) => { const w = t.filter((x) => x.out === "WIN").length, l = t.filter((x) => x.out === "LOSS").length; return (w + l) ? w / (w + l) * 100 : NaN; };
const rt = (t) => t.reduce((a, b) => a + b.R, 0) / t.length;
const se = (t) => { const p = wr(t) / 100; return t.length ? Math.sqrt(p * (1 - p) / t.length) * 100 : NaN; };
const eps = (t) => { const par = {}; for (const x of t) (par[x.a] ??= []).push(x.ep);
  let n = 0; for (const v of Object.values(par)) { v.sort((p, q) => p - q); let last = -1e18;
    for (const e of v) { if (e - last > 240) n++; last = e; } } return n; };
const L2 = (lab, t) => { const E = eps(t);
  console.log(`${lab.padEnd(28)}${String(t.length).padStart(6)}${String(E).padStart(7)}`
  + (t.length ? `${wr(t).toFixed(2).padStart(9)}%${se(t).toFixed(2).padStart(7)}${(wr(t)-75).toFixed(2).padStart(8)}${rt(t).toFixed(4).padStart(9)}` : "        —")
  + (E && E < 20 ? "  ⚠<20 ép." : "")); };
console.log(`CONT appariées : ${cont.length}\n`);
console.log(`${"".padEnd(28)}${"n".padStart(6)}${"épis.".padStart(7)}${"WR".padStart(10)}${"±ET".padStart(7)}${"marge".padStart(8)}${"R/tr".padStart(9)}`);
L2("TOUTES LES CONT", cont);
for (const [k, nom] of [["live", "rsi_m5_s0 (LIVE)"], ["close", "rsi_m5 (CLÔTURE)"]]) {
  console.log(`\n════ ${nom} ════`);
  for (const s of [70, 72, 73, 75]) {
    const t = cont.filter((x) => Number.isFinite(x[k]) && x[k] > s);
    L2(`> ${s}`, t);
    if (t.length) { L2(`     └ BUY`, t.filter((x) => x.side === "BUY")); L2(`     └ SELL`, t.filter((x) => x.side === "SELL")); }
  }
  console.log(`  ── miroir ──`);
  for (const s of [30, 28, 27]) {
    const t = cont.filter((x) => Number.isFinite(x[k]) && x[k] < s);
    L2(`< ${s}`, t);
    if (t.length) { L2(`     └ BUY`, t.filter((x) => x.side === "BUY")); L2(`     └ SELL`, t.filter((x) => x.side === "SELL")); }
  }
  L2("  reste (25 ≤ rsi ≤ 75)", cont.filter((x) => Number.isFinite(x[k]) && x[k] >= 25 && x[k] <= 75));
}
