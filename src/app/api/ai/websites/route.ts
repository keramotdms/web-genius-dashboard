import { NextRequest, NextResponse } from "next/server";
import { loadDashboardData } from "@/lib/orders-store";
import { aiConfigured, geminiText, geminiGroundedJson, extractGroundedUrls } from "@/lib/gemini";
import type { RefSite } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

interface MatchResult {
  url: string;
  platform: string;
  category: string;
  websiteCategory?: string;
  businessCategory?: string;
  reason: string;
}

const STOPWORDS = new Set([
  "for", "with", "and", "or", "the", "a", "an", "of", "to", "in", "on", "my", "our",
  "client", "clients", "need", "needs", "needss", "want", "wants", "looking", "show",
  "example", "examples", "reference", "references", "site", "sites", "website",
  "websites", "web", "page", "pages", "please", "some", "any", "best", "good",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9&]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** Keyword-overlap scorer used when Gemini is unavailable. */
function keywordMatches(refs: RefSite[], requirement: string): MatchResult[] {
  const reqTokens = tokens(requirement);
  if (!reqTokens.length) return [];
  const scored = refs.map((r) => {
    const hay = tokens(
      `${r.platform} ${r.websiteCategory} ${r.businessCategory} ${r.category} ${(r.labels ?? []).join(" ")} ${r.url.replace(/^https?:\/\//, "").replace(/[/-]/g, " ")}`,
    );
    const haySet = new Set(hay);
    const hit = reqTokens.filter((t) => haySet.has(t));
    const partial = reqTokens.filter((t) => !hit.includes(t) && hay.some((h) => h.startsWith(t) || t.startsWith(h)));
    const score = hit.length * 2 + partial.length;
    return { r, score, hit: [...hit, ...partial] };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ r, hit }) => ({
      url: r.url,
      platform: r.platform,
      category: r.category,
      websiteCategory: r.websiteCategory,
      businessCategory: r.businessCategory,
      reason: `Library keyword match: ${hit.slice(0, 3).join(", ")} — ${r.platform} ${r.websiteCategory} (${r.businessCategory}).`,
    }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const requirement = String(body?.requirement ?? "").trim();
    if (requirement.length < 3) {
      return NextResponse.json({ ok: false, error: "Please describe your requirement first." }, { status: 400 });
    }

    const data = await loadDashboardData();
    const refs: RefSite[] = data.references;

    let matches: MatchResult[] = [];
    let usedAi = false;

    // 1) Match against the team's own reference library (Gemini, else keyword fallback)
    if (aiConfigured() && refs.length) {
      try {
        const catalog = refs
          .slice(0, 400)
          .map((r, i) => `${i}|${r.platform}|${r.websiteCategory}|${r.businessCategory}|${r.url}`)
          .join("\n");

        const prompt = `You help a web-development sales team pick reference websites to show clients.

CLIENT REQUIREMENT: "${requirement}"

REFERENCE LIBRARY (index|CMS platform|website category|business category|url):
${catalog}

Task: pick the 5 BEST references from the library for this requirement. Match the business type and niche category first (e.g. jewelry, fashion, law firm, restaurant); CMS platform and website type are secondary. If none genuinely fit, return fewer.
Return ONLY a compact JSON array (no markdown fences): [{"i": <index>, "reason": "<one short sentence why this fits>"}]`;

        const raw = (
          await geminiText(
            "You return only valid compact JSON. No commentary.",
            prompt,
            { temperature: 0.2, maxOutputTokens: 700, timeoutMs: 45_000 },
          )
        )
          .replace(/```json|```/g, "")
          .trim();
        const start = raw.indexOf("[");
        const end = raw.lastIndexOf("]");
        if (start >= 0 && end > start) {
          const parsed = JSON.parse(raw.slice(start, end + 1)) as Array<{ i: number; reason: string }>;
          matches = parsed
            .map((p) => ({ r: refs[p.i], reason: String(p.reason ?? "") }))
            .filter((p) => p.r)
            .map((p) => ({
              url: p.r.url,
              platform: p.r.platform,
              category: p.r.category,
              websiteCategory: p.r.websiteCategory,
              businessCategory: p.r.businessCategory,
              reason: p.reason,
            }));
          usedAi = true;
        }
      } catch (e) {
        console.error("Gemini library match failed, using keyword fallback:", e);
      }
    }
    if (!matches.length) {
      matches = keywordMatches(refs, requirement);
    }

    // 2) Fresh suggestions from the web (Gemini Search grounding — free tier)
    let web: Array<{ url: string; name: string; snippet: string }> = [];
    if (aiConfigured()) {
      try {
        const json = await geminiGroundedJson(
          "You suggest real, relevant websites as examples for a web development sales team.",
          `Find 5-6 real live website examples that fit this client requirement: "${requirement}". Prefer well-known, publicly reachable sites. The search tool is enabled — use it.`,
          { temperature: 0.2, maxOutputTokens: 500, timeoutMs: 45_000 },
        );
        web = extractGroundedUrls(json);
      } catch (e) {
        console.error("Gemini web suggestions failed:", e);
      }
    }

    return NextResponse.json({ ok: true, matches, web, mode: usedAi ? "ai" : "library" });
  } catch (e) {
    console.error("POST /api/ai/websites failed:", e);
    return NextResponse.json({ ok: false, error: "AI website finder failed. Please try again." }, { status: 502 });
  }
}
