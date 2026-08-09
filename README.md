# GOG NEWSROOM

Production newsroom for Thai Manchester United supporters. It ingests the configured RSS feeds, optionally falls back to NewsAPI and X API v2, filters for club relevance, clusters similar headlines, scores source credibility, generates grounded Thai editorial copy, and stores the result in D1/SQLite.

## Local setup

1. Copy `.env.example` to `.env.local` and add only the keys you have.
2. Run `npm run dev`.
3. Open the local URL and use the sync control. RSS-only mode needs no API keys.

The app never stores full articles. It persists only headlines, short source excerpts rewritten as summaries, verification metadata, and original links.

## Ingestion and scheduling

- `POST /api/ingest` runs an editorial sync from the newsroom UI.
- `GET /api/ingest` is the cron endpoint and accepts `Authorization: Bearer <CRON_SECRET>` when a secret is configured.
- The Worker also exposes a `scheduled` handler for a platform cron. Configure it to run every 10 minutes (`*/10 * * * *`).
- The first scheduled run after 07:00 Asia/Bangkok generates the previous day's verified digest.

## Storage

The logical `DB` D1 binding is declared in `.openai/hosting.json`. Runtime initialization uses single-statement prepared queries, while Drizzle owns the checked-in migration history in `drizzle/`.

