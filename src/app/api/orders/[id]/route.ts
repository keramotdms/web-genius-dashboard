import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { cleanOrderInput } from "@/lib/orders-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const input = cleanOrderInput(body);
    await ensureSchema();
    const updated = await db.order.update({ where: { id }, data: input });
    return NextResponse.json({ ok: true, order: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update order";
    const bad = /required|must be|Date/.test(msg);
    console.error(`PUT /api/orders/${id} failed:`, e);
    return NextResponse.json({ ok: false, error: msg }, { status: bad ? 400 : 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await ensureSchema();
    await db.order.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`DELETE /api/orders/${id} failed:`, e);
    return NextResponse.json({ ok: false, error: "Failed to delete order" }, { status: 500 });
  }
}
