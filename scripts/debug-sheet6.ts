import * as XLSX from "xlsx";

async function main() {
  const buf = await (await import("fs/promises")).readFile("/home/z/my-project/upload/team_sheet.xlsx");
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets["November 2026 Sales Dashboard"];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
  // find the member table header row (contains "name" and "total queries")
  console.log("=== Dashboard tab rows 50-90 (cols A-AB) ===");
  for (let i = 50; i < 90 && i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => c === null || String(c).trim() === "")) continue;
    const cells = r.slice(0, 28).map(c => c === null ? "" : String(c).slice(0, 14));
    console.log(`${String(i).padStart(3)} | ${cells.join("|")}`);
  }
}
main();
