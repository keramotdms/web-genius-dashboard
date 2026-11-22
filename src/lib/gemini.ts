/**
 * Google Gemini REST client — free-tier friendly replacement for the
 * sandbox-only z-ai-web-dev-sdk, so AI features keep working on any host.
 *
 * Uses the plain REST API (no SDK dependency): POST
 * https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *
 * Set GEMINI_API_KEY in the environment to enable AI features.
 * Free keys: https://aistudio.google.com/apikey (generous free tier).
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Google Search grounding tool spellings. Newer Gemini models accept the
 * camelCase REST field, older ones the snake_case — we retry the alternate
 * spelling automatically when the API rejects the first one.
 */
const TOOL_VARIANTS = ["google_search", "googleSearch"] as const;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      webSearchQueries?: string[];
    };
  }>;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  /** enable Google Search grounding (free tier) for fresh web results */
  grounding?: boolean;
  timeoutMs?: number;
}

function buildBody(system: string, user: string, opts: GeminiOptions, grounded: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxOutputTokens ?? 900,
    },
  };
  if (grounded) body.tools = [{ google_search: {} }];
  return body;
}

/** Shared POST helper — retries the alternate grounding-tool spelling on 400. Returns the full response JSON. */
async function postGenerateRaw(key: string, body: Record<string, unknown>, timeoutMs: number): Promise<GeminiResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let lastError = "Gemini request failed";
    const variants = body.tools ? TOOL_VARIANTS : [TOOL_VARIANTS[0]];
    for (let v = 0; v < variants.length; v++) {
      const payload = body.tools ? { ...body, tools: [{ [variants[v]]: {} }] } : body;
      const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as GeminiResponse;
      const detail = await res.text().catch(() => "");
      lastError = `Gemini HTTP ${res.status}: ${detail.slice(0, 180)}`;
      // retry the other tool spelling only when the request itself was rejected
      if (res.status !== 400) break;
    }
    throw new Error(lastError);
  } finally {
    clearTimeout(timer);
  }
}

function partsText(json: GeminiResponse): string {
  return (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

/** One-shot text call. Throws on any failure — callers decide the fallback. */
export async function geminiText(system: string, user: string, opts: GeminiOptions = {}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const json = await postGenerateRaw(key, buildBody(system, user, opts, Boolean(opts.grounding)), opts.timeoutMs ?? 30_000);
  const text = partsText(json);
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

export interface WebSuggestion {
  url: string;
  name: string;
  snippet: string;
}

/** Extract web URLs from Gemini Search grounding metadata (when grounding is on). */
export function extractGroundedUrls(json: unknown): WebSuggestion[] {
  const out: WebSuggestion[] = [];
  try {
    const cands = (json as GeminiResponse)?.candidates ?? [];
    const chunks = cands[0]?.groundingMetadata?.groundingChunks ?? [];
    for (const c of chunks) {
      const uri = c?.web?.uri;
      if (!uri || !/^https?:\/\//.test(uri)) continue;
      out.push({ url: uri, name: c.web?.title ?? uri, snippet: "" });
    }
  } catch {
    /* metadata shape changed — return what we have */
  }
  return out.slice(0, 6);
}

/** Raw grounded call — used when the caller needs the full JSON (grounding metadata). */
export async function geminiGroundedJson(system: string, user: string, opts: GeminiOptions = {}): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return postGenerateRaw(key, buildBody(system, user, opts, true), opts.timeoutMs ?? 30_000);
}
