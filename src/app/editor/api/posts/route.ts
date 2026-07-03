import { NextResponse } from "next/server";
import {
  createEditorWritePayload,
  deleteEditorContentFile,
  type EditorUploadedFile,
  updateEditorContentFile,
} from "@/lib/content";
import { isAdminRequest } from "@/lib/admin-auth-server";
import { isCloudflareRuntime } from "@/lib/runtime-environment";
import { getD1Binding } from "@/lib/cloudflare-bindings";
import {
  deleteD1Content,
  getD1ContentBySlug,
  saveD1Content,
  validateCloudflareAssetUploads,
} from "@/lib/cloudflare-content-store";
import {
  type EditorSubmitPayload,
  validateEditorDraft,
} from "@/lib/editor";
import type { EditorDeleteResult, EditorWriteResult } from "@/lib/publish-shared";
import {
  editorContentRootDir,
  revalidateEditorContentRoutes,
  revalidatePreviousContentRoute,
} from "../shared";

async function toUploadedFile(file: File): Promise<EditorUploadedFile> {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    buffer: new Uint8Array(await file.arrayBuffer()),
  };
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json<EditorWriteResult>(
      {
        ok: false,
        message: "Admin access required.",
      },
      { status: 403 },
    );
  }

  let payload: EditorSubmitPayload;
  let coverUpload: EditorUploadedFile | null = null;
  let assetUploads: EditorUploadedFile[] = [];

  try {
    const formData = await request.formData();
    const rawPayload = formData.get("payload");

    if (typeof rawPayload !== "string") {
      return NextResponse.json<EditorWriteResult>(
        {
          ok: false,
          message: "请求体中缺少文章 payload。",
        },
        { status: 400 },
      );
    }

    payload = JSON.parse(rawPayload) as EditorSubmitPayload;

    const coverFile = formData.get("coverFile");
    if (coverFile instanceof File) {
      coverUpload = await toUploadedFile(coverFile);
    }

    assetUploads = await Promise.all(
      formData
        .getAll("assetFiles")
        .filter((file): file is File => file instanceof File)
        .map((file) => toUploadedFile(file)),
    );
  } catch {
    return NextResponse.json<EditorWriteResult>(
      {
        ok: false,
        message: "请求体不是合法的表单数据。",
      },
      { status: 400 },
    );
  }

  const prepared = createEditorWritePayload(payload);
  const errors = validateEditorDraft(prepared);

  if (Object.keys(errors).length > 0) {
    return NextResponse.json<EditorWriteResult>(
      {
        ok: false,
        message: "发布失败，请先修正表单中的必填项。",
        errors,
      },
      { status: 422 },
    );
  }

  if (isCloudflareRuntime()) {
    const db = getD1Binding();

    if (db) {
      const targetExisting = await getD1ContentBySlug(db, prepared.category, prepared.slug);
      const isSameSource =
        prepared.source &&
        prepared.source.originalCategory === prepared.category &&
        prepared.source.originalSlug === prepared.slug;

      if (targetExisting && !isSameSource) {
        return NextResponse.json<EditorWriteResult>(
          {
            ok: false,
            message: "slug already exists. Please choose another slug.",
            errors: {
              slug: "Current slug already exists.",
            },
          },
          { status: 422 },
        );
      }

      const assetValidation = validateCloudflareAssetUploads({
        coverUpload,
        assetUploads,
      });

      if (!assetValidation.ok) {
        return NextResponse.json<EditorWriteResult>(
          {
            ok: false,
            message: assetValidation.message,
          },
          { status: 422 },
        );
      }

      const result = await saveD1Content({
        db,
        payload: prepared,
      });

      if (
        result.ok &&
        prepared.source &&
        (prepared.source.originalCategory !== result.category || prepared.source.originalSlug !== result.slug)
      ) {
        await deleteD1Content({
          db,
          source: prepared.source,
        });
        revalidatePreviousContentRoute(prepared.source.originalCategory, prepared.source.originalSlug);
      }

      if (result.ok) {
        revalidateEditorContentRoutes(result.category, result.slug);
      }

      return NextResponse.json<EditorWriteResult>(result, {
        status: result.ok ? 200 : 422,
      });
    }

    return NextResponse.json<EditorWriteResult>(
      {
        ok: false,
        message: "Cloudflare content publishing requires the MYBLOG_DB D1 binding.",
      },
      { status: 503 },
    );
  }

  const result = await updateEditorContentFile({
    rootDir: editorContentRootDir(),
    payload: prepared,
    coverUpload,
    assetUploads,
  });

  if (result.ok) {
    revalidateEditorContentRoutes(result.category, result.slug);

    if (
      prepared.source &&
      (prepared.source.originalCategory !== result.category || prepared.source.originalSlug !== result.slug)
    ) {
      revalidatePreviousContentRoute(prepared.source.originalCategory, prepared.source.originalSlug);
    }
  }

  return NextResponse.json<EditorWriteResult>(result, {
    status: result.ok ? 200 : 422,
  });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json<EditorDeleteResult>(
      {
        ok: false,
        message: "Admin access required.",
      },
      { status: 403 },
    );
  }

  let source: EditorSubmitPayload["source"];

  try {
    const body = (await request.json()) as {
      source?: EditorSubmitPayload["source"];
    };
    source = body.source ?? null;
  } catch {
    return NextResponse.json<EditorDeleteResult>(
      {
        ok: false,
        message: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  if (!source) {
    return NextResponse.json<EditorDeleteResult>(
      {
        ok: false,
        message: "Missing original content source.",
      },
      { status: 400 },
    );
  }

  if (isCloudflareRuntime()) {
    const db = getD1Binding();

    if (db) {
      const result = await deleteD1Content({
        db,
        source,
      });

      revalidateEditorContentRoutes(source.originalCategory, source.originalSlug);
      revalidatePreviousContentRoute(source.originalCategory, source.originalSlug);

      return NextResponse.json<EditorDeleteResult>(result, {
        status: 200,
      });
    }

    return NextResponse.json<EditorDeleteResult>(
      {
        ok: false,
        message: "Cloudflare content deletion requires the MYBLOG_DB D1 binding.",
      },
      { status: 503 },
    );
  }

  const result = await deleteEditorContentFile({
    rootDir: editorContentRootDir(),
    source,
  });

  revalidateEditorContentRoutes(source.originalCategory, source.originalSlug);
  revalidatePreviousContentRoute(source.originalCategory, source.originalSlug);

  const response: EditorDeleteResult = result.ok
    ? {
        ok: true,
        message: result.message,
        redirectHref: result.redirectHref,
      }
    : result;

  return NextResponse.json<EditorDeleteResult>(response, {
    status: result.ok ? 200 : 422,
  });
}
