"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, CreditCard, Database, ExternalLink, RefreshCcw, Sparkles } from "lucide-react";

import OperationalContextPanel from "@/components/auth/OperationalContextPanel";
import { getAuthHeaders } from "@/components/auth/auth-fetch";

type BillingPlan = "starter" | "growth" | "scale";
type BillingStatus = "trialing" | "active" | "past_due" | "cancelled";

interface UsageMetric {
  used: number;
  limit: number;
  percent: number;
}

interface PlanCatalogItem {
  name: string;
  priceLabel: string;
  agentRuns: number;
  projects: number;
  storageMb: number;
  features: string[];
}

interface BillingOverviewResponse {
  source?: "supabase" | "local-fallback";
  reason?: string;
  error?: string;
  billing?: {
    plan: BillingPlan;
    planName: string;
    status: BillingStatus;
    priceLabel: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    stripeConnected: boolean;
  };
  permissions?: {
    role: string;
    canManageBilling: boolean;
  };
  usage?: {
    projects: UsageMetric;
    agentRuns: UsageMetric;
    storageMb: UsageMetric;
  };
  plans?: Record<BillingPlan, PlanCatalogItem>;
}

interface BillingEvent {
  id: string;
  event_type: string;
  processed_at: string;
  source?: "stripe" | "limit";
}

interface BillingEventsResponse {
  source?: "supabase" | "local-fallback";
  reason?: string;
  error?: string;
  events?: BillingEvent[];
}

const PLAN_ORDER: BillingPlan[] = ["starter", "growth", "scale"];

function formatDate(value?: string) {
  if (!value) {
    return "Sem periodo";
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function UsageBar({ label, metric }: { label: string; metric?: UsageMetric }) {
  const value = metric ?? { used: 0, limit: 0, percent: 0 };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-950">{label}</p>
        <p className="text-xs font-semibold text-slate-400">
          {value.used} / {value.limit}
        </p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${value.percent}%` }} />
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">{value.percent}% utilizado</p>
    </div>
  );
}

function formatEventType(value: string) {
  return value
    .replace(/^customer\./, "")
    .replace(/^checkout\./, "")
    .replace(/\./g, " ");
}

function getUsageAlert(metric?: UsageMetric) {
  if (!metric) {
    return null;
  }

  if (metric.percent >= 100) {
    return {
      tone: "border-red-200 bg-red-50 text-red-700",
      title: "Limite de execucoes atingido",
      description: "Novas execucoes de agentes ficam bloqueadas ate renovar o periodo ou mudar de plano.",
    };
  }

  if (metric.percent >= 80) {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      title: "Uso perto do limite",
      description: "O workspace esta chegando ao limite mensal de execucoes. Considere ajustar o plano antes de escalar campanhas.",
    };
  }

  return null;
}

export default function BillingDashboard() {
  const [overview, setOverview] = useState<BillingOverviewResponse | null>(null);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [billingAction, setBillingAction] = useState<"idle" | "checkout" | "portal">("idle");
  const [message, setMessage] = useState("");

  async function refreshBilling() {
    setIsLoading(true);
    setMessage("");

    try {
      const headers = getAuthHeaders();
      const [overviewResponse, eventsResponse] = await Promise.all([
        fetch("/api/billing/overview", {
          headers,
          cache: "no-store",
        }),
        fetch("/api/billing/events", {
          headers,
          cache: "no-store",
        }),
      ]);
      const data = (await overviewResponse.json()) as BillingOverviewResponse;
      const eventData = (await eventsResponse.json()) as BillingEventsResponse;

      setOverview(data);
      setEvents(eventData.events ?? []);
      setMessage(data.reason ?? data.error ?? eventData.reason ?? eventData.error ?? "");
    } catch (error) {
      setOverview(null);
      setEvents([]);
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar billing.");
    } finally {
      setIsLoading(false);
    }
  }

  async function startCheckout(plan: BillingPlan) {
    if (overview?.permissions && !overview.permissions.canManageBilling) {
      setMessage("Seu usuario pode visualizar o financeiro, mas apenas owner/admin pode alterar plano.");
      return;
    }

    if (plan === "starter") {
      setMessage("Plano Starter nao precisa de checkout.");
      return;
    }

    setBillingAction("checkout");
    setMessage("");

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ plan }),
      });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };

      if (!response.ok || !data.checkoutUrl) {
        setMessage(data.error ?? "Nao foi possivel iniciar checkout.");
        return;
      }

      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel iniciar checkout.");
    } finally {
      setBillingAction("idle");
    }
  }

  async function openCustomerPortal() {
    if (overview?.permissions && !overview.permissions.canManageBilling) {
      setMessage("Seu usuario pode visualizar o financeiro, mas apenas owner/admin pode abrir o portal.");
      return;
    }

    setBillingAction("portal");
    setMessage("");

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = (await response.json()) as { portalUrl?: string; error?: string };

      if (!response.ok || !data.portalUrl) {
        setMessage(data.error ?? "Portal financeiro ainda nao esta disponivel.");
        return;
      }

      window.location.assign(data.portalUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel abrir portal financeiro.");
    } finally {
      setBillingAction("idle");
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refreshBilling();
    });
  }, []);

  const activePlan = overview?.billing?.plan ?? "starter";
  const source = overview?.source === "supabase" ? "supabase" : "local";
  const plans = overview?.plans;
  const usageAlert = getUsageAlert(overview?.usage?.agentRuns);
  const canManageBilling = overview?.permissions?.canManageBilling ?? true;

  const periodLabel = useMemo(() => {
    if (!overview?.billing) {
      return "Periodo atual";
    }

    return `${formatDate(overview.billing.currentPeriodStart)} ate ${formatDate(overview.billing.currentPeriodEnd)}`;
  }, [overview]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            <CreditCard size={16} />
            Financeiro
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Planos e uso</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Controle limites, uso operacional e preparacao para cobranca por workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshBilling()}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </header>

      <OperationalContextPanel source={source} />

      {message && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{message}</p>
      )}

      {usageAlert && (
        <section className={`flex flex-col gap-3 rounded-2xl border px-5 py-4 md:flex-row md:items-center md:justify-between ${usageAlert.tone}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} />
            <div>
              <h2 className="text-sm font-bold">{usageAlert.title}</h2>
              <p className="mt-1 text-sm font-semibold opacity-90">{usageAlert.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void (activePlan === "scale" ? openCustomerPortal() : startCheckout("scale"))}
            disabled={billingAction !== "idle" || !canManageBilling}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <CreditCard size={14} />
            {activePlan === "scale" ? "Gerenciar assinatura" : "Ajustar plano"}
          </button>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Plano atual</p>
              <h2 className="text-2xl font-bold text-slate-950">{overview?.billing?.planName ?? "Starter"}</h2>
            </div>
          </div>
          <p className="mt-5 text-3xl font-bold text-slate-950">{overview?.billing?.priceLabel ?? "R$ 0 / mes"}</p>
          <div className="mt-5 grid gap-3 text-sm font-semibold text-slate-600">
            <p>Status: <span className="capitalize text-slate-950">{overview?.billing?.status ?? "trialing"}</span></p>
            <p>Periodo: <span className="text-slate-950">{periodLabel}</span></p>
            <p>Stripe: <span className={overview?.billing?.stripeConnected ? "text-emerald-700" : "text-amber-700"}>
              {overview?.billing?.stripeConnected ? "conectado" : "pendente"}
            </span></p>
          </div>
          <button
            type="button"
            onClick={() => void openCustomerPortal()}
            disabled={billingAction !== "idle" || !canManageBilling}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <ExternalLink size={16} />
            {billingAction === "portal" ? "Abrindo portal" : canManageBilling ? "Gerenciar assinatura" : "Somente owner/admin"}
          </button>
          {!canManageBilling && (
            <p className="mt-3 text-xs font-semibold text-amber-700">
              Seu papel atual permite visualizar uso, mas nao alterar cobranca.
            </p>
          )}
        </article>

        <section className="grid gap-3">
          <UsageBar label="Projetos no periodo" metric={overview?.usage?.projects} />
          <UsageBar label="Execucoes de agentes" metric={overview?.usage?.agentRuns} />
          <UsageBar label="Storage estimado" metric={overview?.usage?.storageMb} />
        </section>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((planKey) => {
          const plan = plans?.[planKey];
          const isActive = activePlan === planKey;

          return (
            <article key={planKey} className={`rounded-2xl border bg-white p-5 shadow-sm ${isActive ? "border-blue-300" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">{plan?.name ?? planKey}</h2>
                  <p className="mt-1 text-sm font-semibold text-blue-700">{plan?.priceLabel ?? "Sob consulta"}</p>
                </div>
                {isActive && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Atual</span>
                )}
              </div>

              <div className="mt-5 grid gap-2 text-sm font-semibold text-slate-600">
                <p><BarChart3 className="mr-2 inline" size={15} />{plan?.agentRuns ?? 0} execucoes/mes</p>
                <p><Database className="mr-2 inline" size={15} />{plan?.projects ?? 0} projetos/mes</p>
              </div>

              <div className="mt-5 grid gap-2">
                {(plan?.features ?? []).map((feature) => (
                  <p key={feature} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    {feature}
                  </p>
                ))}
              </div>

              {planKey === "starter" ? (
                <button
                  type="button"
                  disabled
                  className="mt-6 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
                >
                  Plano gratuito
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void startCheckout(planKey)}
                  disabled={billingAction !== "idle" || isActive || !canManageBilling}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <CreditCard size={16} />
                  {billingAction === "checkout" ? "Abrindo checkout" : isActive ? "Plano atual" : canManageBilling ? "Assinar" : "Somente owner/admin"}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Historico financeiro</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Eventos de cobranca</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
            {events.length} eventos recentes
          </span>
        </div>

        {events.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-bold text-slate-900">Nenhum evento de cobranca recebido ainda.</p>
            <p className="mt-2 text-sm text-slate-500">
              Quando checkout, assinatura ou cancelamento passar pela Stripe, o VendIAOS registra aqui.
            </p>
          </div>
        ) : (
          <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {events.map((event) => (
              <div key={event.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    event.source === "limit" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    <Clock3 size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold capitalize text-slate-950">{formatEventType(event.event_type)}</p>
                    <p className="text-xs font-semibold text-slate-400">
                      {event.source === "limit" ? "Limite de uso" : "Stripe"} - {event.id}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-500">{formatDate(event.processed_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
