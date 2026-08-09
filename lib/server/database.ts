import type { Digest, Story } from "@/lib/types";

export type RuntimeEnv = {
  DB?: D1Database;
  NEWSAPI_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  YOUTUBE_API_KEY?: string;
  X_PROVIDER?: string;
  X_PROVIDER_BASE_URL?: string;
  X_PROVIDER_API_KEY?: string;
  X_PROVIDER_RECENT_PATH?: string;
  X_PUBLIC_FEED_URL_TEMPLATE?: string;
  X_ALLOW_MOCK_INGEST?: string;
  X_COLLECTION_DEFAULT_INTERVAL?: string;
  X_MAX_POSTS_PER_COLLECTION?: string;
  X_MAX_ACCOUNTS_PER_RUN?: string;
  X_REQUEST_TIMEOUT_SECONDS?: string;
  CRON_SECRET?: string;
};

type StoryRow = {
  id: string;
  story_date: string;
  category: Story["category"];
  credibility: number;
  title_en: string;
  title_th: string;
  summary_th: string;
  sources_json: string;
  url: string;
  published_at: string;
  verified: number;
  angle_suggestions_json: string;
  topic_terms_json: string;
};

export async function ensureDatabase(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      story_date TEXT NOT NULL,
      category TEXT NOT NULL,
      credibility INTEGER NOT NULL,
      title_en TEXT NOT NULL,
      title_th TEXT NOT NULL,
      summary_th TEXT NOT NULL,
      sources_json TEXT NOT NULL,
      url TEXT NOT NULL,
      published_at TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      angle_suggestions_json TEXT NOT NULL DEFAULT '[]',
      topic_terms_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS story_source_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_tier INTEGER NOT NULL,
      source_url TEXT NOT NULL,
      published_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(story_id, source_url)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS daily_digests (
      date TEXT PRIMARY KEY,
      content_th TEXT NOT NULL,
      story_count INTEGER NOT NULL,
      generated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ingest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      fetched INTEGER NOT NULL,
      matched INTEGER NOT NULL,
      stored INTEGER NOT NULL,
      status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS x_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT,
      profile_url TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      collection_interval_minutes INTEGER NOT NULL DEFAULT 30,
      last_checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS x_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_post_id TEXT,
      account_id INTEGER NOT NULL,
      post_url TEXT NOT NULL UNIQUE,
      text TEXT NOT NULL,
      post_created_at TEXT NOT NULL,
      media_urls_json TEXT NOT NULL DEFAULT '[]',
      external_urls_json TEXT NOT NULL DEFAULT '[]',
      reply_count INTEGER,
      repost_count INTEGER,
      like_count INTEGER,
      quote_count INTEGER,
      view_count INTEGER,
      language TEXT,
      source TEXT NOT NULL,
      raw_data_json TEXT,
      collected_at TEXT NOT NULL,
      created_at_db TEXT NOT NULL,
      updated_at_db TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS x_collection_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      posts_found INTEGER NOT NULL DEFAULT 0,
      new_posts_saved INTEGER NOT NULL DEFAULT 0,
      duplicates INTEGER NOT NULL DEFAULT 0,
      error_code TEXT,
      error_message TEXT
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_stories_published_at ON stories(published_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_stories_category_credibility ON stories(category, credibility)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_stories_verified_date ON stories(verified, story_date)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_story_source_events_story_published ON story_source_events(story_id, published_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_ingest_runs_finished_at ON ingest_runs(finished_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_x_accounts_active_checked ON x_accounts(is_active, last_checked_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_x_posts_platform_post_id ON x_posts(platform_post_id) WHERE platform_post_id IS NOT NULL"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_x_posts_account_created ON x_posts(account_id, post_created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_x_posts_collected_at ON x_posts(collected_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_x_collection_jobs_account_started ON x_collection_jobs(account_id, started_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_x_collection_jobs_status_started ON x_collection_jobs(status, started_at)"),
  ]);
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function rowToStory(row: StoryRow): Story {
  return {
    id: row.id,
    date: row.story_date,
    category: row.category,
    credibility: row.credibility,
    titleEn: row.title_en,
    titleTh: row.title_th,
    summaryTh: row.summary_th,
    sources: safeJson(row.sources_json, []),
    url: row.url,
    publishedAt: row.published_at,
    verified: Boolean(row.verified),
    angles: safeJson(row.angle_suggestions_json, []),
    topicTerms: safeJson(row.topic_terms_json, []),
  };
}

export async function listStories(
  db: D1Database,
  options: { days?: number; category?: string; minCredibility?: number; source?: string } = {},
) {
  const days = Math.min(Math.max(options.days ?? 14, 1), 60);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const conditions = ["published_at >= ?"];
  const bindings: (string | number)[] = [since];

  if (options.category) {
    conditions.push("category = ?");
    bindings.push(options.category);
  }
  if (options.minCredibility) {
    conditions.push("credibility >= ?");
    bindings.push(options.minCredibility);
  }
  if (options.source) {
    conditions.push("lower(sources_json) LIKE ?");
    bindings.push(`%${options.source.toLowerCase()}%`);
  }

  const query = `SELECT * FROM stories WHERE ${conditions.join(" AND ")} ORDER BY published_at DESC LIMIT 250`;
  const result = await db.prepare(query).bind(...bindings).all<StoryRow>();
  return (result.results ?? []).map(rowToStory);
}

export async function upsertStory(db: D1Database, story: Story) {
  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO stories (
      id, story_date, category, credibility, title_en, title_th, summary_th,
      sources_json, url, published_at, verified, angle_suggestions_json,
      topic_terms_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      story_date = excluded.story_date,
      category = excluded.category,
      credibility = excluded.credibility,
      title_en = excluded.title_en,
      title_th = excluded.title_th,
      summary_th = excluded.summary_th,
      sources_json = excluded.sources_json,
      url = excluded.url,
      published_at = excluded.published_at,
      verified = excluded.verified,
      angle_suggestions_json = excluded.angle_suggestions_json,
      topic_terms_json = excluded.topic_terms_json,
      updated_at = excluded.updated_at`)
    .bind(
      story.id,
      story.date,
      story.category,
      story.credibility,
      story.titleEn,
      story.titleTh,
      story.summaryTh,
      JSON.stringify(story.sources),
      story.url,
      story.publishedAt,
      story.verified ? 1 : 0,
      JSON.stringify(story.angles),
      JSON.stringify(story.topicTerms),
      now,
      now,
    )
    .run();

  const statements = story.sources.map((source) =>
    db
      .prepare(`INSERT OR IGNORE INTO story_source_events (
        story_id, source_name, source_tier, source_url, published_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(story.id, source.name, source.tier, source.url, source.publishedAt, now),
  );
  if (statements.length) await db.batch(statements);
}

export async function getLatestSync(db: D1Database) {
  const row = await db
    .prepare("SELECT finished_at, fetched, matched, stored, status FROM ingest_runs ORDER BY id DESC LIMIT 1")
    .first<{ finished_at: string; fetched: number; matched: number; stored: number; status: string }>();
  return row ?? null;
}

export async function saveDigest(db: D1Database, digest: Digest) {
  await db
    .prepare(`INSERT INTO daily_digests (date, content_th, story_count, generated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET content_th = excluded.content_th,
      story_count = excluded.story_count, generated_at = excluded.generated_at`)
    .bind(digest.date, digest.contentTh, digest.storyCount, digest.generatedAt)
    .run();
}

export async function getDigest(db: D1Database, date: string) {
  const row = await db
    .prepare("SELECT date, content_th, story_count, generated_at FROM daily_digests WHERE date = ?")
    .bind(date)
    .first<{ date: string; content_th: string; story_count: number; generated_at: string }>();
  if (!row) return null;
  return { date: row.date, contentTh: row.content_th, storyCount: row.story_count, generatedAt: row.generated_at } satisfies Digest;
}
