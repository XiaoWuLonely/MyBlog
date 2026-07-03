import assert from "node:assert/strict";
import test from "node:test";
import { validateMessageInput } from "./messages.ts";

test("validateMessageInput requires name, valid email, and body", () => {
  const invalid = validateMessageInput({
    name: " ",
    email: "not-email",
    body: "",
  });

  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.errors, {
    name: "Name is required.",
    email: "Email must be valid.",
    body: "Message is required.",
  });

  const valid = validateMessageInput({
    name: "  Oya  ",
    email: "OYA@EXAMPLE.COM ",
    body: " hello\r\nworld ",
  });

  assert.deepEqual(valid, {
    ok: true,
    value: {
      name: "Oya",
      email: "oya@example.com",
      body: "hello\nworld",
    },
  });
});
