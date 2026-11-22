export interface SalesOrder {
  id: string;
  employee: string;
  department: string;
  date: string;
  source: string;
  profile: string;
  clientId: string;
  orderNo: string;
  service: string;
  status: string;
  amount: number;
  fresh: string;
  /** where the row came from: "sheet" (synced) or "ui" (added in the dashboard) */
  origin?: string;
}

export interface DailyPoint {
  date: string;
  sales: number;
  target: number;
}

export interface MemberPerf {
  name: string;
  target: number;
  achievement: number;
  green: number;
  yellow: number;
  gap: number;
  orders: number;
  queries: number;
  converted: number;
  convRatio: number;
  hasTarget: boolean;
  /** row-level evidence from the sales data sheet */
  queryOrders: number;
  queryRevenue: number;
  briefOrders: number;
  briefRevenue: number;
  /** listed on the CMS roster but has no rows in the sheet yet */
  placeholder?: boolean;
}

export interface Quote {
  id: string;
  title: string;
  body: string;
}

export interface RefSite {
  /** Level 1 — CMS Category: WordPress, Wix, Shopify, Squarespace, Webflow */
  platform: string;
  /** Level 2 — Website Category: E-commerce Based, News Portal, LMS, Landing Page… (20 types) */
  websiteCategory: string;
  /** Level 3 — Business Name Category: Housekeeping & Cleaning Services, Bakery Shop… */
  businessCategory: string;
  /** original category text from the sheet (kept for search/traceability) */
  category: string;
  url: string;
  /** big-client hunting labels: Premium Website / Large Website / High Value Project's Website */
  labels?: string[];
  /** true when added manually from the dashboard (stored in the app database) */
  custom?: boolean;
  /** DB id for custom sites (needed for deletion) */
  id?: string;
}

export interface SourceStat {
  source: string;
  orders: number;
  revenue: number;
  delivered: number;
  wip: number;
  avg: number;
  pct: number;
}

export interface FunnelStats {
  /** total queries handled (from the dashboard sheet's aggregate table) */
  queries: number;
  /** queries that converted (from the dashboard sheet's aggregate table) */
  converted: number;
  convRate: number;
  /** row-level evidence computed from the sales data sheet */
  queryOrders: number;
  queryRevenue: number;
  briefOrders: number;
  briefRevenue: number;
}

export interface GuideRow {
  platform: string;
  definition: string;
  access: string;
  benefits: string;
  limitations: string;
  salesTip: string;
}

export interface InstructionItem {
  title: string;
  link: string;
  note?: string;
}

export interface InstructionSection {
  section: string;
  items: InstructionItem[];
}

export interface Kpis {
  monthLabel: string;
  monthTarget: number;
  achievement: number;
  awayFromTarget: number;
  achievementPct: number;
  greenSales: number;
  repeatOrders: number;
  dailyAvgSales: number;
  fixedDailyTarget: number;
  totalOrders: number;
  deliveredOrders: number;
  wipOrders: number;
  byService: Record<string, number>;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface DashboardData {
  monthLabel: string;
  sheetTitle: string;
  fetchedAt: string;
  source: string;
  orders: SalesOrder[];
  daily: DailyPoint[];
  kpis: Kpis;
  members: MemberPerf[];
  quotes: Quote[];
  references: RefSite[];
  guide: GuideRow[];
  instructions: InstructionSection[];
  sourceStats: SourceStat[];
  funnel: FunnelStats;
}
