import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

export default defineCloudflareConfig({
  // ISR 增量缓存：落 KV（免费读额度高，读多写少的博客场景合适）。
  // 需要 wrangler.jsonc 中的 NEXT_INC_CACHE_KV binding。
  incrementalCache: kvIncrementalCache,
  // revalidateTag 的 tag 账本：复用现有 myblog D1（revalidations 表，见 migrations/0003）。
  tagCache: d1NextTagCache,
});
