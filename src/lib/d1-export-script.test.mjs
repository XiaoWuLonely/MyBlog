import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("D1 content export script runs to completion", () => {
  const result = spawnSync(process.execPath, ["scripts/export-content-for-d1.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
});
