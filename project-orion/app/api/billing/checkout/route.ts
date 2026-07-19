import { NextResponse } from "next/server";

import { canManageWorkspaceBilling, getMissingWorkspaceContextReason, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";
import { getStripePlanConfig, StripeConfigError, stripeFormRequest, type StripeBillingPlan } from "@/lib/stripe-config";

interface CheckoutBody {
  plan?: StripeBillingPlan;
}

interface StripeCheckoutSession {
  id: string;
  url?: string;
}

const VALID_PLANS = new Set<StripeBillingPlan>(["growth", "scale"]);

export async function POST(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json({ error: getMissingWorkspaceContextReason() }, { status: 409 });
  }

  if (!canManageWorkspaceBilling(context.role)) {
    return NextResponse.json({ error: "Apenas owners/admins podem alterar plano." }, { status: 403 });
  }

  let body: CheckoutBody;

  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido." }, { status: 400 });
  }

  const plan = body.plan;

  if (!plan || !VALID_PLANS.has(plan)) {
    return NextResponse.json({ error: "Plano invalido para checkout." }, { status: 400 });
  }

  try {
    const planConfig = getStripePlanConfig(plan);
    const params = new URLSearchParams();

    params.set("mode", "subscription");
    params.set("success_url", planConfig.successUrl);
    params.set("cancel_url", planConfig.cancelUrl);
    params.set("client_reference_id", context.workspaceId);
    params.set("line_items[0][price]", planConfig.priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[workspace_id]", context.workspaceId);
    params.set("metadata[requested_plan]", plan);
    params.set("subscription_data[metadata][workspace_id]", context.workspaceId);
    params.set("subscription_data[metadata][requested_plan]", plan);

    const session = await stripeFormRequest<StripeCheckoutSession>("/checkout/sessions", params);

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      source: "stripe",
    });
  } catch (error) {
    if (error instanceof StripeConfigError) {
      return NextResponse.json({ error: error.message, source: "stripe-not-configured" }, { status: 503 });
    }

    return NextResponse.json({ error: "Erro inesperado ao criar checkout.", details: String(error) }, { status: 500 });
  }
}
