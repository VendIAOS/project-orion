"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileText,
  History,
  ListChecks,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";

import {
  AgentRunCycle,
  AgentRunLog,
  AgentRunLogLevel,
  getAgentRunLogLevelClasses,
  loadSyncedAgentRunCycle,
  loadSyncedAgentRunCycles,
  loadSyncedAgentRunLogs,
} from "@/components/ai/lib/agent-runs-client";

interface OperationalCycleDetailProps {
  cycleId: string;
}

interface ImpactedRun {
  id: string;
  target?: string;
  status?: string;
  sourceTitle?: string;
  outputArtifactId?: string;
  outputProjectId?: string;
  lastError?: string;
}

interface CycleError {
  runId?: string;
  status?: number;
}

type TimelineLevelFilter = "todos" | AgentRunLogLevel;

const TIMELINE_LEVEL_FILTERS: TimelineLevelFilter[] = ["todos", "error", "warning", "success", "info"];

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getTimelineLevelLabel(level: TimelineLevelFilter) {
  const labels: Record<TimelineLevelFilter, string> = {
    todos: "Todos",
    error: "Erros",
    warning: "Avisos",
    success: "Sucessos",
    info: "Info",
  };

  return labels[level];
}

function getStatusClasses(status: AgentRunCycle["status"]) {
  const classes: Record<AgentRunCycle["status"], string> = {
    completed: "bg-emerald-50 text-emerald-700",
    skipped: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
  };

  return classes[status];
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getImpactedRuns(metadata?: Record<string, unknown>) {
  const rawRuns = metadata?.processedRuns;

  if (!Array.isArray(rawRuns)) {
    return [];
  }

  const impactedRuns: ImpactedRun[] = [];

  rawRuns.forEach((item) => {
    const record = asRecord(item);
    const id = getString(record?.id);

    if (!id) {
      return;
    }

    impactedRuns.push({
      id,
      target: getString(record?.target),
      status: getString(record?.status),
      sourceTitle: getString(record?.sourceTitle),
      outputArtifactId: getString(record?.outputArtifactId),
      outputProjectId: getString(record?.outputProjectId),
      lastError: getString(record?.lastError),
    });
  });

  return impactedRuns;
}

function getRecoveredRunIds(metadata?: Record<string, unknown>) {
  const rawIds = metadata?.recoveredRunIds;
  return Array.isArray(rawIds) ? rawIds.filter((item): item is string => typeof item === "string") : [];
}

function getCycleErrors(metadata?: Record<string, unknown>) {
  const rawErrors = metadata?.errors;

  if (!Array.isArray(rawErrors)) {
    return [];
  }

  return rawErrors
    .map((item) => {
      const record = asRecord(item);
      return {
        runId: getString(record?.runId),
        status: typeof record?.status === "number" ? record.status : undefined,
      };
    })
    .filter((item) => item.runId || item.status) as CycleError[];
}

export default function OperationalCycleDetail({ cycleId }: OperationalCycleDetailProps) {
  const [cycle, setCycle] = useState<AgentRunCycle | null>(null);
  const [source, setSource] = useState<"local" | "supabase">("local");
  const [isLoading, setIsLoading] = useState(true);
  const [cycleTimelineLogs, setCycleTimelineLogs] = useState<AgentRunLog[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [timelineLevelFilter, setTimelineLevelFilter] = useState<TimelineLevelFilter>("todos");
  const [timelineQuery, setTimelineQuery] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  const refreshCycle = useCallback(async () => {
    setIsLoading(true);
    const result = await loadSyncedAgentRunCycle(cycleId);

    if (result.cycle) {
      setCycle(result.cycle);
      setSource(result.source);
      setIsLoading(false);
      return;
    }

    const fallback = await loadSyncedAgentRunCycles();
    setCycle(fallback.cycles.find((item) => item.id === cycleId) ?? null);
    setSource(fallback.source);
    setIsLoading(false);
  }, [cycleId]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshCycle();
    });
  }, [refreshCycle]);

  const impactedRuns = useMemo(() => getImpactedRuns(cycle?.metadata), [cycle]);
  const impactedRunIds = useMemo(() => impactedRuns.map((run) => run.id), [impactedRuns]);
  const recoveredRunIds = useMemo(() => getRecoveredRunIds(cycle?.metadata), [cycle]);
  const cycleErrors = useMemo(() => getCycleErrors(cycle?.metadata), [cycle]);
  const metadataEntries = useMemo(() => (cycle?.metadata ? Object.entries(cycle.metadata) : []), [cycle]);

  const refreshTimelineLogs = useCallback(async () => {
    if (impactedRunIds.length === 0) {
      setCycleTimelineLogs([]);
      return;
    }

    setIsLoadingTimeline(true);
    const results = await Promise.all(impactedRunIds.map((runId) => loadSyncedAgentRunLogs(runId)));
    const logs = results
      .flatMap((result) => result.logs)
      .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());

    setCycleTimelineLogs(logs);
    setIsLoadingTimeline(false);
  }, [impactedRunIds]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshTimelineLogs();
    });
  }, [refreshTimelineLogs]);

  const filteredTimelineLogs = useMemo(() => {
    const cleanQuery = timelineQuery.trim().toLowerCase();

    return cycleTimelineLogs.filter((log) => {
      const matchesLevel = timelineLevelFilter === "todos" || log.level === timelineLevelFilter;

      if (!matchesLevel) {
        return false;
      }

      if (!cleanQuery) {
        return true;
      }

      const run = impactedRuns.find((item) => item.id === log.runId);
      const searchable = [
        log.runId,
        log.level,
        log.event,
        log.message,
        run?.target,
        run?.status,
        run?.sourceTitle,
        run?.lastError,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(cleanQuery);
    });
  }, [cycleTimelineLogs, impactedRuns, timelineLevelFilter, timelineQuery]);

  const timelineLevelCounts = useMemo(() => {
    return {
      todos: cycleTimelineLogs.length,
      error: cycleTimelineLogs.filter((log) => log.level === "error").length,
      warning: cycleTimelineLogs.filter((log) => log.level === "warning").length,
      success: cycleTimelineLogs.filter((log) => log.level === "success").length,
      info: cycleTimelineLogs.filter((log) => log.level === "info").length,
    };
  }, [cycleTimelineLogs]);

  const cycleTimelineGroups = useMemo(() => {
    const logsByRunId = new Map<string, AgentRunLog[]>();

    filteredTimelineLogs.forEach((log) => {
      const logs = logsByRunId.get(log.runId) ?? [];
      logs.push(log);
      logsByRunId.set(log.runId, logs);
    });

    return impactedRunIds
      .map((runId) => ({
        runId,
        run: impactedRuns.find((run) => run.id === runId),
        logs: logsByRunId.get(runId) ?? [],
      }))
      .filter((group) => group.logs.length > 0);
  }, [filteredTimelineLogs, impactedRunIds, impactedRuns]);

  const cycleAuditMarkdown = useMemo(() => {
    if (!cycle) {
      return "";
    }

    const allLogsByRunId = new Map<string, AgentRunLog[]>();

    cycleTimelineLogs.forEach((log) => {
      const logs = allLogsByRunId.get(log.runId) ?? [];
      logs.push(log);
      allLogsByRunId.set(log.runId, logs);
    });

    const lines = [
      `# Auditoria do ciclo VendIAOS`,
      "",
      `- ID: ${cycle.id}`,
      `- Modo: ${cycle.mode}`,
      `- Status: ${cycle.status}`,
      `- Origem: ${source === "supabase" ? "Supabase" : "Local"}`,
      `- Criado em: ${formatDate(cycle.createdAt)}`,
      `- Locks limpos: ${cycle.cleanupCount}`,
      `- Execucoes processadas: ${cycle.processCount}`,
      `- Ciclo ignorado: ${cycle.skipped ? "Sim" : "Nao"}`,
      "",
      `## Mensagem`,
      "",
      cycle.message,
      "",
      `## Execucoes impactadas`,
      "",
    ];

    if (impactedRuns.length === 0) {
      lines.push("Nenhuma execucao impactada registrada.", "");
    } else {
      impactedRuns.forEach((run) => {
        lines.push(`### ${run.sourceTitle ?? "Execucao de agente VendIAOS"}`);
        lines.push(`- ID: ${run.id}`);
        if (run.target) lines.push(`- Alvo: ${run.target}`);
        if (run.status) lines.push(`- Status: ${run.status}`);
        if (run.outputProjectId) lines.push(`- Projeto gerado: ${run.outputProjectId}`);
        if (run.outputArtifactId) lines.push(`- Artefato gerado: ${run.outputArtifactId}`);
        if (run.lastError) lines.push(`- Ultimo erro: ${run.lastError}`);
        lines.push("");
      });
    }

    if (recoveredRunIds.length > 0) {
      lines.push("## Locks recuperados", "");
      recoveredRunIds.forEach((runId) => lines.push(`- ${runId}`));
      lines.push("");
    }

    if (cycleErrors.length > 0) {
      lines.push("## Erros do ciclo", "");
      cycleErrors.forEach((error) => {
        lines.push(`- ${error.runId ?? "Execucao sem ID"}${error.status ? ` - status ${error.status}` : ""}`);
      });
      lines.push("");
    }

    lines.push("## Linha do tempo completa", "");

    if (cycleTimelineLogs.length === 0) {
      lines.push("Nenhum log encontrado para as execucoes deste ciclo.", "");
    } else {
      impactedRunIds.forEach((runId) => {
        const run = impactedRuns.find((item) => item.id === runId);
        const logs = allLogsByRunId.get(runId) ?? [];

        if (logs.length === 0) {
          return;
        }

        lines.push(`### ${run?.sourceTitle ?? "Execucao de agente VendIAOS"}`);
        lines.push(`- ID: ${runId}`);
        if (run?.target) lines.push(`- Alvo: ${run.target}`);
        if (run?.status) lines.push(`- Status: ${run.status}`);
        lines.push("");

        logs.forEach((log) => {
          lines.push(`- ${formatDate(log.createdAt)} | ${log.level} | ${log.event}: ${log.message}`);
        });

        lines.push("");
      });
    }

    if (metadataEntries.length > 0) {
      lines.push("## Metadata", "");
      lines.push("```json");
      lines.push(JSON.stringify(cycle.metadata ?? {}, null, 2));
      lines.push("```");
      lines.push("");
    }

    return lines.join("\n").trim();
  }, [
    cycle,
    cycleErrors,
    cycleTimelineLogs,
    impactedRunIds,
    impactedRuns,
    metadataEntries,
    recoveredRunIds,
    source,
  ]);

  async function copyAuditMarkdown() {
    if (!cycleAuditMarkdown) {
      return;
    }

    await navigator.clipboard.writeText(cycleAuditMarkdown);
    setExportMessage("Auditoria copiada em Markdown.");
  }

  function downloadAuditMarkdown() {
    if (!cycleAuditMarkdown || !cycle) {
      return;
    }

    const blob = new Blob([cycleAuditMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vendiaos-auditoria-${cycle.id}.md`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    setExportMessage("Arquivo Markdown gerado.");
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Carregando ciclo</h1>
          <p className="mt-2 text-sm text-slate-500">Buscando auditoria operacional persistida.</p>
        </section>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Link href="/audit" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-700">
          <ArrowLeft size={16} />
          Voltar para auditoria
        </Link>

        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Ciclo nao encontrado</h1>
          <p className="mt-2 text-sm text-slate-500">Ele pode ainda estar somente em outro navegador ou ter sido removido da auditoria.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link href="/audit" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-700">
        <ArrowLeft size={16} />
        Voltar para auditoria
      </Link>

      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-4 flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <History size={14} />
              {cycle.mode === "automatic" ? "Automatico" : "Manual"}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Ciclo operacional</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{cycle.message}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(cycle.status)}`}>
                {cycle.status}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {source === "supabase" ? "Supabase" : "Local"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyAuditMarkdown()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Copy size={14} />
              Copiar Markdown
            </button>
            <button
              type="button"
              onClick={downloadAuditMarkdown}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Download size={14} />
              Baixar .md
            </button>
            <Link
              href={`/audit/${encodeURIComponent(cycle.id)}/report`}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              <FileText size={14} />
              Relatorio
            </Link>
            <button
              type="button"
              onClick={() => void refreshCycle()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <RefreshCcw size={14} />
              Atualizar
            </button>
          </div>
        </div>
        {exportMessage && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{exportMessage}</p>}
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Locks limpos", value: cycle.cleanupCount, icon: RefreshCcw, tone: "bg-amber-50 text-amber-700" },
          { label: "Execucoes", value: cycle.processCount, icon: ClipboardList, tone: "bg-blue-50 text-blue-700" },
          { label: "Ignorado", value: cycle.skipped ? "Sim" : "Nao", icon: XCircle, tone: "bg-slate-100 text-slate-700" },
          { label: "Criado em", value: formatDate(cycle.createdAt), icon: CalendarClock, tone: "bg-emerald-50 text-emerald-700" },
        ].map((metric) => {
          const Icon = metric.icon;

          return (
            <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${metric.tone}`}>
                <Icon size={17} />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{metric.label}</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{metric.value}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500">
          <CheckCircle2 size={15} />
          Resumo do ciclo
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">ID</p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-900">{cycle.id}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Modo</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{cycle.mode}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Mensagem</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{cycle.message}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500">
            <ClipboardList size={15} />
            Execucoes impactadas
          </h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
            {impactedRuns.length} processada(s), {recoveredRunIds.length} recuperada(s), {cycleErrors.length} erro(s)
          </span>
        </div>

        {impactedRuns.length === 0 && recoveredRunIds.length === 0 && cycleErrors.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Este ciclo foi criado antes da rastreabilidade detalhada ou nao processou nenhuma execucao.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {impactedRuns.map((run) => (
              <article key={run.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      {run.target && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{run.target}</span>}
                      {run.status && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{run.status}</span>}
                    </div>
                    <p className="mt-2 break-words text-sm font-semibold text-slate-900">{run.sourceTitle ?? "Execucao de agente VendIAOS"}</p>
                    <p className="mt-1 break-all text-xs font-medium text-slate-400">{run.id}</p>
                    {run.lastError && <p className="mt-2 text-xs font-semibold text-red-700">{run.lastError}</p>}
                  </div>
                  <Link
                    href={`/executions/${encodeURIComponent(run.id)}`}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    <ExternalLink size={14} />
                    Abrir execucao
                  </Link>
                </div>
              </article>
            ))}

            {recoveredRunIds.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Locks recuperados</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recoveredRunIds.map((runId) => (
                    <Link
                      key={runId}
                      href={`/executions/${encodeURIComponent(runId)}`}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      {runId}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {cycleErrors.length > 0 && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red-700">
                  <AlertTriangle size={14} />
                  Erros do ciclo
                </p>
                <div className="mt-3 grid gap-2">
                  {cycleErrors.map((error, index) => (
                    <p key={`${error.runId ?? "erro"}-${index}`} className="text-xs font-semibold text-red-700">
                      {error.runId ?? "Execucao sem ID"} {error.status ? `- status ${error.status}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500">
            <ListChecks size={15} />
            Linha do tempo do ciclo
          </h2>
          <button
            type="button"
            onClick={() => void refreshTimelineLogs()}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCcw size={13} />
            Atualizar logs
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
          <Search size={18} className="text-slate-400" />
          <input
            value={timelineQuery}
            onChange={(event) => setTimelineQuery(event.target.value)}
            placeholder="Buscar por evento, mensagem, execucao, alvo ou titulo..."
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {TIMELINE_LEVEL_FILTERS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setTimelineLevelFilter(level)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                timelineLevelFilter === level
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {getTimelineLevelLabel(level)} ({timelineLevelCounts[level]})
            </button>
          ))}
        </div>

        {isLoadingTimeline ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Carregando logs das execucoes impactadas.</p>
        ) : cycleTimelineGroups.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Nenhum log encontrado para os filtros atuais. Ajuste a busca ou o nivel selecionado.
          </p>
        ) : (
          <div className="mt-4 grid gap-4">
            {cycleTimelineGroups.map((group) => (
              <article key={group.runId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      {group.run?.target && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {group.run.target}
                        </span>
                      )}
                      {group.run?.status && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {group.run.status}
                        </span>
                      )}
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                        {group.logs.length} log(s)
                      </span>
                    </div>
                    <p className="mt-2 break-words text-sm font-semibold text-slate-900">
                      {group.run?.sourceTitle ?? "Execucao de agente VendIAOS"}
                    </p>
                    <p className="mt-1 break-all text-xs font-medium text-slate-400">{group.runId}</p>
                  </div>
                  <Link
                    href={`/executions/${encodeURIComponent(group.runId)}`}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    <ExternalLink size={14} />
                    Abrir execucao
                  </Link>
                </div>

                <div className="mt-4 grid gap-2">
                  {group.logs.map((log) => (
                    <div key={log.id} className={`rounded-xl border p-3 ${getAgentRunLogLevelClasses(log.level)}`}>
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">{log.level}</span>
                            <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">{log.event}</span>
                          </div>
                          <p className="mt-3 text-sm font-semibold">{log.message}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold opacity-80">{formatDate(log.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500">
          <Database size={15} />
          Metadata
        </h2>
        {metadataEntries.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum metadata registrado para este ciclo.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {metadataEntries.map(([key, value]) => (
              <div key={key} className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{key}</p>
                <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}





