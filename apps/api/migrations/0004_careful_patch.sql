CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_account_id` text NOT NULL,
	`destination_account_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`date` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`archived_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`destination_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "transfers_amount_positive_check" CHECK("transfers"."amount_minor" > 0),
	CONSTRAINT "transfers_status_check" CHECK("transfers"."status" in ('active', 'archived', 'deleted'))
);
--> statement-breakpoint
CREATE INDEX `transfers_user_date_idx` ON `transfers` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `transfers_user_source_date_idx` ON `transfers` (`user_id`,`source_account_id`,`date`);--> statement-breakpoint
CREATE INDEX `transfers_user_destination_date_idx` ON `transfers` (`user_id`,`destination_account_id`,`date`);--> statement-breakpoint
CREATE INDEX `transfers_user_status_date_idx` ON `transfers` (`user_id`,`status`,`date`);