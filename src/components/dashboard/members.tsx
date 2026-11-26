"use client";

import { useMemo, useState } from "react";
import type { DashboardData, MemberPerf } from "@/lib/types";
import { CMS_SALES_TEAM, isCmsSalesMember, normKey } from "@/lib/cms-team";
import { CHART_COLORS, money, pct } from "@/components/dashboard/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  ClipboardList,
  Crown,
  Filter,
  MessageSquareQuote,
  Send,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";

type SortKey = "achievement" | "target" | "green" | "yellow" | "orders" | "convRatio" | "queryRevenue";
type TeamFilter = "all" | "cms";

function TeamChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1 ${
        active
          ? "border-violet-600 bg-violet-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-violet-400 hover:text-violet-700"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

export default function Members({ data }: { data: DashboardData }) {
  const [sortKey, setSortKey] = useState<SortKey>("achievement");
  const [asc, setAsc] = useState(false);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const funnel = data.funnel;

  // CMS roster members that have no rows in the sheet yet — shown as zero rows
  // in the CMS view so the manager still sees the full team list
  const cmsPlaceholders = useMemo<MemberPerf[]>(() => {
    const known = new Set(data.members.map((m) => normKey(m.name)));
    return CMS_SALES_TEAM.filter((listed) => !known.has(normKey(listed))).map((listed) => ({
      name: listed,
      target: 0,
      achievement: 0,
      green: 0,
      yellow: 0,
      gap: 0,
      orders: 0,
      queries: 0,
      converted: 0,
      convRatio: 0,
      hasTarget: false,
      queryOrders: 0,
      queryRevenue: 0,
      briefOrders: 0,
      briefRevenue: 0,
      placeholder: true,
    }));
  }, [data.members]);

  const visibleMembers = useMemo(
    () => (teamFilter === "cms" ? [...data.members.filter((m) => isCmsSalesMember(m.name)), ...cmsPlaceholders] : data.members),
    [data.members, teamFilter, cmsPlaceholders]
  );

  const topPerformer = useMemo(
    () =>
      visibleMembers.reduce(
        (best, m) => (m.achievement > best.achievement ? m : best),
        visibleMembers[0] ?? { name: "", achievement: 0 } as MemberPerf
      ),
    [visibleMembers]
  );

  const sorted = useMemo(() => {
    const arr = [...visibleMembers];
    arr.sort((a, b) => {
      const diff = (b[sortKey] as number) - (a[sortKey] as number);
      return asc ? -diff : diff;
    });
    return arr;
  }, [visibleMembers, sortKey, asc]);

  const chartData = useMemo(
    () =>
      [...visibleMembers]
        .filter((m) => m.achievement > 0 || m.target > 0)
        .sort((a, b) => b.achievement - a.achievement)
        .slice(0, 10)
        .map((m) => ({
          name: m.name.split(" ").slice(-2).join(" "),
          Achievement: m.achievement,
          Target: m.target,
        })),
    [visibleMembers]
  );

  const withTarget = data.members.filter((m) => m.hasTarget).length;
  const cmsCount = data.members.filter((m) => isCmsSalesMember(m.name)).length + cmsPlaceholders.length;

  const head: Array<{ key: SortKey | null; label: string; cls?: string }> = [
    { key: null, label: "Member" },
    { key: "target", label: "Target" },
    { key: "achievement", label: "Achievement" },
    { key: "green", label: "Green" },
    { key: "yellow", label: "Yellow" },
    { key: null, label: "Progress" },
    { key: null, label: "Gap" },
    { key: "orders", label: "Orders" },
    { key: null, label: "Queries" },
    { key: null, label: "Query Sales" },
    { key: "convRatio", label: "Conv." },
  ];

  const toggleSort = (key: SortKey | null) => {
    if (!key) return;
    if (key === sortKey) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(false);
    }
  };

  // funnel visual: counts only (queries = full width, converted proportional)
  const totalRevenueHint = data.kpis.achievement || 1;
  const funnelSteps = [
    { label: "Queries handled", value: funnel.queries, color: "from-violet-500 to-purple-600", icon: MessageSquareQuote, widthPct: 100 },
    {
      label: "Converted to orders",
      value: funnel.converted,
      color: "from-emerald-500 to-teal-600",
      icon: Target,
      widthPct: funnel.queries ? Math.max((funnel.converted / funnel.queries) * 100, 2) : 2,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
          {data.members.length} members
        </Badge>
        <Badge className="border-0 bg-violet-100 text-violet-800 hover:bg-violet-100">
          {withTarget} with targets
        </Badge>
        {topPerformer?.achievement > 0 && (
          <Badge className="gap-1 border-0 bg-amber-100 text-amber-800 hover:bg-amber-100">
            <Crown className="h-3.5 w-3.5" /> Top performer: {topPerformer.name} ({money(topPerformer.achievement)})
          </Badge>
        )}
      </div>

      {/* ── Team filter ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <UsersRound className="h-4 w-4 text-violet-500" aria-hidden="true" /> Team filter
        </span>
        <div className="flex flex-wrap gap-2">
          <TeamChip active={teamFilter === "all"} onClick={() => setTeamFilter("all")}>
            All Members ({data.members.length})
          </TeamChip>
          <TeamChip active={teamFilter === "cms"} onClick={() => setTeamFilter("cms")} icon={<UsersRound className="h-3.5 w-3.5" />}>
            CMS Sales Team ({cmsCount})
          </TeamChip>
        </div>
        <p className="w-full text-[11px] text-slate-400 sm:w-auto sm:flex-1 sm:text-right">
          filters the Top-10 chart &amp; individual table below
        </p>
      </div>

      {/* ── Query → Sales Conversion Funnel ── */}
      <Card className="overflow-hidden border-violet-200">
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 px-6 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <div>
                <h2 className="font-semibold">Query &rarr; Sales Conversion Funnel</h2>
                <p className="text-xs text-white/85">
                  How many queries &amp; briefs each channel produced — and how much sales they closed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              Conversion rate: {pct(funnel.convRate)}
            </div>
          </div>
        </div>
        <CardContent className="space-y-5 pt-5">
          {/* funnel bars */}
          <div className="space-y-3">
            {funnelSteps.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="flex w-44 shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
                  <s.icon className="h-4 w-4 text-violet-500" /> {s.label}
                </div>
                <div className="h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
                  <div
                    className={`h-full rounded-lg bg-gradient-to-r ${s.color} transition-[width] duration-500`}
                    style={{ width: `${s.widthPct}%` }}
                  />
                </div>
                <div className="w-24 shrink-0 text-right text-sm font-bold text-slate-800">
                  {s.value}
                </div>
              </div>
            ))}
            {/* revenue bar — own scale */}
            <div className="flex items-center gap-3">
              <div className="flex w-44 shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
                <TrendingUp className="h-4 w-4 text-amber-500" /> Revenue from queries
              </div>
              <div className="h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
                <div
                  className="h-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 transition-[width] duration-500"
                  style={{ width: `${Math.max(Math.min((funnel.queryRevenue / Math.max(totalRevenueHint, 1)) * 100, 100), 2)}%` }}
                />
              </div>
              <div className="w-24 shrink-0 text-right text-sm font-bold text-slate-800">{money(funnel.queryRevenue)}</div>
            </div>
          </div>

          {/* funnel stat chips */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-violet-700">
                <MessageSquareQuote className="h-3.5 w-3.5" /> Queries handled
              </p>
              <p className="mt-1 text-xl font-bold text-violet-900">{funnel.queries}</p>
              <p className="text-[11px] text-violet-600">tracked on the dashboard sheet</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Target className="h-3.5 w-3.5" /> Queries converted
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-900">{funnel.converted}</p>
              <p className="text-[11px] text-emerald-600">{pct(funnel.convRate)} of all queries</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <ClipboardList className="h-3.5 w-3.5" /> Query-sourced sales
              </p>
              <p className="mt-1 text-xl font-bold text-amber-900">{money(funnel.queryRevenue)}</p>
              <p className="text-[11px] text-amber-600">{funnel.queryOrders} orders from Conversion/Query</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-sky-700">
                <Send className="h-3.5 w-3.5" /> Brief-sourced sales
              </p>
              <p className="mt-1 text-xl font-bold text-sky-900">{money(funnel.briefRevenue)}</p>
              <p className="text-[11px] text-sky-600">{funnel.briefOrders} orders from Brief/Invitation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Order source performance ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order Source Performance</CardTitle>
          <CardDescription>
            Every channel the team sells through — how many orders and how much revenue each brings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* native overflow container — Radix ScrollArea fails to clip this table
              and rows used to escape below the page footer */}
          <div className="w-full overflow-x-auto rounded-md border">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Source</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>% of Revenue</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>In Progress</TableHead>
                  <TableHead>Avg Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sourceStats.map((s, i) => (
                  <TableRow key={s.source}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        {s.source}
                      </span>
                    </TableCell>
                    <TableCell>{s.orders}</TableCell>
                    <TableCell className="font-semibold text-emerald-700">{money(s.revenue)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{ width: `${Math.min(s.pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{s.pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-emerald-600">{s.delivered}</TableCell>
                    <TableCell className="text-amber-600">{s.wip}</TableCell>
                    <TableCell>{money(s.avg)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Achievement vs Target — Top 10</CardTitle>
          <CardDescription>
            Green bars are actual sales, violet bars are the monthly target
            {teamFilter === "cms" ? " · showing CMS Sales Team only" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => money(v)} />
              <Legend />
              <Bar dataKey="Target" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} barSize={9} />
              <Bar dataKey="Achievement" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} barSize={9}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[1]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Individual Performance</CardTitle>
          <CardDescription>
            {teamFilter === "cms" ? `CMS Sales Team · ` : ""}
            showing {sorted.length} of {data.members.length} members &middot; click a column header to sort &middot;
            queries &amp; conversion come from the dashboard sheet, query sales are computed from order rows
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* native overflow container with sticky header — reliable clipping */}
          <div className="max-h-[560px] w-full overflow-auto rounded-md border">
            <Table className="min-w-[980px]">
              <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
                <TableRow>
                  {head.map((h) => (
                    <TableHead
                      key={h.label}
                      aria-sort={h.key && h.key === sortKey ? (asc ? "ascending" : "descending") : undefined}
                    >
                      {h.key ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(h.key)}
                          className="inline-flex items-center gap-0.5 rounded font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                        >
                          {h.label}
                          <span aria-hidden="true">{h.key === sortKey ? (asc ? " ↑" : " ↓") : ""}</span>
                        </button>
                      ) : (
                        h.label
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((m) => {
                  const pctVal = m.target > 0 ? Math.min(Math.round((m.achievement / m.target) * 100), 100) : 0;
                  const over = m.target > 0 && m.achievement > m.target;
                  return (
                    <TableRow key={m.name} className={m.placeholder ? "opacity-70" : undefined}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {m.name}
                          {m.name === topPerformer?.name && topPerformer.achievement > 0 && (
                            <Award className="h-4 w-4 text-amber-500" aria-hidden="true" />
                          )}
                          {m.placeholder && (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-normal text-slate-400">
                              no sheet data yet
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">{m.hasTarget ? money(m.target) : "—"}</TableCell>
                      <TableCell className="font-semibold tabular-nums text-emerald-700">{money(m.achievement)}</TableCell>
                      <TableCell className="tabular-nums text-lime-700">{money(m.green)}</TableCell>
                      <TableCell className="tabular-nums text-amber-700">{money(m.yellow)}</TableCell>
                      <TableCell className="min-w-[140px]">
                        {m.hasTarget ? (
                          <div className="flex items-center gap-2">
                            <Progress value={pctVal} className="h-2 w-24" />
                            <span className="text-xs text-slate-500">{pctVal}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">no target</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.hasTarget ? (
                          <span className={over ? "font-medium text-emerald-600" : "text-rose-600"}>
                            {over ? "+" : "−"}
                            {money(Math.abs(m.gap)).slice(1)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{m.orders}</TableCell>
                      <TableCell className="tabular-nums">{m.queries || "—"}</TableCell>
                      <TableCell className="font-medium tabular-nums text-amber-700">
                        {m.queryRevenue ? money(m.queryRevenue) : "—"}
                      </TableCell>
                      <TableCell>
                        {m.queries ? (
                          <Badge
                            variant="outline"
                            className={
                              m.convRatio >= 0.3
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : m.convRatio > 0
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-slate-200 bg-slate-50 text-slate-500"
                            }
                          >
                            {pct(m.convRatio)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
