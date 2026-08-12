# GOG NEWSROOM

Production newsroom for Thai Manchester United supporters. It ingests the configured RSS feeds, optionally falls back to NewsAPI and an authorized public-data X collector, filters for club relevance, clusters similar headlines, scores source credibility, generates grounded Thai editorial copy, and stores the result in D1/SQLite.

## Tactical Replay Lab

`/replay` contains two local, deterministic tactical replays. Each match definition stores stable player IDs, lineups, confirmed event anchors, published aggregate statistics, attribution links and a fixed reconstruction seed. The engine in `features/replay/engine.ts` fills the intervals between anchors, reconciles shots, shots on target, corners, fouls, cards and supplied xG totals, then validates the result before rendering.

The Canvas renderer interpolates player and ball positions at runtime instead of storing 60 frames per second. Seeking rebuilds score, active lineups and cards from the ordered event stream, so backward and forward jumps reproduce the same state. Timeline reports and analytics derive from that same stream. Confirmed facts use green labels; reconstructed movement and actions use amber; unverified incoming substitutes use blue.

To add a match, create a normalized `MatchDefinition` in `features/replay/data.ts`, provide confirmed anchors with `dataStatus: "confirmed"`, aggregate constraints and a stable seed. Genuine tracking data can later replace `positionsAt` while keeping the replay controls and event model. Current heatmaps, pass networks, movement, spatial coordinates and ordinary actions are illustrative reconstructions, not official tracking data.

## Local setup

1. Copy `.env.example` to `.env.local` and add only the keys you have.
2. Run `npm run dev`.
3. Open the local URL and use the sync control. RSS-only mode needs no API keys.

The app never stores full articles. It persists only headlines, short source excerpts rewritten as summaries, verification metadata, and original links.

## X public-data collector

The 15 configured accounts are synchronized into `x_accounts`, `x_posts`, and `x_collection_jobs` before relevant posts enter the editorial pipeline. Set `X_PROVIDER=third_party` with an authorized JSON endpoint, or `X_PROVIDER=public_source` with a lawful RSS/Atom URL template containing `{username}`. Mock data is disabled by default and is never silently used as production news.

The collector exposes read-only status endpoints at `GET /api/x/status`, `GET /api/x/accounts`, and `GET /api/x/posts`. It uses bounded requests, conservative retries, scheduled account intervals, durable deduplication, and structured job errors. It does not attempt authentication bypasses, CAPTCHA solving, private-data access, or anti-bot evasion.

### Provider configuration

For an authorized JSON provider:

```dotenv
X_PROVIDER=third_party
X_PROVIDER_BASE_URL=https://provider.example/api/
X_PROVIDER_API_KEY=replace-with-a-real-secret
X_PROVIDER_RECENT_PATH=/users/{username}/posts
```

For a lawful RSS/Atom source:

```dotenv
X_PROVIDER=public_source
X_PUBLIC_FEED_URL_TEMPLATE=https://feeds.example/users/{username}.xml
```

With no provider configured, RSS news continues normally and X is clearly shown as waiting. `X_PROVIDER=mock` works only when `X_ALLOW_MOCK_INGEST=true`; keep that combination in isolated development environments because mock posts are synthetic.

### Collector API

Mutation endpoints require `Authorization: Bearer <CRON_SECRET>` and are disabled until `CRON_SECRET` is set.

- `POST /api/x/accounts` with `{"username":"openai","collection_interval_minutes":30}` adds or re-enables an account.
- `GET /api/x/accounts/{username}`, `PATCH /api/x/accounts/{username}`, and `DELETE /api/x/accounts/{username}` inspect, update, or disable an account.
- `POST /api/x/collect/{username}` and `POST /api/x/collect-all` run manual collection.
- `GET /api/x/posts` accepts `username`, `since`, `until`, `language`, `min_likes`, `min_reposts`, `limit`, and `offset`.
- `GET /api/x/posts/{id}` and `GET /api/x/accounts/{username}/posts` return stored public posts.
- `GET /api/x/export/posts.csv` and `GET /api/x/export/posts.json` export the filtered store.
- `GET /api/x/search` returns `501` until the selected provider supplies a supported search implementation.

## Ingestion and scheduling

- `POST /api/ingest` runs an editorial sync from the newsroom UI.
- `GET /api/ingest` is the cron endpoint and accepts `Authorization: Bearer <CRON_SECRET>` when a secret is configured.
- The Worker also exposes a `scheduled` handler for a platform cron. Configure it to run every 10 minutes (`*/10 * * * *`).
- The first scheduled run after 07:00 Asia/Bangkok generates the previous day's verified digest.

## Storage

The logical `DB` D1 binding is declared in `.openai/hosting.json`. Runtime initialization uses single-statement prepared queries, while Drizzle owns the checked-in migration history in `drizzle/`.
