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

const BATCH_SIZE = 15;
const MAX_BATCHES_PER_CALL = 4;
/** Every phase of POST() — sheet sync, AI batches, DB writes — is measured
 * against ONE absolute deadline anchored at REQUEST start (see deadline in
 * POST). A batch is only started when ≥25s of that window remains, so the
 * whole function stays inside Vercel's 90s limit: 72s deadline + ~10s of
 * trailing writes ≈ 82s worst case. */
const MIN_BATCH_WINDOW_MS = 25_000;

function candidates(refs: RefSite[]): RefSite[] {
  return refs.filter((r) => isGenericBusiness(r.businessCategory) || !isValidWebsiteCategory(r.websiteCategory));
}

function buildTaxonomyText(): string {
  return `WEBSITE CATEGORIES (level 2 — the type of website):\n${WEBSITE_CATEGORIES.map((w) => `- ${w}`).join("\n")}\n\nBUSINESS NAME CATEGORIES (level 3 — what the business is):\n${BUSINESS_CATEGORIES.join(" | ")}`;
}

const CATEGORY_STOPWORDS = new Set(["website", "site", "based", "type", "category", "the", "a", "an"]);

/**
 * Models shorten or paraphrase the 20 taxonomy names ("e-commerce",
 * "corporate profile", "blog / magazine", "lms") — map any guess back to the
 * exact category by token overlap. Ties prefer the more specific category
 * (fewest words). Returns undefined when nothing overlaps — the site is then
 * left in its generic bucket instead of getting a wrong label.
 */
function resolveWebsiteCategory(raw: string): string | undefined {
  const words = String(raw)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !CATEGORY_STOPWORDS.has(w));
  if (!words.length) return undefined;
  let best: string | undefined;
  let bestScore = 0;
  let bestLen = Infinity;
  for (const cat of WEBSITE_CATEGORIES) {
    const catWords = new Set(
      cat
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 1 && !CATEGORY_STOPWORDS.has(w)),
    );
    const score = words.filter((w) => catWords.has(w)).length;
    if (score > bestScore || (score > 0 && score === bestScore && catWords.size < bestLen)) {
      best = cat;
      bestScore = score;
      bestLen = catWords.size;
    }
  }
  return bestScore > 0 ? best : undefined;
}

async function classifyBatch(
  batch: RefSite[],
  deadlineMs: number,
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
      // 32s: OpenRouter's free reasoning models spend tokens before the visible
      // content and can take 20–30s for a 15-site batch (direct Gemini finishes
      // in ~10–20s, well under this cap)
      { temperature: 0.1, maxOutputTokens: 4000, timeoutMs: 32_000, deadlineMs },
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
    const resolved = resolveWebsiteCategory(website);
    if (Number.isInteger(idx) && idx >= 0 && idx < batch.length && resolved && business) {
      out.set(idx, { websiteCategory: resolved, businessCategory: business });
    }
  }
  return out;
}

export async function POST() {
  const startedAt = Date.now();
  // hard ceiling for ANY work in this function — anchored at REQUEST start
  // because loadDashboardData (sheet download + DB sync) can eat 10–20s BEFORE
  // the AI starts. Anchoring after it let sync + 72s + writes overrun the 90s
  // window (seen live: FUNCTION_INVOCATION_TIMEOUT). 72s + trailing writes ≈ 82s.
  const deadline = startedAt + 72_000;
  try {
    if (!aiConfigured()) {
      return NextResponse.json(
        { ok: false, error: "AI is not configured — add OPENROUTER_API_KEY or GEMINI_API_KEY in your environment variables first." },
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
      // not enough of the request window left for one meaningful batch — the
      // remaining count tells the user to click again
      if (deadline - Date.now() < MIN_BATCH_WINDOW_MS) break;
      const batch = all.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
      if (!batch.length) break;
      try {
        const results = await classifyBatch(batch, deadline);
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

    if (!warning && processed > 0 && applied.length === 0) {
      warning =
        "AI responded but returned no usable category names (a weak free model probably answered). Click again — a stronger model in the chain usually picks up next.";
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
