-- Sequential reconciliation of P0-002; never replace the applied P0-003 0001.
CREATE TABLE agent_runs (
 request_id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL,generation TEXT NOT NULL,epoch INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('running','completed','failed')),answer_source TEXT,
 started_at INTEGER NOT NULL,deadline_at INTEGER NOT NULL,completed_at INTEGER,duration_ms INTEGER,
 iterations INTEGER NOT NULL DEFAULT 0,tool_executions INTEGER NOT NULL DEFAULT 0,
 input_tokens INTEGER,output_tokens INTEGER,error_code TEXT,
 FOREIGN KEY(user_id,generation) REFERENCES twin_intelligence_heads(owner,generation) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX agent_run_owner_generation ON agent_runs(request_id,user_id,generation);
--> statement-breakpoint
CREATE INDEX agent_run_owner_time ON agent_runs(user_id,started_at);
--> statement-breakpoint
CREATE TABLE agent_execution_receipts (
 execution_id TEXT PRIMARY KEY NOT NULL,request_id TEXT NOT NULL,user_id TEXT NOT NULL,generation TEXT NOT NULL,
 call_index INTEGER NOT NULL,tool_id TEXT NOT NULL,authorization TEXT NOT NULL CHECK(authorization IN ('allow','deny')),
 status TEXT NOT NULL CHECK(status IN ('started','succeeded','failed','timed_out','denied')),
 started_at INTEGER NOT NULL,completed_at INTEGER,duration_ms INTEGER,error_code TEXT,source_ids TEXT NOT NULL DEFAULT '[]',
 FOREIGN KEY(request_id,user_id,generation) REFERENCES agent_runs(request_id,user_id,generation) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX agent_call_once ON agent_execution_receipts(request_id,call_index);
