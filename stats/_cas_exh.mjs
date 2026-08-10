// _cas_exh.mjs — QU'A VU LE RANG ① SUR CETTE PLAGE ? conviction, verdict, vetos, cote.
import path from "path";
// ⚠⚠ NI `PB_ISOLE` NI `MIN_PB` FORCES ICI. Les deux sont des INSTRUMENTS : `PB_ISOLE` fait CEDER le
//   rang ① et `MIN_PB` bas fait tirer le rang ② sur tout. Une fiche « qu'a fait le moteur ? » lue
//   sous instrument ne decrit pas le moteur — elle decrit l'instrument. A regler par l'appelant.
process.env.NO_TRIGGER = "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const ACTIF = process.env.ACTIF ?? "AUDUSD", JOUR = process.env.JOUR ?? "2026.08.03";
const HH = (process.env.H ?? "14,15").split(",");
const r = runMatrixBacktest(path.join("C:/Users/Public/Neo-Backtest/data/matrix", ACTIF + ".csv"),
  { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true });
const g = (r.ghosts ?? []).filter((x) => x.ghost === "boxes" && String(x.tsMT).startsWith(JOUR) && HH.includes(String(x.tsMT).slice(11, 13)));
const f = (v) => (v == null ? "—" : typeof v === "number" ? (v >= 0 ? "+" : "") + v.toFixed(0) : String(v));
console.log(`\n══ ${ACTIF} ${JOUR} h=${HH.join("/")} · CE QUE CHAQUE BOITE A VU ══  regDir ${g[0]?.regDir ?? "?"}  · ${g.length} barres`);
console.log("\n  heure  | EXH côté conv verdict         vetos                          | PB côté conv verdict  | tir");
for (const x of g)
  console.log("  " + String(x.tsMT).slice(11, 16)
    + "  | " + String(x.eSide ?? "—").padEnd(5) + f(x.eConv).padStart(4) + " " + String(x.eVerd ?? "—").padEnd(15)
    + " " + (x.eVetos?.length ? x.eVetos.join(",") : "—").slice(0, 46).padEnd(46)
    + " | " + String(x.side).padEnd(5) + f(x.pConv).padStart(4) + " " + String(x.pVerd ?? "—").padEnd(11)
    + " | " + (x.firedStrategy ?? "—"));
