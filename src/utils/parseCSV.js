export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map(s => s.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(","); // simple (OK si pas de virgules dans champs)
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j];
      const raw = (cols[j] ?? "").trim();
      const n = Number(raw);
      obj[key] = raw === "" ? null : (Number.isFinite(n) ? n : raw);
    }
    rows.push(obj);
  }
  return rows;
}
