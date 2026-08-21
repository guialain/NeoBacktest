// _diag_bar.mjs — POURQUOI CETTE BARRE A-T-ELLE DÉCIDÉ ÇA ? Trace complète d'UNE row.
//   usage : npx vite-node stats/_diag_bar.mjs GOLD 2026-07-29T14:09
// ⚠ On rejoue la DÉCISION sur la row du CSV, sans le harnais : pas de spacing, pas de `maxOpen`.
//   Le verdict peut donc différer de ce que le carnet a réellement pris — ce qu'on cherche ici,
//   c'est le RAISONNEMENT du moteur, pas l'exécution.
import fs from "fs";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { decideFromScoring } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const { exhAdmissionAdmits } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/exhAdmission.js");
const { tfInputs } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js");
const { vetoGate, readTfs } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/vetoGate.js");

const [asset, stamp] = process.argv.slice(2);
const txt = fs.readFileSync(`C:/Users/Public/Neo-Backtest/data/matrix/${asset}.csv`, "utf8").split(/\r?\n/);
const head = txt[0].split(";");
const iUtc = head.indexOf("ts_utc");
const line = txt.find((l, i) => i > 0 && l && l.split(";")[iUtc]?.startsWith(stamp));
if (!line) { console.log("barre introuvable"); process.exit(1); }
const c = line.split(";");
const row = {}; head.forEach((h, i) => { row[h] = c[i]; });

console.log(`${asset}  ${row.ts_utc}   prix ${row.price}\n`);
const t = tfInputs(row, "h1");
console.log("── ÉTAT H1 (ce que l'admission lit) ──");
console.log("  zone   ", t.zone, "   (%K live", t.kLive, ")");
console.log("  kdCur  ", t.kdCur, "  kdPrev", t.kdPrev);
console.log("  kdGap  ", t.kdGap == null ? null : t.kdGap.toFixed(2), t.kdGap > 0 ? " (K > D)" : " (K < D)");
console.log("  rsi    ", t.rsiClosed);
console.log();
console.log("── ADMISSION ──");
for (const side of ["BUY", "SELL"]) {
  const adm = exhAdmissionAdmits(side, t);
  const v = vetoGate(row, "EXH", side, readTfs(row), asset);
  console.log(`  ${side.padEnd(5)} table zone×K/D : ${String(adm).padEnd(6)} | vetos : ${v.blocked ? v.hits.map((h) => h.id).join(" + ") : "aucun"}`);
}
console.log();
const gate = { symbol: asset, h1Zone: t.zone, m5K: Number(row.stoch_k_m5_s0), m5Kd: Number(row.stoch_k_m5_s0) - Number(row.stoch_d_m5_s0) };
const r = decideFromScoring(row, gate);
console.log("── DÉCISION ──");
console.log("  ", r.strategy ?? r.waitNature, "|", r.side, "| score", r.score, "| conviction EXH", r.scoring?.exhConviction ?? "—",
            "| cédé à CONT ?", r.scoring?.exhYielded ?? false);
console.log("  ", r.reasons?.[0]);
console.log();
console.log("── LES SIX EXPERTS DU FADE, PAR FACE ──");
const E = r.scoring?.exhExperts;
if (E) {
  const ids = Object.keys(E.BUY ?? {});
  console.log("  expert     face BUY   face SELL");
  for (const id of ids) console.log("  " + id.padEnd(10) + String(E.BUY?.[id]?.global ?? "—").padStart(9) + String(E.SELL?.[id]?.global ?? "—").padStart(11));
}
console.log("\n  score CONT", r.scoring?.cont, " (brut", r.scoring?.contRaw, "+ bonus", r.scoring?.contBonus, ")");
