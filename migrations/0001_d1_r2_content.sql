CREATE TABLE IF NOT EXISTS content_items (
  collection TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL,
  tags_json TEXT NOT  NULL DEFAULT '[]',
  frontmatter_json TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (collection, slug)
);

CREATE INDEX IF NOT EXISTS idx_content_items_collection_published
  ON content_items (collection, published_at DESC, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_created
  ON messages (created_at DESC);
