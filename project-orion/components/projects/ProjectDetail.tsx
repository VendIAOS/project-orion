"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  History,
  ImageIcon,
  Layers3,
  Megaphone,
  Pencil,
  RotateCcw,
  Save,
  SplitSquareHorizontal,
  Trash2,
  Video,
  X,
} from "lucide-react";

import {
  ARTIFACT_PRODUCTION_STATUS_EVENT,
  artifactProductionStatusDescriptions,
  artifactProductionStatusLabels,
  deleteSyncedProject,
  getArtifactProductionStatus,
  loadProjectVersions,
  loadSyncedProjects,
  updateArtifactProductionStatus,
  updateSyncedProject,
  type ArtifactProductionStatus,
  type ProjectVersion,
  type SavedProject,
} from "@/components/ai/lib/projects-client";
import {
  formatProjectDate,
  getProjectArtifact,
  getProjectNextAction,
  getProjectObjective,
} from "@/components/projects/project-format";

const MESSAGES_KEY = "vendiaos.ai-studio.messages";
const PENDING_PROMPT_KEY = "vendiaos.ai-studio.pending-prompt";
const PENDING_AUTO_RUN_KEY = "vendiaos.ai-studio.pending-auto-run";
const PENDING_SOURCE_KEY = "vendiaos.ai-studio.pending-source";

type TransformAction = "variations" | "campaign" | "video" | "image";

const PRODUCTION_STATUSES: ArtifactProductionStatus[] = ["draft", "review", "approved", "exported"];

const productionStatusStyles: Record<ArtifactProductionStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  review: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  exported: "bg-blue-50 text-blue-700",
};

interface TransformationRecommendation {
  action: TransformAction;
  title: string;
  description: string;
}

interface ProjectDetailProps {
  projectId: string;
}

function getTransformationRecommendations(mode: string, derivedCount: number): TransformationRecommendation[] {
  const normalizedMode = mode.toLowerCase();
  const needsVariants = derivedCount === 0;

  if (normalizedMode.includes("video")) {
    return [
      {
        action: "image",
        title: "Criar frames e thumbnails",
        description: "Transformar o roteiro em prompts visuais para capa, cenas e cortes sociais.",
      },
      {
        action: "campaign",
        title: "Expandir para campanha",
        description: "Conectar o video a oferta, canais, calendario e metricas.",
      },
      {
        action: "variations",
        title: needsVariants ? "Gerar variacoes do roteiro" : "Refinar roteiro",
        description: "Criar versoes alternativas de gancho, CTA e estrutura narrativa.",
      },
    ];
  }

  if (normalizedMode.includes("imagem")) {
    return [
      {
        action: "campaign",
        title: "Transformar em campanha",
        description: "Converter a direcao visual em oferta, canais e plano de distribuicao.",
      },
      {
        action: "video",
        title: "Criar roteiro a partir da arte",
        description: "Usar o conceito visual como base para video curto com cenas e narracao.",
      },
      {
        action: "variations",
        title: "Gerar variacoes criativas",
        description: "Produzir novas linhas visuais para teste A/B.",
      },
    ];
  }

  if (normalizedMode.includes("funil")) {
    return [
      {
        action: "campaign",
        title: "Ativar campanha do funil",
        description: "Transformar etapas do funil em plano de execucao por canal.",
      },
      {
        action: "video",
        title: "Criar conteudos por etapa",
        description: "Gerar roteiros de atracao, nutricao e conversao.",
      },
      {
        action: "image",
        title: "Criar criativos por etapa",
        description: "Gerar prompts para anuncios, posts e stories alinhados ao funil.",
      },
    ];
  }

  if (normalizedMode.includes("analise")) {
    return [
      {
        action: "campaign",
        title: "Converter analise em campanha",
        description: "Transformar diagnostico em plano com oferta, canais e metricas.",
      },
      {
        action: "variations",
        title: "Gerar cenarios alternativos",
        description: "Explorar diferentes posicionamentos e hipoteses de execucao.",
      },
      {
        action: "image",
        title: "Materializar insights em criativos",
        description: "Criar direcoes visuais baseadas nas conclusoes da analise.",
      },
    ];
  }

  return [
    {
      action: needsVariants ? "variations" : "campaign",
      title: needsVariants ? "Criar primeiras variacoes" : "Expandir campanha",
      description: needsVariants
        ? "Gerar alternativas antes de aprofundar a execucao."
        : "Conectar o artefato a canais, calendario e indicadores.",
    },
    {
      action: "video",
      title: "Transformar em video",
      description: "Criar roteiro curto com gancho, cenas, narracao e CTA.",
    },
    {
      action: "image",
      title: "Criar prompts de imagem",
      description: "Gerar pecas visuais para 16:9, 1:1 e 9:16.",
    },
  ];
}

export default function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [hasLoadedProjects, setHasLoadedProjects] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [productionStatus, setProductionStatus] = useState<ArtifactProductionStatus>("draft");

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await loadSyncedProjects();
      setProjects(result.projects);
      setVersions(loadProjectVersions(projectId));
      setProductionStatus(getArtifactProductionStatus(projectId));
      setHasLoadedProjects(true);
    });

    function handleProductionStatusUpdate() {
      setProductionStatus(getArtifactProductionStatus(projectId));
    }

    window.addEventListener(ARTIFACT_PRODUCTION_STATUS_EVENT, handleProductionStatusUpdate);

    return () => {
      window.removeEventListener(ARTIFACT_PRODUCTION_STATUS_EVENT, handleProductionStatusUpdate);
    };
  }, [projectId]);

  const project = useMemo(() => {
    return projects.find((item) => item.id === projectId) ?? null;
  }, [projectId, projects]);

  async function copyProject() {
    if (!project) {
      return;
    }

    await navigator.clipboard.writeText(project.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function saveProjectEdit() {
    if (!project || draftContent.trim().length === 0) {
      return;
    }

    const result = await updateSyncedProject(project.id, draftContent.trim(), projects);
    setProjects(result.projects);
    setVersions(loadProjectVersions(project.id));
    setIsEditing(false);
    setSaveMessage(result.source === "supabase" ? "Alteracao salva no Supabase." : "Alteracao salva localmente.");
    window.setTimeout(() => setSaveMessage(null), 2600);
  }

  async function restoreVersion(version: ProjectVersion) {
    if (!project) {
      return;
    }

    const result = await updateSyncedProject(project.id, version.content, projects, {
      saveVersion: true,
      versionReason: "restore",
    });
    setProjects(result.projects);
    setVersions(loadProjectVersions(project.id));
    setSaveMessage("Versao restaurada.");
    window.setTimeout(() => setSaveMessage(null), 2600);
  }

  async function removeProject() {
    if (!project) {
      return;
    }

    if (!isDeleteConfirming) {
      setIsDeleteConfirming(true);
      setSaveMessage("Clique novamente em Arquivar para confirmar.");
      window.setTimeout(() => setIsDeleteConfirming(false), 4200);
      return;
    }

    const nextProjects = projects.filter((item) => item.id !== project.id);
    setProjects(nextProjects);
    await deleteSyncedProject(project.id, nextProjects);
    window.location.assign("/projects");
  }

  function openInStudio() {
    if (!project) {
      return;
    }

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

    window.location.assign("/ai-studio");
  }

  function transformInStudio(action: TransformAction) {
    if (!project) {
      return;
    }

    const prompts = {
      variations: `Crie 5 variacoes melhores para este artefato, mantendo a estrategia central:\n\n${project.content}`,
      campaign: `Transforme este artefato em uma campanha completa com oferta, publico, canais, calendario, criativos e metricas:\n\n${project.content}`,
      video: `Transforme este artefato em um roteiro de video curto com gancho, cenas, narracao, B-roll e CTA:\n\n${project.content}`,
      image: `Transforme este artefato em prompts de imagem para 16:9, 1:1 e 9:16, com direcao visual e negative prompts:\n\n${project.content}`,
    };

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
    window.localStorage.setItem(PENDING_PROMPT_KEY, prompts[action]);
    window.localStorage.setItem(PENDING_AUTO_RUN_KEY, "true");
    window.localStorage.setItem(
      PENDING_SOURCE_KEY,
      JSON.stringify({
        id: project.id,
        mode: project.mode,
        title: getProjectObjective(project.content),
      }),
    );
    window.location.assign("/ai-studio");
  }

  function createMarkdownFileName() {
    if (!project) {
      return "vendiaos-projeto.md";
    }

    const title = getProjectObjective(project.content)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);

    return `${title || "vendiaos-projeto"}.md`;
  }

  function exportProjectMarkdown() {
    if (!project) {
      return;
    }

    const objective = getProjectObjective(project.content);
    const artifact = getProjectArtifact(project.content);
    const nextAction = getProjectNextAction(project.content);

    const markdown = [
      `# ${objective}`,
      "",
      `**Modo:** ${project.mode}`,
      `**Criado em:** ${formatProjectDate(project.createdAt)}`,
      "",
      "## Artefato inicial",
      "",
      artifact,
      "",
      ...(nextAction ? ["## Proxima acao", "", nextAction, ""] : []),
      "## Resposta completa",
      "",
      project.content,
      "",
      "---",
      "Exportado pelo VendIAOS.",
    ].join("\n");

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = createMarkdownFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function changeProductionStatus(status: ArtifactProductionStatus) {
    if (!project) {
      return;
    }

    updateArtifactProductionStatus(project.id, status);
    setProductionStatus(status);
    setSaveMessage(`Status atualizado para ${artifactProductionStatusLabels[status]}.`);
    window.setTimeout(() => setSaveMessage(null), 2600);
  }

  if (!hasLoadedProjects) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Carregando projeto</h1>
          <p className="mt-2 text-sm text-slate-500">Buscando o artefato salvo.</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Link href="/projects" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-700">
          <ArrowLeft size={16} />
          Voltar para projetos
        </Link>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Projeto nao encontrado</h1>
          <p className="mt-2 text-sm text-slate-500">Ele pode ter sido removido ou ainda nao foi sincronizado neste navegador.</p>
        </div>
      </div>
    );
  }

  const objective = getProjectObjective(project.content);
  const artifact = getProjectArtifact(project.content);
  const nextAction = getProjectNextAction(project.content);
  const compareVersion = versions.find((version) => version.id === compareVersionId) ?? null;
  const characterDelta = compareVersion ? project.content.length - compareVersion.content.length : 0;
  const originProject = project.originProjectId
    ? projects.find((item) => item.id === project.originProjectId) ?? null
    : null;
  const derivedProjects = projects
    .filter((item) => item.originProjectId === project.id)
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  const transformationRecommendations = getTransformationRecommendations(project.mode, derivedProjects.length);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link href="/projects" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-700">
        <ArrowLeft size={16} />
        Voltar para projetos
      </Link>

      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-4 flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
              <FileText size={14} />
              {project.mode}
            </div>
            <div className={`mb-4 flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${productionStatusStyles[productionStatus]}`}>
              {artifactProductionStatusLabels[productionStatus]}
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">{objective}</h1>
            <p className="mt-3 text-sm text-slate-500">{formatProjectDate(project.createdAt)}</p>
            {project.originProjectId && (
              <Link
                href={`/projects/${encodeURIComponent(project.originProjectId)}`}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <GitBranch size={14} />
                Derivado de {project.originProjectTitle ?? project.originProjectMode ?? "outro projeto"}
              </Link>
            )}
            {saveMessage && <p className="mt-3 text-xs font-semibold text-emerald-700">{saveMessage}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={saveProjectEdit}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  <Save size={14} />
                  Salvar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDraftContent(project.content);
                    setIsEditing(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <X size={14} />
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraftContent(project.content);
                  setIsEditing(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Pencil size={14} />
                Editar
              </button>
            )}

            <button
              type="button"
              onClick={copyProject}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>

            <button
              type="button"
              onClick={exportProjectMarkdown}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <Download size={14} />
              Exportar
            </button>

            <button
              type="button"
              onClick={openInStudio}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <ExternalLink size={14} />
              Abrir no Studio
            </button>

            <button
              type="button"
              onClick={removeProject}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                isDeleteConfirming ? "border-red-200 bg-red-50 text-red-700" : "border-red-100 text-red-600 hover:bg-red-50"
              }`}
            >
              <Trash2 size={14} />
              {isDeleteConfirming ? "Confirmar arquivamento" : "Arquivar"}
            </button>
          </div>
        </div>
      </header>

      {isEditing ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Editar resposta completa</h2>
          <textarea
            value={draftContent}
            onChange={(event) => setDraftContent(event.target.value)}
            className="mt-4 min-h-[520px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
          />
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Pipeline de producao</h2>
                <p className="mt-2 text-sm text-slate-500">{artifactProductionStatusDescriptions[productionStatus]}</p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${productionStatusStyles[productionStatus]}`}>
                {artifactProductionStatusLabels[productionStatus]}
              </span>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-4">
              {PRODUCTION_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => changeProductionStatus(status)}
                  className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                    productionStatus === status
                      ? productionStatusStyles[status]
                      : "bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  {artifactProductionStatusLabels[status]}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500">
                  <GitBranch size={15} />
                  Cadeia de artefatos
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Acompanhe como este artefato se conecta a transformacoes anteriores e proximas variacoes.
                </p>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {derivedProjects.length} derivado(s)
              </span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Origem</p>
                {project.originProjectId ? (
                  <Link
                    href={`/projects/${encodeURIComponent(project.originProjectId)}`}
                    className="mt-3 block text-sm font-semibold leading-6 text-slate-800 transition hover:text-blue-700"
                  >
                    {originProject
                      ? getProjectObjective(originProject.content)
                      : project.originProjectTitle ?? "Projeto original"}
                  </Link>
                ) : (
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-500">Este e um artefato original.</p>
                )}
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Atual</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">{objective}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Derivados</p>
                {derivedProjects.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {derivedProjects.slice(0, 3).map((derivedProject) => (
                      <Link
                        key={derivedProject.id}
                        href={`/projects/${encodeURIComponent(derivedProject.id)}`}
                        className="block rounded-xl bg-white p-3 text-sm font-semibold leading-6 text-slate-700 shadow-sm transition hover:text-blue-700"
                      >
                        <span className="mb-1 block text-xs font-semibold capitalize text-blue-600">
                          {derivedProject.mode}
                        </span>
                        {getProjectObjective(derivedProject.content)}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
                    Nenhum derivado salvo ainda.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Artefato inicial</h2>
            <div className="mt-4 whitespace-pre-line rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">{artifact}</div>
          </section>

          {nextAction && (
            <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-700">Proxima acao</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">{nextAction}</p>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Resposta completa</h2>
            <pre className="mt-4 max-h-[560px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-100">
              {project.content}
            </pre>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-700">
                  Proximas transformacoes recomendadas
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  O VendIAOS sugere o melhor proximo movimento para evoluir este artefato sem perder contexto.
                </p>
              </div>
              <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                {project.mode}
              </span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {transformationRecommendations.map((recommendation) => (
                <button
                  key={recommendation.title}
                  type="button"
                  onClick={() => transformInStudio(recommendation.action)}
                  className="rounded-2xl border border-blue-100 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <span className="text-sm font-semibold text-slate-900">{recommendation.title}</span>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">{recommendation.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Transformar com VendIAOS</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => transformInStudio("variations")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Layers3 size={16} />
                Variacoes
              </button>

              <button
                type="button"
                onClick={() => transformInStudio("campaign")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Megaphone size={16} />
                Campanha
              </button>

              <button
                type="button"
                onClick={() => transformInStudio("video")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Video size={16} />
                Video
              </button>

              <button
                type="button"
                onClick={() => transformInStudio("image")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <ImageIcon size={16} />
                Imagem
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500">
                  <History size={15} />
                  Historico de versoes
                </h2>
                <p className="mt-2 text-sm text-slate-500">Versoes anteriores ficam salvas neste navegador.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {versions.length} versao(oes)
              </span>
            </div>

            {versions.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Nenhuma edicao registrada ainda.</p>
            ) : (
              <>
                {compareVersion && (
                  <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Comparando com {formatProjectDate(compareVersion.createdAt)}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Diferenca aproximada: {characterDelta >= 0 ? "+" : ""}
                          {characterDelta} caracteres
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setCompareVersionId(null)}
                        className="inline-flex w-fit items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        <X size={14} />
                        Fechar comparacao
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-700">Versao anterior</p>
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs leading-6 text-slate-700">
                          {compareVersion.content}
                        </pre>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-700">Versao atual</p>
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                          {project.content}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-3">
                  {versions.slice(0, 6).map((version) => (
                    <article key={version.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                            {version.reason === "restore" ? "Antes da restauracao" : "Antes da edicao"}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{formatProjectDate(version.createdAt)}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setCompareVersionId(version.id)}
                            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <SplitSquareHorizontal size={14} />
                            Comparar
                          </button>

                          <button
                            type="button"
                            onClick={() => restoreVersion(version)}
                            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <RotateCcw size={14} />
                            Restaurar
                          </button>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                        {version.content}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}








