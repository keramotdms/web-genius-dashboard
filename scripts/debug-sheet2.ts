import * as XLSX from "xlsx";
import fs from "fs/promises";

const buf = await fs.readFile("/home/z/my-project/upload/team_sheet.xlsx");
const wb = XLSX.read(buf, { type: "buffer" });

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  console.log(`${name}: !ref=${ws["!ref"]}`);
}

// Qoute sheet: print first 4 rows fully (index -> value)
const qWs = wb.Sheets["Qoute"];
const qRows = XLSX.utils.sheet_to_json<unknown[]>(qWs, { header: 1, raw: true, defval: null });
for (let r = 0; r < 4; r++) {
  const row = qRows[r] as unknown[] | undefined;
  const entries = (row ?? [])
    .map((v, i) => (v !== null && v !== undefined && String(v).trim() ? `${i}:${String(v).slice(0, 30)}` : null))
    .filter(Boolean);
  console.log(`\nQoute row${r}:`, entries);
}

// Reference sheet: print first 6 rows
const rWs = wb.Sheets["Reference website"];
const rRows = XLSX.utils.sheet_to_json<unknown[]>(rWs, { header: 1, raw: true, defval: null });
for (let r = 0; r < 6; r++) {
  const row = rRows[r] as unknown[] | undefined;
  const entries = (row ?? [])
    .map((v, i) => (v !== null && v !== undefined && String(v).trim() ? `${i}:${String(v).slice(0, 35).replace(/\n/g, " ")}` : null))
    .filter(Boolean);
  console.log(`\nRef row${r}:`, entries);
}

// Sales sheet rows 45-70: any more orders?
const sWs = wb.Sheets["November 2026 Sales Data"];
const sRows = XLSX.utils.sheet_to_json<unknown[]>(sWs, { header: 1, raw: true, defval: null });
let count = 0;
for (let r = 1; r < sRows.length; r++) {
  const emp = sRows[r]?.[1];
  if (emp && String(emp).trim()) count++;
}
console.log("\nSales rows with col B non-empty:", count);
// print rows where col B contains 'name' or 'total'
for (let r = 1; r < Math.min(sRows.length, 80); r++) {
  const b = String(sRows[r]?.[1] ?? "");
  if (b && /employee|total|name/i.test(b)) console.log(`row${r} colB:`, b.slice(0, 30), "| col I(8):", sRows[r]?.[8]);
}
