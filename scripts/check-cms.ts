import { getDashboardData } from "../src/lib/sheet-data";
import { CMS_SALES_TEAM, isCmsSalesMember, normKey } from "../src/lib/cms-team";

async function main() {
  const d = await getDashboardData(false);
  const memberNames = d.members.map(m => m.name);
  console.log("total members in data:", memberNames.length);
  console.log("\n-- CMS list names matched against data members --");
  const matched = new Set<string>();
  for (const listed of CMS_SALES_TEAM) {
    const hit = memberNames.find(m => isCmsSalesMember(m) && normKey(m) === normKey(listed));
    console.log(`${listed  .padEnd(26)} -> ${hit ? "OK: " + hit : "MISSING (no sheet data)"}`);
    if (hit) matched.add(hit);
  }
  console.log("\n-- data members NOT in CMS list --");
  for (const m of memberNames) if (!isCmsSalesMember(m)) console.log("  -", m);
  console.log("\nCMS members with data:", matched.size, "/", CMS_SALES_TEAM.length);
}
main().catch(e => console.error(e));
