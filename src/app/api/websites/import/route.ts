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
import { parseCsv } from "@/lib/csv-parser";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_ROWS = 3000;
const PLATFORMS = CORE_PLATFORMS;

/** tidy a raw cell into a usable URL (adds https:// when the scheme is missing) */
function normalizeUrl(raw: string): string {
  let u = raw.trim().replace(/^[<("']+|[>)",.;\s]+$/g, "");
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) {
    if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(u)) u = `https://${u}`;
    else return "";
  }
  return u;
}

function isValidUrl(u: string): boolean {
  return /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]*$/i.test(u);
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

function findColumn(headers: string[], patterns: RegExp[]): number {
  for (const re of patterns) {
    const idx = headers.findIndex((h) => re.test(h.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** how many sampled rows have a non-empty cell in the given column */
function filledCount(rows: string[][], col: number): number {
  let count = 0;
  for (const r of rows.slice(0, 100)) {
    if ((r[col] ?? "").trim()) count++;
  }
  return count;
}

export async function POST(req: NextRequest) {
  try {
    let csvText = "";

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (file instanceof File) {
        if (file.size > MAX_BYTES) {
          return NextResponse.json(
            { ok: false, error: "File is too large — maximum 2 MB of CSV." },
            { status: 400 }
          );
        }
        csvText = await file.text();
      } else {
        const pasted = form.get("csv");
        if (typeof pasted === "string") csvText = pasted;
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as { csv?: string };
      csvText = String(body?.csv ?? "");
    }

    if (!csvText.trim()) {
      return NextResponse.json(
        { ok: false, error: "No CSV content received — choose a file or paste the CSV text." },
        { status: 400 }
      );
    }

    const { headers, rows } = parseCsv(csvText, MAX_ROWS + 1);
    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "The file has no data rows — everything looked empty." },
        { status: 400 }
      );
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { ok: false, error: `Too many rows — maximum ${MAX_ROWS.toLocaleString()} per import.` },
        { status: 400 }
      );
    }

    // ── column mapping ──
    // URL: explicit url/link/website header, else sniff by content.
    let urlCol = findColumn(headers, [/^url$/i, /url/i, /link/i, /website/i, /web ?site/i, /domain/i, /site/i]);
    const platformCol = findColumn(headers, [/platform/i, /^cms$/i]);
    const websiteCatCol = findColumn(headers, [/website ?categor/i, /site ?(type|categor)/i, /main ?categor/i, /business ?type/i]);
    const businessCol = findColumn(headers, [/business ?(name|categor)/i, /sub ?-?categor/i, /subcategor/i, /niche/i]);
    const catCol = findColumn(headers, [/categor/i]);
    const labelsCol = findColumn(headers, [/labels?/i, /tags?/i]);

    if (urlCol === -1 || filledCount(rows, urlCol) === 0) {
      // sniff: the column with the most URL/domain-looking cells wins
      const sample = rows.slice(0, 50);
      const width = Math.max(...sample.map((r) => r.length));
      let bestIdx = -1;
      let bestCount = 0;
      for (let c = 0; c < width; c++) {
        let count = 0;
        for (const r of sample) {
          const cell = (r[c] ?? "").trim();
          if (/^https?:\/\//i.test(cell) || /^[\w-]+\.[\w-]+/.test(cell)) count++;
        }
        if (count > bestCount) {
          bestCount = count;
          bestIdx = c;
        }
      }
      urlCol = bestIdx;
    }

    if (urlCol === -1 || filledCount(rows, urlCol) === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not find any website links. Make sure one column contains the URLs (a header like 'URL', 'Website' or 'Link' helps).",
        },
        { status: 400 }
      );
    }

    await ensureSchema();

    // ── build import candidates with auto-categorisation ──
    const seen = new Set<string>();
    const toInsert: Array<{
      url: string;
      platform: string;
      websiteCategory: string;
      businessCategory: string;
      category: string;
      labels: string[];
    }> = [];
    const invalid: Array<{ row: number; value: string; reason: string }> = [];
    let duplicatesInFile = 0;
    let missingUrl = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawUrl = (row[urlCol] ?? "").trim();
      if (!rawUrl) {
        missingUrl++;
        continue;
      }

      const url = normalizeUrl(rawUrl);
      if (!url || !isValidUrl(url)) {
        invalid.push({ row: i + 1, value: rawUrl.slice(0, 120), reason: "not a valid website link" });
        continue;
      }

      const key = url.toLowerCase();
      if (seen.has(key)) {
        duplicatesInFile++;
        continue;
      }
      seen.add(key);

      // platform: explicit CSV column wins, otherwise sniff from the URL.
      // If the platform cell is not a known CMS name it is most likely a
      // category text on a misaligned row — recycle it as a hint instead of
      // throwing it away.
      const csvPlatform = platformCol >= 0 ? (row[platformCol] ?? "").trim() : "";
      const knownPlatform = PLATFORMS.find((p) => p.toLowerCase() === csvPlatform.toLowerCase());
      const platform = knownPlatform ?? guessPlatform(url);

      // category text from the CSV boosts classification accuracy
      const csvWebsite = websiteCatCol >= 0 ? (row[websiteCatCol] ?? "").trim() : "";
      const csvBusiness = businessCol >= 0 ? (row[businessCol] ?? "").trim() : "";
      const csvCat = catCol >= 0 ? (row[catCol] ?? "").trim() : "";
      const csvLabels = labelsCol >= 0 ? (row[labelsCol] ?? "").trim() : "";
      const hintFromPlatform = !knownPlatform && csvPlatform ? csvPlatform : "";
      const categoryText = [csvCat, csvBusiness, hintFromPlatform].filter(Boolean).join("\n");

      const cls = classifySite(platform, categoryText, url);
      // explicit CSV columns win when they hold valid values (business names are free-text)
      const websiteCategory = isValidWebsiteCategory(csvWebsite) ? csvWebsite : cls.websiteCategory;
      const businessCategory = sanitizeBusinessCategory(csvBusiness) || cls.businessCategory;
      const labels = csvLabels
        ? sanitizeLabels(csvLabels.split(/[|,;/]/).map((s) => s.trim()))
        : [];
      const category = (csvCat || businessCategory).slice(0, 500);

      toInsert.push({
        url: key,
        platform,
        websiteCategory,
        businessCategory,
        category,
        labels,
      });
    }

    // ── dedupe against the library in ONE query ──
    const urls = toInsert.map((r) => r.url);
    const existing = urls.length
      ? await db.customSite.findMany({ where: { url: { in: urls } }, select: { url: true } })
      : [];
    const existingSet = new Set(existing.map((r) => r.url));
    const fresh = toInsert.filter((r) => !existingSet.has(r.url));
    const alreadyInLibrary = toInsert.length - fresh.length;

    if (fresh.length) {
      await db.customSite.createMany({ data: fresh });
    }

    return NextResponse.json({
      ok: true,
      imported: fresh.length,
      alreadyInLibrary,
      duplicatesInFile,
      missingUrl,
      invalid: invalid.slice(0, 50),
      invalidCount: invalid.length,
      totalRows: rows.length,
    });
  } catch (e) {
    console.error("POST /api/websites/import failed:", e);
    return NextResponse.json({ ok: false, error: "Import failed — please try again." }, { status: 500 });
  }
}
