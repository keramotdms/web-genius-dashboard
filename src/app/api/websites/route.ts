import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import {
  classifySite,
  CORE_PLATFORMS,
  WEBSITE_CATEGORIES,
  isValidWebsiteCategory,
  sanitizeBusinessCategory,
  sanitizeLabels,
} from "@/lib/site-taxonomy";
import { getCustomSites, setSiteCategory } from "@/lib/reference-sites";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cleanUrl(raw: string): string {
  const u = raw.trim().replace(/[.,;]+$/, "");
  if (!/^https?:\/\//i.test(u)) return "";
  return u;
}

function guessPlatform(url: string): string {
  const t = url.toLowerCase();
  if (t.includes("myshopify") || t.includes("shopify")) return "Shopify";
  if (/wordpress|wp-content|wp-admin/.test(t)) return "WordPress";
  if (/wixsite|\.wix\./.test(t)) return "Wix";
  if (/squarespace|sqsp\.cn/.test(t)) return "Squarespace";
  if (/webflow/.test(t)) return "Webflow";
  return "Other";
}

export async function GET() {
  try {
    const sites = await getCustomSites();
    return NextResponse.json({ ok: true, sites });
  } catch (e) {
    console.error("GET /api/websites failed:", e);
    return NextResponse.json({ ok: false, error: "Could not load custom websites" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = cleanUrl(String(body?.url ?? ""));
    if (!url) {
      return NextResponse.json({ ok: false, error: "A valid website URL (starting with http/https) is required." }, { status: 400 });
    }

    const platformInput = String(body?.platform ?? "").trim();
    const platform = CORE_PLATFORMS.find((p) => p.toLowerCase() === platformInput.toLowerCase()) ?? guessPlatform(url);

    const cls = classifySite(platform, "", url);
    let websiteCategory = String(body?.websiteCategory ?? "").trim();
    if (!isValidWebsiteCategory(websiteCategory)) websiteCategory = cls.websiteCategory;
    const businessCategory =
      sanitizeBusinessCategory(String(body?.businessCategory ?? "")) || cls.businessCategory;
    const labels = sanitizeLabels(body?.labels);

    // dedupe: same URL (case-insensitive) is never added twice — URLs are
    // stored lowercased so a plain equals check is enough
    await ensureSchema();
    const existing = await db.customSite.findFirst({
      where: { url: { equals: url.toLowerCase() } },
    });
    if (existing) {
      return NextResponse.json({ ok: true, site: existing, exists: true });
    }

    const site = await db.customSite.create({
      data: { url: url.toLowerCase(), platform, websiteCategory, businessCategory, category: businessCategory, labels },
    });
    return NextResponse.json({ ok: true, site, exists: false });
  } catch (e) {
    console.error("POST /api/websites failed:", e);
    return NextResponse.json({ ok: false, error: "Could not save the website" }, { status: 500 });
  }
}

/** re-categorize / relabel an existing site (custom row updated directly, sheet site via override) */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = cleanUrl(String(body?.url ?? ""));
    if (!url) {
      return NextResponse.json({ ok: false, error: "A valid website URL is required." }, { status: 400 });
    }

    const patch: { websiteCategory?: string; businessCategory?: string; labels?: string[] } = {};

    if (body?.websiteCategory !== undefined) {
      const websiteCategory = String(body.websiteCategory).trim();
      if (!WEBSITE_CATEGORIES.includes(websiteCategory)) {
        return NextResponse.json(
          { ok: false, error: "Invalid website category — pick one from the list of 20." },
          { status: 400 }
        );
      }
      patch.websiteCategory = websiteCategory;
    }
    if (body?.businessCategory !== undefined) {
      const businessCategory = sanitizeBusinessCategory(String(body.businessCategory));
      if (!businessCategory) {
        return NextResponse.json(
          { ok: false, error: "Business name category cannot be empty." },
          { status: 400 }
        );
      }
      patch.businessCategory = businessCategory;
    }
    if (body?.labels !== undefined) {
      patch.labels = sanitizeLabels(body.labels);
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
    }

    await setSiteCategory(url, patch);
    return NextResponse.json({ ok: true, updated: true });
  } catch (e) {
    console.error("PATCH /api/websites failed:", e);
    return NextResponse.json({ ok: false, error: "Could not update the category" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Site id is required." }, { status: 400 });
    }
    await ensureSchema();
    await db.customSite.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/websites failed:", e);
    return NextResponse.json({ ok: false, error: "Could not delete the website" }, { status: 500 });
  }
}
