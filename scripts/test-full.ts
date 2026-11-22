import { getDashboardData } from "../src/lib/sheet-data";
async function main() {
  const d = await getDashboardData(true);
  console.log("source:", d.source);
  console.log("orders:", d.orders.length, "daily:", d.daily.length);
  console.log("funnel:", JSON.stringify(d.funnel, null, 1));
  console.log("members:", d.members.length);
  console.log("members w/ queries>0:", d.members.filter(m => m.queries > 0).map(m => `${m.name}: q=${m.queries} conv=${m.converted} qOrd=${m.queryOrders} qRev=${m.queryRevenue} bOrd=${m.briefOrders} bRev=${m.briefRevenue}`));
  console.log("references:", d.references.length);
  const wc = {}; d.references.forEach(r => { wc[r.websiteCategory] = (wc[r.websiteCategory]||0)+1; });
  console.log("websiteCategories:", JSON.stringify(wc));
  const bc = {}; d.references.forEach(r => { bc[r.businessCategory] = (bc[r.businessCategory]||0)+1; });
  console.log("businessCategories:", JSON.stringify(bc));
}
main().catch(e => console.error(e));
