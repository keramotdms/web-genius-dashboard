import * as XLSX from "xlsx";

async function main() {
  const buf = await (await import("fs/promises")).readFile("/home/z/my-project/upload/team_sheet.xlsx");
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets["November 2026 Sales Data"];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
  console.log("=== SALES DATA first 40 rows, cols A-P ===");
  rows.slice(0, 40).forEach((r, i) => {
    const cells = r.slice(0, 16).map(c => c === null ? "" : String(c).slice(0, 18));
    console.log(`${String(i).padStart(3)} | ${cells.join(" | ")}`);
  });
}
main();
