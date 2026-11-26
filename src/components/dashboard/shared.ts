/* Data colours — one muted categorical palette tuned for the dark canvas,
   teal leads. No violet/purple/pink: the page design never wears them
   (taste rule), and data stays in the same quiet family. */
export const CHART_COLORS = [
  "#2dd4bf", // teal-400 — lead
  "#fbbf24", // amber-400
  "#94a3b8", // slate-400
  "#22d3ee", // cyan-400
  "#34d399", // emerald-400
  "#fcd34d", // amber-300
  "#cbd5e1", // slate-300
  "#5eead4", // teal-300
  "#fb923c", // orange-400
  "#67e8f9", // cyan-300
];

/* Shared chart chrome for the graphite theme — grid, ticks, tooltip panel.
   Every chart reads these so all axes and tooltips stay one system. */
export const CHART_UI = {
  grid: "#1f2836",
  tick: "#8b96a5",
  tickStrong: "#eef2f7",
  cursor: "#1a2230",
  sales: "#2dd4bf",
  targetLine: "#64748b",
  targetBar: "#3b4757",
  tooltip: {
    backgroundColor: "#0d121b",
    border: "1px solid #1f2836",
    borderRadius: "10px",
    color: "#eef2f7",
    fontSize: "12px",
    boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.6)",
  },
} as const;

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

/* Platform badges — dark tonal tints (bg 500/10 · text 300 · border 500/20),
   flat, no gradients, one formula for every hue. */
const PLATFORM_STYLES: Record<string, string> = {
  Shopify: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
  WordPress: "bg-cyan-400/10 text-cyan-300 border-cyan-400/25",
  Wix: "bg-orange-400/10 text-orange-300 border-orange-400/25",
  Squarespace: "bg-amber-400/10 text-amber-300 border-amber-400/25",
  Webflow: "bg-white/[0.06] text-foreground/70 border-white/10",
  Other: "bg-white/[0.06] text-foreground/70 border-white/10",
};

export function platformClass(p: string): string {
  return PLATFORM_STYLES[p] ?? PLATFORM_STYLES.Other;
}

/** Badge colors for the 20 website categories — one dark tonal rotating palette. */
export function websiteCategoryClass(t: string): string {
  const map: Record<string, string> = {
    "E-commerce Based (Product Selling) Website": "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
    "Dropshipping / Affiliate Marketing Website": "bg-teal-400/10 text-teal-300 border-teal-400/25",
    "Professional Service-Based Website": "bg-cyan-400/10 text-cyan-300 border-cyan-400/25",
    "Agency (Agency Business-Based) Website": "bg-orange-400/10 text-orange-300 border-orange-400/25",
    "Corporate / Company Profile Website": "bg-white/[0.06] text-foreground/70 border-white/10",
    "Portfolio (Personal / Creative) Website": "bg-amber-400/10 text-amber-300 border-amber-400/25",
    "News Portal Website": "bg-rose-400/10 text-rose-300 border-rose-400/25",
    "Blog / Magazine Website": "bg-yellow-400/10 text-yellow-300 border-yellow-400/25",
    "LMS (Learning Management System) Website": "bg-lime-400/10 text-lime-300 border-lime-400/25",
    "Landing Page Website": "bg-teal-400/10 text-teal-300 border-teal-400/25",
    "Sales Funnel Website": "bg-amber-400/10 text-amber-300 border-amber-400/25",
    "SaaS (Software as a Service) Website": "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
    "Membership / Subscription Website": "bg-orange-400/10 text-orange-300 border-orange-400/25",
    "Booking / Appointment Website": "bg-green-400/10 text-green-300 border-green-400/25",
    "Real Estate / Property Listing Website": "bg-cyan-400/10 text-cyan-300 border-cyan-400/25",
    "Directory / Listing Website": "bg-white/[0.06] text-foreground/70 border-white/10",
    "Job Portal Website": "bg-yellow-400/10 text-yellow-300 border-yellow-400/25",
    "Event / Conference Website": "bg-rose-400/10 text-rose-300 border-rose-400/25",
    "Forum / Community Website": "bg-sky-400/10 text-sky-300 border-sky-400/25",
    "Non-Profit / NGO / Charity Website": "bg-lime-400/10 text-lime-300 border-lime-400/25",
  };
  return map[t] ?? "bg-white/[0.06] text-muted-foreground border-white/10 italic";
}

/** Badge colors for the big-client hunting labels — flat dark tints, no gradients. */
export function siteLabelClass(label: string): string {
  const map: Record<string, string> = {
    "Premium Website": "bg-amber-400/10 text-amber-300 border-amber-400/30",
    "Large Website": "bg-cyan-400/10 text-cyan-300 border-cyan-400/30",
    "High Value Project's Website": "bg-rose-400/10 text-rose-300 border-rose-400/30",
  };
  return map[label] ?? "bg-white/[0.06] text-foreground/70 border-white/10";
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
