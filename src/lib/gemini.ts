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

/**
 * Env vars that may hold the Gemini API key, checked in order.
 *
 * GEMINI_API_KEY is the documented name, but keys created through Vercel's
 * AI Marketplace integration are injected as GOOGLE_GENERATIVE_AI_API_KEY,
 * so both (plus two common alternatives) are accepted — a name mismatch was
 * the reason production reported "AI is not configured" although a key was
 * added before deploying.
 * (Case-insensitive: "Gemini_Api_Key" also matches; empty values are ignored.)
 */
const KEY_VARS = [
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_KEY",
] as const;

/** Case/separator-insensitive comparison so "Gemini_Api_Key" also matches. */
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const KEY_TARGETS = KEY_VARS.map(norm);

function findKeyEntry(): [name: string, value: string] | undefined {
  for (const target of KEY_TARGETS) {
    for (const [name, value] of Object.entries(process.env)) {
      if (value && value.trim() && norm(name) === target) return [name, value.trim()];
    }
  }
  return undefined;
}

function geminiKey(): string | undefined {
  return findKeyEntry()?.[1];
}

export function aiConfigured(): boolean {
  return Boolean(geminiKey());
}

/** Which env var supplied the key ("" when none). Diagnosis only — never returns the value. */
export function geminiKeySource(): string {
  return findKeyEntry()?.[0] ?? "";
}

/**
 * Every env var NAME that looks Gemini/Google-related (never values).
 * Lets /api/health show exactly what the deployment CAN see, so a wrongly
 * named or wrongly scoped key on Vercel is obvious at a glance.
 */
export function geminiKeyCandidates(): Array<{ name: string; empty: boolean }> {
  return Object.keys(process.env)
    .filter((n) => /gemini|google/i.test(n))
    .sort()
    .map((n) => ({ name: n, empty: !String(process.env[n] ?? "").trim() }));
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

/**
 * Fallback models tried in order when the primary model (GEMINI_MODEL or the
 * default) is temporarily unavailable — 503 "model overloaded", 429 rate
 * limit, 500 or 404 unknown model. gemini-3.5-flash / gemini-flash-latest are
 * verified-live, high-capacity models so transient overload on a newer model
 * never blocks the AI features.
 */
const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-flash-latest"];
/** Transient failures worth a retry — same model, then the fallback models. */
const TRANSIENT_STATUSES = new Set([500, 503, 429]);

/** Shared POST helper — retries transient failures, then falls back to alternate models, and swaps the grounding-tool spelling on 400. Returns the full response JSON. */
async function postGenerateRaw(key: string, body: Record<string, unknown>, timeoutMs: number): Promise<GeminiResponse> {
  const models = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];
  const variants = body.tools ? TOOL_VARIANTS : [TOOL_VARIANTS[0]];
  let lastError = "Gemini request failed";
  let timedOut = false;

  for (let m = 0; m < models.length; m++) {
    const model = models[m];
    // primary model gets one immediate retry on transient errors; fallbacks run once
    const attempts = m === 0 ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));
      for (const variant of variants) {
        const payload = body.tools ? { ...body, tools: [{ [variant]: {} }] } : body;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        let res: Response;
        try {
          res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: ctrl.signal,
            cache: "no-store",
          });
        } catch {
          // AbortError (our timeout) or network error — try the next attempt/model
          timedOut = true;
          lastError = `Gemini request timed out after ${Math.round(timeoutMs / 1000)}s (${model})`;
          break;
        } finally {
          clearTimeout(timer);
        }
        timedOut = false;
        if (res.ok) return (await res.json()) as GeminiResponse;
        const detail = await res.text().catch(() => "");
        lastError = `Gemini HTTP ${res.status} (${model}): ${detail.slice(0, 180)}`;
        // swap the grounding-tool spelling only when the request itself was rejected
        if (res.status !== 400) break;
      }
      const status = Number(lastError.match(/HTTP (\d+)/)?.[1]);
      if (!(timedOut || TRANSIENT_STATUSES.has(status))) break;
    }
  }
  throw new Error(lastError);
}

function partsText(json: GeminiResponse): string {
  return (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

/** One-shot text call. Throws on any failure — callers decide the fallback. */
export async function geminiText(system: string, user: string, opts: GeminiOptions = {}): Promise<string> {
  const key = geminiKey();
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
  const key = geminiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return postGenerateRaw(key, buildBody(system, user, opts, true), opts.timeoutMs ?? 30_000);
}
