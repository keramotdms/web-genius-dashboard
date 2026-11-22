import * as XLSX from "xlsx";

async function main() {
  const url = "https://docs.google.com/spreadsheets/d/1g2J_pA9F2Tn9nSreafvia3cbRoDRONYJwFW_RruWRPo/export?format=xlsx";
  const res = await fetch(url, { redirect: "follow" });
  console.log("HTTP", res.status, "bytes:", res.headers.get("content-length"));
  const buf = await res.arrayBuffer();
  console.log("downloaded bytes:", buf.byteLength);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  console.log("=== LIVE SHEET TABS ===");
  wb.SheetNames.forEach((n, i) => {
    const ws = wb.Sheets[n];
    const ref = (ws["!ref"] as string) ?? "empty";
    console.log(`[${i}] "${n}" -> range: ${ref}`);
  });
}
main();
