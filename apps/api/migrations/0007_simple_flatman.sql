CREATE TABLE `recurring_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`interval_months` integer NOT NULL,
	`source_account_id` text NOT NULL,
	`category_id` text NOT NULL,
	`start_date` text NOT NULL,
	`next_due_date` text NOT NULL,
	`end_date` text,
	`last_posted_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "recurring_expenses_amount_positive_check" CHECK("recurring_expenses"."amount_minor" > 0),
	CONSTRAINT "recurring_expenses_interval_positive_check" CHECK("recurring_expenses"."interval_months" > 0),
	CONSTRAINT "recurring_expenses_status_check" CHECK("recurring_expenses"."status" in ('active', 'paused', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `recurring_expenses_user_status_due_idx` ON `recurring_expenses` (`user_id`,`status`,`next_due_date`);--> statement-breakpoint
CREATE INDEX `recurring_expenses_user_due_idx` ON `recurring_expenses` (`user_id`,`next_due_date`);--> statement-breakpoint
CREATE INDEX `recurring_expenses_user_source_idx` ON `recurring_expenses` (`user_id`,`source_account_id`);--> statement-breakpoint
CREATE INDEX `recurring_expenses_user_category_idx` ON `recurring_expenses` (`user_id`,`category_id`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `recurring_expense_id` text REFERENCES recurring_expenses(id);--> statement-breakpoint
CREATE INDEX `transactions_user_recurring_idx` ON `transactions` (`user_id`,`recurring_expense_id`);