import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth-server";
import type { MessageMutationResponse } from "@/lib/messages-shared";
import { getD1Binding } from "@/lib/cloudflare-bindings";
import { markD1MessageAsRead } from "@/lib/cloudflare-content-store";
import { revalidateMessageRoutes } from "../../shared";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: RouteProps) {
  const db = getD1Binding();

  if (!db) {
    return NextResponse.json<MessageMutationResponse>(
      {
        ok: false,
        message: "D1 database binding is required to update messages.",
      },
      { status: 503 },
    );
  }

  if (!(await isAdminRequest())) {
    return NextResponse.json<MessageMutationResponse>(
      {
        ok: false,
        message: "Admin access required.",
      },
      { status: 403 },
    );
  }

  const { id } = await params;
  const item = await markD1MessageAsRead({
    db,
    id,
  });

  if (!item) {
    return NextResponse.json<MessageMutationResponse>(
      {
        ok: false,
        message: "Message not found.",
      },
      { status: 404 },
    );
  }

  revalidateMessageRoutes();

  return NextResponse.json<MessageMutationResponse>({
    ok: true,
    item,
  });
}
