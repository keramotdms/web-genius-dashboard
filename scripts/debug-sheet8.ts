import * as XLSX from "xlsx";

async function main() {
  const buf = await (await import("fs/promises")).readFile("/home/z/my-project/upload/team_sheet.xlsx");
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  for (const tabName of ["Reference website", "Wix Refence Website"]) {
    const ws = wb.Sheets[tabName];
    console.log(`\n############ TAB: ${tabName} ############`);
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });
    rows.forEach((r, i) => {
      if (!r || r.every(c => c === null || String(c).trim() === "")) return;
      const cells = r.map(c => c === null ? "" : String(c).replace(/\n/g, " ⏎ ").slice(0, 60));
      if (cells.every(c => c === "")) return;
      console.log(`${String(i).padStart(3)} | ${cells.join(" | ")}`);
    });
  }
}
main();
