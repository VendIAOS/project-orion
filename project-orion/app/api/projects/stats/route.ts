import { NextResponse } from "next/server";

import { getMissingWorkspaceContextReason, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

interface CountRow {
  count?: number;
}

async function countRows(table: string, query: string) {
  const result = await supabaseRest<CountRow[]>(table, {
    query: `${query}&select=count`,
  });

  if (result.error) {
    return 0;
  }

  return Number(result.data?.[0]?.count ?? 0);
}

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json(
      {
        source: "local-fallback",
        reason: getMissingWorkspaceContextReason(),
        stats: {
          activeProjects: 0,
          archivedProjects: 0,
          restoredProjects: 0,
        },
      },
      { status: 200 },
    );
  }

  try {
    const [activeProjects, archivedProjects, restoredProjects] = await Promise.all([
      countRows("artifacts", [`workspace_id=eq.${context.workspaceId}`, "archived_at=is.null"].join("&")),
      countRows("artifacts", [`workspace_id=eq.${context.workspaceId}`, "archived_at=not.is.null"].join("&")),
      countRows(
        "admin_audit_events",
        [`workspace_id=eq.${context.workspaceId}`, "event_type=eq.project_artifact_restored"].join("&"),
      ),
    ]);

    return NextResponse.json({
      source: "supabase",
      stats: {
        activeProjects,
        archivedProjects,
        restoredProjects,
      },
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json(
        {
          source: "local-fallback",
          reason: error.message,
          stats: {
            activeProjects: 0,
            archivedProjects: 0,
            restoredProjects: 0,
          },
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        source: "local-fallback",
        error: "Erro inesperado ao carregar metricas de projetos.",
        details: String(error),
        stats: {
          activeProjects: 0,
          archivedProjects: 0,
          restoredProjects: 0,
        },
      },
      { status: 200 },
    );
  }
}
