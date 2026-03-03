import { NextRequest, NextResponse } from "next/server";
import { requireCron } from "../../_lib/cron";
import { ensureToday, loadSlate, saveSlate } from "../../_lib/state";
import { llmGenerate } from "../../_lib/openai";

function parsePosts(text: string) {
  // Expect 5 lines or a JSON array. Be forgiving.
  const trimmed = text.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        return arr.map((x) => String(x || "").trim()).filter(Boolean);
      }
    } catch {
      // ignore
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter(Boolean);

  return lines;
}

export async function GET(req: NextRequest) {
  try {
    requireCron(req);

    const s = loadSlate();
    ensureToday(s);

    const brand = process.env.BRAND_HANDLE || "@TheBotTeamHQ";
    const portalUrl = process.env.PORTAL_URL || "https://thebotteam.com/member-drops";

    // Call #1: generate slate
    const draft = await llmGenerate({
      system:
        "You write concise, high-integrity tweets for a crypto-native builder brand. No promises of returns. No price talk. No financial advice. Avoid 'soon'.",
      user:
        `Generate exactly 5 standalone tweets for ${brand}.\n\nTheme: BOTSQUAD = social integrity + access utility + locked drops + x402 pay-per-tool-call.\n\nRequirements:\n- Each tweet <= 240 chars\n- Include portal URL in at most 2 tweets: ${portalUrl}\n- Mention x402/pay-per-call in at least 1 tweet\n- Mention integrity checklist in at least 1 tweet\n- No hype-y claims like 'makes money on autopilot'\n\nReturn as JSON array of 5 strings.`,
      temperature: 0.55,
      maxTokens: 600,
    });

    // Call #2: polish + compliance
    const polished = await llmGenerate({
      system:
        "You are a strict editor. Ensure each tweet is clear, truthful, <=240 chars, no promises, no financial advice, no 'guaranteed', no '20x'.",
      user:
        `Clean up this list to comply. Keep exactly 5 tweets. Output JSON array only.\n\n${draft}`,
      temperature: 0.2,
      maxTokens: 500,
    });

    const posts = parsePosts(polished).slice(0, 5);
    if (posts.length !== 5) {
      return NextResponse.json(
        { ok: false, error: "LLM did not return 5 posts", raw: polished },
        { status: 500 }
      );
    }

    s.posts = posts;
    s.index = 0;
    s.updatedAt = new Date().toISOString();
    saveSlate(s);

    return NextResponse.json({ ok: true, slate: s, mode: process.env.POST_MODE || "draft" });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status });
  }
}
