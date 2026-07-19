"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, Clock3, ExternalLink, Play, RotateCcw, Wand2, XCircle } from "lucide-react";

import {
  createAgentRunLog,
  executeAgentRun,
  getAgentRunStatusClasses,
  getAgentRunStatusLabel,
  loadSyncedAgentRuns,
  updateAgentRunStatus,
  type AgentRun,
  type AgentRunStatus,
} from "@/components/ai/lib/agent-runs-client";
import { loadSyncedProjects, type SavedProject } from "@/components/ai/lib/projects-client";
import { formatProjectDate, getProjectObjective } from "@/components/projects/project-format";
import AgentRunLogsTimeline from "./AgentRunLogsTimeline";

interface AgentRunDetailProps {
  runId: string;
}

const STATUS_ACTIONS: Array<{ status: AgentRunStatus; label: string; icon: typeof Play }> = [
  { status: "running", label: "Em execucao", icon: Play },
  { status: "completed", label: "Concluido", icon: CheckCircle2 },
  { status: "failed", label: "Falhou", icon: XCircle },
];

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

export default function AgentRunDetail({ runId }: AgentRunDetailProps) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    queueMicrotask(async () => {
      const [runsResult, projectsResult] = await Promise.all([loadSyncedAgentRuns(), loadSyncedProjects()]);
      setRuns(runsResult.runs);
      setProjects(projectsResult.projects);
      setHasLoaded(true);
    });
  }, []);

  const run = useMemo(() => runs.find((item) => item.id === runId) ?? null, [runId, runs]);
  const sourceProject = useMemo(() => {
    if (!run?.artifactId) {
      return null;
    }

    return projects.find((project) => project.id === run.artifactId) ?? null;
  }, [projects, run]);
  const outputProject = useMemo(() => {
    if (!run?.outputArtifactId) {
      return null;
    }

    return projects.find((project) => project.id === run.outputArtifactId) ?? null;
  }, [projects, run]);

  async function executeRun() {
    if (!run) {
      return;
    }

    setRuns((currentRuns) => currentRuns.map((currentRun) => (currentRun.id === run.id ? { ...currentRun, status: "running" } : currentRun)));
    const result = await executeAgentRun(run);
    const projectsResult = await loadSyncedProjects();

    setRuns((currentRuns) => currentRuns.map((currentRun) => (currentRun.id === run.id ? result.run : currentRun)));
    setProjects(projectsResult.projects);
  }

  async function updateStatus(status: AgentRunStatus) {
    if (!run) {
      return;
    }

    const result = await updateAgentRunStatus(run.id, status);

    if (!result.run) {
      return;
    }

    setRuns((currentRuns) => currentRuns.map((currentRun) => (currentRun.id === run.id ? result.run! : currentRun)));
  }

  async function retryRun() {
    if (!run) {
      return;
    }

    await createAgentRunLog(run.id, "warning", "requeued", "Execucao reenfileirada pelo operador.");
    await updateStatus("sent_to_studio");
  }

  async function cancelRun() {
    if (!run) {
      return;
    }

    await createAgentRunLog(run.id, "warning", "cancelled", "Execucao cancelada pelo operador.");
    await updateStatus("cancelled");
  }

  if (!hasLoaded) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Carregando execucao</h1>
          <p className="mt-2 text-sm text-slate-500">Buscando status, prompt e artefatos vinculados.</p>
        </section>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Link href="/executions" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-700">
          <ArrowLeft size={16} />
          Voltar para execucoes
        </Link>

        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Execucao nao encontrada</h1>
          <p className="mt-2 text-sm text-slate-500">Ela pode estar apenas no Supabase ou ter sido removida do armazenamento local.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link href="/executions" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-700">
        <ArrowLeft size={16} />
        Voltar para execucoes
      </Link>

      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-4 flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
              <Clock3 size={14} />
              {run.target}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              {run.sourceTitle ?? "Execucao de agente VendIAOS"}
            </h1>
            <p className="mt-3 text-sm text-slate-500">{formatProjectDate(run.createdAt)}</p>
            <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getAgentRunStatusClasses(run.status)}`}>
              {getAgentRunStatusLabel(run.status)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void executeRun()}
              disabled={run.status === "running"}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Wand2 size={14} />
              Executar agente
            </button>

            <button
              type="button"
              onClick={() => void retryRun()}
              disabled={run.status === "running"}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <RotateCcw size={14} />
              Reenfileirar
            </button>

            <button
              type="button"
              onClick={() => void cancelRun()}
              disabled={run.status === "completed" || run.status === "cancelled"}
              className="inline-flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
                  onClick={() => void updateStatus(action.status)}
                  disabled={run.status === action.status}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <Icon size={14} />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <AgentRunLogsTimeline runId={run.id} />

      {(run.executionLockId || run.lockedAt || run.lockExpiresAt) && (
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-700">Lock operacional</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Lock</p>
              <p className="mt-2 truncate text-sm font-semibold text-slate-950">{run.executionLockId ?? "Sem lock"}</p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Capturado em</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatRetryDate(run.lockedAt) ?? "Nao registrado"}</p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Expira em</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatRetryDate(run.lockExpiresAt) ?? "Nao registrado"}</p>
            </div>
          </div>
        </section>
      )}

      {(run.retryCount || run.nextRetryAt || run.lastError) && (
        <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-700">Retries</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Tentativas</p>
              <p className="mt-2 text-lg font-bold text-slate-950">{run.retryCount ?? 0}/3</p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Proxima tentativa</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatRetryDate(run.nextRetryAt) ?? "Nao agendada"}</p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Ultimo erro</p>
              <p className="mt-2 line-clamp-3 text-sm font-semibold text-slate-950">{run.lastError ?? "Sem erro registrado"}</p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Artefato de origem</h2>
          {sourceProject ? (
            <Link
              href={`/projects/${encodeURIComponent(sourceProject.id)}`}
              className="mt-4 block rounded-2xl bg-slate-50 p-4 transition hover:bg-blue-50"
            >
              <p className="text-sm font-semibold text-slate-900">{getProjectObjective(sourceProject.content)}</p>
              <p className="mt-2 text-xs font-semibold capitalize text-blue-700">{sourceProject.mode}</p>
            </Link>
          ) : (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Origem nao localizada neste navegador.</p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Resultado gerado</h2>
          {outputProject || run.outputArtifactId ? (
            <Link
              href={`/projects/${encodeURIComponent(outputProject?.id ?? run.outputArtifactId!)}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <ExternalLink size={16} />
              Abrir artefato derivado
            </Link>
          ) : (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              Nenhum artefato derivado vinculado ainda. Execute o agente para criar o resultado.
            </p>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Prompt da execucao</h2>
        <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-100">
          {run.prompt}
        </pre>
      </section>

      {run.inputSnapshot && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Snapshot de entrada</h2>
          <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">
            {run.inputSnapshot}
          </pre>
        </section>
      )}
    </div>
  );
}






