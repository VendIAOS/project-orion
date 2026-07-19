import { NextResponse } from "next/server";

import { canOperateAgentRuns, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";

import { checkAgentRunQuota, recordBillingLimitEvent } from "@/lib/billing-limits";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

type AgentRunTarget = "campanha" | "video" | "imagem" | "avatar" | "analise" | "funil";
type AgentRunStatus = "queued" | "sent_to_studio" | "running" | "completed" | "failed" | "cancelled";

interface CreateAgentRunBody {
  artifactId?: string;
  target?: string;
  prompt?: string;
  inputSnapshot?: string;
  sourceTitle?: string;
}

interface UpdateAgentRunBody {
  status?: AgentRunStatus;
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

interface SupabaseArtifactLookupRow {
  id: string;
  project_id: string | null;
}

const VALID_TARGETS = new Set<AgentRunTarget>(["campanha", "video", "imagem", "avatar", "analise", "funil"]);
const VALID_STATUSES = new Set<AgentRunStatus>(["queued", "sent_to_studio", "running", "completed", "failed", "cancelled"]);


function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function normalizeTarget(value: string | undefined): AgentRunTarget | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase() as AgentRunTarget;

  return VALID_TARGETS.has(normalized) ? normalized : null;
}

function normalizeStatus(value: string | undefined): AgentRunStatus | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase() as AgentRunStatus;

  return VALID_STATUSES.has(normalized) ? normalized : null;
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

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json({ runs: [], source: "local-fallback" }, { status: 200 });
  }

  const artifactId = new URL(request.url).searchParams.get("artifactId");
  const query = [
    `workspace_id=eq.${context.workspaceId}`,
    "select=id,workspace_id,artifact_id,project_id,created_by,agent,target_mode,status,input_prompt,input_snapshot,created_at,metadata",
    "order=created_at.desc",
    "limit=100",
  ];

  if (artifactId && isUuid(artifactId)) {
    query.unshift(`artifact_id=eq.${artifactId}`);
  }

  try {
    const result = await supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
      query: query.join("&"),
    });

    if (result.error) {
      return NextResponse.json({ runs: [], source: "local-fallback", details: result.error }, { status: 200 });
    }

    return NextResponse.json({
      runs: (result.data ?? []).map(mapRun),
      source: "supabase",
      permissions: {
        role: context.role ?? "owner",
        canOperateAgentRuns: canOperateAgentRuns(context.role),
      },
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ runs: [], source: "local-fallback" }, { status: 200 });
    }

    return NextResponse.json({ error: "Erro inesperado ao listar execucoes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json({ error: "Bootstrap local pendente.", fallback: "localStorage" }, { status: 409 });
  }

  let body: CreateAgentRunBody;

  try {
    body = (await request.json()) as CreateAgentRunBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido." }, { status: 400 });
  }

  const target = normalizeTarget(body.target);
  const prompt = body.prompt?.trim();

  if (!target) {
    return NextResponse.json({ error: "Destino da execucao e invalido." }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: "Prompt da execucao e obrigatorio." }, { status: 400 });
  }

  let artifactId: string | null = null;
  let projectId: string | null = null;

  try {
    const quota = await checkAgentRunQuota(context.workspaceId);

    if (!quota.allowed) {
      const code = quota.status === "cancelled" ? "billing_cancelled" : "agent_run_quota_exceeded";

      await recordBillingLimitEvent({
        workspaceId: context.workspaceId,
        userId: context.userId,
        eventType: code,
        quota,
        metadata: {
          target,
          artifactId: body.artifactId,
          sourceTitle: body.sourceTitle,
          promptPreview: prompt.slice(0, 500),
        },
      });

      return NextResponse.json(
        {
          error: quota.status === "cancelled" ? "Assinatura cancelada. Reative o plano para criar novas execucoes." : "Limite mensal de execucoes atingido.",
          code,
          quota,
        },
        { status: 402 },
      );
    }

    if (body.artifactId && isUuid(body.artifactId)) {
      const artifactLookup = await supabaseRest<SupabaseArtifactLookupRow[]>("artifacts", {
        query: [`id=eq.${body.artifactId}`, `workspace_id=eq.${context.workspaceId}`, "select=id,project_id", "limit=1"].join("&"),
      });

      if (!artifactLookup.error && artifactLookup.data?.[0]) {
        artifactId = artifactLookup.data[0].id;
        projectId = artifactLookup.data[0].project_id;
      }
    }

    const result = await supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
      method: "POST",
      body: {
        workspace_id: context.workspaceId,
        artifact_id: artifactId,
        project_id: projectId,
        created_by: context.userId,
        agent: `marketing_orchestrator:${target}`,
        target_mode: target,
        status: "sent_to_studio",
        input_prompt: prompt,
        input_snapshot: body.inputSnapshot?.slice(0, 12000) ?? null,
        metadata: {
          source: "projects_dashboard",
          sourceTitle: body.sourceTitle,
        },
      },
    });

    if (result.error || !result.data?.[0]) {
      return NextResponse.json({ error: "Nao foi possivel registrar execucao.", fallback: "localStorage", details: result.error }, { status: 200 });
    }

    return NextResponse.json({
      run: mapRun(result.data[0]),
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message, fallback: "localStorage" }, { status: 503 });
    }

    return NextResponse.json({ error: "Erro inesperado ao registrar execucao.", fallback: "localStorage" }, { status: 200 });
  }
}

export async function PATCH(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);
  const runId = new URL(request.url).searchParams.get("id");

  if (!runId || !isUuid(runId)) {
    return NextResponse.json({ error: "ID da execucao e obrigatorio." }, { status: 400 });
  }

  if (!context) {
    return NextResponse.json({ error: "Bootstrap local pendente.", fallback: "localStorage" }, { status: 409 });
  }

  if (!canOperateAgentRuns(context.role)) {
    return NextResponse.json({ error: "Apenas owners/admins podem alterar execucoes de agentes." }, { status: 403 });
  }

  let body: UpdateAgentRunBody;

  try {
    body = (await request.json()) as UpdateAgentRunBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido." }, { status: 400 });
  }

  const status = normalizeStatus(body.status);

  if (!status) {
    return NextResponse.json({ error: "Status da execucao e invalido." }, { status: 400 });
  }

  try {
    const result = await supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
      method: "PATCH",
      query: [`id=eq.${runId}`, `workspace_id=eq.${context.workspaceId}`].join("&"),
      body: {
        status,
      },
    });

    if (result.error || !result.data?.[0]) {
      return NextResponse.json({ error: "Nao foi possivel atualizar execucao.", fallback: "localStorage", details: result.error }, { status: 200 });
    }

    return NextResponse.json({
      run: mapRun(result.data[0]),
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message, fallback: "localStorage" }, { status: 503 });
    }

    return NextResponse.json({ error: "Erro inesperado ao atualizar execucao.", fallback: "localStorage" }, { status: 200 });
  }
}





