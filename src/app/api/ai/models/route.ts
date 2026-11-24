import { NextResponse } from "next/server";
import { aiConfigured, geminiKeySource, listGeminiModels, openRouterConfigured } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Diagnostic: which AI providers/models does this deployment actually see?
 *
 * Open <deployed-url>/api/ai/models when AI calls fail — it shows the live
 * Gemini model list (from the server key) plus the OpenRouter free-model
 * chain used when OPENROUTER_API_KEY is set. Never returns any key.
 */
export async function GET() {
  if (!aiConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "No AI key configured on this deployment.",
        hint: "Add OPENROUTER_API_KEY or GEMINI_API_KEY in Vercel → Settings → Environment Variables (Production scope), then Redeploy.",
      },
      { status: 503 },
    );
  }

  const openRouter = {
    configured: openRouterConfigured(),
    note: openRouterConfigured()
      ? "OPENROUTER_API_KEY is set — AI calls try the free-model chain below FIRST, then fall back to direct Gemini."
      : "OPENROUTER_API_KEY is not set — AI calls go straight to Gemini direct.",
  };

  let gemini: { source: string; count: number; models: string[] } | { source: string; error: string } | null = null;
  if (geminiKeySource()) {
    try {
      const models = await listGeminiModels();
      gemini = { source: geminiKeySource(), count: models.length, models };
    } catch (e) {
      gemini = { source: geminiKeySource(), error: (e as Error).message };
    }
  }

  return NextResponse.json({ ok: true, openRouter, gemini });
}
