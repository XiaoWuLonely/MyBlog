import { ArrowUpRight, Star } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { PostMeta } from "@/lib/posts";
import { RouteLink } from "./route-link";

export function GlassPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("glass-panel rounded-[28px]", className)}>{children}</div>;
}

export function SoftPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("glass-soft rounded-[24px]", className)}>{children}</div>;
}

export function Pill({
  children,
  className,
  active = false,
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-label uppercase tracking-[0.2em]",
        active
          ? "bg-primary-soft text-primary shadow-[0_6px_16px_rgba(172,42,31,0.16)]"
          : "theme-surface text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ActionLink({
  href,
  children,
  className,
  variant = "primary",
  transitionKey,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
  transitionKey?: string;
}) {
  return (
    <RouteLink
      href={href}
      transitionKey={transitionKey}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition",
        variant === "primary"
          ? "bg-gradient-to-r from-primary to-primary-strong text-white shadow-[0_18px_36px_rgba(172,42,31,0.22)] hover:-translate-y-0.5"
          : "theme-surface text-foreground hover:-translate-y-0.5",
        className,
      )}
    >
      {children}
    </RouteLink>
  );
}

export function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5 text-tertiary">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={cn("h-4 w-4", index < value ? "fill-current" : "opacity-25")} />
      ))}
    </div>
  );
}

export function ArticlePreviewCard({
  post,
  className,
}: {
  post: PostMeta;
  className?: string;
}) {
  return (
    <RouteLink
      href={`/posts/${post.slug}`}
      transitionKey={`post-${post.slug}`}
      className={cn(
        "theme-surface group flex h-full flex-col justify-between rounded-[24px] p-5 backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(46,47,45,0.08)]",
        className,
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Pill active>{post.category}</Pill>
          {post.readingMinutes ? (
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {post.readingMinutes}
            </span>
          ) : null}
        </div>
        <div>
          <h3
            className="text-balance font-heading text-2xl font-black tracking-[-0.05em] text-foreground transition group-hover:text-primary"
            style={{ viewTransitionName: `post-${post.slug}` }}
          >
            {post.title}
          </h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{post.summary}</p>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between gap-4">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {formatDate(post.date)}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          阅读
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </RouteLink>
  );
}
