import { kv } from "@vercel/kv";

type SlateState = {
  date: string; // YYYY-MM-DD
  index: number;
  posts: string[];
  updatedAt: string;
};

type RepliesState = {
  date: string; // YYYY-MM-DD
  count: number;
  sinceId?: string;
  updatedAt: string;
};

const KEY = "x-autoposter-slate";
const REPLIES_KEY = "x-autoposter-replies";
function repliedSetKey(date: string) {
  return `x-autoposter-replied:${date}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptySlate(): SlateState {
  return {
    date: todayISO(),
    index: 0,
    posts: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function loadSlate(): Promise<SlateState> {
  // Vercel serverless functions do NOT share memory. You need KV/Redis for durability.
  // If KV isn't configured, we fall back to per-instance memory (dev only).
  const hasKv = !!process.env.KV_REST_API_URL;

  if (!hasKv) {
    const g: any = globalThis as any;
    return g.__SLATE__ || emptySlate();
  }

  const s = (await kv.get(KEY)) as SlateState | null;
  return s || emptySlate();
}

export async function saveSlate(state: SlateState) {
  const hasKv = !!process.env.KV_REST_API_URL;
  if (!hasKv) {
    const g: any = globalThis as any;
    g.__SLATE__ = state;
    return;
  }
  await kv.set(KEY, state);
}

export function ensureToday(state: SlateState) {
  const t = todayISO();
  if (state.date !== t) {
    state.date = t;
    state.index = 0;
    state.posts = [];
    state.updatedAt = new Date().toISOString();
  }
}

export type { SlateState };
