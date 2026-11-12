CREATE TABLE `media_items` (
	`id` text PRIMARY KEY NOT NULL,
	`original_filename` text NOT NULL,
	`media_type` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`sha256` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_items_storage_key_unique` ON `media_items` (`storage_key`);