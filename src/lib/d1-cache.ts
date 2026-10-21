// isolate 级 L1 缓存：模块级 Map + 60s TTL。
// 仅作用于生产默认 D1 binding 的公开读路径（调用方未显式传 db 时）；
// 写入成功后由 saveD1Content / deleteD1Content 同步失效本 isolate，
// 跨 isolate 最长 60s 可见（ISR 落地后作为 L2 之前的兜底）。

const D1_CACHE_TTL_MS = 60_000;

type D1CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const d1Cache = new Map<string, D1CacheEntry>();

export async function readThroughD1Cache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = d1Cache.get(key);

  if (entry && entry.expiresAt > now) {
    return entry.value as T;
  }

  const value = await load();
  d1Cache.set(key, { value, expiresAt: now + D1_CACHE_TTL_MS });
  return value;
}

export function invalidateD1Cache(category?: string) {
  if (!category) {
    d1Cache.clear();
    return;
  }

  for (const key of d1Cache.keys()) {
    if (key.startsWith(`${category}:`)) {
      d1Cache.delete(key);
    }
  }
}
