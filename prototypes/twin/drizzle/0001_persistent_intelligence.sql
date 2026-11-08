-- P0-003 is based on P0-001. P0-002's separate 0001 migration is not incorporated.
ALTER TABLE twin_accounts ADD COLUMN generation TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE twin_accounts SET generation = lower(hex(randomblob(16))) WHERE generation = '';
--> statement-breakpoint
CREATE UNIQUE INDEX twin_account_generation ON twin_accounts(user_id,generation);
--> statement-breakpoint
CREATE TABLE twin_intelligence_heads (
 owner TEXT PRIMARY KEY NOT NULL,
 generation TEXT NOT NULL,
 epoch INTEGER NOT NULL DEFAULT 0 CHECK(epoch>=0),
 FOREIGN KEY(owner,generation) REFERENCES twin_accounts(user_id,generation) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX intelligence_head_generation ON twin_intelligence_heads(owner,generation);
--> statement-breakpoint
INSERT INTO twin_intelligence_heads(owner,generation) SELECT user_id,generation FROM twin_accounts;
--> statement-breakpoint
CREATE TRIGGER twin_account_generation_init AFTER INSERT ON twin_accounts BEGIN
 UPDATE twin_accounts SET generation=lower(hex(randomblob(16))) WHERE user_id=NEW.user_id AND generation='';
 INSERT INTO twin_intelligence_heads(owner,generation) SELECT user_id,generation FROM twin_accounts WHERE user_id=NEW.user_id;
END;
--> statement-breakpoint
CREATE TABLE twin_intelligence_records (
 owner TEXT NOT NULL, generation TEXT NOT NULL, id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('source','entity','fact','relationship','commitment','procedure','outcome','revision')),
 source_id TEXT NOT NULL, content TEXT, quote TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 confirmation TEXT NOT NULL CHECK(confirmation IN ('proposed','confirmed')),
 validity TEXT NOT NULL CHECK(validity IN ('valid','superseded','deleted','invalid')),
 valid_from TEXT NOT NULL, valid_to TEXT,
 privacy TEXT NOT NULL CHECK(privacy IN ('private','restricted')),
 version INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(owner,id),
 FOREIGN KEY(owner,generation) REFERENCES twin_intelligence_heads(owner,generation) ON DELETE CASCADE,
 FOREIGN KEY(owner,source_id) REFERENCES twin_intelligence_records(owner,id) DEFERRABLE INITIALLY DEFERRED
);
--> statement-breakpoint
CREATE UNIQUE INDEX intelligence_record_generation ON twin_intelligence_records(owner,generation,id);
--> statement-breakpoint
CREATE INDEX twin_intelligence_owner_status ON twin_intelligence_records(owner,validity,confirmation,kind,updated_at);
--> statement-breakpoint
CREATE TABLE twin_intelligence_dependencies (
 owner TEXT NOT NULL, record_id TEXT NOT NULL, ancestor_id TEXT NOT NULL,
 PRIMARY KEY(owner,record_id,ancestor_id),
 CHECK(record_id<>ancestor_id),
 FOREIGN KEY(owner,record_id) REFERENCES twin_intelligence_records(owner,id) ON DELETE CASCADE,
 FOREIGN KEY(owner,ancestor_id) REFERENCES twin_intelligence_records(owner,id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE twin_intelligence_guard (
 owner TEXT PRIMARY KEY NOT NULL,generation TEXT NOT NULL,expected_epoch INTEGER NOT NULL,
 FOREIGN KEY(owner,generation) REFERENCES twin_intelligence_heads(owner,generation) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TRIGGER twin_intelligence_cas BEFORE INSERT ON twin_intelligence_guard BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM twin_intelligence_heads WHERE owner=NEW.owner AND generation=NEW.generation AND epoch=NEW.expected_epoch)
 THEN RAISE(ABORT,'INTELLIGENCE_CONFLICT') END;
 UPDATE twin_intelligence_heads SET epoch=epoch+1 WHERE owner=NEW.owner AND generation=NEW.generation;
END;
--> statement-breakpoint
CREATE TABLE twin_intelligence_receipts (
 id TEXT PRIMARY KEY NOT NULL,owner TEXT NOT NULL,generation TEXT NOT NULL,
 tool TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('started','succeeded','denied','failed')),
 created_at TEXT NOT NULL,completed_at TEXT,epoch INTEGER NOT NULL,
 FOREIGN KEY(owner,generation) REFERENCES twin_intelligence_heads(owner,generation) ON DELETE CASCADE
);
--> statement-breakpoint
-- A legacy correction/deletion invalidates every derived representation in the
-- SAME transaction as the old UI write. Raw deleted/corrected content is scrubbed.
CREATE TRIGGER twin_legacy_invalidation AFTER UPDATE OF state ON twin_accounts BEGIN
 UPDATE twin_intelligence_records SET content=NULL,quote='',validity='invalid',version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE owner=NEW.user_id AND id IN (
  WITH RECURSIVE affected(id) AS (
   SELECT r.id FROM twin_intelligence_records r WHERE r.owner=NEW.user_id AND r.kind='source' AND json_extract(r.content,'$.origin')='legacy'
   AND (SELECT j.value FROM json_each(OLD.state,CASE json_extract(r.content,'$.legacyKind') WHEN 'memory' THEN '$.memories' WHEN 'document' THEN '$.documents' ELSE '$.tasks' END) j WHERE json_extract(j.value,'$.id')=json_extract(r.content,'$.legacyId'))
   IS NOT (SELECT j.value FROM json_each(NEW.state,CASE json_extract(r.content,'$.legacyKind') WHEN 'memory' THEN '$.memories' WHEN 'document' THEN '$.documents' ELSE '$.tasks' END) j WHERE json_extract(j.value,'$.id')=json_extract(r.content,'$.legacyId'))
   UNION SELECT d.record_id FROM twin_intelligence_dependencies d JOIN affected a ON d.ancestor_id=a.id WHERE d.owner=NEW.user_id
  ) SELECT id FROM affected
 );
 UPDATE twin_intelligence_heads SET epoch=epoch+1 WHERE owner=NEW.user_id;
END;
