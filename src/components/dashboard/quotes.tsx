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
          <p className="text-sm text-muted-foreground">
            {data.quotes.length} templates synced from your sheet — click copy and paste into the client chat
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search quotation templates"
            autoComplete="off"
            placeholder="Search templates…"
            className="pl-8"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-10 w-10 text-stone-300" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              {data.quotes.length ? "No template matches your search." : "No quotation templates found in the sheet yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <Card
              key={t.id}
              className="lift flex flex-col overflow-hidden rounded-xl"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold leading-snug">{t.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pb-2">
                {/* native overflow container — reliable clipping for long quotes */}
                <div className="h-64 overflow-auto rounded-md bg-muted p-3">
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">{t.body}</p>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2 pt-2">
                <span className="text-xs text-muted-foreground">{t.body.length} chars</span>
                <Button size="sm" onClick={() => copy(t.body, t.title)}>
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
