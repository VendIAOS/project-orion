"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  CreditCard,
  Database,
  FolderOpen,
  GitBranch,
  ImageIcon,
  Archive,
  Layers3,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";

import { loadSyncedAgentRuns, type AgentRun } from "@/components/ai/lib/agent-runs-client";
import { getAuthHeaders } from "@/components/auth/auth-fetch";
import { loadSyncedProjects, type SavedProject } from "@/components/ai/lib/projects-client";
import { getProjectObjective } from "@/components/projects/project-format";

type ServiceStatus = "ready" | "missing";

interface HealthResponse {
  services: {
    openai: ServiceStatus;
    supabase: {
      ready: boolean;
    };
    bootstrap: {
      ready: boolean;
    };
  };
}

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  tone?: "blue" | "emerald" | "slate";
}

interface BillingOverviewResponse {
  billing?: {
    planName: string;
    status: string;
    priceLabel: string;
  };
  usage?: {
    agentRuns: {
      used: number;
      limit: number;
      percent: number;
    };
  };
}

interface ProjectStatsResponse {
  stats?: {
    activeProjects: number;
    archivedProjects: number;
    restoredProjects: number;
  };
}

function MetricCard({ title, value, description, tone = "slate" }: MetricCardProps) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
        <Layers3 size={18} />
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}

function getPrimaryMode(projects: SavedProject[]) {
  const counts = new Map<string, number>();

  projects.forEach((project) => {
    counts.set(project.mode, (counts.get(project.mode) ?? 0) + 1);
  });

  return Array.from(counts.entries()).sort((first, second) => second[1] - first[1])[0]?.[0] ?? "nenhum";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function countArtifactsByKind(projects: SavedProject[], kind: "video" | "imagem" | "avatar") {
  return projects.filter((project) => {
    const mode = normalizeText(project.mode);
    const content = normalizeText(project.content);

    if (kind === "video") {
      return mode.includes("video") || content.includes("roteiro de video");
    }

    if (kind === "imagem") {
      return mode.includes("imagem") || content.includes("prompt de imagem");
    }

    return mode.includes("avatar") || content.includes("avatar");
  }).length;
}

export default function DashboardOverview() {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [source, setSource] = useState<"local" | "supabase">("local");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [billing, setBilling] = useState<BillingOverviewResponse | null>(null);
  const [projectStats, setProjectStats] = useState<ProjectStatsResponse["stats"] | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const [projectsResult, runsResult, healthResponse, billingResponse, projectStatsResponse] = await Promise.all([
          loadSyncedProjects(),
          loadSyncedAgentRuns(),
          fetch("/api/system/health", { cache: "no-store" }),
          fetch("/api/billing/overview", {
            headers: getAuthHeaders(),
            cache: "no-store",
          }),
          fetch("/api/projects/stats", {
            headers: getAuthHeaders(),
            cache: "no-store",
          }),
        ]);

        setProjects(projectsResult.projects);
        setAgentRuns(runsResult.runs);
        setSource(projectsResult.source);

        if (healthResponse.ok) {
          setHealth((await healthResponse.json()) as HealthResponse);
        }

        if (billingResponse.ok) {
          setBilling((await billingResponse.json()) as BillingOverviewResponse);
        }

        if (projectStatsResponse.ok) {
          const data = (await projectStatsResponse.json()) as ProjectStatsResponse;
          setProjectStats(data.stats ?? null);
        }
      } finally {
        setHasLoaded(true);
      }
    });
  }, []);

  const derivedProjectsCount = useMemo(() => {
    return projects.filter((project) => project.originProjectId).length;
  }, [projects]);

  const primaryMode = useMemo(() => getPrimaryMode(projects), [projects]);
  const recentProjects = projects.slice(0, 4);
  const supabaseReady = Boolean(health?.services.supabase.ready && health.services.bootstrap.ready);
  const agentUsage = billing?.usage?.agentRuns;
  const billingTone = agentUsage && agentUsage.percent >= 100 ? "red" : agentUsage && agentUsage.percent >= 80 ? "amber" : "emerald";
  const mediaHubs = [
    {
      title: "Videos",
      description: "Roteiros, Reels, anuncios e criativos em video.",
      href: "/videos",
      count: countArtifactsByKind(projects, "video"),
      icon: Clapperboard,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      title: "Imagens",
      description: "Prompts visuais e pecas para campanhas.",
      href: "/images",
      count: countArtifactsByKind(projects, "imagem"),
      icon: ImageIcon,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Avatares",
      description: "Perfis, scripts e direcoes de apresentador.",
      href: "/avatars",
      count: countArtifactsByKind(projects, "avatar"),
      icon: UserRound,
      tone: "bg-violet-50 text-violet-700",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            <Sparkles size={16} />
            VendIAOS Command Center
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Visao operacional do seu sistema de marketing com IA: criacao, persistencia, linhagem e proximas acoes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/ai-studio"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Zap size={16} />
            Novo artefato
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <FolderOpen size={16} />
            Ver projetos
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Projetos salvos"
          value={hasLoaded ? String(projects.length) : "..."}
          description={source === "supabase" ? "Sincronizados no Supabase" : "Mantidos localmente"}
          tone={source === "supabase" ? "emerald" : "slate"}
        />
        <MetricCard
          title="Derivados"
          value={hasLoaded ? String(derivedProjectsCount) : "..."}
          description="Artefatos criados a partir de outros projetos"
          tone="blue"
        />
        <MetricCard
          title="Modo dominante"
          value={primaryMode}
          description="Tipo de artefato mais recorrente na biblioteca"
        />
        <MetricCard
          title="Execucoes"
          value={hasLoaded ? String(agentRuns.length) : "..."}
          description="Transformacoes enviadas aos agentes"
          tone="blue"
        />
        <MetricCard
          title="Persistencia"
          value={supabaseReady ? "Online" : "Pendente"}
          description={supabaseReady ? "Banco real ativo" : "Complete as configuracoes"}
          tone={supabaseReady ? "emerald" : "slate"}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {mediaHubs.map((hub) => {
          const Icon = hub.icon;

          return (
            <Link
              key={hub.href}
              href={hub.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${hub.tone}`}>
                  <Icon size={19} />
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 group-hover:bg-white">
                  {hasLoaded ? hub.count : "..."} artefato(s)
                </span>
              </div>
              <h2 className="mt-5 text-lg font-bold text-slate-950">{hub.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{hub.description}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700">
                Abrir modulo
                <ArrowRight size={15} />
              </span>
            </Link>
          );
        })}
      </section>

      {projectStats && (
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <FolderOpen size={18} />
            </div>
            <p className="text-sm font-medium text-slate-500">Ativos no Supabase</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{projectStats.activeProjects}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Artefatos visiveis na biblioteca principal.</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Archive size={18} />
            </div>
            <p className="text-sm font-medium text-slate-500">Arquivados</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{projectStats.archivedProjects}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Itens ocultos que ainda podem ser restaurados.</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <CheckCircle2 size={18} />
            </div>
            <p className="text-sm font-medium text-slate-500">Restauracoes</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{projectStats.restoredProjects}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Retornos registrados na auditoria administrativa.</p>
          </article>
        </section>
      )}

      {billing?.billing && agentUsage && (
        <section className={`flex flex-col gap-3 rounded-2xl border px-5 py-4 md:flex-row md:items-center md:justify-between ${
          billingTone === "red"
            ? "border-red-200 bg-red-50 text-red-700"
            : billingTone === "amber"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          <div className="flex items-start gap-3">
            {billingTone === "emerald" ? <CreditCard size={20} /> : <AlertTriangle size={20} />}
            <div>
              <h2 className="text-sm font-bold">
                Plano {billing.billing.planName}: {agentUsage.percent}% das execucoes usadas
              </h2>
              <p className="mt-1 text-sm font-semibold opacity-90">
                {agentUsage.used} de {agentUsage.limit} execucoes no periodo atual. Status: {billing.billing.status}.
              </p>
            </div>
          </div>
          <Link
            href="/billing"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            <CreditCard size={14} />
            Ver plano
          </Link>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Atividade recente</h2>
              <p className="mt-1 text-sm text-slate-500">Ultimos artefatos salvos no VendIAOS.</p>
            </div>
            <Link href="/projects" className="text-sm font-semibold text-blue-700 transition hover:text-blue-900">
              Abrir biblioteca
            </Link>
          </div>

          {recentProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-semibold text-slate-800">Nenhum projeto salvo ainda.</p>
              <p className="mt-2 text-sm text-slate-500">Crie uma resposta no AI Studio e salve para alimentar o dashboard.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${encodeURIComponent(project.id)}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                        {project.mode}
                      </span>
                      {project.originProjectId && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <GitBranch size={13} />
                          Derivado
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-1 text-sm font-semibold text-slate-900">{getProjectObjective(project.content)}</p>
                  </div>
                  <ArrowRight size={17} className="shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Sistema</h2>
          <p className="mt-1 text-sm text-slate-500">Saude das integracoes principais.</p>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Sparkles size={16} />
                OpenAI
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={13} />
                {health?.services.openai === "ready" ? "Pronto" : "Pendente"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Database size={16} />
                Supabase
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  supabaseReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                <CheckCircle2 size={13} />
                {supabaseReady ? "Pronto" : "Pendente"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

