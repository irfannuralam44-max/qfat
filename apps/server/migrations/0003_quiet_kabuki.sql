CREATE TABLE `credential_records` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`provider` text NOT NULL,
	`envelope_version` integer NOT NULL,
	`nonce` blob NOT NULL,
	`auth_tag` blob NOT NULL,
	`ciphertext` blob NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
