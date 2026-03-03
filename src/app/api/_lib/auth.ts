import { NextRequest } from "next/server";

export function requireAdmin(req: NextRequest) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) throw new Error("Missing ADMIN_TOKEN");

  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!got || got !== token) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}
