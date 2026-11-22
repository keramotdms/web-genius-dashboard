import * as XLSX from "xlsx";
import type {
  DashboardData,
  DailyPoint,
  FunnelStats,
  GuideRow,
  InstructionSection,
  Kpis,
  MemberPerf,
  Quote,
  RefSite,
  SalesOrder,
  SourceStat,
} from "./types";
import { classifySite } from "./site-taxonomy";

const SHEET_ID = "1g2J_pA9F2Tn9nSreafvia3cbRoDRONYJwFW_RruWRPo";
const GOOGLE_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
const LOCAL_FALLBACK = "/home/z/my-project/upload/team_sheet.xlsx";

type Row = (string | number | Date | null)[];

/* ---------------- helpers ---------------- */

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function num(v: unknown): number {
  if (v === null || v === undefined || typeof v === "boolean") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

function toDateStr(v: unknown): string {
  if (v instanceof Date) {
    // Excel dates parsed by SheetJS come in local-ish UTC; keep the calendar day
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(EXCEL_EPOCH + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = str(v);
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

const URL_RE = /https?:\/\/[^\s"'<>)]+/gi;

function firstUrl(s: string): string {
  const m = s.match(URL_RE);
  URL_RE.lastIndex = 0;
  return m ? m[0].replace(/[.,;]+$/, "") : "";
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.\-,_'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.abs(x.length - y.length) > 4) return false;
  const threshold = Math.ceil(Math.min(x.length, y.length) / 8) + 1;
  if (x.length === y.length) {
    // same length: count position-wise substitutions (e.g. Rakibul/Rokibul)
    let diff = 0;
    for (let i = 0; i < x.length; i++) {
      if (x[i] !== y[i] && ++diff > threshold) return false;
    }
    return diff <= threshold;
  }
  // different lengths: shift-tolerant scan
  let diff = 0;
  const longer = x.length > y.length ? x : y;
  const shorter = x.length > y.length ? y : x;
  let j = 0;
  for (let i = 0; i < longer.length; i++) {
    if (longer[i] !== (shorter[j] ?? "\0")) diff++;
    else j++;
  }
  return diff + Math.max(0, shorter.length - j) <= threshold;
}

/** Convert a sheet to an array of rows, ALWAYS anchored at A1 so column indexes match the spreadsheet layout. */
function rowsOf(ws: XLSX.WorkSheet): Row[] {
  const ref = (ws["!ref"] as string) ?? "A1";
  const end = ref.includes(":") ? ref.split(":")[1] : ref;
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: true, defval: null, range: `A1:${end}` });
}

function findSheet(wb: XLSX.WorkBook, keywords: string[], exclude: string[] = []): XLSX.WorkSheet | null {
  const names = wb.SheetNames;
  for (const kw of keywords) {
    const hit = names.find(
      (n) =>
        n.toLowerCase().includes(kw.toLowerCase()) &&
        !exclude.some((e) => n.toLowerCase().includes(e.toLowerCase()))
    );
    if (hit) return wb.Sheets[hit];
  }
  return null;
}

function detectPlatform(s: string): string {
  const t = s.toLowerCase();
  if (t.includes("wix")) return "Wix";
  if (t.includes("shopify") || t.includes("shoify")) return "Shopify";
  if (t.includes("square")) return "Squarespace";
  if (t.includes("wordpress")) return "WordPress";
  if (t.includes("webflow")) return "Webflow";
  return s.replace(/website sample/gi, "").trim() || "Other";
}

/* ---------------- parsers ---------------- */

function parseOrders(rows: Row[]): SalesOrder[] {
  const out: SalesOrder[] = [];
  for (const row of rows) {
    const emp = str(row?.[1]);
    if (!emp) continue;
    const key = emp.toLowerCase();
    if (key.includes("employee") || /(^|\s)name(\s|$)/.test(key)) continue; // header rows
    if (key.startsWith("total")) continue;
    out.push({
      id: str(row?.[0]),
      employee: emp,
      department: str(row?.[2]),
      date: toDateStr(row?.[3]),
      source: str(row?.[4]),
      profile: str(row?.[5]),
      clientId: str(row?.[6]),
      orderNo: str(row?.[7]),
      service: str(row?.[8]) || "Other",
      status: str(row?.[9]) || "Unknown",
      amount: num(row?.[10]),
      fresh: str(row?.[11]),
    });
  }
  return out;
}

function parseDaily(rows: Row[]): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const row of rows) {
    const d = toDateStr(row?.[13]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    map.set(d, { date: d, sales: num(row?.[14]), target: num(row?.[15]) });
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function parseDashboardExtras(rows: Row[]): {
  monthLabel: string;
  monthTarget: number;
  fixedDailyTarget: number;
  targets: Map<string, { target: number; queries: number; converted: number }>;
} {
  let monthLabel = "";
  let monthTarget = 0;
  let fixedDailyTarget = 0;
  const targets = new Map<string, { target: number; queries: number; converted: number }>();

  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const s = str(row[c]).toUpperCase();
      if (s.includes("MONTH TARGET")) {
        for (let k = 1; k <= 6 && !monthTarget; k++) monthTarget = num(rows[r + k]?.[c]);
      }
      if (s.includes("FIXED AVERAGE DAILY TARGET")) {
        for (let k = 1; k <= 6 && !fixedDailyTarget; k++) fixedDailyTarget = num(rows[r + k]?.[c]);
      }
      if (/^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b/.test(s)) {
        monthLabel = monthLabel || str(row[c]);
      }
    }
  }

  // individual performance table: locate header cells by label
  let headerR = -1;
  let nameC = -1;
  let targetC = -1;
  let queryC = -1;
  let convC = -1;
  for (let r = 0; r < rows.length && headerR < 0; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (str(row[c]).toLowerCase() === "name") {
        for (let c2 = c + 1; c2 < row.length; c2++) {
          const t = str(row[c2]).toLowerCase();
          if (t.includes("total target")) targetC = c2;
          if (t.includes("total queries")) queryC = c2;
          if (t.includes("total converted")) convC = c2;
        }
        if (targetC >= 0) {
          nameC = c;
          headerR = r;
          break;
        }
      }
    }
  }

  if (headerR >= 0) {
    for (let r = headerR + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const name = str(row[nameC]);
      if (!name) continue;
      if (name.toLowerCase().startsWith("total")) break;
      targets.set(normName(name), {
        target: num(row[targetC]),
        queries: queryC >= 0 ? num(row[queryC]) : 0,
        converted: convC >= 0 ? num(row[convC]) : 0,
      });
    }
  }

  return { monthLabel, monthTarget, fixedDailyTarget, targets };
}

function parseQuotes(ws: XLSX.WorkSheet | null): Quote[] {
  if (!ws) return [];
  const rows = rowsOf(ws);
  const quotes: Quote[] = [];
  const width = Math.max(...rows.slice(0, 10).map((r) => r?.length ?? 0), 0);
  for (let c = 1; c < width; c += 5) {
    let title = "";
    let body = "";
    let titleRow = -1;
    for (let r = 0; r < Math.min(rows.length, 8); r++) {
      const v = str(rows[r]?.[c]);
      if (v) {
        title = v;
        titleRow = r;
        break;
      }
    }
    if (!title) continue;
    for (let r = titleRow + 1; r < Math.min(rows.length, titleRow + 40); r++) {
      const v = rows[r]?.[c];
      if (v === null || v === undefined) continue;
      body += (body ? "\n\n" : "") + str(v);
      if (body.length > 80) break;
    }
    if (body) {
      quotes.push({
        id: `quote-${c}`,
        title,
        body,
      });
    }
  }
  return quotes;
}

function cleanCategory(s: string): string {
  const firstLine =
    s
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)[0] ?? "";
  const cleaned = firstLine.replace(/^[-\d.\s•]+/, "").trim();
  if (/^top\s*(five|5)/i.test(cleaned)) return "Top Picks";
  return cleaned || "General";
}

function parseReferences(wb: XLSX.WorkBook): RefSite[] {
  const out: RefSite[] = [];
  const seen = new Set<string>();

  const add = (platform: string, category: string, rawUrl: string) => {
    const u = rawUrl.trim().replace(/[.,;]+$/, "");
    if (!/^https?:\/\//i.test(u)) return;
    const key = u.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const cls = classifySite(platform, category || "General", u);
    out.push({
      platform,
      websiteCategory: cls.websiteCategory,
      businessCategory: cls.businessCategory,
      category: category || "General",
      url: u,
    });
  };

  // Big reference sheet (Shopify / WordPress / Wix / Squarespace sample sections)
  const big = findSheet(wb, ["reference"], ["wix"]);
  if (big) {
    const rows = rowsOf(big);
    let platform = "Other";
    // carry-forward: URL column index -> last category seen for that column
    const carry = new Map<number, string>();
    for (const row of rows) {
      if (!row) continue;
      // a new platform banner starts a new section: reset stale categories
      let nextPlatform = platform;
      for (const cell of row) {
        const s = str(cell);
        if (/website sample/i.test(s)) nextPlatform = detectPlatform(s);
      }
      if (nextPlatform !== platform) {
        platform = nextPlatform;
        carry.clear();
      }
      for (let c = 0; c < row.length; c++) {
        const s = str(row[c]);
        if (!s) continue;
        if (/^https?:\/\//i.test(s)) {
          add(platform, carry.get(c) ?? "General", s);
          continue;
        }
        const low = s.toLowerCase();
        if (low === "categories" || low === "website url" || /^categro?y$/.test(low)) {
          carry.clear(); // column headers restart the section layout
          continue;
        }
        if (/website sample/i.test(s)) continue;
        const urls = s.match(URL_RE) ?? [];
        if (urls.length) {
          // list of URLs inside a text cell (e.g. "Top 5" blocks)
          const cat = /top\s*(five|5)/i.test(s) ? "Top Picks" : cleanCategory(s);
          for (const u of urls) add(platform, cat, u);
          continue;
        }
        const cat = cleanCategory(s);
        carry.set(c, cat);
        for (let k = c + 1; k <= c + 6; k++) carry.set(k, cat);
      }
    }
  }

  // Dedicated Wix reference tab (Category | URL)
  const wix = findSheet(wb, ["wix"]);
  if (wix) {
    const rows = rowsOf(wix);
    let cat = "";
    for (const row of rows) {
      if (!row) continue;
      for (let c = 0; c < Math.min(row.length, 4); c++) {
        const s = str(row[c]);
        if (!s) continue;
        if (/^https?:\/\//i.test(s)) {
          add("Wix", cat, s);
        } else {
          const low = s.toLowerCase();
          if (low === "categories" || low === "website url" || /^categro?y$/.test(low) || low === "url") continue;
          cat = cleanCategory(s);
        }
      }
    }
  }

  return out;
}

function parseGuide(ws: XLSX.WorkSheet | null): GuideRow[] {
  if (!ws) return [];
  const rows = rowsOf(ws);
  const out: GuideRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const platform = str(row[0]);
    if (!platform || platform.toLowerCase() === "platform") continue;
    out.push({
      platform,
      definition: str(row[1]),
      access: str(row[2]),
      benefits: str(row[3]),
      limitations: str(row[4]),
      salesTip: str(row[5]),
    });
  }
  return out;
}

function parseInstructions(ws: XLSX.WorkSheet | null): InstructionSection[] {
  if (!ws) return [];
  const rows = rowsOf(ws);
  const sections: InstructionSection[] = [];
  let cur: InstructionSection | null = null;
  for (const row of rows) {
    if (!row) continue;
    const a = str(row[0]);
    const b = str(row[1]);
    const f = str(row[5]);
    const k = str(row[10]);
    if (b && !a && !f && !/^https?:/i.test(b)) {
      cur = { section: b, items: [] };
      sections.push(cur);
      continue;
    }
    if (a && /^https?:/i.test(f)) {
      if (!cur) {
        cur = { section: "General", items: [] };
        sections.push(cur);
      }
      cur.items.push({ title: a, link: f, note: k || undefined });
    }
  }
  return sections.filter((s) => s.items.length > 0);
}

/* ---------------- main builder ---------------- */

async function readWorkbook(): Promise<{ wb: XLSX.WorkBook; source: string }> {
  try {
    const res = await fetch(GOOGLE_URL, { cache: "no-store", redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) throw new Error("Suspiciously small response");
    return { wb: XLSX.read(buf, { type: "buffer", cellDates: true }), source: "Google Sheets (live)" };
  } catch (e) {
    // Offline fallback — only usable where the snapshot file exists (sandbox /
    // self-hosted). On Vercel the local file is not deployed, so we surface a
    // clear "sheet not reachable" error instead of an ENOENT crash.
    const candidates = [
      LOCAL_FALLBACK,
      `${process.cwd()}/upload/team_sheet.xlsx`,
      `${process.cwd()}/../upload/team_sheet.xlsx`,
    ];
    for (const path of candidates) {
      try {
        const fs = await import("fs/promises");
        const buf = await fs.readFile(path);
        console.warn("Live sheet fetch failed, using local fallback:", (e as Error).message);
        return { wb: XLSX.read(buf, { type: "buffer", cellDates: true }), source: "Local snapshot (offline fallback)" };
      } catch {
        /* try next candidate */
      }
    }
    throw new Error(
      `Google Sheet fetch failed (${(e as Error).message}) and no local snapshot is available. Make sure the sheet is shared as "Anyone with the link can view".`
    );
  }
}

/** Everything parsed from the workbook that is NOT derived from the orders list. */
export interface ParsedWorkbook {
  source: string;
  sheetTitle: string;
  monthLabel: string;
  monthTarget: number;
  fixedDailyTarget: number;
  memberTargets: Map<string, { target: number; queries: number; converted: number }>;
  /** per-date target lifted from the sales sheet's daily aggregate block */
  dailyTargets: Map<string, number>;
  quotes: Quote[];
  references: RefSite[];
  guide: GuideRow[];
  instructions: InstructionSection[];
  sheetOrders: SalesOrder[];
}

async function fetchAndParse(): Promise<ParsedWorkbook> {
  const { wb, source } = await readWorkbook();
  const salesWs = findSheet(wb, ["sales data", "sales"]);
  const dashWs = findSheet(wb, ["dashboard"]);
  const quoteWs = findSheet(wb, ["qout", "quot"]);
  const guideWs = findSheet(wb, ["comparison"]);
  const instrWs = findSheet(wb, ["instruction"]);

  const salesRows = salesWs ? rowsOf(salesWs) : [];
  const sheetOrders = parseOrders(salesRows);
  const extras = dashWs
    ? parseDashboardExtras(rowsOf(dashWs))
    : { monthLabel: "", monthTarget: 0, fixedDailyTarget: 0, targets: new Map<string, { target: number; queries: number; converted: number }>() };
  const dailyPoints = parseDaily(salesRows);
  const dailyTargets = new Map(dailyPoints.map((d) => [d.date, d.target]));

  return {
    source,
    sheetTitle: wb.SheetNames[0] ?? "Sales Dashboard",
    monthLabel: extras.monthLabel || wb.SheetNames[0]?.replace(/\s*(Sales Dashboard|Dashboard)\s*/i, "").trim() || "This Month",
    monthTarget: extras.monthTarget,
    fixedDailyTarget: extras.fixedDailyTarget || (dailyPoints.length ? dailyPoints[dailyPoints.length - 1].target : 0),
    memberTargets: extras.targets,
    dailyTargets,
    quotes: parseQuotes(quoteWs),
    references: parseReferences(wb),
    guide: parseGuide(guideWs),
    instructions: parseInstructions(instrWs),
    sheetOrders,
  };
}

const isQuerySrc = (s: string) => /query/i.test(s);
const isBriefSrc = (s: string) => /brief|invitation/i.test(s);

/**
 * Build the full dashboard payload from a parsed workbook and an orders list.
 * Used both with the sheet's own orders and with database-backed orders, so
 * every KPI/member/funnel number always reflects the active order list.
 */
function computeDashboard(p: ParsedWorkbook, orders: SalesOrder[]): DashboardData {
  const byService: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let green = 0;
  let yellow = 0;
  let achievement = 0;
  for (const o of orders) {
    achievement += o.amount;
    const svc = o.service.toLowerCase().startsWith("word") ? "WordPress" : o.service;
    byService[svc] = (byService[svc] ?? 0) + o.amount;
    bySource[o.source] = (bySource[o.source] ?? 0) + o.amount;
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    const f = o.fresh.toLowerCase();
    if (f === "green") green += o.amount;
    else if (f === "yellow") yellow += o.amount;
  }

  // daily series: sales recomputed from the active orders, targets from the sheet.
  // sheet-only dates (zero-sale days) are kept so the chart shape is preserved.
  const salesByDate = new Map<string, number>();
  for (const o of orders) {
    if (!o.date) continue;
    salesByDate.set(o.date, (salesByDate.get(o.date) ?? 0) + o.amount);
  }
  const dateSet = new Set<string>([...p.dailyTargets.keys(), ...salesByDate.keys()]);
  const daily: DailyPoint[] = [...dateSet]
    .sort()
    .map((d) => ({
      date: d,
      sales: Math.round((salesByDate.get(d) ?? 0) * 10) / 10,
      target: p.dailyTargets.get(d) ?? 0,
    }));

  const dailyAvg = daily.length ? daily.reduce((s, x) => s + x.sales, 0) / daily.length : 0;
  const monthTarget = p.monthTarget || 0;
  const achievementPct = monthTarget ? Math.round((achievement / monthTarget) * 1000) / 10 : 0;

  const kpis: Kpis = {
    monthLabel: p.monthLabel,
    monthTarget,
    achievement: Math.round(achievement * 10) / 10,
    awayFromTarget: Math.round((monthTarget - achievement) * 10) / 10,
    achievementPct,
    greenSales: green,
    repeatOrders: yellow,
    dailyAvgSales: Math.round(dailyAvg * 10) / 10,
    fixedDailyTarget: p.fixedDailyTarget,
    totalOrders: orders.length,
    deliveredOrders: orders.filter((o) => o.status.toLowerCase() === "delivered").length,
    wipOrders: orders.filter((o) => o.status.toLowerCase() === "wip").length,
    byService,
    bySource,
    byStatus,
  };

  // member performance: targets from dashboard table joined with orders by name
  const perf = new Map<string, MemberPerf>();
  for (const [key, t] of p.memberTargets) {
    const name = key.replace(/\b\w/g, (ch) => ch.toUpperCase());
    perf.set(key, {
      name,
      target: t.target,
      achievement: 0,
      green: 0,
      yellow: 0,
      gap: t.target,
      orders: 0,
      queries: t.queries,
      converted: t.converted,
      convRatio: t.queries ? t.converted / t.queries : 0,
      hasTarget: true,
      queryOrders: 0,
      queryRevenue: 0,
      briefOrders: 0,
      briefRevenue: 0,
    });
  }
  for (const o of orders) {
    let key = normName(o.employee);
    if (!perf.has(key)) {
      const hit = [...p.memberTargets.keys()].find((tk) => fuzzyMatch(tk, key));
      if (hit) key = hit;
    }
    const existing = perf.get(key);
    if (existing) {
      existing.achievement += o.amount;
      existing.orders += 1;
      const f = o.fresh.toLowerCase();
      if (f === "green") existing.green += o.amount;
      else if (f === "yellow") existing.yellow += o.amount;
      if (isQuerySrc(o.source)) {
        existing.queryOrders += 1;
        existing.queryRevenue += o.amount;
      } else if (isBriefSrc(o.source)) {
        existing.briefOrders += 1;
        existing.briefRevenue += o.amount;
      }
    } else {
      const m: MemberPerf = {
        name: o.employee,
        target: 0,
        achievement: o.amount,
        green: o.fresh.toLowerCase() === "green" ? o.amount : 0,
        yellow: o.fresh.toLowerCase() === "yellow" ? o.amount : 0,
        gap: -o.amount,
        orders: 1,
        queries: 0,
        converted: 0,
        convRatio: 0,
        hasTarget: false,
        queryOrders: isQuerySrc(o.source) ? 1 : 0,
        queryRevenue: isQuerySrc(o.source) ? o.amount : 0,
        briefOrders: isBriefSrc(o.source) ? 1 : 0,
        briefRevenue: isBriefSrc(o.source) ? o.amount : 0,
      };
      perf.set(key, m);
    }
  }
  const members = [...perf.values()]
    .map((m) => {
      m.gap = Math.round((m.target - m.achievement) * 10) / 10;
      m.achievement = Math.round(m.achievement * 10) / 10;
      m.convRatio = m.queries ? Math.round((m.converted / m.queries) * 1000) / 1000 : 0;
      m.queryRevenue = Math.round(m.queryRevenue * 10) / 10;
      m.briefRevenue = Math.round(m.briefRevenue * 10) / 10;
      return m;
    })
    .sort((a, b) => b.achievement - a.achievement);

  // per-source funnel stats (queries/briefs/repeat orders → sales)
  const srcAgg = new Map<string, { orders: number; revenue: number; delivered: number; wip: number }>();
  for (const o of orders) {
    const src = o.source || "Unknown";
    if (!srcAgg.has(src)) srcAgg.set(src, { orders: 0, revenue: 0, delivered: 0, wip: 0 });
    const a = srcAgg.get(src)!;
    a.orders += 1;
    a.revenue += o.amount;
    const st = o.status.toLowerCase();
    if (st === "delivered") a.delivered += 1;
    else if (st === "wip") a.wip += 1;
  }
  const totalRevenue = orders.reduce((s, o) => s + o.amount, 0) || 1;
  const sourceStats: SourceStat[] = [...srcAgg.entries()]
    .map(([src, a]) => ({
      source: src,
      orders: a.orders,
      revenue: Math.round(a.revenue * 10) / 10,
      delivered: a.delivered,
      wip: a.wip,
      avg: a.orders ? Math.round((a.revenue / a.orders) * 10) / 10 : 0,
      pct: Math.round((a.revenue / totalRevenue) * 1000) / 10,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // overall query → sales funnel
  const funnel: FunnelStats = {
    queries: members.reduce((s, m) => s + m.queries, 0),
    converted: members.reduce((s, m) => s + m.converted, 0),
    convRate: 0,
    queryOrders: orders.filter((o) => isQuerySrc(o.source)).length,
    queryRevenue: Math.round(orders.filter((o) => isQuerySrc(o.source)).reduce((s, o) => s + o.amount, 0) * 10) / 10,
    briefOrders: orders.filter((o) => isBriefSrc(o.source)).length,
    briefRevenue: Math.round(orders.filter((o) => isBriefSrc(o.source)).reduce((s, o) => s + o.amount, 0) * 10) / 10,
  };
  funnel.convRate = funnel.queries ? Math.round((funnel.converted / funnel.queries) * 1000) / 1000 : 0;

  return {
    monthLabel: kpis.monthLabel,
    sheetTitle: p.sheetTitle,
    fetchedAt: new Date().toISOString(),
    source: p.source,
    orders,
    daily,
    kpis,
    members,
    quotes: p.quotes,
    references: p.references,
    guide: p.guide,
    instructions: p.instructions,
    sourceStats,
    funnel,
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;

let parsedCache: { p: ParsedWorkbook; at: number } | null = null;
let parsedFetching: Promise<ParsedWorkbook> | null = null;

async function getParsed(force = false): Promise<ParsedWorkbook> {
  if (!force && parsedCache && Date.now() - parsedCache.at < CACHE_TTL_MS) return parsedCache.p;
  if (parsedFetching) return parsedFetching;
  parsedFetching = fetchAndParse()
    .then((p) => {
      parsedCache = { p, at: Date.now() };
      return p;
    })
    .finally(() => {
      parsedFetching = null;
    });
  return parsedFetching;
}

/** Dashboard assembled from the sheet's own orders (used as the baseline/seed). */
export async function getDashboardData(force = false): Promise<DashboardData> {
  const p = await getParsed(force);
  return computeDashboard(p, p.sheetOrders);
}

/** Raw sheet orders — used by the "Sync from Sheet" import. */
export async function getSheetOrders(force = false): Promise<SalesOrder[]> {
  const p = await getParsed(force);
  return p.sheetOrders;
}

/** Dashboard recomputed with a custom (database-backed) orders list. */
export async function getDashboardDataForOrders(orders: SalesOrder[], force = false): Promise<DashboardData> {
  const p = await getParsed(force);
  return computeDashboard(p, orders);
}

/** Sheet-based dashboard, warm cache preferred (legacy helper used by AI routes). */
export async function getCachedDashboardData(): Promise<DashboardData> {
  return getDashboardData();
}
