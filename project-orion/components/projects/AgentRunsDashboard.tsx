"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Clock3, CreditCard, ExternalLink, History, Play, RotateCcw, Trash2, Wand2, RefreshCcw, Search, XCircle } from "lucide-react";

import {
  cleanupExpiredAgentRunLocks,
  createAgentRunCycle,
  createAgentRunLog,
  getAgentRunStatusClasses,
  executeAgentRun,
  getAgentRunStatusLabel,
  loadSyncedAgentRunCycles,
  loadSyncedAgentRuns,
  processAgentRunQueue,
  updateAgentRunStatus,
  type AgentRun,
  type AgentRunStatus,
  type AgentRunTarget,
} from "@/components/ai/lib/agent-runs-client";
import { getAuthHeaders } from "@/components/auth/auth-fetch";
import OperationalContextPanel from "@/components/auth/OperationalContextPanel";
import { formatProjectDate } from "@/components/projects/project-format";
import AgentQueueHealthPanel from "./AgentQueueHealthPanel";

const TARGET_FILTERS: Array<"todos" | AgentRunTarget> = ["todos", "campanha", "video", "imagem", "avatar", "analise", "funil"];
const STATUS_FILTERS: Array<"todos" | AgentRunStatus> = ["todos", "queued", "sent_to_studio", "running", "completed", "failed", "cancelled"];

const STATUS_ACTIONS: Array<{ status: AgentRunStatus; label: string; icon: typeof Play }> = [
  { status: "running", label: "Em execucao", icon: Play },
  { status: "completed", label: "Concluido", icon: CheckCircle2 },
  { status: "failed", label: "Falhou", icon: XCircle },
];

const AUTO_PROCESS_KEY = "vendiaos.agent-runs.auto-process";
const CYCLE_HISTORY_KEY = "vendiaos.agent-runs.cycle-history";
const AUTO_PROCESS_INTERVAL_MS = 60000;

interface QueueCycleHistoryItem {
  id: string;
  mode: "manual" | "automatic";
  cleanupCount: number;
  processCount: number;
  skipped: boolean;
  status: "completed" | "skipped" | "failed";
  createdAt: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface BillingUsageMetric {
  used: number;
  limit: number;
  percent: number;
}

interface BillingOverviewResponse {
  billing?: {
    planName: string;
    status: string;
    priceLabel: string;
  };
  usage?: {
    agentRuns: BillingUsageMetric;
  };
}

function getStatusFilterLabel(status: "todos" | AgentRunStatus) {
  return status === "todos" ? "Todos" : getAgentRunStatusLabel(status);
}

function createCycleId() {
  return `cycle-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadCycleHistory() {
  try {
    const raw = window.localStorage.getItem(CYCLE_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as QueueCycleHistoryItem[]) : [];
  } catch {
    window.localStorage.removeItem(CYCLE_HISTORY_KEY);
    return [];
  }
}

function formatRetryDate(value?: string) {
  if (!value) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getBillingAlert(metric?: BillingUsageMetric) {
  if (!metric) {
    return null;
  }

  if (metric.percent >= 100) {
    return {
      tone: "border-red-200 bg-red-50 text-red-700",
      title: "Cota de execucoes esgotada",
      description: "A criacao de novas execucoes esta bloqueada ate renovar o periodo ou alterar o plano.",
    };
  }

  if (metric.percent >= 80) {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      title: "Cota perto do limite",
      description: "Revise a fila antes de processar em escala para evitar bloqueios durante a operacao.",
    };
  }

  return {
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    title: "Cota operacional saudavel",
    description: "O workspace ainda tem margem para novas execucoes de agentes neste periodo.",
  };
}

export default function AgentRunsDashboard() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [source, setSource] = useState<"local" | "supabase">("local");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [targetFilter, setTargetFilter] = useState<"todos" | AgentRunTarget>("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | AgentRunStatus>("todos");
  const [queueMessage, setQueueMessage] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [autoProcess, setAutoProcess] = useState(false);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [lastProcessedAt, setLastProcessedAt] = useState<string | null>(null);
  const [cycleHistory, setCycleHistory] = useState<QueueCycleHistoryItem[]>([]);
  const [billingOverview, setBillingOverview] = useState<BillingOverviewResponse | null>(null);
  const [canOperateAgentRuns, setCanOperateAgentRuns] = useState(true);
  const autoProcessLockRef = useRef(false);

  const refreshRuns = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setHasLoaded(false);
    }

    const [result, billingResponse] = await Promise.all([
      loadSyncedAgentRuns(),
      fetch("/api/billing/overview", {
        headers: getAuthHeaders(),
        cache: "no-store",
      }),
    ]);
    setRuns(result.runs);
    setSource(result.source);
    setCanOperateAgentRuns(result.canOperateAgentRuns);
    if (billingResponse.ok) {
      setBillingOverview((await billingResponse.json()) as BillingOverviewResponse);
    }
    setHasLoaded(true);
    setLastSyncedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshRuns();
    });
  }, [refreshRuns]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshRuns({ silent: true });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [autoRefresh, refreshRuns]);

  useEffect(() => {
    queueMicrotask(async () => {
      setAutoProcess(window.localStorage.getItem(AUTO_PROCESS_KEY) === "true");
      const syncedCycles = await loadSyncedAgentRunCycles();
      setCycleHistory(syncedCycles.cycles.length > 0 ? syncedCycles.cycles : loadCycleHistory());
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(AUTO_PROCESS_KEY, String(autoProcess));
  }, [autoProcess]);

  useEffect(() => {
    window.localStorage.setItem(CYCLE_HISTORY_KEY, JSON.stringify(cycleHistory.slice(0, 12)));
  }, [cycleHistory]);

  function addCycleHistory(item: Omit<QueueCycleHistoryItem, "id" | "createdAt">) {
    const cycle = {
      id: createCycleId(),
      createdAt: new Date().toISOString(),
      ...item,
    };

    setCycleHistory((current) => [cycle, ...current].slice(0, 12));
    void createAgentRunCycle(item);
  }

  const filteredRuns = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return runs.filter((run) => {
      const matchesTarget = targetFilter === "todos" || run.target === targetFilter;
      const matchesStatus = statusFilter === "todos" || run.status === statusFilter;
      const matchesQuery =
        !cleanQuery ||
        `${run.target} ${run.status} ${run.sourceTitle ?? ""} ${run.prompt}`.toLowerCase().includes(cleanQuery);

      return matchesTarget && matchesStatus && matchesQuery;
    });
  }, [query, runs, statusFilter, targetFilter]);

  const billingAlert = getBillingAlert(billingOverview?.usage?.agentRuns);
  const hasReachedAgentRunLimit = Boolean(billingOverview?.usage?.agentRuns && billingOverview.usage.agentRuns.percent >= 100);
  const cannotOperateQueue = !canOperateAgentRuns;

  async function cleanupLocks() {
    if (cannotOperateQueue) {
      setQueueMessage("Seu usuario pode acompanhar a fila, mas apenas owner/admin pode limpar travas.");
      return;
    }

    setQueueMessage("Limpando execucoes travadas...");
    const result = await cleanupExpiredAgentRunLocks(10);
    const refreshed = await loadSyncedAgentRuns();

    setRuns(refreshed.runs);
    setSource(refreshed.source);
    setLastSyncedAt(new Date().toISOString());
    setQueueMessage(`${result.count} execucao(oes) recuperada(s) de lock expirado.`);
  }

  const runQueueCycle = useCallback(async (options?: { automatic?: boolean }) => {
    if (autoProcessLockRef.current) {
      addCycleHistory({
        mode: options?.automatic ? "automatic" : "manual",
        cleanupCount: 0,
        processCount: 0,
        skipped: true,
        status: "skipped",
        message: "Ciclo ignorado porque outro ciclo ainda estava em andamento.",
        metadata: {
          reason: "cycle_already_running",
        },
      });

      return {
        cleanupCount: 0,
        processCount: 0,
        skipped: true,
      };
    }

    if (cannotOperateQueue) {
      setQueueMessage("Seu usuario pode acompanhar a fila, mas apenas owner/admin pode processar execucoes.");

      return {
        cleanupCount: 0,
        processCount: 0,
        skipped: true,
      };
    }

    autoProcessLockRef.current = true;

    if (options?.automatic) {
      setIsAutoProcessing(true);
    } else {
      setQueueMessage("Processando fila...");
    }

    try {
      const cleanupResult = await cleanupExpiredAgentRunLocks(10);
      const result = await processAgentRunQueue(3);
      const refreshed = await loadSyncedAgentRuns();
      const now = new Date().toISOString();

      setRuns(refreshed.runs);
      setSource(refreshed.source);
      setLastSyncedAt(now);
      setLastProcessedAt(now);

      const message = options?.automatic
        ? `${cleanupResult.count} lock(s) limpo(s). ${result.count} execucao(oes) processada(s) automaticamente.`
        : `${cleanupResult.count} lock(s) limpo(s). ${result.count} execucao(oes) processada(s).`;

      setQueueMessage(message);
      addCycleHistory({
        mode: options?.automatic ? "automatic" : "manual",
        cleanupCount: cleanupResult.count,
        processCount: result.count,
        skipped: false,
        status: "completed",
        message,
        metadata: {
          recoveredRunIds: cleanupResult.recoveredRuns.map((run) => run.id),
          processedRuns: result.processedRuns.map((run) => ({
            id: run.id,
            target: run.target,
            status: run.status,
            sourceTitle: run.sourceTitle,
            outputArtifactId: run.outputArtifactId,
            outputProjectId: run.outputProjectId,
            lastError: run.lastError,
          })),
          errors: result.errors,
        },
      });

      return {
        cleanupCount: cleanupResult.count,
        processCount: result.count,
        skipped: false,
      };
    } catch (error) {
      const message = "Ciclo operacional falhou antes de concluir.";
      setQueueMessage(message);
      addCycleHistory({
        mode: options?.automatic ? "automatic" : "manual",
        cleanupCount: 0,
        processCount: 0,
        skipped: false,
        status: "failed",
        message: `${message} ${String(error)}`,
        metadata: {
          error: String(error),
        },
      });

      return {
        cleanupCount: 0,
        processCount: 0,
        skipped: false,
      };
    } finally {
      autoProcessLockRef.current = false;
      setIsAutoProcessing(false);
    }
  }, [cannotOperateQueue]);

  useEffect(() => {
    if (!autoProcess) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void runQueueCycle({ automatic: true });
    }, AUTO_PROCESS_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [autoProcess, runQueueCycle]);

  async function processQueue() {
    await runQueueCycle();
  }

  async function executeRun(run: AgentRun) {
    if (cannotOperateQueue) {
      setQueueMessage("Seu usuario pode acompanhar a execucao, mas apenas owner/admin pode executar agentes.");
      return;
    }

    setRuns((currentRuns) => currentRuns.map((currentRun) => (currentRun.id === run.id ? { ...currentRun, status: "running" } : currentRun)));
    const result = await executeAgentRun(run);

    setRuns((currentRuns) => currentRuns.map((currentRun) => (currentRun.id === run.id ? result.run : currentRun)));
  }

  async function updateStatus(run: AgentRun, status: AgentRunStatus) {
    if (cannotOperateQueue) {
      setQueueMessage("Seu usuario pode acompanhar a execucao, mas apenas owner/admin pode alterar status.");
      return;
    }

    const result = await updateAgentRunStatus(run.id, status);

    if (!result.run) {
      return;
    }

    setRuns((currentRuns) => currentRuns.map((currentRun) => (currentRun.id === run.id ? result.run! : currentRun)));
    setSource(result.source);
  }

  async function retryRun(run: AgentRun) {
    await createAgentRunLog(run.id, "warning", "requeued", "Execucao reenfileirada pelo operador.");
    await updateStatus(run, "sent_to_studio");
  }

  async function cancelRun(run: AgentRun) {
    await createAgentRunLog(run.id, "warning", "cancelled", "Execucao cancelada pelo operador.");
    await updateStatus(run, "cancelled");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            <Clock3 size={16} />
            Operacoes
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Execucoes dos agentes</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Acompanhe transformacoes enviadas pelo VendIAOS e controle o status operacional dos agentes.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-900">{hasLoaded ? runs.length : "..."}</span> execucoes
          <span className="ml-3 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
            {source === "supabase" ? "Supabase" : "Local"}
          </span>
        </div>
      </header>

      <OperationalContextPanel source={source} />

      {billingAlert && (
        <section className={`flex flex-col gap-3 rounded-2xl border px-5 py-4 md:flex-row md:items-center md:justify-between ${billingAlert.tone}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} />
            <div>
              <h2 className="text-sm font-bold">{billingAlert.title}</h2>
              <p className="mt-1 text-sm font-semibold opacity-90">{billingAlert.description}</p>
              {billingOverview?.usage?.agentRuns && (
                <p className="mt-2 text-xs font-bold">
                  {billingOverview.usage.agentRuns.used} de {billingOverview.usage.agentRuns.limit} execucoes usadas
                  {billingOverview.billing ? ` no plano ${billingOverview.billing.planName}` : ""}.
                </p>
              )}
            </div>
          </div>
          <Link
            href="/billing"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            <CreditCard size={14} />
            Ver financeiro
          </Link>
        </section>
      )}

      {source === "supabase" && cannotOperateQueue && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          <AlertTriangle size={20} />
          <div>
            <h2 className="font-bold">Permissao operacional limitada</h2>
            <p className="mt-1">
              Seu acesso permite acompanhar execucoes e auditoria. Processar fila, limpar travas, executar agentes e alterar status fica reservado para owner/admin.
            </p>
          </div>
        </section>
      )}

      <AgentQueueHealthPanel />

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <Search size={18} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por agente, prompt, status..."
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          <button
            type="button"
            onClick={() => void cleanupLocks()}
            disabled={cannotOperateQueue}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <Clock3 size={14} />
            {cannotOperateQueue ? "Sem permissao" : "Limpar travadas"}
          </button>

          <button
            type="button"
            onClick={() => void processQueue()}
            disabled={hasReachedAgentRunLimit || cannotOperateQueue}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Wand2 size={14} />
            {cannotOperateQueue ? "Sem permissao" : hasReachedAgentRunLimit ? "Cota esgotada" : "Processar fila"}
          </button>

          <button
            type="button"
            onClick={() => void refreshRuns()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            <RefreshCcw size={14} />
            Atualizar
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">
            Sincronizacao automatica:{" "}
            <span className={autoRefresh ? "text-emerald-700" : "text-slate-700"}>
              {autoRefresh ? "ativa a cada 15s" : "pausada"}
            </span>
            {lastSyncedAt && <span className="ml-2 text-slate-400">Ultima: {formatRetryDate(lastSyncedAt)}</span>}
          </div>
          <button
            type="button"
            onClick={() => setAutoRefresh((current) => !current)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {autoRefresh ? "Pausar auto" : "Ativar auto"}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="text-xs font-semibold text-blue-700">
            Modo operacional:{" "}
            <span className={autoProcess ? "text-emerald-700" : "text-slate-700"}>
              {autoProcess ? "processando a cada 60s" : "manual"}
            </span>
            {lastProcessedAt && <span className="ml-2 text-blue-400">Ultimo ciclo: {formatRetryDate(lastProcessedAt)}</span>}
            {isAutoProcessing && <span className="ml-2 text-amber-700">Rodando ciclo...</span>}
          </div>
          <button
            type="button"
            onClick={() => setAutoProcess((current) => !current)}
            disabled={(hasReachedAgentRunLimit || cannotOperateQueue) && !autoProcess}
            className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            {autoProcess ? "Pausar operacional" : cannotOperateQueue ? "Sem permissao" : "Ativar operacional"}
          </button>
        </div>

        {cycleHistory.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <History size={16} />
                Historico dos ciclos
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">Supabase quando disponivel</span>
              </div>
              <button
                type="button"
                onClick={() => setCycleHistory([])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Trash2 size={13} />
                Limpar historico
              </button>
            </div>
            <div className="grid gap-2">
              {cycleHistory.slice(0, 5).map((cycle) => (
                <article key={cycle.id} className="grid gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <span className={`rounded-full px-2.5 py-1 font-semibold ${
                    cycle.status === "completed"
                      ? "bg-emerald-50 text-emerald-700"
                      : cycle.status === "skipped"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-red-50 text-red-700"
                  }`}>
                    {cycle.mode === "automatic" ? "Automatico" : "Manual"}
                  </span>
                  <span className="leading-5">
                    {cycle.cleanupCount} lock(s), {cycle.processCount} execucao(oes). {cycle.message}
                  </span>
                  <span className="font-semibold text-slate-400">{formatRetryDate(cycle.createdAt)}</span>
                </article>
              ))}
            </div>
          </section>
        )}

        {queueMessage && (
          <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">{queueMessage}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {TARGET_FILTERS.map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => setTargetFilter(target)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${
                targetFilter === target ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {target}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                statusFilter === status ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {getStatusFilterLabel(status)}
            </button>
          ))}
        </div>
      </section>

      {hasLoaded && runs.length > 0 && (
        <p className="text-sm text-slate-500">
          Exibindo <span className="font-semibold text-slate-800">{filteredRuns.length}</span> de{" "}
          <span className="font-semibold text-slate-800">{runs.length}</span> execucao(oes).
        </p>
      )}

      {!hasLoaded ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">Carregando execucoes</h2>
          <p className="mt-2 text-sm text-slate-500">Buscando fila local e registros do Supabase.</p>
        </section>
      ) : filteredRuns.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">Nenhuma execucao encontrada</h2>
          <p className="mt-2 text-sm text-slate-500">
            Inicie uma transformacao em Projetos para alimentar esta fila.
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {filteredRuns.map((run) => (
            <article key={run.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                      {run.target}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAgentRunStatusClasses(run.status)}`}>
                      {getAgentRunStatusLabel(run.status)}
                    </span>
                  </div>

                  <h2 className="mt-3 line-clamp-2 text-lg font-semibold text-slate-900">
                    {run.sourceTitle ?? "Execucao de agente VendIAOS"}
                  </h2>
                  <p className="mt-2 text-xs font-medium text-slate-400">{formatProjectDate(run.createdAt)}</p>
                  {(run.retryCount || run.nextRetryAt || run.lastError) && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                        Tentativas: {run.retryCount ?? 0}/3
                      </span>
                      {run.nextRetryAt && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                          Proxima: {formatRetryDate(run.nextRetryAt)}
                        </span>
                      )}
                      {run.lastError && (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                          Ultimo erro registrado
                        </span>
                      )}
                    </div>
                  )}
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{run.prompt}</p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {run.artifactId && (
                    <Link
                      href={`/executions/${encodeURIComponent(run.id)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                    >
                      <ExternalLink size={14} />
                      Ver execucao
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => void executeRun(run)}
                    disabled={run.status === "running" || cannotOperateQueue}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Wand2 size={14} />
                    {cannotOperateQueue ? "Sem permissao" : "Executar agente"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void retryRun(run)}
                    disabled={run.status === "running" || cannotOperateQueue}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <RotateCcw size={14} />
                    Reenfileirar
                  </button>

                  <button
                    type="button"
                    onClick={() => void cancelRun(run)}
                    disabled={run.status === "completed" || run.status === "cancelled" || cannotOperateQueue}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <Ban size={14} />
                    Cancelar
                  </button>

                  {STATUS_ACTIONS.map((action) => {
                    const Icon = action.icon;

                    return (
                      <button
                        key={action.status}
                        type="button"
                        onClick={() => void updateStatus(run, action.status)}
                        disabled={run.status === action.status || cannotOperateQueue}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <Icon size={14} />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}












