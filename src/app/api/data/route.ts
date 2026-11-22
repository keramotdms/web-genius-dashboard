import { NextRequest, NextResponse } from "next/server";
import { loadDashboardData } from "@/lib/orders-store";
import { getMergedReferences } from "@/lib/reference-sites";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  try {
    // orders live in the app database (seeded from the sheet on first run);
    // targets, quotations, references and instructions still come from the sheet
    const data = await loadDashboardData(force);
    // merge manually-added sites into the sheet-synced library and apply the
    // manual category-override layer — getMergedReferences never mutates the
    // cached object, it always builds a fresh array.
    const references = await getMergedReferences(data.references);
    const merged = {
      ...data,
      references,
    };
    return NextResponse.json({
      ok: true,
      syncedAt: merged.fetchedAt,
      source: merged.source,
      data: merged,
    });
  } catch (e) {
    console.error("GET /api/data failed:", e);
    return NextResponse.json({ ok: false, error: "Failed to load sheet data" }, { status: 500 });
  }
}
