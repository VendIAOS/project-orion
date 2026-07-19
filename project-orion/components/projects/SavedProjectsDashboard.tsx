"use client";

import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  ExternalLink,
  Eye,
  FolderOpen,
  GitBranch,
  ImageIcon,
  Megaphone,
  PackageCheck,
  RefreshCcw,
  Search,
  SplitSquareHorizontal,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  createAgentRun,
  getAgentRunStatusLabel,
  loadSyncedAgentRuns,
  type AgentRun,
  type AgentRunTarget,
} from "@/components/ai/lib/agent-runs-client";
import {
  ARTIFACT_PRODUCTION_STATUS_EVENT,
  artifactProductionStatusDescriptions,
  artifactProductionStatusLabels,
  deleteSyncedProject,
  loadArtifactProductionStatuses,
  loadArchivedProjects,
  loadSyncedProjects,
  restoreArchivedProject,
  syncLocalProjectsToServer,
  type ArtifactProductionState,
  type ArtifactProductionStatus,
  type SavedProject,
} from "@/components/ai/lib/projects-client";
import OperationalContextPanel from "@/components/auth/OperationalContextPanel";
import { getProjectArtifact, getProjectObjective } from "@/components/projects/project-format";

const MESSAGES_KEY = "vendiaos.ai-studio.messages";
const PENDING_PROMPT_KEY = "vendiaos.ai-studio.pending-prompt";
const PENDING_AUTO_RUN_KEY = "vendiaos.ai-studio.pending-auto-run";
const PENDING_SOURCE_KEY = "vendiaos.ai-studio.pending-source";

const MODE_FILTERS = ["campanha", "video", "imagem", "avatar", "analise", "funil"];
const PRODUCTION_STATUS_FILTERS: Array<"todos" | ArtifactProductionStatus> = ["todos", "draft", "review", "approved", "exported"];

const productionStatusStyles: Record<ArtifactProductionStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  review: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  exported: "bg-blue-50 text-blue-700",
};

type TransformTarget = Extract<AgentRunTarget, "campanha" | "video" | "imagem" | "funil">;

interface ProjectCardStatus {
  label: string;
  description: string;
  className: string;
}

function getProjectCardStatus(project: SavedProject, projects: SavedProject[]): ProjectCardStatus {
  const derivedCount = projects.filter((item) => item.originProjectId === project.id).length;

  if (project.originProjectId) {
    return {
      label: "Derivado",
      description: "Criado a partir de outro artefato",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (derivedCount > 0) {
    return {
      label: "Em expansao",
      description: `${derivedCount} derivado(s) criado(s)`,
      className: "bg-blue-50 text-blue-700",
    };
  }

  return {
    label: "Pronto para transformar",
    description: "Ainda sem derivacoes salvas",
    className: "bg-amber-50 text-amber-700",
  };
}

function getRecommendedTransformation(mode: string) {
  const normalizedMode = mode.toLowerCase();

  if (normalizedMode.includes("video")) {
    return "Imagem";
  }

  if (normalizedMode.includes("imagem")) {
    return "Campanha";
  }

  if (normalizedMode.includes("funil")) {
    return "Video";
  }

  if (normalizedMode.includes("analise")) {
    return "Campanha";
  }

  return "Funil";
}

function getProjectPreview(content: string) {
  const artifact = getProjectArtifact(content).replace(/\s+/g, " ").trim();

  if (artifact.length <= 360) {
    return artifact;
  }

  return `${artifact.slice(0, 357).trim()}...`;
}

function getPromptForTarget(project: SavedProject, target: TransformTarget) {
  const prompts: Record<TransformTarget, string> = {
    campanha: `Transforme este artefato em uma campanha completa com oferta, publico, canais, calendario, criativos e metricas:\n\n${project.content}`,
    video: `Transforme este artefato em um roteiro de video curto com gancho, cenas, narracao, B-roll, legenda e CTA:\n\n${project.content}`,
    imagem: `Transforme este artefato em prompts de imagem para 16:9, 1:1 e 9:16, com direcao visual, composicao, texto sugerido e negative prompts:\n\n${project.content}`,
    funil: `Transforme este artefato em um funil completo com etapas, oferta, lead magnet, automacoes, mensagens de WhatsApp/email e metricas:\n\n${project.content}`,
  };

  return prompts[target];
}

export default function SavedProjectsDashboard() {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<SavedProject[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [productionStatuses, setProductionStatuses] = useState<Record<string, ArtifactProductionState>>({});
  const [hasLoadedProjects, setHasLoadedProjects] = useState(false);
  const [projectSource, setProjectSource] = useState<"local" | "supabase">("local");
  const [query, setQuery] = useState("");
  const [activeMode, setActiveMode] = useState("todos");
  const [activeProductionStatus, setActiveProductionStatus] = useState<"todos" | ArtifactProductionStatus>("todos");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [archivedQuery, setArchivedQuery] = useState("");
  const [archivedMode, setArchivedMode] = useState("todos");
  const [canRestoreArchived, setCanRestoreArchived] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(async () => {
      const [projectsResult, runsResult] = await Promise.all([loadSyncedProjects(), loadSyncedAgentRuns()]);
      setProjects(projectsResult.projects);
      setProjectSource(projectsResult.source);
      setAgentRuns(runsResult.runs);
      setProductionStatuses(loadArtifactProductionStatuses());
      setHasLoadedProjects(true);
    });

    function handleProductionStatusUpdate() {
      setProductionStatuses(loadArtifactProductionStatuses());
    }

    window.addEventListener(ARTIFACT_PRODUCTION_STATUS_EVENT, handleProductionStatusUpdate);

    return () => {
      window.removeEventListener(ARTIFACT_PRODUCTION_STATUS_EVENT, handleProductionStatusUpdate);
    };
  }, []);

  const modes = useMemo(() => {
    const projectModes = Array.from(new Set(projects.map((project) => project.mode))).filter(Boolean);

    return Array.from(new Set([...MODE_FILTERS, ...projectModes]));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesMode = activeMode === "todos" || project.mode.toLowerCase().includes(activeMode);
      const productionStatus = productionStatuses[project.id]?.status ?? project.productionStatus ?? "draft";
      const matchesProductionStatus = activeProductionStatus === "todos" || productionStatus === activeProductionStatus;
      const matchesQuery = !cleanQuery || `${project.mode} ${project.content}`.toLowerCase().includes(cleanQuery);

      return matchesMode && matchesProductionStatus && matchesQuery;
    });
  }, [activeMode, activeProductionStatus, productionStatuses, projects, query]);

  const productionSummary = useMemo(() => {
    return PRODUCTION_STATUS_FILTERS.filter((status) => status !== "todos").map((status) => {
      const count = projects.filter((project) => {
        const productionStatus = productionStatuses[project.id]?.status ?? project.productionStatus ?? "draft";

        return productionStatus === status;
      }).length;

      return {
        status,
        count,
      };
    });
  }, [productionStatuses, projects]);

  const archivedModes = useMemo(() => {
    const projectModes = Array.from(new Set(archivedProjects.map((project) => project.mode))).filter(Boolean);

    return Array.from(new Set(["todos", ...projectModes]));
  }, [archivedProjects]);

  const filteredArchivedProjects = useMemo(() => {
    const cleanQuery = archivedQuery.trim().toLowerCase();

    return archivedProjects.filter((project) => {
      const matchesMode = archivedMode === "todos" || project.mode.toLowerCase().includes(archivedMode);
      const matchesQuery = !cleanQuery || `${project.mode} ${project.content}`.toLowerCase().includes(cleanQuery);

      return matchesMode && matchesQuery;
    });
  }, [archivedMode, archivedProjects, archivedQuery]);

  async function copyProject(project: SavedProject) {
    await navigator.clipboard.writeText(project.content);
    setCopiedId(project.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  }

  async function removeProject(projectId: string) {
    if (pendingDeleteId !== projectId) {
      setPendingDeleteId(projectId);
      setSyncMessage("Clique novamente para confirmar o arquivamento.");
      window.setTimeout(() => setPendingDeleteId(null), 4200);
      return;
    }

    const nextProjects = projects.filter((project) => project.id !== projectId);
    setProjects(nextProjects);
    setPendingDeleteId(null);
    setSyncMessage("Projeto arquivado.");
    await deleteSyncedProject(projectId, nextProjects);
  }

  async function syncProjects() {
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const [projectsResult, runsResult] = await Promise.all([syncLocalProjectsToServer(), loadSyncedAgentRuns()]);
      setProjects(projectsResult.projects);
      setProjectSource(projectsResult.source);
      setAgentRuns(runsResult.runs);

      if (projectsResult.syncedCount > 0) {
        setSyncMessage(`${projectsResult.syncedCount} projeto(s) sincronizado(s).`);
        return;
      }

      if (projectsResult.failedCount > 0) {
        setSyncMessage("Supabase ainda nao esta pronto. Mantivemos tudo local.");
        return;
      }

      setSyncMessage("Projetos ja estavam atualizados.");
    } finally {
      setIsSyncing(false);
      window.setTimeout(() => setSyncMessage(null), 3200);
    }
  }

  async function toggleArchived() {
    const nextShowArchived = !showArchived;
    setShowArchived(nextShowArchived);

    if (!nextShowArchived || archivedProjects.length > 0) {
      return;
    }

    setIsLoadingArchived(true);
    const result = await loadArchivedProjects();
    setArchivedProjects(result.projects);
    setCanRestoreArchived(result.canRestoreProjects);
    setIsLoadingArchived(false);
  }

  async function restoreProject(projectId: string) {
    setSyncMessage("Restaurando projeto...");
    if (!canRestoreArchived) {
      setSyncMessage("Apenas owner/admin pode restaurar projetos arquivados.");
      window.setTimeout(() => setSyncMessage(null), 4200);
      return;
    }

    const result = await restoreArchivedProject(projectId);

    if (!result.project) {
      setSyncMessage("Nao foi possivel restaurar. Verifique permissao owner/admin.");
      window.setTimeout(() => setSyncMessage(null), 4200);
      return;
    }

    setArchivedProjects((current) => current.filter((project) => project.id !== projectId));
    setProjects((current) => [result.project!, ...current.filter((project) => project.id !== result.project!.id)]);
    setSyncMessage("Projeto restaurado.");
    window.setTimeout(() => setSyncMessage(null), 3200);
  }

  function openInStudio(project: SavedProject) {
    window.localStorage.setItem(
      MESSAGES_KEY,
      JSON.stringify([
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: project.content,
          createdAt: new Date().toISOString(),
        },
      ]),
    );

    window.location.assign("/ai-studio");
  }

  async function transformInStudio(project: SavedProject, target: TransformTarget) {
    const prompt = getPromptForTarget(project, target);
    let result: Awaited<ReturnType<typeof createAgentRun>>;

    try {
      result = await createAgentRun(project, target, prompt);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Nao foi possivel criar a execucao.");
      window.setTimeout(() => setSyncMessage(null), 4200);
      return;
    }

    setAgentRuns((currentRuns) => [result.run, ...currentRuns.filter((run) => run.id !== result.run.id)].slice(0, 100));

    window.localStorage.setItem(
      MESSAGES_KEY,
      JSON.stringify([
        {
          id: `assistant-${project.id}`,
          role: "assistant",
          content: project.content,
          createdAt: project.createdAt,
        },
      ]),
    );
    window.localStorage.setItem(PENDING_PROMPT_KEY, prompt);
    window.localStorage.setItem(PENDING_AUTO_RUN_KEY, "true");
    window.localStorage.setItem(
      PENDING_SOURCE_KEY,
      JSON.stringify({
        id: project.id,
        mode: project.mode,
        title: getProjectObjective(project.content),
        runId: result.run.id,
      }),
    );
    window.location.assign("/ai-studio");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            <FolderOpen size={16} />
            Projetos
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Projetos salvos</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Artefatos criados pelo VendIAOS ficam aqui para continuar, reaproveitar ou transformar em novos fluxos.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
            <span className="font-semibold text-slate-900">{hasLoadedProjects ? projects.length : "..."}</span> projetos salvos
            <span className="ml-3 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              {projectSource === "supabase" ? "Supabase" : "Local"}
            </span>
          </div>

          {syncMessage && <p className="text-xs font-medium text-slate-500">{syncMessage}</p>}
        </div>
      </header>

      <OperationalContextPanel source={projectSource} />

      <section className="grid gap-4 md:grid-cols-4">
        {productionSummary.map((item) => (
          <button
            key={item.status}
            type="button"
            onClick={() => setActiveProductionStatus(item.status)}
            className={`rounded-2xl border p-5 text-left shadow-sm transition ${
              activeProductionStatus === item.status
                ? "border-blue-200 bg-blue-50"
                : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <PackageCheck size={20} className="text-slate-500" />
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${productionStatusStyles[item.status]}`}>
                {artifactProductionStatusLabels[item.status]}
              </span>
            </div>
            <p className="mt-5 text-3xl font-bold text-slate-950">{hasLoadedProjects ? item.count : "..."}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{artifactProductionStatusDescriptions[item.status]}</p>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <Search size={18} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por modo, campanha, video, funil..."
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          <button
            type="button"
            onClick={syncProjects}
            disabled={isSyncing || !hasLoadedProjects}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSyncing ? <RefreshCcw size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            {isSyncing ? "Sincronizando" : "Sincronizar"}
          </button>
          <button
            type="button"
            onClick={() => void toggleArchived()}
            disabled={!hasLoadedProjects || isLoadingArchived}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {showArchived ? <FolderOpen size={14} /> : <Archive size={14} />}
            {isLoadingArchived ? "Carregando" : showArchived ? "Ocultar arquivados" : "Arquivados"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveMode("todos")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeMode === "todos" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            Todos
          </button>

          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setActiveMode(mode)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${
                activeMode === mode ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Pipeline</p>
          <div className="flex flex-wrap gap-2">
            {PRODUCTION_STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setActiveProductionStatus(status)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  activeProductionStatus === status
                    ? status === "todos"
                      ? "bg-slate-900 text-white"
                      : productionStatusStyles[status]
                    : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {status === "todos" ? "Todos os status" : artifactProductionStatusLabels[status]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {showArchived && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Projetos arquivados</h2>
              <p className="mt-1 text-sm text-slate-500">Itens ocultos da biblioteca principal, com restauracao controlada.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              {filteredArchivedProjects.length} de {archivedProjects.length} arquivado(s)
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={archivedQuery}
                onChange={(event) => setArchivedQuery(event.target.value)}
                placeholder="Buscar nos arquivados..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {archivedModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setArchivedMode(mode)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${
                    archivedMode === mode ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {!canRestoreArchived && (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
              Voce pode consultar arquivados, mas apenas owner/admin pode restaurar.
            </p>
          )}

          {archivedProjects.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Nenhum projeto arquivado encontrado.
            </p>
          ) : filteredArchivedProjects.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Nenhum arquivado corresponde aos filtros atuais.
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {filteredArchivedProjects.map((project) => (
                <article key={project.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-600">
                      {project.mode}
                    </span>
                    <p className="mt-3 line-clamp-2 text-sm font-bold text-slate-950">{getProjectObjective(project.content)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      Arquivado em {project.archivedAt ? new Intl.DateTimeFormat("pt-BR").format(new Date(project.archivedAt)) : "data indisponivel"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void restoreProject(project.id)}
                    disabled={!canRestoreArchived}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <ArchiveRestore size={14} />
                    Restaurar
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {hasLoadedProjects && projects.length > 0 && (
        <p className="text-sm text-slate-500">
          Exibindo <span className="font-semibold text-slate-800">{filteredProjects.length}</span> de{" "}
          <span className="font-semibold text-slate-800">{projects.length}</span> projeto(s).
        </p>
      )}

      {!hasLoadedProjects ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">Carregando projetos</h2>
          <p className="mt-2 text-sm text-slate-500">Buscando artefatos salvos no servidor e neste navegador.</p>
        </section>
      ) : filteredProjects.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">Nenhum projeto encontrado</h2>
          <p className="mt-2 text-sm text-slate-500">
            Salve uma resposta no AI Studio ou ajuste sua busca para ver os artefatos.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filteredProjects.map((project) => {
            const status = getProjectCardStatus(project, projects);
            const productionStatus = productionStatuses[project.id]?.status ?? project.productionStatus ?? "draft";
            const recommendedTransformation = getRecommendedTransformation(project.mode);
            const lastRun =
              agentRuns.find((run) => run.artifactId === project.id || run.projectId === project.id) ?? null;

            return (
              <article key={project.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                      {project.mode}
                    </span>
                    <span className={`ml-2 rounded-full px-3 py-1 text-xs font-semibold ${productionStatusStyles[productionStatus]}`}>
                      {artifactProductionStatusLabels[productionStatus]}
                    </span>
                    {project.originProjectId && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <GitBranch size={13} />
                        Derivado
                      </span>
                    )}
                    <h2 className="mt-3 line-clamp-3 text-lg font-semibold leading-7 text-slate-900">{getProjectObjective(project.content)}</h2>
                    {project.originProjectTitle && (
                      <p className="mt-2 line-clamp-1 text-xs font-medium text-slate-500">
                        Origem: {project.originProjectTitle}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        Proximo: {recommendedTransformation}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-400">Status do artefato: {status.description}</p>
                    {lastRun && (
                      <p className="mt-2 text-xs font-semibold text-blue-700">
                        Ultima execucao: {lastRun.target} - {getAgentRunStatusLabel(lastRun.status)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProject(project.id)}
                    className={`rounded-lg p-2 transition ${
                      pendingDeleteId === project.id ? "bg-red-50 text-red-700" : "text-slate-400 hover:bg-red-50 hover:text-red-600"
                    }`}
                    aria-label={pendingDeleteId === project.id ? "Confirmar arquivamento do projeto" : "Arquivar projeto"}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="flex-1 rounded-xl bg-slate-50 p-4">
                  <p className="line-clamp-6 text-sm leading-6 text-slate-600">{getProjectPreview(project.content)}</p>
                  <Link
                    href={`/projects/${encodeURIComponent(project.id)}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 transition hover:text-blue-900"
                  >
                    <Eye size={14} />
                    Ver detalhe completo
                  </Link>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Transformar em</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => void transformInStudio(project, "campanha")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Megaphone size={14} />
                      Campanha
                    </button>
                    <button
                      type="button"
                      onClick={() => void transformInStudio(project, "video")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Video size={14} />
                      Video
                    </button>
                    <button
                      type="button"
                      onClick={() => void transformInStudio(project, "imagem")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <ImageIcon size={14} />
                      Imagem
                    </button>
                    <button
                      type="button"
                      onClick={() => void transformInStudio(project, "funil")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <SplitSquareHorizontal size={14} />
                      Funil
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(project.createdAt))}
                  </span>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/projects/${encodeURIComponent(project.id)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                    >
                      <Eye size={14} />
                      Ver detalhe
                    </Link>

                    <button
                      type="button"
                      onClick={() => copyProject(project)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {copiedId === project.id ? <Check size={14} /> : <Copy size={14} />}
                      {copiedId === project.id ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openInStudio(project)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <ExternalLink size={14} />
                      Abrir no Studio
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

