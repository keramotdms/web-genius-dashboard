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
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* skip link — keyboard users reach the content without tabbing the header */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      {/* Header — raised graphite surface on a hairline, ink text, one accent */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-foreground md:text-lg">
                Web Genius AI Dashboard
              </h1>
              <p className="truncate text-xs text-muted-foreground md:text-sm">
                {data
                  ? `${data.monthLabel} sales, queries, quotations, references & instructions — all in one place`
                  : "Live-synced from your Google Sheets"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {data && (
              <>
                {/* quiet month readout — figures in ink, labels in muted */}
                <div className="hidden items-center gap-4 rounded-lg border bg-background px-4 py-1.5 md:flex">
                  <div className="text-right">
                    <p className="text-[10px] leading-tight text-muted-foreground">Achievement</p>
                    <p className="text-sm font-semibold tabular-nums">{money(data.kpis.achievement)}</p>
                  </div>
                  <div className="h-7 w-px bg-border" />
                  <div className="text-right">
                    <p className="text-[10px] leading-tight text-muted-foreground">Queries</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {data.funnel.queries} ({Math.round(data.funnel.convRate * 100)}%)
                    </p>
                  </div>
                  <div className="h-7 w-px bg-border" />
                  <div className="text-right">
                    <p className="text-[10px] leading-tight text-muted-foreground">Orders</p>
                    <p className="text-sm font-semibold tabular-nums">{data.kpis.totalOrders}</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-border bg-background text-muted-foreground">
                  {data.monthLabel}
                </Badge>
              </>
            )}
            <Badge
              variant="outline"
              className="gap-1.5 border-border bg-background text-muted-foreground"
              title={source}
            >
              <span aria-hidden="true" className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {syncTime ? `Synced ${syncTime}` : "Syncing…"}
            </Badge>
            <Button size="sm" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Syncing…" : "Sync now"}
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="relative z-[1] mx-auto w-full max-w-7xl flex-1 px-4 py-6">
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
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : data ? (
          <Tabs defaultValue="overview" onValueChange={onTabChange} className="w-full">
            {/* one navigation system: every tab answers the same way — the active one is the accent */}
            <div className="mb-6 overflow-x-auto pb-1">
              <TabsList className="h-auto w-max gap-1 rounded-xl border bg-card p-1 shadow-none">
                {[
                  { v: "overview", icon: LayoutDashboard, label: "Overview" },
                  { v: "orders", icon: ShoppingCart, label: "Orders" },
                  { v: "members", icon: Users, label: "Members & Conversion" },
                  { v: "quotes", icon: FileText, label: "Quotations" },
                  { v: "references", icon: Globe, label: "References" },
                  { v: "messages", icon: MessageSquareText, label: "Instructions & Messages" },
                ].map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    aria-label={t.label}
                    className="gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none"
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

      <footer className="relative mt-auto border-t bg-card py-4">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-muted-foreground">
          Orders live in your dashboard database (editable in the Orders tab). Quotes &amp; references auto-sync with
          your Google Sheet every 5 minutes.{source ? ` Source: ${source}.` : ""}
        </div>
      </footer>
    </div>
  );
}
