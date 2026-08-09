CREATE TABLE `daily_digests` (
	`date` text PRIMARY KEY NOT NULL,
	`content_th` text NOT NULL,
	`story_count` integer NOT NULL,
	`generated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_daily_digests_generated_at` ON `daily_digests` (`generated_at`);--> statement-breakpoint
CREATE TABLE `ingest_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text NOT NULL,
	`fetched` integer NOT NULL,
	`matched` integer NOT NULL,
	`stored` integer NOT NULL,
	`status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ingest_runs_finished_at` ON `ingest_runs` (`finished_at`);--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`story_date` text NOT NULL,
	`category` text NOT NULL,
	`credibility` integer NOT NULL,
	`title_en` text NOT NULL,
	`title_th` text NOT NULL,
	`summary_th` text NOT NULL,
	`sources_json` text NOT NULL,
	`url` text NOT NULL,
	`published_at` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`angle_suggestions_json` text DEFAULT '[]' NOT NULL,
	`topic_terms_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_stories_published_at` ON `stories` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_stories_category_credibility` ON `stories` (`category`,`credibility`);--> statement-breakpoint
CREATE INDEX `idx_stories_verified_date` ON `stories` (`verified`,`story_date`);--> statement-breakpoint
CREATE TABLE `story_source_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`story_id` text NOT NULL,
	`source_name` text NOT NULL,
	`source_tier` integer NOT NULL,
	`source_url` text NOT NULL,
	`published_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_story_source_events_story_url` ON `story_source_events` (`story_id`,`source_url`);--> statement-breakpoint
CREATE INDEX `idx_story_source_events_story_published` ON `story_source_events` (`story_id`,`published_at`);