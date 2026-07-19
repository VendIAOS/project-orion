import { NextResponse } from "next/server";

import { canManageWorkspaceBilling, getMissingWorkspaceContextReason, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";
import { StripeConfigError, stripeFormRequest } from "@/lib/stripe-config";

interface WorkspaceBillingRow {
  workspace_id: string;
  stripe_customer_id: string | null;
}

interface StripePortalSession {
  id: string;
  url?: string;
}

export async function POST(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json({ error: getMissingWorkspaceContextReason() }, { status: 409 });
  }

  if (!canManageWorkspaceBilling(context.role)) {
    return NextResponse.json({ error: "Apenas owners/admins podem abrir portal financeiro." }, { status: 403 });
  }

  try {
    const billingResult = await supabaseRest<WorkspaceBillingRow[]>("workspace_billing", {
      query: [`workspace_id=eq.${context.workspaceId}`, "select=workspace_id,stripe_customer_id", "limit=1"].join("&"),
    });

    const customerId = billingResult.data?.[0]?.stripe_customer_id;

    if (!customerId) {
      return NextResponse.json({ error: "Workspace ainda nao possui cliente Stripe conectado." }, { status: 409 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
    const params = new URLSearchParams();
    params.set("customer", customerId);
    params.set("return_url", `${appUrl}/billing`);

    const session = await stripeFormRequest<StripePortalSession>("/billing_portal/sessions", params);

    return NextResponse.json({
      portalUrl: session.url,
      sessionId: session.id,
      source: "stripe",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError || error instanceof StripeConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ error: "Erro inesperado ao abrir portal financeiro.", details: String(error) }, { status: 500 });
  }
}
