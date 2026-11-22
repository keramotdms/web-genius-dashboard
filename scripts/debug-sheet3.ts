import * as XLSX from "xlsx";

async function main() {
  const buf = await (await import("fs/promises")).readFile("/home/z/my-project/upload/team_sheet.xlsx");
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  console.log("=== ALL SHEET NAMES ===");
  wb.SheetNames.forEach((n, i) => {
    const ws = wb.Sheets[n];
    const ref = (ws["!ref"] as string) ?? "empty";
    console.log(`[${i}] "${n}" -> range: ${ref}`);
  });
}
main();
