import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { cleanOrderInput, getDbOrders } from "@/lib/orders-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const orders = await getDbOrders();
    return NextResponse.json({ ok: true, orders });
  } catch (e) {
    console.error("GET /api/orders failed:", e);
    return NextResponse.json({ ok: false, error: "Failed to load orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = cleanOrderInput(body);
    await ensureSchema();
    const created = await db.order.create({ data: input });
    return NextResponse.json({ ok: true, order: created }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create order";
    const bad = /required|must be|Date/.test(msg);
    console.error("POST /api/orders failed:", e);
    return NextResponse.json({ ok: false, error: msg }, { status: bad ? 400 : 500 });
  }
}
