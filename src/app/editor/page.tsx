import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sanitizeAdminNextPath } from "@/lib/admin-auth";
import { isAdminRequest } from "@/lib/admin-auth-server";
import { getD1Binding } from "@/lib/cloudflare-bindings";
import { getD1EditorDraftBySource } from "@/lib/cloudflare-content-store";
import {
  createEmptyEditorDraft,
  type EditorCategory,
  type EditorDraft,
  type EditorDraftSource,
} from "@/lib/editor";
import { EditorClient } from "./editor-client";

export const metadata: Metadata = {
  title: "Editor",
  description: "Create, update, and maintain site content.",
};

type SearchValue = string | string[] | undefined;

type PageProps = {
  searchParams: Promise<{
    category?: SearchValue;
    slug?: SearchValue;
  }>;
};

function readSearchValue(value: SearchValue) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isEditorCategory(value: string): value is EditorCategory {
  return value === "archive" || value === "project" || value === "resource";
}

export default async function EditorPage({ searchParams }: PageProps) {
  const canManage = await isAdminRequest();
  const params = await searchParams;
  const requestedCategory = readSearchValue(params.category).trim();
  const requestedSlug = readSearchValue(params.slug).trim();
  const nextPath = sanitizeAdminNextPath(
    requestedCategory && requestedSlug
      ? `/editor?category=${requestedCategory}&slug=${requestedSlug}`
      : "/editor",
  );

  if (!canManage) {
    redirect(`/admin?next=${encodeURIComponent(nextPath)}`);
  }

  let initialDraft: EditorDraft | null = null;
  let initialSource: EditorDraftSource | null = null;
  let initialMessage: string | null = null;

  if (isEditorCategory(requestedCategory) && requestedSlug) {
    const source = {
      originalCategory: requestedCategory,
      originalSlug: requestedSlug,
    };
    const db = getD1Binding();
    const loaded = db
      ? await getD1EditorDraftBySource(db, source)
      : null;

    if (loaded) {
      initialDraft = loaded.draft;
      initialSource = loaded.source;
      initialMessage = "Editing existing content.";
    } else {
      initialDraft = createEmptyEditorDraft({
        category: requestedCategory,
      });
      initialMessage = "Requested content was not found. Starting from a fresh draft.";
    }
  }

  return (
    <EditorClient
      initialDraft={initialDraft}
      initialSource={initialSource}
      initialMessage={initialMessage}
    />
  );
}
