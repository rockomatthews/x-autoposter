import { NextRequest, NextResponse } from "next/server";
import { requireCron } from "../../_lib/cron";
import { llmGenerate } from "../../_lib/openai";
import { getMe, getMentions } from "../../_lib/x_read";
import { postTweet } from "../../_lib/x";
import { ensureToday, loadRepliesState, markReplied, hasReplied, saveRepliesState } from "../../_lib/replies_state";

function isAllowedToReply(text: string) {
  const t = text.toLowerCase();
  // Hard skips
  const banned = ["price", "$", "pump", "moon", "financial advice", "buy", "sell", "long", "short", "signal", "guaranteed", "dm me"]; 
  if (banned.some((b) => t.includes(b))) return false;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    requireCron(req);

    const maxPerDay = Number(process.env.REPLIES_PER_DAY || "10");
    const mode = (process.env.REPLY_MODE || "off").toLowerCase();
    if (mode !== "live") {
      return NextResponse.json({ ok: true, skipped: true, reason: "reply_mode_off" });
    }

    const me = await getMe();
    if (!me.ok) {
      return NextResponse.json({ ok: false, error: "getMe failed", me }, { status: 500 });
    }
    const myId = me.json?.data?.id as string | undefined;
    if (!myId) return NextResponse.json({ ok: false, error: "Missing my user id" }, { status: 500 });

    const state = await loadRepliesState();
    ensureToday(state);

    if (state.count >= maxPerDay) {
      return NextResponse.json({ ok: true, skipped: true, reason: "daily_cap", count: state.count });
    }

    const mentions = await getMentions({ userId: myId, sinceId: state.sinceId, maxResults: 25 });
    if (!mentions.ok) {
      return NextResponse.json({ ok: false, error: "getMentions failed", mentions }, { status: 500 });
    }

    const tweets: any[] = Array.isArray(mentions.json?.data) ? mentions.json.data : [];
    // Process oldest-first
    tweets.sort((a, b) => String(a.id).localeCompare(String(b.id)));

    let replied = 0;
    let lastId = state.sinceId;
    const outputs: any[] = [];

    for (const tw of tweets) {
      const id = String(tw.id);
      lastId = id;
      if (state.count + replied >= maxPerDay) break;
      if (!id) continue;

      const authorId = String(tw.author_id || "");
      if (authorId && authorId === myId) continue;

      if (await hasReplied(state.date, id)) continue;

      const text = String(tw.text || "");
      if (!isAllowedToReply(text)) {
        await markReplied(state.date, id); // mark as handled
        continue;
      }

      const brand = process.env.BRAND_HANDLE || "@TheBotTeamHQ";
      const sys =
        "You are the CIO of The Bot Team. You reply briefly, high-integrity, builder-first. No hype. No financial advice. Never argue. If the mention is vague, ask one clarifying question. Output ONLY the reply text.";

      const replyText = await llmGenerate({
        system: sys,
        user: `Write a reply from ${brand} to this mention. Keep it under 220 characters.\n\nMention:\n${text}`,
        temperature: 0.4,
        maxTokens: 120,
      });

      const cleaned = replyText.replace(/^```[\s\S]*?\n/, "").replace(/```\s*$/, "").trim();
      if (!cleaned) continue;

      const out = await postTweet(cleaned, { inReplyToTweetId: id });
      outputs.push({ mentionId: id, out });

      if (out.ok) {
        replied += 1;
        await markReplied(state.date, id);
      }
    }

    state.count += replied;
    state.sinceId = lastId;
    state.updatedAt = new Date().toISOString();
    await saveRepliesState(state);

    return NextResponse.json({ ok: true, replied, count: state.count, sinceId: state.sinceId, outputs });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status });
  }
}
