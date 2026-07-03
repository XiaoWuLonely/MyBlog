import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("D1 message migration creates the messages table and created index", () => {
  const migration = readFileSync("migrations/0002_messages.sql", "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS messages/i);
  assert.match(migration, /\bid TEXT PRIMARY KEY\b/i);
  assert.match(migration, /\bread_at TEXT\b/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_messages_created/i);
});
