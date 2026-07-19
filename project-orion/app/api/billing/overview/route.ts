import { NextResponse } from "next/server";

import { canManageWorkspaceBilling, getMissingWorkspaceContextReason, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

type BillingPlan = "starter" | "growth" | "scale";
type BillingStatus = "trialing" | "active" | "past_due" | "cancelled";

interface WorkspaceBillingRow {
  id: string;
  workspace_id: string;
  plan: BillingPlan;
  status: BillingStatus;
  monthly_agent_runs_limit: number;
  monthly_projects_limit: number;
  monthly_storage_mb_limit: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

interface CountRow {
  count?: number;
}

const PLAN_CATALOG: Record<
  BillingPlan,
  {
    name: string;
    priceLabel: string;
    agentRuns: number;
    projects: number;
    storageMb: number;
    features: string[];
  }
> = {
  starter: {
    name: "Starter",
    priceLabel: "R$ 0 / mes",
    agentRuns: 100,
    projects: 50,
    storageMb: 1024,
    features: ["AI Studio", "Projetos", "Execucoes locais", "1 workspace"],
  },
  growth: {
    name: "Growth",
    priceLabel: "R$ 97 / mes",
    agentRuns: 1000,
    projects: 500,
    storageMb: 10240,
    features: ["Fila de agentes", "Auditoria", "Convites", "Prioridade media"],
  },
  scale: {
    name: "Scale",
    priceLabel: "R$ 297 / mes",
    agentRuns: 5000,
    projects: 2500,
    storageMb: 51200,
    features: ["Workspaces avancados", "Relatorios", "Suporte prioritario", "Limites altos"],
  },
};

function defaultBilling(workspaceId: string): WorkspaceBillingRow {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    id: "local-starter",
    workspace_id: workspaceId,
    plan: "starter",
    status: "trialing",
    monthly_agent_runs_limit: PLAN_CATALOG.starter.agentRuns,
    monthly_projects_limit: PLAN_CATALOG.starter.projects,
    monthly_storage_mb_limit: PLAN_CATALOG.starter.storageMb,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    created_at: now.toISOString(),
  };
}

async function countRows(table: string, query: string) {
  const result = await supabaseRest<CountRow[]>(table, {
    query: `${query}&select=count`,
  });

  if (result.error) {
    return 0;
  }

  return Number(result.data?.[0]?.count ?? 0);
}

function createUsagePercent(used: number, limit: number) {
  if (limit <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((used / limit) * 100));
}

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json(
      {
        source: "local-fallback",
        reason: getMissingWorkspaceContextReason(),
      },
      { status: 200 },
    );
  }

  try {
    const billingResult = await supabaseRest<WorkspaceBillingRow[]>("workspace_billing", {
      query: [`workspace_id=eq.${context.workspaceId}`, "select=*", "limit=1"].join("&"),
    });

    const billing = billingResult.data?.[0] ?? defaultBilling(context.workspaceId);
    const periodStart = billing.current_period_start;
    const periodEnd = billing.current_period_end;

    const [projectsUsed, agentRunsUsed] = await Promise.all([
      countRows(
        "projects",
        [`workspace_id=eq.${context.workspaceId}`, `created_at=gte.${periodStart}`, `created_at=lt.${periodEnd}`].join("&"),
      ),
      countRows(
        "agent_runs",
        [`workspace_id=eq.${context.workspaceId}`, `created_at=gte.${periodStart}`, `created_at=lt.${periodEnd}`].join("&"),
      ),
    ]);

    const plan = PLAN_CATALOG[billing.plan];

    return NextResponse.json({
      source: billingResult.data?.[0] ? "supabase" : "local-fallback",
      billing: {
        plan: billing.plan,
        planName: plan.name,
        status: billing.status,
        priceLabel: plan.priceLabel,
        currentPeriodStart: billing.current_period_start,
        currentPeriodEnd: billing.current_period_end,
        stripeConnected: Boolean(billing.stripe_customer_id || billing.stripe_subscription_id),
      },
      permissions: {
        role: context.role ?? "bootstrap",
        canManageBilling: canManageWorkspaceBilling(context.role),
      },
      usage: {
        projects: {
          used: projectsUsed,
          limit: billing.monthly_projects_limit,
          percent: createUsagePercent(projectsUsed, billing.monthly_projects_limit),
        },
        agentRuns: {
          used: agentRunsUsed,
          limit: billing.monthly_agent_runs_limit,
          percent: createUsagePercent(agentRunsUsed, billing.monthly_agent_runs_limit),
        },
        storageMb: {
          used: 0,
          limit: billing.monthly_storage_mb_limit,
          percent: 0,
        },
      },
      plans: PLAN_CATALOG,
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ source: "local-fallback", reason: error.message }, { status: 200 });
    }

    return NextResponse.json({ source: "local-fallback", error: "Erro inesperado ao carregar billing.", details: String(error) }, { status: 200 });
  }
}
