import { NextResponse } from "next/server";

import { getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";

import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

type AgentRunTarget = "campanha" | "video" | "imagem" | "avatar" | "analise" | "funil";
type AgentRunStatus = "queued" | "sent_to_studio" | "running" | "completed" | "failed" | "cancelled";

interface SupabaseAgentRunRow {
  id: string;
  workspace_id: string;
  artifact_id: string | null;
  project_id: string | null;
  created_by: string;
  agent: string;
  target_mode: AgentRunTarget;
  status: AgentRunStatus;
  input_prompt: string;
  input_snapshot: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}


function isStuckRun(run: SupabaseAgentRunRow) {
  if (run.status !== "running") {
    return false;
  }

  const lockExpiresAt = typeof run.metadata?.lockExpiresAt === "string" ? run.metadata.lockExpiresAt : null;

  if (!lockExpiresAt) {
    return false;
  }

  return new Date(lockExpiresAt).getTime() <= Date.now();
}

function isRetryReady(run: SupabaseAgentRunRow) {
  if (run.status !== "failed") {
    return false;
  }

  const retryCount = typeof run.metadata?.retryCount === "number" ? run.metadata.retryCount : 0;
  const nextRetryAt = typeof run.metadata?.nextRetryAt === "string" ? run.metadata.nextRetryAt : null;

  if (retryCount >= 3) {
    return false;
  }

  if (!nextRetryAt) {
    return true;
  }

  return new Date(nextRetryAt).getTime() <= Date.now();
}

function createHealthPayload(runs: SupabaseAgentRunRow[], source: "supabase" | "local-fallback") {
  const statusCounts: Record<AgentRunStatus, number> = {
    queued: 0,
    sent_to_studio: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };

  const targetCounts: Record<AgentRunTarget, number> = {
    campanha: 0,
    video: 0,
    imagem: 0,
    avatar: 0,
    analise: 0,
    funil: 0,
  };

  for (const run of runs) {
    statusCounts[run.status] += 1;
    targetCounts[run.target_mode] += 1;
  }

  const stuckRuns = runs.filter(isStuckRun);
  const retryReadyRuns = runs.filter(isRetryReady);
  const activeRuns = statusCounts.queued + statusCounts.sent_to_studio + statusCounts.running + retryReadyRuns.length;
  const total = runs.length;
  const completedRate = total > 0 ? Math.round((statusCounts.completed / total) * 100) : 0;

  return {
    source,
    total,
    activeRuns,
    completedRate,
    stuckCount: stuckRuns.length,
    retryReadyCount: retryReadyRuns.length,
    statusCounts,
    targetCounts,
    latestRunAt: runs[0]?.created_at ?? null,
    generatedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json(createHealthPayload([], "local-fallback"), { status: 200 });
  }

  try {
    const result = await supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
      query: [
        `workspace_id=eq.${context.workspaceId}`,
        "select=id,workspace_id,artifact_id,project_id,created_by,agent,target_mode,status,input_prompt,input_snapshot,created_at,metadata",
        "order=created_at.desc",
        "limit=250",
      ].join("&"),
    });

    if (result.error || !result.data) {
      return NextResponse.json({
        ...createHealthPayload([], "local-fallback"),
        details: result.error,
      }, { status: 200 });
    }

    return NextResponse.json(createHealthPayload(result.data, "supabase"), { status: 200 });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json(createHealthPayload([], "local-fallback"), { status: 200 });
    }

    return NextResponse.json({
      ...createHealthPayload([], "local-fallback"),
      error: "Erro inesperado ao calcular saude da fila.",
      details: String(error),
    }, { status: 200 });
  }
}

