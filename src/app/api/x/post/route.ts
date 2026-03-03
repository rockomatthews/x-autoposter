import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../_lib/auth";
import { postTweet } from "../../_lib/x";

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const text = String(body?.text || "").trim();
    if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

    const out = await postTweet(text);
    return NextResponse.json(out, { status: out.ok ? 200 : 500 });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ error: e?.message || "Server error" }, { status });
  }
}
