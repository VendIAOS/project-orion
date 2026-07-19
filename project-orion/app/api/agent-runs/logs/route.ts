import { NextResponse } from "next/server";

import { getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";

import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

type AgentRunLogLevel = "info" | "success" | "warning" | "error";

interface AgentRunLogRow {
  id: string;
  run_id: string;
  level: AgentRunLogLevel;
  event: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}


function mapLog(row: AgentRunLogRow) {
  return {
    id: row.id,
    runId: row.run_id,
    level: row.level,
    event: row.event,
    message: row.message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function fallbackResponse(message: string, details?: unknown) {
  return NextResponse.json(
    {
      logs: [],
      source: "local-fallback",
      error: message,
      details,
    },
    { status: 200 },
  );
}

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  if (!runId) {
    return NextResponse.json({ error: "runId e obrigatorio." }, { status: 400 });
  }

  if (!context) {
    return fallbackResponse("Workspace inicial ainda nao configurado.");
  }

  try {
    const result = await supabaseRest<AgentRunLogRow[]>("agent_run_logs", {
      query: [
        `workspace_id=eq.${context.workspaceId}`,
        `run_id=eq.${runId}`,
        "order=created_at.asc",
      ].join("&"),
    });

    if (result.error || !result.data) {
      return fallbackResponse("Tabela de logs ainda nao esta disponivel.", result.error);
    }

    return NextResponse.json({
      logs: result.data.map(mapLog),
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return fallbackResponse(error.message);
    }

    return fallbackResponse("Nao foi possivel carregar logs da execucao.", String(error));
  }
}

export async function POST(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return fallbackResponse("Workspace inicial ainda nao configurado.");
  }

  try {
    const body = await request.json();
    const runId = String(body.runId ?? "").trim();
    const level = String(body.level ?? "info").trim() as AgentRunLogLevel;
    const event = String(body.event ?? "").trim();
    const message = String(body.message ?? "").trim();
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    if (!runId || !event || !message) {
      return NextResponse.json({ error: "runId, event e message sao obrigatorios." }, { status: 400 });
    }

    if (!["info", "success", "warning", "error"].includes(level)) {
      return NextResponse.json({ error: "level invalido." }, { status: 400 });
    }

    const result = await supabaseRest<AgentRunLogRow[]>("agent_run_logs", {
      method: "POST",
      body: {
        workspace_id: context.workspaceId,
        run_id: runId,
        level,
        event,
        message,
        metadata,
      },
    });

    if (result.error || !result.data?.[0]) {
      return fallbackResponse("Log mantido localmente ate a migration ser aplicada.", result.error);
    }

    return NextResponse.json({
      log: mapLog(result.data[0]),
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return fallbackResponse(error.message);
    }

    return fallbackResponse("Nao foi possivel salvar log da execucao.", String(error));
  }
}

