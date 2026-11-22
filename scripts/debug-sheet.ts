import * as XLSX from "xlsx";
import fs from "fs/promises";

const buf = await fs.readFile("/home/z/my-project/upload/team_sheet.xlsx");
const wb = XLSX.read(buf, { type: "buffer" });

// find sheets
const names = wb.SheetNames;
console.log("sheets:", names);

const salesName = names.find((n) => n.toLowerCase().includes("sales data"));
const quoteName = names.find((n) => n.toLowerCase().includes("qout"));
const refName = names.find((n) => n.toLowerCase().includes("reference") && !n.toLowerCase().includes("wix"));
console.log("sales:", salesName, "| quote:", quoteName, "| ref:", refName);

// check raw cell types on sales sheet col N (daily)
const salesWs = wb.Sheets[salesName!];
const rows = XLSX.utils.sheet_to_json<unknown[]>(salesWs, { header: 1, raw: true, defval: null });
console.log("\nsales row count:", rows.length);
console.log("row1 len:", rows[0]?.length, "row2 len:", rows[1]?.length);
const r2 = rows[1] as unknown[];
console.log("row2 idx13-15:", r2?.[13], r2?.[14], r2?.[15], "| types:", [r2?.[13], r2?.[14], r2?.[15]].map((v) => typeof v));
const r44 = rows[43] as unknown[];
console.log("row44:", JSON.stringify(r44?.slice(0, 12)));

// quotes
const qWs = wb.Sheets[quoteName!];
const qRows = XLSX.utils.sheet_to_json<unknown[]>(qWs, { header: 1, raw: true, defval: null });
console.log("\nquote rows:", qRows.length, "row0 len:", qRows[0]?.length, "row1 len:", qRows[1]?.length);
const q1 = qRows[1] as unknown[];
console.log("q row1 idx1:", String(q1?.[1]).slice(0, 50));
console.log("q row2 idx1:", String(qRows[2]?.[1]).slice(0, 60));

// references
const rWs = wb.Sheets[refName!];
const rRows = XLSX.utils.sheet_to_json<unknown[]>(rWs, { header: 1, raw: true, defval: null });
console.log("\nref rows:", rRows.length, "row0 len:", rRows[0]?.length);
const r3 = rRows[2] as unknown[];
console.log("r3 idx1, idx4:", r3?.[1], r3?.[4]);
const r4 = rRows[3] as unknown[];
console.log("r4 idx1:", String(r4?.[1]).slice(0, 40), "| idx4:", r4?.[4]);
// scan which columns have URLs in first 60 rows
const urlCols = new Map<number, number>();
for (const row of rRows.slice(0, 60)) {
  (row as unknown[]).forEach((v, i) => {
    if (v && typeof v === "string" && v.startsWith("http")) urlCols.set(i, (urlCols.get(i) ?? 0) + 1);
  });
}
console.log("URL columns (first 60 rows):", [...urlCols.entries()].sort((a, b) => a[0] - b[0]));
