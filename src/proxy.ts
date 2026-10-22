import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 扫描器/僵尸网络常见垃圾前缀：命中后直接返回裸 404，不进入 Next 渲染管线，
// 避免整页 SSR + D1 查询耗尽 Worker CPU 预算。
const JUNK_PREFIXES = [
  "/wp-",
  "/wordpress",
  "/cms",
  "/vendor/",
  "/phpmyadmin",
  "/xmlrpc.php",
  "/.env",
  "/.git",
];

// 垃圾文件后缀（.xml 中的 /sitemap.xml 是合法路由，单独放行）。
const JUNK_SUFFIXES = [
  ".php",
  ".xml",
  ".sql",
  ".bak",
  ".old",
  ".ini",
  ".log",
  ".yml",
  ".yaml",
];

const ALLOWED_PATHS = new Set(["/sitemap.xml"]);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.toLowerCase();

  if (ALLOWED_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const isJunk =
    JUNK_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    JUNK_SUFFIXES.some((suffix) => pathname.endsWith(suffix));

  if (isJunk) {
    // 裸 404：亚毫秒字符串匹配，CDN 可缓存，吸收扫描器重复请求。
    return new Response(null, {
      status: 404,
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  // 排除 Next 内部资源与 public 静态目录，其余请求均经过垃圾护盾。
  matcher: ["/((?!_next/|visuals/).*)"],
};
