"use client";

import { useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { DashboardData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, FileText, Search } from "lucide-react";

export default function Quotes({ data }: { data: DashboardData }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = data.quotes;
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((t) => t.title.toLowerCase().includes(needle) || t.body.toLowerCase().includes(needle));
  }, [data.quotes, q]);

  const copy = async (text: string, title: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: `${title} copied to clipboard.` });
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Quotation Templates</h2>
          <p className="text-sm text-slate-500">
            {data.quotes.length} templates synced from your sheet — click copy and paste into the client chat
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates…"
            className="pl-8"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              {data.quotes.length ? "No template matches your search." : "No quotation templates found in the sheet yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t, i) => (
            <Card
              key={t.id}
              className="flex flex-col overflow-hidden border-t-4 transition-shadow hover:shadow-md"
              style={{ borderTopColor: ["#8b5cf6", "#f59e0b", "#10b981", "#f43f5e", "#14b8a6", "#ec4899"][i % 6] }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold leading-snug">{t.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pb-2">
                {/* native overflow container — reliable clipping for long quotes */}
                <div className="h-64 overflow-auto rounded-md bg-slate-50 p-3">
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{t.body}</p>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2 pt-2">
                <span className="text-xs text-slate-400">{t.body.length} chars</span>
                <Button
                  size="sm"
                  onClick={() => copy(t.body, t.title)}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90"
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
