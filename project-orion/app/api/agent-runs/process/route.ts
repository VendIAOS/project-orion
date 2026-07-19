import { NextResponse } from "next/server";

import { canOperateAgentRuns, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";

import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

type AgentRunTarget = "campanha" | "video" | "imagem" | "avatar" | "analise" | "funil";
type AgentRunStatus = "queued" | "sent_to_studio" | "running" | "completed" | "failed" | "cancelled";
const MAX_RETRY_ATTEMPTS = 3;

interface ProcessQueueBody {
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


function createQueueLockId(runId: string) {
  return `queue-${runId}-${Date.now()}`;
}

function createLockMetadata(run: SupabaseAgentRunRow, lockId: string) {
  const lockedAt = new Date();

  return {
    ...(run.metadata ?? {}),
    executionLockId: lockId,
    lockedAt: lockedAt.toISOString(),
    lockExpiresAt: new Date(lockedAt.getTime() + 15 * 60 * 1000).toISOString(),
  };
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
    // Log auxiliar: nao derruba o processamento da fila.
  }
}

async function loadRun(workspaceId: string, runId: string) {
  const result = await supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
    query: [
      `id=eq.${runId}`,
      `workspace_id=eq.${workspaceId}`,
      "select=id,workspace_id,artifact_id,project_id,created_by,agent,target_mode,status,input_prompt,input_snapshot,created_at,metadata",
      "limit=1",
    ].join("&"),
  });

  return result.data?.[0] ?? null;
}

async function claimRunForQueue(workspaceId: string, run: SupabaseAgentRunRow) {
  const lockId = createQueueLockId(run.id);
  const result = await supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
    method: "PATCH",
    query: [
      `id=eq.${run.id}`,
      `workspace_id=eq.${workspaceId}`,
      "status=in.(queued,sent_to_studio,failed)",
    ].join("&"),
    body: {
      status: "running",
      metadata: createLockMetadata(run, lockId),
    },
  });

  if (result.error || !result.data?.[0]) {
    return {
      run: null,
      lockId,
      error: result.error,
    };
  }

  return {
    run: result.data[0],
    lockId,
    error: null,
  };
}

function isEligibleForQueue(run: SupabaseAgentRunRow) {
  if (run.status === "queued" || run.status === "sent_to_studio") {
    return true;
  }

  if (run.status !== "failed") {
    return false;
  }

  const retryCount = typeof run.metadata?.retryCount === "number" ? run.metadata.retryCount : 0;
  const nextRetryAt = typeof run.metadata?.nextRetryAt === "string" ? run.metadata.nextRetryAt : null;

  if (retryCount >= MAX_RETRY_ATTEMPTS) {
    return false;
  }

  if (!nextRetryAt) {
    return true;
  }

  return new Date(nextRetryAt).getTime() <= Date.now();
}

export async function POST(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json({ processedRuns: [], source: "local-fallback", error: "Bootstrap local pendente." }, { status: 200 });
  }

  if (!canOperateAgentRuns(context.role)) {
    return NextResponse.json({ processedRuns: [], count: 0, errors: [], source: "supabase", error: "Apenas owners/admins podem processar a fila de agentes." }, { status: 403 });
  }

  let body: ProcessQueueBody = {};

  try {
    body = (await request.json()) as ProcessQueueBody;
  } catch {
    body = {};
  }

  const limit = Math.max(1, Math.min(Number(body.limit ?? 3), 5));

  try {
    const pendingResult = await supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
      query: [
        `workspace_id=eq.${context.workspaceId}`,
        "status=in.(queued,sent_to_studio,failed)",
        "select=id,workspace_id,artifact_id,project_id,created_by,agent,target_mode,status,input_prompt,input_snapshot,created_at,metadata",
        "order=created_at.asc",
        "limit=25",
      ].join("&"),
    });

    if (pendingResult.error) {
      return NextResponse.json({ processedRuns: [], source: "local-fallback", details: pendingResult.error }, { status: 200 });
    }

    const pendingRuns = (pendingResult.data ?? []).filter(isEligibleForQueue).slice(0, limit);
    const origin = new URL(request.url).origin;
    const processedRuns = [];
    const errors = [];

    for (const run of pendingRuns) {
      const claim = await claimRunForQueue(context.workspaceId, run);

      if (!claim.run) {
        errors.push({ runId: run.id, status: 409 });
        await createRunLog(context.workspaceId, run.id, "warning", "queue_skipped", "Execucao ignorada porque outro processo capturou primeiro.", {
          target: run.target_mode,
          lockId: claim.lockId,
          details: claim.error,
        });
        continue;
      }

      const claimedRun = claim.run;
      await createRunLog(context.workspaceId, claimedRun.id, "info", run.status === "failed" ? "retry_claimed" : "queue_claimed", "Execucao capturada pelo processador de fila.", {
        target: claimedRun.target_mode,
        retryCount: claimedRun.metadata?.retryCount ?? 0,
        lockId: claim.lockId,
      });

      const response = await fetch(`${origin}/api/agent-runs/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(request.headers.get("authorization") ? { Authorization: request.headers.get("authorization") as string } : {}),
        },
        body: JSON.stringify({ runId: claimedRun.id, claimedByQueue: true, lockId: claim.lockId }),
      });

      if (!response.ok) {
        errors.push({ runId: claimedRun.id, status: response.status });
        await createRunLog(context.workspaceId, claimedRun.id, "error", "queue_failed", "Processador de fila nao conseguiu executar o agente.", {
          status: response.status,
        });
        continue;
      }

      const refreshedRun = await loadRun(context.workspaceId, claimedRun.id);
      processedRuns.push(refreshedRun ? mapRun(refreshedRun) : mapRun(claimedRun));
    }

    return NextResponse.json({
      processedRuns,
      count: processedRuns.length,
      errors,
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ processedRuns: [], source: "local-fallback", error: error.message }, { status: 200 });
    }

    return NextResponse.json({ processedRuns: [], source: "local-fallback", error: "Erro inesperado ao processar fila.", details: String(error) }, { status: 200 });
  }
}


