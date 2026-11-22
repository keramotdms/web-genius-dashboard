"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  FileText,
  Globe,
  LayoutDashboard,
  MessageSquareText,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";
import { money } from "@/components/dashboard/shared";
import Overview from "@/components/dashboard/overview";
import Members from "@/components/dashboard/members";
import Quotes from "@/components/dashboard/quotes";
import References from "@/components/dashboard/references";
import Instructions from "@/components/dashboard/instructions";
import OrdersManager from "@/components/dashboard/orders-manager";

interface ApiResp {
  ok: boolean;
  syncedAt: string;
  source: string;
  data: DashboardData;
}

/**
 * Parse an API response safely. Serverless platforms (Vercel) answer with an
 * EMPTY or HTML body when a function crashes or times out — res.json() would
 * throw the cryptic "Unexpected end of JSON input". This returns a readable
 * error instead, with the HTTP status for diagnosis.
 */
async function readApi<T>(res: Response): Promise<T & { error?: string }> {
  const text = await res.text().catch(() => "");
  if (!text.trim()) {
    const hint =
      res.status === 504 || res.status === 500
        ? "Server function crashed or timed out. Open /api/health in a new tab to find the cause, then check Vercel → Deployment → Runtime Logs."
        : `Server responded with status ${res.status} and an empty body.`;
    throw new Error(`Sync failed (${res.status}). ${hint}`);
  }
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    const isHtml = text.trimStart().startsWith("<");
    throw new Error(
      isHtml
        ? `Sync failed (${res.status}) — the server returned an HTML error page instead of data. Open /api/health to diagnose.`
        : `Sync failed (${res.status}) — server response was not valid JSON. Open /api/health to diagnose.`
    );
  }
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [syncedAt, setSyncedAt] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const reloadTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/data${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const json = await readApi<ApiResp>(res);
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to sync");
      setData(json.data);
      setSyncedAt(json.syncedAt);
      setSource(json.source);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sync sheet data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // silent refresh (no skeleton) — used after order add/edit/delete
  const softReload = useCallback(async () => {
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      const json = await readApi<ApiResp>(res);
      if (!res.ok || !json.ok) return;
      setData(json.data);
      setSyncedAt(json.syncedAt);
      setSource(json.source);
      setError("");
    } catch {
      /* keep the current view on transient failures */
    }
  }, []);

  useEffect(() => {
    load();
    reloadTimer.current = setInterval(() => load(), 5 * 60 * 1000);
    return () => {
      if (reloadTimer.current) clearInterval(reloadTimer.current);
    };
  }, [load]);

  // jump back to the top when the user switches sections
  const onTabChange = (v: string) => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    void v;
  };

  const syncTime = syncedAt ? new Date(syncedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-violet-50 via-white to-amber-50">
      {/* ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-fuchsia-200/25 blur-3xl" />
        <div className="absolute -right-40 top-2/3 h-96 w-96 rounded-full bg-teal-200/25 blur-3xl" />
        <div className="absolute left-1/3 -top-40 h-96 w-96 rounded-full bg-violet-200/20 blur-3xl" />
      </div>
      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-r from-violet-700 via-fuchsia-600 to-rose-500 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 md:flex-row md:items-center md:justify-between md:py-7">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                Web Genius AI Dashboard
              </h1>
              <p className="text-sm text-white/85">
                {data
                  ? `${data.monthLabel} sales, queries, quotations, references & instructions — all in one place`
                  : "Live-synced from your Google Sheets"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data && (
              <>
                <div className="hidden items-center gap-3 rounded-2xl bg-white/15 px-4 py-2 text-sm backdrop-blur md:flex">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-white/70">Achievement</p>
                    <p className="font-bold">{money(data.kpis.achievement)}</p>
                  </div>
                  <div className="h-6 w-px bg-white/25" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-white/70">Queries</p>
                    <p className="font-bold">
                      {data.funnel.queries} · {Math.round(data.funnel.convRate * 100)}%
                    </p>
                  </div>
                  <div className="h-6 w-px bg-white/25" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-white/70">Orders</p>
                    <p className="font-bold">{data.kpis.totalOrders}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/20">
                  {data.monthLabel}
                </Badge>
              </>
            )}
            <Badge
              variant="secondary"
              className="bg-white/20 text-white hover:bg-white/20"
              title={source}
            >
              <span className="relative mr-1.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              {syncTime ? `Synced ${syncTime}` : "Syncing…"}
            </Badge>
            <Button
              size="sm"
              onClick={() => load(true)}
              disabled={refreshing}
              className="bg-white text-fuchsia-700 hover:bg-white/90"
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Syncing…" : "Sync now"}
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-[1] mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Sync failed</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={() => load(true)}>
                <RefreshCw className="mr-1 h-4 w-4" /> Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {loading && !data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : data ? (
          <Tabs defaultValue="overview" onValueChange={onTabChange} className="w-full">
            <div className="mb-6 overflow-x-auto pb-1">
              <TabsList className="h-auto w-max gap-1 rounded-2xl border bg-white/80 p-1.5 shadow-sm backdrop-blur">
                {[
                  { v: "overview", icon: LayoutDashboard, label: "Overview", active: "data-[state=active]:bg-violet-600" },
                  { v: "orders", icon: ShoppingCart, label: "Orders", active: "data-[state=active]:bg-fuchsia-600" },
                  { v: "members", icon: Users, label: "Members & Conversion", active: "data-[state=active]:bg-emerald-600" },
                  { v: "quotes", icon: FileText, label: "Quotations", active: "data-[state=active]:bg-amber-500" },
                  { v: "references", icon: Globe, label: "References", active: "data-[state=active]:bg-teal-600" },
                  { v: "messages", icon: MessageSquareText, label: "Instructions & Messages", active: "data-[state=active]:bg-rose-500" },
                ].map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className={`gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 ${t.active} data-[state=active]:text-white`}
                  >
                    <t.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="overview" className="mt-0">
              <Overview data={data} />
            </TabsContent>
            <TabsContent value="orders" className="mt-0">
              <OrdersManager data={data} reload={softReload} />
            </TabsContent>
            <TabsContent value="members" className="mt-0">
              <Members data={data} />
            </TabsContent>
            <TabsContent value="quotes" className="mt-0">
              <Quotes data={data} />
            </TabsContent>
            <TabsContent value="references" className="mt-0">
              <References data={data} reload={() => load(true)} />
            </TabsContent>
            <TabsContent value="messages" className="mt-0">
              <Instructions data={data} />
            </TabsContent>
          </Tabs>
        ) : null}
      </main>

      <footer className="relative z-[1] mt-auto border-t bg-white/60 py-4 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500">
          Web Genius AI Dashboard · orders live in your dashboard database (editable in the Orders tab) · quotes & references auto-sync every 5 minutes with your Google Sheet
          {source ? ` · source: ${source}` : ""}
        </div>
      </footer>
    </div>
  );
}
