function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function pct(s: string) {
  return encodeURIComponent(s)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function nonce() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

async function hmacSha1Base64(key: string, msg: string) {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha1", key).update(msg).digest("base64");
}

async function oauth1Fetch(url: string, method: "GET" | "POST") {
  const apiKey = required("X_API_KEY");
  const apiSecret = required("X_API_SECRET");
  const accessToken = required("X_ACCESS_TOKEN");
  const accessSecret = required("X_ACCESS_TOKEN_SECRET");

  const u = new URL(url);
  const baseUrl = `${u.origin}${u.pathname}`;

  const oauth: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  // Include query params in signature
  const allParams: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(oauth)) allParams.push([k, v]);
  for (const [k, v] of u.searchParams.entries()) allParams.push([k, v]);

  const paramString = allParams
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)))
    .map(([k, v]) => `${pct(k)}=${pct(v)}`)
    .join("&");

  const baseString = [method, pct(baseUrl), pct(paramString)].join("&");
  const signingKey = `${pct(apiSecret)}&${pct(accessSecret)}`;
  oauth.oauth_signature = await hmacSha1Base64(signingKey, baseString);

  const authHeader =
    "OAuth " +
    Object.entries(oauth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${pct(k)}=\"${pct(v)}\"`)
      .join(", ");

  const res = await fetch(url, {
    method,
    headers: { authorization: authHeader },
  });

  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export async function getMe() {
  const r = await oauth1Fetch("https://api.x.com/2/users/me", "GET");
  if (!r.ok) return r;
  return r;
}

export async function getMentions(opts: { userId: string; sinceId?: string; maxResults?: number }) {
  const params = new URLSearchParams();
  params.set("max_results", String(Math.min(Math.max(opts.maxResults || 10, 5), 100)));
  params.set("tweet.fields", "author_id,created_at,conversation_id,referenced_tweets");
  if (opts.sinceId) params.set("since_id", opts.sinceId);

  const url = `https://api.x.com/2/users/${opts.userId}/mentions?${params.toString()}`;
  return oauth1Fetch(url, "GET");
}
