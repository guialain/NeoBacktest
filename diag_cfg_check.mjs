import { getSignalConfig } from "./src/components/config/MultipliersConfig.js";

const cfg = getSignalConfig("EURUSD");
console.log("=== EURUSD h1Reversal ===");
console.log("  slopeH1MaxAbs:  ", cfg.h1Reversal.slopeH1MaxAbs, " (target=6.0)");

console.log("\n=== EURUSD h1Continuation ===");
const c = cfg.h1Continuation;
console.log("  slopeH1Min:     ", c.slopeH1Min,     " (target=0.5,  default=0.1)");
console.log("  dslopeH1MaxAbs: ", c.dslopeH1MaxAbs, " (target=3.0,  default=6.0)");
console.log("  dslopeH1DirMin: ", c.dslopeH1DirMin, " (target=-0.3, default=-0.5)");
console.log("  dslopeH1DirMax: ", c.dslopeH1DirMax, " (target=0.3,  default=0.5)");

const ref = getSignalConfig("EURGBP");
console.log("\n=== EURGBP h1Continuation (defaults non touchés) ===");
console.log("  slopeH1Min:     ", ref.h1Continuation.slopeH1Min);
console.log("  dslopeH1MaxAbs: ", ref.h1Continuation.dslopeH1MaxAbs);
console.log("  dslopeH1DirMin: ", ref.h1Continuation.dslopeH1DirMin);
console.log("  dslopeH1DirMax: ", ref.h1Continuation.dslopeH1DirMax);
