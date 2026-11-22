import { db, ensureSchema } from "@/lib/db";
import type { RefSite } from "@/lib/types";

/**
 * Reference-website persistence helpers.
 *
 * The library has two sources:
 *   1. sheet-synced sites (parsed from the References sheet, classified by rules)
 *   2. custom sites added from the dashboard (CustomSite table)
 * plus a manual override layer (SiteOverride table) keyed by URL that fixes the
 * website category, business-name category AND big-client labels of ANY site —
 * sheet or custom — and survives re-syncs. Empty override fields mean "no manual
 * fix for this level" and are ignored when merging.
 */

export interface SiteCategoryPatch {
  websiteCategory?: string;
  businessCategory?: string;
  labels?: string[];
}

/** websites added manually from the dashboard, stored in the app database */
export async function getCustomSites(): Promise<RefSite[]> {
  try {
    await ensureSchema();
    const rows = await db.customSite.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      websiteCategory: r.websiteCategory,
      businessCategory: r.businessCategory,
      category: r.category || r.businessCategory,
      url: r.url,
      labels: r.labels ?? [],
      custom: true,
    }));
  } catch (e) {
    console.error("Could not load custom websites:", e);
    return [];
  }
}

/** manual fixes (categories + labels), keyed by lowercased URL */
export async function getOverrides(): Promise<Map<string, SiteCategoryPatch>> {
  try {
    await ensureSchema();
    const rows = await db.siteOverride.findMany();
    return new Map(
      rows.map((r) => [
        r.url.toLowerCase(),
        { websiteCategory: r.websiteCategory, businessCategory: r.businessCategory, labels: r.labels ?? [] },
      ])
    );
  } catch (e) {
    console.error("Could not load site overrides:", e);
    return new Map();
  }
}

/** apply the override layer (returns a fresh array; input is never mutated) */
export function applyOverrides(refs: RefSite[], overrides: Map<string, SiteCategoryPatch>): RefSite[] {
  if (!overrides.size) return refs;
  return refs.map((r) => {
    const ov = overrides.get(r.url.toLowerCase());
    if (!ov) return r;
    return {
      ...r,
      websiteCategory: ov.websiteCategory || r.websiteCategory,
      businessCategory: ov.businessCategory || r.businessCategory,
      labels: ov.labels && ov.labels.length ? ov.labels : (r.labels ?? []),
    };
  });
}

/** sheet refs + custom sites, with the override layer applied on top */
export async function getMergedReferences(sheetRefs: RefSite[]): Promise<RefSite[]> {
  const [customSites, overrides] = await Promise.all([getCustomSites(), getOverrides()]);
  return applyOverrides([...sheetRefs, ...customSites], overrides);
}

/**
 * Set website category / business category / labels for one website URL.
 * - if the URL is a stored custom site, its row is updated directly
 * - otherwise (sheet-synced site) an override row is upserted
 * Only the provided fields are written; omitted fields keep their value.
 */
export async function setSiteCategory(url: string, patch: SiteCategoryPatch): Promise<boolean> {
  await ensureSchema();
  const key = url.toLowerCase();
  const existing = await db.customSite.findFirst({ where: { url: key } });
  if (existing) {
    await db.customSite.update({
      where: { id: existing.id },
      data: {
        ...(patch.websiteCategory !== undefined ? { websiteCategory: patch.websiteCategory } : {}),
        ...(patch.businessCategory !== undefined ? { businessCategory: patch.businessCategory } : {}),
        ...(patch.labels !== undefined ? { labels: patch.labels } : {}),
      },
    });
    return true;
  }

  // sheet-synced site: an override row only exists if someone edited this site
  // before; for a fresh override the untouched levels stay empty ("no fix")
  const prior = await db.siteOverride.findUnique({ where: { url: key } });
  if (prior) {
    await db.siteOverride.update({
      where: { url: key },
      data: {
        ...(patch.websiteCategory !== undefined ? { websiteCategory: patch.websiteCategory } : {}),
        ...(patch.businessCategory !== undefined ? { businessCategory: patch.businessCategory } : {}),
        ...(patch.labels !== undefined ? { labels: patch.labels } : {}),
      },
    });
  } else {
    await db.siteOverride.create({
      data: {
        url: key,
        websiteCategory: patch.websiteCategory ?? "",
        businessCategory: patch.businessCategory ?? "",
        labels: patch.labels ?? [],
      },
    });
  }
  return true;
}
