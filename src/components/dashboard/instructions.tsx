"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { DashboardData } from "@/lib/types";
import { timeAgo } from "@/components/dashboard/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BookOpen, ExternalLink, MessageSquareText, Send, StickyNote, User } from "lucide-react";

interface Msg {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export default function Instructions({ data }: { data: DashboardData }) {
  const totalItems = data.instructions.reduce((s, sec) => s + sec.items.length, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Instructions */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-rose-500" /> Instruction Sheets
          </CardTitle>
          <CardDescription>
            {data.instructions.length} sections · {totalItems} how-to documents to send clients when requesting platform
            access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.instructions.length ? (
            <Accordion
              type="multiple"
              defaultValue={data.instructions.slice(0, 1).map((s) => s.section)}
              className="w-full"
            >
              {data.instructions.map((sec) => (
                <AccordionItem key={sec.section} value={sec.section}>
                  <AccordionTrigger className="text-sm font-semibold">
                    <span className="flex items-center gap-2">
                      {sec.section}
                      <Badge variant="outline" className="text-[10px] text-slate-500">
                        {sec.items.length}
                      </Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {sec.items.map((item) => (
                        <a
                          key={item.link}
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-start gap-2 rounded-lg border bg-white p-2.5 transition-colors hover:border-rose-300 hover:bg-rose-50/40"
                        >
                          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-rose-500" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug text-slate-700 group-hover:text-rose-700">
                              {item.title}
                            </p>
                            {item.note && <p className="mt-0.5 text-xs italic text-amber-700">{item.note}</p>}
                          </div>
                        </a>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              No instruction sheets found in the sheet yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Messages */}
      <MessagesBoard />
    </div>
  );
}

function MessagesBoard() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setMessages(json.messages ?? []);
    } catch {
      // silent — list stays as is
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async () => {
    if (!author.trim() || !content.trim()) {
      toast({ title: "Both fields are required", description: "Add your name and the message." });
      return;
    }
    setPosting(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, content }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to post");
      setContent("");
      await load();
      toast({ title: "Message posted", description: "Your team can see it now." });
    } catch (e) {
      toast({
        title: "Could not post",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Card className="flex flex-col lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="h-5 w-5 text-fuchsia-500" /> Team Messages
        </CardTitle>
        <CardDescription>Share notes, instructions and reminders with the whole team</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="space-y-2">
          <Input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            name="author"
            autoComplete="off"
            aria-label="Your name"
            placeholder="Your name…"
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            name="message"
            aria-label="Message"
            placeholder="Write a message… (e.g. 'Client meeting at 5pm, prepare Shopify quote')"
            rows={3}
          />
          <Button
            onClick={post}
            disabled={posting}
            className="w-full bg-gradient-to-r from-fuchsia-600 to-rose-500 text-white hover:opacity-90"
          >
            <Send className="mr-1.5 h-4 w-4" />
            {posting ? "Posting…" : "Post message"}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : messages.length ? (
          <div className="max-h-[420px] min-h-0 flex-1 overflow-auto rounded-md border">
            <div className="space-y-2 p-3">
              {messages.map((m) => (
                <div key={m.id} className="flex gap-2.5 rounded-xl border bg-white p-3">
                  <div
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-rose-500 text-xs font-bold text-white"
                  >
                    {m.author.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1 text-sm font-semibold text-slate-800">
                        <User className="h-3 w-3 text-slate-400" />
                        {m.author}
                      </p>
                      <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(m.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{m.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed py-10 text-center">
            <StickyNote className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">No messages yet — be the first to post one!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
