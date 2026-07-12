// Inspecte les décisions moteur autour d'un timestamp. node prep/inspectBar.mjs COCOA "2026.07.07 12:18" [±minutes]
import fs from "fs";
import { detectOpportunity } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { observeProfile } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js";

const sym = (process.argv[2] || "COCOA").toUpperCase();
const target = process.argv[3] || "2026.07.07 12:18";
const win = Number(process.argv[4] || 8);   // minutes autour

const lines = fs.readFileSync(`./data/matrix/${sym}.csv`, "utf8").split(/\r?\n/).filter(Boolean);
const h = lines[0].split(";");
const rows = lines.slice(1).map((l) => { const v = l.split(";"); const o = {}; h.forEach((k, i) => o[k] = v[i]); return o; });

// index de la barre cible (timestamp commence par target)
const ti = rows.findIndex((r) => String(r.timestamp).startsWith(target));
if (ti < 0) { console.log("timestamp introuvable:", target); process.exit(1); }
const from = Math.max(0, ti - win), to = Math.min(rows.length, ti + win + 1);

console.log(`\n=== ${sym} autour de ${target} (±${win}min) ===`);
for (let i = from; i < to; i++) {
  const r = rows[i];
  let det; try { det = detectOpportunity(r, sym); } catch (e) { console.log(r.timestamp, "ERR", e.message); continue; }
  const mp = det.marketProfile, sel = det.selection, obs = observeProfile(det);
  const fired = sel.side === "BUY" || sel.side === "SELL";
  const mark = String(r.timestamp).startsWith(target) ? " ◄── CIBLE" : "";
  const top2 = mp?.ranking?.slice(0, 2).map(([n, c]) => `${n} ${c.toFixed(3)}`).join(" | ");
  console.log(`\n${r.timestamp}  px=${r.price}${mark}`);
  console.log(`  c2: ${mp?.classification} → ${mp?.profile ?? "—"}  [${top2}]  gap=${mp?.gap}`);
  console.log(`  décision: ${fired ? `FIRE ${sel.side} ${sel.strategy} (profil ${sel.profile})` : `WAIT (${sel.waitNature ?? det.rawSelection?.waitNature ?? "—"}${det.rawSelection?.blockedBy ? " " + det.rawSelection.blockedBy.observable + "=" + det.rawSelection.blockedBy.observed : ""})`}`);
  if (fired || mark) console.log(`  obs: impulse=${obs.impulse} zone=${obs.zone} contact=${obs.contact} dailyDir=${obs.dailyDirection} force=${obs.force} thetaDay=${obs.thetaDay} thetaRot=${obs.thetaRotation} energy=${obs.energyState} intensity=${obs.intensity} stage=${obs.stage} contΔ=${obs.continuationDelta}`);
}
