import type { Metadata } from "next";
import { Suspense } from "react";
import { Reveal } from "@/components/motion/reveal";
import { GlassPanel, Pill, SoftPanel } from "@/components/site/ui";
import { isAdminRequest } from "@/lib/admin-auth-server";
import {
  ALL_POSTS_CATEGORY,
  normalizeArchiveFiltersWithCategories,
  type ArchiveFilters,
} from "@/lib/posts-shared";
import { getCachedAllPosts } from "@/lib/cached-content";
import { ArchiveClient } from "./archive-client";

export const metadata: Metadata = {
  title: "归档",
  description: "按主题与筛选条件重新组织的文章归档视图。",
};

function ArchiveBoardSkeleton() {
  return (
    <div className="space-y-6 pb-8 pt-2">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Reveal>
          <div>
            <Pill active>Archive Board</Pill>
            <div className="theme-surface mt-4 h-16 w-[24rem] max-w-full rounded-full" />
            <div className="theme-surface-soft mt-4 h-5 w-[34rem] max-w-full rounded-full" />
          </div>
        </Reveal>

        <Reveal delay={0.05} className="archive-toolbar-layer">
          <div className="archive-toolbar" aria-hidden="true">
            <div className="theme-surface h-[2.125rem] w-[2.125rem] rounded-full" />
            <div className="theme-surface h-[2.125rem] w-[2.125rem] rounded-full" />
          </div>
        </Reveal>
      </section>

      <section className="editorial-grid lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Reveal key={index} delay={0.05 * (index + 1)}>
            <GlassPanel className="flex h-full flex-col p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="theme-surface h-8 w-36 rounded-full" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.from({ length: 3 }, (_, tagIndex) => (
                      <Pill key={tagIndex}>...</Pill>
                    ))}
                  </div>
                </div>
                <Pill active>GROUP / 00</Pill>
              </div>

              <div className="space-y-4">
                {Array.from({ length: 3 }, (_, itemIndex) => (
                  <SoftPanel key={itemIndex} className="p-4">
                    <div className="theme-surface-ghost h-3 w-20 rounded-full" />
                    <div className="theme-surface mt-3 h-5 w-4/5 rounded-full" />
                  </SoftPanel>
                ))}
              </div>
            </GlassPanel>
          </Reveal>
        ))}
      </section>
    </div>
  );
}

type PageProps = {
  searchParams: Promise<ArchiveFilters>;
};

async function ArchivePageContent({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const [posts, canManage] = await Promise.all([getCachedAllPosts(), isAdminRequest()]);
  const categories = [ALL_POSTS_CATEGORY, ...new Set(posts.map((post) => post.category))];
  const filters = normalizeArchiveFiltersWithCategories(resolvedSearchParams, categories);

  return <ArchiveClient initialFilters={filters} posts={posts} categories={categories} canManage={canManage} />;
}

export default function ArchivePage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<ArchiveBoardSkeleton />}>
      <ArchivePageContent searchParams={searchParams} />
    </Suspense>
  );
}
