import createMDX from "@next/mdx";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const nextConfig: NextConfig = {
  cacheComponents: true,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  reactCompiler: true,
  experimental: {
    instantNavigationDevToolsToggle: true,
    // workerd limits zlib maxOutputLength to 128MB; Next's postponed-state
    // parser allows up to 5x this value (default 500MB) and would throw
    // RangeError on every PPR resume. 20MB * 5 = 100MB stays within limit.
    maxPostponedStateSize: "20 MB",
  },
};

initOpenNextCloudflareForDev();

export default withMDX(nextConfig);
