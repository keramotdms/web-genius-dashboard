import { NextResponse } from "next/server";
import { db, ensureSchema, resolveDatabaseUrl } from "@/lib/db";
import { aiConfigured, geminiKeySource } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Deployment self-diagnosis. Open <deployed-url>/api/health in a browser to
 * see exactly why the dashboard cannot sync. Every check returns a small,
 * readable status — no secrets are ever included in the output.
 */
export async function GET() {
  const checks: Record<string, unknown> = {};
  let ok = true;

  // 1) DATABASE_URL present? (resolveDatabaseUrl = same lookup the Prisma
  // client uses, so the check matches what the app actually connects with)
  const dbUrl = resolveDatabaseUrl() ?? "";
  const dbUrlMasked = dbUrl
    ? `${dbUrl.split("@")[0]?.replace(/:[^:@]*$/, ":***")}@${dbUrl.split("@")[1] ?? ""}`
    : "(not set)";
  checks.databaseUrl = {
    ok: /^postgres(ql)?:\/\//.test(dbUrl),
    value: dbUrlMasked,
    hint: dbUrl
      ? undefined
      : "Missing on the host. On Vercel: Settings → Environment Variables → add DATABASE_URL, then Redeploy.",
  };
  if (!dbUrl) ok = false;

  // 2) database reachable?
  try {
    await db.$queryRaw`SELECT 1`;
    checks.databaseConnection = { ok: true };
  } catch (e) {
    ok = false;
    checks.databaseConnection = {
      ok: false,
      error: (e as Error).message.split("\n")[0].slice(0, 300),
      hint: "Neon string wrong / project paused / region blocked. Test the connection string in Neon → Connect.",
    };
  }

  // 3) tables ready?
  try {
    await ensureSchema();
    const orders = await db.order.count();
    checks.databaseSchema = { ok: true, ordersSeeded: orders };
  } catch (e) {
    ok = false;
    checks.databaseSchema = { ok: false, error: (e as Error).message.split("\n")[0].slice(0, 300) };
  }

  // 4) Google Sheet reachable?
  try {
    const sheetUrl = "https://docs.google.com/spreadsheets/d/1g2J_pA9F2Tn9nSreafvia3cbRoDRONYJwFW_RruWRPo/export?format=xlsx";
    const res = await fetch(sheetUrl, { cache: "no-store", redirect: "follow" });
    checks.googleSheet = {
      ok: res.ok,
      status: res.status,
      bytes: Number(res.headers.get("content-length") ?? 0) || undefined,
      hint: !res.ok
        ? 'Sheet is not publicly readable. In Google Sheets: Share → "Anyone with the link" → Viewer.'
        : undefined,
    };
    if (!res.ok) ok = false;
  } catch (e) {
    ok = false;
    checks.googleSheet = { ok: false, error: (e as Error).message.slice(0, 200) };
  }

  // 5) Gemini key present? (AI features degrade gracefully without it)
  //    "source" shows WHICH env var name supplied it (never the value) so a
  //    name mismatch on Vercel is visible at a glance.
  const geminiSource = geminiKeySource();
  checks.geminiKey = {
    ok: aiConfigured(),
    required: false,
    source: geminiSource || undefined,
    hint: aiConfigured()
      ? undefined
      : "No Gemini key found. Set GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY from the Vercel AI Marketplace) in Settings → Environment Variables, then Redeploy.",
  };

  return NextResponse.json({
    ok,
    checkedAt: new Date().toISOString(),
    checks,
    summary: ok
      ? "All required checks passed — the dashboard should sync. If it still fails, check Vercel → Runtime Logs."
      : "One or more checks failed — fix the items marked ok:false, then Redeploy if you changed environment variables.",
  });
}
