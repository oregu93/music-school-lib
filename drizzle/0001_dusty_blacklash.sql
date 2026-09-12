ALTER TABLE `loans` ADD `reader_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `return_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `issued_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `returned_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `created_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_loans_active` ON `loans` (`record_id`,`return_date`);