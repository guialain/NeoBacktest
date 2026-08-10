// _verif_veto_m15.mjs — VÉRIFICATION DU VETO `m15-rsi-approach-not-returning`, LES DEUX CÔTÉS.
//
// ⭐⭐⭐ TROIS CONTRÔLES, ET LE PREMIER EST LE SEUL QUI PROUVE QUELQUE CHOSE :
//   ① MIROIR EXÉCUTABLE — pour TOUT couple `(rsi, Δ)` balayé au dixième :
//        `when(SELL, rsi, Δ)` doit valoir `when(BUY, 100 − rsi, −Δ)`.
//      C'est LA propriété que le miroir revendique. Le fichier `vetoGate` la tient À LA MAIN
//      (deux inversions : la profondeur `100 − rsi` et la colonne `_UP`↔`_DOWN`) — donc elle est
//      PERDABLE, et une doctrine écrite en commentaire ne la tient pas. Ce contrôle la teste.
//   ② DOMAINE — les bornes réellement atteintes de chaque côté, en NOMBRES, pour que l'owner
//      relise la règle sans avoir à dérouler `rsiDeltaCol` de tête.
//   ③ MORSURE RÉELLE — combien de tirs/épisodes chaque côté retire dans le carnet, et ce qu'ils
//      valaient. Sans ça, un veto à la mauvaise adresse rend `0` des deux côtés et se lit
//      « symétrique ».
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const V = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/vetoGate.js");
const { rsiDeltaCol } =
  await import("../../Matrix-Revolution/src/components/robot/engines/scoring/experts/rsiExpert.js");

const REGLE = V.VETOES.find((r) => r.id === "m15-rsi-approach-not-returning");
if (!REGLE) { console.log("🔴 règle INTROUVABLE dans VETOES — id renommé ?"); process.exit(1); }
console.log(`règle trouvée : ${REGLE.id} · strategy ${REGLE.strategy} · tf ${REGLE.tf} · kind ${REGLE.kind}`);
console.log(`⚠ \`kind\` explicite = ${REGLE.kind === "structure" ? "structure ✅ (la barre PASSE LA MAIN)"
  : `${REGLE.kind} 🔴 — sur tf m15 la déduction donnerait \`timing\` ⇒ DROP, le PB ne verrait rien`}\n`);

// Une entrée `tfInputs`-like minimale : la règle ne lit que ces deux champs.
const t = (rsi, d) => ({ rsiClosed: rsi, dRsi: d });
const bloque = (side, rsi, d) => REGLE.when(t(rsi, d), side) === true;

// ══ ① LE MIROIR, EXÉCUTABLE ═══════════════════════════════════════════════════════════════════
{
  const bad = [];
  for (let rsi = 0; rsi <= 100; rsi += 0.1) {
    const r = +rsi.toFixed(1);
    for (let d = -8; d <= 8; d += 0.1) {
      const dd = +d.toFixed(1);
      const s = bloque("SELL", r, dd);
      const b = bloque("BUY", +(100 - r).toFixed(1), +(-dd).toFixed(1));
      if (s !== b) bad.push({ rsi: r, d: dd, sell: s, buyMiroir: b });
    }
  }
  console.log("══ ① MIROIR — `when(SELL, rsi, Δ)` == `when(BUY, 100−rsi, −Δ)` ══");
  console.log(`  balayage rsi 0→100 au dixième × Δ −8→+8 au dixième`);
  console.log(bad.length === 0 ? "  ✅ AUCUNE VIOLATION — le miroir tient sur tout le domaine"
    : `  🔴 ${bad.length} VIOLATION(S), 5 premières :\n` +
      bad.slice(0, 5).map((x) => `     ${JSON.stringify(x)}`).join("\n"));
}

// ══ ② LE DOMAINE RÉEL, EN NOMBRES ═════════════════════════════════════════════════════════════
function domaine(side) {
  const rsis = [], ds = [];
  for (let rsi = 0; rsi <= 100; rsi += 0.1) {
    const r = +rsi.toFixed(1);
    if (bloque(side, r, 0)) rsis.push(r);           // Δ = 0 ⇒ FLAT, donc la bande de rsi seule
  }
  for (let d = -10; d <= 10; d += 0.01) {
    const dd = +d.toFixed(2);
    const pivot = side === "SELL" ? 75 : 25;        // un rsi au milieu de la bande bloquée
    if (bloque(side, pivot, dd)) ds.push(dd);
  }
  return { rsi: [rsis[0], rsis[rsis.length - 1]], d: [ds[0], ds[ds.length - 1]] };
}
console.log("\n══ ② DOMAINE BLOQUÉ, CÔTÉ PAR CÔTÉ ══");
for (const side of ["SELL", "BUY"]) {
  const D = domaine(side);
  console.log(`  ${side.padEnd(5)} rsi_m15 CLÔTURÉ ∈ [${D.rsi[0]} · ${D.rsi[1]}]   ` +
    `ET  Δ M15 LIVE ∈ [${D.d[0]} · ${D.d[1]}]`);
  const cols = ["EXPLOSIVE_DOWN", "FAST_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"];
  const ex = { EXPLOSIVE_DOWN: -8, FAST_DOWN: -4, SOFT_DOWN: -2, FLAT: 0, SOFT_UP: 2, FAST_UP: 4, EXPLOSIVE_UP: 8 };
  const pivot = side === "SELL" ? 75 : 25;
  console.log("        colonnes BRUTES bloquées : " +
    cols.filter((c) => bloque(side, pivot, ex[c])).join(" · "));
  console.log("        hors bande (rsi 50) : " + (bloque(side, 50, 0) ? "🔴 BLOQUE" : "✅ ne bloque pas") +
    `   ·  au-delà de la borne haute (${side === "SELL" ? "rsi 82" : "rsi 18"}) : ` +
    (bloque(side, side === "SELL" ? 82 : 18, 0) ? "🔴 BLOQUE" : "✅ ne bloque pas"));
}

// ══ ③ LA MORSURE RÉELLE ═══════════════════════════════════════════════════════════════════════
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
function carnet(off) {
  if (off) process.env.VETO_RSI_M15 = "off"; else delete process.env.VETO_RSI_M15;
  let a = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
    const nom = path.basename(f, ".csv");
    const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
    for (const s of (r.signals || [])) if (typeof s.R === "number") a.push({ ...s, asset: nom });
  }
  return a.filter((s) => s.strategy === "EXH" && (s.outcome === "WIN" || s.outcome === "LOSS"));
}
// ⚠ UN SEUL PROCESSUS, DEUX RUNS : `_envRead` relit `process.env` À CHAQUE APPEL de `when`, donc
//   basculer la variable entre deux runs SUFFIT ici. (Ce n'est PAS vrai des flags lus au chargement
//   du module, comme `_AX` — ceux-là exigeraient deux processus.)
const ON = carnet(false), OFF = carnet(true);
const clef = (s) => `${s.asset}|${s.ep}|${s.side}`;
const gardes = new Set(ON.map(clef));
const retires = OFF.filter((s) => !gardes.has(clef(s)));
const stat = (t) => { if (!t.length) return "—";
  const w = t.filter((x) => x.outcome === "WIN").length, R = t.reduce((a, b) => a + (b.R || 0), 0);
  return `${String(t.length).padStart(4)} tirs (${String(dedupeEpisodes(t).length).padStart(3)} ép)  ` +
         `WR ${(100 * w / t.length).toFixed(1).padStart(5)} %  R ${(R >= 0 ? "+" : "") + R.toFixed(1)}`; };
console.log("\n══ ③ CE QUE LE VETO RETIRE RÉELLEMENT DU CARNET ══");
console.log(`  carnet OFF  ${stat(OFF)}`);
console.log(`  carnet ON   ${stat(ON)}`);
console.log(`  RETIRÉ      ${stat(retires)}`);
console.log(`    dont SELL ${stat(retires.filter((s) => s.side === "SELL"))}`);
console.log(`    dont BUY  ${stat(retires.filter((s) => s.side === "BUY"))}`);
console.log(retires.length === 0 ? "  🔴 LE VETO NE MORD PAS — mauvaise adresse ?" : "");
