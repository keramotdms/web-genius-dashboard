import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    await ensureSchema();
    const messages = await db.message.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ ok: true, messages });
  } catch (e) {
    console.error("GET /api/messages failed:", e);
    return NextResponse.json({ ok: false, error: "Could not load messages" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const author = String(body?.author ?? "").trim().slice(0, 60);
    const content = String(body?.content ?? "").trim().slice(0, 2000);
    if (!author || !content) {
      return NextResponse.json({ ok: false, error: "Name and message are required." }, { status: 400 });
    }
    await ensureSchema();
    const message = await db.message.create({ data: { author, content } });
    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error("POST /api/messages failed:", e);
    return NextResponse.json({ ok: false, error: "Could not post message" }, { status: 500 });
  }
}
