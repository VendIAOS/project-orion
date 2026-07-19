import { NextResponse } from "next/server";

import { supabaseRest } from "@/lib/supabase-rest";
import { StripeConfigError, verifyStripeWebhookSignature } from "@/lib/stripe-config";

type BillingPlan = "starter" | "growth" | "scale";
type BillingStatus = "trialing" | "active" | "past_due" | "cancelled";

interface StripeEvent<T = Record<string, unknown>> {
  id: string;
  type: string;
  data: {
    object: T;
  };
}

interface StripeCheckoutSession {
  id: string;
  customer?: string;
  subscription?: string;
  client_reference_id?: string;
  metadata?: Record<string, string>;
}

interface StripeSubscription {
  id: string;
  customer?: string;
  status?: string;
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string>;
}

const PLAN_LIMITS: Record<
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

function normalizePlan(value?: string): BillingPlan {
  if (value === "growth" || value === "scale") {
    return value;
  }

  return "starter";
}

function normalizeStatus(value?: string): BillingStatus {
  if (value === "active" || value === "trialing" || value === "past_due" || value === "cancelled") {
    return value;
  }

  if (value === "canceled" || value === "unpaid" || value === "incomplete_expired") {
    return "cancelled";
  }

  if (value === "incomplete") {
    return "past_due";
  }

  return "active";
}

function toIsoFromSeconds(value?: number) {
  return value ? new Date(value * 1000).toISOString() : undefined;
}

async function hasProcessedEvent(eventId: string) {
  const result = await supabaseRest<Array<{ id: string }>>("billing_webhook_events", {
    query: [`id=eq.${eventId}`, "select=id", "limit=1"].join("&"),
  });

  return Boolean(result.data?.[0]);
}

async function markEventProcessed(event: StripeEvent, workspaceId?: string) {
  await supabaseRest("billing_webhook_events", {
    method: "POST",
    body: {
      id: event.id,
      event_type: event.type,
      workspace_id: workspaceId ?? null,
      payload: event,
    },
  });
}

async function upsertBilling(input: {
  workspaceId: string;
  plan: BillingPlan;
  status: BillingStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
}) {
  const limits = PLAN_LIMITS[input.plan];

  const existing = await supabaseRest<Array<{ id: string }>>("workspace_billing", {
    query: [`workspace_id=eq.${input.workspaceId}`, "select=id", "limit=1"].join("&"),
  });

  const body = {
    workspace_id: input.workspaceId,
    plan: input.plan,
    status: input.status,
    monthly_agent_runs_limit: limits.agentRuns,
    monthly_projects_limit: limits.projects,
    monthly_storage_mb_limit: limits.storageMb,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    ...(input.currentPeriodStart ? { current_period_start: input.currentPeriodStart } : {}),
    ...(input.currentPeriodEnd ? { current_period_end: input.currentPeriodEnd } : {}),
  };

  if (existing.data?.[0]) {
    return supabaseRest("workspace_billing", {
      method: "PATCH",
      query: `workspace_id=eq.${input.workspaceId}`,
      body,
    });
  }

  return supabaseRest("workspace_billing", {
    method: "POST",
    body,
  });
}

async function handleCheckoutCompleted(event: StripeEvent<StripeCheckoutSession>) {
  const session = event.data.object;
  const workspaceId = session.metadata?.workspace_id ?? session.client_reference_id;
  const plan = normalizePlan(session.metadata?.requested_plan);

  if (!workspaceId) {
    return null;
  }

  await upsertBilling({
    workspaceId,
    plan,
    status: "active",
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
  });

  return workspaceId;
}

async function handleSubscriptionEvent(event: StripeEvent<StripeSubscription>) {
  const subscription = event.data.object;
  const workspaceId = subscription.metadata?.workspace_id;
  const plan = normalizePlan(subscription.metadata?.requested_plan);

  if (!workspaceId) {
    return null;
  }

  await upsertBilling({
    workspaceId,
    plan: event.type === "customer.subscription.deleted" ? "starter" : plan,
    status: event.type === "customer.subscription.deleted" ? "cancelled" : normalizeStatus(subscription.status),
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    currentPeriodStart: toIsoFromSeconds(subscription.current_period_start),
    currentPeriodEnd: toIsoFromSeconds(subscription.current_period_end),
  });

  return workspaceId;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature") ?? "";
  const payload = await request.text();

  try {
    if (!verifyStripeWebhookSignature(payload, signature)) {
      return NextResponse.json({ error: "Assinatura Stripe invalida." }, { status: 400 });
    }

    const event = JSON.parse(payload) as StripeEvent;

    if (await hasProcessedEvent(event.id)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    let workspaceId: string | null = null;

    if (event.type === "checkout.session.completed") {
      workspaceId = await handleCheckoutCompleted(event as unknown as StripeEvent<StripeCheckoutSession>);
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      workspaceId = await handleSubscriptionEvent(event as unknown as StripeEvent<StripeSubscription>);
    }

    await markEventProcessed(event, workspaceId ?? undefined);

    return NextResponse.json({ received: true, workspaceId });
  } catch (error) {
    if (error instanceof StripeConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ error: "Erro inesperado ao processar webhook Stripe.", details: String(error) }, { status: 500 });
  }
}
