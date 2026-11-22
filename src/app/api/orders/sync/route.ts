import { NextResponse } from "next/server";
import { syncOrdersFromSheet } from "@/lib/orders-store";

export const dynamic = "force-dynamic";

/** Pull the latest rows from the Google Sheet and merge them into the database. */
export async function POST() {
  try {
    const result = await syncOrdersFromSheet();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("POST /api/orders/sync failed:", e);
    return NextResponse.json(
      { ok: false, error: "Sheet sync failed — check that the Google Sheet is shared/public" },
      { status: 500 }
    );
  }
}
