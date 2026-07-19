import { NextResponse } from "next/server";

import { canManageWorkspaceMembers, getMissingWorkspaceContextReason, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

interface AdminAuditEventRow {
  id: string;
  event_type: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json({ events: [], source: "local-fallback", reason: getMissingWorkspaceContextReason() }, { status: 200 });
  }

  if (!canManageWorkspaceMembers(context.role)) {
    return NextResponse.json({ events: [], source: "supabase", error: "Apenas owners/admins podem ver auditoria administrativa." }, { status: 403 });
  }

  try {
    const result = await supabaseRest<AdminAuditEventRow[]>("admin_audit_events", {
      query: [
        `workspace_id=eq.${context.workspaceId}`,
        "select=id,event_type,target_type,target_id,metadata,created_at",
        "order=created_at.desc",
        "limit=30",
      ].join("&"),
    });

    if (result.error) {
      return NextResponse.json({ events: [], source: "local-fallback", details: result.error }, { status: 200 });
    }

    return NextResponse.json({
      events: result.data ?? [],
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ events: [], source: "local-fallback", reason: error.message }, { status: 200 });
    }

    return NextResponse.json({ events: [], source: "local-fallback", error: String(error) }, { status: 200 });
  }
}
