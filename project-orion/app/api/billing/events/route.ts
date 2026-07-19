import { NextResponse } from "next/server";

import { getMissingWorkspaceContextReason, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

interface BillingWebhookEventRow {
  id: string;
  event_type: string;
  workspace_id: string | null;
  processed_at: string;
}

interface BillingLimitEventRow {
  id: string;
  event_type: string;
  workspace_id: string;
  created_at: string;
}

interface BillingTimelineEvent {
  id: string;
  event_type: string;
  workspace_id: string | null;
  processed_at: string;
  source: "stripe" | "limit";
}

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json(
      {
        source: "local-fallback",
        reason: getMissingWorkspaceContextReason(),
        events: [],
      },
      { status: 200 },
    );
  }

  try {
    const [webhookResult, limitResult] = await Promise.all([
      supabaseRest<BillingWebhookEventRow[]>("billing_webhook_events", {
        query: [
          `workspace_id=eq.${context.workspaceId}`,
          "select=id,event_type,workspace_id,processed_at",
          "order=processed_at.desc",
          "limit=12",
        ].join("&"),
      }),
      supabaseRest<BillingLimitEventRow[]>("billing_limit_events", {
        query: [
          `workspace_id=eq.${context.workspaceId}`,
          "select=id,event_type,workspace_id,created_at",
          "order=created_at.desc",
          "limit=12",
        ].join("&"),
      }),
    ]);

    if (webhookResult.error && limitResult.error) {
      return NextResponse.json({
        source: "local-fallback",
        reason: "Historico financeiro ainda nao esta disponivel no Supabase.",
        events: [],
      });
    }

    const webhookEvents: BillingTimelineEvent[] = (webhookResult.data ?? []).map((event) => ({
      ...event,
      source: "stripe",
    }));
    const limitEvents: BillingTimelineEvent[] = (limitResult.data ?? []).map((event) => ({
      id: event.id,
      event_type: event.event_type,
      workspace_id: event.workspace_id,
      processed_at: event.created_at,
      source: "limit",
    }));
    const events = [...webhookEvents, ...limitEvents]
      .sort((first, second) => new Date(second.processed_at).getTime() - new Date(first.processed_at).getTime())
      .slice(0, 12);

    return NextResponse.json({
      source: "supabase",
      events,
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ source: "local-fallback", reason: error.message, events: [] }, { status: 200 });
    }

    return NextResponse.json(
      {
        source: "local-fallback",
        error: "Erro inesperado ao carregar eventos financeiros.",
        details: String(error),
        events: [],
      },
      { status: 200 },
    );
  }
}
