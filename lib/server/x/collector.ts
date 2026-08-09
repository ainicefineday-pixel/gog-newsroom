import { X_SOURCE_HANDLES } from "@/config/x-sources";
import type { RuntimeEnv } from "@/lib/server/database";
import {
  createXProvider,
  getXProviderStatus,
  XProviderError,
  X_USERNAME_PATTERN,
  type NormalizedXPost,
} from "@/lib/server/x/providers";

type XAccountRow = {
  id: number;
  username: string;
  display_name: string | null;
  profile_url: string;
  is_active: number;
  collection_interval_minutes: number;
  last_checked_at: string | null;
};

export type XCollectionError = {
  username: string;
  code: string;
  message: string;
  retryAfter: number | null;
};

export type XCollectionResult = {
  configured: boolean;
  provider: string | null;
  attempted: number;
  postsFound: number;
  newPostsSaved: number;
  duplicates: number;
  errors: XCollectionError[];
  posts: NormalizedXPost[];
};

function clampedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Math.min(Math.max(Number.isFinite(parsed) ? Math.round(parsed) : fallback, min), max);
}

function safeRawJson(value: unknown) {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) return null;
    if (serialized.length <= 100_000) return serialized;
    return JSON.stringify({ truncated: true, preview: serialized.slice(0, 95_000) });
  } catch {
    return JSON.stringify({ unavailable: true });
  }
}

function errorDetails(username: string, error: unknown): XCollectionError {
  if (error instanceof XProviderError) {
    return { username, code: error.code, message: error.message, retryAfter: error.retryAfter };
  }
  return {
    username,
    code: "provider_unavailable",
    message: error instanceof Error ? error.message : "X provider collection failed.",
    retryAfter: null,
  };
}

export async function ensureConfiguredWatchlist(db: D1Database, env: RuntimeEnv) {
  const now = new Date().toISOString();
  const interval = clampedInteger(env.X_COLLECTION_DEFAULT_INTERVAL, 30, 10, 1_440);
  await db.batch(X_SOURCE_HANDLES.map((username) => db
    .prepare(`INSERT INTO x_accounts (
      username, display_name, profile_url, is_active, collection_interval_minutes,
      last_checked_at, created_at, updated_at
    ) VALUES (?, NULL, ?, 1, ?, NULL, ?, ?)
    ON CONFLICT(username) DO UPDATE SET profile_url = excluded.profile_url, updated_at = excluded.updated_at`)
    .bind(username, `https://x.com/${username}`, interval, now, now)));
}

function isDue(account: XAccountRow, now: number) {
  if (!account.last_checked_at) return true;
  const checkedAt = Date.parse(account.last_checked_at);
  if (!Number.isFinite(checkedAt)) return true;
  return checkedAt + account.collection_interval_minutes * 60_000 <= now;
}

async function savePost(db: D1Database, account: XAccountRow, post: NormalizedXPost) {
  const existing = await db
    .prepare(`SELECT id FROM x_posts
      WHERE post_url = ? OR (platform_post_id IS NOT NULL AND platform_post_id = ?)
      ORDER BY id ASC LIMIT 1`)
    .bind(post.postUrl, post.postId)
    .first<{ id: number }>();
  const now = new Date().toISOString();
  const values = [
    account.id,
    post.postUrl,
    post.text,
    post.createdAt,
    JSON.stringify(post.mediaUrls),
    JSON.stringify(post.externalUrls),
    post.replyCount,
    post.repostCount,
    post.likeCount,
    post.quoteCount,
    post.viewCount,
    post.detectedLanguage,
    post.source,
    safeRawJson(post.rawData),
    post.collectedAt,
    now,
  ] as const;

  if (existing) {
    await db.prepare(`UPDATE x_posts SET
      account_id = ?, post_url = ?, text = ?, post_created_at = ?, media_urls_json = ?,
      external_urls_json = ?, reply_count = ?, repost_count = ?, like_count = ?, quote_count = ?,
      view_count = ?, language = ?, source = ?, raw_data_json = ?, collected_at = ?, updated_at_db = ?
      WHERE id = ?`)
      .bind(...values, existing.id)
      .run();
    return false;
  }

  await db.prepare(`INSERT INTO x_posts (
    platform_post_id, account_id, post_url, text, post_created_at, media_urls_json,
    external_urls_json, reply_count, repost_count, like_count, quote_count, view_count,
    language, source, raw_data_json, collected_at, created_at_db, updated_at_db
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(post.postId, ...values, now)
    .run();
  return true;
}

async function startJob(db: D1Database, accountId: number, provider: string, startedAt: string) {
  return db.prepare(`INSERT INTO x_collection_jobs (account_id, provider, status, started_at)
    VALUES (?, ?, 'running', ?) RETURNING id`)
    .bind(accountId, provider, startedAt)
    .first<{ id: number }>();
}

async function finishJob(
  db: D1Database,
  jobId: number | undefined,
  status: "succeeded" | "failed",
  counts: { postsFound: number; newPostsSaved: number; duplicates: number },
  error?: XCollectionError,
) {
  if (!jobId) return;
  await db.prepare(`UPDATE x_collection_jobs SET
    status = ?, finished_at = ?, posts_found = ?, new_posts_saved = ?, duplicates = ?,
    error_code = ?, error_message = ? WHERE id = ?`)
    .bind(
      status,
      new Date().toISOString(),
      counts.postsFound,
      counts.newPostsSaved,
      counts.duplicates,
      error?.code ?? null,
      error?.message ?? null,
      jobId,
    )
    .run();
}

export async function collectXWatchlist(env: RuntimeEnv, onlyUsername?: string): Promise<XCollectionResult> {
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  const db = env.DB;
  await ensureConfiguredWatchlist(db, env);
  const provider = createXProvider(env);
  const status = getXProviderStatus(env);
  const empty: XCollectionResult = {
    configured: status.configured,
    provider: status.kind,
    attempted: 0,
    postsFound: 0,
    newPostsSaved: 0,
    duplicates: 0,
    errors: [],
    posts: [],
  };
  if (!provider) return empty;

  if (onlyUsername && !X_USERNAME_PATTERN.test(onlyUsername)) {
    return { ...empty, errors: [errorDetails(onlyUsername, new XProviderError("invalid_username", "Invalid X username."))] };
  }

  const rows = await db.prepare(`SELECT id, username, display_name, profile_url, is_active,
    collection_interval_minutes, last_checked_at FROM x_accounts
    WHERE is_active = 1${onlyUsername ? " AND lower(username) = lower(?)" : ""}
    ORDER BY CASE WHEN last_checked_at IS NULL THEN 0 ELSE 1 END, last_checked_at ASC, username ASC`)
    .bind(...(onlyUsername ? [onlyUsername] : []))
    .all<XAccountRow>();
  const maxAccounts = onlyUsername ? 1 : clampedInteger(env.X_MAX_ACCOUNTS_PER_RUN, 5, 1, 15);
  const accounts = (rows.results ?? [])
    .filter((account) => Boolean(onlyUsername) || isDue(account, Date.now()))
    .slice(0, maxAccounts);
  const limit = clampedInteger(env.X_MAX_POSTS_PER_COLLECTION, 20, 1, 50);

  for (const account of accounts) {
    empty.attempted += 1;
    const startedAt = new Date().toISOString();
    const job = await startJob(db, account.id, provider.kind, startedAt);
    const counts = { postsFound: 0, newPostsSaved: 0, duplicates: 0 };
    try {
      const user = await provider.getUser(account.username);
      const posts = (await provider.getRecentPosts(account.username, limit))
        .filter((post) => post.username.toLowerCase() === account.username.toLowerCase());
      counts.postsFound = posts.length;
      for (const post of posts) {
        if (await savePost(db, account, post)) counts.newPostsSaved += 1;
        else counts.duplicates += 1;
      }
      empty.posts.push(...posts);
      empty.postsFound += counts.postsFound;
      empty.newPostsSaved += counts.newPostsSaved;
      empty.duplicates += counts.duplicates;
      await db.prepare(`UPDATE x_accounts SET display_name = COALESCE(?, display_name),
        profile_url = ?, last_checked_at = ?, updated_at = ? WHERE id = ?`)
        .bind(user.displayName, user.profileUrl, new Date().toISOString(), new Date().toISOString(), account.id)
        .run();
      await finishJob(db, job?.id, "succeeded", counts);
    } catch (error) {
      const details = errorDetails(account.username, error);
      empty.errors.push(details);
      await db.prepare("UPDATE x_accounts SET last_checked_at = ?, updated_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), new Date().toISOString(), account.id)
        .run();
      await finishJob(db, job?.id, "failed", counts, details);
    }
  }
  return empty;
}

export async function listXAccounts(db: D1Database) {
  const result = await db.prepare(`SELECT a.id, a.username, a.display_name, a.profile_url,
    a.is_active, a.collection_interval_minutes, a.last_checked_at,
    COUNT(p.id) AS stored_posts
    FROM x_accounts a LEFT JOIN x_posts p ON p.account_id = a.id
    GROUP BY a.id ORDER BY a.username ASC`).all();
  return result.results ?? [];
}

export async function getXAccount(db: D1Database, username: string) {
  if (!X_USERNAME_PATTERN.test(username)) return null;
  return db.prepare(`SELECT a.id, a.username, a.display_name, a.profile_url, a.is_active,
    a.collection_interval_minutes, a.last_checked_at, a.created_at, a.updated_at,
    COUNT(p.id) AS stored_posts
    FROM x_accounts a LEFT JOIN x_posts p ON p.account_id = a.id
    WHERE lower(a.username) = lower(?) GROUP BY a.id`)
    .bind(username)
    .first();
}

export async function createXAccount(db: D1Database, username: string, intervalMinutes = 30) {
  if (!X_USERNAME_PATTERN.test(username)) throw new XProviderError("invalid_username", "Invalid X username.");
  const normalizedUsername = username.toLowerCase();
  const interval = Math.min(Math.max(Math.round(intervalMinutes), 10), 1_440);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO x_accounts (
    username, display_name, profile_url, is_active, collection_interval_minutes,
    last_checked_at, created_at, updated_at
  ) VALUES (?, NULL, ?, 1, ?, NULL, ?, ?)
  ON CONFLICT(username) DO UPDATE SET is_active = 1,
    collection_interval_minutes = excluded.collection_interval_minutes,
    profile_url = excluded.profile_url, updated_at = excluded.updated_at`)
    .bind(normalizedUsername, `https://x.com/${normalizedUsername}`, interval, now, now)
    .run();
  return getXAccount(db, normalizedUsername);
}

export async function updateXAccount(
  db: D1Database,
  username: string,
  changes: { isActive?: boolean; collectionIntervalMinutes?: number },
) {
  if (!X_USERNAME_PATTERN.test(username)) throw new XProviderError("invalid_username", "Invalid X username.");
  const existing = await getXAccount(db, username);
  if (!existing) return null;
  const fields: string[] = [];
  const values: Array<string | number> = [];
  if (typeof changes.isActive === "boolean") {
    fields.push("is_active = ?");
    values.push(changes.isActive ? 1 : 0);
  }
  if (typeof changes.collectionIntervalMinutes === "number" && Number.isFinite(changes.collectionIntervalMinutes)) {
    fields.push("collection_interval_minutes = ?");
    values.push(Math.min(Math.max(Math.round(changes.collectionIntervalMinutes), 10), 1_440));
  }
  if (fields.length) {
    fields.push("updated_at = ?");
    values.push(new Date().toISOString(), username);
    await db.prepare(`UPDATE x_accounts SET ${fields.join(", ")} WHERE lower(username) = lower(?)`)
      .bind(...values)
      .run();
  }
  return getXAccount(db, username);
}

export async function deactivateXAccount(db: D1Database, username: string) {
  return updateXAccount(db, username, { isActive: false });
}

export type XPostFilters = {
  username?: string;
  since?: string;
  until?: string;
  language?: string;
  minLikes?: number;
  minReposts?: number;
  limit?: number;
  offset?: number;
};

export async function listXPosts(db: D1Database, filters: XPostFilters = {}) {
  const conditions: string[] = [];
  const bindings: Array<string | number> = [];
  if (filters.username && X_USERNAME_PATTERN.test(filters.username)) {
    conditions.push("lower(a.username) = lower(?)");
    bindings.push(filters.username);
  }
  if (filters.since && Number.isFinite(Date.parse(filters.since))) {
    conditions.push("p.post_created_at >= ?");
    bindings.push(new Date(filters.since).toISOString());
  }
  if (filters.until && Number.isFinite(Date.parse(filters.until))) {
    conditions.push("p.post_created_at <= ?");
    bindings.push(new Date(filters.until).toISOString());
  }
  if (filters.language) {
    conditions.push("lower(p.language) = lower(?)");
    bindings.push(filters.language.slice(0, 12));
  }
  if (Number.isFinite(filters.minLikes)) {
    conditions.push("COALESCE(p.like_count, 0) >= ?");
    bindings.push(Math.max(0, Math.round(filters.minLikes ?? 0)));
  }
  if (Number.isFinite(filters.minReposts)) {
    conditions.push("COALESCE(p.repost_count, 0) >= ?");
    bindings.push(Math.max(0, Math.round(filters.minReposts ?? 0)));
  }
  const limit = Math.min(Math.max(Math.round(filters.limit ?? 50), 1), 100);
  const offset = Math.min(Math.max(Math.round(filters.offset ?? 0), 0), 10_000);
  bindings.push(limit, offset);
  const result = await db.prepare(`SELECT p.id, p.platform_post_id, a.username, a.display_name,
    a.profile_url AS author_profile_url, p.post_url, p.text, p.post_created_at,
    p.media_urls_json, p.external_urls_json, p.reply_count, p.repost_count, p.like_count,
    p.quote_count, p.view_count, p.language, p.source, p.collected_at
    FROM x_posts p JOIN x_accounts a ON a.id = p.account_id
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY p.post_created_at DESC LIMIT ? OFFSET ?`)
    .bind(...bindings)
    .all();
  return result.results ?? [];
}

export async function getXPost(db: D1Database, id: number) {
  if (!Number.isInteger(id) || id < 1) return null;
  return db.prepare(`SELECT p.id, p.platform_post_id, a.username, a.display_name,
    a.profile_url AS author_profile_url, p.post_url, p.text, p.post_created_at,
    p.media_urls_json, p.external_urls_json, p.reply_count, p.repost_count, p.like_count,
    p.quote_count, p.view_count, p.language, p.source, p.collected_at
    FROM x_posts p JOIN x_accounts a ON a.id = p.account_id WHERE p.id = ?`)
    .bind(id)
    .first();
}

export async function getXCollectorStatus(db: D1Database, env: RuntimeEnv) {
  await ensureConfiguredWatchlist(db, env);
  const provider = getXProviderStatus(env);
  const counts = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM x_accounts WHERE is_active = 1) AS active_accounts,
    (SELECT COUNT(*) FROM x_posts) AS stored_posts,
    (SELECT COUNT(*) FROM x_collection_jobs WHERE status = 'failed') AS failed_jobs`).first();
  const latestJob = await db.prepare(`SELECT j.provider, j.status, j.started_at, j.finished_at,
    j.posts_found, j.new_posts_saved, j.duplicates, j.error_code, a.username
    FROM x_collection_jobs j JOIN x_accounts a ON a.id = j.account_id
    ORDER BY j.id DESC LIMIT 1`).first();
  return { provider, watchlistSize: X_SOURCE_HANDLES.length, counts, latestJob };
}
