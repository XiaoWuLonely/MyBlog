import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth-server";
import type { MessageDeleteResponse } from "@/lib/messages-shared";
import { getD1Binding } from "@/lib/cloudflare-bindings";
import { deleteD1Message } from "@/lib/cloudflare-content-store";
import { revalidateMessageRoutes } from "../shared";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, { params }: RouteProps) {
  const db = getD1Binding();

  if (!db) {
    return NextResponse.json<MessageDeleteResponse>(
      {
        ok: false,
        message: "D1 database binding is required to delete messages.",
      },
      { status: 503 },
    );
  }

  if (!(await isAdminRequest())) {
    return NextResponse.json<MessageDeleteResponse>(
      {
        ok: false,
        message: "Admin access required.",
      },
      { status: 403 },
    );
  }

  const { id } = await params;
  const deleted = await deleteD1Message(db, id);

  if (!deleted) {
    return NextResponse.json<MessageDeleteResponse>(
      {
        ok: false,
        message: "Message not found.",
      },
      { status: 404 },
    );
  }

  revalidateMessageRoutes();

  return NextResponse.json<MessageDeleteResponse>({
    ok: true,
    id,
  });
}
