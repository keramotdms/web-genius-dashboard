import { NextResponse } from "next/server";
import { aiConfigured, geminiKeySource, listGeminiModels } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Diagnostic: which Gemini models does the server key actually see right now?
 *
 * Open <deployed-url>/api/ai/models when AI calls fail with "model overloaded"
 * (HTTP 503) — it lists every live model name so the fallback chain in
 * src/lib/gemini.ts can be adjusted to models that really exist. Never
 * returns the key itself.
 */
export async function GET() {
  if (!aiConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "No Gemini key configured on this deployment.",
        hint: "Add GEMINI_API_KEY in Vercel → Settings → Environment Variables (Production scope), then Redeploy.",
      },
      { status: 503 },
    );
  }
  try {
    const models = await listGeminiModels();
    return NextResponse.json({ ok: true, source: geminiKeySource(), count: models.length, models });
  } catch (e) {
    return NextResponse.json(
      { ok: false, source: geminiKeySource(), error: (e as Error).message },
      { status: 502 },
    );
  }
}
