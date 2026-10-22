# MyBlog

A personal blog built with Next.js 16, Cloudflare D1 content storage, and Cloudflare Workers.

**Live site:** [smartxb.syz](https://smartxb.syz)

## Features

- Three content collections: archive posts, projects, and resources
- Content stored in Cloudflare D1 as the single source of truth (no local MDX fallback)
- Admin-gated editor for publishing and managing all content types
- Visitor message board on the About page
- Custom animated route transitions with Framer Motion
- Light/dark theme with persistent toggle
- URL-synced search and category filters on the archive page
- Cloudflare D1 for content and visitor message persistence
- ISR caching for public pages (KV incremental cache + D1 tag cache)
- Bot/scanner request blocking at the proxy layer

## Pages

| Route               | Description                                   |
| ------------------- | --------------------------------------------- |
| `/`                 | Home board                                    |
| `/archive`          | Post archive with search and category filters |
| `/posts/[slug]`     | Individual post                               |
| `/projects`         | Project listing                               |
| `/projects/[slug]`  | Project detail                                |
| `/resources`        | Resource listing                              |
| `/resources/[slug]` | Resource detail                               |
| `/about`            | Profile page with message submission form     |
| `/admin`            | Admin login                                   |
| `/editor`           | Content editor (archive / project / resource) |

## Stack

- **Framework:** Next.js 16.2.3 (App Router, React 19, React Compiler)
- **Styling:** Tailwind CSS 4
- **Animation:** Framer Motion
- **Content:** Markdown/MDX bodies stored in Cloudflare D1, rendered with `next-mdx-remote`
- **Deployment:** Cloudflare Workers via `@opennextjs/cloudflare`
- **Database:** Cloudflare D1

## Local Development

Requires Windows with Node.js and npm installed.

```powershell
# Install dependencies
npm install

# Create environment file
Copy-Item .env.example .env
```

Set the required variables in `.env`:

```env
ADMIN_ACCESS_CODE=<your access code>
ADMIN_SESSION_SECRET=<a long random string>
```

For the full local runtime, including editor publishing and visitor messages, use the Cloudflare preview command. The D1 binding in `wrangler.jsonc` is intentionally configured with `"remote": true`, so local preview writes to the real remote Cloudflare D1 database.

```powershell
npm run cf:preview
```

Use the plain Next.js dev server only for quick UI work that does not require Cloudflare bindings:

```powershell
npm run dev
```

Open the URL printed by the command you run.

### Local runtime capabilities

| Runtime              | Public page reads (D1)                 | Editor / API route writes (D1)                                        | Use for                   |
| -------------------- | -------------------------------------- | --------------------------------------------------------------------- | ------------------------- |
| `npm run dev`        | Yes                                    | Not validated                                                         | UI work, route debugging  |
| `npm run build`      | Yes (prerender passes)                 | —                                                                     | build validation          |
| `npm start`          | Yes                                    | No — route handlers resolve no D1 binding and return 503              | page-rendering checks only |
| `npm run cf:preview` | Yes                                    | Yes                                                                   | full local runtime        |

`npm start` is not a valid way to test publishing: the Node.js preview runtime does not resolve the Cloudflare bindings for route handlers, so `/editor/api/posts` answers 503. Validate publishing and visitor messages through `npm run cf:preview` (or `npx wrangler dev`), where the Worker runtime provides the bindings.

## Commands

```powershell
npm run dev          # Next.js dev server; public pages read the remote D1 binding
npm test             # Run tests (Node test runner)
npm run typecheck    # TypeScript check (run sequentially, not in parallel)
npm run build        # Production build
npm run lint         # ESLint
npm run cf:build     # Cloudflare build
npm run cf:preview   # Cloudflare local preview using the remote D1 binding
npm run cf:deploy    # Cloudflare build + deploy
```

Run a single test:

```powershell
node --experimental-specifier-resolution=node --test --experimental-strip-types src/lib/content.test.mjs
```

## Cloudflare Workers Deployment

The site deploys to Cloudflare Workers. Public content is read from the `content_items` table in the configured Cloudflare D1 database at request time — there is no bundled filesystem or static-registry fallback. Pages that only read content (`/projects`, `/about`) call `connection()` so they render per request instead of being prerendered as empty lists at build time, while the data itself stays cached by `use cache`. The editor publishes content directly to the same D1 database.

### Setup

```powershell
# Create D1 database
npx wrangler d1 create myblog

# Apply schema
npx wrangler d1 execute myblog --remote --file migrations/0001_d1_r2_content.sql

# Import content into D1
# Optional: scripts/export-content-for-d1.mjs is a one-off migration helper that reads
# src/content/{posts,projects,resources}. Those directories are empty in the current
# repository, so the script only emits its header. Restore historical .mdx files there
# first if you need to seed a fresh database.
node scripts/export-content-for-d1.mjs | Out-File -FilePath .\d1-content-import.sql -Encoding utf8
npx wrangler d1 execute myblog --remote --file .\d1-content-import.sql
```

If an existing remote D1 database already has `content_items` but is missing the visitor message table, apply the incremental message migration:

```powershell
npx wrangler d1 execute myblog --remote --file migrations/0002_messages.sql
```

### ISR cache setup

Public pages are cached with Next.js ISR through the OpenNext Cloudflare adapter: rendered pages go to a KV namespace (`NEXT_INC_CACHE_KV`), and cache-tag invalidation records go to a `revalidations` table in the same D1 database (`NEXT_TAG_CACHE_D1`). Both bindings live in `wrangler.jsonc`.

```powershell
# Create the KV namespace, then copy the printed id into wrangler.jsonc
npx wrangler kv namespace create NEXT_INC_CACHE_KV

# Apply the tag-cache migration
npx wrangler d1 execute myblog --remote --file migrations/0003_next_tag_cache.sql
```

Editor publish/update/delete operations call `revalidateTag("content:<category>", "max")`, so cached public pages refresh within seconds of a content change. Do not use the `{ expire: 0 }` revalidation profile — the D1 tag cache does not honor it.

### ISR revalidation queue

Pages carry `stale-while-revalidate`, so once a cached page passes its `cacheLife.revalidate` window the adapter has to re-render it in the background. That background job goes through OpenNext's queue (`open-next.config.ts` → `queue: doQueue`), which needs two bindings in `wrangler.jsonc`:

- `durable_objects` binding `NEXT_CACHE_DO_QUEUE` → class `DOQueueHandler`, declared in `migrations` as `new_sqlite_classes` (the handler uses `ctx.storage.sql`).
- `services` binding `WORKER_SELF_REFERENCE` pointing at this Worker's own name; the queue re-renders pages by sending a signed `HEAD` request back to the Worker.

Leaving `queue` at the default (`dummy`) makes every stale-page hit log `Failed to revalidate stale page <path>` and the page never refreshes until a tag revalidation happens.

The Durable Object binding brings a pending migration, and **`wrangler versions upload` cannot apply Durable Object migrations**. If Workers Builds runs `npx wrangler versions upload` as the deploy command, the build succeeds and then fails with:

```
This Worker has a pending Durable Object migration, which cannot be applied by `wrangler versions upload`.
Durable Object migrations must be applied with `wrangler deploy`.
```

Set the Workers Builds deploy command to `npx wrangler deploy` (or run `npx wrangler deploy` once locally to apply migration `v1`; afterwards `versions upload` works again for gradual rollouts). Verify with a dry run before deploying:

```powershell
npx wrangler deploy --dry-run --outdir .open-next/dryrun
```

The dry run must list `env.NEXT_CACHE_DO_QUEUE (DOQueueHandler) Durable Object` and `env.WORKER_SELF_REFERENCE (wulongblog) Worker`.

Check the remote tables:

```powershell
npx wrangler d1 execute myblog --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Configure Worker secrets:

```powershell
npx wrangler secret put ADMIN_ACCESS_CODE
npx wrangler secret put ADMIN_SESSION_SECRET
```

Build and deploy:

```powershell
npm run cf:deploy
```

The `wrangler.jsonc` contains the D1 database binding (`MYBLOG_DB`). Replace the `database_id` if you recreate the database.

### Notes

- Production builds use Webpack (`--webpack`) because the OpenNext adapter does not reliably load Next 16 Turbopack server chunks in the Worker runtime.
- Content has no local file fallback: when D1 has no row for a slug, the page answers 404 instead of reading a `.mdx` file. Deleted rows keep a tombstone in `deleted_at` so removed content cannot reappear.
- `/posts/[slug]`, `/projects/[slug]`, and `/resources/[slug]` keep a placeholder entry in `generateStaticParams` because Cache Components rejects empty results at build time; the placeholder slug resolves to `notFound()` and real slugs render on demand.
- New file uploads (covers, attachments) are rejected on Cloudflare; publish text-only content for now.
- Visitor messages are stored in the remote D1 database. If message submission fails with `no such table: messages`, run `migrations/0002_messages.sql` against the remote database.
- Known bot/scanner paths (WordPress probes, `.env`, `.git`, etc.) are answered with a fast 404 in `src/proxy.ts` before they reach the Worker router, keeping them from consuming CPU time.

## Environment Variables

| Variable               | Required | Description                                       |
| ---------------------- | -------- | ------------------------------------------------- |
| `ADMIN_ACCESS_CODE`    | Yes      | Admin login code                                  |
| `ADMIN_SESSION_SECRET` | Yes      | Session signing secret                            |
| `MYBLOG_DB`            | CF only  | D1 database binding (set in `wrangler.jsonc`)     |
| `NEXT_TAG_CACHE_D1`    | CF only  | D1 binding for ISR tag cache (same database)      |
| `NEXT_INC_CACHE_KV`    | CF only  | KV namespace binding for ISR incremental cache    |
