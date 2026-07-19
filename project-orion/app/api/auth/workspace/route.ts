import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { getSupabaseServerConfig } from "@/lib/supabase-config";
import { SupabaseConfigError, supabaseRest } from "@/lib/supabase-rest";

interface SupabaseAuthUser {
  id: string;
  email?: string;
}

interface SupabaseWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at?: string;
}

interface SupabaseWorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  workspaces?: SupabaseWorkspaceRow;
}

function createSlug(email?: string) {
  const base = (email?.split("@")[0] || "vendiaos")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);

  return `${base || "vendiaos"}-${randomBytes(3).toString("hex")}`;
}

function createWorkspaceName(email?: string) {
  const base = email?.split("@")[0]?.trim();
  return base ? `Workspace de ${base}` : "VendIAOS Workspace";
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
    return {
      user: null,
      error: data,
      status: response.status,
    };
  }

  return {
    user: data,
    error: null,
    status: response.status,
  };
}

async function loadWorkspaceMembership(userId: string) {
  const result = await supabaseRest<SupabaseWorkspaceMemberRow[]>("workspace_members", {
    query: [
      `user_id=eq.${userId}`,
      "select=id,workspace_id,user_id,role,workspaces(id,name,slug,owner_id,created_at)",
      "limit=1",
    ].join("&"),
  });

  if (result.error) {
    return {
      member: null,
      error: result.error,
      status: result.status,
    };
  }

  return {
    member: result.data?.[0] ?? null,
    error: null,
    status: result.status,
  };
}

async function createWorkspaceForUser(user: SupabaseAuthUser) {
  const workspaceResult = await supabaseRest<SupabaseWorkspaceRow[]>("workspaces", {
    method: "POST",
    body: {
      name: createWorkspaceName(user.email),
      slug: createSlug(user.email),
      owner_id: user.id,
    },
  });

  if (workspaceResult.error || !workspaceResult.data?.[0]) {
    return {
      workspace: null,
      member: null,
      error: workspaceResult.error,
      status: workspaceResult.status,
    };
  }

  const workspace = workspaceResult.data[0];
  const memberResult = await supabaseRest<SupabaseWorkspaceMemberRow[]>("workspace_members", {
    method: "POST",
    body: {
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
    },
  });

  if (memberResult.error || !memberResult.data?.[0]) {
    return {
      workspace,
      member: null,
      error: memberResult.error,
      status: memberResult.status,
    };
  }

  return {
    workspace,
    member: memberResult.data[0],
    error: null,
    status: 200,
  };
}

export async function GET(request: Request) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    return NextResponse.json({ error: "Token de acesso ausente." }, { status: 401 });
  }

  try {
    const auth = await verifyAccessToken(accessToken);

    if (!auth.user) {
      return NextResponse.json({ error: "Sessao invalida.", details: auth.error }, { status: auth.status });
    }

    const membership = await loadWorkspaceMembership(auth.user.id);

    if (membership.error) {
      return NextResponse.json({ error: "Nao foi possivel buscar workspace do usuario.", details: membership.error }, { status: membership.status });
    }

    if (membership.member?.workspaces) {
      return NextResponse.json({
        user: {
          id: auth.user.id,
          email: auth.user.email,
        },
        workspace: {
          id: membership.member.workspaces.id,
          name: membership.member.workspaces.name,
          slug: membership.member.workspaces.slug,
          role: membership.member.role,
        },
        source: "supabase",
      });
    }

    const created = await createWorkspaceForUser(auth.user);

    if (created.error || !created.workspace || !created.member) {
      return NextResponse.json({ error: "Nao foi possivel criar workspace do usuario.", details: created.error }, { status: created.status });
    }

    return NextResponse.json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
      },
      workspace: {
        id: created.workspace.id,
        name: created.workspace.name,
        slug: created.workspace.slug,
        role: created.member.role,
      },
      source: "supabase",
      created: true,
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json(
        {
          error: error.message,
          requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Erro inesperado ao sincronizar workspace.", details: String(error) }, { status: 500 });
  }
}
