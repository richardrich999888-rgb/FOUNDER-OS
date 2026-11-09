-- Apply only after P0-003 0000 -> 0001_persistent_intelligence -> 0002_verified_agent_runtime.
CREATE TABLE twin_workflows (
 owner TEXT NOT NULL,generation TEXT NOT NULL,id TEXT NOT NULL,idempotency_key TEXT NOT NULL,
 intent TEXT NOT NULL,plan TEXT NOT NULL,plan_hash TEXT NOT NULL,source_refs TEXT NOT NULL,dependencies TEXT NOT NULL,
 priority INTEGER NOT NULL CHECK(priority BETWEEN 0 AND 3),project_importance INTEGER NOT NULL CHECK(project_importance BETWEEN 0 AND 3),
 state TEXT NOT NULL CHECK(state IN ('PROPOSED','AWAITING_APPROVAL','AUTHORIZED','RUNNING','COMPLETED','FAILED','CANCELLED','UNKNOWN')),
 version INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deadline_at INTEGER NOT NULL,
 authorization_id TEXT,run_id TEXT,lease_until INTEGER,attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 reason TEXT NOT NULL,actor TEXT NOT NULL CHECK(actor IN ('user','runtime','reconciler','system')),correlation_id TEXT NOT NULL,checkpoint_hash TEXT NOT NULL,
 PRIMARY KEY(owner,id),UNIQUE(owner,generation,id),UNIQUE(owner,generation,idempotency_key),
 FOREIGN KEY(owner,generation) REFERENCES twin_intelligence_heads(owner,generation) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX twin_workflow_activity ON twin_workflows(owner,updated_at);
--> statement-breakpoint
CREATE TABLE twin_workflow_authorizations (
 owner TEXT NOT NULL,generation TEXT NOT NULL,workflow_id TEXT NOT NULL,id TEXT NOT NULL,epoch INTEGER NOT NULL,
 plan_hash TEXT NOT NULL,issued_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,requires_consent INTEGER NOT NULL CHECK(requires_consent IN (0,1)),
 PRIMARY KEY(owner,id),FOREIGN KEY(owner,generation,workflow_id) REFERENCES twin_workflows(owner,generation,id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE twin_workflow_events (
 owner TEXT NOT NULL,generation TEXT NOT NULL,workflow_id TEXT NOT NULL,version INTEGER NOT NULL,
 previous_state TEXT,new_state TEXT NOT NULL,at INTEGER NOT NULL,actor TEXT NOT NULL,authorization_id TEXT,run_id TEXT,reason TEXT NOT NULL,correlation_id TEXT NOT NULL,
 PRIMARY KEY(owner,workflow_id,version),FOREIGN KEY(owner,generation,workflow_id) REFERENCES twin_workflows(owner,generation,id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE twin_workflow_outcomes (
 owner TEXT NOT NULL,generation TEXT NOT NULL,workflow_id TEXT NOT NULL,run_id TEXT NOT NULL,authorization_id TEXT NOT NULL,
 manifest_hash TEXT NOT NULL,receipt_count INTEGER NOT NULL CHECK(receipt_count>0),observed_at INTEGER NOT NULL,
 PRIMARY KEY(owner,run_id),FOREIGN KEY(owner,generation,workflow_id) REFERENCES twin_workflows(owner,generation,id) ON DELETE CASCADE,
 FOREIGN KEY(run_id,owner,generation) REFERENCES agent_runs(request_id,user_id,generation) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE twin_workflow_guard (
 owner TEXT NOT NULL,generation TEXT NOT NULL,workflow_id TEXT NOT NULL,expected_version INTEGER NOT NULL,expected_epoch INTEGER NOT NULL,valid_until INTEGER NOT NULL,
 PRIMARY KEY(owner,workflow_id),FOREIGN KEY(owner,generation,workflow_id) REFERENCES twin_workflows(owner,generation,id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TRIGGER twin_workflow_cas BEFORE INSERT ON twin_workflow_guard BEGIN
 SELECT CASE WHEN NEW.valid_until<=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) OR NOT EXISTS(
 SELECT 1 FROM twin_workflows w JOIN twin_intelligence_heads h ON h.owner=w.owner AND h.generation=w.generation
 WHERE w.owner=NEW.owner AND w.generation=NEW.generation AND w.id=NEW.workflow_id AND w.version=NEW.expected_version AND h.epoch=NEW.expected_epoch)
 THEN RAISE(ABORT,'WORKFLOW_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER twin_workflow_created AFTER INSERT ON twin_workflows BEGIN
 INSERT INTO twin_workflow_events VALUES(NEW.owner,NEW.generation,NEW.id,NEW.version,NULL,NEW.state,NEW.updated_at,NEW.actor,NEW.authorization_id,NEW.run_id,NEW.reason,NEW.correlation_id);
END;
--> statement-breakpoint
CREATE TRIGGER twin_workflow_transition BEFORE UPDATE ON twin_workflows BEGIN
 SELECT CASE WHEN NEW.version<>OLD.version+1 OR NEW.owner<>OLD.owner OR NEW.id<>OLD.id OR NEW.generation<>OLD.generation
 OR NEW.plan IS NOT OLD.plan OR NEW.plan_hash IS NOT OLD.plan_hash OR NEW.checkpoint_hash IS NOT OLD.checkpoint_hash
 OR NEW.intent IS NOT OLD.intent OR NEW.source_refs IS NOT OLD.source_refs OR NEW.dependencies IS NOT OLD.dependencies OR NEW.deadline_at<>OLD.deadline_at
 THEN RAISE(ABORT,'WORKFLOW_IMMUTABLE') END;
 SELECT CASE WHEN NOT (
 (OLD.state='PROPOSED' AND NEW.state IN ('AWAITING_APPROVAL','CANCELLED')) OR
 (OLD.state='AWAITING_APPROVAL' AND NEW.state IN ('AUTHORIZED','CANCELLED')) OR
 (OLD.state='AUTHORIZED' AND NEW.state IN ('RUNNING','AWAITING_APPROVAL','CANCELLED')) OR
 (OLD.state='RUNNING' AND NEW.state IN ('COMPLETED','FAILED','CANCELLED','UNKNOWN')) OR
 (OLD.state IN ('FAILED','UNKNOWN') AND NEW.state IN ('AWAITING_APPROVAL','CANCELLED')))
 THEN RAISE(ABORT,'WORKFLOW_TRANSITION') END;
 SELECT CASE WHEN NEW.state IN ('AUTHORIZED','RUNNING','COMPLETED') AND NOT EXISTS(
 SELECT 1 FROM twin_workflow_authorizations a JOIN twin_intelligence_heads h ON h.owner=a.owner AND h.generation=a.generation
 JOIN twin_accounts t ON t.user_id=h.owner AND t.generation=h.generation
 WHERE a.owner=NEW.owner AND a.workflow_id=NEW.id AND a.id=NEW.authorization_id AND a.plan_hash=NEW.plan_hash AND a.epoch=h.epoch
 AND a.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 AND NEW.deadline_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 AND (a.requires_consent=0 OR json_extract(t.state,'$.aiConsent')=1)) THEN RAISE(ABORT,'WORKFLOW_AUTHORIZATION') END;
 SELECT CASE WHEN NEW.state='COMPLETED' AND (NEW.actor<>'reconciler' OR NOT EXISTS(
 SELECT 1 FROM twin_workflow_outcomes o JOIN agent_runs r ON r.request_id=o.run_id AND r.user_id=o.owner AND r.generation=o.generation
 WHERE o.owner=NEW.owner AND o.generation=NEW.generation AND o.workflow_id=NEW.id AND o.run_id=NEW.run_id AND o.authorization_id=NEW.authorization_id
 AND r.status='completed' AND r.tool_executions=o.receipt_count AND r.completed_at<=NEW.lease_until
 AND o.receipt_count=(SELECT COUNT(*) FROM agent_execution_receipts e WHERE e.request_id=r.request_id AND e.user_id=r.user_id AND e.generation=r.generation AND e.authorization='allow' AND e.status='succeeded')
 AND NOT EXISTS(SELECT 1 FROM agent_execution_receipts e WHERE e.request_id=r.request_id AND (e.status<>'succeeded' OR e.authorization<>'allow'))))
 THEN RAISE(ABORT,'WORKFLOW_EVIDENCE_REQUIRED') END;
END;
--> statement-breakpoint
CREATE TRIGGER twin_workflow_changed AFTER UPDATE ON twin_workflows BEGIN
 INSERT INTO twin_workflow_events VALUES(NEW.owner,NEW.generation,NEW.id,NEW.version,OLD.state,NEW.state,NEW.updated_at,NEW.actor,NEW.authorization_id,NEW.run_id,NEW.reason,NEW.correlation_id);
 UPDATE agent_runs SET status='failed',error_code='AUTHORIZATION_REVOKED'
 WHERE request_id=OLD.run_id AND user_id=OLD.owner AND generation=OLD.generation AND status='running' AND NEW.state IN ('CANCELLED','UNKNOWN');
END;
--> statement-breakpoint
-- A change in personal context or consent invalidates current authorization in the same transaction.
CREATE TRIGGER twin_workflow_context_changed AFTER UPDATE OF epoch ON twin_intelligence_heads BEGIN
 UPDATE twin_workflows SET state=CASE WHEN state='RUNNING' THEN 'UNKNOWN' ELSE 'AWAITING_APPROVAL' END,
 version=version+1,updated_at=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),reason='AUTHORIZATION_REVOKED',actor='system',correlation_id=lower(hex(randomblob(16)))
 WHERE owner=NEW.owner AND generation=NEW.generation AND state IN ('AUTHORIZED','RUNNING');
END;
--> statement-breakpoint
CREATE TABLE twin_priority_overrides (
 owner TEXT NOT NULL,generation TEXT NOT NULL,source_ref TEXT NOT NULL,priority INTEGER NOT NULL CHECK(priority BETWEEN 0 AND 3),
 project_importance INTEGER NOT NULL CHECK(project_importance BETWEEN 0 AND 3),updated_at INTEGER NOT NULL,
 PRIMARY KEY(owner,source_ref),FOREIGN KEY(owner,generation) REFERENCES twin_intelligence_heads(owner,generation) ON DELETE CASCADE
);
