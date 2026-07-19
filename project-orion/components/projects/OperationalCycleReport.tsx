"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, Printer, RefreshCcw, XCircle } from "lucide-react";

import {
  AgentRunCycle,
  AgentRunLog,
  loadSyncedAgentRunCycle,
  loadSyncedAgentRunCycles,
  loadSyncedAgentRunLogs,
} from "@/components/ai/lib/agent-runs-client";

interface OperationalCycleReportProps {
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

export default function OperationalCycleReport({ cycleId }: OperationalCycleReportProps) {
  const [cycle, setCycle] = useState<AgentRunCycle | null>(null);
  const [source, setSource] = useState<"local" | "supabase">("local");
  const [logs, setLogs] = useState<AgentRunLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    const result = await loadSyncedAgentRunCycle(cycleId);
    let selectedCycle = result.cycle;
    let selectedSource = result.source;

    if (!selectedCycle) {
      const fallback = await loadSyncedAgentRunCycles();
      selectedCycle = fallback.cycles.find((item) => item.id === cycleId) ?? null;
      selectedSource = fallback.source;
    }

    setCycle(selectedCycle);
    setSource(selectedSource);

    if (!selectedCycle) {
      setLogs([]);
      setIsLoading(false);
      return;
    }

    const impactedRuns = getImpactedRuns(selectedCycle.metadata);
    const results = await Promise.all(impactedRuns.map((run) => loadSyncedAgentRunLogs(run.id)));
    setLogs(
      results
        .flatMap((item) => item.logs)
        .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()),
    );
    setIsLoading(false);
  }, [cycleId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadReport();
    });
  }, [loadReport]);

  const impactedRuns = useMemo(() => getImpactedRuns(cycle?.metadata), [cycle]);
  const recoveredRunIds = useMemo(() => getRecoveredRunIds(cycle?.metadata), [cycle]);
  const cycleErrors = useMemo(() => getCycleErrors(cycle?.metadata), [cycle]);
  const logCounts = useMemo(() => {
    return {
      total: logs.length,
      error: logs.filter((log) => log.level === "error").length,
      warning: logs.filter((log) => log.level === "warning").length,
      success: logs.filter((log) => log.level === "success").length,
      info: logs.filter((log) => log.level === "info").length,
    };
  }, [logs]);

  const logsByRun = useMemo(() => {
    const grouped = new Map<string, AgentRunLog[]>();

    logs.forEach((log) => {
      const runLogs = grouped.get(log.runId) ?? [];
      runLogs.push(log);
      grouped.set(log.runId, runLogs);
    });

    return grouped;
  }, [logs]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
        <section className="mx-auto max-w-4xl rounded-2xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-xl font-bold">Carregando relatorio</h1>
          <p className="mt-2 text-sm text-slate-500">Preparando auditoria executiva do ciclo.</p>
        </section>
      </main>
    );
  }

  if (!cycle) {
    return (
      <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
        <section className="mx-auto max-w-4xl rounded-2xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-xl font-bold">Ciclo nao encontrado</h1>
          <Link href="/audit" className="mt-4 inline-flex text-sm font-semibold text-blue-700">
            Voltar para auditoria
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/audit/${encodeURIComponent(cycle.id)}`} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
            <ArrowLeft size={16} />
            Voltar ao ciclo
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadReport()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RefreshCcw size={14} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <Printer size={14} />
              Imprimir / PDF
            </button>
          </div>
        </div>

        <article className="rounded-2xl bg-white p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none">
          <header className="border-b border-slate-200 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">VendIAOS Operational Audit</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Relatorio executivo do ciclo</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{cycle.message}</p>
            <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-500 md:grid-cols-2">
              <p>ID: <span className="break-all text-slate-900">{cycle.id}</span></p>
              <p>Origem: <span className="text-slate-900">{source === "supabase" ? "Supabase" : "Local"}</span></p>
              <p>Modo: <span className="text-slate-900">{cycle.mode}</span></p>
              <p>Criado em: <span className="text-slate-900">{formatDate(cycle.createdAt)}</span></p>
            </div>
          </header>

          <section className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              { label: "Status", value: cycle.status },
              { label: "Execucoes", value: cycle.processCount },
              { label: "Locks limpos", value: cycle.cleanupCount },
              { label: "Logs", value: logCounts.total },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{metric.label}</p>
                <p className="mt-2 text-2xl font-bold">{metric.value}</p>
              </div>
            ))}
          </section>

          <section className="mt-6 rounded-xl border border-slate-200 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500">
              <CheckCircle2 size={16} />
              Resumo operacional
            </h2>
            <div className="mt-4 grid gap-3 text-sm leading-6 md:grid-cols-2">
              <p>Execucoes impactadas: <strong>{impactedRuns.length}</strong></p>
              <p>Locks recuperados: <strong>{recoveredRunIds.length}</strong></p>
              <p>Erros do ciclo: <strong>{cycleErrors.length}</strong></p>
              <p>Ciclo ignorado: <strong>{cycle.skipped ? "Sim" : "Nao"}</strong></p>
              <p>Logs de erro: <strong>{logCounts.error}</strong></p>
              <p>Avisos: <strong>{logCounts.warning}</strong></p>
              <p>Sucessos: <strong>{logCounts.success}</strong></p>
              <p>Informativos: <strong>{logCounts.info}</strong></p>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500">
              <ClipboardList size={16} />
              Execucoes impactadas
            </h2>
            <div className="mt-4 grid gap-3">
              {impactedRuns.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma execucao impactada registrada.</p>
              ) : (
                impactedRuns.map((run) => (
                  <div key={run.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      {run.target && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{run.target}</span>}
                      {run.status && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{run.status}</span>}
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">{logsByRun.get(run.id)?.length ?? 0} log(s)</span>
                    </div>
                    <p className="mt-3 text-sm font-bold">{run.sourceTitle ?? "Execucao de agente VendIAOS"}</p>
                    <p className="mt-1 break-all text-xs text-slate-400">{run.id}</p>
                    {run.lastError && <p className="mt-2 text-xs font-semibold text-red-700">{run.lastError}</p>}
                  </div>
                ))
              )}
            </div>
          </section>

          {cycleErrors.length > 0 && (
            <section className="mt-6 rounded-xl border border-red-100 bg-red-50 p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-red-700">
                <XCircle size={16} />
                Incidentes
              </h2>
              <div className="mt-3 grid gap-2">
                {cycleErrors.map((error, index) => (
                  <p key={`${error.runId ?? "erro"}-${index}`} className="text-sm font-semibold text-red-700">
                    {error.runId ?? "Execucao sem ID"} {error.status ? `- status ${error.status}` : ""}
                  </p>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Linha do tempo resumida</h2>
            <div className="mt-4 grid gap-2">
              {logs.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum log encontrado.</p>
              ) : (
                logs.slice(-20).map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <p className="font-semibold">{formatDate(log.createdAt)} | {log.level} | {log.event}</p>
                    <p className="mt-1 text-slate-600">{log.message}</p>
                    <p className="mt-1 break-all text-xs text-slate-400">{log.runId}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
