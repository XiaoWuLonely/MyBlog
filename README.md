# MyBlog

A personal blog built with Next.js 16, MDX content, and Cloudflare Workers.

**Live site:** [smartxb.syz](https://smartxb.syz)

## Features

- Three content collections: archive posts, projects, and resources
- MDX-based content with frontmatter metadata
- Admin-gated editor for publishing and managing all content types
- Visitor message board on the About page
- Custom animated route transitions with Framer Motion
- Light/dark theme with persistent toggle
- URL-synced search and category filters on the archive page
- Cloudflare D1 for content and visitor message persistence
- Static content registry fallback for builds without filesystem access

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
- **Content:** MDX via `@next/mdx` + `next-mdx-remote`
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

## Commands

```powershell
npm run dev          # Next.js dev server; Cloudflare D1 writes are unavailable
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

The site deploys to Cloudflare Workers. Public content is bundled into a static registry at build time so the Worker can serve pages without filesystem access. The editor publishes content directly to the configured Cloudflare D1 database.

### Setup

```powershell
# Create D1 database
npx wrangler d1 create myblog

# Apply schema
npx wrangler d1 execute myblog --remote --file migrations/0001_d1_r2_content.sql

# Export existing content to D1
node scripts/export-content-for-d1.mjs | Out-File -FilePath .\d1-content-import.sql -Encoding utf8
npx wrangler d1 execute myblog --remote --file .\d1-content-import.sql
```

If an existing remote D1 database already has `content_items` but is missing the visitor message table, apply the incremental message migration:

```powershell
npx wrangler d1 execute myblog --remote --file migrations/0002_messages.sql
```

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
- New file uploads (covers, attachments) are rejected on Cloudflare; publish text-only content for now.
- Visitor messages are stored in the remote D1 database. If message submission fails with `no such table: messages`, run `migrations/0002_messages.sql` against the remote database.

## Environment Variables

| Variable               | Required | Description                                   |
| ---------------------- | -------- | --------------------------------------------- |
| `ADMIN_ACCESS_CODE`    | Yes      | Admin login code                              |
| `ADMIN_SESSION_SECRET` | Yes      | Session signing secret                        |
| `MYBLOG_DB`            | CF only  | D1 database binding (set in `wrangler.jsonc`) |
