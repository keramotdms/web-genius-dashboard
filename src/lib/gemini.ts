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

/**
 * OpenRouter key lookup (same case-insensitive style). When present, AI calls
 * go to OpenRouter FIRST — its free models have fresh quota even after the
 * Gemini free daily cap is exhausted — and only fall back to Gemini direct
 * when OpenRouter fails.
 */
const OR_KEY_TARGETS = ["OPENROUTER_API_KEY", "OPENROUTER_KEY"].map(norm);

function openRouterKey(): string | undefined {
  for (const target of OR_KEY_TARGETS) {
    for (const [name, value] of Object.entries(process.env)) {
      if (value && value.trim() && norm(name) === target) return value.trim();
    }
  }
  return undefined;
}

export function openRouterConfigured(): boolean {
  return Boolean(openRouterKey());
}

export function aiConfigured(): boolean {
  return Boolean(openRouterKey() || geminiKey());
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
  /** absolute epoch ms — no attempt may push past it (Vercel 90s window). */
  deadlineMs?: number;
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
 * limit, 500 or 404 unknown model. Chain mixes generations and capacity pools
 * (verified live via GET /api/ai/models): 3.5-flash and the aliases cover the
 * newest generations, while the -lite models usually still have headroom when
 * the bigger flash models are overloaded at peak hours. A wrong name 404s in
 * ~1s, so the cost of a dead entry is negligible.
 */
const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
];
/** Transient failures worth a retry — same model, then the fallback models. */
const TRANSIENT_STATUSES = new Set([500, 503, 429]);
/** Cool-down between model switches on transient errors — lets Google shed load. */
const MODEL_SWITCH_BACKOFF_MS = 2000;

/**
 * OpenRouter — OpenAI-compatible aggregator (https://openrouter.ai).
 * Used BEFORE the direct Gemini chain when OPENROUTER_API_KEY is set, because
 * its free models keep working after the Gemini free daily cap (429) hits.
 * All nine :free models below were verified live on 2026-11-24 to return
 * clean compact JSON for the categorize prompt. :free upstreams throttle
 * independently ("temporarily rate-limited upstream"), so a wide chain keeps
 * at least one lane open. Free tier: 50 requests/day across all :free models.
 */
const OR_BASE = "https://openrouter.ai/api/v1";
const OR_FREE_MODELS = [
  "baidu/ernie-5.5-flash-preview:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "particle-ai/particle-1:free",
  "dots-studio/dots-3-note-preview:free",
  "inclusionai/ling-3.2-flash:free",
  "recursive/flint-v1.0:free",
  "liquid/lfm-3-1.7b:free",
];

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

/** One OpenRouter chat completion across the free-model chain. Returns the text or throws the last error.
 * Honours opts.deadlineMs: no attempt starts with <12s of budget left and each
 * attempt's timeout is clamped so the chain can never overrun the window. */
async function postOpenRouter(key: string, system: string, user: string, opts: GeminiOptions): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  // reasoning-style free models burn tokens before the visible content, so
  // keep a floor comfortably above what the visible answer needs
  const maxTokens = Math.max(opts.maxOutputTokens ?? 900, 1500);
  let lastError = "OpenRouter request failed";

  for (const model of OR_FREE_MODELS) {
    const remaining = opts.deadlineMs ? opts.deadlineMs - Date.now() : Infinity;
    if (remaining < 12_000) {
      lastError = `OpenRouter: out of time budget — click again to continue`;
      break;
    }
    const attemptTimeout = Math.max(8_000, Math.min(timeoutMs, remaining - 2_000));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), attemptTimeout);
    let res: Response;
    try {
      res = await fetch(`${OR_BASE}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: opts.temperature ?? 0.4,
          max_tokens: maxTokens,
        }),
        signal: ctrl.signal,
        cache: "no-store",
      });
    } catch {
      lastError = `OpenRouter request timed out after ${Math.round(attemptTimeout / 1000)}s (${model})`;
      clearTimeout(timer);
      continue;
    }
    clearTimeout(timer);

    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as OpenRouterResponse;
      const text = (json.choices?.[0]?.message?.content ?? "").trim();
      if (text) return text;
      // reasoning-only models can return all-empty content — try the next one
      lastError = `OpenRouter empty response (${model})`;
      continue;
    }
    const detail = await res.text().catch(() => "");
    if (res.status === 429) {
      const msg = detail.toLowerCase();
      // Two very different 429s:
      // - "free-models-per-day" — OpenRouter's own shared 50/day cap is done.
      //   (Match ONLY that exact resource name: upstream providers also emit
      //   "tokens-per-day" for their own shared pools — those are NOT the
      //   account cap and just mean "try another lane".)
      // - anything else (tpm_rate_limit_exceeded, "temporarily rate-limited
      //   upstream") — one provider lane is busy; wait a beat, next model.
      if (msg.includes("free-models-per-day")) {
        throw new Error(
          `OpenRouter free daily limit reached (50 requests on :free models, resets in ~24h). ` +
            `Top up credits at openrouter.ai/credits or wait for the reset.`,
        );
      }
      lastError = `OpenRouter upstream rate-limited (${model})`;
      await new Promise((r) => setTimeout(r, 1200));
      continue;
    }
    lastError = `OpenRouter HTTP ${res.status} (${model}): ${detail.slice(0, 180)}`;
  }
  throw new Error(lastError);
}

/** Shared POST helper — retries transient failures, then falls back to alternate models, and swaps the grounding-tool spelling on 400. Returns the full response JSON.
 * Honours deadlineMs (absolute epoch): attempts get clamped timeouts and the
 * chain stops when too little time remains, so a failing chain can never
 * push past Vercel's 90s function window. */
async function postGenerateRaw(key: string, body: Record<string, unknown>, timeoutMs: number, deadlineMs = 0): Promise<GeminiResponse> {
  const models = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];
  const variants = body.tools ? TOOL_VARIANTS : [TOOL_VARIANTS[0]];
  let lastError = "Gemini request failed";
  let lastStatus = 0;
  let timedOut = false;

  for (let m = 0; m < models.length; m++) {
    const model = models[m];
    const remaining = deadlineMs ? deadlineMs - Date.now() : Infinity;
    if (deadlineMs && remaining < 8_000) break; // no time for a meaningful attempt
    // primary model gets one immediate retry on transient errors; fallbacks run once
    const attempts = m === 0 ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));
      const attemptTimeout = Math.max(6_000, Math.min(timeoutMs, remaining - 2_000));
      for (const variant of variants) {
        const payload = body.tools ? { ...body, tools: [{ [variant]: {} }] } : body;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), attemptTimeout);
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
          lastError = `Gemini request timed out after ${Math.round(attemptTimeout / 1000)}s (${model})`;
          break;
        } finally {
          clearTimeout(timer);
        }
        timedOut = false;
        if (res.ok) return (await res.json()) as GeminiResponse;
        const detail = await res.text().catch(() => "");

        if (res.status === 429) {
          // Quota is shared across ALL models on the same key — trying other
          // models or retrying just burns the remaining allowance. Stop here
          // with a human-readable message (the raw JSON made scary toasts).
          const delay = /"retryDelay"\s*:\s*"(\d+s)"/.exec(detail)?.[1];
          throw new Error(
            `Gemini free quota finished (HTTP 429${delay ? ` — try again in ${delay}` : ""}). ` +
              `Per-minute limits reset in a minute; the daily limit resets at midnight Pacific (~2pm Dhaka time). ` +
              `Meanwhile the remaining sites can be categorized manually.`,
          );
        }

        lastError = `Gemini HTTP ${res.status} (${model}): ${detail.slice(0, 180)}`;
        // swap the grounding-tool spelling only when the request itself was rejected
        if (res.status !== 400) break;
      }
      const status = Number(lastError.match(/HTTP (\d+)/)?.[1]);
      lastStatus = status;
      // a timed-out attempt is NOT retried on the same model — that just burns
      // the serverless time budget; go straight to the fallback models instead
      if (timedOut) break;
      if (!TRANSIENT_STATUSES.has(status)) break;
    }
    // brief cool-down before switching models on a 503/500 storm — Google's
    // load balancer often frees a slot within seconds. Skipped after a timeout
    // (a hang means we should move on immediately, not wait) or when the wait
    // would push past the deadline.
    const backoff = !timedOut && m < models.length - 1 && TRANSIENT_STATUSES.has(lastStatus) ? MODEL_SWITCH_BACKOFF_MS : 0;
    if (backoff && (!deadlineMs || Date.now() + backoff < deadlineMs)) {
      await new Promise((r) => setTimeout(r, backoff));
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

/**
 * Names of the Gemini models the server key can actually see right now
 * (only models that support generateContent). Diagnosis only — used by
 * GET /api/ai/models to pick live fallback models and debug 503 storms.
 * Never returns or logs the key itself.
 */
export async function listGeminiModels(): Promise<string[]> {
  const key = geminiKey();
  if (!key) return [];
  const res = await fetch(`${BASE}?key=${key}&pageSize=100`, { cache: "no-store" });
  if (!res.ok) throw new Error(`ListModels HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 180)}`);
  const json = (await res.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
  return (json.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => String(m.name ?? "").replace(/^models\//, ""))
    .filter((n) => /^gemini/i.test(n))
    .sort();
}

/** Direct-Gemini text call (skips OpenRouter). Throws on any failure. */
async function geminiDirectText(system: string, user: string, opts: GeminiOptions): Promise<string> {
  const key = geminiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const json = await postGenerateRaw(key, buildBody(system, user, opts, Boolean(opts.grounding)), opts.timeoutMs ?? 30_000, opts.deadlineMs ?? 0);
  const text = partsText(json);
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

/**
 * One-shot text call with automatic provider routing:
 * 1. OpenRouter free-model chain (when OPENROUTER_API_KEY is set) — keeps
 *    working after the Gemini free daily cap hits;
 * 2. direct Gemini chain (primary + fallback models).
 * Throws with BOTH provider errors when both paths fail, so the toast tells
 * the whole story.
 */
export async function geminiText(system: string, user: string, opts: GeminiOptions = {}): Promise<string> {
  const orKey = openRouterKey();
  if (!orKey) return geminiDirectText(system, user, opts);
  try {
    return await postOpenRouter(orKey, system, user, opts);
  } catch (e) {
    const orError = (e as Error).message;
    if (!geminiKey()) throw e; // nothing to fall back to — surface the OpenRouter error
    try {
      return await geminiDirectText(system, user, opts);
    } catch (ge) {
      throw new Error(`${orError} | Gemini fallback also failed: ${(ge as Error).message}`);
    }
  }
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
