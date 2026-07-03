import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteD1Content,
  deleteD1Message,
  getD1ContentBySlug,
  getD1EditorDraftBySource,
  listD1Content,
  listD1Messages,
  markD1MessageAsRead,
  saveD1Content,
  saveD1Message,
} from "./cloudflare-content-store.ts";
import {
  readContentBySlugWithD1Fallback,
  readContentCollectionWithD1Fallback,
} from "./content.ts";
import { validateCloudflareAssetUploads } from "./cloudflare-content-store.ts";

function createFakeD1() {
  const contentRows = [];
  const messageRows = [];
  const queryLog = [];

  function bindValue(row, key) {
    return row[key.startsWith("@") ? key.slice(1) : key];
  }

  return {
    contentRows,
    messageRows,
    queryLog,
    prepare(sql) {
      let values = [];

      return {
        bind(...nextValues) {
          values = nextValues;
          return this;
        },
        async all() {
          queryLog.push(sql);

          if (sql.includes("SELECT slug, deleted_at") && sql.includes("FROM content_items")) {
            let rows = contentRows;

            if (sql.includes("collection = ?1")) {
              rows = rows.filter((row) => row.collection === values[0]);
            }

            return { results: rows.map((row) => ({ slug: row.slug, deleted_at: row.deleted_at })) };
          }

          if (sql.includes("SELECT COUNT(*) AS count") && sql.includes("FROM content_items")) {
            const collection = values[0];
            const slug = values[1];
            const count = contentRows.filter((row) => row.collection === collection && row.slug === slug).length;
            return { results: [{ count }] };
          }

          if (sql.includes("SELECT slug") && sql.includes("FROM content_items")) {
            let rows = contentRows;

            if (sql.includes("collection = ?1")) {
              rows = rows.filter((row) => row.collection === values[0]);
            }

            return { results: rows.map((row) => ({ slug: row.slug, deleted_at: row.deleted_at })) };
          }

          if (sql.includes("deleted_at") && sql.includes("frontmatter_json") && !sql.includes("deleted_at IS NULL") && sql.includes("FROM content_items")) {
            let rows = contentRows;

            if (sql.includes("collection = ?1")) {
              rows = rows.filter((row) => row.collection === values[0]);
            }

            rows = [...rows].sort((a, b) => {
              if (a.published_at === b.published_at) {
                return b.updated_at.localeCompare(a.updated_at);
              }
              return b.published_at.localeCompare(a.published_at);
            });

            return { results: rows };
          }

          if (sql.includes("FROM content_items")) {
            let rows = contentRows.filter((row) => !row.deleted_at);

            if (sql.includes("collection = ?1")) {
              rows = rows.filter((row) => row.collection === values[0]);
            }

            rows = [...rows].sort((a, b) => {
              if (a.published_at === b.published_at) {
                return b.updated_at.localeCompare(a.updated_at);
              }
              return b.published_at.localeCompare(a.published_at);
            });

            return { results: rows };
          }

          if (sql.includes("FROM messages")) {
            const rows = [...messageRows].sort((a, b) => b.created_at.localeCompare(a.created_at));
            return { results: rows };
          }

          return { results: [] };
        },
        async first() {
          queryLog.push(sql);

          if (sql.includes("SELECT deleted_at") && sql.includes("FROM content_items")) {
            const collection = values[0];
            const slug = values[1];
            const row = contentRows.find((item) => item.collection === collection && item.slug === slug);
            return row ? { deleted_at: row.deleted_at } : null;
          }

          if (sql.includes("SELECT slug") && sql.includes("FROM content_items")) {
            const collection = values[0];
            const row = contentRows.find((item) => item.collection === collection);
            return row ? { slug: row.slug } : null;
          }

          if (sql.includes("FROM content_items")) {
            const collection = values[0];
            const slug = values[1];
            return (
              contentRows.find(
                (row) =>
                  row.collection === collection &&
                  !row.deleted_at &&
                  (row.slug === slug || bindValue(row, "frontmatter").slug === slug),
              ) ?? null
            );
          }

          if (sql.includes("FROM messages")) {
            return messageRows.find((row) => row.id === values[0]) ?? null;
          }

          return null;
        },
        async run() {
          queryLog.push(sql);

          if (sql.includes("INSERT INTO content_items")) {
            const row = {
              collection: values[0],
              slug: values[1],
              title: values[2],
              summary: values[3],
              category: values[4],
              tags_json: values[5],
              frontmatter_json: values[6],
              body: values[7],
              source: values[8],
              published_at: values[9],
              updated_at: values[10],
              deleted_at: null,
            };
            row.frontmatter = JSON.parse(row.frontmatter_json);
            const index = contentRows.findIndex(
              (item) => item.collection === row.collection && item.slug === row.slug,
            );
            if (index >= 0) {
              contentRows[index] = row;
            } else {
              contentRows.push(row);
            }
          }

          if (sql.includes("UPDATE content_items")) {
            const collection = values[1];
            const slug = values[2];
            const row = contentRows.find((item) => item.collection === collection && item.slug === slug);
            if (row) {
              row.deleted_at = values[0];
            }
          }

          if (sql.includes("INSERT INTO content_items") && sql.includes("deleted_at")) {
            const row = {
              collection: values[0],
              slug: values[1],
              title: values[2],
              summary: values[3],
              category: values[4],
              tags_json: values[5],
              frontmatter_json: values[6],
              body: values[7],
              source: values[8],
              published_at: values[9],
              updated_at: values[10],
              deleted_at: values[11],
            };
            row.frontmatter = JSON.parse(row.frontmatter_json);
            const index = contentRows.findIndex(
              (item) => item.collection === row.collection && item.slug === row.slug,
            );
            if (index >= 0) {
              contentRows[index] = row;
            } else {
              contentRows.push(row);
            }
          }

          if (sql.includes("INSERT INTO messages")) {
            const row = {
              id: values[0],
              name: values[1],
              email: values[2],
              body: values[3],
              created_at: values[4],
              read_at: values[5],
            };
            const index = messageRows.findIndex((item) => item.id === row.id);
            if (index >= 0) {
              messageRows[index] = row;
            } else {
              messageRows.push(row);
            }
          }

          if (sql.includes("UPDATE messages")) {
            const row = messageRows.find((item) => item.id === values[1]);
            if (row && !row.read_at) {
              row.read_at = values[0];
            }
          }

          if (sql.includes("DELETE FROM messages")) {
            const index = messageRows.findIndex((item) => item.id === values[0]);
            if (index >= 0) {
              messageRows.splice(index, 1);
            }
          }

          return { success: true };
        },
      };
    },
  };
}

function createDraft(overrides = {}) {
  return {
    title: "D1 Note",
    slug: "d1-note",
    summary: "Stored in D1",
    content: "# D1 Note\n\nBody",
    category: "archive",
    tags: ["D1", "Cloudflare"],
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
      topic: "Cloudflare",
    },
    cover: null,
    assets: [],
    ...overrides,
  };
}

test("D1 content store upserts content, lists newest first, and resolves by slug", async () => {
  const db = createFakeD1();

  await saveD1Content({
    db,
    payload: createDraft({
      title: "Older Note",
      slug: "older-note",
      content: "# Older Note",
    }),
    now: () => "2026-04-20T10:00:00.000Z",
  });

  const saved = await saveD1Content({
    db,
    payload: createDraft(),
    now: () => "2026-04-21T10:00:00.000Z",
  });

  assert.equal(saved.ok, true);
  assert.equal(saved.slug, "d1-note");
  assert.equal(saved.deploymentPending, false);
  assert.equal(saved.outputPath, "d1://posts/d1-note");
  assert.equal(saved.draft.archiveMeta.topic, "Cloudflare");

  const items = await listD1Content(db, "archive");
  assert.deepEqual(
    items.map((item) => item.meta.slug),
    ["d1-note", "older-note"],
  );
  assert.equal(items[0].meta.category, "Cloudflare");
  assert.match(items[0].content, /Body/);

  const detail = await getD1ContentBySlug(db, "archive", "d1-note");
  assert.equal(detail?.meta.title, "D1 Note");
  assert.match(detail?.content ?? "", /# D1 Note/);
});

test("D1 content store reloads editor drafts and soft deletes content", async () => {
  const db = createFakeD1();

  await saveD1Content({
    db,
    payload: createDraft(),
    now: () => "2026-04-21T10:00:00.000Z",
  });

  const loaded = await getD1EditorDraftBySource(db, {
    originalCategory: "archive",
    originalSlug: "d1-note",
  });

  assert.equal(loaded?.draft.title, "D1 Note");
  assert.deepEqual(loaded?.source, {
    originalCategory: "archive",
    originalSlug: "d1-note",
  });

  const deleted = await deleteD1Content({
    db,
    source: {
      originalCategory: "archive",
      originalSlug: "d1-note",
    },
    now: () => "2026-04-22T10:00:00.000Z",
  });

  assert.equal(deleted.ok, true);
  assert.equal(await getD1ContentBySlug(db, "archive", "d1-note"), null);
  assert.deepEqual(await listD1Content(db, "archive"), []);
});

test("D1 message store creates, lists, marks read, and deletes messages", async () => {
  const db = createFakeD1();

  const older = await saveD1Message({
    db,
    input: {
      name: "Older",
      email: "older@example.com",
      body: "First",
    },
    now: () => "2026-04-20T10:00:00.000Z",
    createId: () => "msg-older",
  });
  const newer = await saveD1Message({
    db,
    input: {
      name: "Newer",
      email: "newer@example.com",
      body: "Second",
    },
    now: () => "2026-04-21T10:00:00.000Z",
    createId: () => "msg-newer",
  });

  assert.equal(older.status, "unread");
  assert.equal(newer.status, "unread");

  const items = await listD1Messages(db);
  assert.deepEqual(
    items.map((item) => item.id),
    ["msg-newer", "msg-older"],
  );

  const read = await markD1MessageAsRead({
    db,
    id: "msg-older",
    now: () => "2026-04-22T10:00:00.000Z",
  });
  assert.equal(read?.status, "read");
  assert.equal(read?.readAt, "2026-04-22T10:00:00.000Z");

  assert.equal(await deleteD1Message(db, "msg-older"), true);
  assert.equal(await deleteD1Message(db, "missing"), false);
  assert.deepEqual(
    (await listD1Messages(db)).map((item) => item.id),
    ["msg-newer"],
  );
});

test("content readers prefer D1 when rows exist and fall back when D1 is empty", async () => {
  const db = createFakeD1();

  const emptyItems = await readContentCollectionWithD1Fallback({
    db,
    category: "archive",
    fallback: async () => [
      {
        meta: {
          title: "Fallback Note",
          slug: "fallback-note",
          summary: "Bundled content",
          date: "2026-04-19",
          category: "Fallback",
          tags: [],
          featured: false,
          assetNames: [],
        },
        content: "# Fallback Note",
        filePath: "fallback.mdx",
      },
    ],
  });

  assert.equal(emptyItems[0].meta.slug, "fallback-note");

  await saveD1Content({
    db,
    payload: createDraft(),
    now: () => "2026-04-21T10:00:00.000Z",
  });

  const d1Items = await readContentCollectionWithD1Fallback({
    db,
    category: "archive",
    fallback: async () => [],
  });

  assert.equal(d1Items[0].meta.slug, "d1-note");

  const detail = await readContentBySlugWithD1Fallback({
    db,
    category: "archive",
    slug: "d1-note",
    fallback: async () => {
      throw new Error("fallback should not be used for existing D1 detail");
    },
  });

  assert.equal(detail?.meta.slug, "d1-note");

  const fallbackDetail = await readContentBySlugWithD1Fallback({
    db,
    category: "archive",
    slug: "missing-note",
    fallback: async () => ({
      meta: {
        title: "Fallback Detail",
        slug: "missing-note",
        summary: "Bundled detail",
        date: "2026-04-19",
        category: "Fallback",
        tags: [],
        featured: false,
        assetNames: [],
      },
      content: "# Fallback Detail",
      filePath: "missing-note.mdx",
    }),
  });

  assert.equal(fallbackDetail?.meta.title, "Fallback Detail");
});

test("D1 is the source of truth when content exists, skipping static fallback", async () => {
  const db = createFakeD1();

  await saveD1Content({
    db,
    payload: createDraft({
      title: "Updated Bundled Note",
      slug: "bundled-note",
      content: "# Updated Bundled Note",
    }),
    now: () => "2026-04-21T10:00:00.000Z",
  });
  await deleteD1Content({
    db,
    source: {
      originalCategory: "archive",
      originalSlug: "deleted-bundled-note",
    },
    now: () => "2026-04-22T10:00:00.000Z",
  });

  let fallbackCalled = false;

  const items = await readContentCollectionWithD1Fallback({
    db,
    category: "archive",
    fallback: async () => {
      fallbackCalled = true;
      return [
        {
          meta: {
            title: "Bundled Note",
            slug: "bundled-note",
            summary: "Original bundled content",
            date: "2026-04-19",
            category: "Fallback",
            tags: [],
            featured: false,
            assetNames: [],
          },
          content: "# Bundled Note",
          filePath: "bundled-note.mdx",
        },
      ];
    },
  });

  assert.equal(fallbackCalled, false);
  assert.deepEqual(
    items.map((item) => item.meta.slug),
    ["bundled-note"],
  );
  assert.equal(items[0].meta.title, "Updated Bundled Note");
});

test("collection readers fetch D1 row state once while merging fallback content", async () => {
  const db = createFakeD1();

  await saveD1Content({
    db,
    payload: createDraft({
      title: "Updated Bundled Note",
      slug: "bundled-note",
      content: "# Updated Bundled Note",
    }),
    now: () => "2026-04-21T10:00:00.000Z",
  });

  db.queryLog.length = 0;

  await readContentCollectionWithD1Fallback({
    db,
    category: "archive",
    fallback: async () => [
      {
        meta: {
          title: "Bundled Note",
          slug: "bundled-note",
          summary: "Original bundled content",
          date: "2026-04-19",
          category: "Fallback",
          tags: [],
          featured: false,
          assetNames: [],
        },
        content: "# Bundled Note",
        filePath: "bundled-note.mdx",
      },
      {
        meta: {
          title: "Untouched Bundled Note",
          slug: "untouched-bundled-note",
          summary: "Still visible",
          date: "2026-04-18",
          category: "Fallback",
          tags: [],
          featured: false,
          assetNames: [],
        },
        content: "# Untouched Bundled Note",
        filePath: "untouched-bundled-note.mdx",
      },
    ],
  });

  const contentQueries = db.queryLog.filter((sql) => sql.includes("FROM content_items"));

  assert.equal(contentQueries.length, 1);
  assert.equal(
    contentQueries.some((sql) => sql.includes("frontmatter_json")),
    true,
  );
});

test("content readers do not fall back to bundled content after a D1 delete tombstone", async () => {
  const db = createFakeD1();

  await saveD1Content({
    db,
    payload: createDraft(),
    now: () => "2026-04-21T10:00:00.000Z",
  });
  await deleteD1Content({
    db,
    source: {
      originalCategory: "archive",
      originalSlug: "d1-note",
    },
    now: () => "2026-04-22T10:00:00.000Z",
  });

  const detail = await readContentBySlugWithD1Fallback({
    db,
    category: "archive",
    slug: "d1-note",
    fallback: async () => ({
      meta: {
        title: "Bundled D1 Note",
        slug: "d1-note",
        summary: "This should stay hidden after D1 delete.",
        date: "2026-04-19",
        category: "Fallback",
        tags: [],
        featured: false,
        assetNames: [],
      },
      content: "# Bundled D1 Note",
      filePath: "d1-note.mdx",
    }),
  });

  assert.equal(detail, null);

  const items = await readContentCollectionWithD1Fallback({
    db,
    category: "archive",
    fallback: async () => [
      {
        meta: {
          title: "Bundled D1 Note",
          slug: "d1-note",
          summary: "This should stay hidden after D1 delete.",
          date: "2026-04-19",
          category: "Fallback",
          tags: [],
          featured: false,
          assetNames: [],
        },
        content: "# Bundled D1 Note",
        filePath: "d1-note.mdx",
      },
    ],
  });

  assert.deepEqual(items, []);
});

test("D1 delete creates a tombstone when bundled fallback content was never imported", async () => {
  const db = createFakeD1();

  const deleted = await deleteD1Content({
    db,
    source: {
      originalCategory: "archive",
      originalSlug: "bundled-only-note",
    },
    now: () => "2026-04-22T10:00:00.000Z",
  });

  assert.equal(deleted.ok, true);
  assert.equal(deleted.createdTombstone, true);

  const detail = await readContentBySlugWithD1Fallback({
    db,
    category: "archive",
    slug: "bundled-only-note",
    fallback: async () => ({
      meta: {
        title: "Bundled Only Note",
        slug: "bundled-only-note",
        summary: "This should stay hidden after a D1 tombstone.",
        date: "2026-04-19",
        category: "Fallback",
        tags: [],
        featured: false,
        assetNames: [],
      },
      content: "# Bundled Only Note",
      filePath: "bundled-only-note.mdx",
    }),
  });

  assert.equal(detail, null);
});

test("Cloudflare publishing rejects new uploaded assets", () => {
  const withoutUploads = validateCloudflareAssetUploads({
    coverUpload: null,
    assetUploads: [],
  });
  assert.equal(withoutUploads.ok, true);

  const withUploads = validateCloudflareAssetUploads({
    coverUpload: {
      name: "cover.png",
      type: "image/png",
      size: 4,
      buffer: new Uint8Array([1, 2, 3, 4]),
    },
    assetUploads: [],
  });

  assert.deepEqual(withUploads, {
    ok: false,
    message: "Cloudflare file uploads are not configured. Publish without new files.",
  });
});
