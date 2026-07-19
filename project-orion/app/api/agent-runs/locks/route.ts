import { NextResponse } from "next/server";

import { canOperateAgentRuns, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";

import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

type AgentRunTarget = "campanha" | "video" | "imagem" | "avatar" | "analise" | "funil";
type AgentRunStatus = "queued" | "sent_to_studio" | "running" | "completed" | "failed" | "cancelled";

interface CleanupLocksBody {
  limit?: number;
}

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


function mapRun(row: SupabaseAgentRunRow) {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    projectId: row.project_id,
    target: row.target_mode,
    status: row.status,
    prompt: row.input_prompt,
    inputSnapshot: row.input_snapshot,
    createdAt: row.created_at,
    sourceTitle: typeof row.metadata?.sourceTitle === "string" ? row.metadata.sourceTitle : undefined,
    outputArtifactId: typeof row.metadata?.outputArtifactId === "string" ? row.metadata.outputArtifactId : undefined,
    outputProjectId: typeof row.metadata?.outputProjectId === "string" ? row.metadata.outputProjectId : undefined,
    generationSource: typeof row.metadata?.generationSource === "string" ? row.metadata.generationSource : undefined,
    retryCount: typeof row.metadata?.retryCount === "number" ? row.metadata.retryCount : 0,
    nextRetryAt: typeof row.metadata?.nextRetryAt === "string" ? row.metadata.nextRetryAt : undefined,
    lastError: typeof row.metadata?.lastError === "string" ? row.metadata.lastError : undefined,
    executionLockId: typeof row.metadata?.executionLockId === "string" ? row.metadata.executionLockId : undefined,
    lockedAt: typeof row.metadata?.lockedAt === "string" ? row.metadata.lockedAt : undefined,
    lockExpiresAt: typeof row.metadata?.lockExpiresAt === "string" ? row.metadata.lockExpiresAt : undefined,
  };
}

async function createRunLog(
  workspaceId: string,
  runId: string,
  level: "info" | "success" | "warning" | "error",
  event: string,
  message: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabaseRest("agent_run_logs", {
      method: "POST",
      body: {
        workspace_id: workspaceId,
        run_id: runId,
        level,
        event,
        message,
        metadata,
      },
    });
  } catch {
    // Log auxiliar: nao derruba a recuperacao.
  }
}

function isExpiredRunningLock(run: SupabaseAgentRunRow) {
  if (run.status !== "running") {
    return false;
  }

  const lockExpiresAt = typeof run.metadata?.lockExpiresAt === "string" ? run.metadata.lockExpiresAt : null;

  if (!lockExpiresAt) {
    return false;
  }

  return new Date(lockExpiresAt).getTime() <= Date.now();
}

function createRecoveredMetadata(run: SupabaseAgentRunRow) {
  return {
    ...(run.metadata ?? {}),
    executionLockId: null,
    lockedAt: null,
    lockExpiresAt: null,
    lockExpiredAt: new Date().toISOString(),
    lockRecoveredAt: new Date().toISOString(),
    recoveredFromExpiredLock: true,
    lastError: "Execucao recuperada de lock expirado.",
    nextRetryAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json({ recoveredRuns: [], count: 0, source: "local-fallback", error: "Bootstrap local pendente." }, { status: 200 });
  }

  if (!canOperateAgentRuns(context.role)) {
    return NextResponse.json({ recoveredRuns: [], count: 0, errors: [], source: "supabase", error: "Apenas owners/admins podem limpar locks da fila de agentes." }, { status: 403 });
  }

  let body: CleanupLocksBody = {};

  try {
    body = (await request.json()) as CleanupLocksBody;
  } catch {
    body = {};
  }

  const limit = Math.max(1, Math.min(Number(body.limit ?? 10), 25));

  try {
    const runningResult = await supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
      query: [
        `workspace_id=eq.${context.workspaceId}`,
        "status=eq.running",
        "select=id,workspace_id,artifact_id,project_id,created_by,agent,target_mode,status,input_prompt,input_snapshot,created_at,metadata",
        "order=created_at.asc",
        "limit=50",
      ].join("&"),
    });

    if (runningResult.error) {
      return NextResponse.json({ recoveredRuns: [], count: 0, source: "local-fallback", details: runningResult.error }, { status: 200 });
    }

    const expiredRuns = (runningResult.data ?? []).filter(isExpiredRunningLock).slice(0, limit);
    const recoveredRuns = [];
    const errors = [];

    for (const run of expiredRuns) {
      await createRunLog(context.workspaceId, run.id, "warning", "lock_expired", "Lock operacional expirado detectado.", {
        lockId: run.metadata?.executionLockId,
        lockExpiresAt: run.metadata?.lockExpiresAt,
      });

      const result = await supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
        method: "PATCH",
        query: [
          `id=eq.${run.id}`,
          `workspace_id=eq.${context.workspaceId}`,
          "status=eq.running",
        ].join("&"),
        body: {
          status: "failed",
          metadata: createRecoveredMetadata(run),
        },
      });

      if (result.error || !result.data?.[0]) {
        errors.push({ runId: run.id, status: result.status });
        await createRunLog(context.workspaceId, run.id, "error", "lock_release_failed", "Nao foi possivel liberar lock expirado.", {
          details: result.error,
        });
        continue;
      }

      await createRunLog(context.workspaceId, run.id, "success", "lock_released", "Lock expirado liberado e execucao enviada para retry.", {
        previousLockId: run.metadata?.executionLockId,
      });

      recoveredRuns.push(mapRun(result.data[0]));
    }

    return NextResponse.json({
      recoveredRuns,
      count: recoveredRuns.length,
      errors,
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ recoveredRuns: [], count: 0, source: "local-fallback", error: error.message }, { status: 200 });
    }

    return NextResponse.json({ recoveredRuns: [], count: 0, source: "local-fallback", error: "Erro inesperado ao limpar locks.", details: String(error) }, { status: 200 });
  }
}

