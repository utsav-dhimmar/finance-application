CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`currency_code` text DEFAULT 'INR' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "user_preferences_currency_code_check" CHECK("user_preferences"."currency_code" in ('INR'))
);
