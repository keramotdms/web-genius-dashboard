export const CHART_COLORS = [
  "#8b5cf6", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#14b8a6", // teal
  "#f97316", // orange
  "#ec4899", // pink
  "#84cc16", // lime
  "#a855f7", // purple
  "#06b6d4", // cyan
];

export function money(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(n);
}

export function shortDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const PLATFORM_STYLES: Record<string, string> = {
  Shopify: "bg-lime-100 text-lime-800 border-lime-200",
  WordPress: "bg-cyan-100 text-cyan-800 border-cyan-200",
  Wix: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  Squarespace: "bg-amber-100 text-amber-800 border-amber-200",
  Webflow: "bg-rose-100 text-rose-800 border-rose-200",
  Other: "bg-slate-100 text-slate-700 border-slate-200",
};

export function platformClass(p: string): string {
  return PLATFORM_STYLES[p] ?? PLATFORM_STYLES.Other;
}

/** Badge colors for the 20 website categories. */
export function websiteCategoryClass(t: string): string {
  const map: Record<string, string> = {
    "E-commerce Based (Product Selling) Website": "bg-lime-100 text-lime-800 border-lime-200",
    "Dropshipping / Affiliate Marketing Website": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Professional Service-Based Website": "bg-cyan-100 text-cyan-800 border-cyan-200",
    "Agency (Agency Business-Based) Website": "bg-purple-100 text-purple-800 border-purple-200",
    "Corporate / Company Profile Website": "bg-slate-100 text-slate-700 border-slate-200",
    "Portfolio (Personal / Creative) Website": "bg-orange-100 text-orange-800 border-orange-200",
    "News Portal Website": "bg-rose-100 text-rose-800 border-rose-200",
    "Blog / Magazine Website": "bg-pink-100 text-pink-800 border-pink-200",
    "LMS (Learning Management System) Website": "bg-indigo-100 text-indigo-800 border-indigo-200",
    "Landing Page Website": "bg-teal-100 text-teal-800 border-teal-200",
    "Sales Funnel Website": "bg-amber-100 text-amber-800 border-amber-200",
    "SaaS (Software as a Service) Website": "bg-violet-100 text-violet-800 border-violet-200",
    "Membership / Subscription Website": "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    "Booking / Appointment Website": "bg-green-100 text-green-800 border-green-200",
    "Real Estate / Property Listing Website": "bg-blue-100 text-blue-800 border-blue-200",
    "Directory / Listing Website": "bg-stone-100 text-stone-700 border-stone-200",
    "Job Portal Website": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "Event / Conference Website": "bg-red-100 text-red-800 border-red-200",
    "Forum / Community Website": "bg-sky-100 text-sky-800 border-sky-200",
    "Non-Profit / NGO / Charity Website": "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
  return map[t] ?? "bg-slate-100 text-slate-500 border-slate-200 italic";
}

/** Badge colors for the big-client hunting labels. */
export function siteLabelClass(label: string): string {
  const map: Record<string, string> = {
    "Premium Website": "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-300",
    "Large Website": "bg-indigo-100 text-indigo-800 border-indigo-300",
    "High Value Project's Website": "bg-gradient-to-r from-rose-100 to-pink-100 text-rose-800 border-rose-300",
  };
  return map[label] ?? "bg-slate-100 text-slate-700 border-slate-200";
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
