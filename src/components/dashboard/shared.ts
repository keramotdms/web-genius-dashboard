/* Data colours — one muted categorical palette, teal leads.
   No violet/purple/pink: the page design never wears them (taste rule),
   and data stays in the same quiet family. */
export const CHART_COLORS = [
  "#0f766e", // teal-700 — lead
  "#d97706", // amber-600
  "#64748b", // slate-500
  "#0891b2", // cyan-600
  "#059669", // emerald-600
  "#b45309", // amber-700
  "#475569", // slate-600
  "#0d9488", // teal-600
  "#ea580c", // orange-600
  "#155e75", // cyan-800
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

/* Platform badges — distinct but muted tones (bg-50 / text-800 / border-200),
   flat tints, no gradients. */
const PLATFORM_STYLES: Record<string, string> = {
  Shopify: "bg-emerald-50 text-emerald-800 border-emerald-200",
  WordPress: "bg-cyan-50 text-cyan-800 border-cyan-200",
  Wix: "bg-orange-50 text-orange-800 border-orange-200",
  Squarespace: "bg-amber-50 text-amber-900 border-amber-200",
  Webflow: "bg-stone-100 text-stone-700 border-stone-200",
  Other: "bg-stone-100 text-stone-700 border-stone-200",
};

export function platformClass(p: string): string {
  return PLATFORM_STYLES[p] ?? PLATFORM_STYLES.Other;
}

/** Badge colors for the 20 website categories — one muted rotating palette. */
export function websiteCategoryClass(t: string): string {
  const map: Record<string, string> = {
    "E-commerce Based (Product Selling) Website": "bg-emerald-50 text-emerald-800 border-emerald-200",
    "Dropshipping / Affiliate Marketing Website": "bg-teal-50 text-teal-800 border-teal-200",
    "Professional Service-Based Website": "bg-cyan-50 text-cyan-800 border-cyan-200",
    "Agency (Agency Business-Based) Website": "bg-orange-50 text-orange-800 border-orange-200",
    "Corporate / Company Profile Website": "bg-stone-100 text-stone-700 border-stone-200",
    "Portfolio (Personal / Creative) Website": "bg-amber-50 text-amber-900 border-amber-200",
    "News Portal Website": "bg-rose-50 text-rose-800 border-rose-200",
    "Blog / Magazine Website": "bg-yellow-50 text-yellow-800 border-yellow-200",
    "LMS (Learning Management System) Website": "bg-lime-50 text-lime-800 border-lime-200",
    "Landing Page Website": "bg-teal-50 text-teal-800 border-teal-200",
    "Sales Funnel Website": "bg-amber-50 text-amber-900 border-amber-200",
    "SaaS (Software as a Service) Website": "bg-emerald-50 text-emerald-800 border-emerald-200",
    "Membership / Subscription Website": "bg-orange-50 text-orange-800 border-orange-200",
    "Booking / Appointment Website": "bg-green-50 text-green-800 border-green-200",
    "Real Estate / Property Listing Website": "bg-cyan-50 text-cyan-800 border-cyan-200",
    "Directory / Listing Website": "bg-stone-100 text-stone-700 border-stone-200",
    "Job Portal Website": "bg-yellow-50 text-yellow-800 border-yellow-200",
    "Event / Conference Website": "bg-rose-50 text-rose-800 border-rose-200",
    "Forum / Community Website": "bg-sky-50 text-sky-800 border-sky-200",
    "Non-Profit / NGO / Charity Website": "bg-lime-50 text-lime-800 border-lime-200",
  };
  return map[t] ?? "bg-stone-100 text-stone-500 border-stone-200 italic";
}

/** Badge colors for the big-client hunting labels — flat tints, no gradients. */
export function siteLabelClass(label: string): string {
  const map: Record<string, string> = {
    "Premium Website": "bg-amber-50 text-amber-800 border-amber-300",
    "Large Website": "bg-cyan-50 text-cyan-800 border-cyan-300",
    "High Value Project's Website": "bg-rose-50 text-rose-800 border-rose-300",
  };
  return map[label] ?? "bg-stone-100 text-stone-700 border-stone-200";
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
