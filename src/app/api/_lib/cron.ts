import { NextRequest } from "next/server";

export function requireCron(req: NextRequest) {
  const token = process.env.CRON_SECRET;
  if (!token) throw new Error("Missing CRON_SECRET");

  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!got || got !== token) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}
