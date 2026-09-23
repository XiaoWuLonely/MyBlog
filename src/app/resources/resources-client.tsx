"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Reveal } from "@/components/motion/reveal";
import { AdminDeleteButton } from "@/components/site/admin-delete-button";
import { RouteLink } from "@/components/site/route-link";
import { GlassPanel, Pill, RatingStars } from "@/components/site/ui";
import { buildEditorLoadHref } from "@/lib/editor";
import {
  ALL_RESOURCES_CATEGORY,
  buildResourceDetailHref,
  normalizeResourceFiltersWithCategories,
  type ResourceFilters,
  type ResourceItem,
} from "@/lib/resources-shared";
import { cn } from "@/lib/utils";

type ResourcesClientProps = {
  initialFilters: {
    q: string;
    category: string;
  };
  resources: ResourceItem[];
  categories: string[];
  canManage: boolean;
};

export function ResourcesClient({
  initialFilters,
  resources,
  categories,
  canManage,
}: ResourcesClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState(initialFilters.q);
  const [category, setCategory] = useState(initialFilters.category);
  const deferredQuery = useDeferredValue(query);

  const filteredResources = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();

    return resources.filter((resource) => {
      const matchCategory =
        category === ALL_RESOURCES_CATEGORY || resource.category === category;
      const haystack =
        `${resource.title} ${resource.description} ${resource.tags.join(" ")}`.toLowerCase();
      const matchQuery = !normalized || haystack.includes(normalized);

      return matchCategory && matchQuery;
    });
  }, [category, deferredQuery, resources]);

  function replaceFilters(next: ResourceFilters) {
    const normalized = normalizeResourceFiltersWithCategories(next, categories);
    const params = new URLSearchParams();

    if (normalized.q) {
      params.set("q", normalized.q);
    }

    if (normalized.category !== ALL_RESOURCES_CATEGORY) {
      params.set("category", normalized.category);
    }

    const href = params.toString() ? `${pathname}?${params}` : pathname;

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  const currentFilters = { q: query, category };

  return (
    <div className="space-y-6 pb-8 pt-2">
      <Reveal>
        <section className="relative mx-auto max-w-3xl text-center">
          <Pill active className="mx-auto">
            Resource Shelf
          </Pill>
          <h1 className="mt-4 font-heading text-5xl font-black tracking-[-0.08em] text-foreground md:text-6xl">
            收藏 / Resources
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
            经过筛选后留下的设计资源、工具与参考，并通过站内详情页承接外部跳转。
          </p>

          <div className="relative mx-auto mt-6 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                replaceFilters({ q: value, category });
              }}
              className="theme-surface w-full rounded-full py-3 pl-11 pr-5 text-sm text-foreground outline-none transition focus:border-primary/30"
              placeholder="搜索资源、灵感与工具..."
            />
          </div>
        </section>
      </Reveal>

      <section className="scroll-strip flex gap-2 overflow-x-auto py-1">
        {categories.map((item, index) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setCategory(item);
              replaceFilters({ q: query, category: item });
            }}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition",
              category === item
                ? "bg-primary text-white shadow-[0_14px_28px_rgba(172,42,31,0.22)]"
                : "theme-surface text-muted-foreground hover:text-primary",
              index === 0 ? "ml-1" : "",
            )}
          >
            {item}
          </button>
        ))}
      </section>

      <section className="editorial-grid md:grid-cols-2 xl:grid-cols-3">
        {filteredResources.map((resource, index) => (
          <Reveal key={resource.slug} delay={0.04 * (index + 1)}>
            <GlassPanel className="resource-card-shell flex h-full flex-col p-6">
              <RouteLink
                href={buildResourceDetailHref(resource.slug, currentFilters)}
                transitionKey={`resource-${resource.slug}`}
                className="block"
              >
                <div className="flex items-start justify-between gap-4">
                  {resource.cover ? (
                    <div className="theme-surface h-20 w-28 overflow-hidden rounded-[22px]">
                      <Image
                        src={resource.cover}
                        alt={resource.title}
                        width={560}
                        height={400}
                        className="h-full w-full object-cover"
                        sizes="224px"
                      />
                    </div>
                  ) : (
                    <div className="theme-surface inline-flex h-12 w-12 items-center justify-center rounded-[18px] text-sm font-heading font-black tracking-[-0.04em] text-primary">
                      {resource.monogram}
                    </div>
                  )}
                  <RatingStars value={resource.rating} />
                </div>
                <h2 className="mt-5 font-heading text-2xl font-black tracking-[-0.05em] text-foreground">
                  {resource.title}
                </h2>
                <span className="mt-1 block truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {resource.url.replace(/^https?:\/\//, "")}
                </span>
                <p className="mt-4 flex-1 text-sm leading-7 text-muted-foreground">
                  {resource.description}
                </p>
              </RouteLink>
              <div className="mt-5 flex flex-wrap gap-2">
                <RouteLink
                  href={buildResourceDetailHref(resource.slug, currentFilters)}
                  transitionKey={`resource-${resource.slug}`}
                  className="theme-surface inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-foreground"
                >
                  预览
                </RouteLink>
                {canManage ? (
                  <>
                    <RouteLink
                      href={buildEditorLoadHref("resource", resource.slug)}
                      className="theme-surface inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary"
                    >
                      编辑
                    </RouteLink>
                    <AdminDeleteButton
                      category="resource"
                      slug={resource.slug}
                      variant="inline"
                    >
                      删除
                    </AdminDeleteButton>
                  </>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Pill active>{resource.category}</Pill>
                  {resource.tags.map((tag) => (
                    <Pill key={tag}>{tag}</Pill>
                  ))}
                </div>
              </div>
            </GlassPanel>
          </Reveal>
        ))}
      </section>
    </div>
  );
}
