import { NextResponse } from "next/server";

import { canManageWorkspaceMembers, getMissingWorkspaceContextReason, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

interface WorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at?: string;
}

function mapMember(row: WorkspaceMemberRow, currentUserId: string) {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at ?? null,
    isCurrentUser: row.user_id === currentUserId,
  };
}

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json(
      {
        members: [],
        source: "local-fallback",
        reason: getMissingWorkspaceContextReason(),
      },
      { status: 200 },
    );
  }

  try {
    const result = await supabaseRest<WorkspaceMemberRow[]>("workspace_members", {
      query: [
        `workspace_id=eq.${context.workspaceId}`,
        "select=id,workspace_id,user_id,role,created_at",
        "order=created_at.asc",
      ].join("&"),
    });

    if (result.error) {
      return NextResponse.json(
        {
          members: [],
          source: "local-fallback",
          details: result.error,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      members: (result.data ?? []).map((member) => mapMember(member, context.userId)),
      currentUserId: context.userId,
      role: context.role,
      permissions: {
        role: context.role ?? "bootstrap",
        canManageMembers: canManageWorkspaceMembers(context.role),
      },
      source: "supabase",
      workspaceSource: context.source,
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ members: [], source: "local-fallback", reason: error.message }, { status: 200 });
    }

    return NextResponse.json(
      {
        members: [],
        source: "local-fallback",
        error: "Nao foi possivel carregar membros do workspace.",
        details: String(error),
      },
      { status: 200 },
    );
  }
}
