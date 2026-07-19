import { supabaseRest } from "./supabase-rest";

export async function recordAdminAuditEvent(input: {
  workspaceId: string;
  actorUserId: string;
  eventType: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseRest("admin_audit_events", {
      method: "POST",
      body: {
        workspace_id: input.workspaceId,
        actor_user_id: input.actorUserId,
        event_type: input.eventType,
        target_type: input.targetType,
        target_id: input.targetId ?? null,
        metadata: input.metadata ?? {},
      },
    });
  } catch {
    // Auditoria administrativa e auxiliar: nao deve bloquear a acao principal.
  }
}
