import * as XLSX from "xlsx";
async function main() {
  const buf = await (await import("fs/promises")).readFile("/home/z/my-project/upload/team_sheet.xlsx");
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets["Reference website"];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
  for (let i = 76; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => c === null || String(c).trim() === "")) continue;
    const cells = r.map(c => c === null ? "" : String(c).replace(/\n/g, " ⏎ ").slice(0, 70));
    if (cells.every(c => c === "")) continue;
    console.log(`${String(i).padStart(3)} | ${cells.join(" | ")}`);
  }
}
main();
