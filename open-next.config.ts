import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

export default defineCloudflareConfig({
  // ISR 增量缓存：落 KV（免费读额度高，读多写少的博客场景合适）。
  // 需要 wrangler.jsonc 中的 NEXT_INC_CACHE_KV binding。
  incrementalCache: kvIncrementalCache,
  // revalidateTag 的 tag 账本：复用现有 myblog D1（revalidations 表，见 migrations/0003）。
  tagCache: d1NextTagCache,
  // 过期页面的后台重校验队列。默认的 "dummy" 队列 send() 会直接抛
  // FatalError("Dummy queue is not implemented")，导致每次命中 stale 页面都打
  // "Failed to revalidate stale page" 错误日志且永远不刷新。
  // doQueue 靠 NEXT_CACHE_DO_QUEUE（Durable Object）+ WORKER_SELF_REFERENCE 自引用服务绑定，
  // 由 DO 在 waitUntil 里做去重与重试，不阻塞响应。
  queue: doQueue,
});
