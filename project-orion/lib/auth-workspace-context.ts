import { getSupabaseServerConfig } from "./supabase-config";
import { SupabaseConfigError, supabaseRest } from "./supabase-rest";

interface SupabaseAuthUser {
  id: string;
  email?: string;
}

interface SupabaseWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
}

interface SupabaseWorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  workspaces?: SupabaseWorkspaceRow;
}

export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
  role?: "owner" | "admin" | "member";
  source: "auth" | "bootstrap";
}

export function canManageWorkspaceBilling(role?: WorkspaceContext["role"]) {
  return !role || role === "owner" || role === "admin";
}

export function canManageWorkspaceMembers(role?: WorkspaceContext["role"]) {
  return !role || role === "owner" || role === "admin";
}

export function canOperateAgentRuns(role?: WorkspaceContext["role"]) {
  return !role || role === "owner" || role === "admin";
}

export function getBootstrapWorkspaceContext(): WorkspaceContext | null {
  // Nunca permitir o fallback de bootstrap em produção, mesmo que as
  // variáveis de ambiente estejam configuradas por engano.
  const bootstrapAllowed =
    process.env.NODE_ENV !== "production" || process.env.VENDIAOS_ALLOW_BOOTSTRAP === "true";

  if (!bootstrapAllowed) {
    return null;
  }

  const workspaceId = process.env.VENDIAOS_DEFAULT_WORKSPACE_ID;
  const userId = process.env.VENDIAOS_DEFAULT_USER_ID;

  if (!workspaceId || !userId) {
    return null;
  }

  return {
    workspaceId,
    userId,
    source: "bootstrap",
  };
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

async function loadMembership(userId: string) {
  const result = await supabaseRest<SupabaseWorkspaceMemberRow[]>("workspace_members", {
    query: [
      `user_id=eq.${userId}`,
      "select=id,workspace_id,user_id,role,workspaces(id,name,slug,owner_id)",
      "limit=1",
    ].join("&"),
  });

  if (result.error || !result.data?.[0]) {
    return null;
  }

  return result.data[0];
}

export async function getWorkspaceContextFromRequest(request: Request): Promise<WorkspaceContext | null> {
  const accessToken = getBearerToken(request);

  if (accessToken) {
    let user: SupabaseAuthUser | null = null;

    try {
      user = await verifyAccessToken(accessToken);
    } catch (error) {
      if (!(error instanceof SupabaseConfigError)) {
        throw error;
      }
    }

    if (user) {
      const membership = await loadMembership(user.id);

      if (membership) {
        return {
          workspaceId: membership.workspace_id,
          userId: user.id,
          role: membership.role,
          source: "auth",
        };
      }
    }
  }

  return getBootstrapWorkspaceContext();
}

export function getMissingWorkspaceContextReason() {
  return "Sessao/workspace autenticado ausente e IDs temporarios nao configurados.";
}
