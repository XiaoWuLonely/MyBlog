import { Suspense } from "react";
import { GlassPanel, Pill, SoftPanel } from "@/components/site/ui";
import { isAdminRequest } from "@/lib/admin-auth-server";
import {
  normalizeResourceFiltersWithCategories,
  type ResourceFilters,
} from "@/lib/resources-shared";
import {
  getCachedAllResources,
  getCachedResourceCategories,
} from "@/lib/cached-content";
import { ResourcesClient } from "./resources-client";

type PageProps = {
  searchParams: Promise<ResourceFilters>;
};

function ResourcesFallback() {
  return (
    <div className="space-y-6 pb-8 pt-2">
      <section className="relative mx-auto max-w-3xl text-center">
        <Pill active className="mx-auto">
          Resource Shelf
        </Pill>
        <div className="theme-surface mx-auto mt-4 h-16 w-[24rem] max-w-full rounded-full" />
        <div className="theme-surface-soft mx-auto mt-4 h-5 w-[34rem] max-w-full rounded-full" />
      </section>

      <section className="scroll-strip flex gap-2 overflow-x-auto py-1">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="theme-surface h-10 w-24 rounded-full" />
        ))}
      </section>

      <section className="editorial-grid md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <GlassPanel key={index} className="p-6">
            <div className="theme-surface h-12 w-12 rounded-[18px]" />
            <div className="theme-surface mt-5 h-8 w-2/3 rounded-full" />
            <div className="theme-surface-soft mt-3 h-4 w-3/4 rounded-full" />
            <div className="mt-4 space-y-2">
              <div className="theme-surface-soft h-4 rounded-full" />
              <div className="theme-surface-ghost h-4 rounded-full" />
              <div className="theme-surface-ghost h-4 w-4/5 rounded-full" />
            </div>
            <div className="mt-5 flex gap-2">
              <SoftPanel className="h-8 w-24">
                <span aria-hidden="true" />
              </SoftPanel>
              <SoftPanel className="h-8 w-18">
                <span aria-hidden="true" />
              </SoftPanel>
            </div>
          </GlassPanel>
        ))}
      </section>
    </div>
  );
}

async function ResourcesPageContent({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const [resources, categories, canManage] = await Promise.all([
    getCachedAllResources(),
    getCachedResourceCategories(),
    isAdminRequest(),
  ]);
  const filters = normalizeResourceFiltersWithCategories(resolvedSearchParams, categories);

  return <ResourcesClient initialFilters={filters} resources={resources} categories={categories} canManage={canManage} />;
}

export default function ResourcesPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<ResourcesFallback />}>
      <ResourcesPageContent searchParams={searchParams} />
    </Suspense>
  );
}
