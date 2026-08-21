// TOUS les trades Strong Bull + Strong Bear (détail complet) — via serveur.
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const trades = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) {
    if (typeof s.R !== "number") continue;
    if (s.profile !== "Strong Bull" && s.profile !== "Strong Bear") continue;
    trades.push({ a, ts: s.tsMT, prof: s.profile, side: s.side, stage: s.obs?.stage,
      z: s.zscoreH1, zone: s.zoneH1, adx: s.adx, cross: s.crossState, crossAge: s.crossAge,
      out: s.outcome, R: s.R, entry: s.entry, exit: s.exit, reason: s.reason, held: s.barsHeld });
  }
}
const dump = (prof) => {
  const t = trades.filter(x => x.prof === prof).sort((x, y) => (x.a + x.ts).localeCompare(y.a + y.ts));
  const w = t.filter(x => x.out === "WIN").length, l = t.filter(x => x.out === "LOSS").length, R = t.reduce((a, x) => a + x.R, 0);
  console.log(`\n══════ ${prof} — ${t.length} trades · WR ${(w + l ? 100 * w / (w + l) : 0).toFixed(0)}% (W${w}/L${l}) · R ${(R >= 0 ? "+" : "") + R.toFixed(1)} · avgR ${(t.length ? R / t.length : 0).toFixed(3)} ══════`);
  console.log("actif".padEnd(11) + "date/heure".padEnd(16) + "sd".padEnd(5) + "stage".padEnd(11) + "z".padStart(7) + "  " + "zone".padEnd(14) + "adx".padStart(5) + "  cross".padEnd(13) + "out".padEnd(6) + "R".padStart(6) + "  min");
  for (const x of t)
    console.log(x.a.padEnd(11) + String(x.ts).slice(5, 16).padEnd(16) + x.side.padEnd(5) + String(x.stage).padEnd(11) +
      (x.z ?? "—").toString().padStart(7) + "  " + String(x.zone ?? "—").padEnd(14) + (x.adx?.toFixed?.(0) ?? "—").padStart(5) +
      "  " + `${x.cross ?? "—"}/${x.crossAge ?? "—"}`.padEnd(13) + (x.out === "WIN" ? "WIN " : "LOSS").padEnd(6) +
      ((x.R >= 0 ? "+" : "") + x.R.toFixed(2)).padStart(6) + "  " + String(x.held ?? ""));
};
dump("Strong Bull");
dump("Strong Bear");
