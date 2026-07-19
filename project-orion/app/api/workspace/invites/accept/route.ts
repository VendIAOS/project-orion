import { NextResponse } from "next/server";

import { getSupabaseServerConfig } from "@/lib/supabase-config";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

type InviteRole = "admin" | "member";
type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

interface SupabaseAuthUser {
  id: string;
  email?: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
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
  workspaces?: WorkspaceRow;
}

interface WorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
}

function normalizeEmail(email?: string) {
  return email?.trim().toLowerCase() ?? "";
}

function getTokenFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("token")?.trim() ?? "";
}

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

async function verifyAccessToken(accessToken: string) {
  const config = getSupabaseServerConfig();

  if (!config) {
    throw new SupabaseConfigError();
  }

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const data = (await response.json()) as SupabaseAuthUser | { error?: string; msg?: string; message?: string };

  if (!response.ok || !("id" in data)) {
    return null;
  }

  return data;
}

function mapInvite(invite: WorkspaceInviteRow) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expires_at,
    createdAt: invite.created_at,
    workspace: invite.workspaces
      ? {
          id: invite.workspaces.id,
          name: invite.workspaces.name,
          slug: invite.workspaces.slug,
        }
      : null,
  };
}

async function loadInvite(token: string) {
  const result = await supabaseRest<WorkspaceInviteRow[]>("workspace_invites", {
    query: [
      `token=eq.${encodeURIComponent(token)}`,
      "select=id,workspace_id,email,role,status,invited_by,token,expires_at,created_at,workspaces(id,name,slug,owner_id)",
      "limit=1",
    ].join("&"),
  });

  return {
    invite: result.data?.[0] ?? null,
    error: result.error,
    status: result.status,
  };
}

function isExpired(invite: WorkspaceInviteRow) {
  return new Date(invite.expires_at).getTime() <= Date.now();
}

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);

  if (!token) {
    return NextResponse.json({ error: "Token do convite ausente." }, { status: 400 });
  }

  try {
    const result = await loadInvite(token);

    if (result.error || !result.invite) {
      return NextResponse.json({ error: "Convite nao encontrado.", details: result.error }, { status: 404 });
    }

    return NextResponse.json({
      invite: mapInvite(result.invite),
      expired: isExpired(result.invite),
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ error: "Erro inesperado ao carregar convite.", details: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  const accessToken = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Token do convite ausente." }, { status: 400 });
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Entre ou crie uma conta antes de aceitar o convite." }, { status: 401 });
  }

  try {
    const user = await verifyAccessToken(accessToken);

    if (!user) {
      return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
    }

    const result = await loadInvite(token);

    if (result.error || !result.invite) {
      return NextResponse.json({ error: "Convite nao encontrado.", details: result.error }, { status: 404 });
    }

    const invite = result.invite;

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Convite nao esta mais pendente.", invite: mapInvite(invite) }, { status: 409 });
    }

    if (isExpired(invite)) {
      await supabaseRest("workspace_invites", {
        method: "PATCH",
        query: `id=eq.${invite.id}`,
        body: {
          status: "expired",
        },
      });

      return NextResponse.json({ error: "Convite expirado.", invite: mapInvite(invite) }, { status: 409 });
    }

    if (normalizeEmail(user.email) !== normalizeEmail(invite.email)) {
      return NextResponse.json({ error: "Este convite pertence a outro email." }, { status: 403 });
    }

    const existingMembership = await supabaseRest<WorkspaceMemberRow[]>("workspace_members", {
      query: [
        `workspace_id=eq.${invite.workspace_id}`,
        `user_id=eq.${user.id}`,
        "select=id,workspace_id,user_id,role",
        "limit=1",
      ].join("&"),
    });

    let role: WorkspaceMemberRow["role"] = invite.role;

    if (!existingMembership.data?.[0]) {
      const memberResult = await supabaseRest<WorkspaceMemberRow[]>("workspace_members", {
        method: "POST",
        body: {
          workspace_id: invite.workspace_id,
          user_id: user.id,
          role: invite.role,
        },
      });

      if (memberResult.error || !memberResult.data?.[0]) {
        return NextResponse.json({ error: "Nao foi possivel vincular usuario ao workspace.", details: memberResult.error }, { status: memberResult.status });
      }

      role = memberResult.data[0].role;
    } else {
      role = existingMembership.data[0].role;
    }

    await supabaseRest("workspace_invites", {
      method: "PATCH",
      query: `id=eq.${invite.id}`,
      body: {
        status: "accepted",
        accepted_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      invite: mapInvite(invite),
      user: {
        id: user.id,
        email: user.email,
      },
      workspace: invite.workspaces
        ? {
            id: invite.workspaces.id,
            name: invite.workspaces.name,
            slug: invite.workspaces.slug,
            role,
          }
        : null,
      source: "supabase",
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ error: "Erro inesperado ao aceitar convite.", details: String(error) }, { status: 500 });
  }
}
