import { kv } from "@vercel/kv";

export type RepliesState = {
  date: string; // YYYY-MM-DD
  count: number;
  sinceId?: string;
  updatedAt: string;
};

const REPLIES_KEY = "x-autoposter-replies";
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyState(): RepliesState {
  return { date: todayISO(), count: 0, sinceId: undefined, updatedAt: new Date().toISOString() };
}

export function ensureToday(state: RepliesState) {
  const t = todayISO();
  if (state.date !== t) {
    state.date = t;
    state.count = 0;
    state.updatedAt = new Date().toISOString();
  }
}

export async function loadRepliesState(): Promise<RepliesState> {
  const hasKv = !!process.env.KV_REST_API_URL;
  if (!hasKv) {
    const g: any = globalThis as any;
    return g.__REPLIES__ || emptyState();
  }
  const s = (await kv.get(REPLIES_KEY)) as RepliesState | null;
  return s || emptyState();
}

export async function saveRepliesState(state: RepliesState) {
  const hasKv = !!process.env.KV_REST_API_URL;
  if (!hasKv) {
    const g: any = globalThis as any;
    g.__REPLIES__ = state;
    return;
  }
  await kv.set(REPLIES_KEY, state);
}

function repliedSetKey(date: string) {
  return `x-autoposter-replied:${date}`;
}

export async function hasReplied(date: string, tweetId: string) {
  const hasKv = !!process.env.KV_REST_API_URL;
  if (!hasKv) {
    const g: any = globalThis as any;
    g.__REPLIED__ = g.__REPLIED__ || new Set();
    return g.__REPLIED__.has(tweetId);
  }
  const key = repliedSetKey(date);
  const v = await kv.sismember(key, tweetId);
  return !!v;
}

export async function markReplied(date: string, tweetId: string) {
  const hasKv = !!process.env.KV_REST_API_URL;
  if (!hasKv) {
    const g: any = globalThis as any;
    g.__REPLIED__ = g.__REPLIED__ || new Set();
    g.__REPLIED__.add(tweetId);
    return;
  }
  const key = repliedSetKey(date);
  await kv.sadd(key, tweetId);
  // keep 3 days
  await kv.expire(key, 60 * 60 * 24 * 3);
}
