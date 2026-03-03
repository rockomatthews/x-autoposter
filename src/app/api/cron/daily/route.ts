import { NextRequest, NextResponse } from "next/server";
import { requireCron } from "../../_lib/cron";
import { ensureToday, loadSlate, saveSlate } from "../../_lib/state";
import { postTweet } from "../../_lib/x";

export async function GET(req: NextRequest) {
  requireCron(req);
  const s = await loadSlate();
  ensureToday(s);

  if (!s.posts.length) {
    return NextResponse.json({ ok: true, skipped: true, reason: "empty_slate" });
  }

  if (s.index >= s.posts.length) {
    return NextResponse.json({ ok: true, skipped: true, reason: "done_for_today" });
  }

  const text = s.posts[s.index];
  const out = await postTweet(text);
  if (out.ok) {
    s.index += 1;
    s.updatedAt = new Date().toISOString();
    await saveSlate(s);
  }

  return NextResponse.json({ ok: out.ok, postedIndex: s.index - (out.ok ? 1 : 0), out, mode: process.env.POST_MODE || "draft" });
}
