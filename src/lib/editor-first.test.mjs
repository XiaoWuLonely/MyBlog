import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path, { join } from "node:path";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import { updateEditorContentFile, createEditorWritePayload } from "./content.ts";

test("updateEditorContentFile overwrites legacy files resolved by frontmatter slug", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "myblog-editor-first-legacy-"));
  const postsDir = path.join(rootDir, "posts");
  await mkdir(postsDir, { recursive: true });

  const legacyFilePath = path.join(postsDir, "legacy-file-name.mdx");
  await writeFile(
    legacyFilePath,
    `---
title: "Legacy Note"
slug: "legacy-note"
summary: "Initial summary"
date: "2026-04-09"
category: "Design Notes"
tags:
  - Notes
featured: false
assetNames: []
---

# Legacy Note

Old body.
`,
    "utf8",
  );

  const result = await updateEditorContentFile({
    rootDir,
    payload: createEditorWritePayload({
      title: "Legacy Note Updated",
      slug: "legacy-note",
      summary: "Updated summary",
      content: "# Legacy Note Updated\n\nFresh body.",
      category: "archive",
      tags: ["Notes", "Update"],
      scheduleAt: null,
      featured: true,
      projectMeta: {
        href: "",
        github: "",
        docs: "",
        year: "",
        stack: [],
        icon: "grid",
        accent: "primary",
      },
      resourceMeta: {
        url: "",
        rating: 4,
        monogram: "",
        accent: "primary",
        topic: "",
      },
      archiveMeta: {
        topic: "Design Notes",
      },
      cover: null,
      assets: [],
      source: {
        originalCategory: "archive",
        originalSlug: "legacy-note",
      },
    }),
    now: () => "2026-04-18T12:00:00.000Z",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(existsSync(path.join(postsDir, "legacy-note.mdx")), false);
  const persisted = await readFile(legacyFilePath, "utf8");
  assert.match(persisted, /title: Legacy Note Updated/);
  assert.match(persisted, /Fresh body\./);
});

test("editor route exposes delete support and list-page redirects", () => {
  const routeSource = readFileSync(join(process.cwd(), "src/app/editor/api/posts/route.ts"), "utf8");
  const contentSource = readFileSync(join(process.cwd(), "src/lib/content.ts"), "utf8");

  assert.match(routeSource, /export async function DELETE/);
  assert.match(routeSource, /deleteEditorContentFile/);
  assert.match(routeSource, /redirectHref/);
  assert.match(contentSource, /redirectHref/);
  assert.match(contentSource, /"\/archive"/);
  assert.match(contentSource, /"\/projects"/);
  assert.match(contentSource, /"\/resources"/);
});

test("delete success flows refresh after client-side redirects", () => {
  const editorClientSource = readFileSync(join(process.cwd(), "src/app/editor/editor-client.tsx"), "utf8");
  const deleteButtonSource = readFileSync(join(process.cwd(), "src/components/site/admin-delete-button.tsx"), "utf8");

  assert.match(editorClientSource, /window\.location\.assign\(result\.redirectHref\);/);
  assert.match(deleteButtonSource, /window\.location\.assign\(redirectHref\);/);
});

test("content management entry points rely on admin permission state instead of development mode", () => {
  // 客户端组件通过 canManage prop 接收权限状态；
  // 服务端页面则在 Suspense 动态洞内直接调用 isAdminRequest。
  const clientFiles = [
    join(process.cwd(), "src/app/archive/archive-client.tsx"),
    join(process.cwd(), "src/app/resources/resources-client.tsx"),
  ];
  const pageFiles = [
    join(process.cwd(), "src/app/projects/page.tsx"),
    join(process.cwd(), "src/app/posts/[slug]/page.tsx"),
    join(process.cwd(), "src/app/projects/[slug]/page.tsx"),
    join(process.cwd(), "src/app/resources/[slug]/page.tsx"),
  ];

  for (const filePath of [...clientFiles, ...pageFiles]) {
    const source = readFileSync(filePath, "utf8");
    assert.match(source, /buildEditorLoadHref/);
    assert.doesNotMatch(source, /process\.env\.NODE_ENV === "development"/);
  }

  for (const filePath of clientFiles) {
    assert.match(readFileSync(filePath, "utf8"), /canManage/);
  }

  for (const filePath of pageFiles) {
    assert.match(readFileSync(filePath, "utf8"), /isAdminRequest/);
  }
});

test("projects list keeps public Website, GitHub, and Docs CTAs only on detail pages", () => {
  const projectsListSource = readFileSync(join(process.cwd(), "src/app/projects/page.tsx"), "utf8");
  const projectDetailSource = readFileSync(join(process.cwd(), "src/app/projects/[slug]/page.tsx"), "utf8");

  assert.doesNotMatch(projectsListSource, /\bWebsite\b/);
  assert.doesNotMatch(projectsListSource, /\bGitHub\b/);
  assert.doesNotMatch(projectsListSource, /\bDocs\b/);
  assert.match(projectDetailSource, /\bWebsite\b/);
  assert.match(projectDetailSource, /\bGitHub\b/);
  assert.match(projectDetailSource, /\bDocs\b/);
});

test("explicit demo fixtures have been removed from the public content directories", () => {
  assert.equal(existsSync(path.join(process.cwd(), "src", "content", "posts", "1.mdx")), false);
  assert.equal(existsSync(path.join(process.cwd(), "src", "content", "posts", "测试归档.mdx")), false);
  assert.equal(existsSync(path.join(process.cwd(), "src", "content", "projects", "https-github-com.mdx")), false);
  assert.equal(existsSync(path.join(process.cwd(), "src", "content", "projects", "测试项目.mdx")), false);
  assert.equal(existsSync(path.join(process.cwd(), "src", "content", "resources", "测试资源.mdx")), false);
  assert.equal(existsSync(path.join(process.cwd(), "src", "content", "resources", "测试资源111.mdx")), false);
});

test("kept projects no longer expose placeholder website, github, or docs links", () => {
  const projectFiles = [
    join(process.cwd(), "src/content/projects/aether-ui.mdx"),
    join(process.cwd(), "src/content/projects/calm-editor.mdx"),
    join(process.cwd(), "src/content/projects/nebula-core.mdx"),
    join(process.cwd(), "src/content/projects/studio-notes.mdx"),
  ];

  for (const filePath of projectFiles) {
    const source = readFileSync(filePath, "utf8");
    assert.doesNotMatch(source, /^href:/m);
    assert.doesNotMatch(source, /^github:/m);
    assert.doesNotMatch(source, /^docs:/m);
  }
});
