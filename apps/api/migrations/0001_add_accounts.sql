CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`name_normalized` text NOT NULL,
	`type` text NOT NULL,
	`opening_balance_minor` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`archived_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "accounts_type_check" CHECK("accounts"."type" in ('cash', 'bank', 'wallet')),
	CONSTRAINT "accounts_status_check" CHECK("accounts"."status" in ('active', 'archived', 'deleted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_user_name_unique` ON `accounts` (`user_id`,`name_normalized`) WHERE "accounts"."status" != 'deleted';--> statement-breakpoint
CREATE INDEX `accounts_user_status_idx` ON `accounts` (`user_id`,`status`);