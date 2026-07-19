import { getAuthHeaders } from "@/components/auth/auth-fetch";

import type { SavedProject } from "@/components/ai/lib/projects-client";
import { getProjectObjective } from "@/components/projects/project-format";

export type AgentRunTarget = "campanha" | "video" | "imagem" | "avatar" | "analise" | "funil";
export type AgentRunStatus = "queued" | "sent_to_studio" | "running" | "completed" | "failed" | "cancelled";
export type AgentRunLogLevel = "info" | "success" | "warning" | "error";

export interface AgentRun {
  id: string;
  artifactId?: string | null;
  projectId?: string | null;
  target: AgentRunTarget;
  status: AgentRunStatus;
  prompt: string;
  inputSnapshot?: string | null;
  createdAt: string;
  sourceTitle?: string;
  outputArtifactId?: string;
  outputProjectId?: string;
  generationSource?: string;
  retryCount?: number;
  nextRetryAt?: string;
  lastError?: string;
  executionLockId?: string;
  lockedAt?: string;
  lockExpiresAt?: string;
}

export interface AgentRunLog {
  id: string;
  runId: string;
  level: AgentRunLogLevel;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AgentRunHealth {
  source: "supabase" | "local-fallback";
  total: number;
  activeRuns: number;
  completedRate: number;
  stuckCount: number;
  retryReadyCount: number;
  statusCounts: Record<AgentRunStatus, number>;
  targetCounts: Record<AgentRunTarget, number>;
  latestRunAt: string | null;
  generatedAt: string;
}

export interface AgentRunCycle {
  id: string;
  mode: "manual" | "automatic";
  cleanupCount: number;
  processCount: number;
  skipped: boolean;
  status: "completed" | "skipped" | "failed";
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface AgentRunsResponse {
  runs?: AgentRun[];
  source?: "supabase" | "local-fallback";
  permissions?: {
    role?: string;
    canOperateAgentRuns?: boolean;
  };
}

interface AgentRunLogsResponse {
  logs?: AgentRunLog[];
  source?: "supabase" | "local-fallback";
}

interface CreateAgentRunResponse {
  run?: AgentRun;
  source?: "supabase" | "local-fallback";
  error?: string;
  code?: string;
}

interface CreateAgentRunLogResponse {
  log?: AgentRunLog;
  source?: "supabase" | "local-fallback";
}

interface ExecuteAgentRunResponse {
  run?: AgentRun;
  project?: SavedProject;
  source?: "supabase" | "local-fallback";
}

interface ProcessAgentRunQueueResponse {
  processedRuns?: AgentRun[];
  count?: number;
  errors?: Array<{ runId: string; status?: number }>;
  source?: "supabase" | "local-fallback";
}

interface CleanupExpiredLocksResponse {
  recoveredRuns?: AgentRun[];
  count?: number;
  errors?: Array<{ runId: string; status?: number }>;
  source?: "supabase" | "local-fallback";
}

interface AgentRunCyclesResponse {
  cycles?: AgentRunCycle[];
  cycle?: AgentRunCycle;
  source?: "supabase" | "local-fallback";
}

export const AGENT_RUNS_KEY = "vendiaos.agent-runs";
export const AGENT_RUN_LOGS_KEY = "vendiaos.agent-run-logs";

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mergeRuns(primary: AgentRun[], secondary: AgentRun[]) {
  const runsById = new Map<string, AgentRun>();

  [...primary, ...secondary].forEach((run) => {
    runsById.set(run.id, run);
  });

  return Array.from(runsById.values())
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
    .slice(0, 100);
}

function mergeLogs(primary: AgentRunLog[], secondary: AgentRunLog[]) {
  const logsById = new Map<string, AgentRunLog>();

  [...primary, ...secondary].forEach((log) => {
    logsById.set(log.id, log);
  });

  return Array.from(logsById.values())
    .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime())
    .slice(-300);
}

function dispatchLogsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("vendiaos:agent-run-logs-updated"));
  }
}

export function loadLocalAgentRuns() {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  try {
    return JSON.parse(storage.getItem(AGENT_RUNS_KEY) ?? "[]") as AgentRun[];
  } catch {
    storage.removeItem(AGENT_RUNS_KEY);
    return [];
  }
}

export function persistLocalAgentRuns(runs: AgentRun[]) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(AGENT_RUNS_KEY, JSON.stringify(runs.slice(0, 100)));
}

export function loadLocalAgentRunLogs(runId?: string) {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  try {
    const logs = JSON.parse(storage.getItem(AGENT_RUN_LOGS_KEY) ?? "[]") as AgentRunLog[];
    return runId ? logs.filter((log) => log.runId === runId) : logs;
  } catch {
    storage.removeItem(AGENT_RUN_LOGS_KEY);
    return [];
  }
}

export function persistLocalAgentRunLogs(logs: AgentRunLog[]) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(AGENT_RUN_LOGS_KEY, JSON.stringify(logs.slice(-300)));
  dispatchLogsUpdated();
}

export async function loadSyncedAgentRunCycles() {
  try {
    const response = await fetch("/api/agent-runs/cycles", {
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        cycles: [],
        source: "local" as const,
      };
    }

    const data = (await response.json()) as AgentRunCyclesResponse;

    if (data.source !== "supabase") {
      return {
        cycles: [],
        source: "local" as const,
      };
    }

    return {
      cycles: data.cycles ?? [],
      source: "supabase" as const,
    };
  } catch {
    return {
      cycles: [],
      source: "local" as const,
    };
  }
}

export async function loadSyncedAgentRunCycle(cycleId: string) {
  try {
    const response = await fetch(`/api/agent-runs/cycles?id=${encodeURIComponent(cycleId)}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        cycle: null,
        source: "local" as const,
      };
    }

    const data = (await response.json()) as AgentRunCyclesResponse;

    if (data.source !== "supabase" || !data.cycle) {
      return {
        cycle: null,
        source: "local" as const,
      };
    }

    return {
      cycle: data.cycle,
      source: "supabase" as const,
    };
  } catch {
    return {
      cycle: null,
      source: "local" as const,
    };
  }
}

export async function createAgentRunCycle(input: Omit<AgentRunCycle, "id" | "createdAt">) {
  try {
    const response = await fetch("/api/agent-runs/cycles", {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      return {
        cycle: null,
        source: "local" as const,
      };
    }

    const data = (await response.json()) as AgentRunCyclesResponse;

    if (data.source !== "supabase" || !data.cycle) {
      return {
        cycle: null,
        source: "local" as const,
      };
    }

    return {
      cycle: data.cycle,
      source: "supabase" as const,
    };
  } catch {
    return {
      cycle: null,
      source: "local" as const,
    };
  }
}

export async function loadAgentRunHealth() {
  try {
    const response = await fetch("/api/agent-runs/health", {
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AgentRunHealth;
  } catch {
    return null;
  }
}

export async function loadSyncedAgentRuns(artifactId?: string) {
  const localRuns = loadLocalAgentRuns();
  const query = artifactId ? `?artifactId=${encodeURIComponent(artifactId)}` : "";

  try {
    const response = await fetch(`/api/agent-runs${query}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        runs: localRuns,
        source: "local" as const,
        canOperateAgentRuns: true,
      };
    }

    const data = (await response.json()) as AgentRunsResponse;

    if (data.source !== "supabase") {
      return {
        runs: localRuns,
        source: "local" as const,
        canOperateAgentRuns: true,
      };
    }

    const runs = mergeRuns(data.runs ?? [], localRuns);
    persistLocalAgentRuns(runs);

    return {
      runs,
      source: "supabase" as const,
      canOperateAgentRuns: data.permissions?.canOperateAgentRuns ?? true,
    };
  } catch {
    return {
      runs: localRuns,
      source: "local" as const,
      canOperateAgentRuns: true,
    };
  }
}

export async function loadSyncedAgentRunLogs(runId: string) {
  const localLogs = loadLocalAgentRunLogs(runId);

  try {
    const response = await fetch(`/api/agent-runs/logs?runId=${encodeURIComponent(runId)}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        logs: localLogs,
        source: "local" as const,
      };
    }

    const data = (await response.json()) as AgentRunLogsResponse;

    if (data.source !== "supabase") {
      return {
        logs: localLogs,
        source: "local" as const,
      };
    }

    const logs = mergeLogs(data.logs ?? [], localLogs);
    const otherLogs = loadLocalAgentRunLogs().filter((log) => log.runId !== runId);
    persistLocalAgentRunLogs([...otherLogs, ...logs]);

    return {
      logs,
      source: "supabase" as const,
    };
  } catch {
    return {
      logs: localLogs,
      source: "local" as const,
    };
  }
}

export async function createAgentRunLog(
  runId: string,
  level: AgentRunLogLevel,
  event: string,
  message: string,
  metadata: Record<string, unknown> = {},
) {
  const localLog: AgentRunLog = {
    id: createLocalId("local-log"),
    runId,
    level,
    event,
    message,
    metadata,
    createdAt: new Date().toISOString(),
  };

  persistLocalAgentRunLogs(mergeLogs([localLog], loadLocalAgentRunLogs()));

  if (runId.startsWith("local-run-")) {
    return {
      log: localLog,
      source: "local" as const,
    };
  }

  try {
    const response = await fetch("/api/agent-runs/logs", {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        runId,
        level,
        event,
        message,
        metadata,
      }),
    });

    if (!response.ok) {
      return {
        log: localLog,
        source: "local" as const,
      };
    }

    const data = (await response.json()) as CreateAgentRunLogResponse;

    if (data.source !== "supabase" || !data.log) {
      return {
        log: localLog,
        source: "local" as const,
      };
    }

    persistLocalAgentRunLogs(
      mergeLogs([data.log], loadLocalAgentRunLogs().filter((log) => log.id !== localLog.id)),
    );

    return {
      log: data.log,
      source: "supabase" as const,
    };
  } catch {
    return {
      log: localLog,
      source: "local" as const,
    };
  }
}

export async function createAgentRun(project: SavedProject, target: AgentRunTarget, prompt: string) {
  const localRun: AgentRun = {
    id: createLocalId("local-run"),
    artifactId: project.id,
    projectId: project.id,
    target,
    status: "sent_to_studio",
    prompt,
    inputSnapshot: project.content.slice(0, 12000),
    createdAt: new Date().toISOString(),
    sourceTitle: getProjectObjective(project.content),
  };

  persistLocalAgentRuns(mergeRuns([localRun], loadLocalAgentRuns()));
  void createAgentRunLog(localRun.id, "info", "created", `Execucao criada para ${target}.`);

  try {
    const response = await fetch("/api/agent-runs", {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        artifactId: project.id,
        target,
        prompt,
        inputSnapshot: project.content,
        sourceTitle: getProjectObjective(project.content),
      }),
    });

    if (response.status === 402) {
      const data = (await response.json()) as CreateAgentRunResponse;
      persistLocalAgentRuns(loadLocalAgentRuns().filter((run) => run.id !== localRun.id));
      throw new Error(data.error ?? "Limite do plano atingido.");
    }

    if (!response.ok) {
      return {
        run: localRun,
        source: "local" as const,
      };
    }

    const data = (await response.json()) as CreateAgentRunResponse;

    if (data.source !== "supabase" || !data.run) {
      return {
        run: localRun,
        source: "local" as const,
      };
    }

    persistLocalAgentRuns(mergeRuns([data.run], loadLocalAgentRuns().filter((run) => run.id !== localRun.id)));
    void createAgentRunLog(data.run.id, "info", "created", `Execucao criada para ${target}.`);

    return {
      run: data.run,
      source: "supabase" as const,
    };
  } catch {
    return {
      run: localRun,
      source: "local" as const,
    };
  }
}

export async function updateAgentRunStatus(runId: string, status: AgentRunStatus) {
  const localRuns = loadLocalAgentRuns();
  const localRun = localRuns.find((run) => run.id === runId) ?? null;
  const nextLocalRun = localRun ? { ...localRun, status } : null;

  if (nextLocalRun) {
    persistLocalAgentRuns(mergeRuns([nextLocalRun], localRuns.filter((run) => run.id !== runId)));
  }

  if (runId.startsWith("local-run-")) {
    return {
      run: nextLocalRun,
      source: "local" as const,
    };
  }

  try {
    const response = await fetch(`/api/agent-runs?id=${encodeURIComponent(runId)}`, {
      method: "PATCH",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      return {
        run: nextLocalRun,
        source: "local" as const,
      };
    }

    const data = (await response.json()) as CreateAgentRunResponse;

    if (data.source !== "supabase" || !data.run) {
      return {
        run: nextLocalRun,
        source: "local" as const,
      };
    }

    persistLocalAgentRuns(mergeRuns([data.run], loadLocalAgentRuns().filter((run) => run.id !== runId)));

    return {
      run: data.run,
      source: "supabase" as const,
    };
  } catch {
    return {
      run: nextLocalRun,
      source: "local" as const,
    };
  }
}

export async function executeAgentRun(run: AgentRun) {
  const runningRun: AgentRun = {
    ...run,
    status: "running",
  };

  persistLocalAgentRuns(mergeRuns([runningRun], loadLocalAgentRuns().filter((item) => item.id !== run.id)));
  void createAgentRunLog(run.id, "info", "running", "Execucao iniciada pelo operador.");

  if (!run.id.startsWith("local-run-")) {
    try {
      const response = await fetch("/api/agent-runs/execute", {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
      }),
        body: JSON.stringify({
          runId: run.id,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as ExecuteAgentRunResponse;

        if (data.source === "supabase" && data.run && data.project) {
          persistLocalAgentRuns(mergeRuns([data.run], loadLocalAgentRuns().filter((item) => item.id !== run.id)));
          void createAgentRunLog(data.run.id, "success", "completed", "Artefato derivado criado e vinculado a execucao.", {
            outputArtifactId: data.run.outputArtifactId,
            outputProjectId: data.run.outputProjectId,
          });

          return {
            run: data.run,
            project: data.project,
            source: "supabase" as const,
          };
        }
      }
    } catch {
      // Mantem fallback local abaixo.
    }
  }

  const chatResponse = await fetch("/api/ai/chat", {
    method: "POST",
    headers: getAuthHeaders({
      "Content-Type": "application/json",
      }),
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: run.prompt,
        },
      ],
    }),
  });

  const chatData = (await chatResponse.json()) as { message?: string };
  const content =
    chatData.message ??
    [
      `MODO ESCOLHIDO: ${run.target}`,
      `OBJETIVO INTERPRETADO: Executar transformacao para ${run.target}.`,
      "PLANO OPERACIONAL:",
      "1. Usar o contexto original.",
      "2. Gerar artefato derivado.",
      "3. Salvar resultado para continuidade.",
      "ARTEFATO INICIAL:",
      run.prompt,
      "PROXIMA ACAO: revisar resultado.",
    ].join("\n\n");

  let project: SavedProject | undefined;

  try {
    const projectResponse = await fetch("/api/projects", {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        mode: run.target,
        content,
        originProjectId: run.artifactId ?? run.projectId ?? undefined,
        originProjectMode: run.target,
        originProjectTitle: run.sourceTitle,
      }),
    });

    const projectData = (await projectResponse.json()) as { project?: SavedProject };
    project = projectData.project;
  } catch {
    project = undefined;
  }

  const completedRun: AgentRun = {
    ...runningRun,
    status: project ? "completed" : "failed",
  };

  persistLocalAgentRuns(mergeRuns([completedRun], loadLocalAgentRuns().filter((item) => item.id !== run.id)));
  void createAgentRunLog(
    run.id,
    project ? "success" : "error",
    project ? "completed" : "failed",
    project ? "Artefato derivado criado em fallback local." : "Nao foi possivel salvar o artefato derivado.",
  );

  return {
    run: completedRun,
    project,
    source: "local" as const,
  };
}

export async function processAgentRunQueue(limit = 3) {
  try {
    const response = await fetch("/api/agent-runs/process", {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ limit }),
    });

    if (!response.ok) {
      return {
        processedRuns: [],
        count: 0,
        errors: [],
        source: "local" as const,
      };
    }

    const data = (await response.json()) as ProcessAgentRunQueueResponse;
    const processedRuns = data.processedRuns ?? [];

    if (processedRuns.length > 0) {
      persistLocalAgentRuns(mergeRuns(processedRuns, loadLocalAgentRuns()));
    }

    return {
      processedRuns,
      count: data.count ?? processedRuns.length,
      errors: data.errors ?? [],
      source: data.source === "supabase" ? ("supabase" as const) : ("local" as const),
    };
  } catch {
    return {
      processedRuns: [],
      count: 0,
      errors: [],
      source: "local" as const,
    };
  }
}

export async function cleanupExpiredAgentRunLocks(limit = 10) {
  try {
    const response = await fetch("/api/agent-runs/locks", {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ limit }),
    });

    if (!response.ok) {
      return {
        recoveredRuns: [],
        count: 0,
        errors: [],
        source: "local" as const,
      };
    }

    const data = (await response.json()) as CleanupExpiredLocksResponse;
    const recoveredRuns = data.recoveredRuns ?? [];

    if (recoveredRuns.length > 0) {
      persistLocalAgentRuns(mergeRuns(recoveredRuns, loadLocalAgentRuns()));
    }

    return {
      recoveredRuns,
      count: data.count ?? recoveredRuns.length,
      errors: data.errors ?? [],
      source: data.source === "supabase" ? ("supabase" as const) : ("local" as const),
    };
  } catch {
    return {
      recoveredRuns: [],
      count: 0,
      errors: [],
      source: "local" as const,
    };
  }
}

export function getAgentRunStatusLabel(status: AgentRunStatus) {
  const labels: Record<AgentRunStatus, string> = {
    queued: "na fila",
    sent_to_studio: "enviado ao Studio",
    running: "em execucao",
    completed: "concluido",
    failed: "falhou",
    cancelled: "cancelado",
  };

  return labels[status];
}

export function getAgentRunStatusClasses(status: AgentRunStatus) {
  const classes: Record<AgentRunStatus, string> = {
    queued: "bg-slate-100 text-slate-700",
    sent_to_studio: "bg-blue-50 text-blue-700",
    running: "bg-amber-50 text-amber-700",
    completed: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
    cancelled: "bg-slate-100 text-slate-500",
  };

  return classes[status];
}

export function getAgentRunLogLevelClasses(level: AgentRunLogLevel) {
  const classes: Record<AgentRunLogLevel, string> = {
    info: "border-blue-100 bg-blue-50 text-blue-700",
    success: "border-emerald-100 bg-emerald-50 text-emerald-700",
    warning: "border-amber-100 bg-amber-50 text-amber-700",
    error: "border-red-100 bg-red-50 text-red-700",
  };

  return classes[level];
}










