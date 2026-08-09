import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const stories = sqliteTable(
  "stories",
  {
    id: text("id").primaryKey(),
    storyDate: text("story_date").notNull(),
    category: text("category").notNull(),
    credibility: integer("credibility").notNull(),
    titleEn: text("title_en").notNull(),
    titleTh: text("title_th").notNull(),
    summaryTh: text("summary_th").notNull(),
    sourcesJson: text("sources_json").notNull(),
    url: text("url").notNull(),
    publishedAt: text("published_at").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    anglesJson: text("angle_suggestions_json").notNull().default("[]"),
    topicTermsJson: text("topic_terms_json").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_stories_published_at").on(table.publishedAt),
    index("idx_stories_category_credibility").on(table.category, table.credibility),
    index("idx_stories_verified_date").on(table.verified, table.storyDate),
  ],
);

export const storySourceEvents = sqliteTable(
  "story_source_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storyId: text("story_id").notNull(),
    sourceName: text("source_name").notNull(),
    sourceTier: integer("source_tier").notNull(),
    sourceUrl: text("source_url").notNull(),
    publishedAt: text("published_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_story_source_events_story_url").on(table.storyId, table.sourceUrl),
    index("idx_story_source_events_story_published").on(table.storyId, table.publishedAt),
  ],
);

export const dailyDigests = sqliteTable(
  "daily_digests",
  {
    date: text("date").primaryKey(),
    contentTh: text("content_th").notNull(),
    storyCount: integer("story_count").notNull(),
    generatedAt: text("generated_at").notNull(),
  },
  (table) => [index("idx_daily_digests_generated_at").on(table.generatedAt)],
);

export const ingestRuns = sqliteTable(
  "ingest_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at").notNull(),
    fetched: integer("fetched").notNull(),
    matched: integer("matched").notNull(),
    stored: integer("stored").notNull(),
    status: text("status").notNull(),
    note: text("note").notNull().default(""),
  },
  (table) => [index("idx_ingest_runs_finished_at").on(table.finishedAt)],
);

export const xAccounts = sqliteTable(
  "x_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    displayName: text("display_name"),
    profileUrl: text("profile_url").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    collectionIntervalMinutes: integer("collection_interval_minutes").notNull().default(30),
    lastCheckedAt: text("last_checked_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_x_accounts_username").on(table.username),
    index("idx_x_accounts_active_checked").on(table.isActive, table.lastCheckedAt),
  ],
);

export const xPosts = sqliteTable(
  "x_posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    platformPostId: text("platform_post_id"),
    accountId: integer("account_id").notNull(),
    postUrl: text("post_url").notNull(),
    text: text("text").notNull(),
    postCreatedAt: text("post_created_at").notNull(),
    mediaUrlsJson: text("media_urls_json").notNull().default("[]"),
    externalUrlsJson: text("external_urls_json").notNull().default("[]"),
    replyCount: integer("reply_count"),
    repostCount: integer("repost_count"),
    likeCount: integer("like_count"),
    quoteCount: integer("quote_count"),
    viewCount: integer("view_count"),
    language: text("language"),
    source: text("source").notNull(),
    rawDataJson: text("raw_data_json"),
    collectedAt: text("collected_at").notNull(),
    createdAtDb: text("created_at_db").notNull(),
    updatedAtDb: text("updated_at_db").notNull(),
  },
  (table) => [
    uniqueIndex("idx_x_posts_platform_post_id").on(table.platformPostId),
    uniqueIndex("idx_x_posts_post_url").on(table.postUrl),
    index("idx_x_posts_account_created").on(table.accountId, table.postCreatedAt),
    index("idx_x_posts_collected_at").on(table.collectedAt),
  ],
);

export const xCollectionJobs = sqliteTable(
  "x_collection_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    postsFound: integer("posts_found").notNull().default(0),
    newPostsSaved: integer("new_posts_saved").notNull().default(0),
    duplicates: integer("duplicates").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_x_collection_jobs_account_started").on(table.accountId, table.startedAt),
    index("idx_x_collection_jobs_status_started").on(table.status, table.startedAt),
  ],
);
