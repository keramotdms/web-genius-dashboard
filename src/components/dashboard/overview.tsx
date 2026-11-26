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
      cls: "from-violet-500 to-purple-600",
    },
    {
      label: "Total Achievement",
      value: money(k.achievement),
      sub: `${k.achievementPct}% of target`,
      icon: TrendingUp,
      cls: "from-emerald-500 to-teal-600",
      progress: Math.min(k.achievementPct, 100),
    },
    {
      label: "Away From Target",
      value: money(Math.abs(k.awayFromTarget)),
      sub: k.awayFromTarget > 0 ? "still to go" : "target beaten!",
      icon: Flag,
      cls: k.awayFromTarget > 0 ? "from-orange-500 to-rose-500" : "from-lime-500 to-emerald-600",
    },
    {
      label: "Green (Fresh) Sales",
      value: money(k.greenSales),
      sub: "brand-new clients",
      icon: Sprout,
      cls: "from-lime-500 to-emerald-600",
    },
    {
      label: "Repeat Orders",
      value: money(k.repeatOrders),
      sub: "yellow sales",
      icon: Repeat,
      cls: "from-amber-500 to-orange-600",
    },
    {
      label: "Daily Avg Sales",
      value: money(k.dailyAvgSales),
      sub: `daily target ${money(k.fixedDailyTarget)}`,
      icon: CalendarDays,
      cls: "from-teal-500 to-cyan-600",
    },
  ];

  const insightLines = insights
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.cls} p-4 text-white shadow-md transition-transform hover:scale-[1.02]`}
          >
            <c.icon className="absolute right-3 top-3 h-8 w-8 text-white/30" aria-hidden="true" />
            <p className="pr-9 text-xs font-medium text-white/85">{c.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
            <p className="mt-0.5 text-xs text-white/75">{c.sub}</p>
            {typeof c.progress === "number" && (
              <div className="mt-2">
                <Progress value={c.progress} className="h-1.5 bg-white/25" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* order status chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="gap-1 border-0 bg-violet-100 text-violet-800 hover:bg-violet-100">
          <PackageCheck className="h-3.5 w-3.5" /> {k.totalOrders} orders this month
        </Badge>
        <Badge className="border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
          {k.deliveredOrders} delivered
        </Badge>
        <Badge className="border-0 bg-amber-100 text-amber-900 hover:bg-amber-100">
          {k.wipOrders} in progress
        </Badge>
        <Badge className="gap-1 border-0 bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-100">
          <MessageSquareQuote className="h-3.5 w-3.5" /> {data.funnel.queries} queries handled
        </Badge>
        <Badge className="gap-1 border-0 bg-teal-100 text-teal-800 hover:bg-teal-100">
          <Target className="h-3.5 w-3.5" /> {data.funnel.converted} converted ({pct(data.funnel.convRate)})
        </Badge>
        <Badge className="gap-1 border-0 bg-sky-100 text-sky-800 hover:bg-sky-100">
          <Coins className="h-3.5 w-3.5" /> {money(data.funnel.queryRevenue + data.funnel.briefRevenue)} from queries &amp; briefs
        </Badge>
      </div>

      {/* Projects in Work — CMS platforms, split by team */}
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Projects in Work (CMS)</CardTitle>
              <CardDescription>
                CMS-platform orders currently being worked on — excluding Delivered, Cancelled &amp; C_Forward_Sales
              </CardDescription>
            </div>
            <div className="flex items-baseline gap-1.5 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 px-4 py-2 text-white shadow-sm">
              <span className="text-2xl font-bold">{cmsInWork.length}</span>
              <span className="text-xs text-white/80">/ {inWorkOrders.length} active</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* team split — exactly SAA_Team and STA_Team, nothing else */}
          <div className="grid gap-3 sm:grid-cols-2">
            {teamRows.map((t) => (
              <div
                key={t.display}
                className="rounded-xl border border-indigo-100 bg-white/80 p-3 text-center shadow-sm"
              >
                <p className="truncate text-xs font-semibold text-slate-500">{t.display}</p>
                <p className={`mt-0.5 text-2xl font-bold ${t.count ? "text-indigo-700" : "text-slate-300"}`}>
                  {t.count}
                </p>
                <p className="text-[10px] text-slate-400">
                  {t.count === 1 ? "project in work" : "projects in work"}
                </p>
              </div>
            ))}
            {!teamRows.length && (
              <p className="text-sm text-slate-400">No teams found in the sheet yet</p>
            )}
          </div>
          {/* platform breakdown chips */}
          {platformCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-medium text-slate-400">By platform</span>
              {platformCounts.map((p) => (
                <Badge key={p.display} className="border-0 bg-indigo-100 text-indigo-800 hover:bg-indigo-100">
                  {p.display} ({p.count})
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* conversion funnel mini-strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Queries handled", value: String(data.funnel.queries), sub: "dashboard sheet tracking", cls: "from-violet-500 to-purple-600" },
          { label: "Converted", value: String(data.funnel.converted), sub: pct(data.funnel.convRate) + " conversion rate", cls: "from-emerald-500 to-teal-600" },
          { label: "Query-sourced sales", value: money(data.funnel.queryRevenue), sub: data.funnel.queryOrders + " orders via Conversion/Query", cls: "from-amber-500 to-orange-600" },
          { label: "Brief-sourced sales", value: money(data.funnel.briefRevenue), sub: data.funnel.briefOrders + " orders via Brief/Invitation", cls: "from-sky-500 to-blue-600" },
        ].map((c) => (
          <div key={c.label} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${c.cls} p-3.5 text-white shadow-sm transition-transform hover:scale-[1.02]`}>
            <p className="text-[11px] font-medium text-white/85">{c.label}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums">{c.value}</p>
            <p className="text-[10px] text-white/75">{c.sub}</p>
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
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="Sales"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#salesFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Target"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[(i + 1) % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card className="relative overflow-hidden border-violet-200 lg:col-span-2">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-50 via-transparent to-fuchsia-50" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">AI Insights</CardTitle>
                  <CardDescription>Auto-generated analysis of {k.monthLabel} performance</CardDescription>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={generateInsights}
                disabled={loadingInsights}
                className="shrink-0 border-violet-300 text-violet-700 hover:bg-violet-50"
              >
                <RefreshCw className={`mr-1 h-4 w-4 ${loadingInsights ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
            </div>
          </CardHeader>
          <CardContent className="relative">
            {loadingInsights ? (
              <div className="space-y-2.5">
                <p className="flex items-center gap-2 text-sm text-violet-700">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> AI is analyzing your sales data…
                </p>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : insightLines.length ? (
              <ul className="space-y-2.5">
                {insightLines.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                    {line.replace(/^[-•*]\s*/, "")}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                Click <span className="font-medium text-violet-700">Regenerate</span> to get a fresh AI analysis of
                your target progress, top members and platform mix.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
