CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`date` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`archived_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "transactions_type_check" CHECK("transactions"."type" in ('income', 'expense')),
	CONSTRAINT "transactions_amount_positive_check" CHECK("transactions"."amount_minor" > 0),
	CONSTRAINT "transactions_status_check" CHECK("transactions"."status" in ('active', 'archived', 'deleted'))
);
--> statement-breakpoint
CREATE INDEX `transactions_user_date_idx` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_user_account_date_idx` ON `transactions` (`user_id`,`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_user_category_idx` ON `transactions` (`user_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_user_status_date_idx` ON `transactions` (`user_id`,`status`,`date`);