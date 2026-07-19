"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clapperboard,
  Copy,
  ExternalLink,
  FileText,
  ImageIcon,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { loadSyncedProjects, type SavedProject } from "@/components/ai/lib/projects-client";
import { formatProjectDate, getProjectArtifact, getProjectObjective } from "@/components/projects/project-format";

const MESSAGES_KEY = "vendiaos.ai-studio.messages";
const PENDING_PROMPT_KEY = "vendiaos.ai-studio.pending-prompt";
const PENDING_AUTO_RUN_KEY = "vendiaos.ai-studio.pending-auto-run";

type ArtifactKind = "video" | "imagem" | "avatar";

interface ArtifactLibraryDashboardProps {
  kind: ArtifactKind;
}

const LIBRARY_CONFIG = {
  video: {
    title: "Videos",
    label: "Modulo de video",
    description: "Roteiros, Reels, anuncios e criativos em video gerados pelo orquestrador do VendIAOS.",
    emptyTitle: "Nenhum artefato de video ainda",
    emptyDescription: "Gere ou transforme uma campanha em roteiro de video no AI Studio para popular esta biblioteca.",
    icon: Clapperboard,
    accent: "text-blue-700",
    badge: "bg-blue-50 text-blue-700",
    prompt: "Crie um roteiro de video curto com gancho, cenas, narracao, B-roll, legenda, CTA e checklist de producao.",
  },
  imagem: {
    title: "Imagens",
    label: "Modulo de imagem",
    description: "Prompts, direcoes visuais e pecas estaticas para campanhas, social, landing pages e anuncios.",
    emptyTitle: "Nenhum artefato de imagem ainda",
    emptyDescription: "Transforme uma campanha em prompts de imagem 16:9, 1:1 e 9:16 para iniciar a biblioteca visual.",
    icon: ImageIcon,
    accent: "text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700",
    prompt: "Crie prompts de imagem para campanha em 16:9, 1:1 e 9:16 com composicao, estilo, texto sugerido e negative prompts.",
  },
  avatar: {
    title: "Avatares",
    label: "Modulo de avatar",
    description: "Perfis, scripts de avatar e direcoes de apresentador para videos com IA e campanhas humanizadas.",
    emptyTitle: "Nenhum artefato de avatar ainda",
    emptyDescription: "Peca ao AI Studio para criar um avatar de marca, tom de voz e scripts de apresentacao.",
    icon: UserRound,
    accent: "text-violet-700",
    badge: "bg-violet-50 text-violet-700",
    prompt: "Crie um avatar operacional para campanha com perfil, tom de voz, roteiro de apresentacao, objecoes e CTA.",
  },
} satisfies Record<
  ArtifactKind,
  {
    title: string;
    label: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    icon: typeof Clapperboard;
    accent: string;
    badge: string;
    prompt: string;
  }
>;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getArtifactPreview(content: string) {
  const artifact = getProjectArtifact(content).replace(/\s+/g, " ").trim();

  if (artifact.length <= 280) {
    return artifact;
  }

  return `${artifact.slice(0, 277).trim()}...`;
}

function matchesLibraryKind(project: SavedProject, kind: ArtifactKind) {
  const mode = normalizeText(project.mode);
  const content = normalizeText(project.content);

  if (kind === "video") {
    return mode.includes("video") || content.includes("roteiro de video");
  }

  if (kind === "imagem") {
    return mode.includes("imagem") || content.includes("prompt de imagem");
  }

  return mode.includes("avatar") || content.includes("avatar");
}

function getSourceCount(projects: SavedProject[], projectId: string) {
  return projects.filter((project) => project.originProjectId === projectId).length;
}

export default function ArtifactLibraryDashboard({ kind }: ArtifactLibraryDashboardProps) {
  const config = LIBRARY_CONFIG[kind];
  const Icon = config.icon;
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [source, setSource] = useState<"local" | "supabase">("local");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await loadSyncedProjects();
      setProjects(result.projects);
      setSource(result.source);
      setHasLoaded(true);
    });
  }, []);

  const libraryProjects = useMemo(() => {
    return projects.filter((project) => matchesLibraryKind(project, kind));
  }, [kind, projects]);

  const filteredProjects = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) {
      return libraryProjects;
    }

    return libraryProjects.filter((project) => `${project.mode} ${project.content}`.toLowerCase().includes(cleanQuery));
  }, [libraryProjects, query]);

  const derivedCount = useMemo(() => {
    return libraryProjects.filter((project) => project.originProjectId).length;
  }, [libraryProjects]);

  async function copyProject(project: SavedProject) {
    await navigator.clipboard.writeText(project.content);
    setCopiedId(project.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  function openInStudio(project: SavedProject) {
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

  function startNewArtifact() {
    window.localStorage.setItem(PENDING_PROMPT_KEY, config.prompt);
    window.localStorage.setItem(PENDING_AUTO_RUN_KEY, "false");
    window.location.assign("/ai-studio");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className={`mb-4 flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${config.badge}`}>
            <Icon size={16} />
            {config.label}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950">{config.title}</h1>
          <p className="mt-3 max-w-2xl text-slate-600">{config.description}</p>
        </div>

        <button
          type="button"
          onClick={startNewArtifact}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Sparkles size={16} />
          Novo artefato
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Icon size={20} className={config.accent} />
          <p className="mt-6 text-sm text-slate-500">Artefatos</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{hasLoaded ? libraryProjects.length : "..."}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <FileText size={20} className="text-slate-600" />
          <p className="mt-6 text-sm text-slate-500">Derivados</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{hasLoaded ? derivedCount : "..."}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CheckCircle2 size={20} className="text-emerald-700" />
          <p className="mt-6 text-sm text-slate-500">Origem</p>
          <p className="mt-2 text-lg font-bold text-slate-950">{source === "supabase" ? "Supabase" : "Local"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Bot size={20} className="text-blue-700" />
          <p className="mt-6 text-sm text-slate-500">Motor</p>
          <p className="mt-2 text-lg font-bold text-slate-950">AI Studio</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
          <Search size={18} className="text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar em ${config.title.toLowerCase()}...`}
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      </section>

      {!hasLoaded ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">Carregando biblioteca</h2>
          <p className="mt-2 text-sm text-slate-500">Buscando artefatos salvos no VendIAOS.</p>
        </section>
      ) : filteredProjects.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
          <Icon size={28} className={`mx-auto ${config.accent}`} />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">{config.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{config.emptyDescription}</p>
          <button
            type="button"
            onClick={startNewArtifact}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Criar no AI Studio
            <ArrowRight size={16} />
          </button>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filteredProjects.map((project) => {
            const derivations = getSourceCount(projects, project.id);

            return (
              <article key={project.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${config.badge}`}>
                    {project.mode}
                  </span>
                  {derivations > 0 && (
                    <span className="ml-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {derivations} derivado(s)
                    </span>
                  )}
                  <h2 className="mt-3 line-clamp-3 text-lg font-semibold leading-7 text-slate-950">
                    {getProjectObjective(project.content)}
                  </h2>
                </div>

                <div className="mt-4 flex-1 rounded-xl bg-slate-50 p-4">
                  <p className="line-clamp-6 text-sm leading-6 text-slate-600">{getArtifactPreview(project.content)}</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-400">{formatProjectDate(project.createdAt)}</span>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/projects/${encodeURIComponent(project.id)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <ExternalLink size={14} />
                      Detalhe
                    </Link>
                    <button
                      type="button"
                      onClick={() => void copyProject(project)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Copy size={14} />
                      {copiedId === project.id ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openInStudio(project)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                    >
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
