import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth-server";
import { validateMessageInput } from "@/lib/messages";
import type { MessageCreateResponse, MessageListResponse } from "@/lib/messages-shared";
import { getD1Binding } from "@/lib/cloudflare-bindings";
import { listD1Messages, saveD1Message } from "@/lib/cloudflare-content-store";
import { revalidateMessageRoutes } from "./shared";

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json<MessageListResponse>(
      {
        ok: false,
        message: "Admin access required.",
      },
      { status: 403 },
    );
  }

  const db = getD1Binding();
  if (!db) {
    return NextResponse.json<MessageListResponse>(
      {
        ok: false,
        message: "D1 database binding is required to read messages.",
      },
      { status: 503 },
    );
  }

  const items = await listD1Messages(db);
  return NextResponse.json<MessageListResponse>({
    ok: true,
    items,
  });
}

export async function POST(request: Request) {
  const db = getD1Binding();

  if (!db) {
    return NextResponse.json<MessageCreateResponse>(
      {
        ok: false,
        message: "D1 database binding is required to save messages.",
      },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json<MessageCreateResponse>(
      {
        ok: false,
        message: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const validation = validateMessageInput({
    name: typeof body.name === "string" ? body.name : undefined,
    email: typeof body.email === "string" ? body.email : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
  });

  if (!validation.ok) {
    return NextResponse.json<MessageCreateResponse>(validation, { status: 422 });
  }

  await saveD1Message({
    db,
    input: validation.value,
  });
  revalidateMessageRoutes();

  return NextResponse.json<MessageCreateResponse>({
    ok: true,
    message: "Message sent.",
  });
}
