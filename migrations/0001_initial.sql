CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` integer,
	`action` text NOT NULL,
	`changes_json` text DEFAULT '{}' NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `catalog_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_record_id` ON `audit_log` (`record_id`);--> statement-breakpoint
CREATE TABLE `catalog_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`db_number` text DEFAULT '' NOT NULL,
	`bibliographic_id` text DEFAULT '' NOT NULL,
	`inventory_number` text DEFAULT '' NOT NULL,
	`record_state` text DEFAULT 'В фонде' NOT NULL,
	`record_type` text DEFAULT '' NOT NULL,
	`bibliographic_level` text DEFAULT '' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`title_full` text DEFAULT '' NOT NULL,
	`edition` text DEFAULT '' NOT NULL,
	`publication_place` text DEFAULT '' NOT NULL,
	`publisher` text DEFAULT '' NOT NULL,
	`publication_year` text DEFAULT '' NOT NULL,
	`physical_description` text DEFAULT '' NOT NULL,
	`series` text DEFAULT '' NOT NULL,
	`subjects` text DEFAULT '' NOT NULL,
	`keywords` text DEFAULT '' NOT NULL,
	`classification` text DEFAULT '' NOT NULL,
	`shelfmark` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`accounting_status` text DEFAULT '' NOT NULL,
	`fund_type` text DEFAULT '' NOT NULL,
	`invoice` text DEFAULT '' NOT NULL,
	`inventory_mode` text DEFAULT '' NOT NULL,
	`registration_date` text DEFAULT '' NOT NULL,
	`writeoff_date` text DEFAULT '' NOT NULL,
	`writeoff_act` text DEFAULT '' NOT NULL,
	`writeoff_reason` text DEFAULT '' NOT NULL,
	`loan_status` text DEFAULT 'В наличии' NOT NULL,
	`reader_id` text DEFAULT '' NOT NULL,
	`last_loan_date` text DEFAULT '' NOT NULL,
	`last_return_date` text DEFAULT '' NOT NULL,
	`loan_count` integer DEFAULT 0 NOT NULL,
	`marc_fields_json` text DEFAULT '' NOT NULL,
	`raw_marc` text DEFAULT '' NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`verified_by` text,
	`verified_at` text,
	`deleted_at` text,
	`deleted_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_db_number` ON `catalog_records` (`db_number`);--> statement-breakpoint
CREATE INDEX `idx_catalog_inventory_number` ON `catalog_records` (`inventory_number`);--> statement-breakpoint
CREATE INDEX `idx_catalog_author` ON `catalog_records` (`author`);--> statement-breakpoint
CREATE INDEX `idx_catalog_title` ON `catalog_records` (`title`);--> statement-breakpoint
CREATE INDEX `idx_catalog_deleted_at` ON `catalog_records` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `loans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` integer,
	`db_number` text DEFAULT '' NOT NULL,
	`reader_id` text DEFAULT '' NOT NULL,
	`loan_date` text DEFAULT '' NOT NULL,
	`return_date` text DEFAULT '' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `catalog_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_loans_record_id` ON `loans` (`record_id`);