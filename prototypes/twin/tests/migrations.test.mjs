import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
const sequence = [
  "0000_last_chameleon.sql",
  "0001_persistent_intelligence.sql",
  "0002_verified_agent_runtime.sql",
  "0003_personal_agency_assurance.sql",
];
async function migrate(db, files = sequence) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS rehearsal_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL)",
  );
  const applied = db
    .prepare("SELECT name FROM rehearsal_migrations ORDER BY rowid")
    .all()
    .map((x) => x.name);
  if (applied.some((x, i) => x !== sequence[i])) throw Error("UNRECONCILED_MIGRATION");
  for (const file of files) {
    if (!sequence.includes(file)) throw Error("UNRECONCILED_MIGRATION");
    const sql = await fs.readFile("drizzle/" + file, "utf8"),
      hash = createHash("sha256").update(sql).digest("hex");
    const old = db.prepare("SELECT sha256 FROM rehearsal_migrations WHERE name=?").get(file);
    if (old) {
      assert.equal(old.sha256, hash);
      continue;
    }
    const count = db.prepare("SELECT COUNT(*) n FROM rehearsal_migrations").get().n;
    if (sequence[count] !== file) throw Error("MIGRATION_ORDER");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO rehearsal_migrations VALUES(?,?)").run(file, hash);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}
test("migration ledger: 0000 -> 0001 -> 0002 -> 0003 preserves legacy state and reapply is a no-op", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  try {
    await migrate(db, sequence.slice(0, 1));
    db.prepare("INSERT INTO twin_accounts VALUES(?,?,?)").run(
      "synthetic-legacy",
      '{"syntheticMarker":"legacy-keep"}',
      7,
    );
    await migrate(db, sequence.slice(1));
    const a = db.prepare("SELECT * FROM twin_accounts").get();
    assert.equal(a.user_id, "synthetic-legacy");
    assert.equal(a.version, 7);
    assert.equal(a.state, '{"syntheticMarker":"legacy-keep"}');
    assert.ok(a.generation);
    assert.equal(
      db.prepare("SELECT generation FROM twin_intelligence_heads").get().generation,
      a.generation,
    );
    await migrate(db);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM rehearsal_migrations").get().n, 4);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});
test("migration refuses competing P0-002 ledger and out-of-order application", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    await assert.rejects(() => migrate(db, [sequence[2]]), /MIGRATION_ORDER/);
    await migrate(db, [sequence[0]]);
    db.prepare("INSERT INTO rehearsal_migrations VALUES(?,?)").run(
      "0001_agent_receipts.sql",
      "competing",
    );
    await assert.rejects(() => migrate(db), /UNRECONCILED_MIGRATION/);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='twin_workflows'").get().n,
      0,
    );
  } finally {
    db.close();
  }
});
test("0003 rollback is transactional and 0002 snapshot can be restored", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    await migrate(db, sequence.slice(0, 3));
    const before = db.prepare("SELECT name,sql FROM sqlite_master ORDER BY name").all();
    db.exec("BEGIN");
    db.exec(await fs.readFile("drizzle/" + sequence[3], "utf8"));
    assert.throws(() => db.exec("INSERT INTO table_that_does_not_exist VALUES(1)"));
    db.exec("ROLLBACK");
    assert.deepEqual(db.prepare("SELECT name,sql FROM sqlite_master ORDER BY name").all(), before);
    await migrate(db, [sequence[3]]);
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='twin_workflows'").get());
  } finally {
    db.close();
  }
});
