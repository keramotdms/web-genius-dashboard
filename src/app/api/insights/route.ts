import { NextResponse } from "next/server";
import { loadDashboardData } from "@/lib/orders-store";
import { aiConfigured, geminiText } from "@/lib/gemini";
import type { DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const data = await loadDashboardData();
    const k = data.kpis;
    const topMembers = data.members.filter((m) => m.achievement > 0).slice(0, 5);
    const serviceSplit = Object.entries(k.byService)
      .sort((a, b) => b[1] - a[1])
      .map(([p, v]) => `${p}: $${v}`)
      .join(", ");
    const sourceSplit = Object.entries(k.bySource)
      .sort((a, b) => b[1] - a[1])
      .map(([p, v]) => `${p}: $${v}`)
      .join(", ");

    const summary = `You are a sales performance analyst for a web development agency (Fiverr-based team selling WordPress/Wix/Shopify website services). Analyze this ${k.monthLabel} snapshot and return EXACTLY 6 insights as plain text bullet lines, each starting with "- ". Rules: each bullet must contain a concrete number from the data; write in a direct, coach-like tone; order them from most to least important; no markdown headers; each bullet max 2 sentences.

DATA:
Month: ${k.monthLabel}
Month target: $${k.monthTarget}
Total achievement: $${k.achievement} (${k.achievementPct}% of target)
Away from target: $${k.awayFromTarget}
Green (fresh) sales: $${k.greenSales}; Yellow (repeat) sales: $${k.repeatOrders}
Daily average sales: $${k.dailyAvgSales} vs fixed daily target $${k.fixedDailyTarget}
Orders: ${k.totalOrders} total, ${k.deliveredOrders} delivered, ${k.wipOrders} WIP
Query funnel: ${data.funnel.queries} queries handled, ${data.funnel.converted} converted (${Math.round(data.funnel.convRate * 100)}% conversion rate), $${data.funnel.queryRevenue} sales came from Conversion/Query rows and $${data.funnel.briefRevenue} from Brief/Invitation rows
Platform split: ${serviceSplit}
Source split: ${sourceSplit}
Top members: ${topMembers.map((m) => `${m.name} $${m.achievement} (${m.orders} orders, ${m.queries} queries, ${m.converted} converted)`).join("; ") || "none yet"}
Days into month covered by data: ${data.daily.length}`;

    if (aiConfigured()) {
      try {
        const text = await geminiText(
          "You are a sharp, encouraging sales analyst. You output only the requested bullet lines.",
          summary,
          { temperature: 0.4, maxOutputTokens: 800, timeoutMs: 45_000 },
        );
        return NextResponse.json({ ok: true, insights: text, mode: "ai" });
      } catch (e) {
        console.error("Gemini insights failed, using rule-based fallback:", e);
      }
    }
    // No API key or Gemini call failed — deterministic insights so the
    // button always returns something useful.
    return NextResponse.json({ ok: true, insights: ruleBasedInsights(data), mode: "stats" });
  } catch (e) {
    console.error("POST /api/insights failed:", e);
    return NextResponse.json({ ok: false, error: "AI insights are unavailable right now. Please try again." }, { status: 502 });
  }
}

/** Deterministic, number-driven insights computed from the same snapshot. */
function ruleBasedInsights(data: DashboardData): string {
  const k = data.kpis;
  const pct = k.achievementPct;
  const dayPct = data.daily.length ? (data.daily.length / 30) * 100 : 0;
  const behind = pct < dayPct;
  const pace = behind ? "behind" : "ahead of";
  const conv = Math.round(data.funnel.convRate * 100);
  const top = [...data.members].filter((m) => m.achievement > 0).sort((a, b) => b.achievement - a.achievement)[0];
  const topSource = Object.entries(k.bySource).sort((a, b) => b[1] - a[1])[0];
  const topPlatform = Object.entries(k.byService).sort((a, b) => b[1] - a[1])[0];
  const lowPerformers = data.members.filter((m) => m.target > 0 && m.achievement / m.target < 0.2).length;

  const lines = [
    `- Pace check: $${k.achievement} achieved (${pct}% of the $${k.monthTarget} target) with ${data.daily.length} days of data — you are ${pace} the linear pace${behind ? `, and $${k.awayFromTarget} still to go.` : ". Keep the rhythm."}`,
    `- Daily discipline: averaging $${k.dailyAvgSales}/day vs the fixed $${k.fixedDailyTarget}/day target — ${k.dailyAvgSales >= k.fixedDailyTarget ? "target met, protect this streak" : `need $${(k.fixedDailyTarget - k.dailyAvgSales).toFixed(0)} more per day to stay on track`}.`,
    `- Query engine: ${data.funnel.queries} queries handled, ${data.funnel.converted} converted (${conv}%), bringing $${data.funnel.queryRevenue} from Conversion/Query rows — ${conv >= 20 ? "conversion is healthy, push query volume" : "conversion needs attention: follow up stalled briefs"}.`,
    `- Brief channel: $${data.funnel.briefRevenue} came from Brief/Invitation rows — ${data.funnel.briefRevenue > 0 ? "worth nurturing, it converts warm clients" : "untapped so far this month"}.`,
    top
      ? `- Top performer: ${top.name} leads with $${top.achievement} (${top.orders} orders, ${top.queries} queries) — share their follow-up playbook with the team.`
      : `- No member sales recorded yet — kick off outreach today.`,
    `- Concentration risk: ${topSource ? `top source is ${topSource[0]} ($${topSource[1]})` : "no source data"} and ${topPlatform ? `top platform is ${topPlatform[0]} ($${topPlatform[1]})` : "no platform data"}${lowPerformers ? `; ${lowPerformers} member(s) are below 20% of target — pair them with stronger closers.` : "."}`,
  ];
  return lines.filter(Boolean).join("\n");
}
