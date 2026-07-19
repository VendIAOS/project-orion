"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CreditCard,
  Database,
  FileCheck2,
  Globe2,
  KeyRound,
  LockKeyhole,
  Play,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Workflow,
  XCircle,
} from "lucide-react";

import { getAuthHeaders } from "@/components/auth/auth-fetch";

type ReadinessStatus = "ready" | "warning" | "blocked";

interface SystemHealthResponse {
  services?: {
    openai?: "ready" | "missing";
    supabase?: {
      url?: "ready" | "missing";
      anonKey?: "ready" | "missing";
      serviceRole?: "ready" | "missing";
      ready?: boolean;
    };
    bootstrap?: {
      workspaceId?: "ready" | "missing";
      userId?: "ready" | "missing";
      ready?: boolean;
    };
  };
}

interface BillingOverviewResponse {
  billing?: {
    status?: string;
    planName?: string;
  };
  usage?: {
    agentRuns?: {
      percent?: number;
    };
  };
}

interface AgentRunHealthResponse {
  source?: "supabase" | "local-fallback";
  activeRuns?: number;
  stuckCount?: number;
}

interface ProjectsStatsResponse {
  source?: "supabase" | "local-fallback";
  stats?: {
    activeProjects?: number;
    archivedProjects?: number;
  };
}

interface AdminAuditResponse {
  source?: "supabase" | "local-fallback";
  events?: Array<unknown>;
}

interface ReadinessCheck {
  id: string;
  title: string;
  description: string;
  status: ReadinessStatus;
  actionLabel: string;
  href: string;
}

type SmokeStatus = "passed" | "warning" | "failed";

interface SmokeCheck {
  id: string;
  title: string;
  status: SmokeStatus;
  detail: string;
  durationMs: number;
}

interface SmokeTestResponse {
  source?: "supabase" | "local-fallback";
  status?: SmokeStatus;
  passed?: number;
  warning?: number;
  failed?: number;
  checks?: SmokeCheck[];
  generatedAt?: string;
}

interface DeployVariableCheck {
  name: string;
  label: string;
  scope: "core" | "billing" | "public-url" | "optional";
  required: boolean;
  status: "ready" | "missing";
}

interface DeployCheckResponse {
  status?: ReadinessStatus;
  readyPercent?: number;
  readyRequired?: number;
  totalRequired?: number;
  missingRequired?: string[];
  appUrlLooksPublic?: boolean;
  variables?: DeployVariableCheck[];
  generatedAt?: string;
}

const statusStyles: Record<ReadinessStatus, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  blocked: "border-red-200 bg-red-50 text-red-700",
};

const statusLabels: Record<ReadinessStatus, string> = {
  ready: "Pronto",
  warning: "Atencao",
  blocked: "Bloqueado",
};

const smokeStyles: Record<SmokeStatus, string> = {
  passed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  failed: "border-red-200 bg-red-50 text-red-700",
};

const smokeLabels: Record<SmokeStatus, string> = {
  passed: "Passou",
  warning: "Atencao",
  failed: "Falhou",
};

const releaseHighlights = [
  "AI Studio com orquestrador de marketing e resposta real via rota server-side.",
  "Projetos persistidos no Supabase com arquivamento, restauracao e auditoria.",
  "Fila de agentes com execucao, locks, retries, ciclos, saude operacional e permissoes.",
  "Billing com limites, eventos, Stripe preparado e bloqueios por cota.",
  "Workspace, convites, membros, login, auditoria e checklist de producao.",
];

const releaseBlockers = [
  "Deploy externo com variaveis de ambiente conferidas.",
  "Dominio final apontado e testado.",
  "Webhook Stripe em ambiente de producao validado.",
  "Primeiro smoke test aprovado em URL publica.",
];

const deployChecklist = [
  {
    title: "1. Preparar ambiente",
    items: [
      "Criar projeto de deploy e apontar para o repositorio correto.",
      "Configurar build command como npm run build.",
      "Conferir Node/Next compativel com Next.js 16.",
    ],
  },
  {
    title: "2. Variaveis obrigatorias",
    items: [
      "OPENAI_API_KEY",
      "OPENAI_MODEL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "VENDIAOS_DEFAULT_WORKSPACE_ID",
      "VENDIAOS_DEFAULT_USER_ID",
    ],
  },
  {
    title: "3. Dominio e callbacks",
    items: [
      "Apontar dominio final para o deploy.",
      "Atualizar URLs autorizadas no Supabase Auth.",
      "Validar rota /login e aceite de convite em URL publica.",
    ],
  },
  {
    title: "4. Stripe producao",
    items: [
      "Configurar STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET de producao.",
      "Criar endpoint de webhook para /api/billing/webhook.",
      "Testar checkout, portal e evento de assinatura.",
    ],
  },
  {
    title: "5. Validacao pos-deploy",
    items: [
      "Abrir /production na URL publica.",
      "Rodar smoke test e exigir zero falhas.",
      "Criar uma resposta no AI Studio, salvar projeto e transformar em agente.",
    ],
  },
];

function renderStatusIcon(status: ReadinessStatus, size: number) {
  if (status === "ready") {
    return <CheckCircle2 size={size} />;
  }

  if (status === "warning") {
    return <AlertTriangle size={size} />;
  }

  return <XCircle size={size} />;
}

function renderSmokeIcon(status: SmokeStatus, size: number) {
  if (status === "passed") {
    return <CheckCircle2 size={size} />;
  }

  if (status === "warning") {
    return <AlertTriangle size={size} />;
  }

  return <XCircle size={size} />;
}

function getOverallStatus(checks: ReadinessCheck[]) {
  if (checks.some((check) => check.status === "blocked")) {
    return "blocked" as const;
  }

  if (checks.some((check) => check.status === "warning")) {
    return "warning" as const;
  }

  return "ready" as const;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function renderCheckIcon(id: string) {
  if (id === "openai") {
    return <Bot size={20} />;
  }

  if (id === "supabase") {
    return <Database size={20} />;
  }

  if (id === "billing") {
    return <CreditCard size={20} />;
  }

  if (id === "agents") {
    return <Workflow size={20} />;
  }

  if (id === "projects") {
    return <FileCheck2 size={20} />;
  }

  return <ShieldCheck size={20} />;
}

export default function ProductionReadinessDashboard() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [billing, setBilling] = useState<BillingOverviewResponse | null>(null);
  const [agentHealth, setAgentHealth] = useState<AgentRunHealthResponse | null>(null);
  const [projectStats, setProjectStats] = useState<ProjectsStatsResponse | null>(null);
  const [adminAudit, setAdminAudit] = useState<AdminAuditResponse | null>(null);
  const [smokeTest, setSmokeTest] = useState<SmokeTestResponse | null>(null);
  const [deployCheck, setDeployCheck] = useState<DeployCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningSmoke, setIsRunningSmoke] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  async function refreshReadiness() {
    setIsLoading(true);

    const [healthResult, billingResult, agentHealthResult, projectStatsResult, adminAuditResult, deployCheckResult] = await Promise.all([
      fetchJson<SystemHealthResponse>("/api/system/health"),
      fetchJson<BillingOverviewResponse>("/api/billing/overview"),
      fetchJson<AgentRunHealthResponse>("/api/agent-runs/health"),
      fetchJson<ProjectsStatsResponse>("/api/projects/stats"),
      fetchJson<AdminAuditResponse>("/api/admin-audit"),
      fetchJson<DeployCheckResponse>("/api/production/deploy-check"),
    ]);

    setHealth(healthResult);
    setBilling(billingResult);
    setAgentHealth(agentHealthResult);
    setProjectStats(projectStatsResult);
    setAdminAudit(adminAuditResult);
    setDeployCheck(deployCheckResult);
    setLastCheckedAt(new Date().toISOString());
    setIsLoading(false);
  }

  async function runSmokeTest() {
    setIsRunningSmoke(true);
    const result = await fetchJson<SmokeTestResponse>("/api/production/smoke");

    setSmokeTest(result ?? {
      status: "failed",
      failed: 1,
      warning: 0,
      passed: 0,
      checks: [
        {
          id: "smoke_unavailable",
          title: "Smoke test indisponivel",
          status: "failed",
          detail: "Nao foi possivel chamar a rota de smoke test.",
          durationMs: 0,
        },
      ],
      generatedAt: new Date().toISOString(),
    });
    setIsRunningSmoke(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refreshReadiness();
    });
  }, []);

  const checks = useMemo<ReadinessCheck[]>(() => {
    const openAiReady = health?.services?.openai === "ready";
    const supabaseReady = Boolean(health?.services?.supabase?.ready);
    const workspaceReady = Boolean(health?.services?.bootstrap?.ready);
    const billingStatus = billing?.billing?.status;
    const billingReady = Boolean(billingStatus && billingStatus !== "cancelled");
    const billingNearLimit = Boolean(billing?.usage?.agentRuns?.percent && billing.usage.agentRuns.percent >= 80);
    const agentSourceReady = agentHealth?.source === "supabase";
    const stuckRuns = agentHealth?.stuckCount ?? 0;
    const projectsReady = projectStats?.source === "supabase";
    const auditReady = adminAudit?.source === "supabase";

    return [
      {
        id: "openai",
        title: "OpenAI server-side",
        description: openAiReady ? "Respostas reais estao ativas sem expor chave no frontend." : "Configure OPENAI_API_KEY antes de abrir para usuarios reais.",
        status: openAiReady ? "ready" : "blocked",
        actionLabel: "Ver configuracoes",
        href: "/settings",
      },
      {
        id: "supabase",
        title: "Supabase e workspace",
        description: supabaseReady && workspaceReady ? "Banco, service role e workspace inicial estao prontos." : "Revise variaveis Supabase e bootstrap do workspace.",
        status: supabaseReady && workspaceReady ? "ready" : "blocked",
        actionLabel: "Ver configuracoes",
        href: "/settings",
      },
      {
        id: "billing",
        title: "Billing e limites",
        description: billingReady ? `Plano ${billing?.billing?.planName ?? "ativo"} com controle de cota operacional.` : "Billing ainda precisa estar ativo para uso comercial.",
        status: billingReady ? (billingNearLimit ? "warning" : "ready") : "warning",
        actionLabel: "Ver financeiro",
        href: "/billing",
      },
      {
        id: "agents",
        title: "Fila de agentes",
        description: agentSourceReady ? `${agentHealth?.activeRuns ?? 0} execucao(oes) ativa(s), ${stuckRuns} travada(s).` : "Fila ainda esta em fallback local ou indisponivel.",
        status: agentSourceReady && stuckRuns === 0 ? "ready" : agentSourceReady ? "warning" : "blocked",
        actionLabel: "Ver execucoes",
        href: "/executions",
      },
      {
        id: "projects",
        title: "Persistencia de projetos",
        description: projectsReady ? `${projectStats?.stats?.activeProjects ?? 0} projeto(s) ativo(s), ${projectStats?.stats?.archivedProjects ?? 0} arquivado(s).` : "Projetos ainda precisam sincronizar com Supabase.",
        status: projectsReady ? "ready" : "blocked",
        actionLabel: "Ver projetos",
        href: "/projects",
      },
      {
        id: "audit",
        title: "Auditoria administrativa",
        description: auditReady ? `${adminAudit?.events?.length ?? 0} evento(s) administrativo(s) recentes carregados.` : "Auditoria indisponivel para o usuario atual ou Supabase.",
        status: auditReady ? "ready" : "warning",
        actionLabel: "Ver auditoria",
        href: "/audit",
      },
    ];
  }, [adminAudit, agentHealth, billing, health, projectStats]);

  const overallStatus = getOverallStatus(checks);
  const completedCount = checks.filter((check) => check.status === "ready").length;
  const readinessPercent = Math.round((completedCount / checks.length) * 100);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            <Rocket size={16} />
            Production Readiness
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Checklist de producao</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Validacao operacional do VendIAOS antes de colocar o MVP em uso comercial.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshReadiness()}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <RefreshCcw size={16} />
          {isLoading ? "Verificando..." : "Verificar agora"}
        </button>
      </header>

      <section className={`rounded-2xl border p-5 shadow-sm ${statusStyles[overallStatus]}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            {renderStatusIcon(overallStatus, 24)}
            <div>
              <h2 className="text-lg font-bold">Status geral: {statusLabels[overallStatus]}</h2>
              <p className="mt-1 text-sm font-semibold opacity-90">
                {completedCount} de {checks.length} areas prontas. Prontidao operacional estimada: {readinessPercent}%.
              </p>
            </div>
          </div>
          {lastCheckedAt && (
            <span className="rounded-full bg-white/70 px-3 py-2 text-xs font-bold">
              Ultima verificacao: {formatCheckedAt(lastCheckedAt)}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              <Sparkles size={14} />
              Release interna
            </div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">VendIAOS MVP Build 0.96.0</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Versao candidata para primeiro deploy externo controlado. O produto ja opera como SaaS local com IA,
              persistencia, agentes, billing, auditoria e painel de producao.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-2xl font-bold text-slate-900">82%</p>
                <p className="mt-1 text-xs font-bold text-slate-500">MVP robusto</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-2xl font-bold text-slate-900">39</p>
                <p className="mt-1 text-xs font-bold text-slate-500">rotas build</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-2xl font-bold text-slate-900">6</p>
                <p className="mt-1 text-xs font-bold text-slate-500">areas core</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <h3 className="font-bold text-emerald-800">Entregue nesta fase</h3>
              <div className="mt-3 space-y-2">
                {releaseHighlights.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm font-semibold leading-5 text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <h3 className="font-bold text-amber-800">Antes do deploy publico</h3>
              <div className="mt-3 space-y-2">
                {releaseBlockers.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm font-semibold leading-5 text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              <Globe2 size={14} />
              Deploy externo controlado
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">Plano operacional para publicar o MVP</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Sequencia minima para levar o VendIAOS para uma URL publica sem expor chaves, sem perder contexto de workspace e com billing auditavel.
            </p>
          </div>

          <Link
            href="/settings"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <KeyRound size={16} />
            Conferir credenciais
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-5">
          {deployChecklist.map((group) => (
            <article key={group.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-900">{group.title}</h3>
              <div className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-xs font-semibold leading-5 text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        {deployCheck && (
          <div className={`mt-5 rounded-xl border p-4 ${statusStyles[deployCheck.status ?? "blocked"]}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-2">
                {renderStatusIcon(deployCheck.status ?? "blocked", 18)}
                <div>
                  <h3 className="text-sm font-bold">Verificacao automatica de variaveis</h3>
                  <p className="mt-1 text-xs font-semibold opacity-90">
                    {deployCheck.readyRequired ?? 0} de {deployCheck.totalRequired ?? 0} obrigatorias prontas. Prontidao: {deployCheck.readyPercent ?? 0}%.
                  </p>
                  {!deployCheck.appUrlLooksPublic && (
                    <p className="mt-1 text-xs font-semibold opacity-90">
                      NEXT_PUBLIC_APP_URL ainda parece local. Atualize para a URL publica antes do deploy final.
                    </p>
                  )}
                </div>
              </div>
              {deployCheck.generatedAt && (
                <span className="rounded-full bg-white/70 px-3 py-2 text-xs font-bold">
                  {formatCheckedAt(deployCheck.generatedAt)}
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(deployCheck.variables ?? []).map((variable) => (
                <div key={variable.name} className="flex items-start justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-xs font-bold">
                  <div>
                    <p className="text-slate-900">{variable.name}</p>
                    <p className="mt-0.5 text-slate-500">{variable.label}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 ${variable.status === "ready" ? "bg-emerald-100 text-emerald-700" : variable.required ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {variable.status === "ready" ? "Pronto" : variable.required ? "Faltando" : "Opcional"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
              <ShieldCheck size={14} />
              Smoke test
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">Teste guiado das rotas principais</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Executa uma verificacao segura de producao: ambiente, workspace, permissoes, projetos, agentes, billing e auditoria.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void runSmokeTest()}
            disabled={isRunningSmoke}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Play size={16} />
            {isRunningSmoke ? "Testando..." : "Rodar smoke test"}
          </button>
        </div>

        {smokeTest && (
          <div className="mt-5 grid gap-4">
            <div className={`flex flex-col gap-3 rounded-xl border px-4 py-3 md:flex-row md:items-center md:justify-between ${smokeStyles[smokeTest.status ?? "failed"]}`}>
              <div className="flex items-start gap-2">
                {renderSmokeIcon(smokeTest.status ?? "failed", 18)}
                <div>
                  <p className="text-sm font-bold">Resultado: {smokeLabels[smokeTest.status ?? "failed"]}</p>
                  <p className="mt-1 text-xs font-semibold opacity-90">
                    {smokeTest.passed ?? 0} passou, {smokeTest.warning ?? 0} atencao, {smokeTest.failed ?? 0} falhou.
                  </p>
                </div>
              </div>
              {smokeTest.generatedAt && (
                <span className="rounded-full bg-white/70 px-3 py-2 text-xs font-bold">
                  {formatCheckedAt(smokeTest.generatedAt)}
                </span>
              )}
            </div>

            <div className="grid gap-2">
              {(smokeTest.checks ?? []).map((check) => (
                <article key={check.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-[auto_1fr_auto] md:items-center">
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${smokeStyles[check.status]}`}>
                    {renderSmokeIcon(check.status, 13)}
                    {smokeLabels[check.status]}
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900">{check.title}</h3>
                    <p className="mt-1 text-slate-600">{check.detail}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{check.durationMs}ms</span>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => {
          return (
            <article key={check.id} className="flex min-h-56 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                    {renderCheckIcon(check.id)}
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[check.status]}`}>
                    {renderStatusIcon(check.status, 13)}
                    {statusLabels[check.status]}
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-bold text-slate-900">{check.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{check.description}</p>
              </div>

              <Link
                href={check.href}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <LockKeyhole size={14} />
                {check.actionLabel}
              </Link>
            </article>
          );
        })}
      </section>
    </div>
  );
}
