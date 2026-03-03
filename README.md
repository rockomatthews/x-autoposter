# x-autoposter

Vercel-ready autoposter for **@TheBotTeamHQ**.

## Env vars (Vercel → Project → Settings → Environment Variables)
Required:
- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`
- `ADMIN_TOKEN` (random string)

Safety:
- `POST_MODE` = `draft` (default) or `live`

Optional:
- `POSTS_PER_DAY` (default 5)

## Endpoints
- `GET /api/health`
- `POST /api/x/post` (protected by `ADMIN_TOKEN`)
- `POST /api/slate` (set today’s slate; protected)
- `GET /api/cron/daily` (Vercel Cron target; posts next item)

## Notes
- We never post unless `POST_MODE=live`.
- Start in `draft` and verify responses.
