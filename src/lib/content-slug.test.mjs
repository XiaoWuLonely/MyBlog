import assert from "node:assert/strict";
import test from "node:test";
import { normalizeContentSlug } from "./content-slug.ts";

test("normalizeContentSlug decodes encoded slugs and keeps plain values stable", () => {
  assert.equal(normalizeContentSlug("%E6%B5%8B%E8%AF%95%E9%A1%B9%E7%9B%AE"), "测试项目");
  assert.equal(normalizeContentSlug("测试项目"), "测试项目");
  assert.equal(normalizeContentSlug("%E6%ZZ"), "%E6%ZZ");
});
