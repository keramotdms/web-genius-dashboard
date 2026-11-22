import * as XLSX from "xlsx";

async function main() {
  const buf = await (await import("fs/promises")).readFile("/home/z/my-project/upload/team_sheet.xlsx");
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets["November 2026 Sales Data"];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null });

  const byEmp = new Map<string, { srcs: Map<string, number>, status: Map<string, number>, amount: number }>();
  const srcTotal = new Map<string, number>();
  let dataRows = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const emp = r?.[1] ? String(r[1]).trim() : "";
    const src = r?.[4] ? String(r[4]).trim() : "";
    if (!emp && !src) continue;
    if (/employee|name/i.test(emp) || /order source/i.test(src)) continue;
    dataRows++;
    const status = r?.[9] ? String(r[9]).trim() : "";
    const amt = Number(r?.[10]) || 0;
    srcTotal.set(src, (srcTotal.get(src) || 0) + 1);
    if (!byEmp.has(emp)) byEmp.set(emp, { srcs: new Map(), status: new Map(), amount: 0 });
    const e = byEmp.get(emp)!;
    e.srcs.set(src, (e.srcs.get(src) || 0) + 1);
    e.status.set(status, (e.status.get(status) || 0) + 1);
    e.amount += amt;
  }
  console.log("total data rows:", dataRows);
  console.log("\n=== Order Source counts (overall) ===");
  [...srcTotal.entries()].sort((a,b)=>b[1]-a[1]).forEach(([s,c]) => console.log(`  ${s}: ${c}`));
  console.log("\n=== Per-employee: Query | Brief | OtherSrc | Delivered | WIP | Amount ===");
  [...byEmp.entries()].sort((a,b)=>b[1].amount-a[1].amount).forEach(([emp, e]) => {
    const q = e.srcs.get("Conversion/Query")||0, b = e.srcs.get("Brief/Invitation")||0;
    const del = e.status.get("Delivered")||0, wip = e.status.get("WIP")||0;
    console.log(`  ${emp.padEnd(28)} Q:${String(q).padStart(2)} B:${String(b).padStart(2)} O:${String([...e.srcs.entries()].filter(([k])=>k!=="Conversion/Query"&&k!=="Brief/Invitation").reduce((s,[,c])=>s+c,0)).padStart(2)} Del:${String(del).padStart(2)} WIP:${String(wip).padStart(2)} $${e.amount}`);
  });
  console.log("\n=== Order status values ===");
  const stTotal = new Map<string, number>();
  for (const [,e] of byEmp) for (const [s,c] of e.status) stTotal.set(s, (stTotal.get(s)||0)+c);
  [...stTotal.entries()].forEach(([s,c]) => console.log(`  ${s}: ${c}`));
}
main();
