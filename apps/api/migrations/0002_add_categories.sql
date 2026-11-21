CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`name_normalized` text NOT NULL,
	`type` text NOT NULL,
	`color` text,
	`icon` text,
	`status` text DEFAULT 'active' NOT NULL,
	`archived_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "categories_type_check" CHECK("categories"."type" in ('income', 'expense')),
	CONSTRAINT "categories_status_check" CHECK("categories"."status" in ('active', 'archived', 'deleted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_name_unique` ON `categories` (`user_id`,`name_normalized`) WHERE "categories"."status" != 'deleted';--> statement-breakpoint
CREATE INDEX `categories_user_status_idx` ON `categories` (`user_id`,`status`);