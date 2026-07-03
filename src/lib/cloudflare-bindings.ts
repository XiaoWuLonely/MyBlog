import { getCloudflareContext } from "@opennextjs/cloudflare";

export type D1Result<T = unknown> = {
  results?: T[];
  success?: boolean;
};

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
};

export type D1DatabaseBinding = {
  prepare(query: string): D1PreparedStatement;
};

export type MyBlogCloudflareEnv = CloudflareEnv & {
  MYBLOG_DB?: D1DatabaseBinding;
};

export function getOptionalCloudflareEnv() {
  try {
    return getCloudflareContext().env as MyBlogCloudflareEnv;
  } catch {
    return null;
  }
}

export function getD1Binding(env: MyBlogCloudflareEnv | null = getOptionalCloudflareEnv()) {
  return env?.MYBLOG_DB ?? null;
}
