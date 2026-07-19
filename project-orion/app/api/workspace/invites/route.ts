import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { canManageWorkspaceMembers, getMissingWorkspaceContextReason, getWorkspaceContextFromRequest } from "@/lib/auth-workspace-context";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

type InviteRole = "admin" | "member";
type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

interface CreateInviteBody {
  email?: string;
  role?: InviteRole;
}

interface UpdateInviteBody {
  inviteId?: string;
  action?: "revoke" | "renew";
}

interface WorkspaceInviteRow {
  id: string;
  workspace_id: string;
  email: string;
  role: InviteRole;
  status: InviteStatus;
  invited_by: string | null;
  token: string;
  expires_at: string;
  created_at: string;
}

const VALID_ROLES = new Set<InviteRole>(["admin", "member"]);

function normalizeEmail(email?: string) {
  return email?.trim().toLowerCase() ?? "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createInviteToken() {
  return randomBytes(24).toString("hex");
}

function mapInvite(row: WorkspaceInviteRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by,
    acceptPath: `/invite/${row.token}`,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json({ invites: [], source: "local-fallback", reason: getMissingWorkspaceContextReason() }, { status: 200 });
  }

  try {
    const result = await supabaseRest<WorkspaceInviteRow[]>("workspace_invites", {
      query: [
        `workspace_id=eq.${context.workspaceId}`,
        "select=id,workspace_id,email,role,status,invited_by,token,expires_at,created_at",
        "order=created_at.desc",
        "limit=50",
      ].join("&"),
    });

    if (result.error) {
      return NextResponse.json({ invites: [], source: "local-fallback", details: result.error }, { status: 200 });
    }

    return NextResponse.json({
      invites: (result.data ?? []).map(mapInvite),
      canManage: canManageWorkspaceMembers(context.role),
      permissions: {
        role: context.role ?? "bootstrap",
        canManageMembers: canManageWorkspaceMembers(context.role),
      },
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ invites: [], source: "local-fallback", reason: error.message }, { status: 200 });
    }

    return NextResponse.json({ invites: [], source: "local-fallback", error: String(error) }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json({ error: getMissingWorkspaceContextReason(), fallback: "localStorage" }, { status: 409 });
  }

  if (!canManageWorkspaceMembers(context.role)) {
    return NextResponse.json({ error: "Apenas owners e admins podem convidar membros." }, { status: 403 });
  }

  let body: CreateInviteBody;

  try {
    body = (await request.json()) as CreateInviteBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const role = body.role ?? "member";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email invalido para convite." }, { status: 400 });
  }

  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "Role do convite invalida." }, { status: 400 });
  }

  try {
    const existing = await supabaseRest<WorkspaceInviteRow[]>("workspace_invites", {
      query: [
        `workspace_id=eq.${context.workspaceId}`,
        `email=eq.${encodeURIComponent(email)}`,
        "status=eq.pending",
        "select=id,workspace_id,email,role,status,invited_by,token,expires_at,created_at",
        "limit=1",
      ].join("&"),
    });

    if (existing.data?.[0]) {
      await recordAdminAuditEvent({
        workspaceId: context.workspaceId,
        actorUserId: context.userId,
        eventType: "workspace_invite_reused",
        targetType: "workspace_invite",
        targetId: existing.data[0].id,
        metadata: {
          email,
          role: existing.data[0].role,
        },
      });

      return NextResponse.json({ invite: mapInvite(existing.data[0]), source: "supabase", reused: true });
    }

    const result = await supabaseRest<WorkspaceInviteRow[]>("workspace_invites", {
      method: "POST",
      body: {
        workspace_id: context.workspaceId,
        email,
        role,
        status: "pending",
        invited_by: context.userId,
        token: createInviteToken(),
      },
    });

    if (result.error || !result.data?.[0]) {
      return NextResponse.json({ error: "Nao foi possivel criar convite.", details: result.error }, { status: result.status });
    }

    await recordAdminAuditEvent({
      workspaceId: context.workspaceId,
      actorUserId: context.userId,
      eventType: "workspace_invite_created",
      targetType: "workspace_invite",
      targetId: result.data[0].id,
      metadata: {
        email,
        role,
      },
    });

    return NextResponse.json({ invite: mapInvite(result.data[0]), source: "supabase" });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message, fallback: "localStorage" }, { status: 503 });
    }

    return NextResponse.json({ error: "Erro inesperado ao criar convite.", details: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const context = await getWorkspaceContextFromRequest(request);

  if (!context) {
    return NextResponse.json({ error: getMissingWorkspaceContextReason(), fallback: "localStorage" }, { status: 409 });
  }

  if (!canManageWorkspaceMembers(context.role)) {
    return NextResponse.json({ error: "Apenas owners e admins podem gerenciar convites." }, { status: 403 });
  }

  let body: UpdateInviteBody;

  try {
    body = (await request.json()) as UpdateInviteBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido." }, { status: 400 });
  }

  if (!body.inviteId || !body.action) {
    return NextResponse.json({ error: "inviteId e action sao obrigatorios." }, { status: 400 });
  }

  if (!["revoke", "renew"].includes(body.action)) {
    return NextResponse.json({ error: "Acao de convite invalida." }, { status: 400 });
  }

  try {
    const patchBody =
      body.action === "revoke"
        ? {
            status: "revoked",
          }
        : {
            status: "pending",
            token: createInviteToken(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          };

    const result = await supabaseRest<WorkspaceInviteRow[]>("workspace_invites", {
      method: "PATCH",
      query: [`id=eq.${body.inviteId}`, `workspace_id=eq.${context.workspaceId}`].join("&"),
      body: patchBody,
    });

    if (result.error || !result.data?.[0]) {
      return NextResponse.json({ error: "Nao foi possivel atualizar convite.", details: result.error }, { status: result.status });
    }

    await recordAdminAuditEvent({
      workspaceId: context.workspaceId,
      actorUserId: context.userId,
      eventType: body.action === "revoke" ? "workspace_invite_revoked" : "workspace_invite_renewed",
      targetType: "workspace_invite",
      targetId: result.data[0].id,
      metadata: {
        email: result.data[0].email,
        role: result.data[0].role,
        status: result.data[0].status,
      },
    });

    return NextResponse.json({
      invite: mapInvite(result.data[0]),
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message, fallback: "localStorage" }, { status: 503 });
    }

    return NextResponse.json({ error: "Erro inesperado ao atualizar convite.", details: String(error) }, { status: 500 });
  }
}
