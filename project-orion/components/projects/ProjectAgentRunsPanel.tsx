"use client";

import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Clock3, Play, RotateCcw, Wand2, XCircle } from "lucide-react";

import {
  createAgentRunLog,
  getAgentRunStatusClasses,
  executeAgentRun,
  getAgentRunStatusLabel,
  loadSyncedAgentRuns,
  updateAgentRunStatus,
  type AgentRun,
  type AgentRunStatus,
} from "@/components/ai/lib/agent-runs-client";
import { formatProjectDate } from "@/components/projects/project-format";

interface ProjectAgentRunsPanelProps {
  artifactId: string;
}

const STATUS_ACTIONS: Array<{ status: AgentRunStatus; label: string; icon: typeof Play }> = [
  { status: "running", label: "Em execucao", icon: Play },
  { status: "completed", label: "Concluido", icon: CheckCircle2 },
  { status: "failed", label: "Falhou", icon: XCircle },
];

export default function ProjectAgentRunsPanel({ artifactId }: ProjectAgentRunsPanelProps) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [source, setSource] = useState<"local" | "supabase">("local");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(async () => {
      try {
        const result = await loadSyncedAgentRuns(artifactId);

        if (isMounted) {
          setRuns(result.runs.filter((run) => run.artifactId === artifactId || run.projectId === artifactId));
          setSource(result.source);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [artifactId]);

  async function executeRun(run: AgentRun) {
    setRuns((currentRuns) => currentRuns.map((currentRun) => (currentRun.id === run.id ? { ...currentRun, status: "running" } : currentRun)));
    const result = await executeAgentRun(run);

    setRuns((currentRuns) => currentRuns.map((currentRun) => (currentRun.id === run.id ? result.run : currentRun)));
  }

  async function updateStatus(run: AgentRun, status: AgentRunStatus) {
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500">
            <Clock3 size={15} />
            Execucoes dos agentes
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Historico das transformacoes iniciadas a partir deste artefato.
          </p>
        </div>

        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {isLoading ? "carregando" : `${runs.length} execucao(oes)`}
          {source === "supabase" ? " - Supabase" : " - Local"}
        </span>
      </div>

      {isLoading ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Carregando execucoes.</p>
      ) : runs.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
          Nenhuma execucao registrada ainda. Use uma transformacao para iniciar a fila deste artefato.
        </p>
      ) : (
        <div className="mt-5 grid gap-3">
          {runs.slice(0, 8).map((run) => (
            <article key={run.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                      {run.target}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAgentRunStatusClasses(run.status)}`}>
                      {getAgentRunStatusLabel(run.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-800">{formatProjectDate(run.createdAt)}</p>
                  {(run.retryCount || run.nextRetryAt || run.lastError) && (
                    <p className="mt-2 text-xs font-semibold text-amber-700">
                      Tentativas: {run.retryCount ?? 0}/3
                      {run.nextRetryAt ? " - retry agendado" : ""}
                    </p>
                  )}
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{run.prompt}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void executeRun(run)}
                    disabled={run.status === "running"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Wand2 size={14} />
                    Executar agente
                  </button>

                  <button
                    type="button"
                    onClick={() => void retryRun(run)}
                    disabled={run.status === "running"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <RotateCcw size={14} />
                    Reenfileirar
                  </button>

                  <button
                    type="button"
                    onClick={() => void cancelRun(run)}
                    disabled={run.status === "completed" || run.status === "cancelled"}
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
                        onClick={() => updateStatus(run, action.status)}
                        disabled={run.status === action.status}
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
        </div>
      )}
    </section>
  );
}



