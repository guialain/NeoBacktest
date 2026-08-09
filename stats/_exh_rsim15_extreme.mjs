// _exh_rsim15_extreme.mjs — WR du fade quand le RSI M15 est à l'extrême que le trade CONTRARIE.
//   Owner 09/08 : « wr pour rsim15 > 72 exh sell et < 28 exh buy » — c'est un seuil MIROIR, donc
//   une seule condition ORIENTÉE : `rsiM15 orienté > 72` (SELL : `rsi` · BUY : `100 − rsi`).
//
// ⚠ `72 / 28` N'EST PAS UNE BORNE DE CE CAPTEUR. La table `RSIM15_V1_*` coupe à 15/25/40/60/75/85,
//   et `rsiZone` à 20/30. `[28 · 72]` est la borne des VETOS CONT d'extrême, posée sur le RSI **M5**.
//   Ce n'est pas une objection — un seuil dicté n'a pas à s'adosser à un vocabulaire existant — mais
//   il faut le SAVOIR : ce seuil-ci ne se périmera pas avec les bandes du barème, il vit seul.
//
// 🔴 CLÔTURÉ **ET** LIVE, imprimés côte à côte. La convention du dépôt dit que la forme nue est la
//   CLÔTURE, donc « rsim15 » = `rsi_m15`. Mais l'entrée ⑥ du barème lit le LIVE (`rsi_m15_s0`).
//   Si les deux colonnes divergent, c'est que le barème note une valeur qui n'est pas celle qui
//   décrit la barre — et c'est cette divergence-là qui est l'information, pas le choix de l'une.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const SEUIL = Number(process.env.RSIM15_SEUIL ?? 72);
const SOCLE = String(process.env.SOCLE ?? "0") === "1";
if (SOCLE) process.env.TOUT_ADMETTRE = "1";
const OPTS = SOCLE ? { spacing: false, maxOpen: 100000, cadenceMin: 2, chargeSpread: true }
                   : { maxOpen: 30, cadenceMin: 2, chargeSpread: true };

let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), OPTS);
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const EXH = all.filter((s) => s.strategy === "EXH" && (s.outcome === "WIN" || s.outcome === "LOSS"));

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function grappes(t) {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { g: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN,
           bas: v.filter((o) => o.w / o.n < 0.75).length };
}
const BE = 75;
function line(lbl, t, ind = "  ") {
  if (!t.length) { console.log(ind + lbl.padEnd(30) + "—"); return; }
  const w = t.filter((x) => x.outcome === "WIN").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const wr = 100 * w / t.length, sig = (wr - BE) / (Math.sqrt(0.75 * 0.25 / t.length) * 100);
  const gr = grappes(t), ep = dedupeEpisodes(t).length;
  console.log(ind + lbl.padEnd(30) +
    `tirs=${String(t.length).padStart(4)} (${String(ep).padStart(3)} ép)  WR ${wr.toFixed(1).padStart(5)} %  ` +
    `${(sig >= 0 ? "+" : "") + sig.toFixed(2)} σ${Math.abs(sig) >= 2 ? " ⭐" : "  "} ` +
    `R ${(R >= 0 ? "+" : "") + R.toFixed(1).padStart(6)}  ` +
    `| ${String(gr.g).padStart(3)} gr. ${gr.wr.toFixed(1).padStart(5)} % (${gr.bas} <75)`);
}

// ⭐ MIROIR STRUCTUREL : une seule condition, le côté en paramètre. `rsi > 72` cote SELL et
//   `rsi < 28` cote BUY sont LA MÊME phrase — « le M15 est au bout, du côté d'où le fade revient ».
const orient = (v, side) => (Number.isFinite(v) ? (side === "SELL" ? v : 100 - v) : null);

console.log(`${SOCLE ? "[SOCLE]" : "[POP PROD]"} [spread FACTURÉ] · seuil M15 orienté > ${SEUIL} ` +
  `(SELL rsi > ${SEUIL} · BUY rsi < ${100 - SEUIL}) · σ contre 75 %\n`);
line("EXH — TOUS", EXH);
line("  BUY", EXH.filter((s) => s.side === "BUY"));
line("  SELL", EXH.filter((s) => s.side === "SELL"));

for (const [nom, champ] of [["RSI M15 CLÔTURÉ (`rsi_m15`)", "rsiM15"],
                            ["RSI M15 LIVE (`rsi_m15_s0`, ce que le barème LIT)", "rsiM15Live"]]) {
  const dans = EXH.filter((s) => { const v = orient(s[champ], s.side); return v != null && v > SEUIL; });
  const hors = EXH.filter((s) => { const v = orient(s[champ], s.side); return v != null && v <= SEUIL; });
  const muet = EXH.length - dans.length - hors.length;
  console.log(`\n══ ${nom} ══`);
  line(`M15 orienté > ${SEUIL}`, dans);
  line("  dont SELL", dans.filter((s) => s.side === "SELL"), "    ");
  line("  dont BUY", dans.filter((s) => s.side === "BUY"), "    ");
  line("le RESTE", hors);
  line("  dont SELL", hors.filter((s) => s.side === "SELL"), "    ");
  line("  dont BUY", hors.filter((s) => s.side === "BUY"), "    ");
  if (muet) console.log(`  ⚠ ${muet} tir(s) sans \`${champ}\` — EXCLUS, jamais comptés 0`);
}
