CREATE TABLE `agent_execution_receipts` (
	`execution_id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`user_id` text NOT NULL,
	`call_index` integer NOT NULL,
	`tool_id` text NOT NULL,
	`authorization` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`duration_ms` integer,
	`error_code` text,
	`source_ids` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_receipt_request_call` ON `agent_execution_receipts` (`request_id`,`call_index`);--> statement-breakpoint
CREATE INDEX `agent_receipt_user_time` ON `agent_execution_receipts` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`request_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`answer_source` text,
	`iterations` integer DEFAULT 0 NOT NULL,
	`tool_executions` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`duration_ms` integer,
	`error_code` text
);
--> statement-breakpoint
CREATE INDEX `agent_run_user_time` ON `agent_runs` (`user_id`,`started_at`);