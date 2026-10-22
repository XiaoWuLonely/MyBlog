import assert from "node:assert/strict";
import test from "node:test";
import tsconfig from "../../tsconfig.json" with { type: "json" };
import {
  CONTENT_CATEGORY_DIRECTORY,
  buildContentFileSource,
  buildEditorWriteResult,
  createBaseContentFrontmatter,
  createContentFileBody,
  createEditorWritePayload,
  createPersistedEditorDraft,
  getContentDirectoryForCategory,
  resolvePublishDate,
} from "./content.ts";

test("getContentDirectoryForCategory resolves editor categories to content folders", () => {
  assert.equal(getContentDirectoryForCategory("archive"), "posts");
  assert.equal(getContentDirectoryForCategory("resource"), "resources");
  assert.equal(getContentDirectoryForCategory("project"), "projects");
});

test("createBaseContentFrontmatter maps editor draft into persisted metadata", () => {
  const frontmatter = createBaseContentFrontmatter(
    createEditorWritePayload({
      title: "Sunset Archive",
      slug: "sunset-archive",
      summary: "Quiet note",
      content: "# Hello",
      category: "archive",
      tags: ["quiet", "writing"],
      scheduleAt: "2026-04-10T08:30",
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
      },
      archiveMeta: {},
      cover: {
        name: "cover.webp",
        type: "image/webp",
        size: 1024,
        previewUrl: "blob:cover",
      },
      assets: [
        {
          id: "file-1",
          name: "diagram.png",
          type: "image/png",
          size: 2048,
          previewUrl: "blob:diagram",
        },
      ],
    }),
  );

  assert.deepEqual(frontmatter, {
    title: "Sunset Archive",
    slug: "sunset-archive",
    summary: "Quiet note",
    description: "Quiet note",
    date: "2026-04-10",
    category: "归档",
    tags: ["quiet", "writing"],
    cover: "cover.webp",
    featured: false,
    assetNames: ["diagram.png"],
    assetPaths: [],
  });
});

test("createBaseContentFrontmatter adds resource defaults needed by public resource pages", () => {
  const frontmatter = createBaseContentFrontmatter(
    createEditorWritePayload({
      title: "Resource Draft",
      slug: "resource-draft",
      summary: "Useful link",
      content: "# Resource Draft",
      category: "resource",
      tags: ["Reference", "UI"],
      scheduleAt: null,
      projectMeta: {
        href: "",
        github: "",
        docs: "",
        year: "",
        stack: [],
        icon: "grid",
        accent: "secondary",
      },
      resourceMeta: {
        url: "https://example.com/resource-draft",
        rating: 5,
        monogram: "RS",
        accent: "secondary",
      },
      archiveMeta: {},
      cover: null,
      assets: [],
    }),
    () => "2026-04-09T12:00:00.000Z",
  );

  assert.deepEqual(frontmatter, {
    title: "Resource Draft",
    slug: "resource-draft",
    summary: "Useful link",
    description: "Useful link",
    date: "2026-04-09",
    category: "资源",
    tags: ["Reference", "UI"],
    cover: undefined,
    featured: false,
    assetNames: [],
    assetPaths: [],
    url: "https://example.com/resource-draft",
    rating: 5,
    accent: "secondary",
    monogram: "RS",
  });
});

test("createBaseContentFrontmatter adds project defaults needed by public project pages", () => {
  const frontmatter = createBaseContentFrontmatter(
    createEditorWritePayload({
      title: "Project Draft",
      slug: "project-draft",
      summary: "Build notes",
      content: "# Project Draft",
      category: "project",
      tags: ["Next.js", "MDX"],
      scheduleAt: null,
      projectMeta: {
        href: "https://example.com/project-draft",
        github: "https://github.com/example/project-draft",
        docs: "https://example.com/project-draft/docs",
        year: "2025",
        stack: ["React", "MDX"],
        icon: "spark",
        accent: "tertiary",
      },
      resourceMeta: {
        url: "",
        rating: 4,
        monogram: "",
        accent: "primary",
      },
      archiveMeta: {},
      cover: null,
      assets: [],
    }),
    () => "2026-04-09T12:00:00.000Z",
  );

  assert.deepEqual(frontmatter, {
    title: "Project Draft",
    slug: "project-draft",
    summary: "Build notes",
    description: "Build notes",
    date: "2026-04-09",
    category: "项目",
    tags: ["Next.js", "MDX"],
    cover: undefined,
    featured: false,
    assetNames: [],
    assetPaths: [],
    year: "2025",
    stack: ["React", "MDX"],
    href: "https://example.com/project-draft",
    github: "https://github.com/example/project-draft",
    docs: "https://example.com/project-draft/docs",
    icon: "spark",
    accent: "tertiary",
  });
});

test("createContentFileBody builds frontmatter plus markdown body", () => {
  const source = createContentFileBody({
    frontmatter: {
      title: "Demo",
      slug: "demo",
      summary: "Summary",
      date: "2026-04-09",
      category: "资源",
      tags: ["demo"],
      cover: undefined,
      featured: false,
      assetNames: [],
    },
    content: "# Demo\n\nBody",
  });

  assert.match(source, /^---\n/);
  assert.match(source, /title: Demo/);
  assert.match(source, /\n# Demo\n\nBody\n$/);
});

test("buildEditorWriteResult returns path metadata and persisted compose payload", () => {
  const payload = createEditorWritePayload({
    title: "New Resource",
    slug: "new-resource",
    summary: "Summary",
    content: "# New Resource",
    category: "resource",
    tags: ["Reference"],
    scheduleAt: null,
    projectMeta: {
      href: "",
      github: "",
      docs: "",
      year: "",
      stack: [],
      icon: "grid",
      accent: "secondary",
    },
    resourceMeta: {
      url: "https://example.com/resource",
      rating: 5,
      monogram: "NR",
      accent: "secondary",
    },
    archiveMeta: {},
    cover: null,
    assets: [],
  });

  const result = buildEditorWriteResult({
    payload,
    outputPath: "src/content/resources/new-resource.mdx",
    now: () => "2026-04-14T09:00:00.000Z",
  });

  assert.deepEqual(result, {
    ok: true,
    message: "内容已写入资源。",
    slug: "new-resource",
    category: "resource",
    outputPath: "src/content/resources/new-resource.mdx",
    draft: {
      ...payload,
      resourceMeta: {
        ...payload.resourceMeta,
        topic: "资源",
      },
      archiveMeta: {
        topic: "",
      },
      scheduleAt: "2026-04-14T00:00",
    },
    source: {
      originalCategory: "resource",
      originalSlug: "new-resource",
    },
  });
});

test("createPersistedEditorDraft maps persisted file metadata back to compose state", () => {
  const result = createPersistedEditorDraft({
    category: "project",
    slug: "studio-notes",
    frontmatter: {
      title: "Studio Notes",
      slug: "studio-notes",
      summary: "Build log",
      description: "Build log",
      date: "2026-04-12",
      category: "项目",
      tags: ["Motion", "UI"],
      cover: "/uploads/projects/studio-notes/cover.webp",
      featured: false,
      assetNames: ["diagram.pdf"],
      assetPaths: ["/uploads/projects/studio-notes/assets/diagram.pdf"],
      year: "2026",
      stack: ["Motion", "UI"],
      icon: "grid",
      accent: "primary",
    },
    content: "# Studio Notes\n\nDetailed body.\n",
  });

  assert.deepEqual(result, {
    draft: {
      title: "Studio Notes",
      slug: "studio-notes",
      summary: "Build log",
      content: "# Studio Notes\n\nDetailed body.\n",
      category: "project",
      tags: ["Motion", "UI"],
      scheduleAt: "2026-04-12T00:00",
      featured: false,
      projectMeta: {
        href: "",
        github: "",
        docs: "",
        year: "2026",
        stack: ["Motion", "UI"],
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
        topic: "",
      },
      cover: {
        name: "cover.webp",
        type: "",
        size: 0,
        previewUrl: "/uploads/projects/studio-notes/cover.webp",
        persistedPath: "/uploads/projects/studio-notes/cover.webp",
      },
      assets: [
        {
          id: "diagram-pdf-0-file",
          name: "diagram.pdf",
          type: "",
          size: 0,
          previewUrl: "/uploads/projects/studio-notes/assets/diagram.pdf",
          persistedPath: "/uploads/projects/studio-notes/assets/diagram.pdf",
        },
      ],
    },
    source: {
      originalCategory: "project",
      originalSlug: "studio-notes",
    },
  });
});

test("createPersistedEditorDraft restores project and resource meta fields from persisted frontmatter", () => {
  const projectResult = createPersistedEditorDraft({
    category: "project",
    slug: "aether-ui",
    frontmatter: {
      title: "Aether UI",
      slug: "aether-ui",
      summary: "Design system",
      description: "Design system",
      date: "2026-04-12",
      category: "项目",
      tags: ["React"],
      cover: undefined,
      featured: false,
      assetNames: [],
      assetPaths: [],
      year: "2025",
      stack: ["React", "Motion"],
      href: "https://example.com/aether-ui",
      github: "https://github.com/example/aether-ui",
      docs: "https://example.com/aether-ui/docs",
      icon: "spark",
      accent: "tertiary",
    },
    content: "# Aether UI",
  });

  assert.deepEqual(projectResult.draft.projectMeta, {
    href: "https://example.com/aether-ui",
    github: "https://github.com/example/aether-ui",
    docs: "https://example.com/aether-ui/docs",
    year: "2025",
    stack: ["React", "Motion"],
    icon: "spark",
    accent: "tertiary",
  });
});

test("buildContentFileSource produces a serializable write payload", () => {
  const payload = createEditorWritePayload({
    title: "Project Log",
    slug: "project-log",
    summary: "Progress notes",
    content: "# Project Log\n\nUpdate",
    category: "project",
    tags: ["devlog"],
      scheduleAt: null,
      projectMeta: {
      href: "https://example.com/project-log",
      github: "https://github.com/example/project-log",
      docs: "https://example.com/project-log/docs",
      year: "2026",
      stack: ["Devlog"],
      icon: "spark",
      accent: "secondary",
    },
    resourceMeta: {
      url: "",
      rating: 4,
      monogram: "",
      accent: "primary",
    },
    archiveMeta: {},
    cover: null,
    assets: [],
  });

  const source = buildContentFileSource(payload);

  assert.match(source, /category: 项目/);
  assert.doesNotMatch(source, /^draft:/m);
  assert.doesNotMatch(source, /^hidden:/m);
  assert.match(source, /# Project Log/);
});

test("resolvePublishDate falls back to today when schedule is absent", () => {
  assert.equal(resolvePublishDate(null, () => "2026-04-09T12:00:00.000Z"), "2026-04-09");
  assert.equal(resolvePublishDate("2026-04-11T09:30", () => "2026-04-09T12:00:00.000Z"), "2026-04-11");
});

test("content category directory map is stable", () => {
  assert.deepEqual(CONTENT_CATEGORY_DIRECTORY, {
    archive: "posts",
    project: "projects",
    resource: "resources",
  });
});

test("tsconfig keeps the generated Next type directories included", () => {
  assert.equal(tsconfig.include.includes(".next/types/**/*.ts"), true);
  assert.equal(tsconfig.include.includes(".next/dev/types/**/*.ts"), true);
});

test("createBaseContentFrontmatter preserves archive and resource topic categories and featured state", () => {
  const archiveFrontmatter = createBaseContentFrontmatter(
    createEditorWritePayload({
      title: "Archive Draft",
      slug: "archive-draft",
      summary: "Quiet note",
      content: "# Archive Draft",
      category: "archive",
      tags: ["Notes"],
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
    }),
  );

  assert.equal(archiveFrontmatter.category, "Design Notes");
  assert.equal(archiveFrontmatter.featured, true);

  const resourceFrontmatter = createBaseContentFrontmatter(
    createEditorWritePayload({
      title: "Resource Draft",
      slug: "resource-draft",
      summary: "Useful link",
      content: "# Resource Draft",
      category: "resource",
      tags: ["Reference"],
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
        url: "https://example.com/resource-draft",
        rating: 5,
        monogram: "RD",
        accent: "secondary",
        topic: "Animation",
      },
      archiveMeta: {
        topic: "",
      },
      cover: null,
      assets: [],
    }),
  );

  assert.equal(resourceFrontmatter.category, "Animation");
  assert.equal(resourceFrontmatter.featured, true);
});

test("createPersistedEditorDraft restores featured and topic fields from persisted frontmatter", () => {
  const archiveResult = createPersistedEditorDraft({
    category: "archive",
    slug: "building-a-calm-interface",
    frontmatter: {
      title: "Building a Calm Interface",
      slug: "building-a-calm-interface",
      summary: "Calm note",
      description: "Calm note",
      date: "2026-04-12",
      category: "Design Notes",
      tags: ["UI"],
      featured: true,
      assetNames: [],
      assetPaths: [],
    },
    content: "# Building a Calm Interface",
  });

  assert.equal(archiveResult.draft.featured, true);
  assert.deepEqual(archiveResult.draft.archiveMeta, { topic: "Design Notes" });

  const resourceResult = createPersistedEditorDraft({
    category: "resource",
    slug: "framer-motion",
    frontmatter: {
      title: "Framer Motion",
      slug: "framer-motion",
      summary: "Motion toolkit",
      description: "Motion toolkit",
      date: "2026-04-12",
      category: "Animation",
      tags: ["Motion"],
      featured: true,
      assetNames: [],
      assetPaths: [],
      url: "https://www.framer.com/motion/",
      rating: 5,
      accent: "primary",
      monogram: "FM",
    },
    content: "# Framer Motion",
  });

  assert.equal(resourceResult.draft.featured, true);
  assert.equal(resourceResult.draft.resourceMeta.topic, "Animation");
});
