CREATE TABLE `x_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`profile_url` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`collection_interval_minutes` integer DEFAULT 30 NOT NULL,
	`last_checked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_x_accounts_username` ON `x_accounts` (`username`);--> statement-breakpoint
CREATE INDEX `idx_x_accounts_active_checked` ON `x_accounts` (`is_active`,`last_checked_at`);--> statement-breakpoint
CREATE TABLE `x_collection_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`posts_found` integer DEFAULT 0 NOT NULL,
	`new_posts_saved` integer DEFAULT 0 NOT NULL,
	`duplicates` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `idx_x_collection_jobs_account_started` ON `x_collection_jobs` (`account_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_x_collection_jobs_status_started` ON `x_collection_jobs` (`status`,`started_at`);--> statement-breakpoint
CREATE TABLE `x_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform_post_id` text,
	`account_id` integer NOT NULL,
	`post_url` text NOT NULL,
	`text` text NOT NULL,
	`post_created_at` text NOT NULL,
	`media_urls_json` text DEFAULT '[]' NOT NULL,
	`external_urls_json` text DEFAULT '[]' NOT NULL,
	`reply_count` integer,
	`repost_count` integer,
	`like_count` integer,
	`quote_count` integer,
	`view_count` integer,
	`language` text,
	`source` text NOT NULL,
	`raw_data_json` text,
	`collected_at` text NOT NULL,
	`created_at_db` text NOT NULL,
	`updated_at_db` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_x_posts_platform_post_id` ON `x_posts` (`platform_post_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_x_posts_post_url` ON `x_posts` (`post_url`);--> statement-breakpoint
CREATE INDEX `idx_x_posts_account_created` ON `x_posts` (`account_id`,`post_created_at`);--> statement-breakpoint
CREATE INDEX `idx_x_posts_collected_at` ON `x_posts` (`collected_at`);