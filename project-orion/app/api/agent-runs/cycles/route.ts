import { NextResponse } from "next/server";

import { getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";

import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

type CycleMode = "manual" | "automatic";
type CycleStatus = "completed" | "skipped" | "failed";

interface AgentRunCycleRow {
  id: string;
  workspace_id: string;
  mode: CycleMode;
  status: CycleStatus;
  cleanup_count: number;
  process_count: number;
  skipped: boolean;
  message: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}


function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function mapCycle(row: AgentRunCycleRow) {
  return {
    id: row.id,
    mode: row.mode,
    cleanupCount: row.cleanup_count,
    processCount: row.process_count,
    skipped: row.skipped,
    status: row.status,
    message: row.message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function fallbackResponse(details?: unknown) {
  return NextResponse.json(
    {
      cycles: [],
      source: "local-fallback",
      details,
    },
    { status: 200 },
  );
}

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);
  const cycleId = new URL(request.url).searchParams.get("id");

  if (!context) {
    return fallbackResponse("Workspace inicial ainda nao configurado.");
  }

  try {
    const query = [
      `workspace_id=eq.${context.workspaceId}`,
      "select=id,workspace_id,mode,status,cleanup_count,process_count,skipped,message,metadata,created_at",
    ];

    if (cycleId && isUuid(cycleId)) {
      query.push(`id=eq.${cycleId}`);
      query.push("limit=1");
    } else {
      query.push("order=created_at.desc");
      query.push("limit=12");
    }

    const result = await supabaseRest<AgentRunCycleRow[]>("agent_run_cycles", {
      query: query.join("&"),
    });

    if (result.error || !result.data) {
      return fallbackResponse(result.error);
    }

    const cycles = result.data.map(mapCycle);

    return NextResponse.json({
      cycles,
      cycle: cycleId ? cycles[0] ?? null : undefined,
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return fallbackResponse(error.message);
    }

    return fallbackResponse(String(error));
  }
}

export async function POST(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return fallbackResponse("Workspace inicial ainda nao configurado.");
  }

  try {
    const body = await request.json();
    const mode = String(body.mode ?? "") as CycleMode;
    const status = String(body.status ?? "") as CycleStatus;
    const cleanupCount = Number(body.cleanupCount ?? 0);
    const processCount = Number(body.processCount ?? 0);
    const skipped = Boolean(body.skipped);
    const message = String(body.message ?? "").trim();
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    if (!["manual", "automatic"].includes(mode)) {
      return NextResponse.json({ error: "Modo do ciclo invalido." }, { status: 400 });
    }

    if (!["completed", "skipped", "failed"].includes(status)) {
      return NextResponse.json({ error: "Status do ciclo invalido." }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: "Mensagem do ciclo e obrigatoria." }, { status: 400 });
    }

    const result = await supabaseRest<AgentRunCycleRow[]>("agent_run_cycles", {
      method: "POST",
      body: {
        workspace_id: context.workspaceId,
        mode,
        status,
        cleanup_count: Number.isFinite(cleanupCount) ? cleanupCount : 0,
        process_count: Number.isFinite(processCount) ? processCount : 0,
        skipped,
        message,
        metadata,
      },
    });

    if (result.error || !result.data?.[0]) {
      return fallbackResponse(result.error);
    }

    return NextResponse.json({
      cycle: mapCycle(result.data[0]),
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return fallbackResponse(error.message);
    }

    return fallbackResponse(String(error));
  }
}


