import { NextResponse } from "next/server";

import { canOperateAgentRuns, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";

import { detectArtifactType, getProjectObjective, getProjectTitle, normalizeProjectMode } from "@/lib/project-content";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

type AgentRunTarget = "campanha" | "video" | "imagem" | "avatar" | "analise" | "funil";
type AgentRunStatus = "queued" | "sent_to_studio" | "running" | "completed" | "failed" | "cancelled";

interface ExecuteAgentRunBody {
  runId?: string;
  claimedByQueue?: boolean;
  lockId?: string;
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

interface SupabaseArtifactRow {
  id: string;
  project_id: string | null;
  mode: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown> | null;
}

interface SupabaseProjectRow {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  mode: string;
  objective: string | null;
  created_at: string;
}

interface SupabaseSavedArtifactRow {
  id: string;
  project_id?: string | null;
  mode: string;
  content: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL ?? "gpt-5";
const MAX_RETRY_ATTEMPTS = 3;


function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function createExecutionLockId(runId: string) {
  return `exec-${runId}-${Date.now()}`;
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
    // Logs sao auxiliares e nunca devem derrubar a execucao principal.
  }
}

function createFailureMetadata(run: SupabaseAgentRunRow, errorMessage: string) {
  const retryCount = typeof run.metadata?.retryCount === "number" ? run.metadata.retryCount + 1 : 1;
  const delayMinutes = Math.min(30, 2 ** Math.max(retryCount - 1, 0) * 2);
  const canRetry = retryCount < MAX_RETRY_ATTEMPTS;

  return {
    ...(run.metadata ?? {}),
    retryCount,
    lastError: errorMessage,
    failedAt: new Date().toISOString(),
    nextRetryAt: canRetry ? new Date(Date.now() + delayMinutes * 60 * 1000).toISOString() : null,
    retryLimitReached: !canRetry,
    lockReleasedAt: new Date().toISOString(),
  };
}

function createInstructions(target: AgentRunTarget) {
  return [
    "Voce e o VendIAOS, um orquestrador de marketing com IA.",
    "Execute a transformacao solicitada como um agente operacional, nao como chat generico.",
    `Modo de destino: ${target}.`,
    "Responda em portugues do Brasil, com estrutura pronta para salvar como artefato.",
    "Formato obrigatorio:",
    `MODO ESCOLHIDO: ${target}`,
    "OBJETIVO INTERPRETADO: uma frase clara.",
    "PLANO OPERACIONAL: 3 a 6 passos numerados.",
    "ARTEFATO INICIAL: entregue o artefato final transformado.",
    "PROXIMA ACAO: uma acao curta para continuar.",
  ].join("\n");
}

function createLocalFallback(run: SupabaseAgentRunRow) {
  return [
    `MODO ESCOLHIDO: ${run.target_mode}`,
    `OBJETIVO INTERPRETADO: Executar transformacao para ${run.target_mode}.`,
    "PLANO OPERACIONAL:",
    "1. Reaproveitar o contexto do artefato original.",
    `2. Converter o material para o modo ${run.target_mode}.`,
    "3. Preparar um artefato inicial pronto para revisao.",
    "ARTEFATO INICIAL:",
    run.input_prompt,
    "PROXIMA ACAO: revise o artefato derivado e salve uma nova variacao se necessario.",
  ].join("\n\n");
}

function getOpenAIText(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const outputText = (data as { output_text?: unknown }).output_text;

  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const output = (data as {
    output?: Array<{
      content?: Array<{
        text?: unknown;
      }>;
    }>;
  }).output;

  if (!Array.isArray(output)) {
    return null;
  }

  const text = output
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((content): content is string => typeof content === "string" && content.trim().length > 0)
    .join("\n\n")
    .trim();

  return text || null;
}

async function generateAgentOutput(run: SupabaseAgentRunRow) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      content: createLocalFallback(run),
      source: "local-fallback" as const,
    };
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: createInstructions(run.target_mode),
      input: [
        {
          role: "user",
          content: [
            "Execute esta transformacao do VendIAOS.",
            "",
            "PROMPT DA EXECUCAO:",
            run.input_prompt,
            "",
            "CONTEXTO DO ARTEFATO ORIGINAL:",
            run.input_snapshot ?? "Sem snapshot adicional.",
          ].join("\n"),
        },
      ],
      reasoning: {
        effort: "low",
      },
      max_output_tokens: 1600,
    }),
  });

  const data = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error("Nao foi possivel executar o agente na IA.");
  }

  const content = getOpenAIText(data);

  if (!content) {
    throw new Error("A IA retornou uma execucao sem texto utilizavel.");
  }

  return {
    content,
    source: "openai" as const,
  };
}

async function updateRunStatus(runId: string, workspaceId: string, status: AgentRunStatus, extraBody: Record<string, unknown> = {}) {
  return supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
    method: "PATCH",
    query: [`id=eq.${runId}`, `workspace_id=eq.${workspaceId}`].join("&"),
    body: {
      status,
      ...extraBody,
    },
  });
}

export async function POST(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json({ error: "Bootstrap local pendente.", fallback: "localStorage" }, { status: 409 });
  }

  if (!canOperateAgentRuns(context.role)) {
    return NextResponse.json({ error: "Apenas owners/admins podem executar agentes manualmente." }, { status: 403 });
  }

  let body: ExecuteAgentRunBody;

  let activeRun: SupabaseAgentRunRow | null = null;

  try {
    body = (await request.json()) as ExecuteAgentRunBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido." }, { status: 400 });
  }

  if (!body.runId || !isUuid(body.runId)) {
    return NextResponse.json({ error: "ID da execucao e obrigatorio." }, { status: 400 });
  }

  try {
    const runResult = await supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
      query: [
        `id=eq.${body.runId}`,
        `workspace_id=eq.${context.workspaceId}`,
        "select=id,workspace_id,artifact_id,project_id,created_by,agent,target_mode,status,input_prompt,input_snapshot,created_at,metadata",
        "limit=1",
      ].join("&"),
    });

    if (runResult.error || !runResult.data?.[0]) {
      return NextResponse.json({ error: "Execucao nao encontrada.", fallback: "localStorage", details: runResult.error }, { status: 200 });
    }

    let run = runResult.data[0];
    activeRun = run;

    if (run.status === "completed" || run.status === "cancelled") {
      await createRunLog(context.workspaceId, run.id, "warning", "execution_skipped", "Execucao ignorada porque ja esta finalizada.", {
        status: run.status,
      });

      return NextResponse.json({
        run: mapRun(run),
        source: "supabase",
        skipped: true,
        reason: "already_finished",
      });
    }

    const requestLockId = body.lockId?.trim() || createExecutionLockId(run.id);

    if (!body.claimedByQueue) {
      if (run.status === "running") {
        await createRunLog(context.workspaceId, run.id, "warning", "execution_skipped", "Execucao ignorada porque ja esta em andamento.", {
          status: run.status,
        });

        return NextResponse.json({
          run: mapRun(run),
          source: "supabase",
          skipped: true,
          reason: "already_running",
        });
      }

      const claimResult = await supabaseRest<SupabaseAgentRunRow[]>("agent_runs", {
        method: "PATCH",
        query: [
          `id=eq.${run.id}`,
          `workspace_id=eq.${context.workspaceId}`,
          "status=in.(queued,sent_to_studio,failed)",
        ].join("&"),
        body: {
          status: "running",
          metadata: createLockMetadata(run, requestLockId),
        },
      });

      if (claimResult.error || !claimResult.data?.[0]) {
        await createRunLog(context.workspaceId, run.id, "warning", "lock_rejected", "Execucao nao foi capturada porque outro processo chegou primeiro.", {
          lockId: requestLockId,
          details: claimResult.error,
        });

        return NextResponse.json({
          run: mapRun(run),
          source: "supabase",
          skipped: true,
          reason: "lock_rejected",
        });
      }

      run = claimResult.data[0];
      activeRun = run;
    }

    await createRunLog(context.workspaceId, run.id, "info", "received", "Pedido recebido pela rota server-side de execucao.", {
      target: run.target_mode,
      lockId: requestLockId,
      claimedByQueue: Boolean(body.claimedByQueue),
    });

    await createRunLog(context.workspaceId, run.id, "info", "running", "Agente marcado como em execucao.", {
      target: run.target_mode,
      lockId: requestLockId,
    });

    const generation = await generateAgentOutput(run);
    await createRunLog(context.workspaceId, run.id, "success", "generated", "Conteudo do agente gerado.", {
      source: generation.source,
    });

    const mode = normalizeProjectMode(run.target_mode);
    const title = getProjectTitle(generation.content);
    const objective = getProjectObjective(generation.content);

    let originArtifact: SupabaseArtifactRow | null = null;

    if (run.artifact_id) {
      const originResult = await supabaseRest<SupabaseArtifactRow[]>("artifacts", {
        query: [
          `id=eq.${run.artifact_id}`,
          `workspace_id=eq.${context.workspaceId}`,
          "select=id,project_id,mode,title,content,metadata",
          "limit=1",
        ].join("&"),
      });

      originArtifact = originResult.data?.[0] ?? null;
    }

    const projectResult = await supabaseRest<SupabaseProjectRow[]>("projects", {
      method: "POST",
      body: {
        workspace_id: context.workspaceId,
        created_by: context.userId,
        title,
        objective,
        mode,
        source: "agent_run",
        metadata: {
          savedFrom: "agent_run_execute",
          agentRunId: run.id,
          originProjectId: run.artifact_id,
          originProjectMode: originArtifact?.mode,
          originProjectTitle: originArtifact?.title,
          generationSource: generation.source,
        },
      },
    });

    if (projectResult.error || !projectResult.data?.[0]) {
      const errorMessage = "Agente executou, mas nao foi possivel criar projeto derivado.";
      await updateRunStatus(run.id, context.workspaceId, "failed", {
        metadata: createFailureMetadata(run, errorMessage),
      });
      await createRunLog(context.workspaceId, run.id, "error", "failed", "Agente executou, mas nao foi possivel criar projeto derivado.", {
        details: projectResult.error,
      });
      return NextResponse.json({ error: errorMessage, details: projectResult.error }, { status: 200 });
    }

    const project = projectResult.data[0];
    const artifactResult = await supabaseRest<SupabaseSavedArtifactRow[]>("artifacts", {
      method: "POST",
      body: {
        workspace_id: context.workspaceId,
        project_id: project.id,
        created_by: context.userId,
        type: detectArtifactType(mode),
        mode,
        title,
        content: generation.content,
        metadata: {
          source: "agent_run_execute",
          agentRunId: run.id,
          originProjectId: run.artifact_id,
          originProjectMode: originArtifact?.mode,
          originProjectTitle: originArtifact?.title,
          generationSource: generation.source,
        },
      },
    });

    if (artifactResult.error || !artifactResult.data?.[0]) {
      const errorMessage = "Projeto criado, mas artefato derivado nao foi salvo.";
      await updateRunStatus(run.id, context.workspaceId, "failed", {
        metadata: createFailureMetadata(run, errorMessage),
      });
      await createRunLog(context.workspaceId, run.id, "error", "failed", "Projeto criado, mas artefato derivado nao foi salvo.", {
        projectId: project.id,
        details: artifactResult.error,
      });
      return NextResponse.json({ error: errorMessage, details: artifactResult.error }, { status: 200 });
    }

    const artifact = artifactResult.data[0];
    await createRunLog(context.workspaceId, run.id, "success", "artifact_saved", "Artefato derivado salvo na biblioteca de projetos.", {
      outputProjectId: project.id,
      outputArtifactId: artifact.id,
    });

    const completedRun = await updateRunStatus(run.id, context.workspaceId, "completed", {
      output_artifact_id: artifact.id,
      metadata: {
        ...(run.metadata ?? {}),
        outputArtifactId: artifact.id,
        outputProjectId: project.id,
        generationSource: generation.source,
        lastError: null,
        nextRetryAt: null,
        retryLimitReached: false,
        lockReleasedAt: new Date().toISOString(),
      },
    });

    await createRunLog(context.workspaceId, run.id, "success", "completed", "Execucao concluida com sucesso.", {
      outputProjectId: project.id,
      outputArtifactId: artifact.id,
      source: generation.source,
    });

    return NextResponse.json({
      run: completedRun.data?.[0] ? mapRun(completedRun.data[0]) : { ...mapRun(run), status: "completed" },
      project: {
        id: artifact.id,
        mode: artifact.mode,
        content: artifact.content,
        createdAt: artifact.created_at,
        originProjectId: run.artifact_id ?? undefined,
        originProjectMode: originArtifact?.mode,
        originProjectTitle: originArtifact?.title,
      },
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message, fallback: "localStorage" }, { status: 503 });
    }

    if (activeRun) {
      await updateRunStatus(activeRun.id, context.workspaceId, "failed", {
        metadata: createFailureMetadata(activeRun, "Erro inesperado ao executar agente."),
      });
    }

    await createRunLog(context.workspaceId, body.runId, "error", "failed", "Erro inesperado ao executar agente.", {
      error: String(error),
    });

    return NextResponse.json({ error: "Erro inesperado ao executar agente.", fallback: "localStorage" }, { status: 200 });
  }
}


