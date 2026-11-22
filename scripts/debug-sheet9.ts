import * as XLSX from "xlsx";

// Mimic parseReferences to list unique (platform, category) pairs
async function main() {
  const buf = await (await import("fs/promises")).readFile("/home/z/my-project/upload/team_sheet.xlsx");
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const rowsOf = (ws: any) => {
    const ref = (ws["!ref"] as string) ?? "A1";
    const end = ref.includes(":") ? ref.split(":")[1] : ref;
    return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null, range: `A1:${end}` });
  };
  const findSheet = (kws: string[], exclude: string[] = []) => {
    for (const kw of kws) {
      const hit = wb.SheetNames.find(n => n.toLowerCase().includes(kw.toLowerCase()) && !exclude.some(e => n.toLowerCase().includes(e.toLowerCase())));
      if (hit) return wb.Sheets[hit];
    }
    return null;
  };
  const URL_RE = /https?:\/\/[^\s"'<>)]+/gi;
  const str = (v: any) => v === null || v === undefined ? "" : String(v).trim();
  const pairs = new Map<string, string[]>(); // platform|cat -> urls
  const add = (platform: string, category: string, rawUrl: string) => {
    const u = rawUrl.trim().replace(/[.,;]+$/, "");
    if (!/^https?:\/\//i.test(u)) return;
    const key = u.toLowerCase();
    const k = platform + " ||| " + (category || "General");
    if (!pairs.has(k)) pairs.set(k, []);
    if (pairs.get(k)!.length < 6) pairs.get(k)!.push(u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40));
  };
  const big = findSheet(["reference"], ["wix"]);
  if (big) {
    const rows = rowsOf(big);
    let platform = "Other";
    const carry = new Map<number, string>();
    for (const row of rows) {
      if (!row) continue;
      for (const cell of row) { const s = str(cell); if (/website sample/i.test(s)) platform = s.replace(/website sample/gi, "").trim() || platform; }
      for (let c = 0; c < row.length; c++) {
        const s = str(row[c]);
        if (!s) continue;
        if (/^https?:\/\//i.test(s)) { add(platform, carry.get(c) ?? "General", s); continue; }
        const low = s.toLowerCase();
        if (low === "categories" || low === "website url" || /^categro?y$/.test(low)) continue;
        if (/website sample/i.test(s)) continue;
        const urls = s.match(URL_RE) ?? [];
        URL_RE.lastIndex = 0;
        if (urls.length) { for (const u of urls) add(platform, s.split("\n")[0].slice(0, 30), u); continue; }
        const cat = s.split("\n").map(l => l.trim()).filter(Boolean)[0] ?? "";
        carry.set(c, cat || "General");
        for (let k = c + 1; k <= c + 6; k++) carry.set(k, cat || "General");
      }
    }
  }
  const wix = findSheet(["wix"]);
  if (wix) {
    const rows = rowsOf(wix);
    let cat = "";
    for (const row of rows) {
      if (!row) continue;
      for (let c = 0; c < Math.min(row.length, 4); c++) {
        const s = str(row[c]);
        if (!s) continue;
        if (/^https?:\/\//i.test(s)) add("Wix", cat || "General", s);
        else { const low = s.toLowerCase(); if (low === "categories" || low === "website url" || /^categro?y$/.test(low) || low === "url") continue; cat = s.split("\n")[0].trim(); }
      }
    }
  }
  console.log("=== UNIQUE platform ||| category pairs (sample urls) ===");
  [...pairs.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([k, urls]) => {
    console.log(`${k}  [${urls.length}]  e.g. ${urls.slice(0, 4).join(", ")}`);
  });
}
main();
