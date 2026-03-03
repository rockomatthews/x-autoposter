function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

// Minimal OAuth 1.0a signing for X v2 POST /2/tweets
// We avoid extra deps to keep deploy simple.
function pct(s: string) {
  return encodeURIComponent(s)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function hmacSha1Base64(key: string, msg: string) {
  // Use Node crypto to avoid subtle typing issues in edge/server runtimes.
  const { createHmac } = await import("node:crypto");
  return createHmac("sha1", key).update(msg).digest("base64");
}

function nonce() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export async function postTweet(text: string) {
  const mode = (process.env.POST_MODE || "draft").toLowerCase();
  if (mode !== "live") {
    return { ok: true, mode: "draft", wouldPost: text };
  }

  const apiKey = required("X_API_KEY");
  const apiSecret = required("X_API_SECRET");
  const accessToken = required("X_ACCESS_TOKEN");
  const accessSecret = required("X_ACCESS_TOKEN_SECRET");

  const url = "https://api.x.com/2/tweets";
  const method = "POST";

  const oauth: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  // Signature base string (no query params for this endpoint)
  const params = Object.entries(oauth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${pct(k)}=${pct(v)}`)
    .join("&");

  const baseString = [method, pct(url), pct(params)].join("&");
  const signingKey = `${pct(apiSecret)}&${pct(accessSecret)}`;
  const signature = await hmacSha1Base64(signingKey, baseString);
  oauth.oauth_signature = signature;

  const authHeader =
    "OAuth " +
    Object.entries(oauth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${pct(k)}=\"${pct(v)}\"`)
      .join(", ");

  const res = await fetch(url, {
    method,
    headers: {
      authorization: authHeader,
      "content-type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, json };
  }
  return { ok: true, json };
}
