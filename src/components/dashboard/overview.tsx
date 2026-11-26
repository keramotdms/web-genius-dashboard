"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { DashboardData } from "@/lib/types";
import { CHART_COLORS, money, pct, shortDate } from "@/components/dashboard/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bot,
  CalendarDays,
  Coins,
  Flag,
  MessageSquareQuote,
  PackageCheck,
  RefreshCw,
  Repeat,
  Sprout,
  Target,
  TrendingUp,
} from "lucide-react";

interface Props {
  data: DashboardData;
}

export default function Overview({ data }: Props) {
  const k = data.kpis;
  const [insights, setInsights] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);
  const autoTriggered = useRef(false);

  const generateInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await fetch("/api/insights", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed");
      setInsights(json.insights);
    } catch (e) {
      toast({
        title: "AI insights unavailable",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    if (!autoTriggered.current && data.orders.length >= 0) {
      autoTriggered.current = true;
      generateInsights();
    }
  }, []);

  const dailyData = data.daily.map((d) => ({
    date: shortDate(d.date),
    Sales: d.sales,
    Target: d.target,
  }));

  const serviceData = Object.entries(k.byService)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }));

  const sourceData = Object.entries(k.bySource)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }));

  // ── Projects in Work (CMS platforms) ─────────────────────────────────────
  // "In work" = any order status NOT in the excluded list below. Add new
  // statuses to this list as the sheet evolves (matching is case-insensitive).
  const IN_WORK_EXCLUDED_STATUSES = ["delivered", "cancelled", "c_forward_sales", "nra"];
  const CMS_PLATFORMS = ["wordpress", "wix", "shopify", "squarespace", "webflow"];
  const CMS_DISPLAY: Record<string, string> = {
    wordpress: "WordPress",
    wix: "Wix",
    shopify: "Shopify",
    squarespace: "Squarespace",
    webflow: "Webflow",
  };
  const normText = (s: string) => String(s ?? "").trim().toLowerCase();

  const inWorkOrders = data.orders.filter((o) => {
    const st = normText(o.status);
    return st !== "" && !IN_WORK_EXCLUDED_STATUSES.includes(st);
  });

  // ONLY these two teams are ever shown — "nothing else" per the manager.
  // Any other department value in the sheet ("STA_Team_Old", blanks, future
  // extra rows) is ignored by this widget entirely.
  const CMS_TEAMS: Array<{ key: string; display: string }> = [
    { key: "saa_team", display: "SAA_Team" },
    { key: "sta_team", display: "STA_Team" },
  ];

  const cmsInWorkTeams = data.orders.filter((o) => {
    const st = normText(o.status);
    return (
      st !== "" &&
      !IN_WORK_EXCLUDED_STATUSES.includes(st) &&
      CMS_PLATFORMS.includes(normText(o.service)) &&
      CMS_TEAMS.some((t) => t.key === normText(o.department))
    );
  });
  const cmsInWork = cmsInWorkTeams; // widget counts ONLY the two teams above

  // exactly two rows, fixed order — SAA_Team then STA_Team
  const teamRows = CMS_TEAMS.map((t) => ({
    display: t.display,
    count: cmsInWork.filter((o) => normText(o.department) === t.key).length,
  }));

  const platformCounts = [...new Set(cmsInWork.map((o) => normText(o.service)))]
    .map((p) => ({
      display: CMS_DISPLAY[p] ?? p,
      count: cmsInWork.filter((o) => normText(o.service) === p).length,
    }))
    .sort((a, b) => b.count - a.count);

  const cards = [
    {
      label: "Month Target",
      value: money(k.monthTarget),
      sub: k.monthLabel,
      icon: Target,
      chip: "bg-accent text-accent-foreground",
    },
    {
      label: "Total Achievement",
      value: money(k.achievement),
      sub: `${k.achievementPct}% of target`,
      icon: TrendingUp,
      chip: "bg-accent text-accent-foreground",
      progress: Math.min(k.achievementPct, 100),
    },
    {
      label: "Away From Target",
      value: money(Math.abs(k.awayFromTarget)),
      sub: k.awayFromTarget > 0 ? "still to go" : "target beaten!",
      icon: Flag,
      chip: k.awayFromTarget > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Green (Fresh) Sales",
      value: money(k.greenSales),
      sub: "brand-new clients",
      icon: Sprout,
      chip: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Repeat Orders",
      value: money(k.repeatOrders),
      sub: "yellow sales",
      icon: Repeat,
      chip: "bg-amber-50 text-amber-700",
    },
    {
      label: "Daily Avg Sales",
      value: money(k.dailyAvgSales),
      sub: `daily target ${money(k.fixedDailyTarget)}`,
      icon: CalendarDays,
      chip: "bg-accent text-accent-foreground",
    },
  ];

  const insightLines = insights
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* KPI cards — one card language: white surface, hairline edge, tonal icon, ink figures */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className="lift relative rounded-xl border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.chip}`}
                aria-hidden="true"
              >
                <c.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">{c.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>
            {typeof c.progress === "number" && (
              <div className="mt-2.5">
                <Progress value={c.progress} className="h-1.5" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* order status chips — one chip style, meaning carried by the dot colour */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { icon: PackageCheck, text: `${k.totalOrders} orders this month`, dot: "bg-stone-500" },
          { text: `${k.deliveredOrders} delivered`, dot: "bg-emerald-600" },
          { text: `${k.wipOrders} in progress`, dot: "bg-amber-500" },
          { icon: MessageSquareQuote, text: `${data.funnel.queries} queries handled`, dot: "bg-teal-700" },
          { icon: Target, text: `${data.funnel.converted} converted (${pct(data.funnel.convRate)})`, dot: "bg-teal-700" },
          { icon: Coins, text: `${money(data.funnel.queryRevenue + data.funnel.briefRevenue)} from queries & briefs`, dot: "bg-stone-500" },
        ].map((chip) => (
          <span
            key={chip.text}
            className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${chip.dot}`} />
            {chip.text}
          </span>
        ))}
      </div>

      {/* Projects in Work — CMS platforms, split by team (flat rows on hairlines, no boxes in boxes) */}
      <Card className="rounded-xl">
        <CardHeader className="pb-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Projects in Work (CMS)</CardTitle>
              <CardDescription>
                CMS-platform orders currently being worked on — excluding Delivered, Cancelled &amp; C_Forward_Sales
              </CardDescription>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight tabular-nums text-primary">{cmsInWork.length}</span>
              <span className="text-sm text-muted-foreground">/ {inWorkOrders.length} active</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          {/* team split — exactly SAA_Team and STA_Team, nothing else */}
          <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
            {teamRows.map((t) => (
              <div key={t.display} className="bg-card px-5 py-4">
                <p className="text-xs font-medium text-muted-foreground">{t.display}</p>
                <p
                  className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${
                    t.count ? "text-foreground" : "text-stone-300"
                  }`}
                >
                  {t.count}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.count === 1 ? "project in work" : "projects in work"}
                </p>
              </div>
            ))}
            {!teamRows.length && (
              <p className="bg-card px-5 py-4 text-sm text-muted-foreground">No teams found in the sheet yet</p>
            )}
          </div>
          {/* platform breakdown chips */}
          {platformCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">By platform</span>
              {platformCounts.map((p) => (
                <Badge
                  key={p.display}
                  variant="outline"
                  className="border-border bg-accent text-accent-foreground"
                >
                  {p.display} ({p.count})
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* funnel mini-strip — same card language as the KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Queries handled", value: String(data.funnel.queries), sub: "dashboard sheet tracking" },
          { label: "Converted", value: String(data.funnel.converted), sub: pct(data.funnel.convRate) + " conversion rate" },
          { label: "Query-sourced sales", value: money(data.funnel.queryRevenue), sub: data.funnel.queryOrders + " orders via Conversion/Query" },
          { label: "Brief-sourced sales", value: money(data.funnel.briefRevenue), sub: data.funnel.briefOrders + " orders via Brief/Invitation" },
        ].map((c) => (
          <div key={c.label} className="lift rounded-xl border bg-card p-3.5">
            <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-foreground">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Daily Sales vs Daily Target</CardTitle>
            <CardDescription>Track the pace of the month — the team's daily rhythm</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {dailyData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#78716c" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#78716c" }} />
                  <Tooltip cursor={{ stroke: "#a8a29e", strokeDasharray: "4 4" }} formatter={(v: number) => money(v)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="Sales"
                    stroke="#0d9488"
                    strokeWidth={2}
                    fill="url(#salesFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Target"
                    stroke="#a8a29e"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-6 w-6 text-stone-300" aria-hidden="true" />
                No daily data in the sheet yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Platform</CardTitle>
            <CardDescription>Where the money comes from</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {serviceData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Order Source</CardTitle>
            <CardDescription>Which channels bring sales</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} layout="vertical" margin={{ top: 0, right: 16, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#78716c" }} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: "#1c1917" }} />
                <Tooltip cursor={{ fill: "#f5f5f4" }} formatter={(v: number) => money(v)} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[(i + 1) % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* AI Insights — the product's one dark surface: AI speaks from ink, not from a gradient */}
        <Card className="relative overflow-hidden border-stone-800 bg-stone-900 text-stone-50 lg:col-span-2">
          <CardHeader className="relative">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-400/15 text-teal-300">
                  <Bot className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle className="text-base text-stone-50">AI Insights</CardTitle>
                  <CardDescription className="text-stone-400">
                    Auto-generated analysis of {k.monthLabel} performance
                  </CardDescription>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={generateInsights}
                disabled={loadingInsights}
                className="shrink-0 border-stone-700 bg-transparent text-stone-200 hover:bg-stone-800 hover:text-stone-50"
              >
                <RefreshCw className={`mr-1 h-4 w-4 ${loadingInsights ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
            </div>
          </CardHeader>
          <CardContent className="relative">
            {loadingInsights ? (
              <div className="space-y-2.5">
                <p className="flex items-center gap-2 text-sm text-teal-300">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> AI is analyzing your sales data…
                </p>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full bg-stone-800" />
                ))}
              </div>
            ) : insightLines.length ? (
              <ul className="space-y-2.5">
                {insightLines.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-stone-200">
                    <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300" />
                    {line.replace(/^[-•*]\s*/, "")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-400">
                Click <span className="font-medium text-teal-300">Regenerate</span> to get a fresh AI analysis of
                your target progress, top members and platform mix.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
