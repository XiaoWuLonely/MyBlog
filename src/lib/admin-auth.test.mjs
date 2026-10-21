import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  hasAdminAccessConfig,
  readAdminSessionToken,
  sanitizeAdminNextPath,
} from "./admin-auth.ts";

test("admin auth constants keep the expected cookie name and ttl", () => {
  assert.equal(ADMIN_SESSION_COOKIE_NAME, "admin_session");
  assert.equal(ADMIN_SESSION_TTL_SECONDS, 60 * 60 * 24 * 7);
});

test("sanitizeAdminNextPath only keeps relative in-site paths", () => {
  assert.equal(sanitizeAdminNextPath(undefined), "/editor");
  assert.equal(sanitizeAdminNextPath(""), "/editor");
  assert.equal(sanitizeAdminNextPath("/editor?category=archive&slug=hello-world"), "/editor?category=archive&slug=hello-world");
  assert.equal(sanitizeAdminNextPath("/resources?q=motion&category=Design"), "/resources?q=motion&category=Design");
  assert.equal(sanitizeAdminNextPath("posts/hello-world"), "/editor");
  assert.equal(sanitizeAdminNextPath("https://example.com/admin"), "/editor");
  assert.equal(sanitizeAdminNextPath("//example.com/admin"), "/editor");
});

test("admin access config requires both the access code and session secret", () => {
  assert.equal(hasAdminAccessConfig({}), false);
  assert.equal(hasAdminAccessConfig({ ADMIN_ACCESS_CODE: "code-only" }), false);
  assert.equal(hasAdminAccessConfig({ ADMIN_SESSION_SECRET: "secret-only" }), false);
  assert.equal(
    hasAdminAccessConfig({
      ADMIN_ACCESS_CODE: "open-sesame",
      ADMIN_SESSION_SECRET: "very-secret-value",
    }),
    true,
  );
});

test("admin session token rejects tampering and expiration", () => {
  const secret = "very-secret-value";
  const issuedAt = Date.UTC(2026, 3, 23, 0, 0, 0);
  const token = createAdminSessionToken({
    sessionSecret: secret,
    expiresAt: issuedAt + 30_000,
  });

  assert.deepEqual(
    readAdminSessionToken(token, {
      sessionSecret: secret,
      now: issuedAt,
    }),
    {
      isValid: true,
      expiresAt: issuedAt + 30_000,
    },
  );

  assert.deepEqual(
    readAdminSessionToken(`${token}broken`, {
      sessionSecret: secret,
      now: issuedAt,
    }),
    {
      isValid: false,
      expiresAt: null,
    },
  );

  assert.deepEqual(
    readAdminSessionToken(token, {
      sessionSecret: secret,
      now: issuedAt + 30_001,
    }),
    {
      isValid: false,
      expiresAt: issuedAt + 30_000,
    },
  );
});

test("admin permission routes and pages are wired into the app surface", () => {
  const root = process.cwd();
  const requiredFiles = [
    join(root, "src/app/admin/page.tsx"),
    join(root, "src/app/admin/api/session/route.ts"),
    join(root, "src/lib/admin-auth.ts"),
  ];

  for (const filePath of requiredFiles) {
    assert.equal(existsSync(filePath), true, `expected ${filePath} to exist`);
  }

  const editorPage = readFileSync(join(root, "src/app/editor/page.tsx"), "utf8");
  const editorRoute = readFileSync(join(root, "src/app/editor/api/posts/route.ts"), "utf8");
  const archiveClient = readFileSync(join(root, "src/app/archive/archive-client.tsx"), "utf8");
  const projectsPage = readFileSync(join(root, "src/app/projects/page.tsx"), "utf8");
  const resourcesClient = readFileSync(join(root, "src/app/resources/resources-client.tsx"), "utf8");
  const postDetailPage = readFileSync(join(root, "src/app/posts/[slug]/page.tsx"), "utf8");
  const projectDetailPage = readFileSync(join(root, "src/app/projects/[slug]/page.tsx"), "utf8");
  const resourceDetailPage = readFileSync(join(root, "src/app/resources/[slug]/page.tsx"), "utf8");

  assert.match(editorPage, /\/admin\?next=/);
  assert.match(editorRoute, /status:\s*403/);
  assert.doesNotMatch(archiveClient, /process\.env\.NODE_ENV === "development"/);
  assert.doesNotMatch(projectsPage, /process\.env\.NODE_ENV === "development"/);
  assert.doesNotMatch(resourcesClient, /process\.env\.NODE_ENV === "development"/);
  assert.doesNotMatch(postDetailPage, /process\.env\.NODE_ENV === "development"/);
  assert.doesNotMatch(projectDetailPage, /process\.env\.NODE_ENV === "development"/);
  assert.doesNotMatch(resourceDetailPage, /process\.env\.NODE_ENV === "development"/);
  assert.match(archiveClient, /canManage/);
  assert.match(resourcesClient, /canManage/);
  // 列表/详情页的管理员入口已移入 Suspense 动态洞，洞内直接用 isAdminRequest 判定权限。
  assert.match(projectsPage, /isAdminRequest/);
  assert.match(postDetailPage, /isAdminRequest/);
  assert.match(projectDetailPage, /isAdminRequest/);
  assert.match(resourceDetailPage, /isAdminRequest/);
});

test("admin client performs full document navigation after session changes", () => {
  const adminClient = readFileSync(join(process.cwd(), "src/app/admin/admin-client.tsx"), "utf8");

  assert.match(adminClient, /window\.location\.assign\(result\.redirectHref\)/);
  assert.match(adminClient, /credentials:\s*"same-origin"/);
  assert.doesNotMatch(adminClient, /router\.push\(result\.redirectHref\);\s*router\.refresh\(\);/);
});

test("admin session route writes session cookies directly on the response", () => {
  const route = readFileSync(join(process.cwd(), "src/app/admin/api/session/route.ts"), "utf8");

  assert.match(route, /createAdminSessionCookie/);
  assert.match(route, /response\.cookies\.set/);
  assert.match(route, /headers:\s*\{\s*"Cache-Control":\s*"no-store"/);
});
