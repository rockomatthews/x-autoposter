import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../_lib/auth";
import { ensureToday, loadSlate, saveSlate } from "../_lib/state";

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const posts = Array.isArray(body?.posts) ? body.posts.map((x: any) => String(x || "").trim()).filter(Boolean) : [];
    if (!posts.length) return NextResponse.json({ error: "Missing posts[]" }, { status: 400 });

    const s = await loadSlate();
    ensureToday(s);
    s.posts = posts;
    s.index = 0;
    s.updatedAt = new Date().toISOString();
    await saveSlate(s);

    return NextResponse.json({ ok: true, slate: s });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ error: e?.message || "Server error" }, { status });
  }
}

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const s = await loadSlate();
    ensureToday(s);
    return NextResponse.json({ ok: true, slate: s });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ error: e?.message || "Server error" }, { status });
  }
}
