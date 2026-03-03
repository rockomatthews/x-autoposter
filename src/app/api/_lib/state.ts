type SlateState = {
  date: string; // YYYY-MM-DD
  index: number;
  posts: string[];
  updatedAt: string;
};

const KEY = "x-autoposter-slate";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function loadSlate(): SlateState {
  if (!process.env.KV_REST_API_URL) {
    // Fallback: in-memory-ish state via global (not durable, but works without KV).
    const g: any = globalThis as any;
    return (
      g.__SLATE__ || {
        date: todayISO(),
        index: 0,
        posts: [],
        updatedAt: new Date().toISOString(),
      }
    );
  }
  throw new Error("KV required for durable slate state (set Vercel KV envs)");
}

export function saveSlate(state: SlateState) {
  const g: any = globalThis as any;
  g.__SLATE__ = state;
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
