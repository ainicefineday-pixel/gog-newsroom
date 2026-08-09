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
