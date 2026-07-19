import { supabaseRest } from "./supabase-rest";

type BillingPlan = "starter" | "growth" | "scale";
type BillingStatus = "trialing" | "active" | "past_due" | "cancelled";

interface WorkspaceBillingRow {
  plan: BillingPlan;
  status: BillingStatus;
  monthly_agent_runs_limit: number;
  monthly_projects_limit: number;
  monthly_storage_mb_limit: number;
  current_period_start: string;
  current_period_end: string;
}

interface CountRow {
  count?: number;
}

const PLAN_DEFAULTS: Record<
  BillingPlan,
  {
    agentRuns: number;
    projects: number;
    storageMb: number;
  }
> = {
  starter: {
    agentRuns: 100,
    projects: 50,
    storageMb: 1024,
  },
  growth: {
    agentRuns: 1000,
    projects: 500,
    storageMb: 10240,
  },
  scale: {
    agentRuns: 5000,
    projects: 2500,
    storageMb: 51200,
  },
};

function createDefaultBilling(): WorkspaceBillingRow {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    plan: "starter",
    status: "trialing",
    monthly_agent_runs_limit: PLAN_DEFAULTS.starter.agentRuns,
    monthly_projects_limit: PLAN_DEFAULTS.starter.projects,
    monthly_storage_mb_limit: PLAN_DEFAULTS.starter.storageMb,
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
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

export async function checkAgentRunQuota(workspaceId: string) {
  const billingResult = await supabaseRest<WorkspaceBillingRow[]>("workspace_billing", {
    query: [`workspace_id=eq.${workspaceId}`, "select=plan,status,monthly_agent_runs_limit,monthly_projects_limit,monthly_storage_mb_limit,current_period_start,current_period_end", "limit=1"].join("&"),
  });

  const billing = billingResult.data?.[0] ?? createDefaultBilling();
  const used = await countRows(
    "agent_runs",
    [`workspace_id=eq.${workspaceId}`, `created_at=gte.${billing.current_period_start}`, `created_at=lt.${billing.current_period_end}`].join("&"),
  );
  const limit = billing.monthly_agent_runs_limit;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: billing.status !== "cancelled" && remaining > 0,
    plan: billing.plan,
    status: billing.status,
    used,
    limit,
    remaining,
    periodStart: billing.current_period_start,
    periodEnd: billing.current_period_end,
  };
}

export async function recordBillingLimitEvent(input: {
  workspaceId: string;
  userId: string;
  eventType: "agent_run_quota_exceeded" | "billing_cancelled";
  quota: Awaited<ReturnType<typeof checkAgentRunQuota>>;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseRest("billing_limit_events", {
      method: "POST",
      body: {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        event_type: input.eventType,
        plan: input.quota.plan,
        status: input.quota.status,
        used_count: input.quota.used,
        limit_count: input.quota.limit,
        remaining_count: input.quota.remaining,
        period_start: input.quota.periodStart,
        period_end: input.quota.periodEnd,
        metadata: input.metadata ?? {},
      },
    });
  } catch {
    // Auditoria de billing nao deve derrubar a resposta principal de bloqueio.
  }
}
