import { NextResponse } from "next/server";
import { loadDashboardData } from "@/lib/orders-store";
import { getMergedReferences, setSiteCategory } from "@/lib/reference-sites";
import { aiConfigured, geminiText } from "@/lib/gemini";
import { isGenericBusiness, isValidWebsiteCategory, WEBSITE_CATEGORIES, BUSINESS_CATEGORIES } from "@/lib/site-taxonomy";
import type { RefSite } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * AI auto-categorizer.
 *
 * Picks library websites that sit in a generic bucket ("General Ecommerce",
 * "General Business", "Uncategorized") or have no valid website category, and
 * asks Gemini to place each one in the proper website category + business-name
 * category using the site's original category text + URL. Results are applied
 * through the same layer as manual edits (custom row update or URL override),
 * so they survive sheet re-syncs.
 */

const BATCH_SIZE = 60;
const MAX_BATCHES_PER_CALL = 2;

function candidates(refs: RefSite[]): RefSite[] {
  return refs.filter((r) => isGenericBusiness(r.businessCategory) || !isValidWebsiteCategory(r.websiteCategory));
}

function buildTaxonomyText(): string {
  return `WEBSITE CATEGORIES (level 2 — the type of website):\n${WEBSITE_CATEGORIES.map((w) => `- ${w}`).join("\n")}\n\nBUSINESS NAME CATEGORIES (level 3 — what the business is):\n${BUSINESS_CATEGORIES.join(" | ")}`;
}

async function classifyBatch(
  batch: RefSite[]
): Promise<Map<number, { websiteCategory: string; businessCategory: string }>> {
  const lines = batch
    .map(
      (r, i) =>
        `${i}|${r.platform}|${(r.category || "").replace(/[\n\r|]+/g, " ").slice(0, 80)}|${r.url.replace(/^https?:\/\//, "").slice(0, 90)}`,
    )
    .join("\n");

  const prompt = `You classify business websites for a web-development sales team.

TAXONOMY:
${buildTaxonomyText()}

WEBSITES (index|CMS platform|original category text|url):
${lines}

For EVERY website pick:
1. "website" — the best Website Category from the list of 20 (judged by what KIND of site it is: store, service business site, agency, news portal, blog, landing page…).
2. "business" — the best Business Name Category from the list (judged by what the business actually sells: cleaning service, law firm, jewelry store…). If none fits, use the closest one — never invent new categories.
Return ONLY a compact JSON array (no markdown fences): [{"i": <index>, "website": "<website category>", "business": "<business name category>"}]`;

  const raw = (
    await geminiText(
      "You return only valid compact JSON. No commentary.",
      prompt,
      { temperature: 0.1, maxOutputTokens: 4000, timeoutMs: 60_000 },
    )
  )
    .replace(/```json|```/g, "")
    .trim();

  const out = new Map<number, { websiteCategory: string; businessCategory: string }>();
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return out;
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Array<{
    i: number;
    website?: string;
    business?: string;
  }>;
  for (const p of parsed) {
    const idx = Number(p?.i);
    const website = String(p?.website ?? "").trim();
    const business = String(p?.business ?? "").trim();
    if (Number.isInteger(idx) && idx >= 0 && idx < batch.length && isValidWebsiteCategory(website) && business) {
      out.set(idx, { websiteCategory: website, businessCategory: business });
    }
  }
  return out;
}

export async function POST() {
  try {
    if (!aiConfigured()) {
      return NextResponse.json(
        { ok: false, error: "AI is not configured — add GEMINI_API_KEY in your environment variables first." },
        { status: 400 },
      );
    }

    const data = await loadDashboardData();
    const refs = await getMergedReferences(data.references);
    const all = candidates(refs);
    if (!all.length) {
      return NextResponse.json({ ok: true, refined: 0, remaining: 0, applied: [] });
    }

    const applied: Array<{ url: string; websiteCategory: string; businessCategory: string }> = [];
    let processed = 0;
    let warning = "";

    for (let b = 0; b < MAX_BATCHES_PER_CALL && processed < all.length; b++) {
      const batch = all.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
      if (!batch.length) break;
      try {
        const results = await classifyBatch(batch);
        processed += batch.length;
        for (const [idx, cls] of results) {
          const site = batch[idx];
          await setSiteCategory(site.url, cls);
          applied.push({ url: site.url, ...cls });
        }
      } catch (e) {
        console.error("AI categorize batch failed:", e);
        warning = e instanceof Error ? e.message : "AI request failed";
        break;
      }
    }

    return NextResponse.json({
      ok: true,
      refined: applied.length,
      remaining: Math.max(0, all.length - processed),
      scanned: processed,
      warning,
      applied: applied.slice(0, 12),
    });
  } catch (e) {
    console.error("POST /api/ai/websites/categorize failed:", e);
    return NextResponse.json({ ok: false, error: "AI categorization failed. Please try again." }, { status: 502 });
  }
}
